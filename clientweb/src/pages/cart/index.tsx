import { useState } from "react";
import { Link } from "react-router";
import { Minus, Plus, Trash2, ShoppingBag, Tag, ShieldCheck, ArrowRight } from "lucide-react";
import Breadcrumb from "../../components/breadcrumb";
import { useCart } from "../../contexts/cart";
import { formatPrice } from "../../utils/format";

const FREE_DELIVERY_THRESHOLD = 999;
const DELIVERY_FEE = 49;

export default function CartPage() {
  const { lines, updateQty, removeFromCart } = useCart();
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);

  const itemsTotal = lines.reduce((sum, l) => sum + l.mrp * l.qty, 0);
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const discount = itemsTotal - subtotal;
  const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD || subtotal === 0 ? 0 : DELIVERY_FEE;
  const couponDiscount = couponApplied ? Math.round(subtotal * 0.05) : 0;
  const total = subtotal + deliveryFee - couponDiscount;

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
              const Icon = line.icon;
              return (
                <div key={line.lineId} className="flex gap-4 rounded-2xl border border-slate-100 p-4">
                  <div
                    className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: `linear-gradient(135deg, ${line.from}, ${line.to})` }}
                  >
                    <Icon className="h-9 w-9 text-ink-800/70" />
                  </div>

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

                      <div className="text-right">
                        <p className="text-sm font-bold text-ink-900">{formatPrice(line.price * line.qty)}</p>
                        {line.mrp > line.price && (
                          <p className="text-xs text-slate-400 line-through">{formatPrice(line.mrp * line.qty)}</p>
                        )}
                      </div>
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
          <div className="h-fit rounded-2xl border border-slate-100 p-5">
            <h2 className="mb-4 text-base font-bold text-ink-900">Order Summary</h2>

            <div className="mb-4 flex gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3">
                <Tag className="h-4 w-4 text-slate-400" />
                <input
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder="Coupon code"
                  className="w-full py-2.5 text-sm outline-none placeholder:text-slate-400"
                />
              </div>
              <button
                onClick={() => setCouponApplied(!!coupon)}
                className="rounded-lg bg-ink-900 px-4 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Apply
              </button>
            </div>
            {couponApplied && <p className="mb-3 text-xs font-semibold text-brand-600">Coupon applied — 5% off</p>}

            <div className="space-y-2 border-t border-slate-100 pt-4 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Price ({lines.length} items)</span>
                <span>{formatPrice(itemsTotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Discount</span>
                <span className="text-brand-600">−{formatPrice(discount)}</span>
              </div>
              {couponApplied && (
                <div className="flex justify-between text-slate-600">
                  <span>Coupon discount</span>
                  <span className="text-brand-600">−{formatPrice(couponDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Delivery Fee</span>
                <span className={deliveryFee === 0 ? "text-brand-600" : ""}>
                  {deliveryFee === 0 ? "FREE" : formatPrice(deliveryFee)}
                </span>
              </div>
            </div>

            <div className="mt-4 flex justify-between border-t border-slate-100 pt-4 text-base font-bold text-ink-900">
              <span>Total Amount</span>
              <span>{formatPrice(total)}</span>
            </div>

            {deliveryFee > 0 && (
              <p className="mt-2 text-xs text-slate-500">
                Add {formatPrice(FREE_DELIVERY_THRESHOLD - subtotal)} more for free delivery
              </p>
            )}

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
        </div>
      </div>
    </div>
  );
}
