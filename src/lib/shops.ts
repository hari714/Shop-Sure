import { getDb } from "./db";
import type { PayPalCreds } from "./paypal";

export type Shop = {
  slug: string;
  name: string;
  siteUrl: string; // the only site allowed to show this shop's badge (URL prefix)
  creds: PayPalCreds;
};

export function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

// Demo shops come from .env (each is its own PayPal sandbox business account + REST app).
function envShops(): Shop[] {
  const defs = [
    { slug: "asha", name: "Asha's Handmade", prefix: "ASHA" },
    { slug: "newleaf", name: "New Leaf Store", prefix: "NEWLEAF" },
  ];
  return defs
    .filter((d) => process.env[`${d.prefix}_CLIENT_ID`] && process.env[`${d.prefix}_CLIENT_SECRET`])
    .map((d) => ({
      slug: d.slug,
      name: d.name,
      siteUrl: `${appUrl()}/stores/${d.slug}`,
      creds: {
        clientId: process.env[`${d.prefix}_CLIENT_ID`]!,
        clientSecret: process.env[`${d.prefix}_CLIENT_SECRET`]!,
      },
    }));
}

type Row = { slug: string; name: string; site_url: string; client_id: string; client_secret: string };

export function listShops(): Shop[] {
  const rows = getDb().prepare("SELECT * FROM shops ORDER BY created_at").all() as Row[];
  const connected = rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    siteUrl: r.site_url,
    creds: { clientId: r.client_id, clientSecret: r.client_secret },
  }));
  const env = envShops();
  return [...env, ...connected.filter((c) => !env.some((e) => e.slug === c.slug))];
}

export function getShop(slug: string): Shop | undefined {
  return listShops().find((s) => s.slug === slug);
}

export function addShop(s: { slug: string; name: string; siteUrl: string; clientId: string; clientSecret: string }) {
  getDb().prepare(
    "INSERT OR REPLACE INTO shops (slug, name, site_url, client_id, client_secret, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(s.slug, s.name, s.siteUrl, s.clientId, s.clientSecret, Date.now());
}

function norm(u: string) {
  try {
    const x = new URL(u);
    return (x.host + x.pathname).replace(/\/$/, "").toLowerCase();
  } catch {
    return u.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

/** Is `pageUrl` the shop's registered site (same host + path prefix)? */
export function urlBelongsToShop(shop: Shop, pageUrl: string) {
  const site = norm(shop.siteUrl);
  const page = norm(pageUrl);
  return page === site || page.startsWith(site + "/");
}

/** Which registered shop owns this URL, if any. */
export function shopForUrl(pageUrl: string): Shop | undefined {
  return listShops().find((s) => urlBelongsToShop(s, pageUrl));
}

export function publicShop(s: Shop) {
  return { slug: s.slug, name: s.name, siteUrl: s.siteUrl };
}
