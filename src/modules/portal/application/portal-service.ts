import { createHash, randomBytes } from "node:crypto";

import { env } from "@/config/env";
import { prisma } from "@/infrastructure/db/client";
import { hashPassword, verifyPassword } from "@/infrastructure/auth/password";
import { getPrivateObject } from "@/infrastructure/storage/private-storage";
import {
  portalUnlockSchema,
  shareLinkPasswordSchema,
  shareLinkSettingsSchema,
  validateOptionalPortalPassword,
} from "@/modules/portal/domain/portal-schema";
import {
  addCivilDays,
  businessDayRange,
} from "@/shared/date-time/business-time";

interface Actor {
  id: string;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createToken() {
  return randomBytes(32).toString("base64url");
}

function expiryFromDate(date?: string) {
  if (!date) return null;
  return businessDayRange(addCivilDays(date, 1)).start;
}

function linkUrl(token: string) {
  return new URL(`/client/${token}`, env.BETTER_AUTH_URL).toString();
}

export async function getClientShareLinkSummary(clientId: string) {
  const link = await prisma.clientShareLink.findFirst({
    where: { clientId },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      lastAccessAt: true,
      passwordHash: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return link
    ? {
        id: link.id,
        expiresAt: link.expiresAt,
        revokedAt: link.revokedAt,
        lastAccessAt: link.lastAccessAt,
        passwordProtected: Boolean(link.passwordHash),
        createdAt: link.createdAt,
      }
    : null;
}

export async function createClientShareLink(input: unknown, actor: Actor) {
  const data = shareLinkSettingsSchema.parse(input);
  const password = validateOptionalPortalPassword(data.password);
  const token = createToken();
  const expiresAt = expiryFromDate(data.expiresOn);
  if (expiresAt && expiresAt <= new Date())
    throw new Error("PORTAL_EXPIRATION_INVALID");
  const passwordHash = password ? await hashPassword(password) : null;
  await prisma.$transaction(async (tx) => {
    const client = await tx.client.findUnique({
      where: { id: data.clientId },
      select: { id: true },
    });
    if (!client) throw new Error("CLIENT_NOT_FOUND");
    await tx.clientShareLink.updateMany({
      where: { clientId: data.clientId, revokedAt: null },
      data: { revokedAt: new Date(), updatedById: actor.id },
    });
    await tx.clientShareLink.create({
      data: {
        clientId: data.clientId,
        tokenHash: hashToken(token),
        passwordHash,
        expiresAt,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
  });
  return { url: linkUrl(token) };
}

export async function regenerateClientShareLink(
  clientId: string,
  actor: Actor,
) {
  const token = createToken();
  const current = await prisma.clientShareLink.findFirst({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!current) throw new Error("SHARE_LINK_NOT_FOUND");
  await prisma.clientShareLink.update({
    where: { id: current.id },
    data: {
      tokenHash: hashToken(token),
      revokedAt: null,
      updatedById: actor.id,
    },
  });
  return { url: linkUrl(token) };
}

export async function updateClientShareLinkPassword(
  input: unknown,
  actor: Actor,
) {
  const data = shareLinkPasswordSchema.parse(input);
  const password = validateOptionalPortalPassword(data.password);
  const current = await prisma.clientShareLink.findFirst({
    where: { clientId: data.clientId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!current) throw new Error("SHARE_LINK_NOT_FOUND");
  await prisma.clientShareLink.update({
    where: { id: current.id },
    data: {
      passwordHash: password ? await hashPassword(password) : null,
      updatedById: actor.id,
    },
  });
}

export async function revokeClientShareLink(clientId: string, actor: Actor) {
  const result = await prisma.clientShareLink.updateMany({
    where: { clientId, revokedAt: null },
    data: { revokedAt: new Date(), updatedById: actor.id },
  });
  if (!result.count) throw new Error("SHARE_LINK_NOT_FOUND");
}

export async function resolvePortalLink(token: string) {
  if (token.length < 40 || token.length > 100) return null;
  const now = new Date();
  return prisma.clientShareLink.findFirst({
    where: {
      tokenHash: hashToken(token),
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: {
      id: true,
      clientId: true,
      tokenHash: true,
      passwordHash: true,
      expiresAt: true,
    },
  });
}

async function consumePasswordAttempt(key: string) {
  const now = BigInt(Date.now());
  const windowMs = BigInt(15 * 60 * 1_000);
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{ count: number; lastRequest: bigint }>
    >`
      SELECT "count", "lastRequest" FROM "rate_limits" WHERE "key" = ${key} FOR UPDATE
    `;
    const existing = rows[0];
    if (!existing || now - existing.lastRequest > windowMs) {
      await tx.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, lastRequest: now },
        update: { count: 1, lastRequest: now },
      });
      return true;
    }
    if (existing.count >= 5) return false;
    await tx.rateLimit.update({
      where: { key },
      data: { count: { increment: 1 }, lastRequest: now },
    });
    return true;
  });
}

export async function authenticatePortalLink(
  input: unknown,
  requestFingerprint: string,
) {
  const data = portalUnlockSchema.parse(input);
  const tokenDigest = hashToken(data.token);
  const fingerprint = createHash("sha256")
    .update(requestFingerprint || "unknown")
    .digest("hex")
    .slice(0, 24);
  const rateKey = `portal:${tokenDigest.slice(0, 24)}:${fingerprint}`;
  if (!(await consumePasswordAttempt(rateKey)))
    throw new Error("PORTAL_RATE_LIMITED");
  const link = await resolvePortalLink(data.token);
  if (
    !link ||
    (link.passwordHash &&
      !(await verifyPassword(data.password, link.passwordHash)))
  )
    throw new Error("PORTAL_ACCESS_DENIED");
  await prisma.$transaction([
    prisma.clientShareLink.update({
      where: { id: link.id },
      data: { lastAccessAt: new Date() },
    }),
    prisma.rateLimit.deleteMany({ where: { key: rateKey } }),
  ]);
  return link;
}

export async function getPortalProjection(clientId: string) {
  const now = new Date();
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      displayName: true,
      vehicles: {
        select: {
          id: true,
          brand: true,
          model: true,
          version: true,
          year: true,
          color: true,
        },
        orderBy: [{ active: "desc" }, { createdAt: "desc" }],
      },
      serviceCases: {
        select: {
          appointments: {
            where: {
              visibleToClient: true,
              status: "CONFIRMED",
              endAt: { gte: now },
            },
            select: {
              id: true,
              startAt: true,
              endAt: true,
              services: { select: { id: true, nameSnapshot: true } },
              serviceCase: {
                select: { vehicle: { select: { brand: true, model: true } } },
              },
            },
            orderBy: { startAt: "asc" },
          },
          jobs: {
            where: { voidedAt: null },
            select: {
              id: true,
              performedAt: true,
              services: {
                select: {
                  id: true,
                  nameSnapshot: true,
                  descriptionSnapshot: true,
                },
                orderBy: { sortOrder: "asc" },
              },
              photos: {
                where: { visibleToClient: true, deletedAt: null },
                select: {
                  id: true,
                  stage: true,
                  isCover: true,
                  sortOrder: true,
                },
                orderBy: { sortOrder: "asc" },
              },
              serviceCase: {
                select: { vehicle: { select: { brand: true, model: true } } },
              },
            },
            orderBy: { performedAt: "desc" },
          },
        },
      },
    },
  });
  if (!client) return null;
  return {
    id: client.id,
    displayName: client.displayName,
    vehicles: client.vehicles,
    appointments: client.serviceCases
      .flatMap((item) => item.appointments)
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
      .slice(0, 5),
    jobs: client.serviceCases
      .flatMap((item) => item.jobs)
      .sort((a, b) => b.performedAt.getTime() - a.performedAt.getTime()),
  };
}

export async function getPortalPhoto(
  clientId: string,
  photoId: string,
  variant: "thumbnail" | "preview",
) {
  const photo = await prisma.jobPhoto.findFirst({
    where: {
      id: photoId,
      visibleToClient: true,
      deletedAt: null,
      job: { voidedAt: null, serviceCase: { clientId } },
    },
    select: { thumbnailKey: true, previewKey: true },
  });
  if (!photo) throw new Error("PHOTO_NOT_FOUND");
  return getPrivateObject(
    variant === "thumbnail" ? photo.thumbnailKey : photo.previewKey,
  );
}
