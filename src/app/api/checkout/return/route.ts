import { NextRequest, NextResponse } from "next/server";
import { getShop, appUrl } from "@/lib/shops";
import { captureOrder } from "@/lib/paypal";
import { invalidateScore } from "@/lib/score";
import { logEvent } from "@/lib/db";

// PayPal sends the buyer back here after they approve the payment.
export async function GET(req: NextRequest) {
  const shopSlug = req.nextUrl.searchParams.get("shop") ?? "";
  const orderId = req.nextUrl.searchParams.get("token") ?? "";
  const shop = getShop(shopSlug);
  if (!shop || !orderId) return NextResponse.redirect(`${appUrl()}/agent?paid=error`);
  try {
    const cap = await captureOrder(shop.creds, orderId);
    const capture = cap.purchase_units?.[0]?.payments?.captures?.[0];
    logEvent(shop.slug, "sale", { orderId, captureId: capture?.id, amount: capture?.amount });
    invalidateScore(shop.slug);
    const q = new URLSearchParams({
      paid: cap.status,
      shop: shop.name,
      order: orderId,
      amount: `${capture?.amount?.currency_code ?? ""} ${capture?.amount?.value ?? ""}`,
    });
    return NextResponse.redirect(`${appUrl()}/agent?${q}`);
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(`${appUrl()}/agent?paid=error`);
  }
}
