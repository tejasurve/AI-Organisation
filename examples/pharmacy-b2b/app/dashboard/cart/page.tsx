import { redirect } from "next/navigation";

import { CartView } from "@/components/CartView";
import { buildCartResponse } from "@/lib/api/cart-response";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default function CartPage() {
  const session = getSession();
  if (!session) redirect("/");

  const cart = buildCartResponse(session.retailerId);

  return (
    <div className="space-y-4 px-4 pb-6 pt-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Cart</h1>
        <p className="mt-1 text-sm text-slate-500">
          {cart.itemCount === 0
            ? "Nothing in your cart yet."
            : `${cart.itemCount} ${cart.itemCount === 1 ? "item" : "items"} across ${cart.groups.length} ${cart.groups.length === 1 ? "distributor" : "distributors"}.`}
        </p>
      </header>
      <CartView initialCart={cart} />
    </div>
  );
}
