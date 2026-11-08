import React, { useState } from "react";
import Select from "react-select";
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
  type: "sales" | "purchase";
};

const OtherChargesSection: React.FC<OtherChargesSectionProps> = ({
  otherCharges,
  setOtherCharges,
  type,
}) => {
  const [selectedCharge, setSelectedCharge] = useState<Partial<OtherCharge>>({
    amount: 0,
    gstpercent: 0,
    gstamount: 0,
    totalamount: 0,
  });
  const [editIndex, setEditIndex] = useState<number | null>(null);
  // Double-click inline editing in the charges table, same as the Products List
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; field: string } | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");

  const moduleId = type === "sales" ? "salesinvoice" : "purchaseinvoice";
  const formPermissions = useAppSelector((state) => state.permissions.permissions?.formPermissions?.[moduleId] || {});
  const isFieldEnabled = (fieldId: string) => {
    return formPermissions[fieldId] !== false;
  };

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

  const ledgerOptions = chargeLedgers.map((l: any) => ({ value: l.id, label: l.ledgername }));

  const cancelEdit = () => {
    setEditingCell(null);
    setEditingValue("");
  };

  /** Only open the inline editor for columns this role is allowed to edit. */
  const startEdit = (rowIndex: number, field: string, value: string, permissionId: string) => {
    if (!isFieldEnabled(permissionId)) return;
    setEditingCell({ rowIndex, field });
    setEditingValue(value);
  };

  /** Auto-save an inline cell on blur / Enter. GST Amt and Total are derived,
      so editing either Amount or GST % recalculates both. */
  const handleCellBlur = (rowIndex: number, field: string, newValue: string) => {
    if (field !== "remarks") {
      const num = parseFloat(newValue);
      if (isNaN(num)) return cancelEdit();
    }

    setOtherCharges((prev) =>
      prev.map((c, i) => {
        if (i !== rowIndex) return c;
        const updated = { ...c };

        if (field === "remarks") updated.remarks = newValue;
        else if (field === "amount") updated.amount = parseFloat(newValue);
        else if (field === "gstpercent") updated.gstpercent = parseFloat(newValue);

        const computed = handleCalculateGst(updated.amount || 0, updated.gstpercent || 0);
        updated.gstamount = computed.gstamount;
        updated.totalamount = computed.totalamount;
        return updated;
      })
    );

    cancelEdit();
  };

  /** Inline ledger change from the table row's dropdown. */
  const handleLedgerChange = (rowIndex: number, ledgerId: string) => {
    const ledger = chargeLedgers.find((l: any) => l.id === ledgerId);
    if (!ledger) return cancelEdit();

    setOtherCharges((prev) =>
      prev.map((c, i) =>
        i === rowIndex ? { ...c, ledgerid: ledger.id, ledgername: ledger.ledgername || "" } : c
      )
    );
    cancelEdit();
  };

  return (
    <fieldset className="border rounded-xl p-4 space-y-4">
      <legend className="text-sm font-medium px-2">Other Charges</legend>

      {/* One line: Ledger · Amount · GST % · Remarks · GST amt · Total · [Add] */}
      <div className="grid grid-cols-1 items-end gap-x-3 gap-y-2 sm:grid-cols-4 xl:grid-cols-[2fr_1fr_1fr_2fr_auto]">
        {/* Ledger Selection */}
        {isFieldEnabled("ledgeraccount") && (
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
        )}

        {/* Amount */}
        {isFieldEnabled("amount") && (
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
        )}

        {/* GST % */}
        {isFieldEnabled("other_gst") && (
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
                ...computed,
                gstpercent: val,
              });
            }}
          />
        )}

        {/* Remarks */}
        {isFieldEnabled("remarks") && (
          <FormField
            label="Remarks"
            name="remarks"
            type="text"
            value={selectedCharge.remarks || ""}
            onChange={(e) =>
              setSelectedCharge({ ...selectedCharge, remarks: e.target.value })
            }
          />
        )}

      <div className="flex items-center gap-2">
        <div className="flex h-8 items-center gap-2 whitespace-nowrap rounded-md bg-slate-50 px-2 text-[12px] text-slate-500">
          <span>GST <b className="font-semibold text-slate-800">₹{selectedCharge.gstamount || 0}</b></span>
          <span className="text-slate-300">|</span>
          <span>Total <b className="font-semibold text-slate-800">₹{selectedCharge.totalamount || 0}</b></span>
        </div>
        {isFieldEnabled("add_charge_button") && (
          <Button type="button" variant="outline" onClick={handleAddOrUpdate}>
            {editIndex !== null ? "Update" : "Add"}
          </Button>
        )}
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
      </div>

      {/* Table — tableLayout:"fixed" + per-column widths, same as the Products
          List. Without it the columns re-measure and jump the moment an inline
          editor replaces the text in a cell. */}
      {otherCharges.length > 0 && (
        <table className="w-full border-collapse text-[12.5px]" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th className="border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10.5px] font-semibold uppercase text-slate-500 text-left">Ledger</th>
              <th className="border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10.5px] font-semibold uppercase text-slate-500 text-right w-28">Amount</th>
              <th className="border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10.5px] font-semibold uppercase text-slate-500 text-right w-20">GST %</th>
              <th className="border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10.5px] font-semibold uppercase text-slate-500 text-right w-24">GST Amt</th>
              <th className="border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10.5px] font-semibold uppercase text-slate-500 text-right w-24">Total</th>
              <th className="border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10.5px] font-semibold uppercase text-slate-500 text-left w-48">Remarks</th>
              <th className="border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10.5px] font-semibold uppercase text-slate-500 text-center w-32">Action</th>
            </tr>
          </thead>
          <tbody>
            {otherCharges.map((c, i) => (
              <tr key={i}>
                {/* Ledger — double-click for the searchable dropdown */}
                <td className="border border-slate-200 px-2 py-1 align-top" style={{ overflow: "visible" }}>
                  {editingCell?.rowIndex === i && editingCell?.field === "ledger" ? (
                    <Select
                      inputId={`charge-ledger-${i}`}
                      options={ledgerOptions}
                      value={ledgerOptions.find((o) => o.value === c.ledgerid) || null}
                      onChange={(selected: any) => {
                        if (selected) handleLedgerChange(i, selected.value);
                        else cancelEdit();
                      }}
                      onBlur={cancelEdit}
                      autoFocus
                      isClearable
                      isSearchable
                      menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                      menuPosition="fixed"
                      menuShouldScrollIntoView={false}
                      styles={{ menuPortal: (base: any) => ({ ...base, zIndex: 9999 }) }}
                      className="w-full"
                    />
                  ) : (
                    <div
                      onDoubleClick={() => startEdit(i, "ledger", c.ledgerid, "ledgeraccount")}
                      style={{ cursor: "pointer" }}
                    >
                      {c.ledgername}
                    </div>
                  )}
                </td>

                {/* Amount */}
                <td
                  className="border border-slate-200 px-2 py-1 text-right cursor-pointer hover:bg-gray-100"
                  onDoubleClick={() => startEdit(i, "amount", String(c.amount), "amount")}
                >
                  {editingCell?.rowIndex === i && editingCell?.field === "amount" ? (
                    <input
                      type="number"
                      autoFocus
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={() => handleCellBlur(i, "amount", editingValue)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCellBlur(i, "amount", editingValue);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="w-full border border-gray-300 px-2 py-1 rounded text-gray-700 text-right"
                      step="0.01"
                    />
                  ) : (
                    c.amount.toFixed(2)
                  )}
                </td>

                {/* GST % */}
                <td
                  className="border border-slate-200 px-2 py-1 text-right cursor-pointer hover:bg-gray-100"
                  onDoubleClick={() => startEdit(i, "gstpercent", String(c.gstpercent), "other_gst")}
                >
                  {editingCell?.rowIndex === i && editingCell?.field === "gstpercent" ? (
                    <input
                      type="number"
                      autoFocus
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={() => handleCellBlur(i, "gstpercent", editingValue)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCellBlur(i, "gstpercent", editingValue);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="w-full border border-gray-300 px-2 py-1 rounded text-gray-700 text-right"
                      step="0.01"
                    />
                  ) : (
                    `${c.gstpercent}%`
                  )}
                </td>

                {/* GST Amt + Total — derived from Amount and GST %, so read-only */}
                <td className="border border-slate-200 px-2 py-1 text-right">{c.gstamount.toFixed(2)}</td>
                <td className="border border-slate-200 px-2 py-1 text-right">{c.totalamount.toFixed(2)}</td>

                {/* Remarks */}
                <td
                  className="border border-slate-200 px-2 py-1 cursor-pointer hover:bg-gray-100"
                  onDoubleClick={() => startEdit(i, "remarks", c.remarks ?? "", "remarks")}
                >
                  {editingCell?.rowIndex === i && editingCell?.field === "remarks" ? (
                    <input
                      type="text"
                      autoFocus
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={() => handleCellBlur(i, "remarks", editingValue)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCellBlur(i, "remarks", editingValue);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="w-full border border-gray-300 px-2 py-1 rounded text-gray-700"
                    />
                  ) : (
                    c.remarks
                  )}
                </td>
                <td className="border border-slate-200 px-2 py-1 text-center space-x-2">
                  <button
                    type="button"
                    className="text-[12px] font-medium text-indigo-600"
                    onClick={() => editCharge(i)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-[12px] font-medium text-rose-600"
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
