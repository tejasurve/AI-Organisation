# Pharmacy B2B - assembled Next.js app

This directory was **assembled by `scripts/assemble-pharmacy-b2b.mjs`** from the AI-organisation pipeline's generated outputs. **Do not edit files in place** - every `.ts`, `.tsx`, `.json`, `.mjs`, and `.css` here was written by the pipeline (CEO -> CTO -> Engineering Manager -> Developer -> QA -> Cybersecurity, all with PASS / GO verdicts) and is overwritten on the next assembly run.

- Consolidated project report: [`./REPORT.pdf`](./REPORT.pdf) - cover, decision matrix, full strategy chapters, per-task chapters, file inventory, how-to-run.
- Per-task provenance: [`./_reports/`](./_reports/) - one Markdown + one PDF report per task.

## What this app does

A B2B web app for retail pharmacists. After signing in with their license number, the retailer lands on a 4-tab dashboard:

- **Home** - search bar at the top, horizontal carousel of distributor offers, 5 quick-link tiles (Distributors, Schemes, Generic Medicines, Scan Prescription, Outstanding Payments), and a summary of outstanding balances.
- **Orders** - segmented Active / Closed sub-tabs with order cards (distributor, status pill, items, total, placed-relative time, expected delivery).
- **Cart** - items grouped by distributor with per-distributor subtotal, sticky grand total + Place Order button. Place Order fans the cart out into one order per distributor.
- **Profile** - retailer card (store name, owner, license, GSTIN, address, phone, email, favourites) and per-distributor outstanding-payments breakdown. Sign-out button.

## Run it

```bash
npm install
npm run dev
# then open http://localhost:3000
```

The pre-filled license on the login screen (`MH-RP-2024-7821`) matches the seeded pilot retailer (Anuradha Medicals, Pune), so a fresh `npm run dev` works end-to-end on the first try. Click **Sign in** and you'll land on the Home tab.

Try the loop:

1. Tap the search bar, type `paracet`, press Enter.
2. **Add to cart** on Paracetamol 500mg.
3. Bottom tab bar -> **Cart**. The line shows up grouped under its distributor.
4. **Place order ({n})** at the bottom. You'll be routed to **Orders** -> Active where the new order appears at the top.
5. Bottom tab bar -> **Profile** to see your store details and outstanding balances. **Sign out** at the bottom.

## Architecture

- **Next.js 14** (App Router) + **Tailwind CSS** + **TypeScript 5**
- All data lives in **in-memory Maps** seeded at boot (`lib/db/store.ts`) - no Postgres / Redis / external services required for the demo
- Authentication is a **mock cookie session** (POST /api/auth/login looks up the retailer by license number, sets the `pharmacy-session` cookie). `middleware.ts` gates `/dashboard/*` and `/api/*` (except `/api/auth/login`).
- Every authenticated route handler **also** calls `getSession()` for defence in depth on top of the middleware.
- Money is stored as integer paise everywhere; `paiseToRupees` formats with Indian numbering (1,23,45,678).

## Provenance

Every file in this directory traces back to one of these AI-org pipeline runs:

### t-shell-1 - Next.js + Tailwind skeleton + login page

- Report: [`_reports/t-shell-1.REPORT.md`](./_reports/t-shell-1.REPORT.md) | [PDF](./_reports/t-shell-1.REPORT.pdf)
- Files (9):
  - `app/globals.css`
  - `app/layout.tsx`
  - `app/page.tsx`
  - `next-env.d.ts`
  - `next.config.mjs`
  - `package.json`
  - `postcss.config.mjs`
  - `tailwind.config.ts`
  - `tsconfig.json`

### t-shell-2 - Mock auth + dashboard layout + bottom tab bar

