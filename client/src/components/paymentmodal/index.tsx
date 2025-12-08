import { useState } from "react";
import { X } from "lucide-react";
import { useAccountsQuery } from "../../graphql/hooks/accounts";
import { useStaffQuery } from "../../graphql/hooks/staffaccounts";
import FormField from "../formfiled";

export default function PaymentModal({ open, onClose, total, cart, onComplete }) {
  if (!open) return null;

  const [paymentType, setPaymentType] = useState("cash");
  const [customer, setCustomer] = useState("");
  const [salesman, setSalesman] = useState("");
  const [paidAmount, setPaidAmount] = useState(total);

  // Fetch Customers
  const { data: accData } = useAccountsQuery();
  const customers = (accData?.getAccounts || []).filter(a => a.type === "customer");

  // Fetch Salesmen
  const { data: staffData } = useStaffQuery();
  const salesmans = (staffData?.getStaffAccounts || []).filter(s => s.role === "salesman");
  const balance = (paidAmount || 0) - total;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center z-50">
      <div className="bg-white w-full md:w-[450px] rounded-xl p-5 shadow-xl animate-slide-up">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Complete Payment</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            <X />
          </button>
        </div>

        {/* CUSTOMER */}
        <FormField
          label="Customer (Name - Mobile)"
          name="customer"
          type="select"
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          options={customers.map(c => ({
            value: c.id,
            label: `${c.name} (${c.mobile || "N/A"})`
          }))}
          searchable
        />

        {/* SALESMAN */}
        <FormField
          label="Salesman"
          name="salesman"
          type="select"
          value={salesman}
          onChange={(e) => setSalesman(e.target.value)}
          options={salesmans.map(s => ({
            value: s.id,
            label: s.name
          }))}
          searchable
        />

        {/* PAYMENT TYPE */}
        <FormField
          label="Payment Type"
          name="paymentType"
          type="select"
          value={paymentType}
          onChange={(e) => setPaymentType(e.target.value)}
          options={[
            { value: "cash", label: "Cash" },
            { value: "bank", label: "Bank" },
            { value: "upi", label: "UPI" },
            { value: "card", label: "Card" },
            { value: "cheque", label: "Cheque" },
            { value: "other", label: "Other" },
          ]}
          searchable
        />

        {/* PAID AMOUNT */}
        <FormField
          label="Paid Amount"
          name="paidAmount"
          type="number"
          value={paidAmount}
          onChange={(e) => setPaidAmount(Number(e.target.value))}
        />

        {/* TOTALS */}
        <div className="border-t pt-3 mt-3">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Total</span>
            <span className="font-semibold text-gray-900">₹{total.toFixed(2)}</span>
          </div>

          <div className="flex justify-between text-sm font-semibold">
            <span className="text-gray-700">Balance</span>
            <span className={`${balance < 0 ? "text-red-500" : "text-green-600"}`}>
              ₹{balance.toFixed(2)}
            </span>
          </div>
        </div>

        {/* COMPLETE BUTTON */}
        <button
          className="mt-5 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition"
          onClick={() =>
            onComplete({
              paymentType,
              customer,
              salesman,
              paidAmount,
            })
          }
        >
          Complete Order
        </button>
      </div>
    </div>
  );
}
