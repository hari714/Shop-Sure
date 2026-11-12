"use client";
import { useCallback, useEffect, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, type ColDef } from "ag-grid-community";
import type { ScoreReport, SaleRow, DisputeRow } from "@/lib/score";
import type { Explanation } from "@/lib/ai";

ModuleRegistry.registerModules([AllCommunityModule]);

type Data = {
  report: ScoreReport;
  explanation: Explanation & { grounded: boolean };
  events: { kind: string; detail: any; created_at: number }[];
};

const saleCols: ColDef<SaleRow>[] = [
  { field: "date", headerName: "Date", valueFormatter: (p) => p.value?.slice(0, 10), width: 120 },
  { field: "transactionId", headerName: "PayPal transaction", flex: 1, minWidth: 170 },
  { field: "buyer", headerName: "Buyer", flex: 1, minWidth: 140 },
  { field: "amount", headerName: "Amount", width: 110, valueFormatter: (p) => `$${Number(p.value).toFixed(2)}` },
  {
    field: "tracked",
    headerName: "Tracking",
    width: 120,
    cellRenderer: (p: { value: boolean }) => (p.value ? "✅ on file" : "❌ missing"),
  },
  { field: "refunded", headerName: "Refunded", width: 110, cellRenderer: (p: { value: boolean }) => (p.value ? "↩ yes" : "") },
];

const disputeCols: ColDef<DisputeRow>[] = [
  { field: "created", headerName: "Opened", width: 120 },
  { field: "disputeId", headerName: "Dispute", flex: 1 },
  { field: "reason", headerName: "Reason", flex: 1 },
  { field: "status", headerName: "Status", flex: 1 },
  { field: "amount", headerName: "Amount", width: 120 },
];

export function Dashboard({ slug }: { slug: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    async (fresh = false) => {
      try {
        const r = await fetch(`/api/shops/${slug}/report${fresh ? "?fresh=1" : ""}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setData(j);
        setError("");
      } catch (e: any) {
        setError(e.message);
      }
    },
    [slug],
  );

  useEffect(() => {
    load();
    const t = setInterval(() => load(), 15000); // picks up PayPal webhook changes
    return () => clearInterval(t);
  }, [load]);

  async function addTracking(transactionId: string) {
    setBusy(transactionId);
    const trackingNumber = `SS${Date.now().toString().slice(-10)}`;
    const r = await fetch(`/api/shops/${slug}/tracking`, {
      method: "POST",
      body: JSON.stringify({ transactionId, trackingNumber, carrier: "OTHER" }),
    });
    const j = await r.json();
    setBusy(null);
    if (!r.ok) return setError(j.error);
    await load(true);
  }

  if (error && !data) return <p className="text-red-700">{error}</p>;
  if (!data) return <p className="text-stone-500">Reading this shop&apos;s PayPal history…</p>;
  const { report, explanation, events } = data;
  const tierColor = report.tier === "trusted" ? "text-green-700" : report.tier === "new" ? "text-amber-600" : "text-red-700";
  const misuse = events.filter((e) => e.kind === "badge_misuse");

  return (
    <div className="space-y-6">
      {error && <p className="text-red-700 text-sm">{error}</p>}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-stone-900">{report.shop.name}</h1>
          <p className="text-stone-600">{explanation.headline}</p>
        </div>
        <div className="text-right">
          <div className={`text-5xl font-black ${tierColor}`}>{report.score}</div>
          <div className="text-xs text-stone-500">Trust score / 100</div>
        </div>
      </div>

      {misuse.length > 0 && (
        <div className="rounded-xl bg-red-50 border-2 border-red-600 p-4 text-red-900">
          🚨 Your ShopSure badge was copied onto another website:
          <ul className="mt-1 text-sm font-mono">
            {[...new Set(misuse.map((m) => m.detail.foundOn))].slice(0, 5).map((u) => <li key={u}>{u}</li>)}
          </ul>
          Shoppers there see a red &quot;fake badge&quot; warning instead of your score.
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-5">
        {report.signals.map((s) => (
          <div key={s.key} className="bg-white rounded-lg p-3 border">
            <div className="text-xs text-stone-500">{s.label}</div>
            <div className="font-bold">{s.points}<span className="text-stone-400 font-normal">/{s.max}</span></div>
          </div>
        ))}
      </div>

      <section className="bg-white border rounded-xl p-4">
        <h2 className="font-bold text-stone-900">🤖 AI coach — how to raise your score</h2>
        {explanation.coach_tips.length === 0 && <p className="text-sm text-stone-600 mt-1">Nothing to fix right now. 🎉</p>}
        <ul className="mt-2 space-y-2">
          {explanation.coach_tips.map((t, i) => (
            <li key={i} className="text-stone-800">• {t.text}</li>
          ))}
        </ul>
        {report.untrackedSales.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-stone-700">Orders missing tracking in PayPal</h3>
            <ul className="mt-2 space-y-1">
              {report.untrackedSales.slice(0, 8).map((s) => (
                <li key={s.transactionId} className="flex items-center justify-between gap-2 text-sm bg-stone-50 rounded p-2 flex-wrap">
                  <span className="font-mono">{s.transactionId}</span>
                  <span>{s.amount} · {s.date}</span>
                  <button
                    disabled={!!busy}
                    onClick={() => addTracking(s.transactionId)}
                    className="rounded bg-stone-900 text-white px-3 py-1 disabled:opacity-50"
                  >
                    {busy === s.transactionId ? "Adding…" : "Add tracking to PayPal"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-bold text-stone-900 mb-2">PayPal sales (Transaction Search API)</h2>
        <div style={{ height: 360 }}>
          <AgGridReact<SaleRow> rowData={report.sales} columnDefs={saleCols} pagination paginationPageSize={10} />
        </div>
      </section>

      <section>
        <h2 className="font-bold text-stone-900 mb-2">PayPal disputes (Disputes API)</h2>
        <div style={{ height: 220 }}>
          <AgGridReact<DisputeRow> rowData={report.disputes} columnDefs={disputeCols} />
        </div>
      </section>

      <section className="bg-white border rounded-xl p-4">
        <h2 className="font-bold text-stone-900 mb-2">Live activity</h2>
        {events.length === 0 && <p className="text-sm text-stone-500">No events yet.</p>}
        <ul className="text-sm space-y-1">
          {events.map((e, i) => (
            <li key={i} className="flex gap-3">
              <span className="text-stone-400 whitespace-nowrap">{new Date(e.created_at).toLocaleTimeString()}</span>
              <span className="font-semibold">{e.kind}</span>
              <span className="text-stone-600 truncate">{e.detail.type ?? e.detail.foundOn ?? e.detail.transactionId ?? e.detail.orderId ?? ""}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-stone-500">
        Add your badge: <code className="bg-stone-100 px-1">&lt;div data-shopsure-shop=&quot;{slug}&quot;&gt;&lt;/div&gt;&lt;script src=&quot;{typeof window !== "undefined" ? window.location.origin : ""}/badge.js&quot; async&gt;&lt;/script&gt;</code>
      </p>
    </div>
  );
}
