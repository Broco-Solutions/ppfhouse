"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/modules/identity/application/authorization";
import {
  deleteJobPhoto,
  movePhoto,
  setCoverPhoto,
  updatePhotoStage,
  updatePhotoVisibility,
} from "@/modules/photos/application/photo-service";
import { photoStages } from "@/modules/photos/domain/photo-schema";

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry : "";
}

function refreshJob(jobId: string) {
  revalidatePath(`/app/jobs/${jobId}`);
}

export async function togglePhotoVisibilityAction(formData: FormData) {
  const session = await requireRole("ADMIN", "STAFF");
  const jobId = value(formData, "jobId");
  await updatePhotoVisibility(
    value(formData, "photoId"),
    value(formData, "visibleToClient") === "true",
    session.user,
  );
  refreshJob(jobId);
}

export async function updatePhotoStageAction(formData: FormData) {
  const session = await requireRole("ADMIN", "STAFF");
  const jobId = value(formData, "jobId");
  const rawStage = value(formData, "stage");
  const stage = photoStages.find((item) => item === rawStage) ?? null;
  await updatePhotoStage(value(formData, "photoId"), stage, session.user);
  refreshJob(jobId);
}

export async function setCoverPhotoAction(formData: FormData) {
  const session = await requireRole("ADMIN", "STAFF");
  const jobId = value(formData, "jobId");
  await setCoverPhoto(value(formData, "photoId"), session.user);
  refreshJob(jobId);
}

export async function movePhotoAction(formData: FormData) {
  const session = await requireRole("ADMIN", "STAFF");
  const jobId = value(formData, "jobId");
  await movePhoto(
    value(formData, "photoId"),
    value(formData, "direction") === "UP" ? "UP" : "DOWN",
    session.user,
  );
  refreshJob(jobId);
}

export async function deletePhotoAction(formData: FormData) {
  const session = await requireRole("ADMIN", "STAFF");
  const jobId = value(formData, "jobId");
  await deleteJobPhoto(value(formData, "photoId"), session.user);
  refreshJob(jobId);
}
