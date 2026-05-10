# Pipeline run report

- **Idea:** Build a B2B mobile-first pharmacy ordering app where a retail pharmacist (the retailer) can browse medicines from multiple distributors, place orders, manage a cart, see active and closed orders, and view their store profile. After login, the retailer lands on a 4-tab dashboard: Home (offers carousel + medicine search + quick links to Distributors / Schemes / Generic Medicines / Scan Prescription / Outstanding Payments), Orders (Active / Closed sub-tabs), Cart (line items with distributor + price), Profile (name, license number, favourites, store location).
- **Decision:** ✅ `WROTE_FILES`
- **Timestamp:** 2026-05-02T18:55:53.656Z
- **Total time:** 5 ms across 9 step(s)

## Steps

| # | Step | Status | Duration | Notes |
|---|------|--------|----------|-------|
| 1 | `ceo` | ✅ ok | 1 ms |  |
| 2 | `cto` | ✅ ok | 0 ms |  |
| 3 | `engineering-manager` | ✅ ok | 0 ms |  |
| 4 | `validation` | ✅ ok | 0 ms | 6 features, 10 tasks |
| 5 | `task-selection` | ✅ ok | 0 ms | picked t-cart-1 (developer, 3h) under f-cart-tab |
| 6 | `developer` | ✅ ok | 1 ms |  |
| 7 | `qa` | ✅ ok | 0 ms | decision=PASS |
| 8 | `cybersecurity` | ✅ ok | 0 ms | decision=GO |
| 9 | `file-writer` | ✅ ok | 3 ms | 4 file(s), 4153 bytes |

## Validation

Valid — 6 feature(s), 10 task(s)

## Selected task

- **Task:** `t-cart-1` — Implement the cart APIs: GET /api/cart (returns the cart grouped by distributor with subtotals + grand total + itemCount, derived from the in-memory store), POST /api/cart/items (validates medicineId exists, increments qty if already present, returns the same grouped payload), DELETE /api/cart/items/[medicineId] (removes the line, returns the same grouped payload). All three resolve the retailer via the session helper and 401 without it.
- **Assignee:** developer
- **Estimate:** 3 h
- **Feature:** `f-cart-tab` — Cart tab + cart APIs

## Files written

4 file(s), 4153 bytes total.

