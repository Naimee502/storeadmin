import { NavLink } from "react-router";
import { Home, LayoutGrid, ShoppingCart, User } from "lucide-react";
import { useCart } from "../../contexts/cart";

const items = [
  { label: "Home", icon: Home, to: "/" },
  { label: "Categories", icon: LayoutGrid, to: "/shop" },
  { label: "Cart", icon: ShoppingCart, to: "/cart" },
  { label: "Account", icon: User, to: "/account" },
];

export default function MobileBottomNav() {
  const { count } = useCart();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden">
      {items.map(({ label, icon: Icon, to }) => (
        <NavLink
          key={label}
          to={to}
          end
          className={({ isActive }) =>
            `relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
              isActive ? "text-brand-700" : "text-slate-500"
            }`
          }
        >
          <span className="relative">
            <Icon className="h-5 w-5" />
            {label === "Cart" && count > 0 && (
              <span className="absolute -right-2 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-brand-600 text-[9px] font-bold text-white">
                {count}
              </span>
            )}
          </span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
