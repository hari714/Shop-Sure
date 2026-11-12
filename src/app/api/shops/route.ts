import { NextRequest, NextResponse } from "next/server";
import { listShops, addShop, publicShop } from "@/lib/shops";
import { paypal } from "@/lib/paypal";

export async function GET() {
  return NextResponse.json(listShops().map(publicShop));
}

// "Connect PayPal": a shop owner registers their site + PayPal REST app credentials.
// Production would use PayPal Partner onboarding (third-party permissions) instead of pasted keys.
export async function POST(req: NextRequest) {
  const b = await req.json();
  const slug = String(b.name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  if (!slug || !b.siteUrl || !b.clientId || !b.clientSecret) {
    return NextResponse.json({ error: "name, siteUrl, clientId, clientSecret required" }, { status: 400 });
  }
  const creds = { clientId: b.clientId, clientSecret: b.clientSecret };
  try {
    await paypal(creds, "/v1/reporting/balances"); // proves the keys work and Transaction Search is enabled
  } catch (e: any) {
    return NextResponse.json({ error: `PayPal rejected these keys: ${e?.message}` }, { status: 400 });
  }
  addShop({ slug, name: b.name, siteUrl: b.siteUrl, ...creds });
  return NextResponse.json({ slug });
}
