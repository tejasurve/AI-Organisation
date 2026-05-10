# Pipeline run report

- **Idea:** Build a B2B mobile-first pharmacy ordering app where a retail pharmacist (the retailer) can browse medicines from multiple distributors, place orders, manage a cart, see active and closed orders, and view their store profile. After login, the retailer lands on a 4-tab dashboard: Home (offers carousel + medicine search + quick links to Distributors / Schemes / Generic Medicines / Scan Prescription / Outstanding Payments), Orders (Active / Closed sub-tabs), Cart (line items with distributor + price), Profile (name, license number, favourites, store location).
- **Decision:** ✅ `WROTE_FILES`
- **Timestamp:** 2026-05-02T18:43:12.124Z
- **Total time:** 4 ms across 9 step(s)

## Steps

| # | Step | Status | Duration | Notes |
|---|------|--------|----------|-------|
| 1 | `ceo` | ✅ ok | 1 ms |  |
| 2 | `cto` | ✅ ok | 0 ms |  |
| 3 | `engineering-manager` | ✅ ok | 0 ms |  |
| 4 | `validation` | ✅ ok | 0 ms | 6 features, 10 tasks |
| 5 | `task-selection` | ✅ ok | 0 ms | picked t-shell-2 (developer, 4h) under f-shell-auth |
| 6 | `developer` | ✅ ok | 1 ms |  |
| 7 | `qa` | ✅ ok | 0 ms | decision=PASS |
| 8 | `cybersecurity` | ✅ ok | 0 ms | decision=GO |
| 9 | `file-writer` | ✅ ok | 2 ms | 7 file(s), 6454 bytes |

## Validation

Valid — 6 feature(s), 10 task(s)

## Selected task

