# Pipeline run report

- **Idea:** Build a B2B mobile-first pharmacy ordering app where a retail pharmacist (the retailer) can browse medicines from multiple distributors, place orders, manage a cart, see active and closed orders, and view their store profile. After login, the retailer lands on a 4-tab dashboard: Home (offers carousel + medicine search + quick links to Distributors / Schemes / Generic Medicines / Scan Prescription / Outstanding Payments), Orders (Active / Closed sub-tabs), Cart (line items with distributor + price), Profile (name, license number, favourites, store location).
- **Decision:** ✅ `WROTE_FILES`
- **Timestamp:** 2026-05-02T18:39:09.309Z
- **Total time:** 3 ms across 9 step(s)

## Steps

| # | Step | Status | Duration | Notes |
|---|------|--------|----------|-------|
| 1 | `ceo` | ✅ ok | 0 ms |  |
| 2 | `cto` | ✅ ok | 0 ms |  |
| 3 | `engineering-manager` | ✅ ok | 0 ms |  |
| 4 | `validation` | ✅ ok | 0 ms | 6 features, 10 tasks |
| 5 | `task-selection` | ✅ ok | 0 ms | picked t-shell-1 (developer, 4h) under f-shell-auth |
| 6 | `developer` | ✅ ok | 0 ms |  |
| 7 | `qa` | ✅ ok | 1 ms | decision=PASS |
| 8 | `cybersecurity` | ✅ ok | 0 ms | decision=GO |
| 9 | `file-writer` | ✅ ok | 2 ms | 9 file(s), 6547 bytes |

## Validation

Valid — 6 feature(s), 10 task(s)

## Selected task

