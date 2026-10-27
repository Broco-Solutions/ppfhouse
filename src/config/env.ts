import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().url().startsWith("postgres"),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  BUSINESS_TIME_ZONE: z
    .literal("America/Argentina/Buenos_Aires")
    .default("America/Argentina/Buenos_Aires"),
  BUSINESS_CURRENCY: z.literal("USD").default("USD"),
  VERCEL: z.string().optional(),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_S3_ENDPOINT: z.string().url().optional(),
  STORAGE_S3_REGION: z.string().min(1).default("auto"),
  STORAGE_S3_BUCKET: z.string().min(1).optional(),
  STORAGE_S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  STORAGE_S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  STORAGE_S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(input: NodeJS.ProcessEnv): ServerEnv {
  const result = serverEnvSchema.safeParse(input);

  if (!result.success) {
    const invalidKeys = result.error.issues
      .map((issue) => issue.path.join("."))
      .filter(Boolean)
      .join(", ");

    throw new Error(`Invalid server environment: ${invalidKeys}`);
  }

  const data = result.data;
  if (data.VERCEL === "1" && data.STORAGE_DRIVER !== "s3") {
    throw new Error(
      "Invalid server environment: STORAGE_DRIVER must be s3 on Vercel",
    );
  }
  if (data.STORAGE_DRIVER === "s3") {
    const required = [
      "STORAGE_S3_BUCKET",
      "STORAGE_S3_ACCESS_KEY_ID",
      "STORAGE_S3_SECRET_ACCESS_KEY",
    ] as const;
    const missing = required.filter((key) => !data[key]);
    if (missing.length) {
      throw new Error(`Invalid server environment: ${missing.join(", ")}`);
    }
  }
  return data;
}

export const env = parseServerEnv(process.env);
