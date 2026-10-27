import "dotenv/config";

import { z } from "zod";

import { PrismaClient, UserRole } from "../src/generated/prisma/client";
import { hashPassword } from "../src/infrastructure/auth/password";
import { createPostgresAdapter } from "../src/infrastructure/db/adapter";

const bootstrapEnvSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgres"),
  BOOTSTRAP_ADMIN_NAME: z.string().trim().min(2),
  BOOTSTRAP_ADMIN_EMAIL: z
    .string()
    .email()
    .transform((value) => value.toLowerCase()),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).max(128),
});

async function main() {
  const config = bootstrapEnvSchema.parse(process.env);
  const prisma = new PrismaClient({
    adapter: createPostgresAdapter(config.DATABASE_URL),
  });

  try {
    const existing = await prisma.user.findUnique({
      where: { email: config.BOOTSTRAP_ADMIN_EMAIL },
      select: { id: true, role: true },
    });

    if (existing && existing.role !== UserRole.ADMIN) {
      throw new Error(
        "Bootstrap refused: the email already belongs to a non-ADMIN user.",
      );
    }

    const password = await hashPassword(config.BOOTSTRAP_ADMIN_PASSWORD);

    const user = await prisma.$transaction(async (transaction) => {
      const admin = existing
        ? await transaction.user.update({
            where: { id: existing.id },
            data: {
              name: config.BOOTSTRAP_ADMIN_NAME,
              active: true,
              emailVerified: true,
            },
          })
        : await transaction.user.create({
            data: {
              name: config.BOOTSTRAP_ADMIN_NAME,
              email: config.BOOTSTRAP_ADMIN_EMAIL,
              emailVerified: true,
              role: UserRole.ADMIN,
              active: true,
            },
          });

      await transaction.account.upsert({
        where: {
          providerId_accountId: {
            providerId: "credential",
            accountId: admin.id,
          },
        },
        create: {
          providerId: "credential",
          accountId: admin.id,
          userId: admin.id,
          password,
        },
        update: { password },
      });

      return admin;
    });

    console.info(`ADMIN bootstrap complete for ${user.email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`ADMIN bootstrap failed: ${message}`);
  process.exitCode = 1;
});
