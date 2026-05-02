import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import HomeLayout from "../../../layouts/home";
import FormField from "../../../components/formfiled";
import Button from "../../../components/button";
import {
  useCreateStockAdjustment,
  useUpdateStockAdjustment,
  useGetStockAdjustmentById,
} from "../../../graphql/hooks/stockadjustments";
import { useProductServicesQuery } from "../../../graphql/hooks/products";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Variant {
  id: string;
  name?: string;
  currentstock?: number;
  purchaserate?: number;
}

interface Product {
  id: string;
  name: string;
  productvariants?: Variant[];
}

interface AdjItem {
  productid: string;
  productname: string;
  variantid: string;
  variantname: string;
  systemstock: number;
  quantity: number;
  rate: number;
  amount: number;
  _variants: Variant[];
  _searchText: string;
  _showDropdown: boolean;
}

const emptyItem = (): AdjItem => ({
  productid: "",
  productname: "",
  variantid: "",
  variantname: "",
  systemstock: 0,
  quantity: 0,
  rate: 0,
  amount: 0,
  _variants: [],
  _searchText: "",
  _showDropdown: false,
});

// ─── Component ────────────────────────────────────────────────────────────────

const StockAdjustmentAddEdit: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const { admin, branch, type } = useAppSelector((state: any) => state.auth);
  const selectedBranchId = useAppSelector(
    (state: any) => state.selectedBranch.branchId
  );
  const adminId = type === "admin" ? admin?.id : branch?.admin?.id;
  const branchId = selectedBranchId || branch?.id;

  // ── Header state ──────────────────────────────────────────────────────────
  const [adjDate, setAdjDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [adjType, setAdjType] = useState<"Shortage" | "Excess">("Shortage");
  const [reason, setReason] = useState("");

  // ── Items state ───────────────────────────────────────────────────────────
  const [items, setItems] = useState<AdjItem[]>([emptyItem()]);

  // ── Product data ──────────────────────────────────────────────────────────
  const { data: productData } = useProductServicesQuery(true, 500, 0);
  const allProducts: Product[] = productData?.getProductServices ?? [];

  // ── Fetch existing record for edit ────────────────────────────────────────
  const { data: editData, loading: editLoading } = useGetStockAdjustmentById(
    id || "",
    adminId,
    branchId
  );

  // ── Mutations ─────────────────────────────────────────────────────────────
  const { createStockAdjustment, loading: creating } = useCreateStockAdjustment();
  const { updateStockAdjustment, loading: updating } = useUpdateStockAdjustment();
  const saving = creating || updating;

  // ── Derived totals ────────────────────────────────────────────────────────
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const totalAmount = items.reduce((s, i) => s + i.amount, 0);

  // ── Pre-populate form when editing ───────────────────────────────────────
  useEffect(() => {
    if (!isEdit || !editData?.getStockAdjustmentById || allProducts.length === 0) return;

    const adj = editData.getStockAdjustmentById;

    // Header
    setAdjDate(
      adj.adjustmentdate
        ? new Date(adj.adjustmentdate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0]
    );
    setAdjType(adj.type as "Shortage" | "Excess");
    setReason(adj.reason || "");

    // Items — map fetched items back to AdjItem shape
    const mappedItems: AdjItem[] = (adj.items || []).map((item: any) => {
      const productId = item.productid?.id || item.productid || "";
      const productName = item.productid?.name || "";
      const variantId = item.variantid || "";

      // Find the product in allProducts to get variants + current stock
      const product = allProducts.find((p) => p.id === productId);
      const variants = product?.productvariants ?? [];
      const variant = variants.find((v) => v.id === variantId);
      const sysStock = variant?.currentstock ?? 0;

      return {
        productid: productId,
        productname: productName,
        variantid: variantId,
        variantname: variant?.name ?? "",
        systemstock: sysStock,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.amount,
        _variants: variants,
        _searchText: productName,
        _showDropdown: false,
      };
    });

    setItems(mappedItems.length > 0 ? mappedItems : [emptyItem()]);
  }, [isEdit, editData, allProducts]);



  // ── Helpers ───────────────────────────────────────────────────────────────
  const filteredProducts = useCallback(
    (search: string): Product[] => {
      if (!search.trim()) return allProducts.slice(0, 20);
      const q = search.toLowerCase();
      return allProducts
        .filter((p) => p.name.toLowerCase().includes(q))
        .slice(0, 20);
    },
    [allProducts]
  );

  const applyProduct = (
    rowIdx: number,
    product: Product,
    variant?: Variant
  ) => {
    const v = variant ?? product.productvariants?.[0];
    const sys = v?.currentstock ?? 0;
    setItems((prev) => {
      const next = [...prev];
      next[rowIdx] = {
        ...next[rowIdx],
        productid: product.id,
        productname: product.name,
        variantid: v?.id ?? "",
        variantname: v?.name ?? "",
        systemstock: sys,
        quantity: 0,
        rate: v?.purchaserate ?? 0,
        amount: 0,
        _variants: product.productvariants ?? [],
        _searchText: product.name,
        _showDropdown: false,
      };
      return next;
    });
  };

  const updateQty = (rowIdx: number, raw: string) => {
    const qty = raw === "" ? 0 : Math.max(0, Number(raw));
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[rowIdx] };
      item.quantity = qty;
      item.amount = qty * item.rate;
      next[rowIdx] = item;
      return next;
    });
  };

  const updateRate = (rowIdx: number, raw: string) => {
    const rate = Number(raw) || 0;
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[rowIdx], rate };
      item.amount = item.quantity * rate;
      next[rowIdx] = item;
      return next;
    });
  };

  const addRow = () => setItems((prev) => [...prev, emptyItem()]);

  const removeRow = (rowIdx: number) =>
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== rowIdx);
      return next.length === 0 ? [emptyItem()] : next;
    });

  const updateSearch = (rowIdx: number, text: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[rowIdx] = {
        ...next[rowIdx],
        _searchText: text,
        _showDropdown: true,
        ...(text === ""
          ? { productid: "", productname: "", variantid: "", variantname: "" }
          : {}),
      };
      return next;
    });
  };

  const closeDropdown = (rowIdx: number) => {
    setItems((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], _showDropdown: false };
      return next;
    });
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validItems = items.filter((i) => i.productid && i.quantity > 0);
    if (validItems.length === 0) {
      dispatch(
        showMessage({
          message: "Add at least one item with quantity > 0.",
          type: "error",
        })
      );
      return;
    }

    const payload = {
      adjustmentdate: adjDate,
      type: adjType,
      reason,
      totalamount: totalAmount,
      items: validItems.map((i) => ({
        productid: i.productid,
        variantid: i.variantid || undefined,
        quantity: i.quantity,
        rate: i.rate,
        amount: i.amount,
      })),
    };

    try {
      if (isEdit && id) {
        await updateStockAdjustment({
          variables: { id, input: payload },
        });
        dispatch(
          showMessage({
            message: "Stock adjustment updated successfully!",
            type: "success",
          })
        );
      } else {
        await createStockAdjustment({
          variables: {
            input: {
              ...payload,
              adminid: adminId,
              branchid: branchId,
            },
          },
        });
        dispatch(
          showMessage({
            message: "Stock adjustment saved successfully!",
            type: "success",
          })
        );
      }
      navigate("/stockadjustments");
    } catch (error: any) {
      dispatch(
        showMessage({
          message: error.message || "Failed to save stock adjustment.",
          type: "error",
        })
      );
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (isEdit && editLoading) {
    return (
      <HomeLayout>
        <div className="w-full px-2 sm:px-6 pt-4 pb-10 text-sm flex items-center justify-center h-64 text-gray-500">
          Loading adjustment…
        </div>
      </HomeLayout>
    );
  }

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-10 text-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── Title ─────────────────────────────────────────────────────── */}
          <h2 className="text-lg sm:text-2xl font-bold">
            {isEdit ? "Edit Stock Adjustment" : "Stock Adjustment Entry"}
          </h2>

          {/* ── Header Section ────────────────────────────────────────────── */}
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-semibold px-2">
              Voucher Details
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                label="Adjustment Date"
                name="adjustmentdate"
                type="date"
                value={adjDate}
                onChange={(e: any) => setAdjDate(e.target.value)}
                required
              />
              <FormField
                label="Adjustment Type"
                name="type"
                type="select"
                value={adjType}
                onChange={(e: any) =>
                  setAdjType(e.target.value as "Shortage" | "Excess")
                }
                options={[
                  { value: "Shortage", label: "Shortage  (Decrease Stock)" },
                  { value: "Excess", label: "Excess  (Increase Stock)" },
                ]}
                required
              />
              <FormField
                label="Reason / Narration"
                name="reason"
                type="text"
                placeholder="e.g. Damage, Audit, Expiry…"
                value={reason}
                onChange={(e: any) => setReason(e.target.value)}
              />
            </div>
          </fieldset>

          {/* ── Items Table ───────────────────────────────────────────────── */}
          <fieldset className="border rounded-xl p-4">
            <legend className="text-sm font-semibold px-2">Stock Items</legend>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-gray-100 text-gray-600 text-left">
                    <th className="border px-2 py-2 w-6">#</th>
                    <th className="border px-2 py-2 min-w-[200px]">Product</th>
                    <th className="border px-2 py-2 min-w-[130px]">Variant</th>
                    <th className="border px-2 py-2 text-right w-28">
                      System Stock
                    </th>
                    <th className="border px-2 py-2 text-right w-28">
                      {adjType === "Shortage" ? "Shortage" : "Excess"} Qty
                    </th>
                    <th className="border px-2 py-2 text-right w-24">
                      Rate (₹)
                    </th>
                    <th className="border px-2 py-2 text-right w-28">
                      Amount (₹)
                    </th>
                    <th className="border px-2 py-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, rowIdx) => (
                    <tr
                      key={rowIdx}
                      className="border-b hover:bg-blue-50/40 transition-colors"
                    >
                      {/* Serial */}
                      <td className="border px-2 py-1 text-gray-400 text-center">
                        {rowIdx + 1}
                      </td>

                      {/* Product search */}
                      <td className="border px-1 py-1 relative">
                        <input
                          className="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Search product…"
                          value={item._searchText}
                          onChange={(e) => updateSearch(rowIdx, e.target.value)}
                          onFocus={() =>
                            setItems((prev) => {
                              const next = [...prev];
                              next[rowIdx] = {
                                ...next[rowIdx],
                                _showDropdown: true,
                              };
                              return next;
                            })
                          }
                          onBlur={() =>
                            setTimeout(() => closeDropdown(rowIdx), 200)
                          }
                          autoComplete="off"
                        />
                        {item._showDropdown && (
                          <ul className="absolute z-30 left-0 top-full mt-0.5 w-72 bg-white border border-gray-200 rounded shadow-lg max-h-52 overflow-auto">
                            {filteredProducts(item._searchText).length === 0 ? (
                              <li className="px-3 py-2 text-gray-400">
                                No products found
                              </li>
                            ) : (
                              filteredProducts(item._searchText).map((p) => (
                                <li
                                  key={p.id}
                                  className="px-3 py-1.5 hover:bg-blue-50 cursor-pointer"
                                  onMouseDown={() => applyProduct(rowIdx, p)}
                                >
                                  <span className="font-medium">{p.name}</span>
                                  {p.productvariants &&
                                    p.productvariants.length > 0 && (
                                      <span className="text-gray-400 ml-1 text-xs">
                                        ({p.productvariants.length} variants)
                                      </span>
                                    )}
                                </li>
                              ))
                            )}
                          </ul>
                        )}
                      </td>

                      {/* Variant */}
                      <td className="border px-1 py-1">
                        {item._variants.length > 1 ? (
                          <select
                            className="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                            value={item.variantid}
                            onChange={(e) => {
                              const v = item._variants.find(
                                (v) => v.id === e.target.value
                              );
                              if (v) {
                                const prod = allProducts.find(
                                  (p) => p.id === item.productid
                                );
                                if (prod) applyProduct(rowIdx, prod, v);
                              }
                            }}
                          >
                            {item._variants.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name || "Default"}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-gray-500 px-2">
                            {item.variantname || "—"}
                          </span>
                        )}
                      </td>

                      {/* System Stock (read-only) */}
                      <td className="border px-2 py-1 text-right">
                        <input
                          type="number"
                          readOnly
                          value={item.systemstock}
                          className="w-full text-right bg-gray-100 border border-gray-200 rounded px-1 py-1 text-gray-600 cursor-not-allowed"
                          tabIndex={-1}
                        />
                      </td>

                      {/* Qty — directly editable (primary input) */}
                      <td className="border px-1 py-1">
                        <div className="flex items-center gap-0.5">
                          <span
                            className={`text-xs font-bold ${
                              adjType === "Excess"
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {adjType === "Excess" ? "+" : "-"}
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.quantity === 0 ? "" : item.quantity}
                            onChange={(e) => updateQty(rowIdx, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            placeholder="0"
                            className={`w-full text-right border rounded px-1 py-1 focus:outline-none focus:ring-1 font-bold ${
                              adjType === "Excess"
                                ? "border-green-400 text-green-700 focus:ring-green-400"
                                : "border-red-400 text-red-700 focus:ring-red-400"
                            }`}
                          />
                        </div>
                      </td>

                      {/* Rate */}
                      <td className="border px-1 py-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.rate}
                          onChange={(e) => updateRate(rowIdx, e.target.value)}
                          onFocus={(e) => e.target.select()}
                          className="w-full text-right border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>

                      {/* Amount */}
                      <td className="border px-2 py-1 text-right font-medium text-gray-800">
                        {item.amount.toFixed(2)}
                      </td>

                      {/* Delete row */}
                      <td className="border px-1 py-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(rowIdx)}
                          className="text-red-400 hover:text-red-600 px-1"
                          title="Remove row"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Footer totals */}
                <tfoot>
                  <tr className="bg-gray-50 font-semibold text-gray-700">
                    <td
                      colSpan={4}
                      className="border px-2 py-2 text-right text-xs text-gray-500"
                    >
                      Totals
                    </td>
                    <td className="border px-2 py-2 text-right">
                      <span
                        className={
                          adjType === "Excess"
                            ? "text-green-700"
                            : "text-red-700"
                        }
                      >
                        {adjType === "Excess" ? "+" : "-"}
                        {totalQty.toFixed(2)}
                      </span>
                    </td>
                    <td className="border px-2 py-2" />
                    <td className="border px-2 py-2 text-right text-base text-blue-700">
                      ₹{totalAmount.toFixed(2)}
                    </td>
                    <td className="border" />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Add row button */}
            <div className="mt-3">
              <button
                type="button"
                onClick={addRow}
                className="text-sm text-indigo-600 hover:text-indigo-800 border border-indigo-300 hover:border-indigo-500 rounded px-3 py-1 transition-colors"
              >
                + Add Row
              </button>
            </div>
          </fieldset>

          {/* ── Summary ───────────────────────────────────────────────────── */}
          <fieldset className="border rounded-xl p-4">
            <legend className="text-sm font-semibold px-2">Summary</legend>
            <div className="flex flex-wrap gap-6 justify-end items-center text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Total Items:</span>
                <span className="font-bold text-gray-700">
                  {items.filter((i) => i.productid).length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Total Qty Adjusted:</span>
                <span
                  className={`font-bold ${
                    adjType === "Excess" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {adjType === "Excess" ? "+" : "-"}
                  {totalQty.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-base">
                <span className="text-gray-500">Total Amount:</span>
                <span className="font-bold text-blue-700 text-lg">
                  ₹{totalAmount.toFixed(2)}
                </span>
              </div>
            </div>
          </fieldset>

          {/* ── Action Buttons ────────────────────────────────────────────── */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/stockadjustments")}
            >
              Cancel
            </Button>
            <Button type="submit" variant="outline" disabled={saving}>
              {saving
                ? isEdit
                  ? "Updating…"
                  : "Saving…"
                : isEdit
                ? "Update Adjustment"
                : "Save Adjustment"}
            </Button>
          </div>
        </form>
      </div>
    </HomeLayout>
  );
};

export default StockAdjustmentAddEdit;
