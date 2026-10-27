import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createPostgresAdapter } from "@/infrastructure/db/adapter";
import {
  deletePrivateObject,
  putPrivateObject,
} from "@/infrastructure/storage/private-storage";
import {
  authenticatePortalLink,
  createClientShareLink,
  getPortalPhoto,
  getPortalProjection,
  regenerateClientShareLink,
  resolvePortalLink,
  revokeClientShareLink,
} from "@/modules/portal/application/portal-service";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const prisma = new PrismaClient({
  adapter: createPostgresAdapter(connectionString),
});
const suffix = randomUUID().slice(0, 8);
const objectKeys = new Set<string>();
let actorId = "";
let clientA = "";
let clientB = "";
let photoA = "";
let photoB = "";
let tokenA = "";

function tokenFromUrl(url: string) {
  return new URL(url).pathname.split("/").at(-1)!;
}

async function seedClient(label: string, brand: string) {
  const client = await prisma.client.create({
    data: {
      displayName: `Cliente compartido ${suffix}`,
      phone: "+54 341 555 0000",
      notes: `NOTA INTERNA ${label}`,
    },
  });
  const vehicle = await prisma.vehicle.create({
    data: { clientId: client.id, brand, model: "Modelo idéntico" },
  });
  const serviceCase = await prisma.serviceCase.create({
    data: { clientId: client.id, vehicleId: vehicle.id, origin: "DIRECT_JOB" },
  });
  await prisma.appointment.createMany({
    data: [
      {
        serviceCaseId: serviceCase.id,
        startAt: new Date("2030-10-10T12:00:00Z"),
        endAt: new Date("2030-10-10T16:00:00Z"),
        visibleToClient: true,
        internalNotes: `VISIBLE-NO-NOTA-${label}`,
      },
      {
        serviceCaseId: serviceCase.id,
        startAt: new Date("2030-10-11T12:00:00Z"),
        endAt: new Date("2030-10-11T16:00:00Z"),
        visibleToClient: false,
        internalNotes: `TURNO OCULTO ${label}`,
      },
    ],
  });
  const job = await prisma.job.create({
    data: {
      serviceCaseId: serviceCase.id,
      performedAt: new Date("2029-05-10T12:00:00Z"),
      notes: `NOTA JOB ${label}`,
      services: {
        create: {
          nameSnapshot: `Servicio ${label}`,
          descriptionSnapshot: `Descripción pública ${label}`,
        },
      },
    },
  });
  const intent = await prisma.photoUploadIntent.create({
    data: {
      jobId: job.id,
      objectKey: `portal-test/${suffix}/${label}/original.jpg`,
      expectedMime: "image/jpeg",
      expectedSize: 4,
      uploadTokenHash: randomUUID().replaceAll("-", ""),
      expiresAt: new Date("2031-01-01T00:00:00Z"),
      confirmedAt: new Date(),
    },
  });
  const keys = {
    original: intent.objectKey,
    preview: `portal-test/${suffix}/${label}/preview.jpg`,
    thumbnail: `portal-test/${suffix}/${label}/thumbnail.jpg`,
  };
  Object.values(keys).forEach((key) => objectKeys.add(key));
  await Promise.all(
    Object.values(keys).map((key) =>
      putPrivateObject(key, Buffer.from("jpeg")),
    ),
  );
  const photo = await prisma.jobPhoto.create({
    data: {
      jobId: job.id,
      uploadIntentId: intent.id,
      originalKey: keys.original,
      previewKey: keys.preview,
      thumbnailKey: keys.thumbnail,
      mimeType: "image/jpeg",
      width: 100,
      height: 100,
      sizeBytes: 4,
      visibleToClient: true,
      isCover: true,
    },
  });
  const privateIntent = await prisma.photoUploadIntent.create({
    data: {
      jobId: job.id,
      objectKey: `portal-test/${suffix}/${label}/private-original.jpg`,
      expectedMime: "image/jpeg",
      expectedSize: 4,
      uploadTokenHash: `${randomUUID().replaceAll("-", "")}p`,
      expiresAt: new Date("2031-01-01T00:00:00Z"),
      confirmedAt: new Date(),
    },
  });
  const privateKeys = {
    original: privateIntent.objectKey,
    preview: `portal-test/${suffix}/${label}/private-preview.jpg`,
    thumbnail: `portal-test/${suffix}/${label}/private-thumbnail.jpg`,
  };
  Object.values(privateKeys).forEach((key) => objectKeys.add(key));
  await Promise.all(
    Object.values(privateKeys).map((key) =>
      putPrivateObject(key, Buffer.from("private")),
    ),
  );
  await prisma.jobPhoto.create({
    data: {
      jobId: job.id,
      uploadIntentId: privateIntent.id,
      originalKey: privateKeys.original,
      previewKey: privateKeys.preview,
      thumbnailKey: privateKeys.thumbnail,
      mimeType: "image/jpeg",
      width: 100,
      height: 100,
      sizeBytes: 7,
      visibleToClient: false,
      sortOrder: 1,
    },
  });
  return { clientId: client.id, photoId: photo.id };
}

