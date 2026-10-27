import { getOptionalSession } from "@/modules/identity/application/session";
import { logger } from "@/infrastructure/logging/logger";
import { storeLocalIntentUpload } from "@/modules/photos/application/photo-service";
import { MAX_PHOTO_BYTES } from "@/modules/photos/domain/photo-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ intentId: string }> },
) {
  const session = await getOptionalSession();
  if (!session) return new Response("No autenticado", { status: 401 });
  const { intentId } = await params;
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_PHOTO_BYTES)
    return new Response("Archivo demasiado grande", { status: 413 });
  try {
    await storeLocalIntentUpload({
      intentId,
      uploadToken: token,
      mimeType: request.headers.get("content-type") ?? "",
      contents: new Uint8Array(await request.arrayBuffer()),
    });
    return new Response(null, { status: 204 });
  } catch {
    logger.warn("local_photo_upload_rejected", { intentId });
    return new Response("Carga rechazada", { status: 400 });
  }
}
