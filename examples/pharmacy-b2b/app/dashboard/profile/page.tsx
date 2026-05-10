import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/LogoutButton";
import { getSession } from "@/lib/auth/session";
import {
  getDistributor,
  getOutstandingForRetailer,
  getRetailer,
} from "@/lib/db/store";
import { paiseToRupees } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  const session = getSession();
  if (!session) redirect("/");
  const retailer = getRetailer(session.retailerId);
  if (!retailer) redirect("/");

  const op = getOutstandingForRetailer(retailer.id).map((p) => ({
    ...p,
    distributorName: getDistributor(p.distributorId)?.name ?? "Unknown distributor",
  }));
  const outstandingTotal = op.reduce((acc, p) => acc + p.amountDuePaise, 0);

  const initials = retailer.ownerName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="space-y-5 px-4 pb-6 pt-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Profile</h1>
        <p className="mt-1 text-sm text-slate-500">Your store details, on file with the platform.</p>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-4 border-b border-slate-100 bg-gradient-to-br from-brand-50 to-white p-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white shadow">
            {initials || "?"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-900">{retailer.storeName}</p>
            <p className="truncate text-sm text-slate-600">{retailer.ownerName}</p>
            <p className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
              Active retailer
            </p>
          </div>
        </div>

        <dl className="divide-y divide-slate-100">
          <ProfileRow label="License number" value={retailer.licenseNumber} />
          <ProfileRow label="GSTIN" value={retailer.gstin} />
          <ProfileRow label="Store address" value={retailer.storeAddress} />
          <ProfileRow label="Phone" value={retailer.phone} />
          <ProfileRow label="Email" value={retailer.email} />
          <ProfileRow label="Favourites" value={`${retailer.favouritesMedicineIds.length} medicines`} />
        </dl>
      </section>

      <section
        aria-labelledby="outstanding-heading"
        className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
      >
        <div className="flex items-center justify-between">
          <h2 id="outstanding-heading" className="text-sm font-semibold uppercase tracking-wider text-amber-900">
            Outstanding payments
          </h2>
          <span className="text-sm font-semibold text-amber-900">{paiseToRupees(outstandingTotal)}</span>
        </div>
        <ul className="mt-3 space-y-1.5 text-sm text-amber-900">
          {op.length === 0 ? (
            <li>No outstanding balance.</li>
          ) : (
            op.map((p) => (
              <li key={p.id} className="flex items-baseline justify-between">
                <span>{p.distributorName}</span>
                <span className="font-semibold">{paiseToRupees(p.amountDuePaise)}</span>
              </li>
            ))
          )}
        </ul>
        <p className="mt-3 text-xs text-amber-800">
          Last reconciled with each distributor &middot; figures may lag the distributor ledger by up to 24 hours.
        </p>
      </section>

      <LogoutButton />
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 px-4 py-3">
      <dt className="w-32 shrink-0 text-xs uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm text-slate-900">{value}</dd>
    </div>
  );
}
