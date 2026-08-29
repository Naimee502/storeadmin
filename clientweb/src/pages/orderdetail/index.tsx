import { useState } from "react";
import { useParams, useNavigate, Navigate, Link } from "react-router";
import { useQuery, useMutation } from "@apollo/client";
import { Package, CheckCircle2, Calendar, Store, Phone, Tag, Pencil, ArrowLeft, FileWarning, FileText, Truck } from "lucide-react";
import Breadcrumb from "../../components/breadcrumb";
import { useAuth } from "../../contexts/auth";
import { useTenant } from "../../contexts/tenant";
import {
  GET_SALES_ORDER_BY_ID,
  CONFIRM_SALES_ORDER,
  CONVERT_SALES_ORDER_TO_INVOICE,
  MARK_SALES_ORDER_DISPATCHED,
  MARK_SALES_ORDER_DELIVERED,
} from "../../graphql/queries/accounts";
import { formatPrice } from "../../utils/format";
import { formatBillNumber, formatDate, canEditOrder } from "../../utils/orders";
import { useDownline } from "../../hooks/useDownline";
import { useModuleEnabled } from "../../hooks/useModuleEnabled";

type Status = "Pending" | "Confirmed" | "Dispatched" | "Delivered" | "Cancelled";

const STATUS_COLOR: Record<Status, string> = {
  Pending: "#f59e0b",
  Confirmed: "#3b82f6",
  Dispatched: "#8b5cf6",
  Delivered: "#16a34a",
  Cancelled: "#ef4444",
};

const TIMELINE: Record<Status, { steps: string[]; current: number }> = {
  Pending: { steps: ["Order Placed", "Confirmed", "Dispatched", "Delivered"], current: 0 },
  Confirmed: { steps: ["Order Placed", "Confirmed", "Dispatched", "Delivered"], current: 1 },
  Dispatched: { steps: ["Order Placed", "Confirmed", "Dispatched", "Delivered"], current: 2 },
  Delivered: { steps: ["Order Placed", "Confirmed", "Dispatched", "Delivered"], current: 3 },
  Cancelled: { steps: ["Order Placed", "Cancelled"], current: 1 },
};

// Same status derivation as the app's OrderDetail screen: prefer the
// canonical orderStatus field, fall back to the older lifecycle flags.
function getStatus(order: any): Status {
  if (order.orderStatus) {
    const s = String(order.orderStatus);
    return (s.charAt(0).toUpperCase() + s.slice(1)) as Status;
  }
  if (order.cancelStatus === "cancelled") return "Cancelled";
  if (order.deliveryStatus === "delivered") return "Delivered";
  if (order.deliveryStatus === "dispatched") return "Dispatched";
  if (order.isConverted) return "Confirmed";
  return "Pending";
}

