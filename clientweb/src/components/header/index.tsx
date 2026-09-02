import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  Search,
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
  Package,
  Wallet,
  LogOut,
  Bell,
} from "lucide-react";
import { siteConfig } from "../../config/site";
import { useCart } from "../../contexts/cart";
import { useTenant } from "../../contexts/tenant";
import { useAuth } from "../../contexts/auth";
import { useCatalog } from "../../hooks/useCatalog";
import { titleCaseIfShouting } from "../../utils/format";
import NotificationBell from "../notificationbell";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const { count } = useCart();
  const { isLoggedIn, account, logout } = useAuth();
  const navigate = useNavigate();
  const { companyName, supportPhone, supportEmail, brandLogo } = useTenant();
  // Which category the shop is currently filtered by, so the nav can mark it.
  // Same ?category=<id> param ShopPage reads, so the strip and the grid can
  // never disagree about what's selected.
  const [searchParams] = useSearchParams();
  const activeCategory = searchParams.get("category");
  const brandName = companyName || siteConfig.name;

  // Close the account dropdown on an outside click, same as any standard
  // header user-menu.
  useEffect(() => {
    if (!accountMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [accountMenuOpen]);

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
            <Link to={isLoggedIn ? "/account" : "/login"} className="flex items-center gap-1.5 hover:text-white">
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
            {/* The business's uploaded logo when there is one; the lettered
                avatar is the fallback, not the default. */}
            {/* Height is fixed and width is free, because most business logos
                are wider than they are tall — forcing one into a square shrank
                them until the wordmark was unreadable. Sized to match the app's
                login screen rather than to match the lettered avatar it
                replaced: a real logo carries detail a single letter does not,
                and at 36px that detail was mush. The hairline ring marks where
                the logo ends, which matters when someone uploads one on a white
                or transparent background. */}
            {brandLogo ? (
              <img
                src={brandLogo}
                alt={brandName}
                className="h-10 w-auto max-w-[160px] shrink-0 rounded-lg bg-white object-contain p-0.5 ring-1 ring-black/10 sm:h-12 sm:max-w-[200px]"
              />
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-700 font-bold text-white">
                {brandName[0]?.toUpperCase() ?? "R"}
              </span>
            )}
            <span className="text-xl font-extrabold tracking-tight text-ink-900">
              {brandName}
            </span>
          </Link>

          {/* Search */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/shop?q=${encodeURIComponent(searchQuery.trim())}`);
            }}
            className="hidden flex-1 items-stretch overflow-hidden rounded-lg border border-slate-200 focus-within:border-brand-500 md:flex"
          >
            <div className="relative hidden shrink-0 border-r border-slate-200 bg-slate-50 sm:block">
              <select className="appearance-none bg-transparent py-2.5 pl-3 pr-8 text-sm text-slate-600 outline-none">
                <option>All Categories</option>
                {visibleCategories.map((c) => (
                  <option key={c.id}>{titleCaseIfShouting(c.name)}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for groceries, electronics, fashion, toys & more…"
              className="w-full px-3 py-2.5 text-sm outline-none placeholder:text-slate-400"
            />
            <button type="submit" className="flex items-center justify-center bg-brand-700 px-4 text-white hover:bg-brand-800">
              <Search className="h-4.5 w-4.5" />
            </button>
          </form>

          <div className="ml-auto flex items-center gap-1 sm:gap-3">
            {isLoggedIn ? (
              <div className="relative" ref={accountMenuRef}>
                <button
                  onClick={() => setAccountMenuOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-slate-100 md:px-3"
                >
                  <User className="h-5 w-5 text-ink-900" />
                  <span className="hidden text-left leading-tight sm:block">
                    <span className="block text-[11px] text-slate-500">Welcome</span>
                    <span className="flex items-center gap-0.5 font-semibold text-ink-900">
                      {account?.name || "My Account"} <ChevronDown className="h-3.5 w-3.5" />
                    </span>
                  </span>
                </button>

                {accountMenuOpen && (
                  <div className="absolute right-0 top-full z-50 mt-1.5 w-52 rounded-xl border border-slate-100 bg-white p-1.5 shadow-lg">
                    <Link
                      to="/account"
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-900 hover:bg-slate-50"
                    >
                      <User className="h-4 w-4" /> My Account
                    </Link>
                    <Link
                      to="/account?tab=orders"
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-900 hover:bg-slate-50"
                    >
                      <Package className="h-4 w-4" /> My Orders
                    </Link>
                    <Link
                      to="/account?tab=payments"
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-900 hover:bg-slate-50"
                    >
                      <Wallet className="h-4 w-4" /> Payments
                    </Link>
                    <Link
                      to="/account/notifications"
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-900 hover:bg-slate-50"
                    >
                      <Bell className="h-4 w-4" /> Notifications
                    </Link>
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      onClick={() => {
                        setAccountMenuOpen(false);
                        logout();
                        navigate("/login");
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
                    >
                      <LogOut className="h-4 w-4" /> Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-slate-100 md:px-3"
              >
                <User className="h-5 w-5 text-ink-900" />
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-[11px] text-slate-500">Welcome</span>
                  <span className="flex items-center gap-0.5 font-semibold text-ink-900">
                    Login / Sign up <ChevronDown className="h-3.5 w-3.5" />
                  </span>
                </span>
              </Link>
            )}

            <div className="flex items-center">
              <NotificationBell />
            </div>

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
            navigate(`/shop?q=${encodeURIComponent(searchQuery.trim())}`);
          }}
          className="px-4 pb-3 md:hidden"
        >
          <div className="flex items-stretch overflow-hidden rounded-lg border border-slate-200">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* The strip scrolls itself. Without this the flex row just grows
              past the viewport and takes the whole page's horizontal scroll
              with it, dragging the header, hero and footer sideways too. */}
          <div className="no-scrollbar flex items-center gap-7 overflow-x-auto py-2.5 text-sm font-medium text-ink-700">
          {visibleCategories.map((cat) => {
            const active = cat.id === activeCategory;
            return (
              <Link
                key={cat.id}
                to={`/shop?category=${cat.id}`}
                aria-current={active ? "page" : undefined}
                // self-stretch so every link box is the full row height —
                // two-line names like "MAGIC CAR" would otherwise sit the
                // marker at a different offset than the one-line ones.
                className={`relative flex shrink-0 items-center gap-1 self-stretch whitespace-nowrap py-1 transition-colors ${
                  active ? "text-brand-700" : "hover:text-brand-700"
                }`}
              >
                {titleCaseIfShouting(cat.name)}
                {/* Sits on the nav's own bottom border (the row's py-2.5), so
                    the marker reads as an underline of the whole strip rather
                    than a bar floating under the word. */}
                {active && (
                  <span className="absolute inset-x-0 -bottom-2.5 h-0.5 rounded-full bg-brand-700" />
                )}
              </Link>
            );
          })}
          </div>
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
                aria-current={cat.id === activeCategory ? "page" : undefined}
                className={`block border-b border-slate-100 py-2 text-sm font-semibold ${
                  cat.id === activeCategory ? "text-brand-700" : "text-ink-900"
                }`}
              >
                {titleCaseIfShouting(cat.name)}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
