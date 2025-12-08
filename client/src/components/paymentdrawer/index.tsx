import { X } from "lucide-react";
import { useEffect, useState } from "react";
import FormField from "../formfiled";
import { useAccountsQuery } from "../../graphql/hooks/accounts";
import { useStaffQuery } from "../../graphql/hooks/staffaccounts";
import { useNavigate } from "react-router";
import PosAddCustomer from "../posaddcustomer";

// ---------------------------
// TYPES
// ---------------------------

type CustomerAccount = {
  id: string;
  name: string;
  mobile: string;
  type: string;
};

type StaffAccount = {
  id: string;
  name: string;
  role: string;
};

interface PaymentDrawerProps {
  open: boolean;
  onClose: () => void;
  total: number;
  onComplete: (data: CompletePaymentData) => void;
}

interface CompletePaymentData {
  customer: string;
  salesman: string;
  paymentType: PaymentMode;
  paidAmount: number;
  balance: number;
}

type PaymentMode = "cash" | "bank" | "upi" | "card" | "cheque";

type ErrorState = Partial<{
  customer: string;
  salesman: string;
  paymentType: string;
  paidAmount: string;
}>;

// ---------------------------
// COMPONENT
// ---------------------------
export default function PaymentDrawer({
  open,
  onClose,
  total,
  onComplete,
}: PaymentDrawerProps) {
  const navigate = useNavigate();

  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [customer, setCustomer] = useState<string>("");
  const [salesman, setSalesman] = useState<string>("");
  const [paymentType, setPaymentType] = useState<PaymentMode>("cash");
  const [paidAmount, setPaidAmount] = useState<number | "">(total);
  const [errors, setErrors] = useState<ErrorState>({});
 

  // ---------------------------
  // QUERIES
  // ---------------------------
  const { data: accData, refetch: refetchAccounts } = useAccountsQuery();
  const customers: CustomerAccount[] =
    (accData?.getAccounts || []).filter(
      (a: CustomerAccount) => a.type === "customer"
    );

  const { data: staffData } = useStaffQuery();
  const salesmans: StaffAccount[] =
    (staffData?.getStaffAccounts || []).filter(
      (s: StaffAccount) => s.role === "salesman"
    );

  // ---------------------------
  // BALANCE CALCULATION
  // ---------------------------
  const numericPaid = paidAmount === "" ? 0 : paidAmount;
  const balance = numericPaid - total;

  // Reset when opened
  useEffect(() => {
    if (open) setPaidAmount(total);
  }, [open, total]);

  // ---------------------------
  // VALIDATION
  // ---------------------------
  const validate = (): boolean => {
    const newErrors: ErrorState = {};

    if (!customer) newErrors.customer = "Please select a customer.";
    if (!salesman) newErrors.salesman = "Please select a salesman.";
    if (!paymentType) newErrors.paymentType = "Select payment mode.";

    if (paidAmount === "" || isNaN(Number(paidAmount))) {
      newErrors.paidAmount = "Paid amount is required.";
    } else if (Number(paidAmount) < 0) {
      newErrors.paidAmount = "Amount cannot be negative.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ---------------------------
  // SUBMIT
  // ---------------------------
  const handleComplete = () => {
    if (!validate()) return;

    const finalPaid = Number(paidAmount);

    const payload: CompletePaymentData = {
      customer,
      salesman,
      paymentType,
      paidAmount: finalPaid,
      balance: finalPaid - total,
    };

    onComplete(payload);
  };

  // ---------------------------
  // UI
  // ---------------------------
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

        {/* CUSTOMER */}
        <FormField
          label="Customer"
          name="customer"
          type="select"
          value={customer}
          onChange={(e) => {
                setCustomer(e.target.value);
                setErrors((prev) => ({ ...prev, customer: undefined }));
          }}
          options={customers.map((c) => ({
            value: c.id,
            label: `${c.name} (${c.mobile})`,
          }))}
          searchable
          error={errors.customer}
          addable
          onAddNew={() => setAddCustomerOpen(true)}
        />

        {/* SALESMAN */}
        <FormField
          label="Salesman"
          name="salesman"
          type="select"
          value={salesman}
          onChange={(e) => {
            setSalesman(e.target.value);
            setErrors((prev) => ({ ...prev, salesman: undefined }));
            }}
          options={salesmans.map((s) => ({
            value: s.id,
            label: s.name,
          }))}
          searchable
          error={errors.salesman}
          addable
          onAddNew={() => navigate("/salesmenaccount")}
        />

        {/* PAYMENT MODE */}
        <FormField
          label="Payment Type"
          name="paymentType"
          type="select"
          value={paymentType}
          onChange={(e) => setPaymentType(e.target.value as PaymentMode)}
          options={[
            { value: "cash", label: "Cash" },
            { value: "bank", label: "Bank Transfer" },
            { value: "upi", label: "UPI" },
            { value: "card", label: "Card" },
            { value: "cheque", label: "Cheque" },
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

        <PosAddCustomer
          open={addCustomerOpen}
          onClose={() => setAddCustomerOpen(false)}
          onCreated={async (newId) => {
            await refetchAccounts();
            setErrors((prev) => ({ ...prev, customer: undefined }));      
            setCustomer(newId);         
          }}
          mode="customer"
        />

        {/* SUBMIT */}
        <button
          className="mt-6 w-full bg-blue-600 text-blue-600 py-3 rounded-lg font-semibold border"
          onClick={handleComplete}
        >
          Complete Order
        </button>
      </div>
    </>
  );
}