describe("client portal isolation", () => {
  beforeAll(async () => {
    actorId = (
      await prisma.user.create({
        data: {
          name: `Portal admin ${suffix}`,
          email: `portal-${suffix}@ferraro.test`,
          role: "ADMIN",
          emailVerified: true,
        },
      })
    ).id;
    const a = await seedClient("A", "BMW");
    const b = await seedClient("B", "Audi");
    clientA = a.clientId;
    clientB = b.clientId;
    photoA = a.photoId;
    photoB = b.photoId;
    tokenA = tokenFromUrl(
      (
        await createClientShareLink(
          { clientId: clientA, password: "Clave-A", expiresOn: "" },
          { id: actorId },
        )
      ).url,
    );
  });

  afterAll(async () => {
    await prisma.rateLimit.deleteMany({
      where: { key: { startsWith: "portal:" } },
    });
    await prisma.clientShareLink.deleteMany({
      where: { clientId: { in: [clientA, clientB] } },
    });
    const cases = await prisma.serviceCase.findMany({
      where: { clientId: { in: [clientA, clientB] } },
      select: { id: true },
    });
    const caseIds = cases.map((item) => item.id);
    const jobs = await prisma.job.findMany({
      where: { serviceCaseId: { in: caseIds } },
      select: { id: true },
    });
    const jobIds = jobs.map((item) => item.id);
    await prisma.jobPhoto.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.photoUploadIntent.deleteMany({
      where: { jobId: { in: jobIds } },
    });
    await prisma.jobService.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
    await prisma.appointment.deleteMany({
      where: { serviceCaseId: { in: caseIds } },
    });
    await prisma.serviceCase.deleteMany({ where: { id: { in: caseIds } } });
    await prisma.vehicle.deleteMany({
      where: { clientId: { in: [clientA, clientB] } },
    });
    await prisma.client.deleteMany({
      where: { id: { in: [clientA, clientB] } },
    });
    await prisma.user.delete({ where: { id: actorId } });
    await prisma.$disconnect();
    await Promise.all([...objectKeys].map(deletePrivateObject));
  });

  it("accepts only the correct password and limits repeated failures", async () => {
    const stored = await prisma.clientShareLink.findFirstOrThrow({
      where: { clientId: clientA, revokedAt: null },
      select: { tokenHash: true, passwordHash: true },
    });
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.passwordHash).not.toContain("Clave-A");
    await expect(
      authenticatePortalLink(
        { token: tokenA, password: "incorrecta" },
        "ip-one",
      ),
    ).rejects.toThrow("PORTAL_ACCESS_DENIED");
    await expect(
      authenticatePortalLink({ token: tokenA, password: "Clave-A" }, "ip-good"),
    ).resolves.toMatchObject({ clientId: clientA });
    for (let index = 0; index < 5; index += 1) {
      await expect(
        authenticatePortalLink({ token: tokenA, password: "mal" }, "ip-limit"),
      ).rejects.toThrow("PORTAL_ACCESS_DENIED");
    }
    await expect(
      authenticatePortalLink({ token: tokenA, password: "mal" }, "ip-limit"),
    ).rejects.toThrow("PORTAL_RATE_LIMITED");
  });

  it("projects only the owning client and explicit public flags", async () => {
    const projection = await getPortalProjection(clientA);
    expect(projection?.vehicles.map((item) => item.brand)).toEqual(["BMW"]);
    expect(projection?.appointments).toHaveLength(1);
    expect(projection?.jobs).toHaveLength(1);
    expect(projection?.jobs[0]?.photos.map((item) => item.id)).toEqual([
      photoA,
    ]);
    expect(JSON.stringify(projection)).not.toContain("TURNO OCULTO");
    expect(JSON.stringify(projection)).not.toContain("NOTA INTERNA");
    expect(JSON.stringify(projection)).not.toContain("NOTA JOB");
    expect(JSON.stringify(projection)).not.toContain("Audi");
  });

  it("rejects cross-client photo access", async () => {
    await expect(
      getPortalPhoto(clientA, photoA, "thumbnail"),
    ).resolves.toBeTruthy();
    await expect(getPortalPhoto(clientA, photoB, "thumbnail")).rejects.toThrow(
      "PHOTO_NOT_FOUND",
    );
    await expect(getPortalPhoto(clientB, photoA, "preview")).rejects.toThrow(
      "PHOTO_NOT_FOUND",
    );
  });

  it("invalidates old tokens on regeneration and rejects revoked or expired links", async () => {
    const regenerated = await regenerateClientShareLink(clientA, {
      id: actorId,
    });
    const newToken = tokenFromUrl(regenerated.url);
    expect(await resolvePortalLink(tokenA)).toBeNull();
    expect(await resolvePortalLink(newToken)).toMatchObject({
      clientId: clientA,
    });
    await revokeClientShareLink(clientA, { id: actorId });
    expect(await resolvePortalLink(newToken)).toBeNull();
    const expired = await createClientShareLink(
      { clientId: clientB, password: "", expiresOn: "" },
      { id: actorId },
    );
    const expiredToken = tokenFromUrl(expired.url);
    await expect(
      authenticatePortalLink(
        { token: expiredToken, password: "" },
        "ip-unprotected",
      ),
    ).resolves.toMatchObject({ clientId: clientB });
    await prisma.clientShareLink.updateMany({
      where: { clientId: clientB, revokedAt: null },
      data: { expiresAt: new Date("2020-01-01T00:00:00Z") },
    });
    expect(await resolvePortalLink(expiredToken)).toBeNull();
  });
});
