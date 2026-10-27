import { APIError, betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { env } from "@/config/env";
import { prisma } from "@/infrastructure/db/client";
import { hashPassword, verifyPassword } from "@/infrastructure/auth/password";

export const auth = betterAuth({
  appName: "Ferraro Manager",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    env.BETTER_AUTH_URL,
    "https://ferraro-manager.brocosolutions.com",
  ],
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    password: {
      hash: hashPassword,
      verify: ({ hash: passwordHash, password }) =>
        verifyPassword(password, passwordHash),
    },
  },
  session: {
    expiresIn: 60 * 60 * 12,
    updateAge: 60 * 60,
  },
  user: {
    additionalFields: {
      role: {
        type: ["ADMIN", "STAFF"],
        required: true,
        defaultValue: "STAFF",
        input: false,
      },
      active: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: false,
      },
    },
  },
  advanced: {
    database: {
      generateId: "uuid",
    },
    useSecureCookies: env.NODE_ENV === "production",
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    modelName: "rateLimit",
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { active: true },
          });

          if (!user?.active) {
            throw new APIError("UNAUTHORIZED", {
              message: "No fue posible iniciar sesión.",
            });
          }

          return { data: session };
        },
        after: async (session) => {
          await prisma.user.update({
            where: { id: session.userId },
            data: { lastLoginAt: new Date() },
          });
        },
      },
    },
  },
});
