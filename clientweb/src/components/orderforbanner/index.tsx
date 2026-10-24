import { Link, useLocation } from "react-router";
import { Store, X } from "lucide-react";
import { useCart } from "../../contexts/cart";

// Shown on every page while the cart is being filled for a sub-party
// (My Parties → New Order), so it is never mistaken for the party's own cart.
export default function OrderForBanner() {
  const { orderFor, stopOrderFor, count } = useCart();
  const { pathname } = useLocation();
  if (!orderFor) return null;
  const onCart = pathname.startsWith("/cart") || pathname.startsWith("/checkout");
  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2 text-sm sm:px-6">
        <Store className="h-4 w-4 text-amber-700" />
        <span className="text-amber-900">
          Ordering for <b>{orderFor.name}</b> — prices are this party's.
        </span>
        <div className="ml-auto flex items-center gap-2">
          {!onCart && count > 0 && (
            <Link to="/cart" className="rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700">
              View cart ({count})
            </Link>
          )}
          <button
            onClick={() => {
              if (count === 0 || window.confirm(`Stop ordering for ${orderFor.name}? Its cart will be emptied.`)) stopOrderFor();
            }}
            className="flex items-center gap-1 rounded-md border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
          >
            <X className="h-3.5 w-3.5" /> Stop
          </button>
        </div>
      </div>
    </div>
  );
}
