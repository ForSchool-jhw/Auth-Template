import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { loginRateLimiter, apiRateLimiter } from "./middleware/rate-limit";
import { generateSecret, verifyTOTP, generateOTPAuthURL } from "./utils/totp";
import { generateBackupCodes, storeBackupCodes } from "./utils/two-factor";

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
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
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

  // Setup 2FA
  app.post("/api/2fa/setup", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const secret = generateSecret();
      const backupCodes = await generateBackupCodes();
      await storeBackupCodes(req.user.id, backupCodes);

      // Generate otpauth URL using the standardized format
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
    passport.authenticate("local", (err, user, info) => {
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