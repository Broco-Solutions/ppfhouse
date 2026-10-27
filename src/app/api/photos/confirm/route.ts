import { getOptionalSession } from "@/modules/identity/application/session";
import { logger } from "@/infrastructure/logging/logger";
import { confirmPhotoUpload } from "@/modules/photos/application/photo-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getOptionalSession();
  if (!session)
    return Response.json({ error: "No autenticado" }, { status: 401 });
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const result = await confirmPhotoUpload(
      {
        intentId: body.intentId,
        uploadToken: body.uploadToken,
        stage: body.stage ?? null,
      },
      session.user,
    );
    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    logger.warn("photo_confirmation_rejected", {
      reason:
        message === "PHOTO_SIGNATURE_MISMATCH"
          ? "PHOTO_SIGNATURE_MISMATCH"
          : "INVALID_UPLOAD",
    });
    return Response.json(
      {
        error:
          message === "PHOTO_SIGNATURE_MISMATCH"
            ? "El contenido no coincide con el tipo de imagen."
            : "No pudimos procesar la imagen.",
      },
      { status: 400 },
    );
  }
}
