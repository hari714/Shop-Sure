/* Seeds PayPal SANDBOX data for the demo shops.
 *
 *   npm run seed -- check                 # verify credentials + Transaction Search access
 *   npm run seed -- sales asha 30         # 30 card sales from different test buyers (+ tracking on most, 1 refund)
 *   npm run seed -- sales newleaf 6       # a newer shop: few sales, little tracking
 *   npm run seed -- wallet newleaf 2      # PayPal-wallet orders: prints approval links for your sandbox buyer
 *   npm run seed -- catalog asha          # mirror demo listings into the shop's PayPal Catalog
 *
 * Card sales use PayPal's public sandbox test card. Never run this against live credentials. */
import { paypal, createOrder, addTracker, type PayPalCreds } from "../src/lib/paypal";
import { listingsFor } from "../src/lib/catalog";

if (process.env.PAYPAL_ENV === "live") throw new Error("Seeding is sandbox-only.");

const PREFIX: Record<string, string> = { asha: "ASHA", newleaf: "NEWLEAF" };
const BUYERS = [
  "Priya Sharma", "Liam Walker", "Sofia Rossi", "Kenji Tanaka", "Amara Okafor", "Noah Becker", "Mei Lin",
  "Diego Alvarez", "Fatima Khan", "Oliver Smith", "Chloe Martin", "Arjun Mehta", "Ella Johansson",
  "Lucas Silva", "Hana Kim", "Zoe Clarke", "Ravi Patel", "Isla Brown", "Mateo Garcia", "Aisha Bello",
];

function creds(slug: string): PayPalCreds {
  const p = PREFIX[slug];
  if (!p) throw new Error(`unknown shop ${slug} (use asha or newleaf)`);
  const clientId = process.env[`${p}_CLIENT_ID`];
  const clientSecret = process.env[`${p}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) throw new Error(`${p}_CLIENT_ID / ${p}_CLIENT_SECRET missing in .env.local`);
  return { clientId, clientSecret };
}

async function cardSale(c: PayPalCreds, amount: string, buyer: string, description: string) {
  const [given, ...rest] = buyer.split(" ");
  const order = await paypal(c, "/v2/checkout/orders", {
    method: "POST",
    headers: { "PayPal-Request-Id": crypto.randomUUID() },
    body: {
      intent: "CAPTURE",
      purchase_units: [{ amount: { currency_code: "USD", value: amount }, description }],
      payment_source: {
        card: {
          name: buyer,
          number: "4111111111111111",
          expiry: "2030-12",
          security_code: "123",
          billing_address: { address_line_1: "1 Main St", admin_area_2: "San Jose", admin_area_1: "CA", postal_code: "95131", country_code: "US" },
        },
      },
      payer: { name: { given_name: given, surname: rest.join(" ") || "Buyer" } },
    },
  });
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
  if (order.status !== "COMPLETED" || !capture) throw new Error(`order ${order.id} status ${order.status}`);
  return capture as { id: string; amount: { value: string } };
}

async function sales(slug: string, n: number) {
  const c = creds(slug);
  const items = listingsFor(slug as "asha" | "newleaf");
  const isEstablished = slug === "asha";
  const buyerPool = isEstablished ? BUYERS : BUYERS.slice(0, 3);
  let ok = 0;
  for (let i = 0; i < n; i++) {
    const item = items[i % items.length];
    const buyer = buyerPool[i % buyerPool.length];
    try {
      const cap = await cardSale(c, item.price.toFixed(2), buyer, item.title);
      ok++;
      // Established shop ships nearly everything with tracking; new shop rarely adds it.
      const track = isEstablished ? i % 10 !== 3 : i % 4 === 0;
      if (track) {
        await addTracker(c, { transactionId: cap.id, trackingNumber: `1Z${Math.random().toString().slice(2, 14)}`, carrier: "UPS" });
      }
      if (isEstablished && i === 5) {
        await paypal(c, `/v2/payments/captures/${cap.id}/refund`, { method: "POST", body: {} });
      }
      console.log(`✔ ${slug} sale ${i + 1}/${n}: ${cap.id} $${cap.amount.value} from ${buyer}${track ? " (tracked)" : ""}`);
    } catch (e: any) {
      console.error(`✘ sale ${i + 1} failed: ${e.message}`);
      if (i === 0) {
        console.error(
          "\nCard sales need card processing on the sandbox app (Apps & Credentials → your app → Features → Advanced Credit and Debit Card Payments).",
        );
        return;
      }
    }
  }
  console.log(`\nDone: ${ok} sales. Transaction Search can take up to 3 hours to show new sales.`);
}

async function wallet(slug: string, n: number) {
  const c = creds(slug);
  const items = listingsFor(slug as "asha" | "newleaf");
  const app = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  console.log("Open each link, log in as your SANDBOX PERSONAL (buyer) account, and approve:\n");
  for (let i = 0; i < n; i++) {
    const item = items[i % items.length];
    const order = await createOrder(c, {
      amount: item.price.toFixed(2),
      description: item.title,
      returnUrl: `${app}/api/checkout/return?shop=${slug}`,
      cancelUrl: `${app}/agent?paid=cancelled`,
    });
    console.log(order.links.find((l: any) => l.rel === "payer-action")?.href);
  }
  console.log("\nAfter paying, open a dispute as that buyer at https://www.sandbox.paypal.com (Activity → Report a problem).");
}

async function catalog(slug: string) {
  const c = creds(slug);
  for (const item of listingsFor(slug as "asha" | "newleaf")) {
    const p = await paypal(c, "/v1/catalogs/products", {
      method: "POST",
      headers: { "PayPal-Request-Id": `shopsure-${item.id}` },
      body: { name: item.title, description: `${item.description} Price: $${item.price.toFixed(2)}`, type: "PHYSICAL", category: "SPECIALTY_RETAIL" },
    });
    console.log(`✔ catalog product ${p.id}: ${item.title}`);
  }
}

async function check() {
  for (const slug of Object.keys(PREFIX)) {
    try {
      const c = creds(slug);
      await paypal(c, "/v1/reporting/balances");
      console.log(`✔ ${slug}: credentials OK, Transaction Search enabled`);
    } catch (e: any) {
      console.log(`✘ ${slug}: ${e.message}`);
      if (String(e.message).includes("NOT_AUTHORIZED") || String(e.message).includes("403")) {
        console.log("   → Enable 'Transaction search' in the app's Features on developer.paypal.com");
      }
    }
  }
}

const [cmd, slug, nArg] = process.argv.slice(2);
const n = Number(nArg ?? 10);
const run =
  cmd === "sales" ? () => sales(slug, n) :
  cmd === "wallet" ? () => wallet(slug, n) :
  cmd === "catalog" ? () => catalog(slug) :
  cmd === "check" ? check :
  null;
if (!run) {
  console.log("usage: npm run seed -- check | sales <shop> <n> | wallet <shop> <n> | catalog <shop>");
  process.exit(1);
}
run().catch((e) => {
  console.error(e.message, e.body ? JSON.stringify(e.body, null, 2) : "");
  process.exit(1);
});
