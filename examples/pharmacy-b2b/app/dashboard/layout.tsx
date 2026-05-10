import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { BottomTabBar } from "@/components/BottomTabBar";
import { getSession } from "@/lib/auth/session";
import { getRetailer } from "@/lib/db/store";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const session = getSession();
  if (!session) redirect("/");
  const retailer = getRetailer(session.retailerId);
  if (!retailer) redirect("/");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col bg-slate-50">
      <main className="flex-1 pb-24">{children}</main>
      <BottomTabBar />
    </div>
  );
}
