import { NextRequest, NextResponse } from "next/server";
import { getShop } from "@/lib/shops";
import { addTracker } from "@/lib/paypal";
import { invalidateScore } from "@/lib/score";
import { logEvent } from "@/lib/db";

// Coach action: push shipment tracking for an order into PayPal (Tracking API).
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = getShop(slug);
  if (!shop) return NextResponse.json({ error: "unknown shop" }, { status: 404 });
  const { transactionId, trackingNumber, carrier } = await req.json();
  if (!transactionId || !trackingNumber) {
    return NextResponse.json({ error: "transactionId and trackingNumber required" }, { status: 400 });
  }
  try {
    const r = await addTracker(shop.creds, {
      transactionId,
      trackingNumber,
      carrier: carrier || "OTHER",
    });
    const errors = (r as any).errors ?? [];
    if (errors.length) return NextResponse.json({ error: errors[0]?.message ?? "PayPal error", details: errors }, { status: 400 });
    invalidateScore(slug);
    logEvent(slug, "tracking_added", { transactionId, trackingNumber });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message, details: e?.body }, { status: 400 });
  }
}
