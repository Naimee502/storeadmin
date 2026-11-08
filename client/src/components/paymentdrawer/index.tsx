// PaymentDrawer: payment mode, paid amount and change for a POS sale (customer is picked in the cart).

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import FormField from "../formfiled";

interface PaymentDrawerProps {
  open: boolean;
  onClose: () => void;
  total: number;
  onComplete: (data: CompletePaymentData) => void;
  variant?: "default" | "pos";
  actionLabel?: string;
}

interface CompletePaymentData {
  paymentType: PaymentMode;
  paidAmount: number;
  balance: number;
}

type PaymentMode = "cash" | "bank" | "credit" | "upi" | "card" | "cheque" | "other";

type ErrorState = Partial<{
  paymentType: string;
  paidAmount: string;
}>;

export default function PaymentDrawer({
  open,
  onClose,
  total,
  onComplete,
  variant = "default",
  actionLabel = "Complete Order",
}: PaymentDrawerProps) {
  const [paymentType, setPaymentType] = useState<PaymentMode>("cash");
  const [paidAmount, setPaidAmount] = useState<number | "">(total);
  const [errors, setErrors] = useState<ErrorState>({});
  const [amountText, setAmountText] = useState("");

  const numericPaid = paidAmount === "" ? 0 : paidAmount;
  const balance = numericPaid - total;

  // Reset paid amount each time the drawer opens so it tracks the current cart
  useEffect(() => {
    if (open) {
      setPaidAmount(total);
      setAmountText(String(total));
      setErrors({});
    }
  }, [open, total]);

  const validate = (): boolean => {
    const newErrors: ErrorState = {};

    if (!paymentType) newErrors.paymentType = "Select payment mode.";

    if (paidAmount === "" || isNaN(Number(paidAmount))) {
      newErrors.paidAmount = "Paid amount is required.";
    } else if (Number(paidAmount) < 0) {
      newErrors.paidAmount = "Amount cannot be negative.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleComplete = () => {
    if (!validate()) return;

    const finalPaid = Number(paidAmount);

    onComplete({
      paymentType,
      paidAmount: finalPaid,
      balance: finalPaid - total,
    });
  };

  /* POS keypad helpers (keypad + keyboard feed the same amount) */
  const setAmount = (n: number) => {
    setAmountText(String(n));
    setPaidAmount(n);
    setErrors((prev) => ({ ...prev, paidAmount: undefined }));
  };

  const pressKey = (k: string) => {
    let next = amountText;
    if (k === "C") {
      next = "";
    } else if (k === "⌫") {
      next = amountText.slice(0, -1);
    } else if (k === ".") {
      if (amountText.includes(".")) return;
      next = (amountText || "0") + ".";
    } else {
      // digits / "00"
      if (amountText === "" || amountText === "0") {
        next = k === "00" ? "0" : k;
      } else {
        const decimals = amountText.includes(".") ? amountText.split(".")[1].length : 0;
        if (decimals >= 2) return;
        next = amountText + k;
      }
    }
    setAmountText(next);
    const n = parseFloat(next);
    setPaidAmount(next === "" || isNaN(n) ? "" : n);
    setErrors((prev) => ({ ...prev, paidAmount: undefined }));
  };

  // Keyboard support while the POS payment screen is open
  useEffect(() => {
    if (!open || variant !== "pos") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") pressKey(e.key);
      else if (e.key === ".") pressKey(".");
      else if (e.key === "Backspace") pressKey("⌫");
      else if (e.key === "Delete") pressKey("C");
      else if (e.key === "Enter") {
        e.preventDefault();
        handleComplete();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (variant === "pos") {
    const fmt = (n: number) =>
      n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const modes: { value: PaymentMode; label: string }[] = [
      { value: "cash", label: "Cash" },
      { value: "upi", label: "UPI" },
      { value: "card", label: "Card" },
      { value: "bank", label: "Bank" },
      { value: "credit", label: "Credit" },
      { value: "cheque", label: "Cheque" },
      { value: "other", label: "Other" },
    ];
    const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "00", "0", "."];
    const denoms = [100, 200, 500, 2000];
    const captionCls = "text-[11px] uppercase tracking-wide font-medium text-slate-500 mb-1";
    const keyCls =
      "h-9 rounded border border-slate-300 !bg-white hover:!bg-slate-100 active:!bg-slate-200 text-sm font-medium text-slate-800 cursor-pointer";
    const chip = (on: boolean) =>
      `h-8 rounded border text-xs font-medium cursor-pointer transition ${
        on ? "!bg-[#4f46e5] !text-white !border-[#4f46e5]" : "!bg-white !text-slate-700 !border-slate-300 hover:!bg-slate-100"
      }`;

    return (
      <div
        onClick={onClose}
        className={`fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-3 transition ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white w-full max-w-[600px] rounded-lg shadow-2xl border border-slate-300 font-sans text-sm text-slate-800 tabular-nums flex flex-col"
        >
          {/* Header */}
          <div className="h-10 px-4 bg-slate-100 border-b border-slate-300 flex items-center justify-between rounded-t-lg">
            <div className="font-semibold text-sm">Receive Payment</div>
            <button onClick={onClose} className="!bg-transparent text-slate-500 hover:text-slate-900 cursor-pointer">
              <X size={16} />
            </button>
          </div>

          <div className="grid md:grid-cols-[1fr_220px]">
            {/* LEFT: amounts, mode, quick cash, received */}
            <div className="p-4 space-y-3">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className={captionCls}>Amount Payable</div>
                  <div className="font-mono text-2xl font-bold text-slate-900">₹ {fmt(total)}</div>
                </div>
                <div className="text-right">
                  <div className={captionCls}>{balance < 0 ? "Balance Due" : "Change to Return"}</div>
                  <div className={`font-mono text-2xl font-bold ${balance < 0 ? "text-red-600" : "text-emerald-700"}`}>
                    ₹ {fmt(Math.abs(balance))}
                  </div>
                </div>
              </div>

              <div>
                <div className={captionCls}>Payment Mode</div>
                <div className="grid grid-cols-4 gap-2">
                  {modes.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => {
                        setPaymentType(m.value);
                        setErrors((prev) => ({ ...prev, paymentType: undefined }));
                      }}
                      className={chip(paymentType === m.value)}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                {errors.paymentType && <div className="text-red-600 text-xs mt-1">{errors.paymentType}</div>}
              </div>

              <div>
                <div className={captionCls}>Quick Amount</div>
                <div className="grid grid-cols-5 gap-2">
                  <button type="button" onClick={() => setAmount(total)} className={chip(numericPaid === total)}>
                    Exact
                  </button>
                  {denoms.map((d) => (
                    <button key={d} type="button" onClick={() => setAmount(d)} className={chip(numericPaid === d)}>
                      ₹{d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className={captionCls}>Amount Received</div>
                <div
                  className={`h-11 px-3 border-2 rounded flex items-center justify-end font-mono text-xl font-semibold bg-white ${
                    errors.paidAmount ? "border-red-500" : "border-[#4f46e5]"
                  }`}
                >
                  <span className="text-slate-400 text-xl mr-2">₹</span>
                  {amountText || "0"}
                </div>
                {errors.paidAmount && <div className="text-red-600 text-xs mt-1">{errors.paidAmount}</div>}
              </div>
            </div>

            {/* RIGHT: keypad */}
            <div className="p-3 bg-slate-50 border-t md:border-t-0 md:border-l border-slate-300 flex flex-col gap-2 rounded-br-lg">
              <div className="grid grid-cols-3 gap-2">
                {keys.map((k) => (
                  <button key={k} type="button" onClick={() => pressKey(k)} className={keyCls}>
                    {k}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => pressKey("C")}
                  className="h-9 rounded border border-red-200 !bg-white hover:!bg-red-50 !text-red-700 font-medium text-sm cursor-pointer"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => pressKey("⌫")}
                  className="h-9 rounded border border-slate-300 !bg-white hover:!bg-slate-100 !text-slate-700 font-medium text-sm cursor-pointer"
                >
                  ⌫ Back
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-300 px-4 py-3 bg-slate-50 rounded-b-lg flex items-center justify-between gap-3">
            <div className="text-[11px] text-slate-500 hidden sm:block">
              Digits to enter amount · Enter to save · Esc to cancel
            </div>
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 rounded border !border-slate-300 !bg-white hover:!bg-slate-100 !text-slate-700 font-medium text-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleComplete}
                className="h-9 px-6 rounded !bg-[#4f46e5] hover:!bg-[#4338ca] !text-white font-semibold text-sm cursor-pointer"
              >
                {actionLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={onClose}
        ></div>
      )}

      <div
        className={`
          fixed top-0 right-0 h-full w-full md:w-[420px] bg-white
          shadow-xl z-50 p-5 transform transition-transform duration-300
          ${open ? "translate-x-0" : "translate-x-full"}
        `}
      >
        <div className="flex justify-between items-center mb-5 pb-3 border-b">
          <h2 className="text-lg font-semibold">Complete Payment</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-black">
            <X />
          </button>
        </div>

        {/* PAYMENT MODE */}
        <FormField
          label="Payment Type"
          name="paymentType"
          type="select"
          value={paymentType}
          onChange={(e) => setPaymentType(e.target.value as PaymentMode)}
          options={[
            { value: "cash", label: "Cash" },
            { value: "bank", label: "Bank" },
            { value: "credit", label: "Credit" },
            { value: "upi", label: "UPI" },
            { value: "card", label: "Card" },
            { value: "cheque", label: "Cheque" },
            { value: "other", label: "Other" },
          ]}
          searchable
          error={errors.paymentType}
        />

        {/* PAID AMOUNT */}
        <FormField
          label="Paid Amount"
          name="paidAmount"
          type="number"
          value={paidAmount}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") {
              setPaidAmount("");
              return;
            }
            const num = parseFloat(v);
            if (!isNaN(num)) setPaidAmount(num);
            setErrors((prev) => ({ ...prev, paidAmount: undefined }));
          }}
          error={errors.paidAmount}
        />

        {/* SUMMARY */}
        <div className="mt-5 border-t pt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Total</span>
            <span className="font-semibold">₹{total.toFixed(2)}</span>
          </div>

          <div className="flex justify-between font-semibold">
            <span>Balance</span>
            <span className={balance < 0 ? "text-red-600" : "text-green-700"}>
              ₹{balance.toFixed(2)}
            </span>
          </div>
        </div>

        {/* SUBMIT */}
        <button
          className="mt-6 w-full !bg-slate-900 hover:!bg-slate-800 !text-white py-3 rounded-lg font-bold shadow-md !border-0 transition-all cursor-pointer"
          onClick={handleComplete}
        >
          Complete Order
        </button>
      </div>
    </>
  );
}