- Report: [`_reports/t-shell-2.REPORT.md`](./_reports/t-shell-2.REPORT.md) | [PDF](./_reports/t-shell-2.REPORT.pdf)
- Files (7):
  - `app/api/auth/login/route.ts`
  - `app/api/auth/logout/route.ts`
  - `app/dashboard/layout.tsx`
  - `app/dashboard/page.tsx`
  - `components/BottomTabBar.tsx`
  - `lib/auth/session.ts`
  - `middleware.ts`

### t-data-1 - In-memory data spine + shared types

- Report: [`_reports/t-data-1.REPORT.md`](./_reports/t-data-1.REPORT.md) | [PDF](./_reports/t-data-1.REPORT.pdf)
- Files (2):
  - `lib/db/store.ts`
  - `lib/types.ts`

### t-home-1 - Medicines search / distributors / offers APIs

- Report: [`_reports/t-home-1.REPORT.md`](./_reports/t-home-1.REPORT.md) | [PDF](./_reports/t-home-1.REPORT.pdf)
- Files (3):
  - `app/api/distributors/route.ts`
  - `app/api/medicines/search/route.ts`
  - `app/api/offers/route.ts`

### t-home-2 - Home tab UI + search results page

- Report: [`_reports/t-home-2.REPORT.md`](./_reports/t-home-2.REPORT.md) | [PDF](./_reports/t-home-2.REPORT.pdf)
- Files (4):
  - `app/dashboard/home/page.tsx`
  - `app/dashboard/search/page.tsx`
  - `components/MedicineRow.tsx`
  - `components/SearchBar.tsx`

### t-cart-1 - Cart APIs (GET / POST / DELETE)

- Report: [`_reports/t-cart-1.REPORT.md`](./_reports/t-cart-1.REPORT.md) | [PDF](./_reports/t-cart-1.REPORT.pdf)
- Files (4):
  - `app/api/cart/items/[medicineId]/route.ts`
  - `app/api/cart/items/route.ts`
  - `app/api/cart/route.ts`
  - `lib/api/cart-response.ts`

### t-cart-2 - Cart tab UI

- Report: [`_reports/t-cart-2.REPORT.md`](./_reports/t-cart-2.REPORT.md) | [PDF](./_reports/t-cart-2.REPORT.pdf)
- Files (2):
  - `app/dashboard/cart/page.tsx`
  - `components/CartView.tsx`

### t-orders-1 - Orders APIs (GET grouped + POST place-order)

- Report: [`_reports/t-orders-1.REPORT.md`](./_reports/t-orders-1.REPORT.md) | [PDF](./_reports/t-orders-1.REPORT.pdf)
- Files (1):
  - `app/api/orders/route.ts`

### t-orders-2 - Orders tab UI (Active / Closed sub-tabs)

- Report: [`_reports/t-orders-2.REPORT.md`](./_reports/t-orders-2.REPORT.md) | [PDF](./_reports/t-orders-2.REPORT.pdf)
- Files (1):
  - `app/dashboard/orders/page.tsx`

### t-profile-1 - Profile API + Profile tab UI

- Report: [`_reports/t-profile-1.REPORT.md`](./_reports/t-profile-1.REPORT.md) | [PDF](./_reports/t-profile-1.REPORT.pdf)
- Files (3):
  - `app/api/profile/route.ts`
  - `app/dashboard/profile/page.tsx`
  - `components/LogoutButton.tsx`

## Regenerate

To regenerate any file, re-run its pipeline:

```bash
node scripts/run-pipeline.ts --scenario fixtures/scenarios/pharmacy-b2b --task <taskId>
node scripts/assemble-pharmacy-b2b.mjs
```

To regenerate everything from scratch:

```bash
for t in t-shell-1 t-shell-2 t-data-1 t-home-1 t-home-2 t-cart-1 t-cart-2 t-orders-1 t-orders-2 t-profile-1; do
  node scripts/run-pipeline.ts --scenario fixtures/scenarios/pharmacy-b2b --task $t --quiet || break
done
node scripts/assemble-pharmacy-b2b.mjs
```
