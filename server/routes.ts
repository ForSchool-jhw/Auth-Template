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
      // Generate a new TOTP secret for this auth code
      const totpSecret = generateSecret();

      const [authCode] = await db
        .insert(authCodes)
        .values({
          userId: req.user.id,
          serviceName: req.body.serviceName,
          secretKey: req.body.secretKey,
          totpSecret,
        })
        .returning();

      // Return the auth code with its current TOTP code
      res.status(201).json({
        ...authCode,
        currentCode: generateTOTP(totpSecret)
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

      // Generate current TOTP codes for each auth code
      const codesWithTOTP = codes.map(code => ({
        ...code,
        currentCode: generateTOTP(code.totpSecret)
      }));

      res.json(codesWithTOTP);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch auth codes" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}