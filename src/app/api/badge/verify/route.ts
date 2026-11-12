import { NextRequest, NextResponse } from "next/server";
import { getShop, urlBelongsToShop } from "@/lib/shops";
import { computeScore } from "@/lib/score";
import { logEvent } from "@/lib/db";

const CORS = { "Access-Control-Allow-Origin": "*" };

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("shop") ?? "";
  const page = req.nextUrl.searchParams.get("page") ?? "";
  // The browser sets Referer; a page cannot fake it, so prefer it over the `page` param.
  const referer = req.headers.get("referer") || page;

  const shop = getShop(slug);
  if (!shop) return NextResponse.json({ ok: false }, { headers: CORS });

  // Cross-origin browsers send only the origin as Referer, so check host there and the full path on `page`.
  const sameHost = (() => {
    try {
      return new URL(referer).host === new URL(shop.siteUrl).host;
    } catch {
      return false;
    }
  })();
  if (!sameHost || !urlBelongsToShop(shop, page || referer)) {
    logEvent(shop.slug, "badge_misuse", { foundOn: referer || page, via: "badge" });
    return NextResponse.json(
      { ok: false, stolen: true, name: shop.name, realSite: shop.siteUrl, reportPath: `/check?url=${encodeURIComponent(page || referer)}` },
      { headers: CORS },
    );
  }

  try {
    const r = await computeScore(shop);
    return NextResponse.json(
      { ok: true, name: shop.name, score: r.score, tier: r.tier, reportPath: `/check?url=${encodeURIComponent(shop.siteUrl)}` },
      { headers: CORS },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false }, { headers: CORS });
  }
}
