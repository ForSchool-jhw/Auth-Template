import { authenticator } from "otplib";
import { db } from "../db";
import { users, backupCodes } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export async function generateTwoFactorSecret(userId: number) {
  const secret = authenticator.generateSecret();
  await db
    .update(users)
    .set({ twoFactorSecret: secret, twoFactorEnabled: true })
    .where(eq(users.id, userId));

  // Generate backup codes
  const codes = Array.from({ length: 10 }, () => 
    crypto.randomBytes(4).toString("hex").toUpperCase()
  );

  await db.insert(backupCodes).values(
    codes.map(code => ({
      userId,
      code,
      used: false
    }))
  );

  return {
    secret,
    codes
  };
}

export function verifyTwoFactorToken(secret: string, token: string) {
  return authenticator.verify({ token, secret });
}

export async function verifyBackupCode(userId: number, code: string) {
  const [backupCode] = await db
    .select()
    .from(backupCodes)
    .where(
      and(
        eq(backupCodes.userId, userId),
        eq(backupCodes.code, code),
        eq(backupCodes.used, false)
      )
    );

  if (backupCode) {
    await db
      .update(backupCodes)
      .set({ used: true })
      .where(eq(backupCodes.id, backupCode.id));
    return true;
  }

  return false;
}