import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GitHubStrategy } from "passport-github2";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { loginRateLimiter, apiRateLimiter } from "./middleware/rate-limit";
import { generateSecret, verifyTOTP, generateOTPAuthURL } from "./utils/totp";
import { generateBackupCodes, storeBackupCodes, verifyBackupCode } from "./utils/two-factor";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  // Session configuration with better security settings
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
    resave: true,
    saveUninitialized: true,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use("/api", apiRateLimiter);

  // GitHub Strategy with better error handling
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    console.warn("GitHub OAuth credentials not found. GitHub authentication will not work.");
  } else {
    // Determine if we're in production by checking if we're running on Replit
    const isProduction = process.env.REPL_SLUG && process.env.REPL_OWNER;
    const callbackURL = isProduction
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/api/auth/github/callback`
      : "http://localhost:5000/api/auth/github/callback";

    console.log('Environment:', isProduction ? 'production' : 'development');
    console.log('Configuring GitHub strategy with callback URL:', callbackURL);
    console.log('GitHub Client ID:', process.env.GITHUB_CLIENT_ID ? 'Present' : 'Missing');
    console.log('GitHub Client Secret:', process.env.GITHUB_CLIENT_SECRET ? 'Present' : 'Missing');

    passport.use(
      new GitHubStrategy(
        {
          clientID: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
          callbackURL,
        },
        async (accessToken: string, refreshToken: string, profile: any, done: any) => {
          try {
            console.log(`GitHub auth attempt for profile ID: ${profile.id}`);
            let user = await storage.getUserByUsername(`github:${profile.id}`);
            if (!user) {
              console.log(`Creating new user for GitHub profile ID: ${profile.id}`);
              user = await storage.createUser({
                username: `github:${profile.id}`,
                password: await hashPassword(randomBytes(32).toString("hex")),
              });
            }
            return done(null, user);
          } catch (err) {
            console.error('Error in GitHub authentication:', err);
            return done(err);
          }
        }
      )
    );
  }

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // GitHub auth routes with better error logging
  app.get("/api/auth/github", (req, res, next) => {
    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
      res.status(503).json({ message: "GitHub authentication is not configured" });
      return;
    }
    console.log('Initiating GitHub authentication flow');
    passport.authenticate("github", {
      scope: ['user:email'],
      state: randomBytes(16).toString('hex')
    })(req, res, next);
  });

  app.get(
    "/api/auth/github/callback",
    (req, res, next) => {
      console.log('Received GitHub callback with query:', req.query);
      if (req.query.error) {
        console.error('GitHub OAuth error:', req.query.error);
        console.error('Error description:', req.query.error_description);
        return res.redirect('/auth?error=' + encodeURIComponent(req.query.error_description as string));
      }

      passport.authenticate("github", {
        successRedirect: "/",
        failureRedirect: "/auth",
        failureMessage: true
      })(req, res, next);
    }
  );

  // Local Strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Invalid username or password" });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }),
  );
  app.post("/api/2fa/setup", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const secret = generateSecret();
      const backupCodes = await generateBackupCodes();
      await storeBackupCodes(req.user.id, backupCodes);

      const otpauthUrl = generateOTPAuthURL(
        req.user.username,
        secret,
        'AuthApp'
      );

      await storage.updateUserTwoFactor(req.user.id, secret);

      res.json({ 
        secret,
        otpauth_url: otpauthUrl,
        backup_codes: backupCodes
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to setup 2FA" });
    }
  });

  app.post("/api/2fa/verify", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "Token is required" });

    const user = await storage.getUser(req.user.id);
    if (!user?.twoFactorSecret) {
      return res.status(400).json({ message: "2FA is not enabled" });
    }

    const isValid = verifyTOTP(token, user.twoFactorSecret);
    if (!isValid) {
      return res.status(400).json({ message: "Invalid token" });
    }

    await storage.enableTwoFactor(user.id);
    res.json({ message: "2FA verified successfully" });
  });

  app.post("/api/2fa/backup", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const { code } = req.body;
    if (!code) return res.status(400).json({ message: "Backup code is required" });

    const isValid = await verifyBackupCode(req.user.id, code);
    if (!isValid) {
      return res.status(400).json({ message: "Invalid backup code" });
    }

    res.json({ message: "Backup code verified successfully" });
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/login", loginRateLimiter, (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Authentication failed" });
      }
      req.login(user, (err) => {
        if (err) return next(err);
        res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}