"use client";

import { useState, useTransition } from "react";

import { paiseToRupees } from "@/lib/types";

export interface MedicineRowProps {
  id: string;
  name: string;
  brand: string;
  genericName: string;
  distributorName: string;
  mrpPaise: number;
  sellingPricePaise: number;
  scheme: string | null;
  packSize: string;
}

export function MedicineRow(props: MedicineRowProps) {
  const [isPending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onAdd() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/cart/items", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ medicineId: props.id, qty: 1 }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? `Add to cart failed (${res.status})`);
          return;
        }
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  const discountPct =
    props.mrpPaise > props.sellingPricePaise
      ? Math.round(((props.mrpPaise - props.sellingPricePaise) / props.mrpPaise) * 100)
      : 0;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-900">{props.name}</h3>
          <p className="truncate text-sm text-slate-600">
            {props.brand}
            <span className="text-slate-400"> &middot; </span>
            {props.genericName}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {props.distributorName}
            <span className="text-slate-400"> &middot; </span>
            {props.packSize}
          </p>
        </div>
        <div className="text-right">
          <p className="text-base font-semibold text-slate-900">{paiseToRupees(props.sellingPricePaise)}</p>
          {discountPct > 0 ? (
            <p className="text-xs text-slate-500">
              <span className="line-through">{paiseToRupees(props.mrpPaise)}</span>
              <span className="ml-1 font-medium text-emerald-600">{discountPct}% off</span>
            </p>
          ) : null}
        </div>
      </div>

      {props.scheme ? (
        <p className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
          Scheme: {props.scheme}
        </p>
      ) : null}

      <div className="mt-3 flex items-center justify-end gap-2">
        {error ? <span className="text-xs text-red-600">{error}</span> : null}
        <button
          type="button"
          onClick={onAdd}
          disabled={isPending || added}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {added ? "Added" : isPending ? "Adding..." : "Add to cart"}
        </button>
      </div>
    </article>
  );
}
