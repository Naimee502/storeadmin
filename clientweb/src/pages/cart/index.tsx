import { Link } from "react-router";
import { Minus, Plus, Trash2, ShoppingBag, ShieldCheck, ArrowRight, Package } from "lucide-react";
import Breadcrumb from "../../components/breadcrumb";
import { useCart } from "../../contexts/cart";
import { useTenant } from "../../contexts/tenant";
import { useChargePreview } from "../../hooks/useChargePreview";
import { formatPrice } from "../../utils/format";

export default function CartPage() {
  const { lines, updateQty, removeFromCart } = useCart();
  const { displayProductPrice } = useTenant();

  // Exactly the arithmetic the POS cart and the app's party cart use, so one
  // product never shows three different totals across the three surfaces:
  //   subtotal      = rate x qty                     (before discount)
  //   totaldiscount = the unit's own rupee discount x qty
  //   gst           = (rate - discount) x qty x gst%
  //   total         = subtotal - discount + gst + charges
  // MRP is deliberately absent: it is a strike-through on the catalogue, not
  // a number anyone is billed on. Deriving the discount from the MRP gap (the
  // old behaviour here) both overstated the saving and left the payable
  // amount at the undiscounted rate.
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const discount = lines.reduce((sum, l) => sum + (l.discount ?? 0) * l.qty, 0);
  const totalgst = lines.reduce(
    (sum, l) => sum + ((l.price - (l.discount ?? 0)) * l.qty * (l.gst ?? 0)) / 100,
    0
  );

  // Real delivery/handling/COD charges from the admin's Charge Rules module
  // — exact same computeAutoCharges logic the mobile app's party cart uses,
  // instead of the old fake flat ₹49 delivery fee.
  const charges = useChargePreview(subtotal, "party");
  const total = subtotal - discount + totalgst + charges.total;

  if (lines.length === 0) {
    return (
      <div>
        <Breadcrumb items={[{ label: "Cart" }]} />
        <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8">
          <ShoppingBag className="h-16 w-16 text-slate-300" />
          <h1 className="mt-4 text-xl font-bold text-ink-900">Your cart is empty</h1>
          <p className="mt-1 text-sm text-slate-500">Looks like you haven't added anything yet.</p>
          <Link to="/shop" className="mt-6 rounded-lg bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Cart" }]} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-2xl font-bold text-ink-900 sm:text-3xl">Shopping Cart ({lines.length})</h1>

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {lines.map((line) => {
              // Rehydrated-from-localStorage lines have no icon (see CartLine).
              const Icon = line.icon ?? Package;
              return (
                <div key={line.lineId} className="flex gap-4 rounded-2xl border border-slate-100 p-4">
                  {line.imageurl ? (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white p-1.5">
                      <img src={line.imageurl} alt={line.name} className="h-full w-full object-contain" />
                    </div>
                  ) : (
                    <div
                      className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: `linear-gradient(135deg, ${line.from}, ${line.to})` }}
                    >
                      <Icon className="h-9 w-9 text-ink-800/70" />
                    </div>
                  )}

                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-ink-900">{line.name}</h3>
                        {line.categoryName && <p className="text-[11px] text-slate-400">{line.categoryName}</p>}
                        <p className="mt-0.5 text-xs text-slate-500">{line.unit}</p>
                      </div>
                      <button
                        onClick={() => removeFromCart(line.lineId)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-auto flex items-center justify-between pt-2">
                      <div className="flex items-center rounded-lg border border-slate-200">
                        <button
                          onClick={() => updateQty(line.lineId, line.qty - 1)}
                          className="p-2 hover:bg-slate-50"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold">{line.qty}</span>
                        <button
                          onClick={() => updateQty(line.lineId, line.qty + 1)}
                          className="p-2 hover:bg-slate-50"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {displayProductPrice && (
                        <div className="text-right">
                          {/* Same line format as the POS and the app cart:
                              the rate, the discount taken off it, and the GST
                              rate — then the net the customer actually pays. */}
                          <p className="text-[11px] text-slate-500">
                            {formatPrice(line.price)}
                            {(line.discount ?? 0) > 0 ? ` (−${formatPrice(line.discount ?? 0)})` : ""} · GST {line.gst ?? 0}%
                          </p>
                          <p className="text-sm font-bold text-ink-900">
                            {formatPrice((line.price - (line.discount ?? 0)) * line.qty)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <Link to="/shop" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800">
              ← Continue Shopping
            </Link>
          </div>

          {/* Order summary */}
          {displayProductPrice ? (
            <div className="h-fit rounded-2xl border border-slate-100 p-5">
              <h2 className="mb-4 text-base font-bold text-ink-900">Price Details</h2>

              <div className="space-y-2 border-t border-slate-100 pt-4 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal ({lines.length} item{lines.length !== 1 ? "s" : ""})</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total Discount</span>
                  <span className={discount > 0 ? "text-brand-600" : ""}>
                    {discount > 0 ? `−${formatPrice(discount)}` : formatPrice(0)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>GST</span>
                  <span>{formatPrice(totalgst)}</span>
                </div>
                {charges.lines.map((c) => (
                  <div key={c.ruleId} className="flex justify-between text-slate-600">
                    <span>{c.name}</span>
                    <span>{formatPrice(c.totalamount)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex justify-between border-t border-slate-100 pt-4 text-base font-bold text-ink-900">
                <span>Total Payable</span>
                <span>{formatPrice(total)}</span>
              </div>

              <Link
                to="/checkout"
                className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-brand-700 py-3 text-sm font-semibold text-white hover:bg-brand-800"
              >
                Proceed to Checkout <ArrowRight className="h-4 w-4" />
              </Link>

              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5" /> Safe and secure payments
              </p>
            </div>
          ) : (
            <div className="h-fit rounded-2xl border border-slate-100 p-5">
              <Link
                to="/checkout"
                className="flex items-center justify-center gap-2 rounded-lg bg-brand-700 py-3 text-sm font-semibold text-white hover:bg-brand-800"
              >
                Proceed to Checkout <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5" /> Safe and secure payments
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
