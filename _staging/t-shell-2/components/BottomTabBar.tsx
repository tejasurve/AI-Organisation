"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/home", label: "Home", icon: "home" as const },
  { href: "/dashboard/orders", label: "Orders", icon: "orders" as const },
  { href: "/dashboard/cart", label: "Cart", icon: "cart" as const },
  { href: "/dashboard/profile", label: "Profile", icon: "profile" as const },
];

type IconName = (typeof TABS)[number]["icon"];

export function BottomTabBar() {
  const pathname = usePathname() ?? "";
  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-1/2 z-30 w-full max-w-2xl -translate-x-1/2 border-t border-slate-200 bg-white/95 backdrop-blur"
    >
      <ul className="grid grid-cols-4">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-3 text-xs",
                  active ? "text-brand-600" : "text-slate-500 hover:text-slate-900",
                )}
              >
                <TabIcon name={tab.icon} active={active} />
                <span className={active ? "font-semibold" : ""}>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function TabIcon({ name, active }: { name: IconName; active: boolean }) {
  const stroke = active ? "currentColor" : "#94a3b8";
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (name === "home") {
    return (
      <svg {...common} aria-hidden="true">
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v10h14V10" />
      </svg>
    );
  }
  if (name === "orders") {
    return (
      <svg {...common} aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M8 9h8M8 13h8M8 17h5" />
      </svg>
    );
  }
  if (name === "cart") {
    return (
      <svg {...common} aria-hidden="true">
        <circle cx="9" cy="20" r="1.5" />
        <circle cx="17" cy="20" r="1.5" />
        <path d="M3 4h2l2.6 11.6a2 2 0 0 0 2 1.4h7.7a2 2 0 0 0 2-1.4L21 8H6" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
