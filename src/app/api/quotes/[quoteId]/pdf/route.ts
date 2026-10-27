import { getQuotePdf } from "@/modules/quotes/application/quote-service";
import { getOptionalSession } from "@/modules/identity/application/session";
import { logger } from "@/infrastructure/logging/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const session = await getOptionalSession();
  if (!session) return new Response("No autenticado", { status: 401 });
  if (session.user.role !== "ADMIN")
    return new Response("Acceso denegado", { status: 403 });
  const { quoteId } = await params;
  try {
    const pdf = await getQuotePdf(quoteId);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="presupuesto-${quoteId}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    logger.error("quote_pdf_failed", {
      quoteId,
    });
    return new Response("Presupuesto no encontrado", { status: 404 });
  }
}
