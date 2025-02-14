import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "./db";
import { authCodes } from "@shared/schema";
import { eq } from "drizzle-orm";
import { generateSecret, generateTOTP } from "./utils/totp";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Auth codes management
  app.post("/api/auth-codes", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      // Clean up and normalize the secret key for Google Auth compatibility
      const normalizedSecret = req.body.secretKey.replace(/\s+/g, '').toUpperCase();

      // Store the normalized secret
      const [authCode] = await db
        .insert(authCodes)
        .values({
          userId: req.user.id,
          serviceName: req.body.serviceName,
          secretKey: normalizedSecret, // Store the normalized version
          totpSecret: normalizedSecret,
        })
        .returning();

      // Generate initial TOTP code
      const currentCode = generateTOTP(authCode.totpSecret);

      res.status(201).json({
        ...authCode,
        currentCode
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

      // Generate current TOTP codes
      const codesWithTOTP = codes.map(code => ({
        ...code,
        currentCode: generateTOTP(code.totpSecret)
      }));

      res.json(codesWithTOTP);
    } catch (error) {
      console.error('Error fetching auth codes:', error);
      res.status(500).json({ message: "Failed to fetch auth codes" });
    }
  });

  // Auth code refresh endpoint
  app.post("/api/auth-codes/:id/refresh", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      // Parse ID with error handling
      const authCodeId = parseInt(req.params.id);
      if (isNaN(authCodeId)) {
        return res.status(400).json({ message: "Invalid auth code ID" });
      }

      const code = await db.query.authCodes.findFirst({
        where: eq(authCodes.id, authCodeId)
      });

      if (!code) {
        return res.status(404).json({ message: "Auth code not found" });
      }

      if (code.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Generate new TOTP code
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