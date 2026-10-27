import { getOptionalSession } from "@/modules/identity/application/session";
import { getInternalPhoto } from "@/modules/photos/application/photo-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const photoVariants = ["thumbnail", "preview", "original"] as const;

function isPhotoVariant(
  value: string,
): value is (typeof photoVariants)[number] {
  return photoVariants.some((variant) => variant === value);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ photoId: string; variant: string }> },
) {
  const session = await getOptionalSession();
  if (!session) return new Response("No autenticado", { status: 401 });
  const { photoId, variant } = await params;
  if (!isPhotoVariant(variant))
    return new Response("Variante inválida", { status: 400 });
  try {
    const photo = await getInternalPhoto(photoId, variant);
    return new Response(new Uint8Array(photo.contents), {
      headers: {
        "Content-Type": photo.mimeType,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response("Foto no encontrada", { status: 404 });
  }
}
