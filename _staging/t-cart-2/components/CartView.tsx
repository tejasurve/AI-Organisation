"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { paiseToRupees } from "@/lib/types";

interface CartLine {
  medicineId: string;
  name: string;
  brand: string;
  qty: number;
  unitPricePaise: number;
  lineTotalPaise: number;
}

interface CartGroup {
  distributor: { id: string; name: string };
  items: CartLine[];
  subtotalPaise: number;
}

export interface CartState {
  groups: CartGroup[];
  grandTotalPaise: number;
  itemCount: number;
}

export function CartView({ initialCart }: { initialCart: CartState }) {
  const router = useRouter();
  const [cart, setCart] = useState<CartState>(initialCart);
  const [error, setError] = useState<string | null>(null);
  const [isPlacing, startPlacing] = useTransition();

  async function removeItem(medicineId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/cart/items/${encodeURIComponent(medicineId)}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Remove failed (${res.status})`);
        return;
      }
      setCart((await res.json()) as CartState);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function placeOrder() {
    setError(null);
    startPlacing(async () => {
      try {
        const res = await fetch("/api/orders", { method: "POST" });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? `Place order failed (${res.status})`);
          return;
        }
        router.push("/dashboard/orders?status=active");
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  if (cart.itemCount === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="text-base font-semibold text-slate-700">Your cart is empty</p>
        <p className="mt-1 text-sm text-slate-500">Add medicines from the Home tab to get started.</p>
        <Link
          href="/dashboard/home"
          className="mt-4 inline-flex items-center rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Browse medicines
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-5 pb-32">
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}

      {cart.groups.map((group) => (
        <section
          key={group.distributor.id}
          aria-labelledby={`group-${group.distributor.id}`}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
        >
          <header className="flex items-baseline justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
            <h2 id={`group-${group.distributor.id}`} className="text-sm font-semibold text-slate-900">
              {group.distributor.name}
            </h2>
            <span className="text-sm font-semibold text-slate-700">{paiseToRupees(group.subtotalPaise)}</span>
          </header>
          <ul className="divide-y divide-slate-100">
            {group.items.map((item) => (
              <li key={item.medicineId} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                  <p className="truncate text-xs text-slate-500">{item.brand}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.qty} &times; {paiseToRupees(item.unitPricePaise)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <p className="text-sm font-semibold text-slate-900">{paiseToRupees(item.lineTotalPaise)}</p>
                  <button
                    type="button"
                    onClick={() => removeItem(item.medicineId)}
                    className="text-xs font-medium text-red-600 hover:text-red-700"
                    aria-label={`Remove ${item.name}`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className="fixed bottom-16 left-1/2 z-20 w-full max-w-2xl -translate-x-1/2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Grand total</p>
            <p className="text-xl font-bold text-slate-900">{paiseToRupees(cart.grandTotalPaise)}</p>
          </div>
          <button
            type="button"
            onClick={placeOrder}
            disabled={isPlacing || cart.itemCount === 0}
            className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPlacing ? "Placing..." : `Place order (${cart.itemCount})`}
          </button>
        </div>
      </div>
    </div>
  );
}
