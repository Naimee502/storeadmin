import React, { useState, useEffect } from "react";
import FormField from "../formfiled";
import Button from "../button";
import { useAccountLedgersQuery } from "../../graphql/hooks/accountledgers";
import { useAppSelector } from "../../redux/hooks";

export type OtherCharge = {
  ledgerid: string;
  ledgername: string;
  amount: number;
  gstpercent: number;
  gstamount: number;
  totalamount: number;
  remarks?: string;
};

type OtherChargesSectionProps = {
  otherCharges: OtherCharge[];
  setOtherCharges: React.Dispatch<React.SetStateAction<OtherCharge[]>>;
};

const OtherChargesSection: React.FC<OtherChargesSectionProps> = ({
  otherCharges,
  setOtherCharges,
}) => {
  const [selectedCharge, setSelectedCharge] = useState<Partial<OtherCharge>>({
    amount: 0,
    gstpercent: 0,
    gstamount: 0,
    totalamount: 0,
  });
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const { data: ledgersData } = useAccountLedgersQuery();
  // Filter for income/expense ledgers typically used for charges
  const chargeLedgers = ledgersData?.getAccountLedgers?.filter(
    (l: any) =>
      l.group?.groupname?.toLowerCase().includes("income") ||
      l.group?.groupname?.toLowerCase().includes("expense") ||
      l.group?.groupname?.toLowerCase().includes("duties") ||
      l.ledgername?.toLowerCase().includes("charge") ||
      l.ledgername?.toLowerCase().includes("freight") ||
      l.ledgername?.toLowerCase().includes("discount")
  ) || [];

  const handleCalculateGst = (amount: number, gstpercent: number) => {
    const gstamount = (amount * gstpercent) / 100;
    return {
      gstamount: Number(gstamount.toFixed(2)),
      totalamount: Number((amount + gstamount).toFixed(2)),
    };
  };

  const handleAddOrUpdate = () => {
    if (!selectedCharge.ledgerid) return alert("Please select a ledger");
    if (!selectedCharge.amount || selectedCharge.amount <= 0) return alert("Enter amount");

    const charge: OtherCharge = {
      ledgerid: selectedCharge.ledgerid!,
      ledgername: selectedCharge.ledgername || "",
      amount: Number(selectedCharge.amount),
      gstpercent: Number(selectedCharge.gstpercent || 0),
      gstamount: Number(selectedCharge.gstamount || 0),
      totalamount: Number(selectedCharge.totalamount || 0),
      remarks: selectedCharge.remarks || "",
    };

    setOtherCharges((prev) =>
      editIndex !== null
        ? prev.map((c, i) => (i === editIndex ? charge : c))
        : [...prev, charge]
    );

    setSelectedCharge({ amount: 0, gstpercent: 0, gstamount: 0, totalamount: 0 });
    setEditIndex(null);
  };

  const editCharge = (i: number) => {
    setSelectedCharge(otherCharges[i]);
    setEditIndex(i);
  };

  const removeCharge = (i: number) => {
    setOtherCharges((prev) => prev.filter((_, idx) => idx !== i));
    if (editIndex === i) setEditIndex(null);
  };

  return (
    <fieldset className="border rounded-xl p-4 space-y-4 mt-6">
      <legend className="text-sm font-medium px-2">Other Charges</legend>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Ledger Selection */}
        <div className="md:col-span-1">
          <FormField
            label="Ledger Account"
            name="ledgerid"
            type="select"
            value={selectedCharge.ledgerid ?? ""}
            onChange={(e) => {
              const ledger = chargeLedgers.find((l: any) => l.id === e.target.value);
              setSelectedCharge({
                ...selectedCharge,
                ledgerid: e.target.value,
                ledgername: ledger?.ledgername || "",
              });
            }}
            options={chargeLedgers.map((l: any) => ({
              value: l.id,
              label: l.ledgername,
            }))}
            searchable
          />
        </div>

        {/* Amount */}
        <FormField
          label="Amount"
          name="amount"
          type="number"
          value={selectedCharge.amount || ""}
          onChange={(e) => {
            const val = parseFloat(e.target.value) || 0;
            const computed = handleCalculateGst(val, selectedCharge.gstpercent || 0);
            setSelectedCharge({
              ...selectedCharge,
              amount: val,
              ...computed,
            });
          }}
        />

        {/* GST % */}
        <FormField
          label="GST %"
          name="gstpercent"
          type="number"
          value={selectedCharge.gstpercent || ""}
          onChange={(e) => {
            const val = parseFloat(e.target.value) || 0;
            const computed = handleCalculateGst(selectedCharge.amount || 0, val);
            setSelectedCharge({
              ...selectedCharge,
              gstpercent: val,
              ...computed,
            });
          }}
        />

        {/* Remarks */}
        <FormField
          label="Remarks"
          name="remarks"
          type="text"
          value={selectedCharge.remarks || ""}
          onChange={(e) =>
            setSelectedCharge({ ...selectedCharge, remarks: e.target.value })
          }
        />
      </div>

      <div className="flex gap-4 items-center">
        <div className="text-sm font-medium text-gray-700 bg-gray-100 px-3 py-2 rounded">
          GST Amount: ₹{selectedCharge.gstamount || 0}
        </div>
        <div className="text-sm font-medium text-gray-700 bg-gray-100 px-3 py-2 rounded">
          Total: ₹{selectedCharge.totalamount || 0}
        </div>
        <Button type="button" variant="outline" onClick={handleAddOrUpdate}>
          {editIndex !== null ? "Update" : "Add"}
        </Button>
        {editIndex !== null && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSelectedCharge({ amount: 0, gstpercent: 0, gstamount: 0, totalamount: 0 });
              setEditIndex(null);
            }}
          >
            Cancel
          </Button>
        )}
      </div>

      {/* Table */}
      {otherCharges.length > 0 && (
        <table className="w-full border mt-4">
          <thead>
            <tr>
              <th className="border p-2 text-left">Ledger</th>
              <th className="border p-2 text-right">Amount</th>
              <th className="border p-2 text-right">GST %</th>
              <th className="border p-2 text-right">GST Amt</th>
              <th className="border p-2 text-right">Total</th>
              <th className="border p-2 text-left">Remarks</th>
              <th className="border p-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {otherCharges.map((c, i) => (
              <tr key={i}>
                <td className="border p-2">{c.ledgername}</td>
                <td className="border p-2 text-right">{c.amount.toFixed(2)}</td>
                <td className="border p-2 text-right">{c.gstpercent}%</td>
                <td className="border p-2 text-right">{c.gstamount.toFixed(2)}</td>
                <td className="border p-2 text-right">{c.totalamount.toFixed(2)}</td>
                <td className="border p-2">{c.remarks}</td>
                <td className="border p-2 text-center space-x-2">
                  <button
                    type="button"
                    className="text-blue-500"
                    onClick={() => editCharge(i)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-red-500"
                    onClick={() => removeCharge(i)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </fieldset>
  );
};

export default OtherChargesSection;
