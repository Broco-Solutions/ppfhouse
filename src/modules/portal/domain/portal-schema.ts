import { z } from "zod";

const expirationDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .or(z.literal(""));

export const shareLinkSettingsSchema = z.object({
  clientId: z.string().uuid(),
  password: z.string().trim().max(128).optional().default(""),
  expiresOn: expirationDate,
});

export const shareLinkPasswordSchema = z.object({
  clientId: z.string().uuid(),
  password: z.string().trim().max(128),
});

export const portalUnlockSchema = z.object({
  token: z.string().min(40).max(100),
  password: z.string().max(128),
});

export function validateOptionalPortalPassword(password: string) {
  if (password.length > 0 && password.length < 6)
    throw new Error("PORTAL_PASSWORD_TOO_SHORT");
  return password || null;
}
