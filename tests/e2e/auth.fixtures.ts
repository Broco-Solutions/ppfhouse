import { PrismaClient, UserRole } from "../../src/generated/prisma/client";
import { hashPassword } from "../../src/infrastructure/auth/password";
import { createPostgresAdapter } from "../../src/infrastructure/db/adapter";

export const e2eUsers = {
  admin: {
    name: "Admin E2E",
    email: "build0-admin-e2e@ferraro.test",
    password: "Build0-admin-e2e-password",
    role: UserRole.ADMIN,
  },
  staff: {
    name: "Staff E2E",
    email: "build0-staff-e2e@ferraro.test",
    password: "Build0-staff-e2e-password",
    role: UserRole.STAFF,
  },
} as const;

export function createTestPrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for E2E");
  return new PrismaClient({ adapter: createPostgresAdapter(connectionString) });
}

function isTransientLocalDatabaseError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Server has closed the connection") ||
    error.message.includes("Connection terminated unexpectedly")
  );
}

export async function withTestPrisma<T>(
  operation: (prisma: PrismaClient) => Promise<T>,
  attempt = 0,
): Promise<T> {
  const prisma = createTestPrisma();
  try {
    return await operation(prisma);
  } catch (error) {
    if (attempt < 5 && isTransientLocalDatabaseError(error)) {
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      return withTestPrisma(operation, attempt + 1);
    }
    throw error;
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

export async function resetE2EAuthRateLimit() {
  await withTestPrisma(async (prisma) => {
    await prisma.rateLimit.deleteMany();
  });
}

export async function upsertE2EUsers() {
  const prisma = createTestPrisma();

  try {
    await prisma.rateLimit.deleteMany();

    for (const fixture of Object.values(e2eUsers)) {
      const password = await hashPassword(fixture.password);
      const user = await prisma.user.upsert({
        where: { email: fixture.email },
        create: {
          name: fixture.name,
          email: fixture.email,
          emailVerified: true,
          role: fixture.role,
          active: true,
        },
        update: {
          name: fixture.name,
          role: fixture.role,
          active: true,
        },
      });

      await prisma.account.upsert({
        where: {
          providerId_accountId: {
            providerId: "credential",
            accountId: user.id,
          },
        },
        create: {
          providerId: "credential",
          accountId: user.id,
          userId: user.id,
          password,
        },
        update: { password },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

export async function removeE2EUsers() {
  await withTestPrisma(async (prisma) => {
    await prisma.user.deleteMany({
      where: {
        email: { in: Object.values(e2eUsers).map((user) => user.email) },
      },
    });
    await prisma.rateLimit.deleteMany();
  });
}
