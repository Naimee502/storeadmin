import { useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams, Link } from "react-router";
import { useQuery } from "@apollo/client";
import {
  Package,
  User,
  MapPin,
  LogOut,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronRight,
  ArrowRight,
  Phone,
  Mail,
  Tag,
  Map as MapIcon,
  UserCircle,
  CreditCard,
  Wallet,
  BookText,
  Wallet2,
  Landmark,
  Store,
  IndianRupee,
  Bell,
  LayoutDashboard,
  Boxes,
  Pencil,
} from "lucide-react";
import Breadcrumb from "../../components/breadcrumb";
import ProductCard from "../../components/productcard";
import AddressForm from "../../components/addressform";
import { useAuth } from "../../contexts/auth";
import { useTenant } from "../../contexts/tenant";
import { useCatalog } from "../../hooks/useCatalog";
import {
  GET_ACCOUNT,
  GET_SALES_ORDERS,
  GET_PAYMENTS,
  GET_DELIVERY_MODE,
  GET_DOWNLINE_PARTY_BALANCES,
} from "../../graphql/queries/accounts";
import { formatPrice } from "../../utils/format";
import { orderStatus, formatBillNumber, formatDate, titleCase, type FilterKey } from "../../utils/orders";
import { stateOptions } from "../../utils/states";

const stateLabel = (value?: string) => (value ? stateOptions.find((s) => s.value === value)?.label : undefined);

type Tab = "dashboard" | "orders" | "payments" | "profile";

const navItems: { id: Tab; label: string; icon: typeof Package }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "orders", label: "My Orders", icon: Package },
  { id: "payments", label: "Payments", icon: Wallet },
  { id: "profile", label: "Profile", icon: User },
];

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "dispatched", label: "Dispatched" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

const STATUS_STYLE: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  pending: { label: "Pending", className: "bg-amber-50 text-amber-700", icon: Clock },
  confirmed: { label: "Confirmed", className: "bg-blue-50 text-blue-700", icon: CheckCircle2 },
  dispatched: { label: "Dispatched", className: "bg-violet-50 text-violet-700", icon: Truck },
  delivered: { label: "Delivered", className: "bg-brand-50 text-brand-700", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", className: "bg-rose-50 text-rose-700", icon: XCircle },
};

const VALID_TABS: Tab[] = ["dashboard", "orders", "payments", "profile"];

