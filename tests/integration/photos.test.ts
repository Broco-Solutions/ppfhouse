import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";

import { PrismaClient } from "@/generated/prisma/client";
import { createPostgresAdapter } from "@/infrastructure/db/adapter";
import {
  deletePrivateObject,
  getPrivateObject,
  putPrivateObject,
} from "@/infrastructure/storage/private-storage";
import {
  cleanupExpiredPhotoUploads,
  confirmPhotoUpload,
  createPhotoUploadIntent,
  deleteJobPhoto,
  getInternalPhoto,
  setCoverPhoto,
  storeLocalIntentUpload,
  updatePhotoVisibility,
} from "@/modules/photos/application/photo-service";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const prisma = new PrismaClient({
  adapter: createPostgresAdapter(connectionString),
});
const suffix = randomUUID().slice(0, 8);
let actorId = "";
let clientId = "";
let vehicleId = "";
let caseId = "";
let jobId = "";
const objectKeys = new Set<string>();

async function testJpeg(color: { r: number; g: number; b: number }) {
  return sharp({
    create: { width: 900, height: 600, channels: 3, background: color },
  })
    .jpeg({ quality: 90 })
    .withMetadata({ orientation: 6 })
    .toBuffer();
}

async function uploadPhoto(
  stage: "BEFORE" | "AFTER" | null,
  color: { r: number; g: number; b: number },
) {
  const image = await testJpeg(color);
  const intent = await createPhotoUploadIntent(
    {
      jobId,
      fileName: "detail.jpg",
      mimeType: "image/jpeg",
      sizeBytes: image.byteLength,
    },
    { id: actorId },
  );
  await storeLocalIntentUpload({
    intentId: intent.intentId,
    uploadToken: intent.uploadToken,
    mimeType: "image/jpeg",
    contents: image,
  });
  return confirmPhotoUpload(
    { intentId: intent.intentId, uploadToken: intent.uploadToken, stage },
    { id: actorId },
  );
}

