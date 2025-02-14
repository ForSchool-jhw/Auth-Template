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
      // Store the secret key as is - it will be encoded when generating TOTP
      const [authCode] = await db
        .insert(authCodes)
        .values({
          userId: req.user.id,
          serviceName: req.body.serviceName,
          secretKey: req.body.secretKey,
          totpSecret: req.body.secretKey, // Use the same secret for TOTP generation
        })
        .returning();

      // Return the auth code with its current TOTP code
      res.status(201).json({
        ...authCode,
        currentCode: generateTOTP(authCode.totpSecret)
      });
    } catch (error) {
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

      // Generate current TOTP codes for each auth code with different time offsets
      const codesWithTOTP = codes.map((code, index) => ({
        ...code,
        // Use a different time offset for each code to ensure they're different
        currentCode: generateTOTP(code.totpSecret, index * 2) // 2-second offset per code
      }));

      res.json(codesWithTOTP);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch auth codes" });
    }
  });

  // New endpoint to refresh a specific auth code
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

      // Check if the auth code belongs to the authenticated user
      if (code.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Generate new TOTP code with current timestamp
      const currentCode = generateTOTP(code.totpSecret);

      res.json({ ...code, currentCode });
    } catch (error) {
      res.status(500).json({ message: "Failed to refresh auth code" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}