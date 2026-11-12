import { NextRequest, NextResponse } from "next/server";
import { getShop } from "@/lib/shops";
import { paypal } from "@/lib/paypal";
import { invalidateScore } from "@/lib/score";
import { logEvent } from "@/lib/db";

// One webhook URL per shop: /api/webhooks/paypal/<slug>
// Subscribe in the shop's PayPal app to CUSTOMER.DISPUTE.CREATED / UPDATED / RESOLVED,
// PAYMENT.CAPTURE.COMPLETED and PAYMENT.CAPTURE.REFUNDED. Set <PREFIX>_WEBHOOK_ID in .env.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = getShop(slug);
  if (!shop) return NextResponse.json({ error: "unknown shop" }, { status: 404 });

  const raw = await req.text();
  const event = JSON.parse(raw);

  const webhookId = process.env[`${slug.toUpperCase()}_WEBHOOK_ID`];
  if (webhookId) {
    const v = await paypal(shop.creds, "/v1/notifications/verify-webhook-signature", {
      method: "POST",
      body: {
        auth_algo: req.headers.get("paypal-auth-algo"),
        cert_url: req.headers.get("paypal-cert-url"),
        transmission_id: req.headers.get("paypal-transmission-id"),
        transmission_sig: req.headers.get("paypal-transmission-sig"),
        transmission_time: req.headers.get("paypal-transmission-time"),
        webhook_id: webhookId,
        webhook_event: event,
      },
    }).catch(() => ({ verification_status: "FAILURE" }));
    if (v.verification_status !== "SUCCESS") {
      return NextResponse.json({ error: "bad signature" }, { status: 401 });
    }
  }

  invalidateScore(slug);
  logEvent(slug, "paypal_webhook", {
    type: event.event_type,
    summary: event.summary,
    resourceId: event.resource?.dispute_id ?? event.resource?.id,
  });
  return NextResponse.json({ ok: true });
}
