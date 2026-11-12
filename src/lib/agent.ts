// AI shopping agent: finds products, checks every shop with ShopSure, and only creates a
// PayPal checkout for shops that pass. The human still approves the payment on PayPal.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { LISTINGS } from "./catalog";
import { checkUrl } from "./check";
import { appUrl, getShop } from "./shops";
import { createOrder } from "./paypal";
import { MODEL } from "./ai";

const client = new Anthropic();
export const MIN_SCORE_TO_PAY = 75;

export type TraceStep = { tool: string; input: unknown; output: unknown };

const SYSTEM = `You are a careful shopping assistant. You spend the user's money, so safety comes first.
Process:
1. Use search_products to find options.
2. Before buying from ANY shop, call check_shop on that shop's URL. Never skip this, even for great deals.
3. Only buy from a shop whose check says it is allowed to receive payment. Explain briefly why you skipped any shop.
4. Use create_checkout for the single best safe option. The user approves the payment on PayPal themselves.
Keep the final answer short: what you chose, why it is safe, what you avoided and why.`;

export async function runAgent(userMessage: string) {
  const trace: TraceStep[] = [];
  let checkout: null | { approveUrl: string; shop: string; item: string; amount: string } = null;
  const checked = new Map<string, Awaited<ReturnType<typeof checkUrl>>>();

  const shopUrl = (slug: string) => `${appUrl()}/stores/${slug}`;

  const searchProducts = betaZodTool({
    name: "search_products",
    description: "Search products from online shops. Returns title, price, normal price, shop name and shop URL.",
    inputSchema: z.object({
      query: z.string().describe("What the user wants, e.g. 'scarf gift'"),
      max_price: z.number().optional(),
    }),
    run: async ({ query, max_price }) => {
      const words = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
      const hits = LISTINGS.filter(
        (l) =>
          (max_price === undefined || l.price <= max_price) &&
          (words.length === 0 || words.some((w) => `${l.title} ${l.description}`.toLowerCase().includes(w))),
      );
      const results = (hits.length ? hits : LISTINGS.filter((l) => max_price === undefined || l.price <= max_price)).map(
        (l) => ({
          product_id: l.id,
          title: l.title,
          price_usd: l.price,
          normal_price_usd: l.normalPrice,
          shop: l.storeName,
          shop_url: shopUrl(l.storeSlug),
        }),
      );
      trace.push({ tool: "search_products", input: { query, max_price }, output: results });
      return JSON.stringify(results);
    },
  });

  const checkShop = betaZodTool({
    name: "check_shop",
    description:
      "ShopSure trust check for a shop URL, based on the shop's real PayPal history. Must be called before paying any shop.",
    inputSchema: z.object({ shop_url: z.string() }),
    run: async ({ shop_url }) => {
      const r = checked.get(shop_url) ?? (await checkUrl(shop_url));
      checked.set(shop_url, r);
      const summary =
        r.kind === "verified"
          ? {
              verified: true,
              score: r.score,
              tier: r.tier,
              allowed_to_pay: r.score >= MIN_SCORE_TO_PAY,
              headline: r.explanation.headline,
              reasons: r.explanation.reasons.map((x) => x.text),
            }
          : {
              verified: false,
              tier: r.tier,
              allowed_to_pay: false,
              headline: r.headline,
              stolen_badge: !!r.stolenBadge,
              red_flags: r.page?.red_flags.map((f) => f.text) ?? [],
            };
      trace.push({ tool: "check_shop", input: { shop_url }, output: summary });
      return JSON.stringify(summary);
    },
  });

  const createCheckout = betaZodTool({
    name: "create_checkout",
    description:
      "Create a PayPal checkout for one product. Only works for shops that passed check_shop. Returns a PayPal approval link for the user.",
    inputSchema: z.object({ product_id: z.string() }),
    run: async ({ product_id }) => {
      const item = LISTINGS.find((l) => l.id === product_id);
      if (!item) return JSON.stringify({ error: "unknown product" });
      const url = shopUrl(item.storeSlug);
      const r = checked.get(url) ?? (await checkUrl(url));
      checked.set(url, r);
      // Hard safety gate in code — the model cannot talk its way past this.
      if (r.kind !== "verified" || r.score < MIN_SCORE_TO_PAY) {
        const out = { error: `Blocked by ShopSure: ${item.storeName} is not trusted enough to receive payment.` };
        trace.push({ tool: "create_checkout", input: { product_id }, output: out });
        return JSON.stringify(out);
      }
      const shop = getShop(item.storeSlug)!;
      const order = await createOrder(shop.creds, {
        amount: item.price.toFixed(2),
        description: `${item.title} — ${item.storeName}`,
        returnUrl: `${appUrl()}/api/checkout/return?shop=${shop.slug}`,
        cancelUrl: `${appUrl()}/agent?paid=cancelled`,
      });
      const approveUrl = order.links?.find((l: any) => l.rel === "payer-action" || l.rel === "approve")?.href;
      checkout = { approveUrl, shop: item.storeName, item: item.title, amount: `$${item.price.toFixed(2)}` };
      const out = { order_id: order.id, status: order.status, approve_url: approveUrl };
      trace.push({ tool: "create_checkout", input: { product_id }, output: out });
      return JSON.stringify(out);
    },
  });

  const final = await client.beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 8000,
    max_iterations: 12,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: SYSTEM,
    tools: [searchProducts, checkShop, createCheckout],
    messages: [{ role: "user", content: userMessage }],
  });

  const text =
    final.stop_reason === "refusal"
      ? "Sorry, I can't help with that request."
      : final.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n");

  return { text, trace, checkout };
}