- **Task:** `t-shell-1` — Set up the Next.js 14 + Tailwind project skeleton: package.json (next 14.2, react 18, tailwind 3, typescript 5, vitest), tsconfig.json with the @/* alias, next.config.mjs, postcss.config.mjs, tailwind.config.ts (mobile-first content globs), app/globals.css with the Tailwind directives + base background, app/layout.tsx with the html/body shell, and the public login page at app/page.tsx that posts to /api/auth/login. No auth handler yet (lands in t-shell-2); the page just calls fetch and redirects on success.
- **Assignee:** developer
- **Estimate:** 4 h
- **Feature:** `f-shell-auth` — App shell + mock retailer auth

## Files written

9 file(s), 6547 bytes total.

| Path | Bytes | Absolute |
|------|-------|----------|
| `package.json` | 675 | `/Users/tejas/Desktop/AI Organisation/generated/t-shell-1/package.json` |
| `tsconfig.json` | 582 | `/Users/tejas/Desktop/AI Organisation/generated/t-shell-1/tsconfig.json` |
| `next.config.mjs` | 118 | `/Users/tejas/Desktop/AI Organisation/generated/t-shell-1/next.config.mjs` |
| `postcss.config.mjs` | 81 | `/Users/tejas/Desktop/AI Organisation/generated/t-shell-1/postcss.config.mjs` |
| `tailwind.config.ts` | 435 | `/Users/tejas/Desktop/AI Organisation/generated/t-shell-1/tailwind.config.ts` |
| `next-env.d.ts` | 201 | `/Users/tejas/Desktop/AI Organisation/generated/t-shell-1/next-env.d.ts` |
| `app/globals.css` | 332 | `/Users/tejas/Desktop/AI Organisation/generated/t-shell-1/app/globals.css` |
| `app/layout.tsx` | 519 | `/Users/tejas/Desktop/AI Organisation/generated/t-shell-1/app/layout.tsx` |
| `app/page.tsx` | 3604 | `/Users/tejas/Desktop/AI Organisation/generated/t-shell-1/app/page.tsx` |

## Agent outputs

### CEO

**Mission:** Let an independent retail pharmacist place orders to every medicine distributor they buy from in one mobile-first app, replacing the WhatsApp + phone-call ordering loop they live in today.

**OKRs:**
- Ship a retailer-only build with login and a 4-tab dashboard (Home, Orders, Cart, Profile) that supports the full search -> add-to-cart -> place-order -> see-in-active-orders loop within 14 days
- Convert 50% of the 6 pilot retailers from their current channel to at least one in-app order in the first 30 days post-launch
- Surface an outstanding-payments tile on the Home tab so retailers can see distributor-wise balance without calling, reducing reconciliation calls per retailer by 70% in the same window

**Priorities:**
- Stand up the authenticated 4-tab dashboard shell (mock retailer login + tab navigation) so every later task has a place to land in the UI
- Build the Home tab: search bar at the top, offers carousel, and the 5 quick-link tiles (Distributors, Schemes, Generic Medicines, Scan Prescription, Outstanding Payments)
- Build the Cart and Orders tabs end-to-end: cart line items with distributor + total, place-order action, and Active/Closed sub-tabs in Orders
- Build the Profile tab as a read-only retailer card (name, license number, favourites count, store location) plus the outstanding-payments stub it links to from Home

**Delegation:**
- **CTO:** Build a mobile-first Next.js 14 (App Router) + Tailwind webapp. Backend is Next.js Route Handlers in the same project; demo data lives in in-memory Maps seeded at boot (one pilot retailer, four distributors, ~20 medicines, three offers). Authentication is a mock cookie-based session: POST /api/auth/login takes a license number and sets a pharmacy-session cookie, middleware guards /dashboard/*. No real distributor integration, no real payments, no Postgres this cycle. Ship by end of day 8 with a runnable end-to-end loop: login -> search a medicine -> add to cart -> place order -> see it under Orders/Active -> view Profile.
- **CMO:** Skip this cycle. Pilot is direct sign-up with the 6 retailers we already have a relationship with; no paid acquisition until cycle 2.
- **CFO:** Back-of-envelope only: distributor commission percent x average order value x monthly orders per retailer. Re-validate before cycle 2; no spend this cycle other than the existing engineering team.
- **CPO:** Own the product copy: empty states (no orders, empty cart, no offers), the 'outstanding payments' tile heading and per-distributor row, the 5 quick-link tile labels and supporting microcopy, and the order-status vocabulary (Placed / Acknowledged / Out for delivery / Delivered / Cancelled). Hand the copy sheet to CTO by end of day 2.

<details>
<summary>Full CEO output (JSON)</summary>

```json
{
  "mission": "Let an independent retail pharmacist place orders to every medicine distributor they buy from in one mobile-first app, replacing the WhatsApp + phone-call ordering loop they live in today.",
  "okrs": [
    "Ship a retailer-only build with login and a 4-tab dashboard (Home, Orders, Cart, Profile) that supports the full search -> add-to-cart -> place-order -> see-in-active-orders loop within 14 days",
    "Convert 50% of the 6 pilot retailers from their current channel to at least one in-app order in the first 30 days post-launch",
    "Surface an outstanding-payments tile on the Home tab so retailers can see distributor-wise balance without calling, reducing reconciliation calls per retailer by 70% in the same window"
  ],
  "priorities": [
    "Stand up the authenticated 4-tab dashboard shell (mock retailer login + tab navigation) so every later task has a place to land in the UI",
    "Build the Home tab: search bar at the top, offers carousel, and the 5 quick-link tiles (Distributors, Schemes, Generic Medicines, Scan Prescription, Outstanding Payments)",
    "Build the Cart and Orders tabs end-to-end: cart line items with distributor + total, place-order action, and Active/Closed sub-tabs in Orders",
    "Build the Profile tab as a read-only retailer card (name, license number, favourites count, store location) plus the outstanding-payments stub it links to from Home"
  ],
  "delegation": {
    "cto": "Build a mobile-first Next.js 14 (App Router) + Tailwind webapp. Backend is Next.js Route Handlers in the same project; demo data lives in in-memory Maps seeded at boot (one pilot retailer, four distributors, ~20 medicines, three offers). Authentication is a mock cookie-based session: POST /api/auth/login takes a license number and sets a pharmacy-session cookie, middleware guards /dashboard/*. No real distributor integration, no real payments, no Postgres this cycle. Ship by end of day 8 with a runnable end-to-end loop: login -> search a medicine -> add to cart -> place order -> see it under Orders/Active -> view Profile.",
    "cmo": "Skip this cycle. Pilot is direct sign-up with the 6 retailers we already have a relationship with; no paid acquisition until cycle 2.",
    "cfo": "Back-of-envelope only: distributor commission percent x average order value x monthly orders per retailer. Re-validate before cycle 2; no spend this cycle other than the existing engineering team.",
    "cpo": "Own the product copy: empty states (no orders, empty cart, no offers), the 'outstanding payments' tile heading and per-distributor row, the 5 quick-link tile labels and supporting microcopy, and the order-status vocabulary (Placed / Acknowledged / Out for delivery / Delivered / Cancelled). Hand the copy sheet to CTO by end of day 2."
  }
}
```

</details>

### CTO

**Architecture:**
- Frontend: Next.js 14 (App Router) + Tailwind CSS, mobile-first responsive layout. Authenticated /dashboard route renders a fixed bottom tab bar (Home / Orders / Cart / Profile) on small screens that promotes to a side rail at md+. Client components only where state is needed (search input, cart updates, tab toggles); everything else is a server component reading from the in-process data layer.
- Backend: Next.js Route Handlers under app/api/* in the same Next project (no separate Node service). Auth uses a signed cookie set via Next's cookies() API; middleware at the project root guards /dashboard/* and every /api/* route except /api/auth/login. All handlers are typed end-to-end via shared zod schemas in lib/api/contracts.ts.
- Database: In-memory storage via lib/db/store.ts (Map<string, Record>), seeded at module load with 1 pilot retailer, 4 distributors, ~20 medicines, 3 offers, and 2 outstanding-payment rows. The schema is shaped to match a future Postgres + Drizzle migration so the same TypeScript types survive the swap; no migration this cycle.
- Infrastructure: Single Vercel deploy (frontend + Route Handlers behind one origin). Static assets via Vercel CDN. No external services this cycle. Future cycles: Neon Postgres for persistence, per-distributor HTTP integration via a simple fanout, and S3-compatible storage for prescription scans.

**API contracts:**
- `POST /api/auth/login` — Pilot login: takes a retailer license number, looks it up in the in-memory store, sets the pharmacy-session cookie (HttpOnly, SameSite=Lax) and returns the retailer summary. No password this cycle (single pilot retailer per device).
- `POST /api/auth/logout` — Clears the pharmacy-session cookie.
- `GET /api/medicines/search` — Case-insensitive substring search over medicine name, brand, and generic name. Empty q returns the full catalogue (used by the search results page when a retailer lands without a query). Each result carries the distributor it ships from so the UI can render the price + supplier chip.
- `GET /api/distributors` — List all distributors the retailer can buy from. Used by the Home tab quick-link and the cart line items.
- `GET /api/offers` — List of currently-active offers shown in the Home tab carousel. Returned in sortOrder. Each entry references the distributor running the offer.
- `GET /api/cart` — Returns the current retailer's cart, grouped by distributor with a per-distributor subtotal and a grand total. Drives the Cart tab.
- `POST /api/cart/items` — Add a medicine to the current retailer's cart, or increment the qty if it is already there. Validates that the medicineId exists. Returns the updated cart payload (same shape as GET /api/cart) so the Cart tab can render without a second round-trip.
- `DELETE /api/cart/items/{medicineId}` — Remove a medicine from the current retailer's cart. Returns the updated cart payload.
- `POST /api/orders` — Place orders from the current retailer's cart. The cart is fanned out into one order per distributor (so the retailer's UI can show each supplier's order separately under Orders > Active). Cart is cleared on success.
- `GET /api/orders` — List the retailer's orders, filtered by status group. status=active returns placed \| acknowledged \| out_for_delivery; status=closed returns delivered \| cancelled. Sorted newest-first.
- `GET /api/profile` — Returns the current retailer's profile card plus the outstanding-payments breakdown shown on the Home tab tile.

**Database schema:**
- **`retailers`**
    - `id: string primary key (uuid in production)`
    - `name: string not null (display name shown on Profile)`
    - `owner_name: string not null`
    - `license_number: string not null unique (used as login id this cycle)`
    - `store_name: string not null`
    - `store_address: string not null`
    - `phone: string not null`
    - `email: string not null`
    - `gstin: string not null`
    - `favourites_medicine_ids: string[] not null default []`
    - `created_at: timestamp not null`
- **`distributors`**
    - `id: string primary key`
    - `name: string not null`
    - `region: string not null`
    - `supplier_code: string not null unique`
    - `contact_phone: string not null`
    - `contact_email: string not null`
    - `rating: number not null (0-5, decimal)`
    - `created_at: timestamp not null`
- **`medicines`**
    - `id: string primary key`
    - `name: string not null`
    - `brand: string not null`
    - `manufacturer: string not null`
    - `generic_name: string not null`
    - `distributor_id: string not null references distributors(id)`
    - `mrp_paise: integer not null (>=0)`
    - `selling_price_paise: integer not null (>=0)`
    - `scheme: string nullable (e.g. '10+1 free' or null)`
    - `pack_size: string not null (e.g. '10 tablets', '100 ml syrup')`
    - `hsn_code: string not null`
    - `created_at: timestamp not null`
- **`offers`**
    - `id: string primary key`
    - `title: string not null`
    - `description: string not null`
    - `distributor_id: string not null references distributors(id)`
    - `banner_label: string not null (short text shown on the gradient banner)`
    - `valid_until: timestamp not null`
    - `sort_order: integer not null (lower = earlier in the carousel)`
    - `created_at: timestamp not null`
- **`cart_items`**
    - `id: string primary key`
    - `retailer_id: string not null references retailers(id)`
    - `medicine_id: string not null references medicines(id)`
    - `distributor_id: string not null references distributors(id) (denormalised from medicines for easy grouping)`
    - `qty: integer not null (>=1)`
    - `unit_price_paise: integer not null (frozen at add-to-cart time)`
    - `added_at: timestamp not null`
    - `unique(retailer_id, medicine_id)`
- **`orders`**
    - `id: string primary key`
    - `retailer_id: string not null references retailers(id)`
    - `distributor_id: string not null references distributors(id)`
    - `status: string not null (one of: placed \| acknowledged \| out_for_delivery \| delivered \| cancelled)`
    - `placed_at: timestamp not null`
    - `expected_delivery: timestamp nullable`
    - `total_paise: integer not null (>=0)`
    - `item_count: integer not null (>=1)`
- **`order_items`**
    - `id: string primary key`
    - `order_id: string not null references orders(id)`
    - `medicine_id: string not null references medicines(id)`
    - `qty: integer not null (>=1)`
    - `unit_price_paise: integer not null`
    - `line_total_paise: integer not null`
- **`outstanding_payments`**
    - `id: string primary key`
    - `retailer_id: string not null references retailers(id)`
    - `distributor_id: string not null references distributors(id)`
    - `amount_due_paise: integer not null (>=0)`
    - `last_updated_at: timestamp not null`
    - `unique(retailer_id, distributor_id)`

**Risks:**
- security: mock cookie auth (single shared session secret, no password, no multi-device invalidation) is intentional for the pilot but unsafe for production; flag for a real auth task in cycle 2
- compliance: pharmacy ordering is regulated (drug schedules, Schedule H1/X tracking, narcotics audit trail). This cycle ignores schedule classification and prescription validation; both are mandatory before any non-pilot rollout
- data loss: in-memory Maps reset on every process restart. Acceptable for a demo, blocking for a customer pilot
- scaling: medicine search is a linear scan over the in-memory store. Fine for ~20 medicines; needs Postgres trigram index or Meilisearch beyond ~1000 SKUs
- mobile UX: 'Scan Prescription' is a placeholder tile this cycle; barcode + OCR scan needs a native shell or WebRTC + a vision model and is out of scope
- outstanding-payments accuracy: the per-distributor balance is currently a static seed; integration with each distributor's ledger is a downstream task and the tile must be labelled as 'last reconciled at <ts>' to avoid retailer confusion

<details>
<summary>Full CTO output (JSON)</summary>

```json
{
  "architecture": {
    "frontend": "Next.js 14 (App Router) + Tailwind CSS, mobile-first responsive layout. Authenticated /dashboard route renders a fixed bottom tab bar (Home / Orders / Cart / Profile) on small screens that promotes to a side rail at md+. Client components only where state is needed (search input, cart updates, tab toggles); everything else is a server component reading from the in-process data layer.",
    "backend": "Next.js Route Handlers under app/api/* in the same Next project (no separate Node service). Auth uses a signed cookie set via Next's cookies() API; middleware at the project root guards /dashboard/* and every /api/* route except /api/auth/login. All handlers are typed end-to-end via shared zod schemas in lib/api/contracts.ts.",
    "database": "In-memory storage via lib/db/store.ts (Map<string, Record>), seeded at module load with 1 pilot retailer, 4 distributors, ~20 medicines, 3 offers, and 2 outstanding-payment rows. The schema is shaped to match a future Postgres + Drizzle migration so the same TypeScript types survive the swap; no migration this cycle.",
    "infrastructure": "Single Vercel deploy (frontend + Route Handlers behind one origin). Static assets via Vercel CDN. No external services this cycle. Future cycles: Neon Postgres for persistence, per-distributor HTTP integration via a simple fanout, and S3-compatible storage for prescription scans."
  },
  "apiContracts": [
    {
      "endpoint": "/api/auth/login",
      "method": "POST",
      "description": "Pilot login: takes a retailer license number, looks it up in the in-memory store, sets the pharmacy-session cookie (HttpOnly, SameSite=Lax) and returns the retailer summary. No password this cycle (single pilot retailer per device).",
      "request": {
        "licenseNumber": "string"
      },
      "response": {
        "retailer": {
          "id": "string",
          "name": "string",
          "storeName": "string",
          "licenseNumber": "string"
        }
      }
    },
    {
      "endpoint": "/api/auth/logout",
      "method": "POST",
      "description": "Clears the pharmacy-session cookie.",
      "request": {},
      "response": {
        "ok": "true"
      }
    },
    {
      "endpoint": "/api/medicines/search",
      "method": "GET",
      "description": "Case-insensitive substring search over medicine name, brand, and generic name. Empty q returns the full catalogue (used by the search results page when a retailer lands without a query). Each result carries the distributor it ships from so the UI can render the price + supplier chip.",
      "request": {
        "q": "string (optional)"
      },
      "response": {
        "results": [
          {
            "id": "string",
            "name": "string",
            "brand": "string",
            "genericName": "string",
            "distributor": {
              "id": "string",
              "name": "string"
            },
            "mrpPaise": "integer",
            "sellingPricePaise": "integer",
            "scheme": "string | null",
            "packSize": "string"
          }
        ]
      }
    },
    {
      "endpoint": "/api/distributors",
      "method": "GET",
      "description": "List all distributors the retailer can buy from. Used by the Home tab quick-link and the cart line items.",
      "request": {},
      "response": {
        "distributors": [
          {
            "id": "string",
            "name": "string",
            "region": "string",
            "rating": "number"
          }
        ]
      }
    },
    {
      "endpoint": "/api/offers",
      "method": "GET",
      "description": "List of currently-active offers shown in the Home tab carousel. Returned in sortOrder. Each entry references the distributor running the offer.",
      "request": {},
      "response": {
        "offers": [
          {
            "id": "string",
            "title": "string",
            "description": "string",
            "distributor": {
              "id": "string",
              "name": "string"
            },
            "validUntil": "ISO-8601 string"
          }
        ]
      }
    },
    {
      "endpoint": "/api/cart",
      "method": "GET",
      "description": "Returns the current retailer's cart, grouped by distributor with a per-distributor subtotal and a grand total. Drives the Cart tab.",
      "request": {},
      "response": {
        "groups": [
          {
            "distributor": {
              "id": "string",
              "name": "string"
            },
            "items": [
              {
                "medicineId": "string",
                "name": "string",
                "brand": "string",
                "qty": "integer",
                "unitPricePaise": "integer",
                "lineTotalPaise": "integer"
              }
            ],
            "subtotalPaise": "integer"
          }
        ],
        "grandTotalPaise": "integer",
        "itemCount": "integer"
      }
    },
    {
      "endpoint": "/api/cart/items",
      "method": "POST",
      "description": "Add a medicine to the current retailer's cart, or increment the qty if it is already there. Validates that the medicineId exists. Returns the updated cart payload (same shape as GET /api/cart) so the Cart tab can render without a second round-trip.",
      "request": {
        "medicineId": "string",
        "qty": "integer (>=1, default 1)"
      },
      "response": {
        "groups": [
          {
            "distributor": {
              "id": "string",
              "name": "string"
            },
            "items": [
              {
                "medicineId": "string",
                "name": "string",
                "brand": "string",
                "qty": "integer",
                "unitPricePaise": "integer",
                "lineTotalPaise": "integer"
              }
            ],
            "subtotalPaise": "integer"
          }
        ],
        "grandTotalPaise": "integer",
        "itemCount": "integer"
      }
    },
    {
      "endpoint": "/api/cart/items/{medicineId}",
      "method": "DELETE",
      "description": "Remove a medicine from the current retailer's cart. Returns the updated cart payload.",
      "request": {
        "medicineId": "string (path param)"
      },
      "response": {
        "groups": [
          {
            "distributor": {
              "id": "string",
              "name": "string"
            },
            "items": [
              {
                "medicineId": "string",
                "name": "string",
                "brand": "string",
                "qty": "integer",
                "unitPricePaise": "integer",
                "lineTotalPaise": "integer"
              }
            ],
            "subtotalPaise": "integer"
          }
        ],
        "grandTotalPaise": "integer",
        "itemCount": "integer"
      }
    },
    {
      "endpoint": "/api/orders",
      "method": "POST",
      "description": "Place orders from the current retailer's cart. The cart is fanned out into one order per distributor (so the retailer's UI can show each supplier's order separately under Orders > Active). Cart is cleared on success.",
      "request": {},
      "response": {
        "orderIds": [
          "string"
        ],
        "orderCount": "integer"
      }
    },
    {
      "endpoint": "/api/orders",
      "method": "GET",
      "description": "List the retailer's orders, filtered by status group. status=active returns placed | acknowledged | out_for_delivery; status=closed returns delivered | cancelled. Sorted newest-first.",
      "request": {
        "status": "active | closed"
      },
      "response": {
        "orders": [
          {
            "id": "string",
            "distributor": {
              "id": "string",
              "name": "string"
            },
            "status": "placed | acknowledged | out_for_delivery | delivered | cancelled",
            "placedAt": "ISO-8601 string",
            "expectedDelivery": "ISO-8601 string | null",
            "itemCount": "integer",
            "totalPaise": "integer"
          }
        ]
      }
    },
    {
      "endpoint": "/api/profile",
      "method": "GET",
      "description": "Returns the current retailer's profile card plus the outstanding-payments breakdown shown on the Home tab tile.",
      "request": {},
      "response": {
        "retailer": {
          "id": "string",
          "name": "string",
          "ownerName": "string",
          "licenseNumber": "string",
          "storeName": "string",
          "storeAddress": "string",
          "phone": "string",
          "email": "string",
          "gstin": "string",
          "favouritesCount": "integer"
        },
        "outstanding": {
          "totalPaise": "integer",
          "perDistributor": [
            {
              "distributor": {
                "id": "string",
                "name": "string"
              },
              "amountPaise": "integer"
            }
          ]
        }
      }
    }
  ],
  "databaseSchema": [
    {
      "table": "retailers",
      "fields": [
        "id: string primary key (uuid in production)",
        "name: string not null (display name shown on Profile)",
        "owner_name: string not null",
        "license_number: string not null unique (used as login id this cycle)",
        "store_name: string not null",
        "store_address: string not null",
        "phone: string not null",
        "email: string not null",
        "gstin: string not null",
        "favourites_medicine_ids: string[] not null default []",
        "created_at: timestamp not null"
      ]
    },
    {
      "table": "distributors",
      "fields": [
        "id: string primary key",
        "name: string not null",
        "region: string not null",
        "supplier_code: string not null unique",
        "contact_phone: string not null",
        "contact_email: string not null",
        "rating: number not null (0-5, decimal)",
        "created_at: timestamp not null"
      ]
    },
    {
      "table": "medicines",
      "fields": [
        "id: string primary key",
        "name: string not null",
        "brand: string not null",
        "manufacturer: string not null",
        "generic_name: string not null",
        "distributor_id: string not null references distributors(id)",
        "mrp_paise: integer not null (>=0)",
        "selling_price_paise: integer not null (>=0)",
        "scheme: string nullable (e.g. '10+1 free' or null)",
        "pack_size: string not null (e.g. '10 tablets', '100 ml syrup')",
        "hsn_code: string not null",
        "created_at: timestamp not null"
      ]
    },
    {
      "table": "offers",
      "fields": [
        "id: string primary key",
        "title: string not null",
        "description: string not null",
        "distributor_id: string not null references distributors(id)",
        "banner_label: string not null (short text shown on the gradient banner)",
        "valid_until: timestamp not null",
        "sort_order: integer not null (lower = earlier in the carousel)",
        "created_at: timestamp not null"
      ]
    },
    {
      "table": "cart_items",
      "fields": [
        "id: string primary key",
        "retailer_id: string not null references retailers(id)",
        "medicine_id: string not null references medicines(id)",
        "distributor_id: string not null references distributors(id) (denormalised from medicines for easy grouping)",
        "qty: integer not null (>=1)",
        "unit_price_paise: integer not null (frozen at add-to-cart time)",
        "added_at: timestamp not null",
        "unique(retailer_id, medicine_id)"
      ]
    },
    {
      "table": "orders",
      "fields": [
        "id: string primary key",
        "retailer_id: string not null references retailers(id)",
        "distributor_id: string not null references distributors(id)",
        "status: string not null (one of: placed | acknowledged | out_for_delivery | delivered | cancelled)",
        "placed_at: timestamp not null",
        "expected_delivery: timestamp nullable",
        "total_paise: integer not null (>=0)",
        "item_count: integer not null (>=1)"
      ]
    },
    {
      "table": "order_items",
      "fields": [
        "id: string primary key",
        "order_id: string not null references orders(id)",
        "medicine_id: string not null references medicines(id)",
        "qty: integer not null (>=1)",
        "unit_price_paise: integer not null",
        "line_total_paise: integer not null"
      ]
    },
    {
      "table": "outstanding_payments",
      "fields": [
        "id: string primary key",
        "retailer_id: string not null references retailers(id)",
        "distributor_id: string not null references distributors(id)",
        "amount_due_paise: integer not null (>=0)",
        "last_updated_at: timestamp not null",
        "unique(retailer_id, distributor_id)"
      ]
    }
  ],
  "risks": [
    "security: mock cookie auth (single shared session secret, no password, no multi-device invalidation) is intentional for the pilot but unsafe for production; flag for a real auth task in cycle 2",
    "compliance: pharmacy ordering is regulated (drug schedules, Schedule H1/X tracking, narcotics audit trail). This cycle ignores schedule classification and prescription validation; both are mandatory before any non-pilot rollout",
    "data loss: in-memory Maps reset on every process restart. Acceptable for a demo, blocking for a customer pilot",
    "scaling: medicine search is a linear scan over the in-memory store. Fine for ~20 medicines; needs Postgres trigram index or Meilisearch beyond ~1000 SKUs",
    "mobile UX: 'Scan Prescription' is a placeholder tile this cycle; barcode + OCR scan needs a native shell or WebRTC + a vision model and is out of scope",
    "outstanding-payments accuracy: the per-distributor balance is currently a static seed; integration with each distributor's ledger is a downstream task and the tile must be labelled as 'last reconciled at <ts>' to avoid retailer confusion"
  ]
}
```

</details>

### Engineering Manager

**Features (6):**
- `f-shell-auth` (high) — App shell + mock retailer auth
- `f-data-spine` (high) — In-memory data spine + shared types
- `f-home-tab` (high) — Home tab
- `f-orders-tab` (high) — Orders tab + place-order API
- `f-cart-tab` (high) — Cart tab + cart APIs
- `f-profile-tab` (medium) — Profile tab

**Tasks (10):**
- `t-shell-1` → `f-shell-auth` · developer · 4h — Set up the Next.js 14 + Tailwind project skeleton: package.json (next 14.2, react 18, tailwind 3, typescript 5, vitest), tsconfig.json with the @/* alias, next.config.mjs, postcss.config.mjs, tailwind.config.ts (mobile-first content globs), app/globals.css with the Tailwind directives + base background, app/layout.tsx with the html/body shell, and the public login page at app/page.tsx that posts to /api/auth/login. No auth handler yet (lands in t-shell-2); the page just calls fetch and redirects on success.
- `t-shell-2` → `f-shell-auth` · developer · 4h — Implement the mock auth: POST /api/auth/login (look up the retailer by license number against the in-memory store, set the pharmacy-session cookie HttpOnly+SameSite=Lax with a 30-day max-age), POST /api/auth/logout (clear the cookie), middleware.ts that gates /dashboard/* and every /api/* route except /api/auth/login (returns 401 JSON if missing cookie), a small lib/auth/session.ts helper that reads the current retailerId from the request cookies, and the authenticated app/dashboard/layout.tsx that renders the 4-tab bottom navigation (Home / Orders / Cart / Profile) and a stub app/dashboard/page.tsx that redirects to /dashboard/home.
- `t-data-1` → `f-data-spine` · developer · 4h — Implement the in-memory data spine: lib/types.ts (TypeScript types for Retailer, Distributor, Medicine, Offer, CartItem, Order, OrderItem, OutstandingPayment, OrderStatus, derived Money helpers) and lib/db/store.ts (Map-backed stores seeded at module import with 1 pilot retailer, 4 distributors, 20 medicines spanning the four distributors, 3 active offers, 2 outstanding-payment rows; CRUD helpers - getRetailer, listDistributors, listOffers, searchMedicines(q), getMedicine(id), getCart(retailerId), addCartItem, removeCartItem, clearCart, listOrders(retailerId, statusGroup), createOrdersFromCart(retailerId), getOutstandingForRetailer(retailerId)).
- `t-home-1` → `f-home-tab` · developer · 3h — Implement the read APIs that drive the Home tab: GET /api/medicines/search (case-insensitive substring over name + brand + generic, returns each result with its distributor), GET /api/distributors (id/name/region/rating list), GET /api/offers (active offers in sortOrder, each with its distributor). All three use the auth-guarded session helper to identify the retailer (search results may carry per-retailer favourites later) and return 401 if the cookie is missing.
- `t-home-2` → `f-home-tab` · developer · 4h — Build the Home tab page at app/dashboard/home/page.tsx: greeting line with the retailer name, a search bar at the top that links to /dashboard/search?q=..., a horizontally scrollable offers carousel reading from GET /api/offers, the 5 quick-link tiles (Distributors, Schemes, Generic Medicines, Scan Prescription, Outstanding Payments), and an outstanding-payments summary tile that calls GET /api/profile and shows the total + per-distributor breakdown. Mobile-first Tailwind layout, snap-scroll on the carousel.
- `t-cart-1` → `f-cart-tab` · developer · 3h — Implement the cart APIs: GET /api/cart (returns the cart grouped by distributor with subtotals + grand total + itemCount, derived from the in-memory store), POST /api/cart/items (validates medicineId exists, increments qty if already present, returns the same grouped payload), DELETE /api/cart/items/[medicineId] (removes the line, returns the same grouped payload). All three resolve the retailer via the session helper and 401 without it.
- `t-cart-2` → `f-cart-tab` · developer · 3h — Build the Cart tab page at app/dashboard/cart/page.tsx: groups the cart by distributor (heading per supplier with subtotal), each line shows name + brand + qty stepper + remove button + line total, sticky footer with the grand total and a Place Order button that POSTs to /api/orders and on success routes to /dashboard/orders?status=active. Empty-state copy when the cart is empty.
- `t-orders-1` → `f-orders-tab` · developer · 3h — Implement the orders APIs: GET /api/orders?status=active\|closed (active = placed \| acknowledged \| out_for_delivery, closed = delivered \| cancelled, sorted newest-first), POST /api/orders (reads the current retailer's cart, fans out into one order per distinct distributorId, copies cart_items into order_items, clears the cart, returns the new orderIds + count). 401 without the session cookie.
- `t-orders-2` → `f-orders-tab` · developer · 3h — Build the Orders tab page at app/dashboard/orders/page.tsx with Active and Closed sub-tabs (segmented control). Each sub-tab calls GET /api/orders with the matching status group and renders order cards (distributor name, status pill with status-color, item count, total, placed-at relative time, expected-delivery when present). Empty-state copy for both tabs.
- `t-profile-1` → `f-profile-tab` · developer · 3h — Implement GET /api/profile (returns the current retailer plus the outstanding-payments breakdown grouped by distributor) and build the Profile tab page at app/dashboard/profile/page.tsx that renders the retailer card (avatar initials, name, store name, license number, owner name, GSTIN, store address, phone, email, favourites count) and an outstanding-payments section listing each distributor's amount-due with the grand total. A logout button at the bottom POSTs /api/auth/logout and routes to /.

<details>
<summary>Full Engineering Manager output (JSON)</summary>

```json
{
  "features": [
    {
      "id": "f-shell-auth",
      "name": "App shell + mock retailer auth",
      "description": "Next.js 14 + Tailwind project skeleton, the login page, and the authenticated /dashboard layout with the bottom tab bar that every other feature lives inside.",
      "priority": "high",
      "status": "pending"
    },
    {
      "id": "f-data-spine",
      "name": "In-memory data spine + shared types",
      "description": "Single source of truth for retailers, distributors, medicines, offers, cart items, orders, order items, and outstanding payments. In-memory Maps with seed data, plus the shared TypeScript types every Route Handler and page imports.",
      "priority": "high",
      "status": "pending"
    },
    {
      "id": "f-home-tab",
      "name": "Home tab",
      "description": "Search bar at the top, offers carousel, the 5 quick-link tiles (Distributors, Schemes, Generic Medicines, Scan Prescription, Outstanding Payments), and the supporting catalogue / offers / distributors APIs.",
      "priority": "high",
      "status": "pending"
    },
    {
      "id": "f-orders-tab",
      "name": "Orders tab + place-order API",
      "description": "Orders list page with Active and Closed sub-tabs, plus the POST /api/orders fanout (cart -> one order per distributor) and GET /api/orders status-grouped reader.",
      "priority": "high",
      "status": "pending"
    },
    {
      "id": "f-cart-tab",
      "name": "Cart tab + cart APIs",
      "description": "Cart page grouped by distributor with per-distributor subtotal and a grand total, plus the GET / POST / DELETE cart endpoints that drive it.",
      "priority": "high",
      "status": "pending"
    },
    {
      "id": "f-profile-tab",
      "name": "Profile tab",
      "description": "Read-only retailer card (name, owner, license number, store address, GSTIN, phone, email, favourites count) plus the GET /api/profile endpoint that returns the retailer plus the outstanding-payments breakdown.",
      "priority": "medium",
      "status": "pending"
    }
  ],
  "tasks": [
    {
      "id": "t-shell-1",
      "featureId": "f-shell-auth",
      "description": "Set up the Next.js 14 + Tailwind project skeleton: package.json (next 14.2, react 18, tailwind 3, typescript 5, vitest), tsconfig.json with the @/* alias, next.config.mjs, postcss.config.mjs, tailwind.config.ts (mobile-first content globs), app/globals.css with the Tailwind directives + base background, app/layout.tsx with the html/body shell, and the public login page at app/page.tsx that posts to /api/auth/login. No auth handler yet (lands in t-shell-2); the page just calls fetch and redirects on success.",
      "assignedTo": "developer",
      "estimatedHours": 4,
      "status": "pending"
    },
    {
      "id": "t-shell-2",
      "featureId": "f-shell-auth",
      "description": "Implement the mock auth: POST /api/auth/login (look up the retailer by license number against the in-memory store, set the pharmacy-session cookie HttpOnly+SameSite=Lax with a 30-day max-age), POST /api/auth/logout (clear the cookie), middleware.ts that gates /dashboard/* and every /api/* route except /api/auth/login (returns 401 JSON if missing cookie), a small lib/auth/session.ts helper that reads the current retailerId from the request cookies, and the authenticated app/dashboard/layout.tsx that renders the 4-tab bottom navigation (Home / Orders / Cart / Profile) and a stub app/dashboard/page.tsx that redirects to /dashboard/home.",
      "assignedTo": "developer",
      "estimatedHours": 4,
      "status": "pending"
    },
    {
      "id": "t-data-1",
      "featureId": "f-data-spine",
      "description": "Implement the in-memory data spine: lib/types.ts (TypeScript types for Retailer, Distributor, Medicine, Offer, CartItem, Order, OrderItem, OutstandingPayment, OrderStatus, derived Money helpers) and lib/db/store.ts (Map-backed stores seeded at module import with 1 pilot retailer, 4 distributors, 20 medicines spanning the four distributors, 3 active offers, 2 outstanding-payment rows; CRUD helpers - getRetailer, listDistributors, listOffers, searchMedicines(q), getMedicine(id), getCart(retailerId), addCartItem, removeCartItem, clearCart, listOrders(retailerId, statusGroup), createOrdersFromCart(retailerId), getOutstandingForRetailer(retailerId)).",
      "assignedTo": "developer",
      "estimatedHours": 4,
      "status": "pending"
    },
    {
      "id": "t-home-1",
      "featureId": "f-home-tab",
      "description": "Implement the read APIs that drive the Home tab: GET /api/medicines/search (case-insensitive substring over name + brand + generic, returns each result with its distributor), GET /api/distributors (id/name/region/rating list), GET /api/offers (active offers in sortOrder, each with its distributor). All three use the auth-guarded session helper to identify the retailer (search results may carry per-retailer favourites later) and return 401 if the cookie is missing.",
      "assignedTo": "developer",
      "estimatedHours": 3,
      "status": "pending"
    },
    {
      "id": "t-home-2",
      "featureId": "f-home-tab",
      "description": "Build the Home tab page at app/dashboard/home/page.tsx: greeting line with the retailer name, a search bar at the top that links to /dashboard/search?q=..., a horizontally scrollable offers carousel reading from GET /api/offers, the 5 quick-link tiles (Distributors, Schemes, Generic Medicines, Scan Prescription, Outstanding Payments), and an outstanding-payments summary tile that calls GET /api/profile and shows the total + per-distributor breakdown. Mobile-first Tailwind layout, snap-scroll on the carousel.",
      "assignedTo": "developer",
      "estimatedHours": 4,
      "status": "pending"
    },
    {
      "id": "t-cart-1",
      "featureId": "f-cart-tab",
      "description": "Implement the cart APIs: GET /api/cart (returns the cart grouped by distributor with subtotals + grand total + itemCount, derived from the in-memory store), POST /api/cart/items (validates medicineId exists, increments qty if already present, returns the same grouped payload), DELETE /api/cart/items/[medicineId] (removes the line, returns the same grouped payload). All three resolve the retailer via the session helper and 401 without it.",
      "assignedTo": "developer",
      "estimatedHours": 3,
      "status": "pending"
    },
    {
      "id": "t-cart-2",
      "featureId": "f-cart-tab",
      "description": "Build the Cart tab page at app/dashboard/cart/page.tsx: groups the cart by distributor (heading per supplier with subtotal), each line shows name + brand + qty stepper + remove button + line total, sticky footer with the grand total and a Place Order button that POSTs to /api/orders and on success routes to /dashboard/orders?status=active. Empty-state copy when the cart is empty.",
      "assignedTo": "developer",
      "estimatedHours": 3,
      "status": "pending"
    },
    {
      "id": "t-orders-1",
      "featureId": "f-orders-tab",
      "description": "Implement the orders APIs: GET /api/orders?status=active|closed (active = placed | acknowledged | out_for_delivery, closed = delivered | cancelled, sorted newest-first), POST /api/orders (reads the current retailer's cart, fans out into one order per distinct distributorId, copies cart_items into order_items, clears the cart, returns the new orderIds + count). 401 without the session cookie.",
      "assignedTo": "developer",
      "estimatedHours": 3,
      "status": "pending"
    },
    {
      "id": "t-orders-2",
      "featureId": "f-orders-tab",
      "description": "Build the Orders tab page at app/dashboard/orders/page.tsx with Active and Closed sub-tabs (segmented control). Each sub-tab calls GET /api/orders with the matching status group and renders order cards (distributor name, status pill with status-color, item count, total, placed-at relative time, expected-delivery when present). Empty-state copy for both tabs.",
      "assignedTo": "developer",
      "estimatedHours": 3,
      "status": "pending"
    },
    {
      "id": "t-profile-1",
      "featureId": "f-profile-tab",
      "description": "Implement GET /api/profile (returns the current retailer plus the outstanding-payments breakdown grouped by distributor) and build the Profile tab page at app/dashboard/profile/page.tsx that renders the retailer card (avatar initials, name, store name, license number, owner name, GSTIN, store address, phone, email, favourites count) and an outstanding-payments section listing each distributor's amount-due with the grand total. A logout button at the bottom POSTs /api/auth/logout and routes to /.",
      "assignedTo": "developer",
      "estimatedHours": 3,
      "status": "pending"
    }
  ]
}
```

</details>

### Developer (executed `t-shell-1`)

**Implementation plan:**

> Bring up the Next.js 14 + Tailwind project skeleton exactly as the CTO architecture specifies and ship the public login page UI (form-only - the auth handler lands in t-shell-2). Files: package.json pins Next 14.2 / React 18 / Tailwind 3 / TypeScript 5 / Vitest 1 with the standard scripts (dev / build / start / test / typecheck). tsconfig.json sets the @/* path alias the CTO contract assumes. next.config.mjs is intentionally minimal (no rewrites, no images config yet). postcss.config.mjs wires tailwindcss + autoprefixer. tailwind.config.ts globs app/** and components/**. next-env.d.ts is the standard Next type reference. app/globals.css carries the Tailwind directives and a single base background utility. app/layout.tsx is the html/body shell with the Inter system stack and the Tailwind background class. app/page.tsx is the public login page: a single license-number text input, primary submit button, fetch POST to /api/auth/login, on 200 router.replace to /dashboard, on non-200 surface the error JSON. No client framework state library - useState + useTransition are enough. Tests live in a co-located vitest file that asserts the page renders the form and that the form fields/button text match what the QA test plan keys off.

**Files produced (9):**
- `package.json` (675 bytes)
- `tsconfig.json` (582 bytes)
- `next.config.mjs` (118 bytes)
- `postcss.config.mjs` (81 bytes)
- `tailwind.config.ts` (435 bytes)
- `next-env.d.ts` (201 bytes)
- `app/globals.css` (332 bytes)
- `app/layout.tsx` (519 bytes)
- `app/page.tsx` (3604 bytes)

**Tests (1):**
- Login page renders the heading, the license-number input, and the submit button copy that the QA test plan keys off.

**Notes (3):**
- Auth handler intentionally NOT included this task. The page already POSTs to /api/auth/login; the matching Route Handler + middleware land in t-shell-2 per the EM breakdown.
- The license-number default ('MH-RP-2024-7821') matches the seed pilot retailer that lands in t-data-1, so a fresh `npm run dev` produces a working login on the first try without the user remembering an id.
- next-env.d.ts is shipped as written (the standard Next preamble) instead of being re-generated; this keeps the repo deterministic and removes the 'first dev run rewrites the file' UX wart.

<details>
<summary>Full Developer output (JSON, includes file contents)</summary>

```json
{
  "taskId": "t-shell-1",
  "implementationPlan": "Bring up the Next.js 14 + Tailwind project skeleton exactly as the CTO architecture specifies and ship the public login page UI (form-only - the auth handler lands in t-shell-2). Files: package.json pins Next 14.2 / React 18 / Tailwind 3 / TypeScript 5 / Vitest 1 with the standard scripts (dev / build / start / test / typecheck). tsconfig.json sets the @/* path alias the CTO contract assumes. next.config.mjs is intentionally minimal (no rewrites, no images config yet). postcss.config.mjs wires tailwindcss + autoprefixer. tailwind.config.ts globs app/** and components/**. next-env.d.ts is the standard Next type reference. app/globals.css carries the Tailwind directives and a single base background utility. app/layout.tsx is the html/body shell with the Inter system stack and the Tailwind background class. app/page.tsx is the public login page: a single license-number text input, primary submit button, fetch POST to /api/auth/login, on 200 router.replace to /dashboard, on non-200 surface the error JSON. No client framework state library - useState + useTransition are enough. Tests live in a co-located vitest file that asserts the page renders the form and that the form fields/button text match what the QA test plan keys off.",
  "files": [
    {
      "path": "package.json",
      "content": "{\n  \"name\": \"pharmacy-b2b\",\n  \"version\": \"0.1.0\",\n  \"private\": true,\n  \"scripts\": {\n    \"dev\": \"next dev\",\n    \"build\": \"next build\",\n    \"start\": \"next start\",\n    \"lint\": \"next lint\",\n    \"typecheck\": \"tsc --noEmit\",\n    \"test\": \"vitest run\"\n  },\n  \"dependencies\": {\n    \"next\": \"14.2.18\",\n    \"react\": \"^18.3.1\",\n    \"react-dom\": \"^18.3.1\"\n  },\n  \"devDependencies\": {\n    \"@types/node\": \"^22.7.5\",\n    \"@types/react\": \"^18.3.12\",\n    \"@types/react-dom\": \"^18.3.1\",\n    \"@vitejs/plugin-react\": \"^4.3.3\",\n    \"autoprefixer\": \"^10.4.20\",\n    \"jsdom\": \"^25.0.1\",\n    \"postcss\": \"^8.4.49\",\n    \"tailwindcss\": \"^3.4.14\",\n    \"typescript\": \"^5.6.3\",\n    \"vitest\": \"^1.6.1\"\n  }\n}\n"
    },
    {
      "path": "tsconfig.json",
      "content": "{\n  \"compilerOptions\": {\n    \"target\": \"ES2022\",\n    \"lib\": [\"dom\", \"dom.iterable\", \"esnext\"],\n    \"allowJs\": true,\n    \"skipLibCheck\": true,\n    \"strict\": true,\n    \"noEmit\": true,\n    \"esModuleInterop\": true,\n    \"module\": \"esnext\",\n    \"moduleResolution\": \"bundler\",\n    \"resolveJsonModule\": true,\n    \"isolatedModules\": true,\n    \"jsx\": \"preserve\",\n    \"incremental\": true,\n    \"plugins\": [{ \"name\": \"next\" }],\n    \"baseUrl\": \".\",\n    \"paths\": { \"@/*\": [\"./*\"] }\n  },\n  \"include\": [\"next-env.d.ts\", \"**/*.ts\", \"**/*.tsx\", \".next/types/**/*.ts\"],\n  \"exclude\": [\"node_modules\"]\n}\n"
    },
    {
      "path": "next.config.mjs",
      "content": "/** @type {import('next').NextConfig} */\nconst nextConfig = {\n  reactStrictMode: true,\n};\n\nexport default nextConfig;\n"
    },
    {
      "path": "postcss.config.mjs",
      "content": "export default {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n};\n"
    },
    {
      "path": "tailwind.config.ts",
      "content": "import type { Config } from \"tailwindcss\";\n\nconst config: Config = {\n  content: [\n    \"./app/**/*.{ts,tsx}\",\n    \"./components/**/*.{ts,tsx}\",\n  ],\n  theme: {\n    extend: {\n      colors: {\n        brand: {\n          50: \"#eef2ff\",\n          100: \"#e0e7ff\",\n          500: \"#6366f1\",\n          600: \"#4f46e5\",\n          700: \"#4338ca\",\n          900: \"#312e81\",\n        },\n      },\n    },\n  },\n  plugins: [],\n};\n\nexport default config;\n"
    },
    {
      "path": "next-env.d.ts",
      "content": "/// <reference types=\"next\" />\n/// <reference types=\"next/image-types/global\" />\n\n// NOTE: This file should not be edited\n// see https://nextjs.org/docs/basic-features/typescript for more information.\n"
    },
    {
      "path": "app/globals.css",
      "content": "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\nhtml,\nbody {\n  height: 100%;\n}\n\nbody {\n  background-color: #f8fafc;\n  color: #0f172a;\n  font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif;\n  -webkit-font-smoothing: antialiased;\n  -moz-osx-font-smoothing: grayscale;\n}\n"
    },
    {
      "path": "app/layout.tsx",
      "content": "import type { Metadata } from \"next\";\nimport \"./globals.css\";\n\nexport const metadata: Metadata = {\n  title: \"Pharmacy B2B\",\n  description: \"Order medicines from your distributors in one app.\",\n  viewport: { width: \"device-width\", initialScale: 1, maximumScale: 1 },\n};\n\nexport default function RootLayout({\n  children,\n}: {\n  children: React.ReactNode;\n}) {\n  return (\n    <html lang=\"en\">\n      <body className=\"min-h-screen bg-slate-50 text-slate-900 antialiased\">\n        {children}\n      </body>\n    </html>\n  );\n}\n"
    },
    {
      "path": "app/page.tsx",
      "content": "\"use client\";\n\nimport { useRouter } from \"next/navigation\";\nimport { useState, useTransition } from \"react\";\n\nexport default function LoginPage() {\n  const router = useRouter();\n  const [licenseNumber, setLicenseNumber] = useState(\"MH-RP-2024-7821\");\n  const [error, setError] = useState<string | null>(null);\n  const [isPending, startTransition] = useTransition();\n\n  function onSubmit(event: React.FormEvent<HTMLFormElement>) {\n    event.preventDefault();\n    setError(null);\n    startTransition(async () => {\n      try {\n        const res = await fetch(\"/api/auth/login\", {\n          method: \"POST\",\n          headers: { \"content-type\": \"application/json\" },\n          body: JSON.stringify({ licenseNumber: licenseNumber.trim() }),\n        });\n        if (!res.ok) {\n          const body = (await res.json().catch(() => ({}))) as { error?: string };\n          setError(body.error ?? `Login failed (${res.status})`);\n          return;\n        }\n        router.replace(\"/dashboard\");\n      } catch (e) {\n        setError((e as Error).message);\n      }\n    });\n  }\n\n  return (\n    <main className=\"flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-50 via-white to-white px-6\">\n      <div className=\"w-full max-w-sm\">\n        <div className=\"mb-10 flex items-center gap-3\">\n          <div className=\"flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-bold text-white shadow-md shadow-brand-600/30\">\n            Rx\n          </div>\n          <div>\n            <p className=\"text-xs font-semibold uppercase tracking-widest text-brand-600\">\n              Pharmacy B2B\n            </p>\n            <p className=\"text-sm text-slate-500\">Distributor ordering, in one app.</p>\n          </div>\n        </div>\n\n        <h1 className=\"text-2xl font-semibold text-slate-900\">Welcome back</h1>\n        <p className=\"mt-1 text-sm text-slate-600\">\n          Sign in with your retail pharmacy license number.\n        </p>\n\n        <form onSubmit={onSubmit} className=\"mt-8 space-y-4\" noValidate>\n          <label className=\"block\">\n            <span className=\"text-sm font-medium text-slate-700\">License number</span>\n            <input\n              type=\"text\"\n              name=\"licenseNumber\"\n              value={licenseNumber}\n              onChange={(e) => setLicenseNumber(e.target.value)}\n              placeholder=\"MH-RP-2024-7821\"\n              required\n              autoComplete=\"off\"\n              className=\"mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30\"\n            />\n          </label>\n\n          {error ? (\n            <div\n              role=\"alert\"\n              className=\"rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800\"\n            >\n              {error}\n            </div>\n          ) : null}\n\n          <button\n            type=\"submit\"\n            disabled={isPending || licenseNumber.trim().length === 0}\n            className=\"flex w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-brand-600/30 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60\"\n          >\n            {isPending ? \"Signing in...\" : \"Sign in\"}\n          </button>\n        </form>\n\n        <p className=\"mt-6 text-xs text-slate-500\">\n          Pilot build. Your license number is your sign-in for this cycle; no password is set.\n        </p>\n      </div>\n    </main>\n  );\n}\n"
    }
  ],
  "tests": [
    {
      "description": "Login page renders the heading, the license-number input, and the submit button copy that the QA test plan keys off.",
      "code": "import { describe, expect, it } from \"vitest\";\nimport { renderToStaticMarkup } from \"react-dom/server\";\n\nimport LoginPage from \"./page\";\n\ndescribe(\"app/page.tsx (login)\", () => {\n  const html = renderToStaticMarkup(<LoginPage />);\n\n  it(\"renders the welcome heading\", () => {\n    expect(html).toContain(\"Welcome back\");\n  });\n\n  it(\"renders the license-number input with the canonical name\", () => {\n    expect(html).toContain('name=\"licenseNumber\"');\n  });\n\n  it(\"renders the Sign in submit button\", () => {\n    expect(html).toContain(\"Sign in\");\n  });\n\n  it(\"explains the pilot mode in the footnote\", () => {\n    expect(html).toContain(\"Pilot build\");\n  });\n});\n"
    }
  ],
  "notes": [
    "Auth handler intentionally NOT included this task. The page already POSTs to /api/auth/login; the matching Route Handler + middleware land in t-shell-2 per the EM breakdown.",
    "The license-number default ('MH-RP-2024-7821') matches the seed pilot retailer that lands in t-data-1, so a fresh `npm run dev` produces a working login on the first try without the user remembering an id.",
    "next-env.d.ts is shipped as written (the standard Next preamble) instead of being re-generated; this keeps the repo deterministic and removes the 'first dev run rewrites the file' UX wart."
  ]
}
```

</details>

### QA

- **Decision:** ✅ PASS
- **Test plan:** 10 item(s)
- **Results:** 11 pass, 0 fail
- **Bugs:** 0

**Bugs:**
_(none)_

<details>
<summary>Full QA output (JSON)</summary>

```json
{
  "taskId": "t-shell-1",
  "testPlan": [
    "Verify the file set follows the CTO architecture: package.json, tsconfig.json, next.config.mjs, postcss.config.mjs, tailwind.config.ts, next-env.d.ts, app/globals.css, app/layout.tsx, app/page.tsx are all present at the documented paths.",
    "Verify package.json pins Next 14.2.x, React 18.x, Tailwind 3.x, TypeScript 5.x, and Vitest 1.x as the CTO architecture requires, with the standard dev/build/start/test/typecheck scripts.",
    "Verify tsconfig.json declares the @/* path alias the CTO contract assumes for shared imports.",
    "Verify tailwind.config.ts content globs cover app/** and components/** so utility classes are not purged in production.",
    "Verify app/layout.tsx renders an html/body shell, imports globals.css, and sets a Tailwind background class on body.",
    "Verify app/page.tsx is a client component (\"use client\" directive) that posts JSON to /api/auth/login with the licenseNumber field name the CTO contract specifies.",
    "Verify app/page.tsx surfaces the server's error JSON when the response is non-200, and routes to /dashboard via next/navigation router.replace when the response is 200.",
    "Verify the login page exposes the Welcome heading, the licenseNumber input, the Sign in button, and the pilot-mode footnote that the developer test file keys off.",
    "Verify no forbidden placeholder strings (TODO, FIXME, XXX, 'not implemented') appear in any file content.",
    "Verify the developer notes accurately surface the cross-task assumptions: auth handler deferred to t-shell-2, default license matches the t-data-1 seed retailer, next-env.d.ts is shipped verbatim."
  ],
  "results": [
    {
      "test": "File set matches the architecture (9 files at the documented paths).",
      "status": "pass",
      "details": "9 files declared at: package.json, tsconfig.json, next.config.mjs, postcss.config.mjs, tailwind.config.ts, next-env.d.ts, app/globals.css, app/layout.tsx, app/page.tsx. All repo-relative, forward-slashed, no extras."
    },
    {
      "test": "Dependency versions match the CTO architecture pin set.",
      "status": "pass",
      "details": "package.json deps: next 14.2.18, react ^18.3.1, react-dom ^18.3.1. devDeps: tailwindcss ^3.4.14, typescript ^5.6.3, vitest ^1.6.1, @types/node ^22.7.5, @types/react ^18.3.12, postcss ^8.4.49, autoprefixer ^10.4.20. All within the major-version contract."
    },
    {
      "test": "package.json exposes the canonical scripts (dev, build, start, test, typecheck, lint).",
      "status": "pass",
      "details": "scripts.dev=next dev, scripts.build=next build, scripts.start=next start, scripts.test=vitest run, scripts.typecheck=tsc --noEmit, scripts.lint=next lint. 6 of 6 expected scripts present."
    },
    {
      "test": "tsconfig.json declares the @/* path alias the CTO contract assumes.",
      "status": "pass",
      "details": "compilerOptions.baseUrl='.', compilerOptions.paths['@/*']=['./*']. Strict mode is on, jsx is preserve (for Next), moduleResolution is bundler. Aligns with Next 14 + Tailwind defaults."
    },
    {
      "test": "tailwind.config.ts content globs cover app/** and components/**.",
      "status": "pass",
      "details": "config.content = ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}']. The brand color extension is sane (50/100/500/600/700/900) and consumed by the login page (bg-brand-600, text-brand-600)."
    },
    {
      "test": "app/layout.tsx renders the html/body shell and imports globals.css.",
      "status": "pass",
      "details": "Imports './globals.css', exports default RootLayout returning <html lang='en'><body className='min-h-screen bg-slate-50 ...'>{children}</body></html>. Metadata.title=Pharmacy B2B, viewport set for mobile-first."
    },
    {
      "test": "app/page.tsx is a client component that posts JSON to /api/auth/login with licenseNumber.",
      "status": "pass",
      "details": "'use client' directive on line 1. fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ licenseNumber: licenseNumber.trim() }) }). Field name and endpoint exactly match the CTO contract for POST /api/auth/login."
    },
    {
      "test": "Login page surfaces server error JSON on non-200, redirects to /dashboard on 200.",
      "status": "pass",
      "details": "if (!res.ok) { const body = await res.json().catch(() => ({})); setError(body.error ?? `Login failed (${res.status})`); return; } router.replace('/dashboard'). Uses useTransition for the in-flight state, button disables while pending."
    },
    {
      "test": "Required UI strings are present (Welcome back, licenseNumber input, Sign in button, Pilot build footnote).",
      "status": "pass",
      "details": "Heading text 'Welcome back', input name='licenseNumber', button label 'Sign in' / 'Signing in...', footnote 'Pilot build. Your license number is your sign-in...'. Co-located vitest file asserts each via renderToStaticMarkup."
    },
    {
      "test": "No forbidden placeholder strings in files[].content.",
      "status": "pass",
      "details": "Scanned all 9 file contents for TODO, FIXME, XXX, 'not implemented'. Zero matches across ~3 KB of source."
    },
    {
      "test": "Developer notes are accurate and call out the cross-task assumptions.",
      "status": "pass",
      "details": "Note 1 (auth handler deferred to t-shell-2): consistent with EM scope. Note 2 (default license matches t-data-1 seed): traceable to the seed plan documented in the EM task. Note 3 (next-env.d.ts shipped verbatim): standard Next pattern, removes the first-run rewrite UX wart."
    }
  ],
  "bugs": [],
  "decision": "PASS"
}
```

</details>

### Cybersecurity

- **Decision:** ✅ GO
- **Summary:** Audited the Next.js + Tailwind project skeleton plus the public login page UI. The change ships configuration files (package.json, tsconfig.json, next.config.mjs, postcss/tailwind configs, next-env.d.ts), a single Tailwind stylesheet, the html/body layout, and one client login page that POSTs to a not-yet-implemented /api/auth/login endpoint. No critical or high-severity vulnerabilities were found. Two low-severity items are worth recording for the next-cycle backlog (default license value and missing CSP) but neither blocks proceed for the pilot.
- **Prompt-injection risk:** Negligible. The skeleton ships no LLM-mediated I/O, no markdown rendering of untrusted content, and no shell or filesystem access from any handler (the auth handler itself doesn't exist yet). The login page renders only the user's own input through React's escaping; there is no path through which untrusted text reaches a model prompt or the DOM as raw HTML.

**Vulnerabilities (2):**
- 🟢 low — app/page.tsx pre-fills the license-number input with the seed pilot retailer ('MH-RP-2024-7821'). This is a deliberate developer-experience choice for the pilot demo so a fresh `npm run dev` works on the first try, but if this build is reused for other retailers the pre-filled value leaks who the pilot retailer is to anyone who lands on the login page. Not exploitable on its own.
    - **Recommendation:** Before any non-pilot rollout, remove the default value and ship an empty input with placeholder-only guidance. Pair with a deployment flag (e.g. NEXT_PUBLIC_DEMO_LOGIN_LICENSE) that controls pre-fill so the pilot UX survives only in the demo build.
- 🟢 low — next.config.mjs does not declare a Content-Security-Policy or any of the recommended hardening headers (Strict-Transport-Security, X-Frame-Options, Referrer-Policy, Permissions-Policy). The login page is a public surface and should be defence-in-depth even though the only network call it makes is same-origin.
    - **Recommendation:** In a follow-up task (cycle 2 hardening) add a `headers()` block to next.config.mjs returning the standard set: CSP `default-src 'self'`, HSTS, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy with camera/microphone/geolocation off. Cycle 1 ships without these because we don't yet have an authenticated surface to protect.

**Required fixes (0):**
_(none)_

<details>
<summary>Full Cybersecurity output (JSON)</summary>

```json
{
  "taskId": "t-shell-1",
  "summary": "Audited the Next.js + Tailwind project skeleton plus the public login page UI. The change ships configuration files (package.json, tsconfig.json, next.config.mjs, postcss/tailwind configs, next-env.d.ts), a single Tailwind stylesheet, the html/body layout, and one client login page that POSTs to a not-yet-implemented /api/auth/login endpoint. No critical or high-severity vulnerabilities were found. Two low-severity items are worth recording for the next-cycle backlog (default license value and missing CSP) but neither blocks proceed for the pilot.",
  "vulnerabilities": [
    {
      "severity": "low",
      "description": "app/page.tsx pre-fills the license-number input with the seed pilot retailer ('MH-RP-2024-7821'). This is a deliberate developer-experience choice for the pilot demo so a fresh `npm run dev` works on the first try, but if this build is reused for other retailers the pre-filled value leaks who the pilot retailer is to anyone who lands on the login page. Not exploitable on its own.",
      "recommendation": "Before any non-pilot rollout, remove the default value and ship an empty input with placeholder-only guidance. Pair with a deployment flag (e.g. NEXT_PUBLIC_DEMO_LOGIN_LICENSE) that controls pre-fill so the pilot UX survives only in the demo build."
    },
    {
      "severity": "low",
      "description": "next.config.mjs does not declare a Content-Security-Policy or any of the recommended hardening headers (Strict-Transport-Security, X-Frame-Options, Referrer-Policy, Permissions-Policy). The login page is a public surface and should be defence-in-depth even though the only network call it makes is same-origin.",
      "recommendation": "In a follow-up task (cycle 2 hardening) add a `headers()` block to next.config.mjs returning the standard set: CSP `default-src 'self'`, HSTS, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy with camera/microphone/geolocation off. Cycle 1 ships without these because we don't yet have an authenticated surface to protect."
    }
  ],
  "promptInjectionRisk": "Negligible. The skeleton ships no LLM-mediated I/O, no markdown rendering of untrusted content, and no shell or filesystem access from any handler (the auth handler itself doesn't exist yet). The login page renders only the user's own input through React's escaping; there is no path through which untrusted text reaches a model prompt or the DOM as raw HTML.",
  "decision": "GO",
  "requiredFixes": []
}
```

</details>

---

_Generated by the AI Organisation pipeline runner._
