import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import HomeLayout from "../../../layouts/home";
import FormField from "../../../components/formfiled";
import FormPage from "../../../components/formpage";
import {
  useCreateStockAdjustment,
  useUpdateStockAdjustment,
  useGetStockAdjustmentById,
  useStockAdjustmentProductsQuery,
} from "../../../graphql/hooks/stockadjustments";
import { useBranchesQuery } from "../../../graphql/hooks/branches";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import { FaTrash } from "react-icons/fa";
import { todayYMD, normalizeToYMD } from "../../../utils/helper";
import { BRANCH_REQUIRED } from "../../../utils/branch";
import { useOfflineNumber, savedOffline } from "../../../offline/billing";
import { OFFLINE_SAVED_MESSAGE } from "../../../offline/saved";

// Shared row template so columns align; written in full so Tailwind generates it.
const ROW_GRID_SM =
  "sm:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_88px_120px_120px_120px_32px]";
const BOX = "flex items-center h-8 rounded-md border bg-white px-2.5 text-[13px]";
const MOBILE_LABEL = "sm:hidden block mb-0.5 text-[12px] font-medium text-slate-600";

// Types

interface Variant {
  id: string;
  name?: string;
  currentstock?: number;
  purchaserate?: number;
  baseunitid?: { id: string } | null;
  purchaseunitid?: { id: string } | null;
  unitconversions?: { unitid?: { id: string } | null; factor?: number }[];
}

// Default rate per base unit (stock moves in base units): purchaserate ÷ conversion factor.
const baseUnitRate = (v?: Variant): number => {
  const rate = Number(v?.purchaserate) || 0;
  const pu = v?.purchaseunitid?.id;
  if (!pu || pu === v?.baseunitid?.id) return rate;
  const conv = (v?.unitconversions || []).find((u) => u?.unitid?.id === pu);
  const factor = Number(conv?.factor) || 0;
  return factor > 0 ? Math.round((rate / factor) * 100) / 100 : rate;
};

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