describe("private job photos", () => {
  beforeAll(async () => {
    actorId = (
      await prisma.user.create({
        data: {
          name: `Photo actor ${suffix}`,
          email: `photo-${suffix}@ferraro.test`,
          role: "STAFF",
          emailVerified: true,
        },
      })
    ).id;
    clientId = (
      await prisma.client.create({
        data: { displayName: `Photo client ${suffix}` },
      })
    ).id;
    vehicleId = (
      await prisma.vehicle.create({
        data: { clientId, brand: "Porsche", model: "911" },
      })
    ).id;
    caseId = (
      await prisma.serviceCase.create({
        data: { clientId, vehicleId, origin: "DIRECT_JOB" },
      })
    ).id;
    jobId = (
      await prisma.job.create({
        data: { serviceCaseId: caseId, performedAt: new Date() },
      })
    ).id;
  });

  afterAll(async () => {
    const photos = await prisma.jobPhoto.findMany({
      where: { jobId },
      select: { originalKey: true, previewKey: true, thumbnailKey: true },
    });
    for (const photo of photos) {
      objectKeys.add(photo.originalKey);
      objectKeys.add(photo.previewKey);
      objectKeys.add(photo.thumbnailKey);
    }
    const intents = await prisma.photoUploadIntent.findMany({
      where: { jobId },
      select: { objectKey: true },
    });
    intents.forEach((intent) => objectKeys.add(intent.objectKey));
    await prisma.jobPhoto.deleteMany({ where: { jobId } });
    await prisma.photoUploadIntent.deleteMany({ where: { jobId } });
    await prisma.job.delete({ where: { id: jobId } });
    await prisma.serviceCase.delete({ where: { id: caseId } });
    await prisma.vehicle.delete({ where: { id: vehicleId } });
    await prisma.client.delete({ where: { id: clientId } });
    await prisma.user.delete({ where: { id: actorId } });
    await prisma.$disconnect();
    await Promise.all([...objectKeys].map((key) => deletePrivateObject(key)));
  });

  it("creates private variants, corrects orientation and removes EXIF from derivatives", async () => {
    const result = await uploadPhoto("BEFORE", { r: 25, g: 25, b: 25 });
    const photo = await prisma.jobPhoto.findUniqueOrThrow({
      where: { id: result.id },
    });
    expect(photo.visibleToClient).toBe(false);
    expect(photo.isCover).toBe(true);
    expect(photo.width).toBe(600);
    expect(photo.height).toBe(900);
    const preview = await getInternalPhoto(photo.id, "preview");
    const metadata = await sharp(preview.contents).metadata();
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.exif).toBeUndefined();
    expect(
      (await getPrivateObject(photo.thumbnailKey)).byteLength,
    ).toBeGreaterThan(0);
  });

  it("rejects an invalid token and content whose signature is not an image", async () => {
    const invalid = Buffer.from("this is not a jpeg");
    const intent = await createPhotoUploadIntent(
      {
        jobId,
        fileName: "fake.jpg",
        mimeType: "image/jpeg",
        sizeBytes: invalid.byteLength,
      },
      { id: actorId },
    );
    await expect(
      storeLocalIntentUpload({
        intentId: intent.intentId,
        uploadToken: `${intent.uploadToken}wrong`,
        mimeType: "image/jpeg",
        contents: invalid,
      }),
    ).rejects.toThrow("UPLOAD_TOKEN_INVALID");
    await storeLocalIntentUpload({
      intentId: intent.intentId,
      uploadToken: intent.uploadToken,
      mimeType: "image/jpeg",
      contents: invalid,
    });
    await expect(
      confirmPhotoUpload(
        { intentId: intent.intentId, uploadToken: intent.uploadToken },
        { id: actorId },
      ),
    ).rejects.toThrow();
  });

  it("publishes explicitly, changes cover and soft-deletes without losing objects", async () => {
    const second = await uploadPhoto("AFTER", { r: 130, g: 20, b: 20 });
    await updatePhotoVisibility(second.id, true, { id: actorId });
    await setCoverPhoto(second.id, { id: actorId });
    expect(
      await prisma.jobPhoto.findUnique({ where: { id: second.id } }),
    ).toMatchObject({ visibleToClient: true, isCover: true });
    await deleteJobPhoto(second.id, { id: actorId });
    const deleted = await prisma.jobPhoto.findUniqueOrThrow({
      where: { id: second.id },
    });
    expect(deleted.deletedAt).not.toBeNull();
    expect(deleted.visibleToClient).toBe(false);
    expect(deleted.isCover).toBe(false);
    await expect(getPrivateObject(deleted.originalKey)).resolves.toBeTruthy();
    expect(
      await prisma.jobPhoto.count({
        where: { jobId, isCover: true, deletedAt: null },
      }),
    ).toBe(1);
  });

  it("cleans only abandoned uploads older than the retention cutoff", async () => {
    const expiredId = randomUUID();
    const recentId = randomUUID();
    const expiredKey = `jobs/${jobId}/originals/${expiredId}.jpg`;
    const recentKey = `jobs/${jobId}/originals/${recentId}.jpg`;
    objectKeys.add(expiredKey);
    objectKeys.add(recentKey);
    await Promise.all([
      putPrivateObject(expiredKey, Buffer.from("expired")),
      putPrivateObject(recentKey, Buffer.from("recent")),
    ]);
    await prisma.photoUploadIntent.createMany({
      data: [
        {
          id: expiredId,
          jobId,
          objectKey: expiredKey,
          expectedMime: "image/jpeg",
          expectedSize: 7,
          uploadTokenHash: "a".repeat(64),
          expiresAt: new Date(Date.now() - 2 * 60 * 60 * 1_000),
        },
        {
          id: recentId,
          jobId,
          objectKey: recentKey,
          expectedMime: "image/jpeg",
          expectedSize: 6,
          uploadTokenHash: "b".repeat(64),
          expiresAt: new Date(),
        },
      ],
    });

    const result = await cleanupExpiredPhotoUploads(
      new Date(Date.now() - 60 * 60 * 1_000),
    );

    expect(result).toMatchObject({ removed: 1, hasMore: false });
    await expect(getPrivateObject(expiredKey)).rejects.toThrow();
    await expect(getPrivateObject(recentKey)).resolves.toEqual(
      Buffer.from("recent"),
    );
    expect(
      await prisma.photoUploadIntent.findUnique({ where: { id: expiredId } }),
    ).toBeNull();
    expect(
      await prisma.photoUploadIntent.findUnique({ where: { id: recentId } }),
    ).not.toBeNull();
  });
});
