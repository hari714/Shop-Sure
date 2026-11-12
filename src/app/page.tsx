import { Nav } from "@/components/Nav";
import { Checker } from "@/components/Checker";
import { appUrl } from "@/lib/shops";

export const dynamic = "force-dynamic";

export default function Home() {
  const base = appUrl();
  const examples = [
    { label: "🟢 Asha's Handmade", url: `${base}/stores/asha` },
    { label: "🟡 New Leaf Store", url: `${base}/stores/newleaf` },
    { label: "🔴 MEGA SALE Outlet", url: `${base}/stores/megasale` },
  ];
  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        <section className="py-10">
          <h1 className="text-3xl sm:text-5xl font-black text-stone-900 leading-tight">
            Fake reviews are easy.
            <br />
            <span className="text-green-700">Real PayPal history isn&apos;t.</span>
          </h1>
          <p className="mt-4 text-lg text-stone-600 max-w-2xl">
            Fake online shops doubled to 526,000 last holiday season. ShopSure checks a shop&apos;s real PayPal sales,
            shipping and complaint history, and AI explains the result in plain words — before you or your AI agent pay.
          </p>
        </section>
        <Checker examples={examples} />
      </main>
    </>
  );
}
