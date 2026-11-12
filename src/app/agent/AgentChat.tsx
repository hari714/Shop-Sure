"use client";
import { useState } from "react";

type Step = { tool: string; input: any; output: any };
type Result = { text: string; trace: Step[]; checkout: null | { approveUrl: string; shop: string; item: string; amount: string } };

const TOOL_LABEL: Record<string, string> = {
  search_products: "🔎 Searching shops",
  check_shop: "🛡️ ShopSure trust check",
  create_checkout: "💳 Creating PayPal checkout",
};

export function AgentChat({ paid }: { paid?: { status: string; shop?: string; amount?: string; order?: string } }) {
  const [msg, setMsg] = useState("Buy a scarf as a gift, under $40");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState("");

  async function run() {
    setLoading(true);
    setRes(null);
    setError("");
    try {
      const r = await fetch("/api/agent", { method: "POST", body: JSON.stringify({ message: msg }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setRes(j);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {paid && paid.status === "COMPLETED" && (
        <div className="rounded-xl bg-green-50 border-2 border-green-600 p-4 text-green-900">
          ✅ Paid {paid.amount} to <strong>{paid.shop}</strong> with PayPal (order {paid.order}). You&apos;re covered by
          PayPal buyer protection.
        </div>
      )}
      {paid && paid.status !== "COMPLETED" && (
        <div className="rounded-xl bg-stone-100 border p-4">Payment {paid.status}. Nothing was charged.</div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
        className="flex gap-2 flex-col sm:flex-row"
      >
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          className="flex-1 rounded-xl border-2 border-stone-300 px-4 py-3 bg-white text-stone-900"
        />
        <button disabled={loading} className="rounded-xl bg-stone-900 text-white px-6 py-3 font-semibold disabled:opacity-50">
          {loading ? "Agent is shopping…" : "Ask the agent"}
        </button>
      </form>
      {error && <p className="text-red-700">{error}</p>}

      {res && (
        <>
          <ol className="space-y-2">
            {res.trace.map((s, i) => (
              <li key={i} className="bg-white border rounded-xl p-3 text-sm">
                <div className="font-semibold text-stone-900">{TOOL_LABEL[s.tool] ?? s.tool}</div>
                <StepBody s={s} />
              </li>
            ))}
          </ol>
          <div className="bg-white border-2 border-stone-800 rounded-xl p-4 whitespace-pre-wrap text-stone-900">{res.text}</div>
          {res.checkout?.approveUrl && (
            <a
              href={res.checkout.approveUrl}
              className="inline-block rounded-xl bg-[#ffc439] text-stone-900 font-bold px-6 py-3"
            >
              Approve {res.checkout.amount} to {res.checkout.shop} with PayPal →
            </a>
          )}
        </>
      )}
    </div>
  );
}

function StepBody({ s }: { s: Step }) {
  if (s.tool === "search_products") {
    return (
      <ul className="mt-1 text-stone-700">
        {(s.output as any[]).map((p) => (
          <li key={p.product_id}>
            {p.title} — ${p.price_usd} at {p.shop}
            {p.normal_price_usd > p.price_usd && <span className="text-red-600"> (normally ${p.normal_price_usd}!)</span>}
          </li>
        ))}
      </ul>
    );
  }
  if (s.tool === "check_shop") {
    const o = s.output;
    const ok = o.allowed_to_pay;
    return (
      <div className="mt-1">
        <div className="font-mono text-xs text-stone-500 break-all">{s.input.shop_url}</div>
        <div className={ok ? "text-green-800" : "text-red-800"}>
          {ok ? "✅ Allowed to receive payment" : "⛔ Not allowed to receive payment"}
          {o.score !== undefined && ` — score ${o.score}/100`}
        </div>
        <div className="text-stone-700">{o.headline}</div>
      </div>
    );
  }
  return <pre className="mt-1 text-xs text-stone-600 whitespace-pre-wrap">{JSON.stringify(s.output, null, 2)}</pre>;
}
