import React, { useState, useEffect } from "react";
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
import { useBranchesQuery } from "../../../graphql/hooks/branches";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import { FaTrash } from "react-icons/fa";

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
});

// ─── Component ────────────────────────────────────────────────────────────────

const StockAdjustmentAddEdit: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const { admin, branch, staff, type } = useAppSelector((state: any) => state.auth);
  const selectedBranchId = useAppSelector((state: any) => state.selectedBranch.branchId);
  const storedBranchId = localStorage.getItem("branchid") || "";
  const storedAdminId = localStorage.getItem("adminid") || "";
  const { data: branchesData } = useBranchesQuery();
  const firstBranchId = branchesData?.getBranches?.[0]?.id || "";

  const adminId =
    type === "admin" ? admin?.id
    : type === "branch" ? (branch?.admin?.id || admin?.id || storedAdminId)
    : type === "staff" ? (staff?.admin?.id || admin?.id || storedAdminId)
    : (admin?.id || storedAdminId);

  const branchId =
    type === "admin" ? (selectedBranchId || firstBranchId)
    : type === "branch" ? (branch?.id || selectedBranchId || storedBranchId || firstBranchId)
    : type === "staff" ? (staff?.branchid?.id || selectedBranchId || storedBranchId || firstBranchId)
    : (selectedBranchId || storedBranchId || firstBranchId);

  // ── Header state ──────────────────────────────────────────────────────────
  const [adjDate, setAdjDate] = useState(new Date().toISOString().split("T")[0]);
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

    setAdjDate(
      adj.adjustmentdate
        ? new Date(adj.adjustmentdate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0]
    );
    setAdjType(adj.type as "Shortage" | "Excess");
    setReason(adj.reason || "");

    const mappedItems: AdjItem[] = (adj.items || []).map((item: any) => {
      const productId = item.productid?.id || item.productid || "";
      const productName = item.productid?.name || "";
      const variantId = item.variantid || "";
      const product = allProducts.find((p) => p.id === productId);
      const variants = product?.productvariants ?? [];
      const variant = variants.find((v) => v.id === variantId);

      return {
        productid: productId,
        productname: productName,
        variantid: variantId,
        variantname: variant?.name ?? "",
        systemstock: variant?.currentstock ?? 0,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.amount,
        _variants: variants,
      };
    });

    setItems(mappedItems.length > 0 ? mappedItems : [emptyItem()]);
  }, [isEdit, editData, allProducts]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const productOptions = allProducts.map((p) => ({
    label:
      p.name +
      (p.productvariants && p.productvariants.length > 1
        ? ` (${p.productvariants.length} variants)`
        : ""),
    value: p.id,
  }));

  const applyProduct = (rowIdx: number, product: Product, variant?: Variant) => {
    const v = variant ?? product.productvariants?.[0];
    setItems((prev) => {
      const next = [...prev];
      next[rowIdx] = {
        productid: product.id,
        productname: product.name,
        variantid: v?.id ?? "",
        variantname: v?.name ?? "",
        systemstock: v?.currentstock ?? 0,
        quantity: 0,
        rate: v?.purchaserate ?? 0,
        amount: 0,
        _variants: product.productvariants ?? [],
      };
      return next;
    });
  };

  const clearRow = (rowIdx: number) => {
    setItems((prev) => {
      const next = [...prev];
      next[rowIdx] = emptyItem();
      return next;
    });
  };

  const updateField = (rowIdx: number, field: "quantity" | "rate", raw: string) => {
    const val = raw === "" ? 0 : Math.max(0, Number(raw));
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[rowIdx], [field]: val };
      item.amount = item.quantity * item.rate;
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

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validItems = items.filter((i) => i.productid && i.quantity > 0);
    if (validItems.length === 0) {
      dispatch(
        showMessage({ message: "Add at least one item with quantity > 0.", type: "error" })
      );
      return;
    }

    const creatorName =
      type === "admin" ? admin?.name
      : type === "branch" ? branch?.branchname || branch?.name
      : type === "staff" ? staff?.name
      : undefined;

    const payload = {
      adjustmentdate: adjDate,
      type: adjType,
      reason,
      totalamount: totalAmount,
      createdby_id: admin?.id || branch?.id || staff?.id,
      createdby_name: creatorName,
      createdby_type: type || "admin",
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
        await updateStockAdjustment({ variables: { id, input: payload } });
        dispatch(
          showMessage({ message: "Stock adjustment updated successfully!", type: "success" })
        );
      } else {
        await createStockAdjustment({
          variables: { input: { ...payload, adminid: adminId, branchid: branchId } },
        });
        dispatch(
          showMessage({ message: "Stock adjustment saved successfully!", type: "success" })
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

  const qtyColor = adjType === "Excess" ? "text-green-600" : "text-red-600";
  const qtyBorder = adjType === "Excess" ? "border-green-400 focus-within:ring-green-400" : "border-red-400 focus-within:ring-red-400";
  const qtyInputColor = adjType === "Excess" ? "text-green-700" : "text-red-700";
  const qtySign = adjType === "Excess" ? "+" : "−";

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-10 text-sm">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Title ──────────────────────────────────────────────────────── */}
          <h2 className="text-lg sm:text-2xl font-bold">
            {isEdit ? "Edit Stock Adjustment" : "Stock Adjustment Entry"}
          </h2>

          {/* ── Voucher Details ─────────────────────────────────────────────── */}
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-semibold px-2">Voucher Details</legend>
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
                onChange={(e: any) => setAdjType(e.target.value as "Shortage" | "Excess")}
                options={[
                  { value: "Shortage", label: "Shortage — Decrease Stock" },
                  { value: "Excess", label: "Excess — Increase Stock" },
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

          {/* ── Stock Items ─────────────────────────────────────────────────── */}
          <fieldset className="border rounded-xl p-4">
            <legend className="text-sm font-semibold px-2">Stock Items</legend>

            {/* Desktop column headers */}
            <div className="hidden sm:grid sm:grid-cols-[2fr_1fr_80px_110px_95px_95px_36px] gap-2 mb-2 px-1 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b pb-2">
              <div>Product</div>
              <div>Variant</div>
              <div className="text-center">Sys. Stock</div>
              <div className={`text-center font-bold ${qtyColor}`}>
                {qtySign} Adj. Qty
              </div>
              <div className="text-right">Rate (₹)</div>
              <div className="text-right">Amount (₹)</div>
              <div />
            </div>

            {/* Item rows */}
            {items.map((item, rowIdx) => {
              const variantOptions = item._variants.map((v) => ({
                label: v.name || "Default",
                value: v.id,
              }));

              return (
                <div
                  key={rowIdx}
                  className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_80px_110px_95px_95px_36px] gap-2 items-end mb-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0 last:mb-0"
                >
                  {/* Product — FormField searchable select */}
                  <FormField
                    label="Product"
                    name={`productid-${rowIdx}`}
                    type="select"
                    searchable
                    value={item.productid}
                    onChange={(e: any) => {
                      const prod = allProducts.find((p) => p.id === e.target.value);
                      if (prod) applyProduct(rowIdx, prod);
                      else clearRow(rowIdx);
                    }}
                    options={productOptions}
                    placeholder="Search product…"
                  />

                  {/* Variant — FormField select */}
                  <FormField
                    label="Variant"
                    name={`variantid-${rowIdx}`}
                    type="select"
                    searchable={item._variants.length > 6}
                    value={item.variantid}
                    onChange={(e: any) => {
                      const v = item._variants.find((v) => v.id === e.target.value);
                      const prod = allProducts.find((p) => p.id === item.productid);
                      if (v && prod) applyProduct(rowIdx, prod, v);
                    }}
                    options={variantOptions}
                    disabled={!item.productid || item._variants.length <= 1}
                    placeholder="Variant"
                  />

                  {/* System Stock (read-only display) */}
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-gray-700 sm:hidden">System Stock</span>
                    <div className="flex items-center justify-center border border-gray-200 rounded-lg px-2 py-2 bg-gray-50 h-[38px]">
                      <span className="text-gray-600 font-medium text-sm">{item.systemstock}</span>
                    </div>
                  </div>

                  {/* Adjustment Qty — coloured input with sign prefix */}
                  <div className="flex flex-col gap-1">
                    <span className={`text-sm font-medium sm:hidden ${qtyColor}`}>
                      {qtySign} Adj. Qty
                    </span>
                    <div
                      className={`flex items-center gap-1 border rounded-lg px-2 h-[38px] focus-within:ring-2 ${qtyBorder}`}
                    >
                      <span className={`font-bold text-base select-none ${qtyColor}`}>
                        {qtySign}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.quantity === 0 ? "" : item.quantity}
                        onChange={(e) => updateField(rowIdx, "quantity", e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="0"
                        className={`w-full text-right bg-transparent outline-none text-sm font-bold ${qtyInputColor}`}
                      />
                    </div>
                  </div>

                  {/* Rate */}
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-gray-700 sm:hidden">Rate (₹)</span>
                    <div className="flex items-center border border-gray-300 rounded-lg px-2 h-[38px] focus-within:ring-2 focus-within:ring-blue-500">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.rate}
                        onChange={(e) => updateField(rowIdx, "rate", e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="w-full text-right bg-transparent outline-none text-sm"
                      />
                    </div>
                  </div>

                  {/* Amount (computed, read-only) */}
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-gray-700 sm:hidden">Amount (₹)</span>
                    <div className="flex items-center justify-end border border-gray-200 rounded-lg px-3 h-[38px] bg-gray-50">
                      <span className="text-gray-800 font-semibold text-sm">
                        {item.amount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Delete row */}
                  <div className="flex items-end justify-center">
                    <button
                      type="button"
                      onClick={() => removeRow(rowIdx)}
                      className="w-9 h-9 flex items-center justify-center border border-red-300 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
                      title="Remove row"
                    >
                      <FaTrash size={12} />
                    </button>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addRow}
              className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 border border-indigo-300 hover:border-indigo-500 rounded-lg px-4 py-1.5 transition-colors"
            >
              + Add Row
            </button>
          </fieldset>

          {/* ── Summary ─────────────────────────────────────────────────────── */}
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
                <span className={`font-bold ${qtyColor}`}>
                  {qtySign}{totalQty.toFixed(2)}
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

          {/* ── Actions ─────────────────────────────────────────────────────── */}
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
                ? isEdit ? "Updating…" : "Saving…"
                : isEdit ? "Update Adjustment" : "Save Adjustment"}
            </Button>
          </div>
        </form>
      </div>
    </HomeLayout>
  );
};

export default StockAdjustmentAddEdit;
