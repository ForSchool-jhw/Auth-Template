import { authenticator } from "otplib";
import { db } from "../db";
import { users, backupCodes } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

// Generate an array of backup codes
export async function generateBackupCodes(): Promise<string[]> {
  return Array.from({ length: 10 }, () =>
    crypto.randomBytes(4).toString("hex").toUpperCase()
  );
}

// Store backup codes for a user
export async function storeBackupCodes(userId: number, codes: string[]) {
  await db.insert(backupCodes).values(
    codes.map((code) => ({
      userId,
      code,
      used: false,
    }))
  );
}

export async function generateTwoFactorSecret(userId: number) {
  const secret = authenticator.generateSecret();
  await db
    .update(users)
    .set({ twoFactorSecret: secret, twoFactorEnabled: true })
    .where(eq(users.id, userId));

  const codes = await generateBackupCodes();
  await storeBackupCodes(userId, codes);

  return {
    secret,
    codes,
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