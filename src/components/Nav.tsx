import Link from "next/link";

export function Nav() {
  return (
    <nav className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
      <Link href="/" className="font-black text-xl text-stone-900">
        Shop<span className="text-green-700">Sure</span>
      </Link>
      <div className="flex gap-4 text-sm text-stone-700">
        <Link href="/">Check a shop</Link>
        <Link href="/agent">AI shopping agent</Link>
        <Link href="/shop/asha">Shop owner dashboard</Link>
      </div>
    </nav>
  );
}
