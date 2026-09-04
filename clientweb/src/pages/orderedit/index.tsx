import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Navigate, Link } from "react-router";
import { useQuery, useMutation } from "@apollo/client";
import { Package, Minus, Plus, Trash2, PlusCircle, Search, X, Save, Lock, ArrowLeft } from "lucide-react";
import Breadcrumb from "../../components/breadcrumb";
import { useTenant } from "../../contexts/tenant";
import { useAuth } from "../../contexts/auth";
import { useCatalog } from "../../hooks/useCatalog";
import { useChargePreview } from "../../hooks/useChargePreview";
import { useDownline } from "../../hooks/useDownline";
import { GET_SALES_ORDER_BY_ID, EDIT_SALES_ORDER, GET_SALES_ORDERS, GET_ACCOUNT, RESOLVE_PRICE } from "../../graphql/queries/accounts";
import apolloClient from "../../graphql/client";
import { formatPrice } from "../../utils/format";
import { canEditOrder, formatBillNumber } from "../../utils/orders";

type EditLine = {
  productserviceid: string;
  productName: string;
  imageurl: string | null;
  variantid: string | null;
  variantName: string;
  salesunitid: string | null;
  unitName: string;
  unitqty: number;
  qty: number;
  rate: number;
  discount: number;
  gst: number;
};

