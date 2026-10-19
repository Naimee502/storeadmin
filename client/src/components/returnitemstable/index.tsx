import { useMemo, useState } from "react";

/** The fields this table reads — Sales and Purchase Return lines both have them. */
export type ReturnItemLine = {
  productName: string;
  variantName?: string;
  /** How much of this line can still be returned (invoiced − already returned). */
  originalQty: number;
  qty: number;
  rate: number;
  discount: number;
  gst: number;
  amount: number;
};

type Props = {
  lines: ReturnItemLine[];
  errors: Record<string, string>;
  /** Set the return qty of several lines at once: { lineIndex: qty }. */
  onSetQtys: (updates: Record<number, number>) => void;
  emptyText: string;
  rowKey: (line: any, index: number) => string;
};

/**
 * "Pick what came back" table for Sales / Purchase Returns.
 *
 * Loading an invoice used to drop every line in at full quantity, so a return
 * of 2 items out of 50 meant clearing 48 rows by hand. Now nothing is selected
 * until the user ticks it — the way Zoho / Tally credit notes work:
 *   - tick a row → its full returnable qty; untick → 0 (left off the return)
 *   - the header box ticks / clears every visible row
 *   - typing a qty ticks the row, 0 unticks it (a row is "selected" when qty > 0)
 *   - search narrows long invoices; a summary shows what is being returned.
 */
export default function ReturnItemsTable({ lines, errors, onSetQtys, emptyText, rowKey }: Props) {
  const [search, setSearch] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) =>
        (!q || `${line.productName} ${line.variantName ?? ""}`.toLowerCase().includes(q)) &&
        (!selectedOnly || Number(line.qty) > 0)
      );
  }, [lines, search, selectedOnly]);

  const selectedCount = lines.filter((l) => Number(l.qty) > 0).length;
  const selectedAmount = lines.reduce((sum, l) => sum + (Number(l.qty) > 0 ? Number(l.amount) || 0 : 0), 0);
  const allVisibleSelected = visible.length > 0 && visible.every(({ line }) => Number(line.qty) > 0);
  const someVisibleSelected = visible.some(({ line }) => Number(line.qty) > 0);

  const toggleAllVisible = () => {
    const updates: Record<number, number> = {};
    visible.forEach(({ line, index }) => {
      updates[index] = allVisibleSelected ? 0 : line.originalQty;
    });
    onSetQtys(updates);
  };

  return (
    <div className="space-y-3">
      {lines.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products on this invoice…"
            className="w-full sm:w-72 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-gray-600 select-none">
            <input
              type="checkbox"
              checked={selectedOnly}
              onChange={(e) => setSelectedOnly(e.target.checked)}
            />
            Show selected only
          </label>
          <div className="ml-auto text-sm text-gray-600">
            <b className="text-gray-900">{selectedCount}</b> of {lines.length} items selected
            {selectedCount > 0 && (
              <> · Return value <b className="text-gray-900">₹{selectedAmount.toFixed(2)}</b></>
            )}
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-3 py-2 w-10">
                <input
                  type="checkbox"
                  title={allVisibleSelected ? "Clear all" : "Return all"}
                  disabled={visible.length === 0}
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected;
                  }}
                  onChange={toggleAllVisible}
                />
              </th>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Returnable Qty</th>
              <th className="px-3 py-2">Return Qty</th>
              <th className="px-3 py-2">Rate</th>
              <th className="px-3 py-2">Discount</th>
              <th className="px-3 py-2">GST %</th>
              <th className="px-3 py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-500">{emptyText}</td>
              </tr>
            )}
            {lines.length > 0 && visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-500">No matching items.</td>
              </tr>
            )}
            {visible.map(({ line: l, index: i }) => {
              const selected = Number(l.qty) > 0;
              return (
                <tr
                  key={rowKey(l, i)}
                  className={`border-t ${selected ? "bg-blue-50/40" : "text-gray-500"}`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onSetQtys({ [i]: selected ? 0 : l.originalQty })}
                    />
                  </td>
                  <td
                    className="px-3 py-2 cursor-pointer"
                    onClick={() => onSetQtys({ [i]: selected ? 0 : l.originalQty })}
                  >
                    <div className={`font-medium ${selected ? "text-gray-900" : ""}`}>{l.productName}</div>
                    {l.variantName && <div className="text-xs text-gray-500">{l.variantName}</div>}
                  </td>
                  <td className="px-3 py-2">{l.originalQty}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      className={`w-24 border rounded px-2 py-1 ${errors[`qty_${i}`] ? "border-red-500" : "border-gray-300"}`}
                      value={selected ? l.qty : ""}
                      placeholder="0"
                      min={0}
                      max={l.originalQty}
                      onChange={(e) => onSetQtys({ [i]: parseFloat(e.target.value) || 0 })}
                    />
                    {errors[`qty_${i}`] && (
                      <div className="text-xs text-red-600 mt-1">{errors[`qty_${i}`]}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">{l.rate}</td>
                  <td className="px-3 py-2">{l.discount}</td>
                  <td className="px-3 py-2">{l.gst}</td>
                  <td className="px-3 py-2">{selected ? Number(l.amount).toFixed(2) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
