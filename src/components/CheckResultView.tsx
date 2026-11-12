"use client";
import { useState } from "react";
import type { CheckResult } from "@/lib/check";

const TIER = {
  trusted: { label: "Trusted", ring: "border-green-600", bg: "bg-green-50", text: "text-green-800", dot: "🟢" },
  new: { label: "New shop — be careful", ring: "border-amber-500", bg: "bg-amber-50", text: "text-amber-800", dot: "🟡" },
  danger: { label: "Danger", ring: "border-red-600", bg: "bg-red-50", text: "text-red-800", dot: "🔴" },
  unknown: { label: "Not verified", ring: "border-stone-400", bg: "bg-stone-50", text: "text-stone-800", dot: "⚪" },
} as const;

export function CheckResultView({ r }: { r: CheckResult }) {
  const t = TIER[r.tier];
  return (
    <div className={`rounded-2xl border-2 ${t.ring} ${t.bg} p-6`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className={`text-sm font-semibold uppercase tracking-wide ${t.text}`}>
            {t.dot} {t.label}
          </p>
          <h2 className="text-xl font-bold mt-1 text-stone-900">
            {r.kind === "verified" ? r.explanation.headline : r.headline}
          </h2>
          <p className="text-sm text-stone-600 mt-1 break-all">{r.url}</p>
        </div>
        {r.kind === "verified" && (
          <div className="text-right">
            <div className={`text-4xl font-black ${t.text}`}>{r.score}</div>
            <div className="text-xs text-stone-500">out of 100</div>
          </div>
        )}
      </div>

      {r.kind === "verified" ? <Verified r={r} /> : <Unverified r={r} />}
    </div>
  );
}

function Verified({ r }: { r: Extract<CheckResult, { kind: "verified" }> }) {
  const ev = new Map(r.report.evidence.map((e) => [e.id, e]));
  return (
    <div className="mt-5 space-y-5">
      <div className="grid gap-2 sm:grid-cols-5">
        {r.report.signals.map((s) => (
          <div key={s.key} className="bg-white rounded-lg p-3 border">
            <div className="text-xs text-stone-500">{s.label}</div>
            <div className="font-bold text-stone-900">
              {s.points}<span className="text-stone-400 font-normal">/{s.max}</span>
            </div>
            <div className="h-1.5 bg-stone-100 rounded mt-1">
              <div className="h-1.5 bg-stone-800 rounded" style={{ width: `${(s.points / s.max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      {r.report.flags.length > 0 && (
        <div className="bg-red-100 text-red-900 rounded-lg p-3 text-sm">
          {r.report.flags.map((f) => <p key={f}>⚠ {f}</p>)}
        </div>
      )}

      <div>
        <h3 className="font-semibold text-stone-900 mb-2">Why — every reason links to real PayPal records</h3>
        <ul className="space-y-2">
          {r.explanation.reasons.map((reason, i) => (
            <Reason key={i} text={reason.text} proofs={reason.evidence_ids.map((id) => ev.get(id)!).filter(Boolean)} />
          ))}
        </ul>
        <p className="text-xs text-stone-500 mt-3">
          Score calculated by code from PayPal data. AI only writes the explanation, and every sentence is checked
          against real PayPal record IDs{r.explanation.grounded ? " ✓" : " (unproven sentences were removed)"}.
        </p>
      </div>
    </div>
  );
}

function Reason({ text, proofs }: { text: string; proofs: { id: string; label: string; value: string; records: { id: string; note: string }[] }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="bg-white rounded-lg border p-3">
      <div className="flex justify-between gap-3">
        <span className="text-stone-800">{text}</span>
        <button onClick={() => setOpen(!open)} className="text-xs text-blue-700 underline whitespace-nowrap">
          {open ? "hide proof" : "view PayPal proof"}
        </button>
      </div>
      {open && (
        <div className="mt-2 space-y-2">
          {proofs.map((p) => (
            <div key={p.id} className="text-xs bg-stone-50 rounded p-2">
              <div className="font-semibold">{p.label}: {p.value}</div>
              <ul className="mt-1 font-mono text-stone-600">
                {p.records.length === 0 && <li>(no records)</li>}
                {p.records.map((rec) => (
                  <li key={rec.id}>{rec.id} — {rec.note}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}

function Unverified({ r }: { r: Extract<CheckResult, { kind: "unverified" }> }) {
  return (
    <div className="mt-5 space-y-3">
      {r.stolenBadge && (
        <div className="bg-red-100 text-red-900 rounded-lg p-3 text-sm">
          🚨 This page shows a ShopSure badge for <strong>{r.stolenBadge.claimedShop.name}</strong>, but that badge is
          only valid on <span className="font-mono">{r.stolenBadge.claimedShop.siteUrl}</span>. The real shop has been alerted.
        </div>
      )}
      <div className="bg-white rounded-lg border p-3 text-sm text-stone-700">
        No PayPal sales history is linked to this shop, so nothing proves it is real.
      </div>
      {r.page && (
        <div className="bg-white rounded-lg border p-3">
          <h3 className="font-semibold text-stone-900 mb-1">AI page check: {r.page.risk} risk</h3>
          <p className="text-sm text-stone-700">{r.page.summary}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {r.page.red_flags.map((f, i) => (
              <li key={i}>
                ⚠ {f.text} <span className="text-stone-500 italic">— “{f.quote}”</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-sm font-semibold text-stone-800">
        Advice: don&apos;t pay this shop. If you must, only pay with PayPal so you have buyer protection.
      </p>
    </div>
  );
}
