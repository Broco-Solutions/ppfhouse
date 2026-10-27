import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { UserRole } from "@/generated/prisma/client";
import { auth } from "@/infrastructure/auth/server";
import { prisma } from "@/infrastructure/db/client";
import {
  createUser,
  listUsers,
  resetUserPassword,
  setUserActive,
  updateUser,
} from "@/modules/users/application/user-service";

const prefix = "users-abm-";
const domain = "@ferraro.test";
const password = "Users-abm-integration-password";
const newPassword = "Users-abm-new-password-123";

function email(name: string) {
  return `${prefix}${name}${domain}`;
}

function signIn(userEmail: string, userPassword: string) {
  return auth.handler(
    new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: userEmail, password: userPassword }),
    }),
  );
}

async function cleanup() {
  await prisma.user.deleteMany({
    where: { email: { startsWith: prefix, endsWith: domain } },
  });
  await prisma.rateLimit.deleteMany();
}

let adminId = "";

describe("user management integration", () => {
  beforeAll(async () => {
    await cleanup();
    const admin = await createUser({
      name: "Admin ABM",
      email: email("admin"),
      role: "ADMIN",
      password,
      passwordConfirmation: password,
    });
    adminId = admin.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("creates a credential user that can sign in and rejects duplicate emails", async () => {
    const staff = await createUser({
      name: "Staff ABM",
      email: email("staff"),
      role: "STAFF",
      password,
      passwordConfirmation: password,
    });
    expect((await signIn(email("staff"), password)).status).toBe(200);
    await expect(
      createUser({
        name: "Duplicado",
        email: email("staff"),
        role: "STAFF",
        password,
        passwordConfirmation: password,
      }),
    ).rejects.toMatchObject({ code: "EMAIL_TAKEN" });

    const list = await listUsers({ query: "Staff ABM" });
    expect(list.items.map((item) => item.id)).toContain(staff.id);
  });

  it("deactivation revokes sessions and blocks login; reactivation restores it", async () => {
    const staff = await prisma.user.findUniqueOrThrow({
      where: { email: email("staff") },
    });
    await prisma.rateLimit.deleteMany();
    expect((await signIn(email("staff"), password)).status).toBe(200);
    expect(await prisma.session.count({ where: { userId: staff.id } })).toBe(2);

    await setUserActive(staff.id, false, { id: adminId });
    expect(await prisma.session.count({ where: { userId: staff.id } })).toBe(0);
    expect((await signIn(email("staff"), password)).status).not.toBe(200);
    expect(await listUsers({ query: "Staff ABM" })).toMatchObject({ total: 0 });

    await setUserActive(staff.id, true, { id: adminId });
    await prisma.rateLimit.deleteMany();
    expect((await signIn(email("staff"), password)).status).toBe(200);
  });

  it("resets the password and closes open sessions", async () => {
    const staff = await prisma.user.findUniqueOrThrow({
      where: { email: email("staff") },
    });
    await resetUserPassword(staff.id, {
      password: newPassword,
      passwordConfirmation: newPassword,
    });
    expect(await prisma.session.count({ where: { userId: staff.id } })).toBe(0);
    await prisma.rateLimit.deleteMany();
    expect((await signIn(email("staff"), password)).status).not.toBe(200);
    expect((await signIn(email("staff"), newPassword)).status).toBe(200);
  });

  it("prevents self lockout and removing the last active ADMIN", async () => {
    await expect(
      setUserActive(adminId, false, { id: adminId }),
    ).rejects.toMatchObject({ code: "SELF_LOCKOUT" });
    await expect(
      updateUser(
        adminId,
        { name: "Admin ABM", email: email("admin"), role: "STAFF" },
        { id: adminId },
      ),
    ).rejects.toMatchObject({ code: "SELF_LOCKOUT" });

    const otherAdmins = await prisma.user.findMany({
      where: { role: UserRole.ADMIN, active: true, id: { not: adminId } },
      select: { id: true },
    });
    const staff = await prisma.user.findUniqueOrThrow({
      where: { email: email("staff") },
    });
    // Temporarily make adminId the only active ADMIN.
    await prisma.user.updateMany({
      where: { id: { in: otherAdmins.map((user) => user.id) } },
      data: { active: false },
    });
    try {
      await expect(
        setUserActive(adminId, false, { id: staff.id }),
      ).rejects.toMatchObject({ code: "LAST_ADMIN" });
      await expect(
        updateUser(
          adminId,
          { name: "Admin ABM", email: email("admin"), role: "STAFF" },
          { id: staff.id },
        ),
      ).rejects.toMatchObject({ code: "LAST_ADMIN" });
    } finally {
      await prisma.user.updateMany({
        where: { id: { in: otherAdmins.map((user) => user.id) } },
        data: { active: true },
      });
    }

    await updateUser(
      staff.id,
      { name: "Staff Promovido", email: email("staff"), role: "ADMIN" },
      { id: adminId },
    );
    await expect(
      setUserActive(adminId, false, { id: staff.id }),
    ).resolves.toMatchObject({ id: adminId });
  });
});
