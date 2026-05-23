// PaymentDrawer
//
// Right-side drawer that completes a POS sale. Handles the LAST mile of the
// transaction only: payment mode + paid amount + change due. The customer is
// already chosen in the cart (POS Dashboard) and arrives via `onComplete`'s
// caller, so we deliberately do NOT show another customer picker here —
// having two pickers leads to duplicate selection and inconsistent state.

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import FormField from "../formfiled";

interface PaymentDrawerProps {
  open: boolean;
  onClose: () => void;
  total: number;
  onComplete: (data: CompletePaymentData) => void;
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
}: PaymentDrawerProps) {
  const [paymentType, setPaymentType] = useState<PaymentMode>("cash");
  const [paidAmount, setPaidAmount] = useState<number | "">(total);
  const [errors, setErrors] = useState<ErrorState>({});

  const numericPaid = paidAmount === "" ? 0 : paidAmount;
  const balance = numericPaid - total;

  // Reset paid amount each time the drawer opens so it tracks the current cart
  useEffect(() => {
    if (open) {
      setPaidAmount(total);
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
