// Deterministic trust score. The AI never decides the number — it only explains these facts.
import { listTransactions, listDisputes, getTrackers } from "./paypal";
import type { Shop } from "./shops";
import { getDb } from "./db";

export type Evidence = {
  id: string; // e.g. "metric:buyers"
  label: string;
  value: string;
  records: { id: string; note: string }[]; // real PayPal record IDs backing this fact
};

export type Signal = {
  key: "customers" | "shipping" | "complaints" | "refunds" | "website";
  label: string;
  points: number;
  max: number;
  evidenceIds: string[];
};

export type ScoreReport = {
  shop: { slug: string; name: string; siteUrl: string };
  score: number;
  tier: "trusted" | "new" | "danger";
  signals: Signal[];
  evidence: Evidence[];
  flags: string[];
  untrackedSales: { transactionId: string; amount: string; date: string; buyer: string }[];
  sales: SaleRow[];
  disputes: DisputeRow[];
  computedAt: number;
};

export type SaleRow = {
  transactionId: string;
  date: string;
  amount: number;
  currency: string;
  buyer: string;
  tracked: boolean;
  refunded: boolean;
};

export type DisputeRow = {
  disputeId: string;
  reason: string;
  status: string;
  amount: string;
  created: string;
};

const SALE_CODES = /^T00(0[0-9]|1[0-9])$/; // payment received event codes
const REFUND_CODES = /^T11/; // reversals & refunds

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

