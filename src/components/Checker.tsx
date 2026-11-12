"use client";
import { useEffect, useState } from "react";
import type { CheckResult } from "@/lib/check";
import { CheckResultView } from "./CheckResultView";

export function Checker({ initialUrl, examples }: { initialUrl?: string; examples: { label: string; url: string }[] }) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState("");

  async function run(u: string) {
    if (!u) return;
    setUrl(u);
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/check", { method: "POST", body: JSON.stringify({ url: u }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setResult(json);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialUrl) run(initialUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(url);
        }}
        className="flex gap-2 flex-col sm:flex-row"
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a shop link before you pay…"
          className="flex-1 rounded-xl border-2 border-stone-300 px-4 py-3 text-stone-900 bg-white focus:border-stone-800 outline-none"
        />
        <button disabled={loading} className="rounded-xl bg-stone-900 text-white px-6 py-3 font-semibold disabled:opacity-50">
          {loading ? "Checking PayPal history…" : "Check shop"}
        </button>
      </form>
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="text-stone-500">Try:</span>
        {examples.map((e) => (
          <button key={e.url} onClick={() => run(e.url)} className="px-3 py-1 rounded-full bg-white border hover:bg-stone-100">
            {e.label}
          </button>
        ))}
      </div>
      {error && <p className="text-red-700">{error}</p>}
      {result && <CheckResultView r={result} />}
    </div>
  );
}
