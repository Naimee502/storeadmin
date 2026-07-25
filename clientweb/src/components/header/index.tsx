import { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  Search,
  Heart,
  ShoppingCart,
  User,
  ChevronDown,
  Menu,
  X,
  Phone,
  Mail,
  Truck,
  Briefcase,
  HelpCircle,
} from "lucide-react";
import { siteConfig } from "../../config/site";
import { useCart } from "../../contexts/cart";
import { useTenant } from "../../contexts/tenant";
import { useCatalog } from "../../hooks/useCatalog";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { count, wishlistCount } = useCart();
  const navigate = useNavigate();
  const { companyName, supportPhone, supportEmail } = useTenant();
  const brandName = companyName || siteConfig.name;

  // Real categories from this admin's own catalog — every business
  // automatically only sees its own categories, no manual filtering needed.
  const { categories: visibleCategories } = useCatalog();

  return (
    <header className="sticky top-0 z-50 bg-white">
      {/* Utility bar */}
      <div className="hidden bg-ink-900 text-slate-200 md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 text-xs sm:px-6 lg:px-8">
          <div className="flex items-center gap-5">
            <a href="#" className="flex items-center gap-1.5 hover:text-white">
              <Phone className="h-3.5 w-3.5" /> {supportPhone || siteConfig.supportPhone}
            </a>
            <a href="#" className="hidden items-center gap-1.5 hover:text-white lg:flex">
              <Mail className="h-3.5 w-3.5" /> {supportEmail || siteConfig.supportEmail}
            </a>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/login" className="flex items-center gap-1.5 font-medium text-brand-300 hover:text-brand-200">
              <Briefcase className="h-3.5 w-3.5" /> Apply for a Business / Party Account
            </Link>
            <Link to="/account" className="flex items-center gap-1.5 hover:text-white">
              <Truck className="h-3.5 w-3.5" /> Track Order
            </Link>
            <a href="#" className="flex items-center gap-1.5 hover:text-white">
              <HelpCircle className="h-3.5 w-3.5" /> Help
            </a>
          </div>
        </div>
      </div>

      {/* Main bar */}
      <div className="border-b border-slate-100">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <button
            className="rounded-md p-2 text-ink-900 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>

          <Link to="/" className="flex shrink-0 items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-700 font-bold text-white">
              {brandName[0]?.toUpperCase() ?? "R"}
            </span>
            <span className="text-xl font-extrabold tracking-tight text-ink-900">
              {brandName}
            </span>
          </Link>

          {/* Search */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigate("/shop");
            }}
            className="hidden flex-1 items-stretch overflow-hidden rounded-lg border border-slate-200 focus-within:border-brand-500 md:flex"
          >
            <select className="hidden shrink-0 border-r border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 outline-none sm:block">
              <option>All Categories</option>
              {visibleCategories.map((c) => (
                <option key={c.id}>{c.name}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Search for groceries, electronics, fashion, toys & more…"
              className="w-full px-3 py-2.5 text-sm outline-none placeholder:text-slate-400"
            />
            <button type="submit" className="flex items-center justify-center bg-brand-700 px-4 text-white hover:bg-brand-800">
              <Search className="h-4.5 w-4.5" />
            </button>
          </form>

          <div className="ml-auto flex items-center gap-1 sm:gap-3">
            <Link to="/login" className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-slate-100 md:px-3">
              <User className="h-5 w-5 text-ink-900" />
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-[11px] text-slate-500">Welcome</span>
                <span className="flex items-center gap-0.5 font-semibold text-ink-900">
                  Login / Sign up <ChevronDown className="h-3.5 w-3.5" />
                </span>
              </span>
            </Link>

            <Link to="/account" className="relative rounded-md p-2 hover:bg-slate-100" aria-label="Wishlist">
              <Heart className="h-5.5 w-5.5 text-ink-900" />
              {wishlistCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4.5 w-4.5 place-items-center rounded-full bg-accent-600 text-[10px] font-bold text-white">
                  {wishlistCount}
                </span>
              )}
            </Link>

            <Link to="/cart" className="relative flex items-center gap-2 rounded-lg bg-ink-900 px-3 py-2 text-white hover:bg-ink-800">
              <span className="relative">
                <ShoppingCart className="h-5 w-5" />
                {count > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 grid h-4.5 w-4.5 place-items-center rounded-full bg-brand-500 text-[10px] font-bold text-white">
                    {count}
                  </span>
                )}
              </span>
              <span className="hidden text-sm font-semibold sm:block">Cart</span>
            </Link>
          </div>
        </div>

        {/* Mobile search */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate("/shop");
          }}
          className="px-4 pb-3 md:hidden"
        >
          <div className="flex items-stretch overflow-hidden rounded-lg border border-slate-200">
            <input
              type="text"
              placeholder="Search products…"
              className="w-full px-3 py-2 text-sm outline-none placeholder:text-slate-400"
            />
            <button type="submit" className="flex items-center justify-center bg-brand-700 px-3 text-white">
              <Search className="h-4.5 w-4.5" />
            </button>
          </div>
        </form>
      </div>

      {/* Category nav */}
      <nav className="hidden border-b border-slate-100 bg-white lg:block">
        <div className="mx-auto flex max-w-7xl items-center gap-7 px-4 py-2.5 text-sm font-medium text-ink-700 sm:px-6 lg:px-8">
          {visibleCategories.map((cat) => (
            <Link key={cat.id} to={`/shop?category=${cat.id}`} className="flex items-center gap-1 py-1 hover:text-brand-700">
              {cat.name}
            </Link>
          ))}
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-b border-slate-100 bg-white lg:hidden">
          <div className="max-h-[70vh] overflow-y-auto px-4 py-3">
            {visibleCategories.map((cat) => (
              <Link
                key={cat.id}
                to={`/shop?category=${cat.id}`}
                onClick={() => setMobileOpen(false)}
                className="block border-b border-slate-100 py-2 text-sm font-semibold text-ink-900"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