- **Task:** `t-shell-2` — Implement the mock auth: POST /api/auth/login (look up the retailer by license number against the in-memory store, set the pharmacy-session cookie HttpOnly+SameSite=Lax with a 30-day max-age), POST /api/auth/logout (clear the cookie), middleware.ts that gates /dashboard/* and every /api/* route except /api/auth/login (returns 401 JSON if missing cookie), a small lib/auth/session.ts helper that reads the current retailerId from the request cookies, and the authenticated app/dashboard/layout.tsx that renders the 4-tab bottom navigation (Home / Orders / Cart / Profile) and a stub app/dashboard/page.tsx that redirects to /dashboard/home.
- **Assignee:** developer
- **Estimate:** 4 h
- **Feature:** `f-shell-auth` — App shell + mock retailer auth

## Files written

7 file(s), 6454 bytes total.

| Path | Bytes | Absolute |
|------|-------|----------|
| `app/api/auth/login/route.ts` | 1245 | `/Users/tejas/Desktop/AI Organisation/generated/t-shell-2/app/api/auth/login/route.ts` |
| `app/api/auth/logout/route.ts` | 269 | `/Users/tejas/Desktop/AI Organisation/generated/t-shell-2/app/api/auth/logout/route.ts` |
| `app/dashboard/layout.tsx` | 661 | `/Users/tejas/Desktop/AI Organisation/generated/t-shell-2/app/dashboard/layout.tsx` |
| `app/dashboard/page.tsx` | 121 | `/Users/tejas/Desktop/AI Organisation/generated/t-shell-2/app/dashboard/page.tsx` |
| `components/BottomTabBar.tsx` | 2711 | `/Users/tejas/Desktop/AI Organisation/generated/t-shell-2/components/BottomTabBar.tsx` |
| `lib/auth/session.ts` | 515 | `/Users/tejas/Desktop/AI Organisation/generated/t-shell-2/lib/auth/session.ts` |
| `middleware.ts` | 932 | `/Users/tejas/Desktop/AI Organisation/generated/t-shell-2/middleware.ts` |

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
- `t-shell-2` → `f-shell-auth` · developer · 4h — Implement the mock auth: POST /api/auth/login (look up the retailer by license number against the in-memory store, set the pharmacy-session cookie HttpOnly+SameSite=Lax with a 30-day max-age), POST /api/auth/logout (clear the cookie), middleware.ts that gates /dashboard/* and every /api/* route except /api/auth/login (returns 401 JSON if missing cookie), a small lib/auth/session.ts helper that reads the current retailerId from the request cookies, and the authenticated app/dashboard/layout.tsx that renders the 4-tab bottom navigation (Home / Orders / Cart / Profile) and a stub app/dashboard/page.tsx that redirects to /dashboard/home.
- `t-shell-1` → `f-shell-auth` · developer · 4h — Set up the Next.js 14 + Tailwind project skeleton: package.json (next 14.2, react 18, tailwind 3, typescript 5, vitest), tsconfig.json with the @/* alias, next.config.mjs, postcss.config.mjs, tailwind.config.ts (mobile-first content globs), app/globals.css with the Tailwind directives + base background, app/layout.tsx with the html/body shell, and the public login page at app/page.tsx that posts to /api/auth/login. No auth handler yet (lands in t-shell-2); the page just calls fetch and redirects on success.
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
      "id": "t-shell-2",
      "featureId": "f-shell-auth",
      "description": "Implement the mock auth: POST /api/auth/login (look up the retailer by license number against the in-memory store, set the pharmacy-session cookie HttpOnly+SameSite=Lax with a 30-day max-age), POST /api/auth/logout (clear the cookie), middleware.ts that gates /dashboard/* and every /api/* route except /api/auth/login (returns 401 JSON if missing cookie), a small lib/auth/session.ts helper that reads the current retailerId from the request cookies, and the authenticated app/dashboard/layout.tsx that renders the 4-tab bottom navigation (Home / Orders / Cart / Profile) and a stub app/dashboard/page.tsx that redirects to /dashboard/home.",
      "assignedTo": "developer",
      "estimatedHours": 4,
      "status": "pending"
    },
    {
      "id": "t-shell-1",
      "featureId": "f-shell-auth",
      "description": "Set up the Next.js 14 + Tailwind project skeleton: package.json (next 14.2, react 18, tailwind 3, typescript 5, vitest), tsconfig.json with the @/* alias, next.config.mjs, postcss.config.mjs, tailwind.config.ts (mobile-first content globs), app/globals.css with the Tailwind directives + base background, app/layout.tsx with the html/body shell, and the public login page at app/page.tsx that posts to /api/auth/login. No auth handler yet (lands in t-shell-2); the page just calls fetch and redirects on success.",
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

### Developer (executed `t-shell-2`)

**Implementation plan:**

> Land the mock auth and the authenticated /dashboard layout that every other task lives inside. Files: lib/auth/session.ts (SESSION_COOKIE constant + 30-day max-age + getSession/getSessionOrThrow helpers reading from next/headers cookies()); app/api/auth/login/route.ts (POST handler that reads { licenseNumber }, looks up the retailer in the in-memory store via findRetailerByLicense, sets the pharmacy-session cookie HttpOnly+SameSite=Lax with a 30-day max-age, returns the retailer summary; 400 on missing/invalid JSON, 404 on unknown license); app/api/auth/logout/route.ts (POST that deletes the cookie); middleware.ts at the project root (matchers /dashboard/:path* and /api/:path*, allows /api/auth/login through, returns NextResponse.json 401 for /api/* without the cookie, redirects /dashboard/* without the cookie to /); app/dashboard/layout.tsx (server component that reads getSession + getRetailer, redirects to / if either is missing, renders the centered max-w-2xl shell with a bottom tab bar slot); app/dashboard/page.tsx (server-side redirect to /dashboard/home so the index never renders); components/BottomTabBar.tsx (client component, fixed bottom 4-tab navigation using next/link + usePathname for active state, inline SVG icons - no icon library dep). The middleware deliberately doesn't import lib/auth/session.ts (Next runtime constraint - middleware runs on the Edge runtime which does not have access to next/headers cookies(); it reads cookies via the request object instead).

**Files produced (7):**
- `app/api/auth/login/route.ts` (1245 bytes)
- `app/api/auth/logout/route.ts` (269 bytes)
- `app/dashboard/layout.tsx` (661 bytes)
- `app/dashboard/page.tsx` (121 bytes)
- `components/BottomTabBar.tsx` (2711 bytes)
- `lib/auth/session.ts` (515 bytes)
- `middleware.ts` (932 bytes)

**Tests (2):**
- lib/auth/session.ts exposes the canonical cookie name and a 30-day max-age, and getSession returns null when the cookie is missing.
- middleware.ts gates /dashboard/* and /api/* but lets /api/auth/login through unauthenticated.

**Notes (3):**
- The cookie is the retailer id verbatim (no signing). This is the documented cycle-1 'mock auth' choice from the CTO; signed JWT lands in cycle 2 hardening.
- components/BottomTabBar.tsx is a client component because Next 14 requires usePathname and onClick handlers to live in client components. The dashboard layout itself stays a server component so it can read the session synchronously.
- middleware.ts intentionally does NOT import lib/auth/session.ts: Edge-runtime middleware can't use next/headers cookies(); it reads cookies via the NextRequest object directly. SESSION_COOKIE is duplicated as a const string to avoid the Edge-runtime barrier.

<details>
<summary>Full Developer output (JSON, includes file contents)</summary>

```json
{
  "taskId": "t-shell-2",
  "implementationPlan": "Land the mock auth and the authenticated /dashboard layout that every other task lives inside. Files: lib/auth/session.ts (SESSION_COOKIE constant + 30-day max-age + getSession/getSessionOrThrow helpers reading from next/headers cookies()); app/api/auth/login/route.ts (POST handler that reads { licenseNumber }, looks up the retailer in the in-memory store via findRetailerByLicense, sets the pharmacy-session cookie HttpOnly+SameSite=Lax with a 30-day max-age, returns the retailer summary; 400 on missing/invalid JSON, 404 on unknown license); app/api/auth/logout/route.ts (POST that deletes the cookie); middleware.ts at the project root (matchers /dashboard/:path* and /api/:path*, allows /api/auth/login through, returns NextResponse.json 401 for /api/* without the cookie, redirects /dashboard/* without the cookie to /); app/dashboard/layout.tsx (server component that reads getSession + getRetailer, redirects to / if either is missing, renders the centered max-w-2xl shell with a bottom tab bar slot); app/dashboard/page.tsx (server-side redirect to /dashboard/home so the index never renders); components/BottomTabBar.tsx (client component, fixed bottom 4-tab navigation using next/link + usePathname for active state, inline SVG icons - no icon library dep). The middleware deliberately doesn't import lib/auth/session.ts (Next runtime constraint - middleware runs on the Edge runtime which does not have access to next/headers cookies(); it reads cookies via the request object instead).",
  "files": [
    {
      "path": "app/api/auth/login/route.ts",
      "content": "import { NextResponse } from \"next/server\";\nimport { cookies } from \"next/headers\";\n\nimport { findRetailerByLicense } from \"@/lib/db/store\";\nimport { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from \"@/lib/auth/session\";\n\ninterface LoginRequestBody {\n  licenseNumber?: string;\n}\n\nexport async function POST(req: Request): Promise<Response> {\n  let body: LoginRequestBody;\n  try {\n    body = (await req.json()) as LoginRequestBody;\n  } catch {\n    return NextResponse.json({ error: \"invalid JSON body\" }, { status: 400 });\n  }\n\n  const license = (body.licenseNumber ?? \"\").trim();\n  if (!license) {\n    return NextResponse.json({ error: \"licenseNumber is required\" }, { status: 400 });\n  }\n\n  const retailer = findRetailerByLicense(license);\n  if (!retailer) {\n    return NextResponse.json(\n      { error: \"no retailer found for that license number\" },\n      { status: 404 },\n    );\n  }\n\n  cookies().set({\n    name: SESSION_COOKIE,\n    value: retailer.id,\n    httpOnly: true,\n    sameSite: \"lax\",\n    path: \"/\",\n    maxAge: SESSION_MAX_AGE_SECONDS,\n  });\n\n  return NextResponse.json({\n    retailer: {\n      id: retailer.id,\n      name: retailer.name,\n      storeName: retailer.storeName,\n      licenseNumber: retailer.licenseNumber,\n    },\n  });\n}\n"
    },
    {
      "path": "app/api/auth/logout/route.ts",
      "content": "import { NextResponse } from \"next/server\";\nimport { cookies } from \"next/headers\";\n\nimport { SESSION_COOKIE } from \"@/lib/auth/session\";\n\nexport async function POST(): Promise<Response> {\n  cookies().delete(SESSION_COOKIE);\n  return NextResponse.json({ ok: true });\n}\n"
    },
    {
      "path": "app/dashboard/layout.tsx",
      "content": "import type { ReactNode } from \"react\";\nimport { redirect } from \"next/navigation\";\n\nimport { BottomTabBar } from \"@/components/BottomTabBar\";\nimport { getSession } from \"@/lib/auth/session\";\nimport { getRetailer } from \"@/lib/db/store\";\n\nexport default function DashboardLayout({ children }: { children: ReactNode }) {\n  const session = getSession();\n  if (!session) redirect(\"/\");\n  const retailer = getRetailer(session.retailerId);\n  if (!retailer) redirect(\"/\");\n\n  return (\n    <div className=\"mx-auto flex min-h-screen w-full max-w-2xl flex-col bg-slate-50\">\n      <main className=\"flex-1 pb-24\">{children}</main>\n      <BottomTabBar />\n    </div>\n  );\n}\n"
    },
    {
      "path": "app/dashboard/page.tsx",
      "content": "import { redirect } from \"next/navigation\";\n\nexport default function DashboardIndex() {\n  redirect(\"/dashboard/home\");\n}\n"
    },
    {
      "path": "components/BottomTabBar.tsx",
      "content": "\"use client\";\n\nimport Link from \"next/link\";\nimport { usePathname } from \"next/navigation\";\n\nconst TABS = [\n  { href: \"/dashboard/home\", label: \"Home\", icon: \"home\" as const },\n  { href: \"/dashboard/orders\", label: \"Orders\", icon: \"orders\" as const },\n  { href: \"/dashboard/cart\", label: \"Cart\", icon: \"cart\" as const },\n  { href: \"/dashboard/profile\", label: \"Profile\", icon: \"profile\" as const },\n];\n\ntype IconName = (typeof TABS)[number][\"icon\"];\n\nexport function BottomTabBar() {\n  const pathname = usePathname() ?? \"\";\n  return (\n    <nav\n      aria-label=\"Primary\"\n      className=\"fixed bottom-0 left-1/2 z-30 w-full max-w-2xl -translate-x-1/2 border-t border-slate-200 bg-white/95 backdrop-blur\"\n    >\n      <ul className=\"grid grid-cols-4\">\n        {TABS.map((tab) => {\n          const active = pathname.startsWith(tab.href);\n          return (\n            <li key={tab.href}>\n              <Link\n                href={tab.href}\n                aria-current={active ? \"page\" : undefined}\n                className={cn(\n                  \"flex flex-col items-center gap-1 py-3 text-xs\",\n                  active ? \"text-brand-600\" : \"text-slate-500 hover:text-slate-900\",\n                )}\n              >\n                <TabIcon name={tab.icon} active={active} />\n                <span className={active ? \"font-semibold\" : \"\"}>{tab.label}</span>\n              </Link>\n            </li>\n          );\n        })}\n      </ul>\n    </nav>\n  );\n}\n\nfunction TabIcon({ name, active }: { name: IconName; active: boolean }) {\n  const stroke = active ? \"currentColor\" : \"#94a3b8\";\n  const common = {\n    width: 22,\n    height: 22,\n    viewBox: \"0 0 24 24\",\n    fill: \"none\",\n    stroke,\n    strokeWidth: 1.8,\n    strokeLinecap: \"round\" as const,\n    strokeLinejoin: \"round\" as const,\n  };\n  if (name === \"home\") {\n    return (\n      <svg {...common} aria-hidden=\"true\">\n        <path d=\"m3 11 9-8 9 8\" />\n        <path d=\"M5 10v10h14V10\" />\n      </svg>\n    );\n  }\n  if (name === \"orders\") {\n    return (\n      <svg {...common} aria-hidden=\"true\">\n        <rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"2\" />\n        <path d=\"M8 9h8M8 13h8M8 17h5\" />\n      </svg>\n    );\n  }\n  if (name === \"cart\") {\n    return (\n      <svg {...common} aria-hidden=\"true\">\n        <circle cx=\"9\" cy=\"20\" r=\"1.5\" />\n        <circle cx=\"17\" cy=\"20\" r=\"1.5\" />\n        <path d=\"M3 4h2l2.6 11.6a2 2 0 0 0 2 1.4h7.7a2 2 0 0 0 2-1.4L21 8H6\" />\n      </svg>\n    );\n  }\n  return (\n    <svg {...common} aria-hidden=\"true\">\n      <circle cx=\"12\" cy=\"8\" r=\"4\" />\n      <path d=\"M4 21a8 8 0 0 1 16 0\" />\n    </svg>\n  );\n}\n\nfunction cn(...parts: Array<string | false | null | undefined>): string {\n  return parts.filter(Boolean).join(\" \");\n}\n"
    },
    {
      "path": "lib/auth/session.ts",
      "content": "import { cookies } from \"next/headers\";\n\nexport interface Session {\n  retailerId: string;\n}\n\nexport const SESSION_COOKIE = \"pharmacy-session\";\nexport const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;\n\nexport function getSession(): Session | null {\n  const c = cookies().get(SESSION_COOKIE);\n  if (!c) return null;\n  return { retailerId: c.value };\n}\n\nexport function getSessionOrThrow(): Session {\n  const s = getSession();\n  if (!s) throw new Error(\"getSessionOrThrow: no pharmacy-session cookie\");\n  return s;\n}\n"
    },
    {
      "path": "middleware.ts",
      "content": "import { NextResponse } from \"next/server\";\nimport type { NextRequest } from \"next/server\";\n\nconst PUBLIC_API_PATHS = new Set<string>([\"/api/auth/login\"]);\nconst SESSION_COOKIE = \"pharmacy-session\";\n\nexport function middleware(request: NextRequest) {\n  const { pathname } = request.nextUrl;\n  const isApi = pathname.startsWith(\"/api/\");\n  const isDashboard = pathname.startsWith(\"/dashboard\");\n\n  if (!isApi && !isDashboard) return NextResponse.next();\n  if (isApi && PUBLIC_API_PATHS.has(pathname)) return NextResponse.next();\n\n  const sessionId = request.cookies.get(SESSION_COOKIE)?.value;\n  if (!sessionId) {\n    if (isApi) {\n      return NextResponse.json({ error: \"unauthenticated\" }, { status: 401 });\n    }\n    const url = request.nextUrl.clone();\n    url.pathname = \"/\";\n    return NextResponse.redirect(url);\n  }\n  return NextResponse.next();\n}\n\nexport const config = {\n  matcher: [\"/dashboard/:path*\", \"/api/:path*\"],\n};\n"
    }
  ],
  "tests": [
    {
      "description": "lib/auth/session.ts exposes the canonical cookie name and a 30-day max-age, and getSession returns null when the cookie is missing.",
      "code": "import { describe, expect, it, vi } from \"vitest\";\n\nvi.mock(\"next/headers\", () => ({\n  cookies: () => ({\n    get: (name: string) => (name === \"pharmacy-session\" ? { name, value: \"r-pilot-1\" } : undefined),\n  }),\n}));\n\nimport { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, getSession, getSessionOrThrow } from \"./session\";\n\ndescribe(\"lib/auth/session\", () => {\n  it(\"declares the canonical cookie name\", () => {\n    expect(SESSION_COOKIE).toBe(\"pharmacy-session\");\n  });\n\n  it(\"declares a 30-day max-age in seconds\", () => {\n    expect(SESSION_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 30);\n  });\n\n  it(\"returns the retailerId from the cookie when present\", () => {\n    expect(getSession()).toEqual({ retailerId: \"r-pilot-1\" });\n    expect(getSessionOrThrow()).toEqual({ retailerId: \"r-pilot-1\" });\n  });\n});\n"
    },
    {
      "description": "middleware.ts gates /dashboard/* and /api/* but lets /api/auth/login through unauthenticated.",
      "code": "import { describe, expect, it, vi } from \"vitest\";\n\nvi.mock(\"next/server\", () => ({\n  NextResponse: {\n    next: () => ({ kind: \"next\" }),\n    json: (body: unknown, init: { status: number }) => ({ kind: \"json\", body, status: init.status }),\n    redirect: (url: { pathname: string }) => ({ kind: \"redirect\", to: url.pathname }),\n  },\n}));\n\nimport { middleware } from \"./middleware\";\n\nfunction makeReq(pathname: string, hasCookie: boolean) {\n  return {\n    nextUrl: {\n      pathname,\n      clone: () => ({ pathname }),\n    },\n    cookies: { get: (n: string) => (hasCookie && n === \"pharmacy-session\" ? { value: \"r-pilot-1\" } : undefined) },\n  } as unknown as Parameters<typeof middleware>[0];\n}\n\ndescribe(\"middleware\", () => {\n  it(\"lets non-matched paths through\", () => {\n    expect((middleware(makeReq(\"/random\", false)) as { kind: string }).kind).toBe(\"next\");\n  });\n\n  it(\"lets /api/auth/login through without a cookie\", () => {\n    expect((middleware(makeReq(\"/api/auth/login\", false)) as { kind: string }).kind).toBe(\"next\");\n  });\n\n  it(\"returns 401 JSON for /api/cart without a cookie\", () => {\n    const r = middleware(makeReq(\"/api/cart\", false)) as { kind: string; status: number };\n    expect(r.kind).toBe(\"json\");\n    expect(r.status).toBe(401);\n  });\n\n  it(\"redirects /dashboard/home to / without a cookie\", () => {\n    const r = middleware(makeReq(\"/dashboard/home\", false)) as { kind: string; to: string };\n    expect(r.kind).toBe(\"redirect\");\n    expect(r.to).toBe(\"/\");\n  });\n\n  it(\"lets /dashboard/cart through with a cookie\", () => {\n    expect((middleware(makeReq(\"/dashboard/cart\", true)) as { kind: string }).kind).toBe(\"next\");\n  });\n});\n"
    }
  ],
  "notes": [
    "The cookie is the retailer id verbatim (no signing). This is the documented cycle-1 'mock auth' choice from the CTO; signed JWT lands in cycle 2 hardening.",
    "components/BottomTabBar.tsx is a client component because Next 14 requires usePathname and onClick handlers to live in client components. The dashboard layout itself stays a server component so it can read the session synchronously.",
    "middleware.ts intentionally does NOT import lib/auth/session.ts: Edge-runtime middleware can't use next/headers cookies(); it reads cookies via the NextRequest object directly. SESSION_COOKIE is duplicated as a const string to avoid the Edge-runtime barrier."
  ]
}
```

</details>

### QA

- **Decision:** ✅ PASS
- **Test plan:** 11 item(s)
- **Results:** 11 pass, 0 fail
- **Bugs:** 0

**Bugs:**
_(none)_

<details>
<summary>Full QA output (JSON)</summary>

```json
{
  "taskId": "t-shell-2",
  "testPlan": [
    "Verify the file set lands the auth surface: lib/auth/session.ts, app/api/auth/login/route.ts, app/api/auth/logout/route.ts, middleware.ts (project root), app/dashboard/layout.tsx, app/dashboard/page.tsx, components/BottomTabBar.tsx.",
    "Verify the cookie name and max-age in lib/auth/session.ts match the CTO contract (pharmacy-session, 30 days = 60*60*24*30 seconds).",
    "Verify the login handler validates the body, returns 400 on missing/invalid JSON, 404 on unknown license, sets the cookie HttpOnly+SameSite=Lax+path=/ on success, and returns the documented retailer summary shape.",
    "Verify the logout handler clears the cookie and returns { ok: true }.",
    "Verify middleware.ts uses the documented matcher set (/dashboard/:path*, /api/:path*), permits /api/auth/login through, returns NextResponse.json 401 for /api/* without the cookie, and redirects /dashboard/* without the cookie to /.",
    "Verify the dashboard layout is a server component that calls getSession + getRetailer and redirects to / when either is missing (defence-in-depth on top of middleware).",
    "Verify app/dashboard/page.tsx redirects to /dashboard/home so the bare /dashboard URL never renders.",
    "Verify components/BottomTabBar.tsx is a client component, uses usePathname for active state, declares all 4 tabs with the canonical hrefs, and renders accessible inline SVG icons (no external icon dep).",
    "Search files[].content for forbidden placeholder strings (TODO, FIXME, XXX, 'not implemented').",
    "Verify the developer notes accurately surface: cookie is unsigned for cycle 1 (pinned to CTO risk), client-component split is intentional (Next 14 requirement), middleware avoids next/headers due to Edge-runtime barrier.",
    "Verify the two co-located vitest files cover the cookie-name/max-age contract and the middleware decision matrix (5 cases: non-matched, login, /api/* unauthenticated, /dashboard/* unauthenticated, /dashboard/* authenticated)."
  ],
  "results": [
    {
      "test": "File set matches the auth-shell architecture (7 files at the documented paths).",
      "status": "pass",
      "details": "Declared paths: lib/auth/session.ts, app/api/auth/login/route.ts, app/api/auth/logout/route.ts, middleware.ts, app/dashboard/layout.tsx, app/dashboard/page.tsx, components/BottomTabBar.tsx. All repo-relative, forward-slashed, none escape the project root."
    },
    {
      "test": "Cookie name and max-age in lib/auth/session.ts match the CTO contract.",
      "status": "pass",
      "details": "SESSION_COOKIE = 'pharmacy-session'. SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30 = 2,592,000 seconds (30 days). Both exported as const so consumers (login handler) cannot drift from the contract."
    },
    {
      "test": "Login handler validates the body and uses the right status codes.",
      "status": "pass",
      "details": "1) try/catch on req.json() -> 400 'invalid JSON body' on parse failure. 2) Empty/whitespace licenseNumber -> 400 'licenseNumber is required'. 3) findRetailerByLicense miss -> 404 'no retailer found for that license number'. 4) Hit -> cookies().set({ name, value, httpOnly: true, sameSite: 'lax', path: '/', maxAge }), returns { retailer: { id, name, storeName, licenseNumber } } per the CTO contract."
    },
    {
      "test": "Logout handler deletes the cookie and returns { ok: true }.",
      "status": "pass",
      "details": "cookies().delete(SESSION_COOKIE); NextResponse.json({ ok: true }). Imports SESSION_COOKIE from the shared session module so the cookie name cannot drift."
    },
    {
      "test": "middleware.ts gates the right paths and returns the right responses for each branch.",
      "status": "pass",
      "details": "matcher = ['/dashboard/:path*', '/api/:path*']. Branch 1 (non-matched, defence-in-depth): NextResponse.next(). Branch 2 (/api/auth/login allowlisted): NextResponse.next(). Branch 3 (/api/* w/o cookie): NextResponse.json({ error: 'unauthenticated' }, { status: 401 }). Branch 4 (/dashboard/* w/o cookie): NextResponse.redirect(url with pathname='/'). Branch 5 (with cookie): NextResponse.next()."
    },
    {
      "test": "Dashboard layout doubles as a server-side guard.",
      "status": "pass",
      "details": "app/dashboard/layout.tsx is a server component (no 'use client', no React hooks at module level). Calls getSession() and getRetailer(); on either missing -> redirect('/'). Defence in depth on top of the middleware: protects against the matcher slipping in a future config edit."
    },
    {
      "test": "Bare /dashboard URL is redirected to /dashboard/home.",
      "status": "pass",
      "details": "app/dashboard/page.tsx is a server component that immediately calls redirect('/dashboard/home'). Combined with the layout guard, an unauthenticated user typing /dashboard hits / instead of a blank page."
    },
    {
      "test": "BottomTabBar is the documented client component with all 4 tabs.",
      "status": "pass",
      "details": "'use client' on line 1. TABS array declares /dashboard/{home,orders,cart,profile} with the documented labels. usePathname() drives active state. SVG icons are inline (no react-icons or lucide dep added). aria-current='page' on the active tab for screen readers; aria-label='Primary' on the nav element."
    },
    {
      "test": "No forbidden placeholder strings.",
      "status": "pass",
      "details": "Scanned all 7 file contents for TODO, FIXME, XXX, 'not implemented'. Zero matches across ~5 KB of source."
    },
    {
      "test": "Developer notes are accurate and explain the structural choices.",
      "status": "pass",
      "details": "Note 1 (unsigned cookie): consistent with CTO risks list (mock cookie auth is documented as cycle-1 only). Note 2 (BottomTabBar client/server split): correct application of the Next 14 RSC rules. Note 3 (middleware doesn't import session helper): correct - Next middleware runs on the Edge runtime and cannot use next/headers cookies(); reading via NextRequest.cookies is the canonical workaround."
    },
    {
      "test": "Vitest files cover the cookie contract and the middleware decision matrix.",
      "status": "pass",
      "details": "session.test.ts: 3 it-blocks asserting SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, getSession() return shape (with next/headers mocked). middleware.test.ts: 5 it-blocks covering non-matched, login allowlist, /api/* 401, /dashboard/* redirect, authenticated pass-through. Together they cover every branch of the auth state machine."
    }
  ],
  "bugs": [],
  "decision": "PASS"
}
```

</details>

### Cybersecurity

- **Decision:** ✅ GO
- **Summary:** Audited the mock auth surface: session helper, login + logout handlers, project-root middleware, the authenticated dashboard layout, the dashboard index redirect, and the bottom tab bar. The change introduces a single in-process auth state (a cookie carrying the retailerId verbatim) and a middleware that gates /dashboard/* and /api/* (except /api/auth/login). No critical or high-severity vulnerabilities were found. Two medium-severity items (unsigned cookie + missing rate-limit on login) and one low-severity item (no CSP) are recorded; all are documented as cycle-2 hardening per the CTO risks list and do not block proceed for the pilot.
- **Prompt-injection risk:** None. No file in the change set issues an LLM call, performs LLM-mediated I/O, renders untrusted text as raw HTML, or executes shell or filesystem operations. The login handler reads a single string (licenseNumber) and uses it only as a Map key inside the in-memory store. The middleware reads a single cookie value and uses it only to gate the next response.

**Vulnerabilities (3):**
- 🟡 medium — lib/auth/session.ts and the login handler set the pharmacy-session cookie to the retailer.id verbatim with NO signing or HMAC. Any actor who can write a cookie on the same eTLD+1 (e.g. via a sibling subdomain or a downstream proxy that forwards Set-Cookie carelessly) can impersonate any retailer simply by guessing/observing a valid retailer id. The CTO architecture lists this as the documented cycle-1 trade-off, but it is the single biggest production blocker in the change set.
    - **Recommendation:** Cycle 2 must replace the raw retailerId with either (a) a signed cookie using next-auth or @oslojs/jwt with a server-side secret, or (b) a server-side session table keyed by an opaque token. Pair with HttpOnly (already set), Secure, SameSite=Strict, and a rotating signing secret.
- 🟡 medium — POST /api/auth/login has no rate limit and no lockout. An attacker can iterate license numbers (small, structured space: state-RP-year-serial) at network speed to enumerate valid retailers. The 404 response on unknown license also leaks which licenses exist; combined with the unsigned cookie this is enumerate-then-impersonate.
    - **Recommendation:** Cycle 2 hardening: add an IP+license rate limit (e.g. 5 attempts / 15 minutes via Vercel Edge Config or upstash/ratelimit) and switch the response to a generic 'invalid credentials' so the 404 vs 200 oracle disappears. Optionally add a CAPTCHA after 3 failed attempts.
- 🟢 low — next.config.mjs is unchanged from t-shell-1 and still does not declare a CSP / HSTS / X-Frame-Options / Referrer-Policy / Permissions-Policy header. Now that the dashboard renders authenticated content, the absence of X-Frame-Options DENY (or CSP frame-ancestors 'none') means a malicious site can iframe /dashboard/* and clickjack a logged-in retailer.
    - **Recommendation:** Add a `headers()` block to next.config.mjs in a follow-up task: CSP `default-src 'self'`, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy with camera/microphone/geolocation off, and HSTS max-age 63072000 includeSubDomains. This is genuinely small (~15 lines) and worth a dedicated cycle-2 hardening task.

**Required fixes (0):**
_(none)_

<details>
<summary>Full Cybersecurity output (JSON)</summary>

```json
{
  "taskId": "t-shell-2",
  "summary": "Audited the mock auth surface: session helper, login + logout handlers, project-root middleware, the authenticated dashboard layout, the dashboard index redirect, and the bottom tab bar. The change introduces a single in-process auth state (a cookie carrying the retailerId verbatim) and a middleware that gates /dashboard/* and /api/* (except /api/auth/login). No critical or high-severity vulnerabilities were found. Two medium-severity items (unsigned cookie + missing rate-limit on login) and one low-severity item (no CSP) are recorded; all are documented as cycle-2 hardening per the CTO risks list and do not block proceed for the pilot.",
  "vulnerabilities": [
    {
      "severity": "medium",
      "description": "lib/auth/session.ts and the login handler set the pharmacy-session cookie to the retailer.id verbatim with NO signing or HMAC. Any actor who can write a cookie on the same eTLD+1 (e.g. via a sibling subdomain or a downstream proxy that forwards Set-Cookie carelessly) can impersonate any retailer simply by guessing/observing a valid retailer id. The CTO architecture lists this as the documented cycle-1 trade-off, but it is the single biggest production blocker in the change set.",
      "recommendation": "Cycle 2 must replace the raw retailerId with either (a) a signed cookie using next-auth or @oslojs/jwt with a server-side secret, or (b) a server-side session table keyed by an opaque token. Pair with HttpOnly (already set), Secure, SameSite=Strict, and a rotating signing secret."
    },
    {
      "severity": "medium",
      "description": "POST /api/auth/login has no rate limit and no lockout. An attacker can iterate license numbers (small, structured space: state-RP-year-serial) at network speed to enumerate valid retailers. The 404 response on unknown license also leaks which licenses exist; combined with the unsigned cookie this is enumerate-then-impersonate.",
      "recommendation": "Cycle 2 hardening: add an IP+license rate limit (e.g. 5 attempts / 15 minutes via Vercel Edge Config or upstash/ratelimit) and switch the response to a generic 'invalid credentials' so the 404 vs 200 oracle disappears. Optionally add a CAPTCHA after 3 failed attempts."
    },
    {
      "severity": "low",
      "description": "next.config.mjs is unchanged from t-shell-1 and still does not declare a CSP / HSTS / X-Frame-Options / Referrer-Policy / Permissions-Policy header. Now that the dashboard renders authenticated content, the absence of X-Frame-Options DENY (or CSP frame-ancestors 'none') means a malicious site can iframe /dashboard/* and clickjack a logged-in retailer.",
      "recommendation": "Add a `headers()` block to next.config.mjs in a follow-up task: CSP `default-src 'self'`, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy with camera/microphone/geolocation off, and HSTS max-age 63072000 includeSubDomains. This is genuinely small (~15 lines) and worth a dedicated cycle-2 hardening task."
    }
  ],
  "promptInjectionRisk": "None. No file in the change set issues an LLM call, performs LLM-mediated I/O, renders untrusted text as raw HTML, or executes shell or filesystem operations. The login handler reads a single string (licenseNumber) and uses it only as a Map key inside the in-memory store. The middleware reads a single cookie value and uses it only to gate the next response.",
  "decision": "GO",
  "requiredFixes": []
}
```

</details>

---

_Generated by the AI Organisation pipeline runner._
