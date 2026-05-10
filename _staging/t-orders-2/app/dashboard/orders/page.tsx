import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { getDistributor, listOrders } from "@/lib/db/store";
import {
  type Order,
  type OrderStatus,
  type OrderStatusGroup,
  STATUS_LABELS,
  paiseToRupees,
} from "@/lib/types";

export const dynamic = "force-dynamic";

interface OrdersPageProps {
  searchParams: { status?: string };
}

export default function OrdersPage({ searchParams }: OrdersPageProps) {
  const session = getSession();
  if (!session) redirect("/");
  const group: OrderStatusGroup = searchParams.status === "closed" ? "closed" : "active";
  const orders = listOrders(session.retailerId, group);

  return (
    <div className="space-y-4 px-4 pb-6 pt-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Orders</h1>
        <p className="mt-1 text-sm text-slate-500">All orders placed from your store.</p>
      </header>

      <nav role="tablist" className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 text-sm">
        <TabLink href="/dashboard/orders?status=active" active={group === "active"}>
          Active
        </TabLink>
        <TabLink href="/dashboard/orders?status=closed" active={group === "closed"}>
          Closed
        </TabLink>
      </nav>

      <ul className="space-y-3">
        {orders.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            {group === "active"
              ? "No active orders right now. Place one from the Cart tab."
              : "No closed orders yet. Delivered and cancelled orders will show up here."}
          </li>
        ) : (
          orders.map((o) => <li key={o.id}>{renderOrderCard(o)}</li>)
        )}
      </ul>
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={`rounded-xl px-3 py-2 text-center font-medium transition ${
        active ? "bg-white text-brand-700 shadow" : "text-slate-600 hover:text-slate-900"
      }`}
    >
      {children}
    </Link>
  );
}

function renderOrderCard(order: Order) {
  const distributor = getDistributor(order.distributorId);
  const distributorName = distributor?.name ?? "Unknown distributor";
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-slate-900">{distributorName}</p>
          <p className="text-xs text-slate-500">Order #{shortId(order.id)}</p>
        </div>
        <StatusPill status={order.status} />
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-3 text-xs">
        <div>
          <dt className="uppercase tracking-wider text-slate-400">Items</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-900">{order.itemCount}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wider text-slate-400">Total</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-900">{paiseToRupees(order.totalPaise)}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wider text-slate-400">Placed</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-900">{formatRelative(order.placedAt)}</dd>
        </div>
      </dl>

      {order.expectedDelivery ? (
        <p className="mt-3 text-xs text-slate-500">
          Expected delivery: <span className="font-medium text-slate-700">{formatDate(order.expectedDelivery)}</span>
        </p>
      ) : null}
    </article>
  );
}

function StatusPill({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    placed: "bg-blue-100 text-blue-800",
    acknowledged: "bg-indigo-100 text-indigo-800",
    out_for_delivery: "bg-amber-100 text-amber-800",
    delivered: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-slate-200 text-slate-700",
  };
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${styles[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function shortId(id: string): string {
  return id.length <= 8 ? id : id.slice(0, 8);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatRelative(d: Date): string {
  const now = Date.now();
  const diffMs = now - d.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}