export default function OrderEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isLoggedIn, account } = useAuth();
  const { adminid, branchid, displayProductPrice } = useTenant();
  const { products } = useCatalog();
  const { isOwnOrDownline, manageDownline } = useDownline();

  const { data, loading } = useQuery(GET_SALES_ORDER_BY_ID, {
    variables: { id },
    skip: !id,
    fetchPolicy: "network-only",
  });
  const [editSalesOrder] = useMutation(EDIT_SALES_ORDER);

  const rawOrder = data?.getSalesOrderById;
  // Own order or (when downline management is on) a sub-party's order —
  // mirrors the app's OrderDetail canEdit rule exactly.
  const order = rawOrder && isOwnOrDownline(rawOrder.partyacc?.id) ? rawOrder : null;
  const orderPartyId = order?.partyacc?.id;

  // The order's OWN party account (self or sub-party) — its channel/region
  // is what resolvePrice needs, same as clientapp's OrderEdit fetching
  // `partyAccount` for whichever party the order actually belongs to.
  const { data: partyAccountData } = useQuery(GET_ACCOUNT, {
    variables: { id: orderPartyId, adminId: adminid },
    skip: !orderPartyId || !adminid,
  });
  const orderPartyAccount = partyAccountData?.getAccountById;

  const [lines, setLines] = useState<EditLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!order) return;
    setLines(
      (order.productservice || []).map((p: any) => ({
        productserviceid: p.productserviceid?.id,
        productName: p.productserviceid?.name || "Item",
        imageurl: p.productserviceid?.imageurl || null,
        variantid: p.variantid?.id || null,
        variantName: p.variantid?.name || "",
        salesunitid: p.salesunitid?.id || null,
        unitName: p.salesunitid?.unitname || "",
        unitqty: p.unitqty ?? 1,
        qty: p.qty ?? 0,
        rate: p.rate ?? 0,
        discount: p.discount ?? 0,
        gst: p.gst ?? 0,
      }))
    );
  }, [order]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + l.qty * l.rate, 0);
    const totaldiscount = lines.reduce((s, l) => s + l.qty * (l.discount || 0), 0);
    const totalgst = lines.reduce((s, l) => s + ((l.rate - (l.discount || 0)) * l.qty * (l.gst || 0)) / 100, 0);
    const totalamount = subtotal - totaldiscount + totalgst;
    return { subtotal, totaldiscount, totalgst, totalamount };
  }, [lines]);

  // Preview of the admin's auto-charges — display only, the server
  // re-evaluates and applies the same rules itself when the edit is saved.
  const charges = useChargePreview(totals.subtotal, order?.createdby_type || "party");
  const grandTotal = totals.totalamount + charges.total;

  const setQty = (idx: number, qty: number) => {
    setLines((prev) => {
      if (qty <= 0) return prev.filter((_, i) => i !== idx);
      return prev.map((l, i) => (i === idx ? { ...l, qty } : l));
    });
  };

  const addProduct = async (product: any, unitLabel: string) => {
    const up = product.unitPrices?.find((u: any) => u.label === unitLabel) ?? product.unitPrices?.[0];
    if (!up) return;

    let rate = up.price;
    // The unit's own rupee discount, same as the POS and the app. Never the
    // MRP gap — MRP is a strike-through, not a billed number.
    let discount = up.discount ?? 0;

    // Party-specific / channel / region price assignment for whichever
    // party this order belongs to — same resolvePrice lookup clientapp's
    // OrderEdit makes before adding a line.
    if (orderPartyId && product.variantid && up.unitid) {
      try {
        const { data: pd } = await apolloClient.query({
          query: RESOLVE_PRICE,
          variables: {
            productid: product.id,
            variantid: product.variantid,
            unitid: up.unitid,
            adminid: adminid || null,
            accountid: orderPartyId,
            channelid: orderPartyAccount?.channel?.id ?? null,
            region: orderPartyAccount?.region ?? null,
          },
          fetchPolicy: "network-only",
        });
        const rp = pd?.resolvePrice;
        if (rp) {
          if (rp.rate != null) rate = rp.rate;
          if (rp.discount != null && rp.discount > 0) discount = rp.discount;
        }
      } catch {
        // fall back to the base unit price
      }
    }

    const newLine: EditLine = {
      productserviceid: product.id,
      productName: product.name,
      imageurl: product.imageurl || null,
      variantid: product.variantid || null,
      variantName: "",
      salesunitid: up.unitid || null,
      unitName: up.label,
      unitqty: up.unitQuantity ?? 1,
      qty: 1,
      rate,
      discount,
      gst: product.gst ?? 0,
    };
    setLines((prev) => {
      const idx = prev.findIndex(
        (l) => l.productserviceid === newLine.productserviceid && l.salesunitid === newLine.salesunitid
      );
      if (idx >= 0) return prev.map((l, i) => (i === idx ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, newLine];
    });
  };

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const handleSave = async () => {
    if (!order || !adminid || !branchid) return;
    if (lines.length === 0) {
      setError("Order must have at least one item.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await editSalesOrder({
        variables: {
          id: order.id,
          input: {
            adminid,
            branchid,
            partyacc: order.partyacc?.id,
            paymenttype: order.paymenttype || "cash",
            billdate: order.billdate || new Date().toISOString().slice(0, 10),
            billtype: order.billtype || "order",
            taxorsupplytype: order.taxorsupplytype || "regular",
            isservice: !!order.isservice,
            subtotal: totals.subtotal,
            totaldiscount: totals.totaldiscount,
            totalgst: totals.totalgst,
            totalamount: totals.totalamount,
            createdby_id: account?.id,
            createdby_name: account?.name,
            createdby_type: "party",
            productservice: lines.map((l) => ({
              productserviceid: l.productserviceid,
              variantid: l.variantid,
              salesunitid: l.salesunitid,
              unitqty: l.unitqty ?? 1,
              gst: l.gst ?? 0,
              qty: l.qty,
              rate: l.rate,
              amount: (l.rate - (l.discount || 0)) * l.qty,
              discount: l.discount ?? 0,
            })),
          },
        },
        refetchQueries: [
          { query: GET_SALES_ORDERS, variables: { adminid, partyacc: account?.id, includeDownline: manageDownline } },
        ],
      });
      navigate(`/account/orders/${order.id}`);
    } catch (err: any) {
      setError(err?.message || "Failed to update order. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div>
        <Breadcrumb items={[{ label: "My Account", to: "/account" }, { label: "Edit Order" }]} />
        <p className="py-24 text-center text-sm text-slate-400">Loading order…</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div>
        <Breadcrumb items={[{ label: "My Account", to: "/account" }, { label: "Edit Order" }]} />
        <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
          <Lock className="h-14 w-14 text-slate-300" />
          <h1 className="mt-4 text-xl font-bold text-ink-900">Order not found</h1>
          <Link to="/account?tab=orders" className="mt-6 rounded-lg bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
            Back to My Orders
          </Link>
        </div>
      </div>
    );
  }

  if (!canEditOrder(order)) {
    return (
      <div>
        <Breadcrumb items={[{ label: "My Account", to: "/account" }, { label: "Edit Order" }]} />
        <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
          <Lock className="h-14 w-14 text-slate-300" />
          <h1 className="mt-4 text-xl font-bold text-ink-900">This order can't be edited</h1>
          <p className="mt-1 text-sm text-slate-500">
            {order.isConverted
              ? "It's already been converted to an invoice."
              : "It has been cancelled."}
          </p>
          <Link
            to={`/account/orders/${order.id}`}
            className="mt-6 rounded-lg bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
          >
            View Order
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "My Account", to: "/account" }, { label: `Edit ${formatBillNumber(order)}` }]} />

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate(`/account/orders/${order.id}`)}
          className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" /> Cancel Editing
        </button>

        <h1 className="mb-5 text-xl font-bold text-ink-900">Edit {formatBillNumber(order)}</h1>

        <div className="space-y-3">
          {lines.map((l, idx) => (
            <div key={`${l.productserviceid}-${l.salesunitid}-${idx}`} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-brand-50">
                {l.imageurl ? (
                  <img src={l.imageurl} alt="" className="h-full w-full object-contain" />
                ) : (
                  <Package className="h-5 w-5 text-brand-600" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-900">{l.productName}</p>
                <p className="text-xs font-medium text-brand-600">{[l.variantName, l.unitName].filter(Boolean).join(" · ") || "—"}</p>
                {displayProductPrice && (
                  <p className="text-xs text-slate-500">
                    {formatPrice(l.rate)}
                    {l.discount > 0 ? ` (−${formatPrice(l.discount)})` : ""} · GST {l.gst}%
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center rounded-lg border border-slate-200">
                  <button onClick={() => setQty(idx, l.qty - 1)} className="p-1.5 hover:bg-slate-50" aria-label="Decrease quantity">
                    {l.qty <= 1 ? <Trash2 className="h-3.5 w-3.5 text-rose-500" /> : <Minus className="h-3.5 w-3.5" />}
                  </button>
                  <span className="w-7 text-center text-sm font-semibold">{l.qty}</span>
                  <button onClick={() => setQty(idx, l.qty + 1)} className="p-1.5 hover:bg-slate-50" aria-label="Increase quantity">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                {displayProductPrice && <p className="text-sm font-bold text-ink-900">{formatPrice((l.rate - l.discount) * l.qty)}</p>}
              </div>
            </div>
          ))}

          <button
            onClick={() => setPickerOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-300 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            <PlusCircle className="h-4.5 w-4.5" /> Add Product
          </button>

          {displayProductPrice && (
            <div className="rounded-2xl border border-slate-100 p-5">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatPrice(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Discount</span>
                  <span className="text-brand-600">−{formatPrice(totals.totaldiscount)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>GST</span>
                  <span>{formatPrice(totals.totalgst)}</span>
                </div>
                {charges.lines.map((c) => (
                  <div key={c.ruleId} className="flex justify-between text-slate-600">
                    <span>{c.name}</span>
                    <span>{formatPrice(c.totalamount)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-base font-bold text-ink-900">
                <span>Total</span>
                <span>{formatPrice(grandTotal)}</span>
              </div>
            </div>
          )}

          {error && <div className="rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{error}</div>}

          <button
            onClick={handleSave}
            disabled={saving || lines.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {saving ? "Saving…" : displayProductPrice ? `Save Changes · ${formatPrice(grandTotal)}` : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Add-product picker */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setPickerOpen(false)}>
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <h2 className="text-base font-bold text-ink-900">Add Product</h2>
              <button onClick={() => setPickerOpen(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-50">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products…"
                className="w-full text-sm outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-4">
              {filteredProducts.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">No products found.</p>
              ) : (
                <div className="space-y-3">
                  {filteredProducts.map((p) => (
                    <div key={p.id} className="border-b border-slate-100 pb-3 last:border-0">
                      <p className="text-sm font-semibold text-ink-900">{p.name}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(p.unitPrices ?? []).length === 0 && (
                          <span className="text-xs text-slate-400">No unit price configured</span>
                        )}
                        {(p.unitPrices ?? []).map((u, ui) => (
                          <button
                            key={ui}
                            onClick={() => addProduct(p, u.label)}
                            className="flex items-center gap-1 rounded-full border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                          >
                            <Plus className="h-3 w-3" /> {u.label}
                            {displayProductPrice && ` · ${formatPrice(u.price)}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
