import Link from "next/link";
import { redirect } from "next/navigation";

import { SearchBar } from "@/components/SearchBar";
import { getSession } from "@/lib/auth/session";
import {
  getDistributor,
  getOutstandingForRetailer,
  getRetailer,
  listOffers,
} from "@/lib/db/store";
import { paiseToRupees } from "@/lib/types";

export const dynamic = "force-dynamic";

const QUICK_LINKS = [
  { href: "/dashboard/distributors", label: "Distributors", icon: "shop", description: "Browse all suppliers" },
  { href: "/dashboard/schemes", label: "Schemes", icon: "tag", description: "Active deals" },
  { href: "/dashboard/generics", label: "Generic medicines", icon: "pills", description: "Substitute by generic" },
  { href: "/dashboard/scan", label: "Scan prescription", icon: "scan", description: "Photo to medicines" },
  { href: "/dashboard/profile", label: "Outstanding payments", icon: "rupee", description: "Per-distributor balance" },
];

export default function HomePage() {
  const session = getSession();
  if (!session) redirect("/");
  const retailer = getRetailer(session.retailerId);
  if (!retailer) redirect("/");

  const offers = listOffers().map((o) => ({
    ...o,
    distributorName: getDistributor(o.distributorId)?.name ?? "Unknown distributor",
  }));
  const outstanding = getOutstandingForRetailer(session.retailerId).map((p) => ({
    ...p,
    distributorName: getDistributor(p.distributorId)?.name ?? "Unknown distributor",
  }));
  const outstandingTotal = outstanding.reduce((acc, p) => acc + p.amountDuePaise, 0);

  return (
    <div className="space-y-6 px-4 pb-6 pt-6">
      <header>
        <p className="text-sm text-slate-500">Welcome back,</p>
        <h1 className="text-2xl font-semibold text-slate-900">{retailer.ownerName.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-slate-500">{retailer.storeName}</p>
      </header>

      <SearchBar />

      <section aria-labelledby="offers-heading">
        <div className="flex items-baseline justify-between">
          <h2 id="offers-heading" className="text-sm font-semibold uppercase tracking-wider text-slate-600">
            Offers
          </h2>
          <span className="text-xs text-slate-400">{offers.length} active</span>
        </div>
        <div className="-mx-4 mt-3 overflow-x-auto px-4">
          <ul className="flex snap-x snap-mandatory gap-3">
            {offers.map((o) => (
              <li
                key={o.id}
                className="snap-start rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 p-4 text-white shadow-md min-w-[280px] max-w-[280px]"
              >
                <p className="inline-flex rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                  {o.bannerLabel}
                </p>
                <h3 className="mt-2 text-base font-semibold leading-tight">{o.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-white/80">{o.description}</p>
                <p className="mt-3 text-xs text-white/70">By {o.distributorName}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="quick-links-heading">
        <h2 id="quick-links-heading" className="text-sm font-semibold uppercase tracking-wider text-slate-600">
          Quick links
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-3">
          {QUICK_LINKS.map((q) => (
            <li key={q.href}>
              <Link
                href={q.href}
                className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <QuickLinkIcon name={q.icon} />
                </span>
                <p className="mt-2 text-sm font-semibold text-slate-900">{q.label}</p>
                <p className="mt-0.5 text-xs text-slate-500">{q.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="outstanding-heading" className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center justify-between">
          <h2 id="outstanding-heading" className="text-sm font-semibold uppercase tracking-wider text-amber-900">
            Outstanding payments
          </h2>
          <Link href="/dashboard/profile" className="text-xs font-medium text-amber-900 underline-offset-2 hover:underline">
            View all
          </Link>
        </div>
        <p className="mt-2 text-3xl font-bold text-amber-900">{paiseToRupees(outstandingTotal)}</p>
        <ul className="mt-3 space-y-1.5 text-sm text-amber-900">
          {outstanding.map((p) => (
            <li key={p.id} className="flex items-baseline justify-between">
              <span>{p.distributorName}</span>
              <span className="font-semibold">{paiseToRupees(p.amountDuePaise)}</span>
            </li>
          ))}
          {outstanding.length === 0 ? (
            <li className="text-sm text-amber-900">No outstanding balance.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}

function QuickLinkIcon({ name }: { name: string }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (name === "shop") {
    return (
      <svg {...common}>
        <path d="M3 9h18l-1 11H4L3 9Z" />
        <path d="M3 9 5 4h14l2 5" />
      </svg>
    );
  }
  if (name === "tag") {
    return (
      <svg {...common}>
        <path d="M20 12 12 20l-9-9V3h8l9 9Z" />
        <circle cx="7.5" cy="7.5" r="1.2" />
      </svg>
    );
  }
  if (name === "pills") {
    return (
      <svg {...common}>
        <rect x="3" y="9" width="10" height="6" rx="3" />
        <circle cx="17" cy="15" r="4" />
        <path d="M14 15h6" />
      </svg>
    );
  }
  if (name === "scan") {
    return (
      <svg {...common}>
        <path d="M4 8V5a1 1 0 0 1 1-1h3" />
        <path d="M16 4h3a1 1 0 0 1 1 1v3" />
        <path d="M20 16v3a1 1 0 0 1-1 1h-3" />
        <path d="M8 20H5a1 1 0 0 1-1-1v-3" />
        <path d="M8 12h8" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M7 5h10" />
      <path d="M7 9h10" />
      <path d="M7 9c2.6 0 4 1.5 4 4 0 2.4-1.4 4-4 4l4 4" />
    </svg>
  );
}
