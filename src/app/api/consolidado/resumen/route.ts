import {
  authorized,
  json,
  periodRange,
  summary,
} from "@/modules/finance/application/consolidado";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!authorized(request)) return json({ error: "UNAUTHORIZED" }, 401);
  let range;
  try {
    range = periodRange(new URL(request.url).searchParams);
  } catch {
    return json({ error: "INVALID_PERIOD" }, 400);
  }
  try {
    return json(await summary(range));
  } catch {
    return json({ error: "UNAVAILABLE" }, 503);
  }
}
