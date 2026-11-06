import {
  authorized,
  json,
  periodRange,
} from "@/modules/finance/application/consolidado";
import { getConsolidatedCollections } from "@/modules/finance/application/cobros";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!authorized(request)) return json({ error: "UNAUTHORIZED" }, 401);
  let range;
  let page;
  try {
    const params = new URL(request.url).searchParams;
    if (params.getAll("periodo").length !== 1)
      throw new Error("INVALID_PERIOD");
    range = periodRange(params);
    const raw = params.get("pagina") ?? "1";
    page = Number(raw);
    if (
      params.getAll("pagina").length > 1 ||
      !/^[1-9]\d*$/.test(raw) ||
      !Number.isSafeInteger(page) ||
      page > 1000000
    )
      throw new Error("INVALID_PAGE");
  } catch {
    return json({ error: "INVALID_FILTER" }, 400);
  }
  try {
    return json(await getConsolidatedCollections(range, page));
  } catch {
    return json({ error: "UNAVAILABLE" }, 503);
  }
}
