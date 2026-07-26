import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation } from "@apollo/client";
import { CheckCircle2, Wallet, Landmark, Smartphone, Building2, Package, Truck, LogIn } from "lucide-react";
import Breadcrumb from "../../components/breadcrumb";
import { useCart } from "../../contexts/cart";
import { useTenant } from "../../contexts/tenant";
import { useAuth } from "../../contexts/auth";
import { useBusinessSettings } from "../../contexts/businesssettings";
import { useChargePreview } from "../../hooks/useChargePreview";
import { useDownline } from "../../hooks/useDownline";
import { ADD_SALES_ORDER, GET_SALES_ORDERS } from "../../graphql/queries/accounts";
import { formatPrice } from "../../utils/format";

type PaymentMethod = "cod" | "upi" | "card" | "netbanking" | "party";

const paymentMethods: { id: PaymentMethod; label: string; desc: string; icon: typeof Wallet }[] = [
  { id: "upi", label: "UPI", desc: "Google Pay, PhonePe, Paytm & more", icon: Smartphone },
  { id: "card", label: "Credit / Debit Card", desc: "Visa, Mastercard, RuPay", icon: Wallet },
  { id: "netbanking", label: "Net Banking", desc: "All major Indian banks", icon: Landmark },
  { id: "cod", label: "Cash on Delivery", desc: "Pay when your order arrives", icon: Package },
  { id: "party", label: "Bill to my Party / Business Account", desc: "Credit-cycle billing for approved retailers", icon: Building2 },
];

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { lines, subtotal, clearCart } = useCart();
  const { codOnly } = useBusinessSettings();
  const { adminid, branchid, displayProductPrice } = useTenant();
  const { isLoggedIn, account } = useAuth();
  const { manageDownline } = useDownline();
  const [payment, setPayment] = useState<PaymentMethod>("upi");
  const [placedOrder, setPlacedOrder] = useState<{ billnumber?: string } | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addSalesOrder] = useMutation(ADD_SALES_ORDER);

  // Business Settings → "Cash on Delivery only" hides every online method,
  // including party-account billing, and locks the selection to COD.
  const visibleMethods = codOnly ? paymentMethods.filter((m) => m.id === "cod") : paymentMethods;

  useEffect(() => {
    if (codOnly) setPayment("cod");
  }, [codOnly]);

  const totaldiscount = lines.reduce((sum, l) => sum + (l.mrp - l.price) * l.qty, 0);
  const totalgst = lines.reduce((sum, l) => sum + (l.price * l.qty * (l.gst ?? 0)) / 100, 0);

  // Real delivery/handling/COD charges — same Charge Rules module +
  // computeAutoCharges logic the app's party checkout uses, instead of a
  // fake flat delivery fee. Display-only preview; the server computes and
  // applies these itself when the order is created.
  const charges = useChargePreview(subtotal, "party", payment === "cod" ? "cash" : payment);
  const total = subtotal + totalgst + charges.total;

  const handlePlaceOrder = async () => {
    if (!isLoggedIn || !account) {
      navigate("/login?redirect=/checkout");
      return;
    }
    if (!adminid || !branchid) {
      setError("Store is still loading — please try again in a moment.");
      return;
    }
    if (lines.length === 0) return;

    setError(null);
    setPlacing(true);
    try {
      const { data } = await addSalesOrder({
        variables: {
          input: {
            adminid,
            branchid,
            partyacc: account.id,
            paymenttype: payment === "cod" ? "cash" : payment,
            billdate: new Date().toISOString().slice(0, 10),
            billtype: "order",
            taxorsupplytype: "regular",
            isservice: false,
            subtotal,
            totaldiscount,
            totalgst,
            totalamount: total,
            createdby_id: account.id,
            createdby_name: account.name,
            createdby_type: "party",
            productservice: lines.map((l) => ({
              productserviceid: l.productId,
              variantid: l.variantid,
              salesunitid: l.unitid,
              qty: l.qty,
              unitqty: l.unitqty ?? l.qty,
              rate: l.price,
              discount: l.mrp > l.price ? l.mrp - l.price : 0,
              amount: l.price * l.qty,
              gst: l.gst ?? 0,
            })),
          },
        },
        refetchQueries: [
          { query: GET_SALES_ORDERS, variables: { adminid, partyacc: account.id, includeDownline: manageDownline } },
        ],
      });
      setPlacedOrder({ billnumber: data?.addSalesOrder?.billnumber });
      clearCart();
    } catch (err: any) {
      setError(err?.message || "Failed to place order. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  if (placedOrder) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
        <CheckCircle2 className="h-16 w-16 text-brand-600" />
        <h1 className="mt-4 text-2xl font-bold text-ink-900">Order placed successfully!</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your order{" "}
          {placedOrder.billnumber && <span className="font-semibold text-ink-900">#{placedOrder.billnumber}</span>} has
          been received and is pending confirmation. You'll get updates as it's confirmed and dispatched.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/account?tab=orders" className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
            View My Orders
          </Link>
          <Link to="/shop" className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-ink-900 hover:bg-slate-50">
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div>
        <Breadcrumb items={[{ label: "Cart", to: "/cart" }, { label: "Checkout" }]} />
        <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
          <LogIn className="h-14 w-14 text-slate-300" />
          <h1 className="mt-4 text-xl font-bold text-ink-900">Please login to continue</h1>
          <p className="mt-1 text-sm text-slate-500">
            You need to be logged in with your registered account to place an order.
          </p>
          <Link
            to="/login?redirect=/checkout"
            className="mt-6 rounded-lg bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Login to Checkout
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
            handlePlaceOrder();
          }}
          className="grid gap-8 lg:grid-cols-[1fr_360px]"
        >
          <div className="space-y-6">
            {/* Account */}
            <div className="rounded-2xl border border-slate-100 p-5">
              <h2 className="mb-1 text-base font-bold text-ink-900">Delivering to</h2>
              <p className="text-sm text-ink-900">{account?.name}</p>
              <p className="text-sm text-slate-500">+91 {account?.mobile}</p>
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
                      {line.imageurl ? (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-white p-1">
                          <img src={line.imageurl} alt={line.name} className="h-full w-full object-contain" />
                        </div>
                      ) : (
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
                          style={{ background: `linear-gradient(135deg, ${line.from}, ${line.to})` }}
                        >
                          <Icon className="h-6 w-6 text-ink-800/70" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="line-clamp-1 text-sm font-medium text-ink-900">{line.name}</p>
                        <p className="text-xs text-slate-500">
                          {line.unit} × {line.qty}
                        </p>
                      </div>
                      {displayProductPrice && (
                        <p className="text-sm font-semibold text-ink-900">{formatPrice(line.price * line.qty)}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {displayProductPrice && (
                <>
                  <div className="space-y-2 border-t border-slate-100 pt-4 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal</span>
                      <span>{formatPrice(subtotal)}</span>
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
                  <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-base font-bold text-ink-900">
                    <span>Total</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                </>
              )}
            </div>

            {error && (
              <div className="rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{error}</div>
            )}

            <button
              type="submit"
              disabled={lines.length === 0 || placing}
              className="w-full rounded-lg bg-brand-700 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {placing ? "Placing Order…" : "Place Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
