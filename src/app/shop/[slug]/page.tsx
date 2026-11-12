import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { getShop } from "@/lib/shops";
import { Dashboard } from "./Dashboard";

export const dynamic = "force-dynamic";

export default async function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!getShop(slug)) notFound();
  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pb-16 pt-4">
        <Dashboard slug={slug} />
      </main>
    </>
  );
}
