import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import { Prisma, type PhotoStage } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/db/client";
import {
  createPrivateUploadTarget,
  deletePrivateObject,
  getPrivateObject,
  putPrivateObject,
  usesDirectPrivateUploads,
} from "@/infrastructure/storage/private-storage";
import {
  allowedPhotoMimeTypes,
  confirmPhotoSchema,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_JOB,
  photoIntentSchema,
} from "@/modules/photos/domain/photo-schema";
import sharp from "sharp";

interface Actor {
  id: string;
}

const mimeExtension: Record<(typeof allowedPhotoMimeTypes)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const mimeFormat: Record<(typeof allowedPhotoMimeTypes)[number], string> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};

const EXPIRED_UPLOAD_RETENTION_MS = 24 * 60 * 60 * 1_000;
const CLEANUP_BATCH_LIMIT = 100;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function tokenMatches(token: string, expectedHash: string) {
  const actual = Buffer.from(tokenHash(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function lockJob(tx: Prisma.TransactionClient, jobId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "jobs" WHERE "id" = ${jobId}::uuid FOR UPDATE`,
  );
  if (!rows.length) throw new Error("JOB_NOT_FOUND");
}

export async function createPhotoUploadIntent(input: unknown, actor: Actor) {
  const data = photoIntentSchema.parse(input);
  const token = randomBytes(32).toString("base64url");
  const extension = mimeExtension[data.mimeType];
  const intentId = randomUUID();
  const objectKey = `jobs/${data.jobId}/originals/${intentId}.${extension}`;
  await prisma.$transaction(async (tx) => {
    await lockJob(tx, data.jobId);
    const job = await tx.job.findUnique({
      where: { id: data.jobId },
      select: { voidedAt: true },
    });
    if (!job || job.voidedAt) throw new Error("JOB_NOT_AVAILABLE");
    const photos = await tx.jobPhoto.count({
      where: { jobId: data.jobId, deletedAt: null },
    });
    const pending = await tx.photoUploadIntent.count({
      where: {
        jobId: data.jobId,
        confirmedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (photos + pending >= MAX_PHOTOS_PER_JOB)
      throw new Error("PHOTO_JOB_LIMIT_REACHED");
    await tx.photoUploadIntent.create({
      data: {
        id: intentId,
        jobId: data.jobId,
        objectKey,
        expectedMime: data.mimeType,
        expectedSize: data.sizeBytes,
        uploadTokenHash: tokenHash(token),
        expiresAt: new Date(Date.now() + 5 * 60 * 1_000),
        createdById: actor.id,
      },
    });
  });

  const direct = usesDirectPrivateUploads();
  const directTarget = direct
    ? await createPrivateUploadTarget(objectKey, data.mimeType, data.sizeBytes)
    : null;
  return {
    intentId,
    uploadToken: token,
    uploadUrl:
      directTarget?.url ??
      `/api/photo-uploads/${intentId}?token=${encodeURIComponent(token)}`,
    method: directTarget?.method ?? ("PUT" as const),
    fields: directTarget?.fields ?? {},
    headers: direct ? {} : { "Content-Type": data.mimeType },
  };
}

export async function storeLocalIntentUpload(input: {
  intentId: string;
  uploadToken: string;
  mimeType: string;
  contents: Uint8Array;
}) {
  if (usesDirectPrivateUploads()) throw new Error("LOCAL_UPLOAD_DISABLED");
  const intent = await prisma.photoUploadIntent.findUnique({
    where: { id: input.intentId },
  });
  if (!intent) throw new Error("UPLOAD_INTENT_NOT_FOUND");
  if (intent.expiresAt <= new Date()) throw new Error("UPLOAD_INTENT_EXPIRED");
  if (intent.confirmedAt) throw new Error("UPLOAD_INTENT_ALREADY_USED");
  if (!tokenMatches(input.uploadToken, intent.uploadTokenHash))
    throw new Error("UPLOAD_TOKEN_INVALID");
  if (
    input.mimeType !== intent.expectedMime ||
    input.contents.byteLength !== intent.expectedSize ||
    input.contents.byteLength > MAX_PHOTO_BYTES
  )
    throw new Error("UPLOAD_METADATA_MISMATCH");
  await putPrivateObject(intent.objectKey, input.contents);
  await prisma.photoUploadIntent.update({
    where: { id: intent.id },
    data: { uploadedAt: new Date() },
  });
}

export async function confirmPhotoUpload(input: unknown, actor: Actor) {
  const data = confirmPhotoSchema.parse(input);
  const intent = await prisma.photoUploadIntent.findUnique({
    where: { id: data.intentId },
    include: { photo: { select: { id: true } } },
  });
  if (!intent) throw new Error("UPLOAD_INTENT_NOT_FOUND");
  if (intent.photo) return { id: intent.photo.id, replayed: true };
  if (intent.expiresAt <= new Date()) throw new Error("UPLOAD_INTENT_EXPIRED");
  if (!tokenMatches(data.uploadToken, intent.uploadTokenHash))
    throw new Error("UPLOAD_TOKEN_INVALID");

  const original = await getPrivateObject(intent.objectKey);
  if (
    original.byteLength !== intent.expectedSize ||
    original.byteLength > MAX_PHOTO_BYTES
  )
    throw new Error("UPLOAD_METADATA_MISMATCH");
  const sourceMetadata = await sharp(original, {
    failOn: "error",
    limitInputPixels: 40_000_000,
  }).metadata();
  if (
    sourceMetadata.format !==
    mimeFormat[intent.expectedMime as keyof typeof mimeFormat]
  )
    throw new Error("PHOTO_SIGNATURE_MISMATCH");

  const preview = await sharp(original, {
    failOn: "error",
    limitInputPixels: 40_000_000,
  })
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  const thumbnail = await sharp(original, {
    failOn: "error",
    limitInputPixels: 40_000_000,
  })
    .rotate()
    .resize({ width: 480, height: 480, fit: "cover", position: "centre" })
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer();
  const previewKey = `jobs/${intent.jobId}/previews/${intent.id}.jpg`;
  const thumbnailKey = `jobs/${intent.jobId}/thumbnails/${intent.id}.jpg`;
  await Promise.all([
    putPrivateObject(previewKey, preview.data),
    putPrivateObject(thumbnailKey, thumbnail),
  ]);

  return prisma.$transaction(async (tx) => {
    await lockJob(tx, intent.jobId);
    const job = await tx.job.findUnique({
      where: { id: intent.jobId },
      select: { voidedAt: true },
    });
    const existing = await tx.jobPhoto.findUnique({
      where: { uploadIntentId: intent.id },
      select: { id: true },
    });
    const lastPhoto = await tx.jobPhoto.findFirst({
      where: { jobId: intent.jobId, deletedAt: null },
      select: { sortOrder: true },
      orderBy: { sortOrder: "desc" },
    });
    if (existing) return { id: existing.id, replayed: true };
    if (!job || job.voidedAt) throw new Error("JOB_NOT_AVAILABLE");
    const activeCount = await tx.jobPhoto.count({
      where: { jobId: intent.jobId, deletedAt: null },
    });
    if (activeCount >= MAX_PHOTOS_PER_JOB)
      throw new Error("PHOTO_JOB_LIMIT_REACHED");
    const photo = await tx.jobPhoto.create({
      data: {
        jobId: intent.jobId,
        uploadIntentId: intent.id,
        stage: data.stage,
        originalKey: intent.objectKey,
        previewKey,
        thumbnailKey,
        mimeType: intent.expectedMime,
        width: preview.info.width,
        height: preview.info.height,
        sizeBytes: original.byteLength,
        sortOrder: (lastPhoto?.sortOrder ?? -1) + 1,
        isCover: activeCount === 0,
        createdById: actor.id,
        updatedById: actor.id,
      },
      select: { id: true },
    });
    await tx.photoUploadIntent.update({
      where: { id: intent.id },
      data: {
        confirmedAt: new Date(),
        uploadedAt: intent.uploadedAt ?? new Date(),
      },
    });
    return { id: photo.id, replayed: false };
  });
}

export async function getInternalPhoto(
  photoId: string,
  variant: "thumbnail" | "preview" | "original",
) {
  const photo = await prisma.jobPhoto.findFirst({
    where: { id: photoId, deletedAt: null },
    select: {
      originalKey: true,
      previewKey: true,
      thumbnailKey: true,
      mimeType: true,
    },
  });
  if (!photo) throw new Error("PHOTO_NOT_FOUND");
  const key =
    variant === "original"
      ? photo.originalKey
      : variant === "preview"
        ? photo.previewKey
        : photo.thumbnailKey;
  return {
    contents: await getPrivateObject(key),
    mimeType: variant === "original" ? photo.mimeType : "image/jpeg",
  };
}

export async function updatePhotoVisibility(
  photoId: string,
  visibleToClient: boolean,
  actor: Actor,
) {
  const result = await prisma.jobPhoto.updateMany({
    where: { id: photoId, deletedAt: null },
    data: { visibleToClient, updatedById: actor.id },
  });
  if (result.count !== 1) throw new Error("PHOTO_NOT_FOUND");
}

export async function updatePhotoStage(
  photoId: string,
  stage: PhotoStage | null,
  actor: Actor,
) {
  const result = await prisma.jobPhoto.updateMany({
    where: { id: photoId, deletedAt: null },
    data: { stage, updatedById: actor.id },
  });
  if (result.count !== 1) throw new Error("PHOTO_NOT_FOUND");
}

export async function setCoverPhoto(photoId: string, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const photo = await tx.jobPhoto.findFirst({
      where: { id: photoId, deletedAt: null },
      select: { id: true, jobId: true },
    });
    if (!photo) throw new Error("PHOTO_NOT_FOUND");
    await lockJob(tx, photo.jobId);
    await tx.jobPhoto.updateMany({
      where: { jobId: photo.jobId, deletedAt: null, isCover: true },
      data: { isCover: false, updatedById: actor.id },
    });
    await tx.jobPhoto.update({
      where: { id: photo.id },
      data: { isCover: true, updatedById: actor.id },
    });
  });
}

export async function movePhoto(
  photoId: string,
  direction: "UP" | "DOWN",
  actor: Actor,
) {
  return prisma.$transaction(async (tx) => {
    const photo = await tx.jobPhoto.findFirst({
      where: { id: photoId, deletedAt: null },
      select: { id: true, jobId: true, sortOrder: true },
    });
    if (!photo) throw new Error("PHOTO_NOT_FOUND");
    await lockJob(tx, photo.jobId);
    const neighbor = await tx.jobPhoto.findFirst({
      where: {
        jobId: photo.jobId,
        deletedAt: null,
        sortOrder:
          direction === "UP"
            ? { lt: photo.sortOrder }
            : { gt: photo.sortOrder },
      },
      orderBy: { sortOrder: direction === "UP" ? "desc" : "asc" },
      select: { id: true, sortOrder: true },
    });
    if (!neighbor) return;
    await tx.jobPhoto.update({
      where: { id: photo.id },
      data: { sortOrder: neighbor.sortOrder, updatedById: actor.id },
    });
    await tx.jobPhoto.update({
      where: { id: neighbor.id },
      data: { sortOrder: photo.sortOrder, updatedById: actor.id },
    });
  });
}

export async function deleteJobPhoto(photoId: string, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const photo = await tx.jobPhoto.findFirst({
      where: { id: photoId, deletedAt: null },
      select: { id: true, jobId: true, isCover: true },
    });
    if (!photo) throw new Error("PHOTO_NOT_FOUND");
    await lockJob(tx, photo.jobId);
    await tx.jobPhoto.update({
      where: { id: photo.id },
      data: {
        deletedAt: new Date(),
        visibleToClient: false,
        isCover: false,
        updatedById: actor.id,
      },
    });
    if (photo.isCover) {
      const next = await tx.jobPhoto.findFirst({
        where: { jobId: photo.jobId, deletedAt: null },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      });
      if (next)
        await tx.jobPhoto.update({
          where: { id: next.id },
          data: { isCover: true, updatedById: actor.id },
        });
    }
  });
}

/**
 * Removes abandoned upload objects after a grace period. Confirmed uploads and
 * soft-deleted gallery photos are deliberately outside this cleanup policy.
 */
export async function cleanupExpiredPhotoUploads(
  expiredBefore = new Date(Date.now() - EXPIRED_UPLOAD_RETENTION_MS),
) {
  const intents = await prisma.photoUploadIntent.findMany({
    where: { confirmedAt: null, expiresAt: { lte: expiredBefore } },
    select: { id: true, jobId: true, objectKey: true },
    orderBy: { expiresAt: "asc" },
    take: CLEANUP_BATCH_LIMIT,
  });

  let removed = 0;
  for (const intent of intents) {
    const keys = [
      intent.objectKey,
      `jobs/${intent.jobId}/previews/${intent.id}.jpg`,
      `jobs/${intent.jobId}/thumbnails/${intent.id}.jpg`,
    ];
    await Promise.all(keys.map((key) => deletePrivateObject(key)));
    const result = await prisma.photoUploadIntent.deleteMany({
      where: {
        id: intent.id,
        confirmedAt: null,
        expiresAt: { lte: expiredBefore },
      },
    });
    removed += result.count;
  }

  return {
    examined: intents.length,
    removed,
    hasMore: intents.length === CLEANUP_BATCH_LIMIT,
  };
}
