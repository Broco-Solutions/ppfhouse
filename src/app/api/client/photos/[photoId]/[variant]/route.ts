import { getPortalPhoto } from "@/modules/portal/application/portal-service";
import { getPortalSession } from "@/modules/portal/application/portal-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ photoId: string; variant: string }> },
) {
  const session = await getPortalSession();
  if (!session) return new Response("No autorizado", { status: 401 });
  const { photoId, variant } = await params;
  if (variant !== "thumbnail" && variant !== "preview")
    return new Response("Variante inválida", { status: 400 });
  try {
    const contents = await getPortalPhoto(session.clientId, photoId, variant);
    return new Response(new Uint8Array(contents), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return new Response("Foto no encontrada", { status: 404 });
  }
}
