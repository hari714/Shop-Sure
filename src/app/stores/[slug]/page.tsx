// Demo storefronts. "asha" and "newleaf" are real PayPal sandbox merchants.
// "megasale" is a fake scam shop that copied Asha's ShopSure badge.
import Script from "next/script";
import { notFound } from "next/navigation";
import { listingsFor, type Listing } from "@/lib/catalog";

const STORES: Record<string, { name: string; tagline: string; badgeShop: string | null; scam: boolean }> = {
  asha: { name: "Asha's Handmade", tagline: "Small-batch crafts from Jaipur since 2023", badgeShop: "asha", scam: false },
  newleaf: { name: "New Leaf Store", tagline: "Plants and paper goods, newly opened", badgeShop: "newleaf", scam: false },
  megasale: { name: "MEGA SALE Outlet", tagline: "🔥 BLACK FRIDAY — UP TO 95% OFF — TODAY ONLY 🔥", badgeShop: "asha", scam: true },
};

export default async function Store({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = STORES[slug];
  if (!store) notFound();
  const items = listingsFor(slug as Listing["storeSlug"]);

  return (
    <main className={`min-h-screen ${store.scam ? "bg-yellow-50" : "bg-stone-50"} text-stone-900`}>
      <header className={`px-6 py-6 ${store.scam ? "bg-red-600 text-white" : "bg-white border-b"}`}>
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{store.name}</h1>
            <p className="text-sm opacity-80">{store.tagline}</p>
          </div>
          {store.badgeShop && <div data-shopsure-shop={store.badgeShop} className="shopsure-badge" />}
        </div>
      </header>

      {store.scam && (
        <div className="bg-black text-yellow-300 text-center py-2 font-mono text-sm">
          ⏰ Offer ends in 00:09:59 — only 3 left in stock! Pay by bank transfer or gift card for an extra 10% off!
        </div>
      )}

      <section className="max-w-4xl mx-auto px-6 py-8 grid gap-4 sm:grid-cols-2">
        {items.map((it) => (
          <article key={it.id} className="bg-white rounded-xl border p-5">
            <h2 className="font-semibold">{it.title}</h2>
            <p className="text-sm text-stone-600 mt-1">{it.description}</p>
            <p className="mt-3 text-lg font-bold">
              ${it.price.toFixed(2)}
              {it.normalPrice > it.price && (
                <span className="ml-2 text-sm line-through text-stone-400">${it.normalPrice.toFixed(2)}</span>
              )}
            </p>
          </article>
        ))}
      </section>

      <footer className="max-w-4xl mx-auto px-6 pb-10 text-sm text-stone-600 space-y-1">
        {store.scam ? (
          <p>All sales final. No refunds. Contact via WhatsApp only.</p>
        ) : (
          <>
            <p><strong>Return policy:</strong> 30-day returns on unused items. Refunds go back to your PayPal account.</p>
            <p><strong>Contact:</strong> hello@{slug}.example · Mon–Sat, 10am–6pm IST</p>
            <p>We ship every order with tracking.</p>
          </>
        )}
      </footer>

      <Script src="/badge.js" strategy="afterInteractive" />
    </main>
  );
}
