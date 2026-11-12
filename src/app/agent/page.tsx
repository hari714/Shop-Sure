import { Nav } from "@/components/Nav";
import { AgentChat } from "./AgentChat";

export const dynamic = "force-dynamic";

export default async function AgentPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string; shop?: string; amount?: string; order?: string }>;
}) {
  const sp = await searchParams;
  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        <h1 className="text-3xl font-black text-stone-900 pt-6">AI shopping agent</h1>
        <p className="text-stone-600 mt-2 mb-6 max-w-2xl">
          The agent must ask ShopSure before paying any shop. Shops below 75/100 are blocked in code — the AI cannot
          talk its way past it. You still approve every payment yourself on PayPal.
        </p>
        <AgentChat paid={sp.paid ? { status: sp.paid, shop: sp.shop, amount: sp.amount, order: sp.order } : undefined} />
      </main>
    </>
  );
}
