import Link from "next/link";
import { redirect } from "next/navigation";

import { MedicineRow } from "@/components/MedicineRow";
import { SearchBar } from "@/components/SearchBar";
import { getSession } from "@/lib/auth/session";
import { getDistributor, searchMedicines } from "@/lib/db/store";

export const dynamic = "force-dynamic";

interface SearchPageProps {
  searchParams: { q?: string };
}

export default function SearchPage({ searchParams }: SearchPageProps) {
  const session = getSession();
  if (!session) redirect("/");
  const q = (searchParams.q ?? "").trim();
  const meds = searchMedicines(q).slice(0, 50);

  return (
    <div className="space-y-4 px-4 pb-6 pt-6">
      <header className="flex items-center gap-3">
        <Link
          href="/dashboard/home"
          className="text-sm font-medium text-brand-600 hover:underline"
          aria-label="Back to home"
        >
          &larr; Home
        </Link>
        <h1 className="text-lg font-semibold text-slate-900">
          {q ? `Results for "${q}"` : "All medicines"}
        </h1>
      </header>

      <SearchBar initialQuery={q} />

      <p className="text-xs text-slate-500">
        Showing {meds.length} {meds.length === 1 ? "medicine" : "medicines"}
        {meds.length === 50 ? " (capped)" : ""}.
      </p>

      <ul className="space-y-3">
        {meds.map((m) => (
          <li key={m.id}>
            <MedicineRow
              id={m.id}
              name={m.name}
              brand={m.brand}
              genericName={m.genericName}
              distributorName={getDistributor(m.distributorId)?.name ?? "Unknown distributor"}
              mrpPaise={m.mrpPaise}
              sellingPricePaise={m.sellingPricePaise}
              scheme={m.scheme}
              packSize={m.packSize}
            />
          </li>
        ))}
        {meds.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            No medicines matched &ldquo;{q}&rdquo;. Try a brand or a generic name.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