// Component

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
  // firstBranchId fallback is for staff without a branch only; admin uses the chosen branch.
  const firstBranchId = branchesData?.getBranches?.[0]?.id || "";

  const adminId =
    type === "admin" ? admin?.id
    : type === "branch" ? (branch?.admin?.id || admin?.id || storedAdminId)
    : type === "staff" ? (staff?.admin?.id || admin?.id || storedAdminId)
    : (admin?.id || storedAdminId);

  const branchId =
    type === "admin" ? selectedBranchId
    : type === "branch" ? (branch?.id || selectedBranchId || storedBranchId || firstBranchId)
    : type === "staff" ? (staff?.branchid?.id || selectedBranchId || storedBranchId || firstBranchId)
    : (selectedBranchId || storedBranchId);

  // ── Header state
  const [adjDate, setAdjDate] = useState(todayYMD());
  const [adjType, setAdjType] = useState<"Shortage" | "Excess">("Shortage");
  const [reason, setReason] = useState("");

  // ── Items state
  const [items, setItems] = useState<AdjItem[]>([emptyItem()]);

  // ── Product data
  // Lite picker query: id/name + variant id/name/currentstock/purchaserate only.
  const { data: productData } = useStockAdjustmentProductsQuery(true, 500, 0);
  const allProducts: Product[] = productData?.getProductServices ?? [];

  // ── Fetch existing record for edit
  const { data: editData, loading: editLoading } = useGetStockAdjustmentById(
    id || "",
    adminId,
    branchId
  );

  // ── Mutations
  const { createStockAdjustment, loading: creating } = useCreateStockAdjustment();
  const { updateStockAdjustment, loading: updating } = useUpdateStockAdjustment();
  const saving = creating || updating;

  // ── Derived totals
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const totalAmount = items.reduce((s, i) => s + i.amount, 0);

  // ── Pre-populate form when editing
  useEffect(() => {
    if (!isEdit || !editData?.getStockAdjustmentById || allProducts.length === 0) return;

    const adj = editData.getStockAdjustmentById;

    setAdjDate(
      adj.adjustmentdate
        ? normalizeToYMD(adj.adjustmentdate) || todayYMD()
        : todayYMD()
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

  // ── Helpers

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
        rate: baseUnitRate(v),
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

  // Offline without network: this device's provisional SA- number (OFFLINE.md).
  const { number: offlineNo } = useOfflineNumber("stockadjustment", !isEdit);

  // ── Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validItems = items.filter((i) => i.productid && i.quantity > 0);
    if (validItems.length === 0) {
      dispatch(
        showMessage({ message: "Add at least one item with quantity > 0.", type: "error" })
      );
      return;
    }

    // The document needs a real branch; toast instead of disabling the button.
    if (!branchId) {
      dispatch(showMessage({ message: BRANCH_REQUIRED, type: "error" }));
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
        const r = await updateStockAdjustment({ variables: { id, input: payload } });
        dispatch(
          showMessage({ message: savedOffline(r?.data?.updateStockAdjustment) ? OFFLINE_SAVED_MESSAGE : "Stock adjustment updated successfully!", type: "success" })
        );
      } else {
        const r = await createStockAdjustment({
          variables: { input: { ...payload, adminid: adminId, branchid: branchId, ...(offlineNo ? { vouchernumber: offlineNo } : {}) } },
        });
        dispatch(
          showMessage({ message: savedOffline(r?.data?.createStockAdjustment) ? OFFLINE_SAVED_MESSAGE : "Stock adjustment saved successfully!", type: "success" })
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

  // Render
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
      <FormPage
        breadcrumb="Stock Adjustments"
        title={isEdit ? "Edit Stock Adjustment" : "Stock Adjustment Entry"}
        onSave={() => handleSubmit({ preventDefault() {} } as React.FormEvent)}
        onCancel={() => navigate("/stockadjustments")}
        saveLabel={
          saving
            ? isEdit ? "Updating…" : "Saving…"
            : isEdit ? "Update Adjustment" : "Save Adjustment"
        }
        saveDisabled={saving}
      >
        <div className="space-y-5 text-sm">

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

            {/* One grid template for header + rows so every column lines up. */}
            <div className={`hidden sm:grid ${ROW_GRID_SM} gap-2 px-1 pb-2 mb-2 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wide`}>
              <div>Product</div>
              <div>Variant</div>
              <div className="text-right">Sys. Stock</div>
              <div className={`text-right ${qtyColor}`}>{qtySign} Adj. Qty</div>
              <div className="text-right">Rate / Unit (₹)</div>
              <div className="text-right">Amount (₹)</div>
              <div />
            </div>

            {items.map((item, rowIdx) => {
              const variantOptions = item._variants.map((v) => ({
                label: v.name || "Default",
                value: v.id,
              }));
              // Shortage exceeds stock on hand.
              const overShort =
                adjType === "Shortage" && !!item.productid && item.quantity > (Number(item.systemstock) || 0);

              return (
                <div
                  key={rowIdx}
                  className={`grid grid-cols-2 ${ROW_GRID_SM} gap-2 items-start py-2 px-1 rounded-md hover:bg-slate-50/70 border-b border-slate-100 last:border-0`}
                >
                  {/* Product */}
                  <div className="col-span-2 sm:col-span-1 min-w-0">
                    <span className={MOBILE_LABEL}>Product</span>
                    <FormField
                      label=""
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
                  </div>

                  {/* Variant */}
                  <div className="col-span-2 sm:col-span-1 min-w-0">
                    <span className={MOBILE_LABEL}>Variant</span>
                    <FormField
                      label=""
                      name={`variantid-${rowIdx}`}
                      type="select"
                      searchable
                      value={item.variantid}
                      onChange={(e: any) => {
                        const v = item._variants.find((v) => v.id === e.target.value);
                        const prod = allProducts.find((p) => p.id === item.productid);
                        if (v && prod) applyProduct(rowIdx, prod, v);
                      }}
                      options={variantOptions}
                      disabled={!item.productid || item._variants.length <= 1}
                      placeholder={item.productid ? "Variant" : "—"}
                    />
                  </div>

                  {/* System stock (read-only) */}
                  <div>
                    <span className={MOBILE_LABEL}>Sys. Stock</span>
                    <div className={`${BOX} justify-end bg-slate-50 border-slate-200 ${overShort ? "text-rose-600 font-semibold" : "text-slate-600"}`}>
                      {item.productid ? item.systemstock : "—"}
                    </div>
                  </div>

                  {/* Adjusted qty */}
                  <div>
                    <span className={`${MOBILE_LABEL} ${qtyColor}`}>{qtySign} Adj. Qty</span>
                    <div className={`${BOX} gap-1 focus-within:ring-1 ${overShort ? "border-rose-500 focus-within:ring-rose-500" : qtyBorder}`}>
                      <span className={`font-bold select-none ${qtyColor}`}>{qtySign}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.quantity === 0 ? "" : item.quantity}
                        onChange={(e) => updateField(rowIdx, "quantity", e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="0"
                        className={`w-full min-w-0 text-right bg-transparent outline-none font-semibold ${qtyInputColor}`}
                      />
                    </div>
                    {overShort && (
                      <p className="mt-0.5 text-[11px] leading-tight text-rose-600">
                        Only {item.systemstock} in stock
                      </p>
                    )}
                  </div>

                  {/* Rate per base unit */}
                  <div>
                    <span className={MOBILE_LABEL}>Rate / Unit (₹)</span>
                    <div className={`${BOX} border-slate-300 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500`}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.rate === 0 ? "" : item.rate}
                        onChange={(e) => updateField(rowIdx, "rate", e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="0.00"
                        className="w-full min-w-0 text-right bg-transparent outline-none"
                      />
                    </div>
                  </div>

                  {/* Amount (computed) */}
                  <div>
                    <span className={MOBILE_LABEL}>Amount (₹)</span>
                    <div className={`${BOX} justify-end bg-slate-50 border-slate-200 font-semibold text-slate-800`}>
                      {item.amount.toFixed(2)}
                    </div>
                  </div>

                  {/* Remove row */}
                  <div className="col-span-2 sm:col-span-1 flex justify-end sm:justify-center">
                    <button
                      type="button"
                      onClick={() => removeRow(rowIdx)}
                      className="h-8 w-8 flex items-center justify-center rounded-md border border-rose-200 text-rose-400 hover:bg-rose-500 hover:border-rose-500 hover:text-white transition-colors"
                      title="Remove row"
                      aria-label="Remove row"
                    >
                      <FaTrash size={11} />
                    </button>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addRow}
              className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-dashed border-indigo-300 text-[13px] font-medium text-indigo-600 hover:border-indigo-500 hover:bg-indigo-50 transition-colors"
            >
              <span className="text-base leading-none">+</span> Add Product Row
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
        </div>
      </FormPage>
    </HomeLayout>
  );
};

export default StockAdjustmentAddEdit;