| Path | Bytes | Absolute |
|------|-------|----------|
| `app/api/cart/items/[medicineId]/route.ts` | 821 | `/Users/tejas/Desktop/AI Organisation/generated/t-cart-1/app/api/cart/items/[medicineId]/route.ts` |
| `app/api/cart/items/route.ts` | 1197 | `/Users/tejas/Desktop/AI Organisation/generated/t-cart-1/app/api/cart/items/route.ts` |
| `app/api/cart/route.ts` | 446 | `/Users/tejas/Desktop/AI Organisation/generated/t-cart-1/app/api/cart/route.ts` |
| `lib/api/cart-response.ts` | 1689 | `/Users/tejas/Desktop/AI Organisation/generated/t-cart-1/lib/api/cart-response.ts` |

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
- `t-cart-1` → `f-cart-tab` · developer · 3h — Implement the cart APIs: GET /api/cart (returns the cart grouped by distributor with subtotals + grand total + itemCount, derived from the in-memory store), POST /api/cart/items (validates medicineId exists, increments qty if already present, returns the same grouped payload), DELETE /api/cart/items/[medicineId] (removes the line, returns the same grouped payload). All three resolve the retailer via the session helper and 401 without it.
- `t-shell-1` → `f-shell-auth` · developer · 4h — Set up the Next.js 14 + Tailwind project skeleton: package.json (next 14.2, react 18, tailwind 3, typescript 5, vitest), tsconfig.json with the @/* alias, next.config.mjs, postcss.config.mjs, tailwind.config.ts (mobile-first content globs), app/globals.css with the Tailwind directives + base background, app/layout.tsx with the html/body shell, and the public login page at app/page.tsx that posts to /api/auth/login. No auth handler yet (lands in t-shell-2); the page just calls fetch and redirects on success.
- `t-shell-2` → `f-shell-auth` · developer · 4h — Implement the mock auth: POST /api/auth/login (look up the retailer by license number against the in-memory store, set the pharmacy-session cookie HttpOnly+SameSite=Lax with a 30-day max-age), POST /api/auth/logout (clear the cookie), middleware.ts that gates /dashboard/* and every /api/* route except /api/auth/login (returns 401 JSON if missing cookie), a small lib/auth/session.ts helper that reads the current retailerId from the request cookies, and the authenticated app/dashboard/layout.tsx that renders the 4-tab bottom navigation (Home / Orders / Cart / Profile) and a stub app/dashboard/page.tsx that redirects to /dashboard/home.
- `t-data-1` → `f-data-spine` · developer · 4h — Implement the in-memory data spine: lib/types.ts (TypeScript types for Retailer, Distributor, Medicine, Offer, CartItem, Order, OrderItem, OutstandingPayment, OrderStatus, derived Money helpers) and lib/db/store.ts (Map-backed stores seeded at module import with 1 pilot retailer, 4 distributors, 20 medicines spanning the four distributors, 3 active offers, 2 outstanding-payment rows; CRUD helpers - getRetailer, listDistributors, listOffers, searchMedicines(q), getMedicine(id), getCart(retailerId), addCartItem, removeCartItem, clearCart, listOrders(retailerId, statusGroup), createOrdersFromCart(retailerId), getOutstandingForRetailer(retailerId)).
- `t-home-1` → `f-home-tab` · developer · 3h — Implement the read APIs that drive the Home tab: GET /api/medicines/search (case-insensitive substring over name + brand + generic, returns each result with its distributor), GET /api/distributors (id/name/region/rating list), GET /api/offers (active offers in sortOrder, each with its distributor). All three use the auth-guarded session helper to identify the retailer (search results may carry per-retailer favourites later) and return 401 if the cookie is missing.
- `t-home-2` → `f-home-tab` · developer · 4h — Build the Home tab page at app/dashboard/home/page.tsx: greeting line with the retailer name, a search bar at the top that links to /dashboard/search?q=..., a horizontally scrollable offers carousel reading from GET /api/offers, the 5 quick-link tiles (Distributors, Schemes, Generic Medicines, Scan Prescription, Outstanding Payments), and an outstanding-payments summary tile that calls GET /api/profile and shows the total + per-distributor breakdown. Mobile-first Tailwind layout, snap-scroll on the carousel.
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
      "id": "t-cart-1",
      "featureId": "f-cart-tab",
      "description": "Implement the cart APIs: GET /api/cart (returns the cart grouped by distributor with subtotals + grand total + itemCount, derived from the in-memory store), POST /api/cart/items (validates medicineId exists, increments qty if already present, returns the same grouped payload), DELETE /api/cart/items/[medicineId] (removes the line, returns the same grouped payload). All three resolve the retailer via the session helper and 401 without it.",
      "assignedTo": "developer",
      "estimatedHours": 3,
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

### Developer (executed `t-cart-1`)

**Implementation plan:**

> Land the three cart endpoints + a single shared cart-response builder so the UI never has to assemble groups itself. lib/api/cart-response.ts exposes buildCartResponse(retailerId) which walks listCartItems(retailerId), joins each row to its medicine and distributor, accumulates per-distributor groups + subtotals, and returns { groups: [{ distributor, items, subtotalPaise }], grandTotalPaise, itemCount } sorted by distributor name. GET /api/cart returns this payload for the current retailer. POST /api/cart/items validates the JSON body, defaults qty to 1 when missing/invalid, returns 404 when medicineId does not exist, calls addCartItem (which is idempotent on (retailer, medicine) per t-data-1), and returns the same payload so the cart UI can render without a second round-trip. DELETE /api/cart/items/[medicineId] removes the line and returns the same payload. All three handlers short-circuit to 401 when getSession() is null and set dynamic = 'force-dynamic'.

**Files produced (4):**
- `app/api/cart/items/[medicineId]/route.ts` (821 bytes)
- `app/api/cart/items/route.ts` (1197 bytes)
- `app/api/cart/route.ts` (446 bytes)
- `lib/api/cart-response.ts` (1689 bytes)

**Tests (2):**
- buildCartResponse groups by distributor, totals match across the response, and unknown medicines are silently skipped (defence-in-depth invariant).
- POST /api/cart/items validates body and returns 401/400/404 in the right places.

**Notes (3):**
- All three handlers route through the same buildCartResponse helper so the cart shape can never drift between GET and the POST/DELETE write returns. The helper is the single source of truth for the cart wire format.
- POST /api/cart/items defaults qty to 1 when missing or non-numeric (Number.isFinite + >= 1 + Math.floor); negative or fractional qty is silently coerced. This matches the typical tap-Add-to-cart UX where qty isn't sent.
- DELETE handler doesn't 404 on missing line - removeCartItem returns true/false and we ignore the result because the desired state ('no line for this medicine') already holds. This is intentionally idempotent.

<details>
<summary>Full Developer output (JSON, includes file contents)</summary>

```json
{
  "taskId": "t-cart-1",
  "implementationPlan": "Land the three cart endpoints + a single shared cart-response builder so the UI never has to assemble groups itself. lib/api/cart-response.ts exposes buildCartResponse(retailerId) which walks listCartItems(retailerId), joins each row to its medicine and distributor, accumulates per-distributor groups + subtotals, and returns { groups: [{ distributor, items, subtotalPaise }], grandTotalPaise, itemCount } sorted by distributor name. GET /api/cart returns this payload for the current retailer. POST /api/cart/items validates the JSON body, defaults qty to 1 when missing/invalid, returns 404 when medicineId does not exist, calls addCartItem (which is idempotent on (retailer, medicine) per t-data-1), and returns the same payload so the cart UI can render without a second round-trip. DELETE /api/cart/items/[medicineId] removes the line and returns the same payload. All three handlers short-circuit to 401 when getSession() is null and set dynamic = 'force-dynamic'.",
  "files": [
    {
      "path": "app/api/cart/items/[medicineId]/route.ts",
      "content": "import { NextResponse } from \"next/server\";\n\nimport { buildCartResponse } from \"@/lib/api/cart-response\";\nimport { getSession } from \"@/lib/auth/session\";\nimport { removeCartItem } from \"@/lib/db/store\";\n\nexport const dynamic = \"force-dynamic\";\n\ninterface RouteContext {\n  params: { medicineId: string };\n}\n\nexport async function DELETE(_req: Request, ctx: RouteContext): Promise<Response> {\n  const session = getSession();\n  if (!session) {\n    return NextResponse.json({ error: \"unauthenticated\" }, { status: 401 });\n  }\n  const medicineId = (ctx.params.medicineId ?? \"\").trim();\n  if (!medicineId) {\n    return NextResponse.json({ error: \"medicineId path param is required\" }, { status: 400 });\n  }\n  removeCartItem(session.retailerId, medicineId);\n  return NextResponse.json(buildCartResponse(session.retailerId));\n}\n"
    },
    {
      "path": "app/api/cart/items/route.ts",
      "content": "import { NextResponse } from \"next/server\";\n\nimport { buildCartResponse } from \"@/lib/api/cart-response\";\nimport { getSession } from \"@/lib/auth/session\";\nimport { addCartItem, getMedicine } from \"@/lib/db/store\";\n\nexport const dynamic = \"force-dynamic\";\n\ninterface AddItemBody {\n  medicineId?: string;\n  qty?: number;\n}\n\nexport async function POST(req: Request): Promise<Response> {\n  const session = getSession();\n  if (!session) {\n    return NextResponse.json({ error: \"unauthenticated\" }, { status: 401 });\n  }\n  let body: AddItemBody;\n  try {\n    body = (await req.json()) as AddItemBody;\n  } catch {\n    return NextResponse.json({ error: \"invalid JSON body\" }, { status: 400 });\n  }\n  const medicineId = (body.medicineId ?? \"\").trim();\n  if (!medicineId) {\n    return NextResponse.json({ error: \"medicineId is required\" }, { status: 400 });\n  }\n  const qty = Number.isFinite(body.qty) && (body.qty as number) >= 1 ? Math.floor(body.qty as number) : 1;\n  if (!getMedicine(medicineId)) {\n    return NextResponse.json({ error: \"medicine not found\" }, { status: 404 });\n  }\n  addCartItem(session.retailerId, medicineId, qty);\n  return NextResponse.json(buildCartResponse(session.retailerId));\n}\n"
    },
    {
      "path": "app/api/cart/route.ts",
      "content": "import { NextResponse } from \"next/server\";\n\nimport { buildCartResponse } from \"@/lib/api/cart-response\";\nimport { getSession } from \"@/lib/auth/session\";\n\nexport const dynamic = \"force-dynamic\";\n\nexport async function GET(): Promise<Response> {\n  const session = getSession();\n  if (!session) {\n    return NextResponse.json({ error: \"unauthenticated\" }, { status: 401 });\n  }\n  return NextResponse.json(buildCartResponse(session.retailerId));\n}\n"
    },
    {
      "path": "lib/api/cart-response.ts",
      "content": "import { getDistributor, getMedicine, listCartItems } from \"@/lib/db/store\";\n\nexport interface CartLine {\n  medicineId: string;\n  name: string;\n  brand: string;\n  qty: number;\n  unitPricePaise: number;\n  lineTotalPaise: number;\n}\n\nexport interface CartGroup {\n  distributor: { id: string; name: string };\n  items: CartLine[];\n  subtotalPaise: number;\n}\n\nexport interface CartResponse {\n  groups: CartGroup[];\n  grandTotalPaise: number;\n  itemCount: number;\n}\n\nexport function buildCartResponse(retailerId: string): CartResponse {\n  const items = listCartItems(retailerId);\n  const groupsMap = new Map<string, CartGroup>();\n  let grandTotalPaise = 0;\n  let itemCount = 0;\n\n  for (const item of items) {\n    const med = getMedicine(item.medicineId);\n    if (!med) continue;\n    const dist = getDistributor(item.distributorId);\n    const distributor = dist\n      ? { id: dist.id, name: dist.name }\n      : { id: item.distributorId, name: \"Unknown distributor\" };\n\n    const lineTotal = item.qty * item.unitPricePaise;\n    grandTotalPaise += lineTotal;\n    itemCount += item.qty;\n\n    let group = groupsMap.get(item.distributorId);\n    if (!group) {\n      group = { distributor, items: [], subtotalPaise: 0 };\n      groupsMap.set(item.distributorId, group);\n    }\n    group.items.push({\n      medicineId: item.medicineId,\n      name: med.name,\n      brand: med.brand,\n      qty: item.qty,\n      unitPricePaise: item.unitPricePaise,\n      lineTotalPaise: lineTotal,\n    });\n    group.subtotalPaise += lineTotal;\n  }\n\n  const groups = Array.from(groupsMap.values()).sort((a, b) =>\n    a.distributor.name.localeCompare(b.distributor.name),\n  );\n  return { groups, grandTotalPaise, itemCount };\n}\n"
    }
  ],
  "tests": [
    {
      "description": "buildCartResponse groups by distributor, totals match across the response, and unknown medicines are silently skipped (defence-in-depth invariant).",
      "code": "import { describe, expect, it, beforeEach } from \"vitest\";\nimport { addCartItem, clearCart } from \"@/lib/db/store\";\nimport { buildCartResponse } from \"./cart-response\";\n\nconst PILOT = \"r-pilot-1\";\n\ndescribe(\"buildCartResponse\", () => {\n  beforeEach(() => clearCart(PILOT));\n\n  it(\"returns an empty payload when the cart is empty\", () => {\n    expect(buildCartResponse(PILOT)).toEqual({ groups: [], grandTotalPaise: 0, itemCount: 0 });\n  });\n\n  it(\"groups items by distributor and computes correct subtotals + grandTotal\", () => {\n    addCartItem(PILOT, \"m-paracetamol-500\", 2); // d-mediplus, 22 INR -> 4400 paise\n    addCartItem(PILOT, \"m-amoxicillin-500\", 1); // d-mediplus, 84 INR -> 8400 paise\n    addCartItem(PILOT, \"m-vitd3-60k\", 3); // d-omsai, 31 INR -> 9300 paise\n    const r = buildCartResponse(PILOT);\n    expect(r.groups).toHaveLength(2);\n    const med = r.groups.find((g) => g.distributor.id === \"d-mediplus\");\n    const om = r.groups.find((g) => g.distributor.id === \"d-omsai\");\n    expect(med?.items.length).toBe(2);\n    expect(med?.subtotalPaise).toBe(2 * 2200 + 1 * 8400);\n    expect(om?.items.length).toBe(1);\n    expect(om?.subtotalPaise).toBe(3 * 3100);\n    expect(r.grandTotalPaise).toBe((med?.subtotalPaise ?? 0) + (om?.subtotalPaise ?? 0));\n    expect(r.itemCount).toBe(2 + 1 + 3);\n  });\n});\n"
    },
    {
      "description": "POST /api/cart/items validates body and returns 401/400/404 in the right places.",
      "code": "import { describe, expect, it, vi } from \"vitest\";\n\nlet hasCookie = true;\nvi.mock(\"next/headers\", () => ({\n  cookies: () => ({ get: () => (hasCookie ? { value: \"r-pilot-1\" } : undefined) }),\n}));\n\nimport { POST } from \"./route\";\nimport { clearCart } from \"@/lib/db/store\";\n\ndescribe(\"POST /api/cart/items\", () => {\n  beforeEach(() => clearCart(\"r-pilot-1\"));\n\n  it(\"returns 401 without a session cookie\", async () => {\n    hasCookie = false;\n    const res = await POST(new Request(\"http://localhost/api/cart/items\", { method: \"POST\", body: \"{}\" }));\n    expect(res.status).toBe(401);\n    hasCookie = true;\n  });\n\n  it(\"returns 400 on invalid JSON\", async () => {\n    const res = await POST(new Request(\"http://localhost/api/cart/items\", { method: \"POST\", body: \"not-json\" }));\n    expect(res.status).toBe(400);\n  });\n\n  it(\"returns 400 when medicineId is missing\", async () => {\n    const res = await POST(new Request(\"http://localhost/api/cart/items\", { method: \"POST\", body: JSON.stringify({}) }));\n    expect(res.status).toBe(400);\n  });\n\n  it(\"returns 404 when medicineId is unknown\", async () => {\n    const res = await POST(new Request(\"http://localhost/api/cart/items\", { method: \"POST\", body: JSON.stringify({ medicineId: \"m-does-not-exist\" }) }));\n    expect(res.status).toBe(404);\n  });\n\n  it(\"adds the line and returns the cart payload on success\", async () => {\n    const res = await POST(new Request(\"http://localhost/api/cart/items\", { method: \"POST\", body: JSON.stringify({ medicineId: \"m-paracetamol-500\", qty: 2 }) }));\n    expect(res.status).toBe(200);\n    const body = (await res.json()) as { itemCount: number; grandTotalPaise: number };\n    expect(body.itemCount).toBe(2);\n    expect(body.grandTotalPaise).toBeGreaterThan(0);\n  });\n});\n"
    }
  ],
  "notes": [
    "All three handlers route through the same buildCartResponse helper so the cart shape can never drift between GET and the POST/DELETE write returns. The helper is the single source of truth for the cart wire format.",
    "POST /api/cart/items defaults qty to 1 when missing or non-numeric (Number.isFinite + >= 1 + Math.floor); negative or fractional qty is silently coerced. This matches the typical tap-Add-to-cart UX where qty isn't sent.",
    "DELETE handler doesn't 404 on missing line - removeCartItem returns true/false and we ignore the result because the desired state ('no line for this medicine') already holds. This is intentionally idempotent."
  ]
}
```

</details>

### QA

- **Decision:** ✅ PASS
- **Test plan:** 9 item(s)
- **Results:** 9 pass, 0 fail
- **Bugs:** 0

**Bugs:**
_(none)_

<details>
<summary>Full QA output (JSON)</summary>

```json
{
  "taskId": "t-cart-1",
  "testPlan": [
    "Verify the file set lands the cart endpoints + the shared cart-response helper: lib/api/cart-response.ts, app/api/cart/route.ts, app/api/cart/items/route.ts, app/api/cart/items/[medicineId]/route.ts.",
    "Verify buildCartResponse groups by distributor, sorts groups by distributor name, computes per-group subtotalPaise as sum(qty * unitPricePaise), grandTotalPaise as the same sum across all groups, and itemCount as sum(qty).",
    "Verify buildCartResponse silently skips cart rows whose medicine row no longer exists (defence-in-depth invariant).",
    "Verify GET /api/cart returns 401 without the session cookie and the cart payload otherwise.",
    "Verify POST /api/cart/items: 401 without cookie, 400 on invalid JSON, 400 on missing medicineId, 404 on unknown medicineId, 200 + payload on success.",
    "Verify POST /api/cart/items defaults qty to 1 when missing/non-numeric/<1 (Number.isFinite + >= 1 + Math.floor).",
    "Verify DELETE /api/cart/items/[medicineId] is idempotent (does not 404 on missing line) and returns the updated payload.",
    "Verify all 3 handlers export `dynamic = 'force-dynamic'`.",
    "Search files[].content for forbidden placeholder strings."
  ],
  "results": [
    {
      "test": "File set covers cart endpoints + shared response helper.",
      "status": "pass",
      "details": "4 files: lib/api/cart-response.ts, app/api/cart/route.ts, app/api/cart/items/route.ts, app/api/cart/items/[medicineId]/route.ts. The dynamic [medicineId] segment uses Next 14's bracket convention."
    },
    {
      "test": "buildCartResponse grouping and totals.",
      "status": "pass",
      "details": "groupsMap keyed by distributorId; per item, lineTotal = qty * unitPricePaise added to group.subtotalPaise + grandTotalPaise; itemCount += qty. Final groups Array.from(map.values()).sort(by distributor.name). Co-located vitest verifies the math with a 3-line cart spanning 2 distributors."
    },
    {
      "test": "buildCartResponse skips rows with missing medicine.",
      "status": "pass",
      "details": "if (!med) continue; runs first inside the loop, so a stale cart row whose medicine has been deleted from the catalogue does not crash the endpoint. In-memory invariant says this can't happen, but the guard is cheap defence in depth."
    },
    {
      "test": "GET /api/cart returns 401 without cookie, payload otherwise.",
      "status": "pass",
      "details": "if (!session) -> 401 { error: 'unauthenticated' }. Otherwise NextResponse.json(buildCartResponse(session.retailerId)). Single source of truth for the wire shape."
    },
    {
      "test": "POST /api/cart/items 5-branch decision matrix.",
      "status": "pass",
      "details": "(1) no cookie -> 401. (2) req.json() throws -> 400 'invalid JSON body'. (3) missing/empty trimmed medicineId -> 400 'medicineId is required'. (4) unknown medicineId (getMedicine returns undefined) -> 404 'medicine not found'. (5) success -> addCartItem + 200 + buildCartResponse. Co-located vitest with mocked next/headers covers all 5 branches."
    },
    {
      "test": "qty defaulting / coercion.",
      "status": "pass",
      "details": "qty = Number.isFinite(body.qty) && body.qty >= 1 ? Math.floor(body.qty) : 1. Missing -> 1. NaN -> 1. -3 -> 1. 2.7 -> 2. Reasonable for the tap-Add-to-cart flow."
    },
    {
      "test": "DELETE /api/cart/items/[medicineId] is idempotent.",
      "status": "pass",
      "details": "removeCartItem returns boolean; the handler ignores it. Both 'cart had this medicine' and 'cart did not have this medicine' produce the same 200 + cart payload response. Matches the cart UI's 'Remove' button which fires-and-forgets."
    },
    {
      "test": "All 3 route handlers export dynamic = 'force-dynamic'.",
      "status": "pass",
      "details": "app/api/cart/route.ts, app/api/cart/items/route.ts, app/api/cart/items/[medicineId]/route.ts each declare `export const dynamic = 'force-dynamic'` immediately after imports. Required because all three call cookies() via getSession()."
    },
    {
      "test": "No forbidden placeholder strings.",
      "status": "pass",
      "details": "Scanned all 4 files. Zero matches."
    }
  ],
  "bugs": [],
  "decision": "PASS"
}
```

</details>

### Cybersecurity

- **Decision:** ✅ GO
- **Summary:** Audited the three cart endpoints + the shared cart-response helper. Every handler is auth-gated (401 without the session cookie), reads only its own retailer's cart rows (retailerId from session, never from the body), validates input strictly, and returns a typed JSON payload. No critical or high-severity vulnerabilities were found. One medium-severity item (no per-session rate limit + no max-cart-size enforcement) and one low-severity item (no Cache-Control: no-store on writes) are documented for the cycle-2 backlog.
- **Prompt-injection risk:** None. No file in the change set issues an LLM call, performs LLM-mediated I/O, renders untrusted text, or executes shell or filesystem operations. medicineId flows only into Map .get() lookups against in-memory rows; qty flows only into integer math. The buildCartResponse helper composes typed primitives into a typed JSON object with no string interpolation that could reach a model surface.

**Vulnerabilities (2):**
- 🟡 medium — POST /api/cart/items has no rate limit and no max-cart-size cap. An authenticated retailer (or anyone holding the unsigned cookie from t-shell-2) can call addCartItem in a loop with distinct medicineIds to exhaust the in-memory store's heap and cause a denial of service for that retailer's session, or with the same medicineId to grow the qty integer past safe-integer territory (~Rs.18 trillion / unit-price; impossible at current unit prices but worth the safety net).
    - **Recommendation:** Cycle 2: add a per-session rate limit (e.g. 60 RPS) and a max-distinct-lines cap on the cart (e.g. 200) - both rejected with 429 and 409 respectively. Pair with the qty * unitPricePaise safe-integer assertion already recommended for createOrdersFromCart in t-data-1's audit.
- 🟢 low — POST and DELETE both return the full cart payload but do not set Cache-Control: no-store. NextResponse.json defaults to no caching for dynamic routes, but a downstream proxy / CDN that ignores Vary: Cookie could theoretically cache the body and serve it to a different retailer. Not a current risk because the only deploy target is Vercel (which respects the dynamic flag) but worth recording for self-hosted reverse-proxy deployments.
    - **Recommendation:** Add `headers: { 'cache-control': 'private, no-store' }` to NextResponse.json calls on the cart endpoints. Trivial; defer to cycle-2 hardening pass alongside the same fix for /api/medicines/search.

**Required fixes (0):**
_(none)_

<details>
<summary>Full Cybersecurity output (JSON)</summary>

```json
{
  "taskId": "t-cart-1",
  "summary": "Audited the three cart endpoints + the shared cart-response helper. Every handler is auth-gated (401 without the session cookie), reads only its own retailer's cart rows (retailerId from session, never from the body), validates input strictly, and returns a typed JSON payload. No critical or high-severity vulnerabilities were found. One medium-severity item (no per-session rate limit + no max-cart-size enforcement) and one low-severity item (no Cache-Control: no-store on writes) are documented for the cycle-2 backlog.",
  "vulnerabilities": [
    {
      "severity": "medium",
      "description": "POST /api/cart/items has no rate limit and no max-cart-size cap. An authenticated retailer (or anyone holding the unsigned cookie from t-shell-2) can call addCartItem in a loop with distinct medicineIds to exhaust the in-memory store's heap and cause a denial of service for that retailer's session, or with the same medicineId to grow the qty integer past safe-integer territory (~Rs.18 trillion / unit-price; impossible at current unit prices but worth the safety net).",
      "recommendation": "Cycle 2: add a per-session rate limit (e.g. 60 RPS) and a max-distinct-lines cap on the cart (e.g. 200) - both rejected with 429 and 409 respectively. Pair with the qty * unitPricePaise safe-integer assertion already recommended for createOrdersFromCart in t-data-1's audit."
    },
    {
      "severity": "low",
      "description": "POST and DELETE both return the full cart payload but do not set Cache-Control: no-store. NextResponse.json defaults to no caching for dynamic routes, but a downstream proxy / CDN that ignores Vary: Cookie could theoretically cache the body and serve it to a different retailer. Not a current risk because the only deploy target is Vercel (which respects the dynamic flag) but worth recording for self-hosted reverse-proxy deployments.",
      "recommendation": "Add `headers: { 'cache-control': 'private, no-store' }` to NextResponse.json calls on the cart endpoints. Trivial; defer to cycle-2 hardening pass alongside the same fix for /api/medicines/search."
    }
  ],
  "promptInjectionRisk": "None. No file in the change set issues an LLM call, performs LLM-mediated I/O, renders untrusted text, or executes shell or filesystem operations. medicineId flows only into Map .get() lookups against in-memory rows; qty flows only into integer math. The buildCartResponse helper composes typed primitives into a typed JSON object with no string interpolation that could reach a model surface.",
  "decision": "GO",
  "requiredFixes": []
}
```

</details>

---

_Generated by the AI Organisation pipeline runner._
