import "dotenv/config";
import { z } from "zod";
import type { LogLevel } from "./logger.js";

const envSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
  GOOGLE_REDIRECT_URI: z.string().url().default("http://127.0.0.1:3005/oauth2callback"),
  GOOGLE_TOKEN_PATH: z.string().min(1).default(".tokens/google-oauth.json"),
  GOOGLE_INCLUDE_DRIVE_SCOPE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  GOOGLE_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type AppEnv = {
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  googleTokenPath: string;
  includeDriveScope: boolean;
  logLevel: LogLevel;
};

export function loadEnv(): AppEnv {
  const parsed = envSchema.parse(process.env);

  return {
    googleClientId: parsed.GOOGLE_CLIENT_ID,
    googleClientSecret: parsed.GOOGLE_CLIENT_SECRET,
    googleRedirectUri: parsed.GOOGLE_REDIRECT_URI,
    googleTokenPath: parsed.GOOGLE_TOKEN_PATH,
    includeDriveScope: parsed.GOOGLE_INCLUDE_DRIVE_SCOPE,
    logLevel: parsed.GOOGLE_LOG_LEVEL,
  };
}
