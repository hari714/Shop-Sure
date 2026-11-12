# ShopSure Verified

**Fake reviews are easy. Real PayPal history isn't.**

ShopSure lets honest online shops *prove* they are real using their own PayPal history — real sales, real buyers, shipping tracking, disputes and refunds — and lets shoppers (and AI shopping agents) check any shop before they pay.

- **Code computes the Trust Score** (0–100) from PayPal data. The AI never picks the number.
- **Claude explains the score**, and every sentence must cite real PayPal record IDs (grounding is checked in code; uncited sentences are dropped).
- **A badge that can't be copied**: the embed verifies the page it's on. Paste it on a scam site and it turns red — and the real owner is alerted.
- **An AI shopping agent that only pays trusted shops** (score ≥ 75, enforced in code, not in the prompt). The human still approves every payment on PayPal.
- **An AI coach for shop owners** that turns weak spots into one-click PayPal actions (e.g. add missing tracking via the PayPal Tracking API).

## How PayPal is used

| PayPal API | Used for |
|---|---|
| Transaction Search `/v1/reporting/transactions` | Sales, distinct buyers, refunds (90 days) |
| Disputes `/v1/customer/disputes` | Complaint rate and open disputes |
| Tracking `/v1/shipping/trackers`, `/trackers-batch` | % of orders shipped with tracking; coach "add tracking" action |
| Orders v2 (create + capture) | Agent checkout — human approves on PayPal |
| Catalog Products `/v1/catalogs/products` | Shop products |
| Webhooks + `verify-webhook-signature` | Live score refresh on new sales, refunds, disputes |

## How AI is used (Claude API)

| Feature | What Claude does | Guard rail |
|---|---|---|
| Score explanation + coach tips | Structured output (Zod schema) explaining the facts | Every reason must cite evidence IDs that exist; otherwise dropped |
| Unknown-shop page check | Reads an unregistered page, lists red flags with quotes | Page text treated as untrusted data; flags kept only if the quote is really on the page |
| Shopping agent | Tool-use loop: `search_products` → `check_shop` → `create_checkout` | Score ≥ 75 gate is in code; payment only after human approval on PayPal |

## Trust Score (100 points)

| Signal | Points | Rule |
|---|---|---|
| Real customers | 25 | Distinct buyers (20+ = full). Capped at 8 if one buyer > 30% of sales (anti wash-trading) |
| Ships with tracking | 25 | % of recent sales with tracking in PayPal |
| Few complaints | 25 | Dispute rate penalty ×10, −5 per open dispute |
| Fair refunds | 10 | Refund rate ≤ 15% = full |
| Honest website | 15 | Online + HTTPS, return policy, contact details |

≥ 75 **Trusted** · 40–74 **New / caution** · < 40 **Danger**

## Demo stores

| Store | What it shows |
|---|---|
| `/stores/asha` — Asha's Handmade | Trusted: many buyers, tracked orders |
| `/stores/newleaf` — New Leaf Store | New: few buyers, missing tracking, a dispute |
| `/stores/megasale` — MEGA SALE | Scam page that copied Asha's badge → badge turns red |

## Run it locally

Requirements: Node 22.5+ (uses built-in `node:sqlite`), a PayPal Developer account, a Claude API key.

1. **PayPal sandbox** (developer.paypal.com → Sandbox):
   - Create 2 **Business** sandbox accounts (country: United States) and 1 **Personal** (buyer) account.
   - Create 2 REST apps (type Merchant), one linked to each Business account.
   - In each app's **Features**, enable **Transaction search** (and Advanced Credit and Debit Card Payments for seeding).
2. **Install and configure**
   ```bash
   npm install
   cp .env.example .env.local   # fill in ANTHROPIC_API_KEY, ASHA_*, NEWLEAF_*
   ```
3. **Seed sandbox data** (sandbox only — the script refuses to run against live):
   ```bash
   npm run seed -- check            # verify credentials
   npm run seed -- sales asha 30    # 30 card sales from 20 test buyers, most tracked, 1 refund
   npm run seed -- sales newleaf 6  # few buyers, little tracking
   npm run seed -- catalog asha
   npm run seed -- catalog newleaf
   npm run seed -- wallet newleaf 2 # prints PayPal links: approve as the sandbox buyer, then open a dispute
   ```
   Note: PayPal Transaction Search can take up to 3 hours to show new transactions.
4. **Run**
   ```bash
   npm run build && npm start   # http://localhost:3000
   ```

## Pages

- `/` and `/check?url=…` — check any shop
- `/agent` — AI shopping agent
- `/shop/asha` — shop owner dashboard (AG Grid tables, AI coach, live activity)

## Production notes

The demo connects shops by pasting their own REST app keys. In production, shops would connect via **PayPal Partner Referrals** (third-party permissions for transaction search, disputes and tracking), so ShopSure never holds a shop's secret.

## License

MIT — see [LICENSE](LICENSE).
