import {
  authorized,
  identity,
  json,
} from "@/modules/finance/application/consolidado";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!authorized(request)) return json({ error: "UNAUTHORIZED" }, 401);
  return json(identity);
}
