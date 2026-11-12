// Thin PayPal REST client. One instance per merchant (each shop's own sandbox app credentials).
// Docs: https://developer.paypal.com/api/rest/

const BASE =
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

export type PayPalCreds = { clientId: string; clientSecret: string };

type Token = { value: string; expiresAt: number };
const tokenCache = new Map<string, Token>();

export class PayPalError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message: string,
  ) {
    super(message);
  }
}

async function getToken(creds: PayPalCreds): Promise<string> {
  const cached = tokenCache.get(creds.clientId);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;

  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) throw new PayPalError(res.status, json, "PayPal auth failed");
  tokenCache.set(creds.clientId, {
    value: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  });
  return json.access_token;
}

export async function paypal<T = any>(
  creds: PayPalCreds,
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const token = await getToken(creds);
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new PayPalError(
      res.status,
      json,
      `PayPal ${init.method ?? "GET"} ${path} failed: ${res.status} ${json?.name ?? ""} ${json?.message ?? ""}`,
    );
  }
  return json as T;
}

// ---------- Transaction Search (Reporting) ----------
// Max 31 days per request; new transactions can take up to 3 hours to appear.
export async function listTransactions(creds: PayPalCreds, days = 90) {
  const out: any[] = [];
  const end = new Date();
  for (let offset = 0; offset < days; offset += 31) {
    const winEnd = new Date(end.getTime() - offset * 86400_000);
    const winStart = new Date(winEnd.getTime() - Math.min(31, days - offset) * 86400_000);
    let page = 1;
    while (true) {
      const qs = new URLSearchParams({
        start_date: winStart.toISOString().replace(/\.\d+Z$/, "Z"),
        end_date: winEnd.toISOString().replace(/\.\d+Z$/, "Z"),
        fields: "transaction_info,payer_info,shipping_info,cart_info",
        page_size: "500",
        page: String(page),
      });
      const r = await paypal(creds, `/v1/reporting/transactions?${qs}`);
      out.push(...(r.transaction_details ?? []));
      if (!r.total_pages || page >= r.total_pages) break;
      page++;
    }
  }
  return out;
}

// ---------- Disputes ----------
export async function listDisputes(creds: PayPalCreds) {
  const r = await paypal(creds, `/v1/customer/disputes?page_size=50`);
  return (r.items ?? []) as any[];
}

// ---------- Shipment tracking ----------
export async function getTrackers(creds: PayPalCreds, transactionId: string) {
  try {
    const r = await paypal(
      creds,
      `/v1/shipping/trackers?transaction_id=${encodeURIComponent(transactionId)}`,
    );
    return (r.trackers ?? []) as any[];
  } catch (e) {
    if (e instanceof PayPalError && e.status === 404) return [];
    throw e;
  }
}

export async function addTracker(
  creds: PayPalCreds,
  t: { transactionId: string; trackingNumber: string; carrier: string },
) {
  return paypal(creds, `/v1/shipping/trackers-batch`, {
    method: "POST",
    body: {
      trackers: [
        {
          transaction_id: t.transactionId,
          tracking_number: t.trackingNumber,
          status: "SHIPPED",
          carrier: t.carrier,
        },
      ],
    },
  });
}

// ---------- Orders (checkout) ----------
export async function createOrder(
  creds: PayPalCreds,
  o: { amount: string; currency?: string; description: string; returnUrl: string; cancelUrl: string },
) {
  return paypal(creds, `/v2/checkout/orders`, {
    method: "POST",
    body: {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: { currency_code: o.currency ?? "USD", value: o.amount },
          description: o.description.slice(0, 127),
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            user_action: "PAY_NOW",
            return_url: o.returnUrl,
            cancel_url: o.cancelUrl,
            shipping_preference: "GET_FROM_FILE",
          },
        },
      },
    },
  });
}

export async function captureOrder(creds: PayPalCreds, orderId: string) {
  return paypal(creds, `/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    body: {},
  });
}

// ---------- Catalog ----------
export async function listProducts(creds: PayPalCreds) {
  const r = await paypal(creds, `/v1/catalogs/products?page_size=20`);
  return (r.products ?? []) as any[];
}