export default function AccountPage() {
  // URL-driven so the header's account dropdown (My Orders/Payments links
  // to /account?tab=...) can actually jump to a specific tab — a plain
  // useState here couldn't react to clicking those links while already on
  // /account, since the path itself never changed.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const tab: Tab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : "dashboard";
  const setTab = (t: Tab) => {
    setSearchParams(t === "dashboard" ? {} : { tab: t });
  };
  const [dashboardCategory, setDashboardCategory] = useState<string>("all");
  const [editingProfileAddress, setEditingProfileAddress] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  // Scope: own vs sub-party (downline) records — only meaningful when the
  // business has "Party manages downline" on AND this party actually has
  // sub-parties assigned to it (an end-user party has none, same rule the
  // app uses to keep this hidden for them).
  const [orderScope, setOrderScope] = useState<"mine" | "downline" | "all">("mine");
  const [paymentScope, setPaymentScope] = useState<"mine" | "parties">("mine");
  const { isLoggedIn, account, logout } = useAuth();
  const { adminid } = useTenant();
  const navigate = useNavigate();
  const { products, categories } = useCatalog();

  const { data: accountData, refetch: refetchAccount } = useQuery(GET_ACCOUNT, {
    variables: { id: account?.id, adminId: adminid },
    skip: !account?.id || !adminid,
  });

  const { data: settingsData } = useQuery(GET_DELIVERY_MODE, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: "cache-and-network",
  });
  const manageDownline = settingsData?.getAdminSettings?.partyManagesDownline === true;

  const { data: downlineBalData } = useQuery(GET_DOWNLINE_PARTY_BALANCES, {
    variables: { partyid: account?.id },
    skip: !account?.id || !manageDownline,
    fetchPolicy: "cache-and-network",
  });
  const downlineParties: any[] = downlineBalData?.getDownlinePartyBalances ?? [];
  const hasDownline = downlineParties.length > 0;

  const { data: ordersData, loading: ordersLoading } = useQuery(GET_SALES_ORDERS, {
    variables: { adminid, partyacc: account?.id, includeDownline: manageDownline },
    skip: !account?.id || !adminid,
  });
  const { data: paymentsData, loading: paymentsLoading } = useQuery(GET_PAYMENTS, {
    variables: { adminid, partyid: account?.id },
    skip: !account?.id || !adminid,
  });

  // All hooks above this point run unconditionally on every render (rules
  // of hooks) — the actual "not logged in" bail-out happens after, via
  // plain values/JSX rather than skipping hook calls.
  // Newest first — both orders and payments come back oldest-first from the
  // server, same as the app (which reverses them client-side too).
  const allOrders: any[] = useMemo(() => [...(ordersData?.getSalesOrders ?? [])].reverse(), [ordersData]);
  const orders = useMemo(() => {
    if (!manageDownline || orderScope === "all") return allOrders;
    if (orderScope === "mine") return allOrders.filter((o: any) => o.partyacc?.id === account?.id);
    return allOrders.filter((o: any) => o.partyacc?.id && o.partyacc.id !== account?.id);
  }, [allOrders, orderScope, manageDownline, account?.id]);
  const payments: any[] = useMemo(
    () => [...(paymentsData?.getPayments ?? [])].filter((p: any) => p.status !== false).reverse(),
    [paymentsData]
  );
  const counts = useMemo(
    () => ({
      all: orders.length,
      pending: orders.filter((o: any) => orderStatus(o) === "pending").length,
      confirmed: orders.filter((o: any) => orderStatus(o) === "confirmed").length,
      dispatched: orders.filter((o: any) => orderStatus(o) === "dispatched").length,
      delivered: orders.filter((o: any) => orderStatus(o) === "delivered").length,
      cancelled: orders.filter((o: any) => orderStatus(o) === "cancelled").length,
    }),
    [orders]
  );

  // Dashboard tab — same at-a-glance view as the app's Home screen (stat
  // cards, latest order, browsable product grid), just embedded inside
  // My Account instead of being the app's separate bottom-nav tab.
  const dashboardTabs = useMemo(
    () => [{ id: "all", label: "All" }, ...categories.slice(0, 5).map((c) => ({ id: c.id, label: c.name }))],
    [categories]
  );
  const dashboardProducts = useMemo(
    () => (dashboardCategory === "all" ? products : products.filter((p) => p.category === dashboardCategory)),
    [products, dashboardCategory]
  );

  // Nothing here is real without a login — send anyone who isn't signed in
  // (including a direct/typed visit to this URL) to the login page instead
  // of showing someone else's data.
  if (!isLoggedIn || !account) {
    return <Navigate to="/login" replace />;
  }

  const fullAccount = accountData?.getAccountById;
  const filtered = filter === "all" ? orders : orders.filter((o: any) => orderStatus(o) === filter);

  const totalOutstanding = Math.max(0, fullAccount?.outstanding || 0);
  const totalPaid = payments.reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
  // Payments tab's "Outstanding Invoices" is always about MY OWN invoices —
  // independent of whatever scope the Orders tab happens to be on.
  const myOrders = allOrders.filter((o: any) => o.partyacc?.id === account.id);
  // "Outstanding" means money is still due — so filter on the invoice's actual
  // outstanding, not merely "this order became an invoice". Every converted
  // order used to be listed here, so a party who had paid in full still saw
  // their bills under a heading that says they owe money.
  const outstandingInvoices = myOrders.filter(
    (o: any) => o.isConverted && o.cancelStatus !== "cancelled" && (o.outstanding ?? 0) > 0.005
  );
  const showDownlineUI = manageDownline && hasDownline;
  const hasAddress = !!(fullAccount?.address && fullAccount?.city && fullAccount?.state && fullAccount?.pincode);

  const displayName = fullAccount?.name || account.name;
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const hasFinancial = !!(fullAccount?.creditlimit || fullAccount?.openingbalance || fullAccount?.ledgerid);

  return (
    <div>
      <Breadcrumb items={[{ label: "My Account" }]} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
          {/* Sidebar */}
          <aside>
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-100 p-4">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-700 text-base font-bold text-white">
                {initials || "U"}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-900">{displayName}</p>
                <p className="text-xs text-slate-500">+91 {fullAccount?.mobile || account.mobile}</p>
              </div>
            </div>

            <nav className="space-y-1 rounded-2xl border border-slate-100 p-2">
              {navItems.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                    tab === id ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
              <Link
                to="/account/notifications"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <Bell className="h-4 w-4" /> Notifications
              </Link>
              <button
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </nav>
          </aside>

          {/* Content */}
          <div>
            {tab === "dashboard" && (
              <div>
                <h1 className="mb-5 text-xl font-bold text-ink-900">Dashboard</h1>

                {/* Stat cards — same three the app's Home screen leads with. */}
                <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-100 p-4">
                    <span className="mb-2 grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700">
                      <IndianRupee className="h-4.5 w-4.5" />
                    </span>
                    <p className="text-lg font-bold text-ink-900">{formatPrice(totalOutstanding)}</p>
                    <p className="text-xs text-slate-500">Outstanding</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 p-4">
                    <span className="mb-2 grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700">
                      <Clock className="h-4.5 w-4.5" />
                    </span>
                    <p className="text-lg font-bold text-ink-900">
                      {myOrders.filter((o: any) => orderStatus(o) === "pending").length}
                    </p>
                    <p className="text-xs text-slate-500">Pending Orders</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 p-4">
                    <span className="mb-2 grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700">
                      <Boxes className="h-4.5 w-4.5" />
                    </span>
                    <p className="text-lg font-bold text-ink-900">{products.length}</p>
                    <p className="text-xs text-slate-500">Products</p>
                  </div>
                </div>

                {/* Recent Orders — latest order only, "View all" jumps to
                    the full My Orders tab. */}
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-ink-900">Recent Orders</h2>
                  <button
                    onClick={() => setTab("orders")}
                    className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
                  >
                    View all <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
                {myOrders.length === 0 ? (
                  <p className="mb-8 rounded-2xl border border-slate-100 py-8 text-center text-sm text-slate-400">
                    You haven't placed any orders yet.
                  </p>
                ) : (
                  (() => {
                    const order = myOrders[0];
                    const status = orderStatus(order);
                    const style = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
                    const StatusIcon = style.icon;
                    return (
                      <button
                        onClick={() => navigate(`/account/orders/${order.id}`)}
                        className="mb-8 flex w-full items-center gap-3 rounded-2xl border border-slate-100 p-4 text-left transition hover:border-brand-300"
                      >
                        <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-ink-900">{formatBillNumber(order)}</p>
                          <p className="text-xs text-slate-500">{formatDate(order.billdate || order.createdAt)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold text-ink-900">{formatPrice(order.totalamount)}</p>
                          <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.className}`}>
                            <StatusIcon className="h-3 w-3" /> {style.label}
                          </span>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                      </button>
                    );
                  })()
                )}

                {/* Products — same category chips + grid as the app's Home
                    screen browsing section (reuses the storefront's own
                    ProductCard, so Add-to-cart behaves identically to Shop). */}
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-ink-900">Products</h2>
                  <Link
                    to="/shop"
                    className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
                  >
                    Browse all <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto">
                  {dashboardTabs.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setDashboardCategory(t.id)}
                      className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                        dashboardCategory === t.id
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-slate-200 text-slate-500 hover:border-brand-400"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {dashboardProducts.length === 0 ? (
                  <p className="rounded-2xl border border-slate-100 py-8 text-center text-sm text-slate-400">No products found.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {dashboardProducts.slice(0, 6).map((p) => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "orders" && (
              <div>
                <div className="mb-5 flex items-center justify-between">
                  <h1 className="text-xl font-bold text-ink-900">My Orders</h1>
                </div>

                {showDownlineUI && (
                  <div className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                    {([
                      { key: "mine", label: "My Orders" },
                      { key: "downline", label: "Parties Orders" },
                      { key: "all", label: "All" },
                    ] as const).map((s) => (
                      <button
                        key={s.key}
                        onClick={() => setOrderScope(s.key)}
                        className={`rounded-md py-2 text-xs font-semibold transition ${
                          orderScope === s.key ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
                  {FILTERS.map((f) => {
                    const active = filter === f.key;
                    const count = (counts as any)[f.key];
                    return (
                      <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                          active
                            ? "border-brand-700 bg-brand-700 text-white"
                            : "border-slate-200 text-slate-600 hover:border-brand-400"
                        }`}
                      >
                        {f.label}
                        {count > 0 && (
                          <span
                            className={`rounded-full px-1.5 text-[10px] ${
                              active ? "bg-white/25" : "bg-brand-50 text-brand-700"
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {ordersLoading ? (
                  <p className="py-10 text-center text-sm text-slate-400">Loading orders…</p>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-100 py-14 text-center">
                    <Package className="h-9 w-9 text-slate-300" />
                    <p className="text-sm text-slate-500">
                      {filter === "all" ? "You haven't placed any orders yet." : `No ${filter} orders.`}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filtered.map((order: any) => {
                      const status = orderStatus(order);
                      const style = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
                      const StatusIcon = style.icon;
                      const itemCount = order.productservice?.length ?? 0;
                      return (
                        <button
                          key={order.id}
                          onClick={() => navigate(`/account/orders/${order.id}`)}
                          className="w-full rounded-2xl border border-slate-100 p-4 text-left transition hover:border-brand-300 sm:p-5"
                        >
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-ink-900">{formatBillNumber(order)}</p>
                              <p className="text-xs text-slate-500">Placed on {formatDate(order.billdate || order.createdAt)}</p>
                            </div>
                            <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${style.className}`}>
                              <StatusIcon className="h-3.5 w-3.5" /> {style.label}
                            </span>
                          </div>
                          {order.partyacc?.id && order.partyacc.id !== account.id && (
                            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-brand-600">
                              <Store className="h-3.5 w-3.5" /> {order.partyacc.accountname || "Sub-party"}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                            <p className="text-xs text-slate-500">
                              {itemCount} item{itemCount !== 1 ? "s" : ""}
                              {order.salesmenid?.name && <span> · via {order.salesmenid.name}</span>}
                            </p>
                            <div className="flex items-center gap-3">
                              <p className="text-sm font-bold text-ink-900">{formatPrice(order.totalamount)}</p>
                              <ChevronRight className="h-4 w-4 text-slate-400" />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === "payments" && (
              <div>
                <h1 className="mb-5 text-xl font-bold text-ink-900">Payments</h1>

                {showDownlineUI && (
                  <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                    {([
                      { key: "mine", label: "My Payments" },
                      { key: "parties", label: "Parties" },
                    ] as const).map((s) => (
                      <button
                        key={s.key}
                        onClick={() => setPaymentScope(s.key)}
                        className={`rounded-md py-2 text-xs font-semibold transition ${
                          paymentScope === s.key ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}

                {showDownlineUI && paymentScope === "parties" ? (
                  <div className="space-y-2.5">
                    {downlineParties.length === 0 ? (
                      <p className="rounded-2xl border border-slate-100 py-8 text-center text-sm text-slate-400">No sub-parties found.</p>
                    ) : (
                      downlineParties.map((p: any) => {
                        const due = Math.max(0, p.outstanding || 0);
                        return (
                          <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3.5">
                            <button
                              onClick={() => navigate(`/account/parties/${p.id}/payments`)}
                              className="flex flex-1 items-center gap-3 text-left"
                            >
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
                                {(p.name || "P").charAt(0).toUpperCase()}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-ink-900">{p.name}</p>
                                <p className="truncate text-xs text-slate-500">{p.mobile || "—"}</p>
                              </div>
                              <div className="text-right">
                                {due > 0 ? (
                                  <>
                                    <p className="text-sm font-bold text-rose-600">{formatPrice(due)}</p>
                                    <p className="text-xs text-slate-400">Due</p>
                                  </>
                                ) : (
                                  <p className="text-xs font-semibold text-brand-600">No dues</p>
                                )}
                              </div>
                            </button>
                            {due > 0 && (
                              <button
                                onClick={() => navigate(`/account/parties/${p.id}/collect`)}
                                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-700 text-white hover:bg-brand-800"
                                aria-label="Collect payment"
                              >
                                <IndianRupee className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <>
                    <div className="mb-6 grid grid-cols-2 gap-4">
                      <div className="rounded-2xl border border-slate-100 p-4">
                        <p className="text-xs text-slate-500">Total Outstanding</p>
                        <p className="mt-1 text-lg font-bold text-rose-600">{formatPrice(totalOutstanding)}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-100 p-4">
                        <p className="text-xs text-slate-500">Total Paid</p>
                        <p className="mt-1 text-lg font-bold text-brand-700">{formatPrice(totalPaid)}</p>
                      </div>
                    </div>

                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-sm font-bold text-ink-900">Payment History</h2>
                      <p className="text-xs text-slate-400">
                        {payments.length} payment{payments.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    {paymentsLoading ? (
                      <p className="py-6 text-center text-sm text-slate-400">Loading payments…</p>
                    ) : payments.length === 0 ? (
                      <p className="rounded-2xl border border-slate-100 py-8 text-center text-sm text-slate-400">No payments yet.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {payments.map((p: any) => (
                          <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3.5">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                              <Wallet2 className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-ink-900">#{p.paymentcode}</p>
                              <p className="truncate text-xs text-slate-500">
                                {titleCase(p.type) || "Receipt"} · {titleCase(p.mode) || "Cash"} · {formatDate(p.paymentdate)}
                              </p>
                            </div>
                            <p className="shrink-0 text-sm font-bold text-brand-700">{formatPrice(p.amount)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {paymentScope === "mine" && outstandingInvoices.length > 0 && (
                  <div className="mt-8">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-sm font-bold text-ink-900">Outstanding Invoices</h2>
                      <p className="text-xs text-slate-400">
                        {outstandingInvoices.length} invoice{outstandingInvoices.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="space-y-2.5">
                      {outstandingInvoices.map((o: any) => (
                        <div
                          key={o.id}
                          onClick={() => navigate(`/account/orders/${o.id}`)}
                          className="cursor-pointer rounded-2xl border border-slate-100 p-4 transition hover:border-brand-300"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-ink-900">{formatBillNumber(o)}</p>
                              <p className="text-xs text-slate-500">{formatDate(o.billdate)}</p>
                            </div>
                            <p className="text-sm font-bold text-brand-700">{formatPrice(o.totalamount)}</p>
                          </div>
                          <div className="mt-2.5 space-y-1 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                            {o.subtotal != null && (
                              <div className="flex justify-between">
                                <span>Subtotal</span> <span>{formatPrice(o.subtotal)}</span>
                              </div>
                            )}
                            {o.totaldiscount > 0 && (
                              <div className="flex justify-between text-brand-600">
                                <span>Discount</span> <span>−{formatPrice(o.totaldiscount)}</span>
                              </div>
                            )}
                            {o.totalgst > 0 && (
                              <div className="flex justify-between">
                                <span>GST</span> <span>{formatPrice(o.totalgst)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "profile" && (
              <div>
                <h1 className="mb-5 text-xl font-bold text-ink-900">Profile</h1>

                <div className="mb-4 rounded-2xl border border-slate-100 p-5">
                  <p className="mb-3 text-sm font-bold text-ink-900">Account Details</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <InfoRow icon={Phone} label="Mobile" value={fullAccount?.mobile || account.mobile} />
                    {fullAccount?.email && <InfoRow icon={Mail} label="Email" value={fullAccount.email} />}
                    {fullAccount?.accountcode && <InfoRow icon={UserCircle} label="Account Code" value={fullAccount.accountcode} />}
                    {fullAccount?.channel?.channelName && (
                      <InfoRow icon={Tag} label="Channel" value={fullAccount.channel.channelName} />
                    )}
                    {fullAccount?.region && <InfoRow icon={MapIcon} label="Region" value={fullAccount.region} />}
                    {fullAccount?.salesmanid?.name && (
                      <InfoRow icon={UserCircle} label="Salesman" value={fullAccount.salesmanid.name} />
                    )}
                  </div>
                </div>

                <div className="mb-4 rounded-2xl border border-slate-100 p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-bold text-ink-900">Delivery Address</p>
                    {hasAddress && !editingProfileAddress && (
                      <button
                        onClick={() => setEditingProfileAddress(true)}
                        className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                    )}
                  </div>
                  {editingProfileAddress || !hasAddress ? (
                    <AddressForm
                      accountId={account.id}
                      name={fullAccount?.name || account.name}
                      accountGroupId={fullAccount?.accountgroupid?.id}
                      initial={fullAccount}
                      submitLabel={hasAddress ? "Save Address" : "Add Address"}
                      onSaved={() => {
                        setEditingProfileAddress(false);
                        refetchAccount();
                      }}
                    />
                  ) : (
                    <p className="flex items-start gap-1.5 text-sm text-slate-600">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      {[fullAccount?.address, fullAccount?.city, stateLabel(fullAccount?.state), fullAccount?.pincode]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  )}
                </div>

                {hasFinancial && (
                  <div className="rounded-2xl border border-slate-100 p-5">
                    <p className="mb-3 text-sm font-bold text-ink-900">Financial</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {!!fullAccount?.creditlimit && (
                        <InfoRow icon={CreditCard} label="Credit Limit" value={formatPrice(fullAccount.creditlimit)} />
                      )}
                      {!!fullAccount?.openingbalance && (
                        <InfoRow
                          icon={Wallet}
                          label="Opening Balance"
                          value={`${formatPrice(fullAccount.openingbalance)} (${fullAccount.openingbalancetype || "debit"})`}
                        />
                      )}
                      {fullAccount?.ledgerid?.ledgername && (
                        <InfoRow icon={Landmark} label="Ledger" value={fullAccount.ledgerid.ledgername} />
                      )}
                      {fullAccount?.gstnumber && <InfoRow icon={BookText} label="GSTIN" value={fullAccount.gstnumber} />}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="truncate text-sm font-medium text-ink-900">{value}</p>
      </div>
    </div>
  );
}
