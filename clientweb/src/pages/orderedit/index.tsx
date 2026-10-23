import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Navigate, Link } from "react-router";
import { useQuery, useMutation } from "@apollo/client";
import { Package, Minus, Plus, Trash2, PlusCircle, Search, X, Save, Lock, ArrowLeft, Check, Images } from "lucide-react";
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
import { useImageFallback } from "../../utils/useimagefallback";
import ProductImageViewer, { productImages } from "../../components/productimageviewer";

/**
 * Product photo with the package icon as the DEFAULT — the photo replaces it
 * only once it has actually loaded, so a missing / dead image never shows as a
 * broken or blank box. Optional photo-count badge and click (→ viewer).
 */
function ProductThumb({ url, count = 0, size, onOpen, outOfStock = false }: {
  url?: string | null; count?: number; size: string; onOpen?: () => void; outOfStock?: boolean;
}) {
  const image = useImageFallback(url);
  const clickable = !!onOpen && !!url;
  return (
    <button
      type="button"
      onClick={clickable ? onOpen : undefined}
      disabled={!clickable}
      className={`relative flex shrink-0 items-center justify-center self-start overflow-hidden rounded-xl bg-brand-50 ${size} ${clickable ? "cursor-zoom-in" : "cursor-default"}`}
    >
      {!image.showImage && <Package className="h-6 w-6 text-brand-600" />}
      {image.mountImage && url && (
        <img
          src={url}
          alt=""
          {...image.imgProps}
          className={`absolute inset-0 h-full w-full object-cover ${image.showImage ? "opacity-100" : "opacity-0"}`}
        />
      )}
      {count > 1 && (
        <span className="absolute right-1 top-1 flex items-center gap-0.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          <Images className="h-3 w-3" /> {count}
        </span>
      )}
      {outOfStock && (
        <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[10px] font-semibold text-white">Out</span>
      )}
    </button>
  );
}

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
  const { adminid, branchid, displayProductPrice, restrictQuantityByStock } = useTenant();
  const { products, categories } = useCatalog();
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
  const [pickerCategory, setPickerCategory] = useState<string | null>(null);
  // Unit picked on each catalogue card (index into product.unitPrices).
  const [pickerUnits, setPickerUnits] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState<{ images: string[]; title: string } | null>(null);

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
    return products
      .filter((p) => !pickerCategory || p.category === pickerCategory)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.categoryName || "").toLowerCase().includes(q));
  }, [products, search, pickerCategory]);

  // The catalogue's Add / − / + work on the order lines themselves.
  const lineIndexFor = (productId: string, unitid: string | null | undefined) =>
    lines.findIndex((l) => l.productserviceid === productId && (l.salesunitid || null) === (unitid || null));

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
              <ProductThumb url={l.imageurl} size="h-11 w-11" />
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

      {/* Add-product picker — same catalogue cards as the shop. */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 sm:items-center sm:p-6" onClick={() => setPickerOpen(false)}>
          <div
            className="flex h-full w-full max-w-3xl flex-col overflow-hidden bg-white sm:h-[90vh] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-ink-900">Add Products</h2>
                {order.partyacc?.name && (
                  <p className="text-xs text-slate-500">Adding to {formatBillNumber(order)} for {order.partyacc.name}</p>
                )}
              </div>
              <button onClick={() => setPickerOpen(false)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-50" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 border-b border-slate-100 px-5 py-3">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products…"
                  className="w-full text-sm outline-none placeholder:text-slate-400"
                />
              </div>
              {categories.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {[{ id: null as string | null, name: "All" }, ...categories.map((c) => ({ id: c.id as string | null, name: c.name }))].map((c) => {
                    const active = pickerCategory === c.id;
                    return (
                      <button
                        key={c.id ?? "all"}
                        onClick={() => setPickerCategory(c.id)}
                        className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold ${
                          active ? "border-brand-700 bg-brand-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-brand-300"
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-5">
              {filteredProducts.length === 0 ? (
                <p className="py-16 text-center text-sm text-slate-400">No products found.</p>
              ) : (
                <div className="space-y-2.5">
                  {filteredProducts.map((p) => {
                    const units = p.unitPrices ?? [];
                    const ui = Math.min(pickerUnits[p.id] ?? 0, Math.max(0, units.length - 1));
                    const u = units[ui];
                    const idx = u ? lineIndexFor(p.id, u.unitid) : -1;
                    const qty = idx >= 0 ? lines[idx].qty : 0;
                    const stock = p.variantStock;
                    const outOfStock = typeof stock === "number" && stock <= 0;
                    const canAdd = !!u && !(restrictQuantityByStock && outOfStock);
                    const imgs = productImages(p);
                    return (
                      <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm">
                        <ProductThumb
                          url={imgs[0]}
                          count={imgs.length}
                          size="h-20 w-20"
                          outOfStock={outOfStock}
                          onOpen={() => setPreview({ images: imgs, title: p.name })}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink-900">{p.name}</p>
                          {p.categoryName && <p className="truncate text-xs text-slate-500">{p.categoryName}</p>}
                          {displayProductPrice && u && (
                            <div className="mt-1 flex items-baseline gap-2">
                              <span className="text-base font-bold text-brand-700">{formatPrice(u.price)}</span>
                              {u.mrp > u.price && <span className="text-xs text-slate-400 line-through">{formatPrice(u.mrp)}</span>}
                            </div>
                          )}
                          {units.length > 1 && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {units.map((x, i) => (
                                <button
                                  key={`${x.unitid ?? i}`}
                                  onClick={() => setPickerUnits((prev) => ({ ...prev, [p.id]: i }))}
                                  className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${
                                    i === ui ? "border-brand-700 bg-brand-700 text-white" : "border-slate-200 text-slate-700 hover:border-brand-300"
                                  }`}
                                >
                                  {x.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0">
                          {qty > 0 ? (
                            <div className="flex items-center overflow-hidden rounded-xl border-2 border-brand-700">
                              <button onClick={() => setQty(idx, qty - 1)} className="bg-brand-50 px-2.5 py-1.5 text-brand-700 hover:bg-brand-100" aria-label="Decrease quantity">
                                <Minus className="h-4 w-4" />
                              </button>
                              <span className="w-8 text-center text-sm font-bold text-brand-700">{qty}</span>
                              <button onClick={() => setQty(idx, qty + 1)} className="bg-brand-50 px-2.5 py-1.5 text-brand-700 hover:bg-brand-100" aria-label="Increase quantity">
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          ) : canAdd ? (
                            <button
                              onClick={() => addProduct(p, u.label)}
                              className="flex items-center gap-1 rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
                            >
                              <Plus className="h-4 w-4" /> Add
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 bg-white px-5 py-3">
              <button
                onClick={() => setPickerOpen(false)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 py-3 text-sm font-semibold text-white hover:bg-brand-800"
              >
                <Check className="h-4 w-4" />
                Done · {lines.length} item{lines.length === 1 ? "" : "s"}
                {displayProductPrice ? ` · ${formatPrice(grandTotal)}` : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      <ProductImageViewer
        open={!!preview}
        images={preview?.images ?? []}
        title={preview?.title}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}
