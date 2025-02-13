import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
  twoFactorSecret: text("two_factor_secret"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const loginAttempts = pgTable("login_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  ipAddress: text("ip_address").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  successful: boolean("successful").notNull(),
});

export const backupCodes = pgTable("backup_codes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  code: text("code").notNull(),
  used: boolean("used").default(false).notNull(),
});

export const authCodes = pgTable("auth_codes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  serviceName: text("service_name").notNull(),
  secretKey: text("secret_key").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertAuthCodeSchema = createInsertSchema(authCodes).pick({
  serviceName: true,
  secretKey: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type AuthCode = typeof authCodes.$inferSelect;
export type InsertAuthCode = z.infer<typeof insertAuthCodeSchema>;