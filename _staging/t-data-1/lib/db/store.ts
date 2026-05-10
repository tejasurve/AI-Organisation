import { randomUUID } from "node:crypto";

import {
  ACTIVE_STATUSES,
  CLOSED_STATUSES,
  type CartItem,
  type Distributor,
  type Medicine,
  type Offer,
  type Order,
  type OrderItem,
  type OrderStatusGroup,
  type OutstandingPayment,
  type Retailer,
} from "@/lib/types";

// ---------- in-memory tables ----------
//
// IMPORTANT: the Map instances live on globalThis under a single namespaced
// key. Next.js dev mode loads each Route Handler in its own module graph,
// which means a plain `const x = new Map()` at module scope produces a
// FRESH Map per handler - the login handler and the search handler then see
// different stores. Hoisting onto globalThis is the canonical Next 14
// pattern for "shared in-memory state across all server modules in one
// process". See https://nextjs.org/docs/app/building-your-application/data-fetching

interface PharmacyStore {
  retailers: Map<string, Retailer>;
  distributors: Map<string, Distributor>;
  medicines: Map<string, Medicine>;
  offers: Map<string, Offer>;
  cartItems: Map<string, CartItem>;
  orders: Map<string, Order>;
  orderItems: Map<string, OrderItem[]>;
  outstanding: Map<string, OutstandingPayment>;
  seeded: boolean;
}

const STORE_KEY = "__pharmacyB2BStore";
type GlobalWithStore = typeof globalThis & { [STORE_KEY]?: PharmacyStore };

function getStore(): PharmacyStore {
  const g = globalThis as GlobalWithStore;
  let s = g[STORE_KEY];
  if (!s) {
    s = {
      retailers: new Map(),
      distributors: new Map(),
      medicines: new Map(),
      offers: new Map(),
      cartItems: new Map(),
      orders: new Map(),
      orderItems: new Map(),
      outstanding: new Map(),
      seeded: false,
    };
    g[STORE_KEY] = s;
  }
  if (!s.seeded) {
    seed(s);
    s.seeded = true;
  }
  return s;
}

const STORE = getStore();
const retailers = STORE.retailers;
const distributors = STORE.distributors;
const medicines = STORE.medicines;
const offers = STORE.offers;
const cartItems = STORE.cartItems; // key = `${retailerId}|${medicineId}`
const orders = STORE.orders;
const orderItems = STORE.orderItems; // key = orderId
const outstanding = STORE.outstanding; // key = `${retailerId}|${distributorId}`

// ---------- public API ----------

export function getRetailer(retailerId: string): Retailer | undefined {
  return retailers.get(retailerId);
}

export function findRetailerByLicense(licenseNumber: string): Retailer | undefined {
  for (const r of retailers.values()) {
    if (r.licenseNumber.toLowerCase() === licenseNumber.toLowerCase()) return r;
  }
  return undefined;
}

