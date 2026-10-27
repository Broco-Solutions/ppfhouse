import { prisma } from "@/infrastructure/db/client";
import { logger } from "@/infrastructure/logging/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = performance.now();
  try {
    await prisma.$transaction(async (tx) => tx.$queryRaw`SELECT 1`, {
      maxWait: 2_000,
      timeout: 3_000,
    });
    return Response.json(
      { status: "ok" },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    logger.error("health_check_failed", {
      durationMs: Math.round(performance.now() - startedAt),
    });
    return Response.json(
      { status: "unavailable" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
