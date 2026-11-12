import { computeScore, type ScoreReport } from "./score";
import { explainScore, inspectPage, type Explanation, type PageVerdict } from "./ai";
import { getShop, shopForUrl, urlBelongsToShop, publicShop } from "./shops";
import { logEvent } from "./db";

export type CheckResult =
  | {
      kind: "verified";
      url: string;
      tier: ScoreReport["tier"];
      score: number;
      report: ScoreReport;
      explanation: Explanation & { grounded: boolean };
    }
  | {
      kind: "unverified";
      url: string;
      tier: "danger" | "unknown";
      stolenBadge: null | { claimedShop: { slug: string; name: string; siteUrl: string } };
      page: PageVerdict | null;
      reachable: boolean;
      headline: string;
    };

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export async function checkUrl(rawUrl: string, opts: { fresh?: boolean } = {}): Promise<CheckResult> {
  const url = /^https?:\/\//.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

  const owner = shopForUrl(url);
  if (owner) {
    const report = await computeScore(owner, opts);
    const explanation = await explainScore(report);
    return { kind: "verified", url, tier: report.tier, score: report.score, report, explanation };
  }

  // Not a ShopSure-verified shop: inspect the page itself.
  let html = "";
  let reachable = false;
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    reachable = res.ok;
    html = await res.text();
  } catch {
    /* unreachable */
  }

  // Does the page carry somebody else's ShopSure badge?
  let stolenBadge: { claimedShop: ReturnType<typeof publicShop> } | null = null;
  const m = html.match(/data-shopsure-shop=["']([a-z0-9-]+)["']/i);
  if (m) {
    const claimed = getShop(m[1]);
    if (claimed && !urlBelongsToShop(claimed, url)) {
      stolenBadge = { claimedShop: publicShop(claimed) };
      logEvent(claimed.slug, "badge_misuse", { foundOn: url, via: "check" });
    }
  }

  const page = html ? await inspectPage(url, htmlToText(html)) : null;
  const danger = !!stolenBadge || page?.risk === "high";
  const headline = stolenBadge
    ? `Danger: this site shows a stolen ShopSure badge that belongs to ${stolenBadge.claimedShop.name}.`
    : !reachable
      ? "We could not open this shop. Do not pay until you can verify it."
      : danger
        ? "Danger: this shop shows strong scam warning signs."
        : "Not verified: this shop has no PayPal trust history with ShopSure. Be careful.";

  return { kind: "unverified", url, tier: danger ? "danger" : "unknown", stolenBadge, page, reachable, headline };
}
