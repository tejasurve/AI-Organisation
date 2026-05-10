export type OrderStatus =
  | "placed"
  | "acknowledged"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type OrderStatusGroup = "active" | "closed";

export const ACTIVE_STATUSES: ReadonlySet<OrderStatus> = new Set([
  "placed",
  "acknowledged",
  "out_for_delivery",
]);

export const CLOSED_STATUSES: ReadonlySet<OrderStatus> = new Set([
  "delivered",
  "cancelled",
]);

export const STATUS_LABELS: Record<OrderStatus, string> = {
  placed: "Placed",
  acknowledged: "Acknowledged",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export interface Retailer {
  id: string;
  name: string;
  ownerName: string;
  licenseNumber: string;
  storeName: string;
  storeAddress: string;
  phone: string;
  email: string;
  gstin: string;
  favouritesMedicineIds: string[];
  createdAt: Date;
}

export interface Distributor {
  id: string;
  name: string;
  region: string;
  supplierCode: string;
  contactPhone: string;
  contactEmail: string;
  rating: number;
  createdAt: Date;
}

export interface Medicine {
  id: string;
  name: string;
  brand: string;
  manufacturer: string;
  genericName: string;
  distributorId: string;
  mrpPaise: number;
  sellingPricePaise: number;
  scheme: string | null;
  packSize: string;
  hsnCode: string;
  createdAt: Date;
}

export interface Offer {
  id: string;
  title: string;
  description: string;
  distributorId: string;
  bannerLabel: string;
  validUntil: Date;
  sortOrder: number;
  createdAt: Date;
}

export interface CartItem {
  id: string;
  retailerId: string;
  medicineId: string;
  distributorId: string;
  qty: number;
  unitPricePaise: number;
  addedAt: Date;
}

export interface Order {
  id: string;
  retailerId: string;
  distributorId: string;
  status: OrderStatus;
  placedAt: Date;
  expectedDelivery: Date | null;
  totalPaise: number;
  itemCount: number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  medicineId: string;
  qty: number;
  unitPricePaise: number;
  lineTotalPaise: number;
}

export interface OutstandingPayment {
  id: string;
  retailerId: string;
  distributorId: string;
  amountDuePaise: number;
  lastUpdatedAt: Date;
}

export function isActiveStatus(status: OrderStatus): boolean {
  return ACTIVE_STATUSES.has(status);
}

export function statusGroup(status: OrderStatus): OrderStatusGroup {
  return ACTIVE_STATUSES.has(status) ? "active" : "closed";
}

export function paiseToRupees(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const paisePart = (abs % 100).toString().padStart(2, "0");
  return `${sign}\u20B9${formatThousands(rupees)}.${paisePart}`;
}

function formatThousands(n: number): string {
  // Indian numbering system: 1,23,45,678
  const s = String(n);
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${grouped},${last3}`;
}
