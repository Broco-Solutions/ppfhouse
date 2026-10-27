import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { UserRole } from "@/generated/prisma/client";
import { hashPassword } from "@/infrastructure/auth/password";
import { auth } from "@/infrastructure/auth/server";
import { prisma } from "@/infrastructure/db/client";

const activeEmail = "build0-active@ferraro.test";
const inactiveEmail = "build0-inactive@ferraro.test";
const password = "Build0-integration-password";

async function createCredentialUser(email: string, active: boolean) {
  const user = await prisma.user.create({
    data: {
      name: active ? "Usuario Activo" : "Usuario Inactivo",
      email,
      emailVerified: true,
      role: UserRole.STAFF,
      active,
    },
  });

  await prisma.account.create({
    data: {
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: await hashPassword(password),
    },
  });
}

function authRequest(path: string, body: Record<string, unknown>) {
  return new Request(`http://localhost:3000/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("authentication integration", () => {
  beforeAll(async () => {
    await prisma.rateLimit.deleteMany();
    await prisma.user.deleteMany({
      where: { email: { in: [activeEmail, inactiveEmail] } },
    });
    await createCredentialUser(activeEmail, true);
    await createCredentialUser(inactiveEmail, false);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [activeEmail, inactiveEmail] } },
    });
    await prisma.rateLimit.deleteMany();
    await prisma.$disconnect();
  });

  it("keeps public signup closed", async () => {
    const response = await auth.handler(
      authRequest("/sign-up/email", {
        name: "Registro Público",
        email: "build0-signup@ferraro.test",
        password,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "EMAIL_PASSWORD_SIGN_UP_DISABLED",
    });
    await expect(
      prisma.user.findUnique({
        where: { email: "build0-signup@ferraro.test" },
      }),
    ).resolves.toBeNull();
  });

  it("creates an opaque persisted session for an active user", async () => {
    const response = await auth.handler(
      authRequest("/sign-in/email", { email: activeEmail, password }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(
      "better-auth.session_token",
    );

    const session = await prisma.session.findFirst({
      where: { user: { email: activeEmail } },
    });
    expect(session?.token).toBeTruthy();
    expect(session?.token).not.toContain(activeEmail);
  });

  it("denies session creation for an inactive user", async () => {
    const response = await auth.handler(
      authRequest("/sign-in/email", { email: inactiveEmail, password }),
    );

    expect(response.status).toBe(401);
    await expect(
      prisma.session.count({ where: { user: { email: inactiveEmail } } }),
    ).resolves.toBe(0);
  });
});