async function websiteChecks(siteUrl: string) {
  try {
    const res = await fetch(siteUrl, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    const html = (await res.text()).toLowerCase();
    return {
      reachable: res.ok,
      https: siteUrl.startsWith("https://") || siteUrl.startsWith("http://localhost"),
      hasReturnPolicy: /return policy|refund policy|returns/.test(html),
      hasContact: /contact|@[a-z0-9-]+\.[a-z]{2,}|phone/.test(html),
    };
  } catch {
    return { reachable: false, https: false, hasReturnPolicy: false, hasContact: false };
  }
}

export async function computeScore(shop: Shop, opts: { fresh?: boolean } = {}): Promise<ScoreReport> {
  if (!opts.fresh) {
    const row = getDb()
      .prepare("SELECT report, created_at FROM score_cache WHERE shop_slug = ?")
      .get(shop.slug) as { report: string; created_at: number } | undefined;
    if (row && Date.now() - row.created_at < 10 * 60_000) return JSON.parse(row.report);
  }

  const [txns, disputes, site] = await Promise.all([
    listTransactions(shop.creds, 90),
    listDisputes(shop.creds).catch(() => []),
    websiteChecks(shop.siteUrl),
  ]);

  const salesRaw = txns.filter(
    (t) =>
      SALE_CODES.test(t.transaction_info?.transaction_event_code ?? "") &&
      t.transaction_info?.transaction_status === "S" &&
      Number(t.transaction_info?.transaction_amount?.value) > 0,
  );
  const refundsRaw = txns.filter((t) =>
    REFUND_CODES.test(t.transaction_info?.transaction_event_code ?? ""),
  );
  const refundedIds = new Set(
    refundsRaw.map((r) => r.transaction_info?.paypal_reference_id).filter(Boolean),
  );

  const recent = salesRaw
    .sort((a, b) =>
      (b.transaction_info.transaction_initiation_date ?? "").localeCompare(
        a.transaction_info.transaction_initiation_date ?? "",
      ),
    )
    .slice(0, 60);
  const trackers = await pool(recent, 6, (t) =>
    getTrackers(shop.creds, t.transaction_info.transaction_id).catch(() => []),
  );

  // Guest card checkouts get a fresh account_id every time, so identify people by
  // email, then name, and only fall back to account_id. Stops one person posing as many buyers.
  const buyerOf = (t: any) =>
    (
      t.payer_info?.email_address ||
      t.payer_info?.payer_name?.alternate_full_name ||
      [t.payer_info?.payer_name?.given_name, t.payer_info?.payer_name?.surname].filter(Boolean).join(" ") ||
      t.payer_info?.account_id ||
      "unknown"
    )
      .toString()
      .trim()
      .toLowerCase();

  const sales: SaleRow[] = recent.map((t, i) => ({
    transactionId: t.transaction_info.transaction_id,
    date: t.transaction_info.transaction_initiation_date,
    amount: Number(t.transaction_info.transaction_amount.value),
    currency: t.transaction_info.transaction_amount.currency_code,
    buyer: buyerOf(t),
    tracked: (trackers[i] ?? []).length > 0,
    refunded: refundedIds.has(t.transaction_info.transaction_id),
  }));

  const evidence: Evidence[] = [];
  const flags: string[] = [];

  // 1. Real customers (25)
  const buyerCounts = new Map<string, number>();
  for (const s of sales) buyerCounts.set(s.buyer, (buyerCounts.get(s.buyer) ?? 0) + 1);
  const distinctBuyers = [...buyerCounts.keys()].filter((b) => b !== "unknown").length;
  const topBuyerShare = sales.length ? Math.max(0, ...buyerCounts.values()) / sales.length : 0;
  let customerPts = Math.min(25, Math.round((distinctBuyers / 20) * 25));
  if (sales.length >= 5 && topBuyerShare > 0.3) {
    customerPts = Math.min(customerPts, 8);
    flags.push(
      `One buyer made ${Math.round(topBuyerShare * 100)}% of all sales — possible fake (self-made) sales.`,
    );
  }
  evidence.push({
    id: "metric:sales",
    label: "Completed PayPal sales (last 90 days)",
    value: String(salesRaw.length),
    records: sales.slice(0, 15).map((s) => ({
      id: s.transactionId,
      note: `${s.currency} ${s.amount.toFixed(2)} on ${s.date?.slice(0, 10)}`,
    })),
  });
  evidence.push({
    id: "metric:buyers",
    label: "Different buyers",
    value: String(distinctBuyers),
    records: [...buyerCounts.entries()]
      .slice(0, 15)
      .map(([b, n]) => ({ id: b, note: `${n} purchase${n > 1 ? "s" : ""}` })),
  });

  // 2. Shipping proof (25)
  const trackedCount = sales.filter((s) => s.tracked).length;
  const trackedPct = sales.length ? trackedCount / sales.length : 0;
  const shippingPts = sales.length ? Math.round(trackedPct * 25) : 0;
  evidence.push({
    id: "metric:tracking",
    label: "Orders shipped with tracking added in PayPal",
    value: `${trackedCount} of ${sales.length} (${Math.round(trackedPct * 100)}%)`,
    records: sales
      .filter((s) => s.tracked)
      .slice(0, 15)
      .map((s) => ({ id: s.transactionId, note: "tracking on file" })),
  });

  // 3. Complaints (25)
  const openStatuses = new Set([
    "OPEN",
    "WAITING_FOR_BUYER_RESPONSE",
    "WAITING_FOR_SELLER_RESPONSE",
    "UNDER_REVIEW",
  ]);
  const openDisputes = disputes.filter((d) => openStatuses.has(d.status));
  const disputeRate = sales.length ? disputes.length / Math.max(sales.length, salesRaw.length) : 0;
  let complaintPts = sales.length ? Math.round(25 * Math.max(0, 1 - disputeRate * 10)) : 0;
  complaintPts = Math.max(0, complaintPts - openDisputes.length * 5);
  evidence.push({
    id: "metric:disputes",
    label: "PayPal disputes (complaints)",
    value: `${disputes.length} total, ${openDisputes.length} still open (${(disputeRate * 100).toFixed(1)}% of sales)`,
    records: disputes.slice(0, 15).map((d) => ({
      id: d.dispute_id,
      note: `${d.reason} — ${d.status}`,
    })),
  });

  // 4. Refund behaviour (10)
  const refundRate = sales.length ? refundsRaw.length / Math.max(sales.length, salesRaw.length) : 0;
  const refundPts = sales.length
    ? Math.round(10 * (refundRate <= 0.15 ? 1 : Math.max(0, 1 - (refundRate - 0.15) * 4)))
    : 0;
  evidence.push({
    id: "metric:refunds",
    label: "Refunds issued",
    value: `${refundsRaw.length} (${(refundRate * 100).toFixed(1)}% of sales)`,
    records: refundsRaw.slice(0, 15).map((r) => ({
      id: r.transaction_info.transaction_id,
      note: `refund of ${r.transaction_info.paypal_reference_id ?? "a sale"}`,
    })),
  });

  // 5. Website (15)
  const websitePts =
    (site.reachable && site.https ? 5 : 0) + (site.hasReturnPolicy ? 5 : 0) + (site.hasContact ? 5 : 0);
  evidence.push({
    id: "metric:website",
    label: "Registered website checks",
    value: [
      site.reachable ? "online" : "offline",
      site.hasReturnPolicy ? "has return policy" : "no return policy",
      site.hasContact ? "has contact details" : "no contact details",
    ].join(", "),
    records: [{ id: shop.siteUrl, note: "registered site (badge only valid here)" }],
  });

  const signals: Signal[] = [
    { key: "customers", label: "Real customers", points: customerPts, max: 25, evidenceIds: ["metric:sales", "metric:buyers"] },
    { key: "shipping", label: "Ships with tracking", points: shippingPts, max: 25, evidenceIds: ["metric:tracking"] },
    { key: "complaints", label: "Few complaints", points: complaintPts, max: 25, evidenceIds: ["metric:disputes"] },
    { key: "refunds", label: "Fair refunds", points: refundPts, max: 10, evidenceIds: ["metric:refunds"] },
    { key: "website", label: "Honest website", points: websitePts, max: 15, evidenceIds: ["metric:website"] },
  ];
  const score = signals.reduce((a, s) => a + s.points, 0);
  const tier: ScoreReport["tier"] = score >= 75 ? "trusted" : score >= 40 ? "new" : "danger";

  const report: ScoreReport = {
    shop: { slug: shop.slug, name: shop.name, siteUrl: shop.siteUrl },
    score,
    tier,
    signals,
    evidence,
    flags,
    untrackedSales: sales
      .filter((s) => !s.tracked && !s.refunded)
      .map((s) => ({
        transactionId: s.transactionId,
        amount: `${s.currency} ${s.amount.toFixed(2)}`,
        date: s.date?.slice(0, 10),
        buyer: s.buyer,
      })),
    sales,
    disputes: disputes.map((d) => ({
      disputeId: d.dispute_id,
      reason: d.reason,
      status: d.status,
      amount: `${d.dispute_amount?.currency_code ?? ""} ${d.dispute_amount?.value ?? ""}`,
      created: d.create_time?.slice(0, 10),
    })),
    computedAt: Date.now(),
  };

  getDb().prepare(
    "INSERT OR REPLACE INTO score_cache (shop_slug, report, created_at) VALUES (?, ?, ?)",
  ).run(shop.slug, JSON.stringify(report), Date.now());
  return report;
}

export function invalidateScore(slug: string) {
  getDb().prepare("DELETE FROM score_cache WHERE shop_slug = ?").run(slug);
}
