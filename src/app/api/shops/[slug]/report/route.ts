import { NextRequest, NextResponse } from "next/server";
import { getShop } from "@/lib/shops";
import { computeScore } from "@/lib/score";
import { explainScore } from "@/lib/ai";
import { recentEvents } from "@/lib/db";

export const maxDuration = 60;

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = getShop(slug);
  if (!shop) return NextResponse.json({ error: "unknown shop" }, { status: 404 });
  try {
    const report = await computeScore(shop, { fresh: req.nextUrl.searchParams.has("fresh") });
    const explanation = await explainScore(report);
    const events = recentEvents(slug).map((e) => ({ ...e, detail: JSON.parse(e.detail) }));
    return NextResponse.json({ report, explanation, events });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
