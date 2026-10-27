import { z } from "zod";

export const allowedPhotoMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const photoStages = ["BEFORE", "PROCESS", "AFTER"] as const;
export const photoStageLabels: Record<(typeof photoStages)[number], string> = {
  BEFORE: "Antes",
  PROCESS: "Proceso",
  AFTER: "Después",
};

export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
export const MAX_PHOTOS_PER_BATCH = 10;
export const MAX_PHOTOS_PER_JOB = 60;

export const photoIntentSchema = z.object({
  jobId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.enum(allowedPhotoMimeTypes),
  sizeBytes: z.number().int().positive().max(MAX_PHOTO_BYTES),
});

export const confirmPhotoSchema = z.object({
  intentId: z.string().uuid(),
  uploadToken: z.string().min(32).max(200),
  stage: z.enum(photoStages).nullable().optional(),
});

export const photoMutationSchema = z.object({
  photoId: z.string().uuid(),
  jobId: z.string().uuid(),
});
