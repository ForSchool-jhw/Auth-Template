import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "./db";
import { authCodes } from "@shared/schema";
import { eq } from "drizzle-orm";
import { generateSecret, generateTOTP } from "./utils/totp";
import { authenticator } from "otplib";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Auth codes management
  app.post("/api/auth-codes", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      // Validate and clean up the secret key
      const cleanSecret = req.body.secretKey.replace(/\s+/g, '').toUpperCase();

      // Verify the secret is valid base32 before storing
      try {
        authenticator.decode(cleanSecret);
      } catch (error) {
        return res.status(400).json({ message: "Invalid secret key format. Must be base32 encoded." });
      }

      const [authCode] = await db
        .insert(authCodes)
        .values({
          userId: req.user.id,
          serviceName: req.body.serviceName,
          secretKey: cleanSecret,
          totpSecret: cleanSecret,
        })
        .returning();

      res.status(201).json({
        ...authCode,
        currentCode: generateTOTP(authCode.totpSecret)
      });
    } catch (error) {
      console.error('Error creating auth code:', error);
      res.status(500).json({ message: "Failed to create auth code" });
    }
  });

  app.get("/api/auth-codes", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const codes = await db
        .select()
        .from(authCodes)
        .where(eq(authCodes.userId, req.user.id));

      // Generate current TOTP codes for each auth code
      const codesWithTOTP = codes.map((code) => ({
        ...code,
        currentCode: generateTOTP(code.totpSecret)
      }));

      res.json(codesWithTOTP);
    } catch (error) {
      console.error('Error fetching auth codes:', error);
      res.status(500).json({ message: "Failed to fetch auth codes" });
    }
  });

  app.post("/api/auth-codes/:id/refresh", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const authCode = await db
        .select()
        .from(authCodes)
        .where(eq(authCodes.id, parseInt(req.params.id)))
        .limit(1);

      if (!authCode.length) {
        return res.status(404).json({ message: "Auth code not found" });
      }

      const code = authCode[0];

      if (code.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const currentCode = generateTOTP(code.totpSecret);
      res.json({ ...code, currentCode });
    } catch (error) {
      console.error('Error refreshing auth code:', error);
      res.status(500).json({ message: "Failed to refresh auth code" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}