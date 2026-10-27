import { getOptionalSession } from "@/modules/identity/application/session";
import { logger } from "@/infrastructure/logging/logger";
import { createPhotoUploadIntent } from "@/modules/photos/application/photo-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const session = await getOptionalSession();
  if (!session)
    return Response.json({ error: "No autenticado" }, { status: 401 });
  const { jobId } = await params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const intent = await createPhotoUploadIntent(
      {
        jobId,
        fileName: body.fileName,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
      },
      session.user,
    );
    return Response.json(intent, {
      status: 201,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "PHOTO_JOB_LIMIT_REACHED" ? 409 : 400;
    logger.warn("photo_upload_intent_rejected", {
      jobId,
      reason:
        message === "PHOTO_JOB_LIMIT_REACHED"
          ? "PHOTO_JOB_LIMIT_REACHED"
          : "INVALID_REQUEST",
    });
    return Response.json(
      {
        error:
          message === "PHOTO_JOB_LIMIT_REACHED"
            ? "El trabajo alcanzó el límite de fotos."
            : "El archivo no cumple los requisitos de carga.",
      },
      { status },
    );
  }
}
