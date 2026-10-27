import { redirect } from "next/navigation";

import { authenticatePortalLink } from "@/modules/portal/application/portal-service";
import { setPortalSession } from "@/modules/portal/application/portal-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  try {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0];
    const link = await authenticatePortalLink(
      { token, password: "" },
      forwarded?.trim() || request.headers.get("x-real-ip") || "unknown",
    );
    await setPortalSession(link);
  } catch {
    redirect(`/client/${token}?invalid=1`);
  }
  redirect(`/client/${token}`);
}