function OrderTimeline({ status }: { status: Status }) {
  const config = TIMELINE[status] ?? TIMELINE.Pending;
  const colour = STATUS_COLOR[status] ?? "#16a34a";
  return (
    <div className="pl-1">
      {config.steps.map((step, i) => {
        const done = i <= config.current;
        const current = i === config.current;
        return (
          <div key={step} className="flex items-start">
            <div className="mr-3.5 flex w-5 flex-col items-center">
              <span
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full border-2"
                style={{ backgroundColor: done ? colour : "#e2e8f0", borderColor: done ? colour : "#e2e8f0" }}
              >
                {done && <CheckCircle2 className="h-3 w-3 text-white" />}
              </span>
              {i < config.steps.length - 1 && (
                <span className="mt-0.5 w-0.5 flex-1" style={{ backgroundColor: i < config.current ? colour : "#e2e8f0", minHeight: 20 }} />
              )}
            </div>
            <p
              className="pb-3 pt-0.5 text-sm"
              style={{ color: current ? colour : done ? "#0f172a" : "#94a3b8", fontWeight: current ? 700 : 500 }}
            >
              {step}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isLoggedIn, account } = useAuth();
  const { displayProductPrice } = useTenant();
  const { manageDownline, isOwnOrDownline } = useDownline();
  const salesInvoiceEnabled = useModuleEnabled("salesinvoice");

  const { data, loading, refetch } = useQuery(GET_SALES_ORDER_BY_ID, {
    variables: { id },
    skip: !id,
    fetchPolicy: "network-only",
  });
  const [confirmSalesOrder] = useMutation(CONFIRM_SALES_ORDER);
  const [convertToInvoice] = useMutation(CONVERT_SALES_ORDER_TO_INVOICE);
  const [markDispatched] = useMutation(MARK_SALES_ORDER_DISPATCHED);
  const [markDelivered] = useMutation(MARK_SALES_ORDER_DELIVERED);

  const [acting, setActing] = useState<"confirm" | "convert" | "dispatch" | "deliver" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const rawOrder = data?.getSalesOrderById;
  // Defensive ownership check — getSalesOrderById doesn't scope by caller
  // server-side, so make sure this order actually belongs to the logged-in
  // account, OR to one of its sub-parties when downline management is on
  // (mirrors the app's isOwnOrder || (manageDownline && isDownlineOrder)).
  const order = rawOrder && isOwnOrDownline(rawOrder.partyacc?.id) ? rawOrder : null;

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div>
        <Breadcrumb items={[{ label: "My Account", to: "/account" }, { label: "Order" }]} />
        <p className="py-24 text-center text-sm text-slate-400">Loading order…</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div>
        <Breadcrumb items={[{ label: "My Account", to: "/account" }, { label: "Order" }]} />
        <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
          <FileWarning className="h-14 w-14 text-slate-300" />
          <h1 className="mt-4 text-xl font-bold text-ink-900">Order not found</h1>
          <p className="mt-1 text-sm text-slate-500">This order doesn't exist or isn't linked to your account.</p>
          <Link to="/account?tab=orders" className="mt-6 rounded-lg bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
            Back to My Orders
          </Link>
        </div>
      </div>
    );
  }

  const status = getStatus(order);
  const colour = STATUS_COLOR[status];
  const billLabel = formatBillNumber(order);
  const items = order.productservice ?? [];
  const subtotal = order.subtotal ?? items.reduce((s: number, i: any) => s + (i.amount ?? 0), 0);
  const gstAmt = order.totalgst ?? 0;
  const discount = order.totaldiscount ?? 0;
  const grand = order.totalamount ?? subtotal + gstAmt - discount;

  // Downline order management — a channel party can confirm / convert /
  // dispatch / deliver its DOWNLINE orders (sub-party orders) once "Party
  // manages downline" is on, but never its own orders. Mirrors clientapp's
  // OrderDetail canAct/canEdit/canConvert/canDispatch/canDeliver exactly.
  const isOwnOrder = order.partyacc?.id === account?.id;
  const isDownlineOrder = !!order.partyacc?.id && order.partyacc.id !== account?.id;
  const canAct = manageDownline && isDownlineOrder;

  const canEdit =
    canEditOrder(order) && (isOwnOrder || canAct);
  const canConvert = salesInvoiceEnabled && !order.isConverted && status !== "Cancelled" && canAct;
  const canConfirm = !salesInvoiceEnabled && !order.isConverted && status !== "Cancelled" && canAct;
  const canDispatch = canAct && (status === "Pending" || status === "Confirmed");
  const canDeliver = canAct && status !== "Delivered" && status !== "Cancelled";

  const runAction = async (key: "confirm" | "convert" | "dispatch" | "deliver", confirmMsg: string, fn: () => Promise<any>, successMsg?: string) => {
    if (!window.confirm(confirmMsg)) return;
    setActionError(null);
    setActing(key);
    try {
      await fn();
      await refetch();
      if (successMsg) window.alert(successMsg);
    } catch (err: any) {
      setActionError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setActing(null);
    }
  };

  const handleConfirm = () =>
    runAction("confirm", "Mark this order as confirmed?", () => confirmSalesOrder({ variables: { id: order.id } }));

  const handleConvert = () =>
    runAction(
      "convert",
      "Convert this order into an invoice?",
      () => convertToInvoice({ variables: { id: order.id } }),
      "Invoice created from this order."
    );

  const handleDispatch = () =>
    runAction("dispatch", "Mark this order as dispatched?", () => markDispatched({ variables: { id: order.id } }));

  const handleDeliver = () =>
    runAction("deliver", "Mark this order as delivered?", () =>
      markDelivered({ variables: { id: order.id, byId: account?.id, byName: account?.name, byType: "party" } })
    );

  return (
    <div>
      <Breadcrumb items={[{ label: "My Account", to: "/account" }, { label: billLabel }]} />

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate("/account?tab=orders")}
          className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to My Orders
        </button>

        <div className="space-y-5">
          {/* Header */}
          <div className="rounded-2xl border border-slate-100 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-lg font-bold text-ink-900">{billLabel}</h1>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <Calendar className="h-3.5 w-3.5" /> {formatDate(order.billdate || order.createdAt)}
                </p>
              </div>
              <div className="text-right">
                <span
                  className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ backgroundColor: `${colour}1a`, color: colour }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colour }} />
                  {status}
                </span>
                {Math.max(0, order.outstanding || 0) > 0 && displayProductPrice && (
                  <p className="mt-1.5 text-xs font-semibold text-rose-600">
                    Due: {formatPrice(Math.max(0, order.outstanding || 0))}
                  </p>
                )}
              </div>
            </div>
            {order.salesmenid?.name && (
              <p className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <Store className="h-3.5 w-3.5" /> Salesman: {order.salesmenid.name}
              </p>
            )}
          </div>

          {/* Timeline */}
          <div className="rounded-2xl border border-slate-100 p-5">
            <h2 className="mb-4 text-sm font-bold text-ink-900">Order Status</h2>
            <OrderTimeline status={status} />
          </div>

          {/* Items */}
          <div className="rounded-2xl border border-slate-100 p-5">
            <h2 className="mb-4 text-sm font-bold text-ink-900">Items ({items.length})</h2>
            <div className="space-y-3">
              {items.map((item: any, idx: number) => (
                <div
                  key={item.productserviceid?.id ?? idx}
                  className={`flex items-center gap-3 pb-3 ${idx < items.length - 1 ? "border-b border-slate-100" : ""}`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-brand-50">
                    {item.productserviceid?.imageurl ? (
                      <img src={item.productserviceid.imageurl} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <Package className="h-5 w-5 text-brand-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-900">{item.productserviceid?.name ?? "Product"}</p>
                    <p className="text-xs text-slate-500">
                      {[item.variantid?.name, item.salesunitid?.unitname].filter(Boolean).join(" · ")} × {item.qty}
                      {displayProductPrice && ` @ ${formatPrice(item.rate)}`}
                    </p>
                  </div>
                  {displayProductPrice && (
                    <div className="text-right">
                      <p className="text-sm font-bold text-ink-900">{formatPrice(item.amount)}</p>
                      {(item.gst ?? 0) > 0 && <p className="text-[11px] text-slate-400">GST {item.gst}%</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Price breakdown */}
          {displayProductPrice && (
            <div className="rounded-2xl border border-slate-100 p-5">
              <h2 className="mb-4 text-sm font-bold text-ink-900">Price Details</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total Discount</span>
                  <span className={discount > 0 ? "text-brand-600" : ""}>{discount > 0 ? `−${formatPrice(discount)}` : formatPrice(0)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>GST</span>
                  <span>{formatPrice(gstAmt)}</span>
                </div>
                {order.othercharges?.map((charge: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-slate-600">
                    <span>{charge.ledgerid?.ledgername || "Other Charge"}</span>
                    <span>{formatPrice(charge.totalamount)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-base font-bold text-ink-900">
                <span>Total Payable</span>
                <span>{formatPrice(grand)}</span>
              </div>
            </div>
          )}

          {/* Transport details */}
          {order.isConverted && (order.transportname || order.vehiclenumber || order.ewaybillno) && (
            <div className="rounded-2xl border border-slate-100 p-5">
              <h2 className="mb-4 text-sm font-bold text-ink-900">Transport Details</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {order.transportname && (
                  <div>
                    <p className="text-xs text-slate-500">Transport Name</p>
                    <p className="text-sm font-medium text-ink-900">{order.transportname}</p>
                  </div>
                )}
                {order.vehiclenumber && (
                  <div>
                    <p className="text-xs text-slate-500">Vehicle Number</p>
                    <p className="text-sm font-medium text-ink-900">{order.vehiclenumber}</p>
                  </div>
                )}
                {order.ewaybillno && (
                  <div>
                    <p className="text-xs text-slate-500">E-Way Bill No.</p>
                    <p className="text-sm font-medium text-ink-900">{order.ewaybillno}</p>
                  </div>
                )}
                {order.deliverydate && (
                  <div>
                    <p className="text-xs text-slate-500">Delivery Date</p>
                    <p className="text-sm font-medium text-ink-900">{formatDate(order.deliverydate)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Account */}
          {order.partyacc && (
            <div className="rounded-2xl border border-slate-100 p-5">
              <h2 className="mb-3 text-sm font-bold text-ink-900">Account</h2>
              <div className="space-y-2 text-sm text-slate-600">
                <p className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-slate-400" /> {order.partyacc.accountname}
                </p>
                {order.partyacc.channelName && (
                  <p className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-slate-400" /> {order.partyacc.channelName}
                  </p>
                )}
                {order.partyacc.mobile && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-slate-400" /> +91 {order.partyacc.mobile}
                  </p>
                )}
              </div>
            </div>
          )}

          {actionError && (
            <div className="rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{actionError}</div>
          )}

          {/* Order actions — for own orders this is just Edit; for a
              downline sub-party's order (when "Party manages downline" is
              on) this party can also confirm/convert/dispatch/deliver it,
              same as the app. */}
          {canEdit && (
            <button
              onClick={() => navigate(`/account/orders/${order.id}/edit`)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 py-3 text-sm font-semibold text-white hover:bg-brand-800"
            >
              <Pencil className="h-4 w-4" /> Edit Order
            </button>
          )}

          {canConfirm && (
            <button
              onClick={handleConfirm}
              disabled={acting === "confirm"}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" /> {acting === "confirm" ? "Updating…" : "Mark Confirmed"}
            </button>
          )}

          {canConvert && (
            <button
              onClick={handleConvert}
              disabled={acting === "convert"}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-3 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileText className="h-4 w-4" /> {acting === "convert" ? "Updating…" : "Convert to Invoice"}
            </button>
          )}

          {canDispatch && (
            <button
              onClick={handleDispatch}
              disabled={acting === "dispatch"}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Truck className="h-4 w-4" /> {acting === "dispatch" ? "Updating…" : "Mark Dispatched"}
            </button>
          )}

          {canDeliver && (
            <button
              onClick={handleDeliver}
              disabled={acting === "deliver"}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Truck className="h-4 w-4" /> {acting === "deliver" ? "Updating…" : "Mark as Delivered"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
