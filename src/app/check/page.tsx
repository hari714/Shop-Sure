import { Nav } from "@/components/Nav";
import { Checker } from "@/components/Checker";

export const dynamic = "force-dynamic";

export default async function CheckPage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const { url } = await searchParams;
  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pb-16 pt-4">
        <Checker initialUrl={url} examples={[]} />
      </main>
    </>
  );
}