export function listDistributors(): Distributor[] {
  return Array.from(distributors.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function getDistributor(id: string): Distributor | undefined {
  return distributors.get(id);
}

export function listOffers(): Offer[] {
  const now = Date.now();
  return Array.from(offers.values())
    .filter((o) => o.validUntil.getTime() >= now)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function searchMedicines(query: string): Medicine[] {
  const q = query.trim().toLowerCase();
  const all = Array.from(medicines.values());
  if (!q) return all.sort((a, b) => a.name.localeCompare(b.name));
  return all
    .filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.brand.toLowerCase().includes(q) ||
        m.genericName.toLowerCase().includes(q),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getMedicine(id: string): Medicine | undefined {
  return medicines.get(id);
}

export function listCartItems(retailerId: string): CartItem[] {
  return Array.from(cartItems.values())
    .filter((c) => c.retailerId === retailerId)
    .sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime());
}

export function addCartItem(retailerId: string, medicineId: string, qty: number): CartItem {
  if (qty < 1) throw new Error("addCartItem: qty must be >= 1");
  const med = medicines.get(medicineId);
  if (!med) throw new Error(`addCartItem: unknown medicineId ${medicineId}`);
  const key = `${retailerId}|${medicineId}`;
  const existing = cartItems.get(key);
  if (existing) {
    existing.qty += qty;
    return existing;
  }
  const item: CartItem = {
    id: randomUUID(),
    retailerId,
    medicineId,
    distributorId: med.distributorId,
    qty,
    unitPricePaise: med.sellingPricePaise,
    addedAt: new Date(),
  };
  cartItems.set(key, item);
  return item;
}

export function removeCartItem(retailerId: string, medicineId: string): boolean {
  const key = `${retailerId}|${medicineId}`;
  return cartItems.delete(key);
}

export function clearCart(retailerId: string): number {
  let removed = 0;
  for (const [k, v] of cartItems.entries()) {
    if (v.retailerId === retailerId) {
      cartItems.delete(k);
      removed++;
    }
  }
  return removed;
}

export function listOrders(retailerId: string, group: OrderStatusGroup): Order[] {
  const set = group === "active" ? ACTIVE_STATUSES : CLOSED_STATUSES;
  return Array.from(orders.values())
    .filter((o) => o.retailerId === retailerId && set.has(o.status))
    .sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime());
}

export function getOrder(id: string): Order | undefined {
  return orders.get(id);
}

export function listOrderItems(orderId: string): OrderItem[] {
  return orderItems.get(orderId) ?? [];
}

export interface CreatedOrder {
  id: string;
  distributorId: string;
}

export function createOrdersFromCart(retailerId: string): CreatedOrder[] {
  const items = listCartItems(retailerId);
  if (items.length === 0) return [];

  const groups = new Map<string, CartItem[]>();
  for (const item of items) {
    const list = groups.get(item.distributorId) ?? [];
    list.push(item);
    groups.set(item.distributorId, list);
  }

  const created: CreatedOrder[] = [];
  for (const [distributorId, lines] of groups) {
    const orderId = randomUUID();
    const total = lines.reduce((acc, l) => acc + l.qty * l.unitPricePaise, 0);
    const itemCount = lines.reduce((acc, l) => acc + l.qty, 0);
    const order: Order = {
      id: orderId,
      retailerId,
      distributorId,
      status: "placed",
      placedAt: new Date(),
      expectedDelivery: addDays(new Date(), 2),
      totalPaise: total,
      itemCount,
    };
    orders.set(orderId, order);
    orderItems.set(
      orderId,
      lines.map<OrderItem>((l) => ({
        id: randomUUID(),
        orderId,
        medicineId: l.medicineId,
        qty: l.qty,
        unitPricePaise: l.unitPricePaise,
        lineTotalPaise: l.qty * l.unitPricePaise,
      })),
    );
    created.push({ id: orderId, distributorId });
  }

  clearCart(retailerId);
  return created;
}

export function getOutstandingForRetailer(retailerId: string): OutstandingPayment[] {
  return Array.from(outstanding.values())
    .filter((p) => p.retailerId === retailerId)
    .sort((a, b) => b.amountDuePaise - a.amountDuePaise);
}

// ---------- seed ----------

function seed(s: PharmacyStore): void {
  const now = new Date();

  // Distributors
  const dMediplus: Distributor = mkDist("d-mediplus", "MediPlus Distributors", "Mumbai", "MEDIPLUS-001", "+91 22 4001 8821", "orders@mediplus.in", 4.6, now);
  const dOmsai: Distributor = mkDist("d-omsai", "Om Sai Pharma", "Pune", "OMSAI-002", "+91 20 6711 4422", "ops@omsaipharma.in", 4.4, now);
  const dAakash: Distributor = mkDist("d-aakash", "Aakash Wholesale", "Nashik", "AAKASH-003", "+91 253 2580 9991", "trade@aakashwholesale.in", 4.2, now);
  const dPharma: Distributor = mkDist("d-pharmacare", "PharmaCare Hub", "Mumbai", "PCARE-004", "+91 22 4900 7711", "hello@pharmacarehub.in", 4.7, now);
  for (const d of [dMediplus, dOmsai, dAakash, dPharma]) s.distributors.set(d.id, d);

  // Medicines (5 per distributor)
  const meds: Medicine[] = [
    mkMed("m-paracetamol-500", "Paracetamol 500mg", "Crocin", "GSK", "Acetaminophen", "d-mediplus", 25, 22, "10+1 free", "10 tablets", "30049099", now),
    mkMed("m-amoxicillin-500", "Amoxicillin 500mg cap", "Mox", "Sun Pharma", "Amoxicillin", "d-mediplus", 95, 84, null, "10 capsules", "30041000", now),
    mkMed("m-pantoprazole-40", "Pantoprazole 40mg", "Pantop", "Aristo", "Pantoprazole", "d-mediplus", 110, 98, null, "15 tablets", "30049099", now),
    mkMed("m-azithromycin-500", "Azithromycin 500mg", "Azithral", "Alembic", "Azithromycin", "d-mediplus", 145, 130, null, "5 tablets", "30042090", now),
    mkMed("m-cetirizine-10", "Cetirizine 10mg", "Cetzine", "GSK", "Cetirizine", "d-mediplus", 22, 19, "20% off", "10 tablets", "30049099", now),

    mkMed("m-vitd3-60k", "Vitamin D3 60K IU", "Calcirol", "Cadila", "Cholecalciferol", "d-omsai", 35, 31, null, "4 sachets", "30049030", now),
    mkMed("m-iron-folic", "Iron + Folic acid", "Livogen", "Merck", "Iron Folic Acid", "d-omsai", 65, 58, null, "30 tablets", "30049036", now),
    mkMed("m-omeprazole-20", "Omeprazole 20mg", "Omez", "Dr Reddys", "Omeprazole", "d-omsai", 78, 70, "Buy 2 get 1 free", "10 capsules", "30049099", now),
    mkMed("m-aspirin-150", "Aspirin 150mg", "Ecosprin", "USV", "Aspirin", "d-omsai", 45, 39, null, "14 tablets", "30049099", now),
    mkMed("m-metformin-500", "Metformin 500mg", "Glycomet", "USV", "Metformin", "d-omsai", 55, 48, null, "20 tablets", "30049099", now),

    mkMed("m-amlodipine-5", "Amlodipine 5mg", "Amlong", "Micro Labs", "Amlodipine", "d-aakash", 38, 33, null, "10 tablets", "30049099", now),
    mkMed("m-telmisartan-40", "Telmisartan 40mg", "Telma", "Glenmark", "Telmisartan", "d-aakash", 92, 81, null, "15 tablets", "30049099", now),
    mkMed("m-losartan-50", "Losartan 50mg", "Losar", "Unichem", "Losartan", "d-aakash", 67, 60, "10+2 free", "10 tablets", "30049099", now),
    mkMed("m-atorvastatin-10", "Atorvastatin 10mg", "Atorlip", "Cipla", "Atorvastatin", "d-aakash", 89, 78, null, "10 tablets", "30049099", now),
    mkMed("m-rosuvastatin-10", "Rosuvastatin 10mg", "Rosuvas", "Sun Pharma", "Rosuvastatin", "d-aakash", 134, 119, null, "10 tablets", "30049099", now),

    mkMed("m-insulin-pen", "Insulin Glargine 100IU pen", "Lantus", "Sanofi", "Insulin Glargine", "d-pharmacare", 1850, 1620, null, "1 pen", "30043190", now),
    mkMed("m-metformin-er-1k", "Metformin ER 1000mg", "Glycomet GP", "USV", "Metformin", "d-pharmacare", 124, 109, null, "15 tablets", "30049099", now),
    mkMed("m-thyroxine-50", "Thyroxine 50mcg", "Thyronorm", "Abbott", "Levothyroxine", "d-pharmacare", 145, 128, null, "100 tablets", "30049099", now),
    mkMed("m-clopidogrel-75", "Clopidogrel 75mg", "Plavix", "Sanofi", "Clopidogrel", "d-pharmacare", 168, 148, null, "10 tablets", "30049099", now),
    mkMed("m-ranitidine-150", "Ranitidine 150mg", "Rantac", "JBChem", "Ranitidine", "d-pharmacare", 28, 24, "30% off", "10 tablets", "30049099", now),
  ];
  for (const m of meds) s.medicines.set(m.id, m);

  // Offers
  s.offers.set("o-1", {
    id: "o-1",
    title: "Save 10% on antibiotics",
    description: "Flat 10% off on Mox, Azithral and other antibiotics from MediPlus.",
    distributorId: "d-mediplus",
    bannerLabel: "10% OFF",
    validUntil: addDays(now, 28),
    sortOrder: 1,
    createdAt: now,
  });
  s.offers.set("o-2", {
    id: "o-2",
    title: "Free delivery on orders over Rs.5,000",
    description: "Om Sai Pharma waives the delivery fee on every order above Rs.5,000.",
    distributorId: "d-omsai",
    bannerLabel: "FREE SHIPPING",
    validUntil: addDays(now, 14),
    sortOrder: 2,
    createdAt: now,
  });
  s.offers.set("o-3", {
    id: "o-3",
    title: "Bulk diabetic care - extra 5% off",
    description: "Order Insulin pens, Metformin or Glycomet GP from PharmaCare Hub and get an extra 5% off above 10 units.",
    distributorId: "d-pharmacare",
    bannerLabel: "DIABETIC CARE",
    validUntil: addDays(now, 21),
    sortOrder: 3,
    createdAt: now,
  });

  // Pilot retailer
  const pilot: Retailer = {
    id: "r-pilot-1",
    name: "Anuradha Medicals",
    ownerName: "Suresh Kulkarni",
    licenseNumber: "MH-RP-2024-7821",
    storeName: "Anuradha Medicals",
    storeAddress: "Plot 14, Shivajinagar, Pune 411005",
    phone: "+91 90220 14857",
    email: "suresh@anuradhamedicals.in",
    gstin: "27ABCDE1234F1Z5",
    favouritesMedicineIds: ["m-paracetamol-500", "m-pantoprazole-40", "m-vitd3-60k"],
    createdAt: now,
  };
  s.retailers.set(pilot.id, pilot);

  // Outstanding payments
  s.outstanding.set(`${pilot.id}|d-mediplus`, {
    id: "op-1",
    retailerId: pilot.id,
    distributorId: "d-mediplus",
    amountDuePaise: 1_425_000,
    lastUpdatedAt: addDays(now, -2),
  });
  s.outstanding.set(`${pilot.id}|d-pharmacare`, {
    id: "op-2",
    retailerId: pilot.id,
    distributorId: "d-pharmacare",
    amountDuePaise: 875_000,
    lastUpdatedAt: addDays(now, -5),
  });

  // Pre-existing orders so the Orders tab is non-empty on first load.
  seedOrder(
    s,
    "ord-seed-1",
    pilot.id,
    "d-omsai",
    "out_for_delivery",
    addDays(now, -1),
    addDays(now, 1),
    [
      { medicineId: "m-iron-folic", qty: 3, unitPricePaise: 5_800 },
      { medicineId: "m-omeprazole-20", qty: 5, unitPricePaise: 7_000 },
    ],
  );
  seedOrder(
    s,
    "ord-seed-2",
    pilot.id,
    "d-aakash",
    "delivered",
    addDays(now, -8),
    addDays(now, -6),
    [
      { medicineId: "m-amlodipine-5", qty: 10, unitPricePaise: 3_300 },
      { medicineId: "m-telmisartan-40", qty: 4, unitPricePaise: 8_100 },
    ],
  );
}

interface SeedLine {
  medicineId: string;
  qty: number;
  unitPricePaise: number;
}

function seedOrder(
  s: PharmacyStore,
  id: string,
  retailerId: string,
  distributorId: string,
  status: Order["status"],
  placedAt: Date,
  expectedDelivery: Date | null,
  lines: SeedLine[],
): void {
  const total = lines.reduce((acc, l) => acc + l.qty * l.unitPricePaise, 0);
  const itemCount = lines.reduce((acc, l) => acc + l.qty, 0);
  s.orders.set(id, {
    id,
    retailerId,
    distributorId,
    status,
    placedAt,
    expectedDelivery,
    totalPaise: total,
    itemCount,
  });
  s.orderItems.set(
    id,
    lines.map((l, i) => ({
      id: `${id}-i-${i}`,
      orderId: id,
      medicineId: l.medicineId,
      qty: l.qty,
      unitPricePaise: l.unitPricePaise,
      lineTotalPaise: l.qty * l.unitPricePaise,
    })),
  );
}

function mkDist(
  id: string,
  name: string,
  region: string,
  supplierCode: string,
  contactPhone: string,
  contactEmail: string,
  rating: number,
  createdAt: Date,
): Distributor {
  return { id, name, region, supplierCode, contactPhone, contactEmail, rating, createdAt };
}

function mkMed(
  id: string,
  name: string,
  brand: string,
  manufacturer: string,
  genericName: string,
  distributorId: string,
  mrpRupees: number,
  sellingRupees: number,
  scheme: string | null,
  packSize: string,
  hsnCode: string,
  createdAt: Date,
): Medicine {
  return {
    id,
    name,
    brand,
    manufacturer,
    genericName,
    distributorId,
    mrpPaise: mrpRupees * 100,
    sellingPricePaise: sellingRupees * 100,
    scheme,
    packSize,
    hsnCode,
    createdAt,
  };
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}
