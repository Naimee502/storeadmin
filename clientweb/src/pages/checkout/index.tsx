import { useEffect, useState } from "react";
import { Link } from "react-router";
import { CheckCircle2, MapPin, Wallet, Landmark, Smartphone, Building2, Package, Truck } from "lucide-react";
import Breadcrumb from "../../components/breadcrumb";
import { useCart } from "../../contexts/cart";
import { useBusinessSettings } from "../../contexts/businesssettings";
import { formatPrice } from "../../utils/format";

type PaymentMethod = "cod" | "upi" | "card" | "netbanking" | "party";

const paymentMethods: { id: PaymentMethod; label: string; desc: string; icon: typeof Wallet }[] = [
  { id: "upi", label: "UPI", desc: "Google Pay, PhonePe, Paytm & more", icon: Smartphone },
  { id: "card", label: "Credit / Debit Card", desc: "Visa, Mastercard, RuPay", icon: Wallet },
  { id: "netbanking", label: "Net Banking", desc: "All major Indian banks", icon: Landmark },
  { id: "cod", label: "Cash on Delivery", desc: "Pay when your order arrives", icon: Package },
  { id: "party", label: "Bill to my Party / Business Account", desc: "Credit-cycle billing for approved retailers", icon: Building2 },
];

const indianStates = [
  "Gujarat", "Maharashtra", "Rajasthan", "Delhi", "Karnataka", "Tamil Nadu", "Uttar Pradesh", "West Bengal",
];

export default function CheckoutPage() {
  const { lines, subtotal } = useCart();
  const { codOnly } = useBusinessSettings();
  const [payment, setPayment] = useState<PaymentMethod>("upi");
  const [placed, setPlaced] = useState(false);
  const [orderNumber] = useState(() => `#SO${String(Math.floor(1000 + Math.random() * 8999))}`);

  // Business Settings → "Cash on Delivery only" hides every online method,
  // including party-account billing, and locks the selection to COD.
  const visibleMethods = codOnly ? paymentMethods.filter((m) => m.id === "cod") : paymentMethods;

  useEffect(() => {
    if (codOnly) setPayment("cod");
  }, [codOnly]);

  const deliveryFee = subtotal >= 999 || subtotal === 0 ? 0 : 49;
  const total = subtotal + deliveryFee;

  if (placed) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
        <CheckCircle2 className="h-16 w-16 text-brand-600" />
        <h1 className="mt-4 text-2xl font-bold text-ink-900">Order placed successfully!</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your order <span className="font-semibold text-ink-900">{orderNumber}</span> has been received and is pending
          confirmation. You'll get updates by SMS as it's confirmed and dispatched.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/account" className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
            View My Orders
          </Link>
          <Link to="/shop" className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-ink-900 hover:bg-slate-50">
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Cart", to: "/cart" }, { label: "Checkout" }]} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-2xl font-bold text-ink-900 sm:text-3xl">Checkout</h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPlaced(true);
          }}
          className="grid gap-8 lg:grid-cols-[1fr_360px]"
        >
          <div className="space-y-6">
            {/* Delivery address */}
            <div className="rounded-2xl border border-slate-100 p-5">
              <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-ink-900">
                <MapPin className="h-4.5 w-4.5 text-brand-600" /> Delivery Address
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full Name" required defaultValue="Tejas Nariya" />
                <Field label="Mobile Number" required type="tel" defaultValue="98765 43210" />
                <div className="sm:col-span-2">
                  <Field label="Address (Shop / House No, Street, Area)" required />
                </div>
                <Field label="City" required defaultValue="Ahmedabad" />
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-900">State</label>
                  <select
                    required
                    defaultValue="Gujarat"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                  >
                    {indianStates.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <Field label="Pincode" required defaultValue="380001" />
                <Field label="GSTIN (optional, for business accounts)" />
              </div>
            </div>

            {/* Payment */}
            <div className="rounded-2xl border border-slate-100 p-5">
              <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-ink-900">
                <Wallet className="h-4.5 w-4.5 text-brand-600" /> Payment Method
              </h2>
              {codOnly && (
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-700">
                  <Truck className="h-4 w-4" /> This store accepts Cash on Delivery only — set in Business Settings.
                </div>
              )}
              <div className="space-y-2.5">
                {visibleMethods.map(({ id, label, desc, icon: Icon }) => (
                  <label
                    key={id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition ${
                      payment === id ? "border-brand-600 bg-brand-50" : "border-slate-200 hover:border-brand-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      checked={payment === id}
                      onChange={() => setPayment(id)}
                      className="h-4 w-4 text-brand-600 focus:ring-brand-500"
                    />
                    <Icon className="h-5 w-5 text-ink-700" />
                    <div>
                      <p className="text-sm font-semibold text-ink-900">{label}</p>
                      <p className="text-xs text-slate-500">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Order summary */}
          <div className="h-fit space-y-4">
            <div className="rounded-2xl border border-slate-100 p-5">
              <h2 className="mb-4 text-base font-bold text-ink-900">Order Summary</h2>
              <div className="mb-4 max-h-56 space-y-3 overflow-y-auto">
                {lines.map((line) => {
                  const Icon = line.icon;
                  return (
                    <div key={line.lineId} className="flex items-center gap-3">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: `linear-gradient(135deg, ${line.from}, ${line.to})` }}
                      >
                        <Icon className="h-6 w-6 text-ink-800/70" />
                      </div>
                      <div className="flex-1">
                        <p className="line-clamp-1 text-sm font-medium text-ink-900">{line.name}</p>
                        <p className="text-xs text-slate-500">
                          {line.unit} × {line.qty}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-ink-900">{formatPrice(line.price * line.qty)}</p>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-4 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Delivery Fee</span>
                  <span className={deliveryFee === 0 ? "text-brand-600" : ""}>
                    {deliveryFee === 0 ? "FREE" : formatPrice(deliveryFee)}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-base font-bold text-ink-900">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={lines.length === 0}
              className="w-full rounded-lg bg-brand-700 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Place Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  type = "text",
  defaultValue,
}: {
  label: string;
  required?: boolean;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink-900">{label}</label>
      <input
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
      />
    </div>
  );
}
