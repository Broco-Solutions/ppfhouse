import { Prisma, UserRole } from "@/generated/prisma/client";
import { hashPassword } from "@/infrastructure/auth/password";
import { prisma } from "@/infrastructure/db/client";
import {
  passwordResetSchema,
  userCreateSchema,
  userUpdateSchema,
  type PasswordResetInput,
  type UserCreateInput,
  type UserUpdateInput,
} from "@/modules/users/domain/user-schema";

interface Actor {
  id: string;
}

export type UserServiceErrorCode =
  "USER_NOT_FOUND" | "EMAIL_TAKEN" | "SELF_LOCKOUT" | "LAST_ADMIN";

export class UserServiceError extends Error {
  constructor(public readonly code: UserServiceErrorCode) {
    super(code);
    this.name = "UserServiceError";
  }
}

type Transaction = Prisma.TransactionClient;

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/**
 * Serializes role/active changes on admins so two concurrent requests cannot
 * both pass the "another active ADMIN remains" check.
 */
async function assertAnotherActiveAdmin(tx: Transaction, userId: string) {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "users" WHERE "role" = 'ADMIN' FOR UPDATE`,
  );
  const others = await tx.user.count({
    where: { role: UserRole.ADMIN, active: true, id: { not: userId } },
  });
  if (others === 0) throw new UserServiceError("LAST_ADMIN");
}

export async function listUsers(options: {
  query?: string;
  status?: "active" | "inactive" | "all";
  page?: number;
  pageSize?: number;
}) {
  const query = options.query?.trim();
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 20));
  const where: Prisma.UserWhereInput = {
    active:
      options.status === "all"
        ? undefined
        : options.status === "inactive"
          ? false
          : true,
    OR: query
      ? [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ]
      : undefined,
  };

  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        lastLoginAt: true,
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getUser(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      lastLoginAt: true,
      createdAt: true,
      accounts: {
        where: { providerId: "credential" },
        select: { id: true },
      },
    },
  });
}

export async function createUser(input: UserCreateInput) {
  const data = userCreateSchema.parse(input);
  const password = await hashPassword(data.password);

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          emailVerified: true,
          role: data.role,
          active: true,
        },
        select: { id: true },
      });
      await tx.account.create({
        data: {
          providerId: "credential",
          accountId: user.id,
          userId: user.id,
          password,
        },
      });
      return user;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserServiceError("EMAIL_TAKEN");
    throw error;
  }
}

export async function updateUser(
  id: string,
  input: UserUpdateInput,
  actor: Actor,
) {
  const data = userUpdateSchema.parse(input);

  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({
        where: { id },
        select: { role: true, active: true },
      });
      if (!current) throw new UserServiceError("USER_NOT_FOUND");

      const demotingAdmin =
        current.role === UserRole.ADMIN && data.role !== UserRole.ADMIN;
      if (demotingAdmin) {
        if (id === actor.id) throw new UserServiceError("SELF_LOCKOUT");
        if (current.active) await assertAnotherActiveAdmin(tx, id);
      }

      const user = await tx.user.update({
        where: { id },
        data: { name: data.name, email: data.email, role: data.role },
        select: { id: true },
      });
      // Role is read from the session on each request, but drop sessions on
      // role changes anyway so the user re-authenticates with the new profile.
      if (current.role !== data.role) {
        await tx.session.deleteMany({ where: { userId: id } });
      }
      return user;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserServiceError("EMAIL_TAKEN");
    throw error;
  }
}

export async function setUserActive(id: string, active: boolean, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({
      where: { id },
      select: { role: true, active: true },
    });
    if (!current) throw new UserServiceError("USER_NOT_FOUND");

    if (!active) {
      if (id === actor.id) throw new UserServiceError("SELF_LOCKOUT");
      if (current.role === UserRole.ADMIN && current.active) {
        await assertAnotherActiveAdmin(tx, id);
      }
    }

    const user = await tx.user.update({
      where: { id },
      data: { active },
      select: { id: true },
    });
    if (!active) await tx.session.deleteMany({ where: { userId: id } });
    return user;
  });
}

export async function resetUserPassword(id: string, input: PasswordResetInput) {
  const data = passwordResetSchema.parse(input);
  const password = await hashPassword(data.password);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) throw new UserServiceError("USER_NOT_FOUND");

    await tx.account.upsert({
      where: {
        providerId_accountId: { providerId: "credential", accountId: id },
      },
      create: {
        providerId: "credential",
        accountId: id,
        userId: id,
        password,
      },
      update: { password },
    });
    await tx.session.deleteMany({ where: { userId: id } });
    return user;
  });
}
