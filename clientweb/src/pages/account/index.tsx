import { useState } from "react";
import { Link } from "react-router";
import {
  Package,
  User,
  MapPin,
  Building2,
  LogOut,
  RotateCcw,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronRight,
} from "lucide-react";
import Breadcrumb from "../../components/breadcrumb";
import { sampleOrders, type SampleOrder } from "../../data/sampleData";
import { formatPrice } from "../../utils/format";

type Tab = "orders" | "profile" | "addresses" | "business";

const navItems: { id: Tab; label: string; icon: typeof Package }[] = [
  { id: "orders", label: "My Orders", icon: Package },
  { id: "profile", label: "Profile", icon: User },
  { id: "addresses", label: "Addresses", icon: MapPin },
  { id: "business", label: "Business / Party Account", icon: Building2 },
];

const statusStyles: Record<SampleOrder["orderStatus"], { label: string; className: string; icon: typeof Clock }> = {
  pending: { label: "Pending", className: "bg-amber-50 text-amber-700", icon: Clock },
  confirmed: { label: "Confirmed", className: "bg-blue-50 text-blue-700", icon: CheckCircle2 },
  dispatched: { label: "Dispatched", className: "bg-violet-50 text-violet-700", icon: Truck },
  delivered: { label: "Delivered", className: "bg-brand-50 text-brand-700", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", className: "bg-rose-50 text-rose-700", icon: XCircle },
  returned: { label: "Returned", className: "bg-slate-100 text-slate-600", icon: RotateCcw },
};

export default function AccountPage() {
  const [tab, setTab] = useState<Tab>("orders");

  return (
    <div>
      <Breadcrumb items={[{ label: "My Account" }]} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
          {/* Sidebar */}
          <aside>
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-100 p-4">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-700 text-base font-bold text-white">
                TN
              </span>
              <div>
                <p className="text-sm font-semibold text-ink-900">Tejas Nariya</p>
                <p className="text-xs text-slate-500">+91 98765 43210</p>
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
                to="/login"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4" /> Logout
              </Link>
            </nav>
          </aside>

          {/* Content */}
          <div>
            {tab === "orders" && (
              <div>
                <h1 className="mb-5 text-xl font-bold text-ink-900">My Orders</h1>
                <div className="space-y-4">
                  {sampleOrders.map((order) => {
                    const status = statusStyles[order.orderStatus];
                    const StatusIcon = status.icon;
                    return (
                      <div key={order.id} className="rounded-2xl border border-slate-100 p-4 sm:p-5">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-ink-900">{order.billnumber}</p>
                            <p className="text-xs text-slate-500">Placed on {order.date}</p>
                          </div>
                          <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>
                            <StatusIcon className="h-3.5 w-3.5" /> {status.label}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
                          {order.items.map((item) => {
                            const Icon = item.icon;
                            return (
                              <div key={item.name} className="flex items-center gap-2">
                                <div
                                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                                  style={{ background: `linear-gradient(135deg, ${item.from}, ${item.to})` }}
                                >
                                  <Icon className="h-5 w-5 text-ink-800/70" />
                                </div>
                                <div>
                                  <p className="line-clamp-1 text-xs font-medium text-ink-900">{item.name}</p>
                                  <p className="text-xs text-slate-400">Qty {item.qty}</p>
                                </div>
                              </div>
                            );
                          })}
                          <div className="ml-auto flex items-center gap-3">
                            <p className="text-sm font-bold text-ink-900">{formatPrice(order.total)}</p>
                            <button className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800">
                              Details <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tab === "profile" && (
              <div>
                <h1 className="mb-5 text-xl font-bold text-ink-900">Profile</h1>
                <div className="grid gap-4 rounded-2xl border border-slate-100 p-5 sm:grid-cols-2">
                  <ReadField label="Full Name" value="Tejas Nariya" />
                  <ReadField label="Mobile Number" value="+91 98765 43210" />
                  <ReadField label="Email" value="tejasnariya@gmail.com" />
                  <ReadField label="GSTIN" value="Not added" />
                  <div className="sm:col-span-2">
                    <button className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
                      Edit Profile
                    </button>
                  </div>
                </div>
              </div>
            )}

            {tab === "addresses" && (
              <div>
                <div className="mb-5 flex items-center justify-between">
                  <h1 className="text-xl font-bold text-ink-900">Saved Addresses</h1>
                  <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-ink-900 hover:bg-slate-50">
                    + Add New
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-brand-200 bg-brand-50/50 p-4">
                    <span className="mb-2 inline-block rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-semibold text-white">
                      DEFAULT
                    </span>
                    <p className="text-sm font-semibold text-ink-900">Tejas Nariya</p>
                    <p className="mt-1 text-sm text-slate-600">
                      12, Shreeji Complex, Ring Road, Ahmedabad, Gujarat – 380001
                    </p>
                    <p className="mt-1 text-sm text-slate-500">+91 98765 43210</p>
                  </div>
                </div>
              </div>
            )}

            {tab === "business" && (
              <div>
                <h1 className="mb-5 text-xl font-bold text-ink-900">Business / Party Account</h1>
                <div className="rounded-2xl border border-slate-100 p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <Building2 className="h-8 w-8 text-brand-700" />
                    <div>
                      <p className="text-sm font-semibold text-ink-900">No business account linked yet</p>
                      <p className="text-xs text-slate-500">
                        Apply to unlock wholesale price lists, credit-cycle billing and a dedicated salesman.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-slate-500">Credit Limit</p>
                      <p className="font-semibold text-ink-900">—</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Billing Cycle</p>
                      <p className="font-semibold text-ink-900">—</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Assigned Salesman</p>
                      <p className="font-semibold text-ink-900">—</p>
                    </div>
                  </div>
                  <button className="mt-4 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
                    Apply for Business Account
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs text-slate-500">{label}</p>
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-ink-900">{value}</p>
    </div>
  );
}
