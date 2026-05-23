// Tally-style Stock Transfer Voucher
// One voucher → multiple product lines
// From-branch stock is debited; to-branch stock is credited per item.

import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import HomeLayout from "../../../layouts/home";
import FormField from "../../../components/formfiled";
import Button from "../../../components/button";
import { FaTrash, FaExchangeAlt, FaCalendarAlt, FaFileAlt } from "react-icons/fa";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import { useBranchesQuery } from "../../../graphql/hooks/branches";
import { useProductServicesQuery } from "../../../graphql/hooks/products";
import {
  useTransferStockMutations,
  useTransferStockByIDQuery,
} from "../../../graphql/hooks/transferstock";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Variant {
  id: string;
  name?: string;
  currentstock?: number;
  purchaserate?: number;
  baseunitid?: any;
  unitconversions?: { unitid: any; factor: number }[];
}

interface Product {
  id: string;
  name: string;
  productvariants?: Variant[];
}

interface TransferItem {
  productid: string;
  productname: string;
  variantid: string;
  variantname: string;
  availablestock: number;
  transferunitid: string;
  unitOptions: { label: string; value: string }[];
  transferqty: number;
  rate: number;
  amount: number;
  _variants: Variant[];
}

const emptyItem = (): TransferItem => ({
  productid: "",
  productname: "",
  variantid: "",
  variantname: "",
  availablestock: 0,
  transferunitid: "",
  unitOptions: [],
  transferqty: 0,
  rate: 0,
  amount: 0,
  _variants: [],
});

// ─── Component ────────────────────────────────────────────────────────────────

const TransferStockAddEdit: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const { type, admin, branch, staff } = useAppSelector((state: any) => state.auth);
  const selectedBranchId = useAppSelector((state: any) => state.selectedBranch.branchId);
  const storedBranchId = localStorage.getItem("branchid") || "";
  const storedAdminId = localStorage.getItem("adminid") || "";

  const adminId =
    type === "admin" ? admin?.id
    : type === "branch" ? (branch?.admin?.id || admin?.id || storedAdminId)
    : type === "staff" ? (staff?.admin?.id || admin?.id || storedAdminId)
    : (admin?.id || storedAdminId);

  const { data: branchesData } = useBranchesQuery();
  const firstBranchId = branchesData?.getBranches?.[0]?.id || "";

  const fromBranchId =
    type === "admin" ? (selectedBranchId || firstBranchId)
    : type === "branch" ? (branch?.id || selectedBranchId || storedBranchId || firstBranchId)
    : type === "staff" ? (staff?.branchid?.id || selectedBranchId || storedBranchId || firstBranchId)
    : (selectedBranchId || storedBranchId || firstBranchId);

  const branches = branchesData?.getBranches || [];
  const fromBranchName = branches.find((b: any) => b.id === fromBranchId)?.branchname || fromBranchId;

  const { data: productData } = useProductServicesQuery(true, 500, 0);
  const allProducts: Product[] = productData?.getProductServices ?? [];

  const { addTransferStockMutation, editTransferStockMutation } = useTransferStockMutations();
  const { data: editData, loading: editLoading } = useTransferStockByIDQuery(id || "");

  // ── Header state ──────────────────────────────────────────────────────────
  const [tobranchid, setTobranchid] = useState("");
  const [transferdate, setTransferdate] = useState(new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState("");

  // ── Items state ───────────────────────────────────────────────────────────
  const [items, setItems] = useState<TransferItem[]>([emptyItem()]);

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalAmount = items.reduce((s, i) => s + i.amount, 0);
  const totalQty = items.reduce((s, i) => s + i.transferqty, 0);

  // ── Load edit data ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit || !editData?.getTransferStockById || allProducts.length === 0) return;
    const doc = editData.getTransferStockById;

    setTobranchid(doc.tobranchid || "");
    setTransferdate(doc.transferdate || new Date().toISOString().slice(0, 10));
    setNarration(doc.narration || "");

    const mapped: TransferItem[] = (doc.items || []).map((item: any) => {
      const product = allProducts.find((p) => p.id === item.productid);
      const variants = product?.productvariants ?? [];
      const variant = variants.find((v) => v.id === item.variantid);
      const unitOptions = buildUnitOptions(variant);

      return {
        productid: item.productid,
        productname: product?.name || "",
        variantid: item.variantid || "",
        variantname: variant?.name || "",
        availablestock: variant?.currentstock ?? 0,
        transferunitid: item.transferunitid || unitOptions[0]?.value || "",
        unitOptions,
        transferqty: item.transferqty,
        rate: item.rate ?? 0,
        amount: item.amount ?? 0,
        _variants: variants,
      };
    });

    setItems(mapped.length > 0 ? mapped : [emptyItem()]);
  }, [isEdit, editData, allProducts]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const buildUnitOptions = (variant?: Variant): { label: string; value: string }[] => {
    if (!variant) return [];
    const opts: { label: string; value: string }[] = [];

    (variant.unitconversions || []).forEach((uc) => {
      const unitId = typeof uc.unitid === "object" ? uc.unitid.id : uc.unitid;
      const unitName = typeof uc.unitid === "object" ? uc.unitid.unitname : "Unit";
      if (unitId) opts.push({ label: unitName, value: unitId });
    });

    if (opts.length === 0 && variant.baseunitid) {
      const baseId = typeof variant.baseunitid === "object" ? variant.baseunitid.id : variant.baseunitid;
      const baseName = typeof variant.baseunitid === "object" ? variant.baseunitid.unitname : "Base Unit";
      if (baseId) opts.push({ label: baseName, value: baseId });
    }

    return opts;
  };

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
    const unitOptions = buildUnitOptions(v);
    setItems((prev) => {
      const next = [...prev];
      next[rowIdx] = {
        productid: product.id,
        productname: product.name,
        variantid: v?.id ?? "",
        variantname: v?.name ?? "",
        availablestock: v?.currentstock ?? 0,
        transferunitid: unitOptions[0]?.value ?? "",
        unitOptions,
        transferqty: 0,
        rate: v?.purchaserate ?? 0,
        amount: 0,
        _variants: product.productvariants ?? [],
      };
      return next;
    });
  };

  const applyVariant = (rowIdx: number, variantId: string) => {
    setItems((prev) => {
      const next = [...prev];
      const item = next[rowIdx];
      const product = allProducts.find((p) => p.id === item.productid);
      const v = item._variants.find((v) => v.id === variantId);
      if (!v || !product) return prev;
      const unitOptions = buildUnitOptions(v);
      next[rowIdx] = {
        ...item,
        variantid: v.id,
        variantname: v.name ?? "",
        availablestock: v.currentstock ?? 0,
        transferunitid: unitOptions[0]?.value ?? "",
        unitOptions,
        transferqty: 0,
        rate: v.purchaserate ?? 0,
        amount: 0,
      };
      return next;
    });
  };

  const updateField = (rowIdx: number, field: "transferqty" | "rate", raw: string) => {
    const val = Math.max(0, Number(raw) || 0);
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[rowIdx], [field]: val };
      item.amount = item.transferqty * item.rate;
      next[rowIdx] = item;
      return next;
    });
  };

  const addRow = () => setItems((prev) => [...prev, emptyItem()]);
  const removeRow = (idx: number) =>
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length === 0 ? [emptyItem()] : next;
    });

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!tobranchid) return "Please select a destination branch.";
    if (tobranchid === fromBranchId) return "From and To branch cannot be the same.";
    if (!transferdate) return "Transfer date is required.";

    const validItems = items.filter((i) => i.productid && i.transferqty > 0);
    if (validItems.length === 0) return "Add at least one item with quantity > 0.";

    for (const item of validItems) {
      if (item.transferqty > item.availablestock) {
        return `"${item.productname}${item.variantname ? ` (${item.variantname})` : ""}" — transfer qty (${item.transferqty}) exceeds available stock (${item.availablestock}).`;
      }
    }
    return null;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      dispatch(showMessage({ message: err, type: "error" }));
      return;
    }

    const creatorName =
      type === "admin" ? admin?.name
      : type === "branch" ? branch?.branchname || branch?.name
      : type === "staff" ? staff?.name
      : undefined;

    const validItems = items.filter((i) => i.productid && i.transferqty > 0);

    const input = {
      frombranchid: fromBranchId,
      tobranchid,
      transferdate,
      narration,
      admin: adminId,
      totalamount: totalAmount,
      createdby_id: admin?.id || branch?.id || staff?.id,
      createdby_name: creatorName,
      createdby_type: type || "admin",
      items: validItems.map((i) => ({
        productid: i.productid,
        variantid: i.variantid || undefined,
        transferunitid: i.transferunitid || undefined,
        transferqty: i.transferqty,
        rate: i.rate,
        amount: i.amount,
      })),
    };

    try {
      if (isEdit && id) {
        await editTransferStockMutation({ variables: { id, input } });
        dispatch(showMessage({ message: "Transfer voucher updated successfully!", type: "success" }));
      } else {
        await addTransferStockMutation({ variables: { input } });
        dispatch(showMessage({ message: "Stock transferred successfully!", type: "success" }));
      }
      navigate("/transferstock");
    } catch (error: any) {
      dispatch(showMessage({ message: error.message || "Operation failed!", type: "error" }));
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (isEdit && editLoading) {
    return (
      <HomeLayout>
        <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
          Loading transfer voucher…
        </div>
      </HomeLayout>
    );
  }

  const toBranchOptions = branches
    .filter((b: any) => b.id !== fromBranchId)
    .map((b: any) => ({ label: `${b.branchname} (${b.branchcode})`, value: b.id }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-10 text-sm">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Title ──────────────────────────────────────────────────────── */}
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-6">
            {isEdit ? "Edit Transfer Stock" : "Add Transfer Stock"}
          </h2>

          {/* ── Voucher Header ──────────────────────────────────────────────── */}
          <fieldset className="border rounded-xl p-4">
            <legend className="text-sm font-semibold px-2">Voucher Details</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

              {/* From Branch — read-only display */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">From Branch</label>
                <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 h-[42px]">
                  <span className="text-gray-700 font-medium text-sm">{fromBranchName || "—"}</span>
                </div>
              </div>

              {/* To Branch */}
              <FormField
                label="To Branch"
                name="tobranchid"
                type="select"
                searchable
                value={tobranchid}
                onChange={(e: any) => setTobranchid(e.target.value)}
                options={toBranchOptions}
                placeholder="Select destination branch…"
                icon={<FaExchangeAlt />}
                required
              />

              {/* Date */}
              <FormField
                label="Transfer Date"
                name="transferdate"
                type="date"
                value={transferdate}
                onChange={(e: any) => setTransferdate(e.target.value)}
                icon={<FaCalendarAlt />}
                required
              />

              {/* Narration */}
              <FormField
                label="Narration / Remarks"
                name="narration"
                type="text"
                value={narration}
                onChange={(e: any) => setNarration(e.target.value)}
                placeholder="Reason for transfer…"
                icon={<FaFileAlt />}
              />
            </div>
          </fieldset>

          {/* ── Items ───────────────────────────────────────────────────────── */}
          <fieldset className="border rounded-xl p-4">
            <legend className="text-sm font-semibold px-2">Transfer Items</legend>

            {/* Desktop column headers */}
            <div className="hidden lg:grid lg:grid-cols-[2fr_1fr_90px_100px_100px_90px_90px_36px] gap-2 mb-2 px-1 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b pb-2">
              <div>Product</div>
              <div>Variant</div>
              <div className="text-center">Avail. Stock</div>
              <div className="text-center">Unit</div>
              <div className="text-center">Transfer Qty</div>
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
              const overStock = item.transferqty > 0 && item.transferqty > item.availablestock;

              return (
                <div
                  key={rowIdx}
                  className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_90px_100px_100px_90px_90px_36px] gap-2 items-end mb-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0 last:mb-0"
                >
                  {/* Product */}
                  <FormField
                    label="Product"
                    name={`productid-${rowIdx}`}
                    type="select"
                    searchable
                    value={item.productid}
                    onChange={(e: any) => {
                      const prod = allProducts.find((p) => p.id === e.target.value);
                      if (prod) applyProduct(rowIdx, prod);
                      else setItems((prev) => { const n=[...prev]; n[rowIdx]=emptyItem(); return n; });
                    }}
                    options={productOptions}
                    placeholder="Search product…"
                  />

                  {/* Variant */}
                  <FormField
                    label="Variant"
                    name={`variantid-${rowIdx}`}
                    type="select"
                    searchable={item._variants.length > 6}
                    value={item.variantid}
                    onChange={(e: any) => applyVariant(rowIdx, e.target.value)}
                    options={variantOptions}
                    disabled={!item.productid || item._variants.length <= 1}
                    placeholder="Variant"
                  />

                  {/* Available Stock */}
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-gray-700 lg:hidden">Avail. Stock</span>
                    <div className={`flex items-center justify-center border rounded-lg px-2 h-[38px] ${
                      overStock ? "border-red-400 bg-red-50" : "border-gray-200 bg-gray-50"
                    }`}>
                      <span className={`font-medium text-sm ${overStock ? "text-red-600" : "text-gray-600"}`}>
                        {item.availablestock}
                      </span>
                    </div>
                    {overStock && (
                      <span className="text-xs text-red-500">Exceeds stock!</span>
                    )}
                  </div>

                  {/* Unit */}
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-gray-700 lg:hidden">Unit</span>
                    {item.unitOptions.length > 1 ? (
                      <select
                        value={item.transferunitid}
                        onChange={(e) =>
                          setItems((prev) => {
                            const next = [...prev];
                            next[rowIdx] = { ...next[rowIdx], transferunitid: e.target.value };
                            return next;
                          })
                        }
                        className="w-full text-sm bg-white border border-gray-300 rounded-lg px-2 py-2 outline-none h-[38px]"
                      >
                        {item.unitOptions.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center border border-gray-200 rounded-lg px-2 h-[38px] bg-gray-50">
                        <span className="text-gray-600 text-sm truncate">
                          {item.unitOptions[0]?.label || "—"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Transfer Qty */}
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-gray-700 lg:hidden">Transfer Qty</span>
                    <div className={`flex items-center border rounded-lg px-2 h-[38px] focus-within:ring-2 ${
                      overStock
                        ? "border-red-400 focus-within:ring-red-400"
                        : "border-indigo-400 focus-within:ring-indigo-400"
                    }`}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.transferqty === 0 ? "" : item.transferqty}
                        onChange={(e) => updateField(rowIdx, "transferqty", e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="0"
                        className={`w-full text-right bg-transparent outline-none text-sm font-bold ${
                          overStock ? "text-red-700" : "text-indigo-700"
                        }`}
                      />
                    </div>
                  </div>

                  {/* Rate */}
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-gray-700 lg:hidden">Rate (₹)</span>
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

                  {/* Amount */}
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-gray-700 lg:hidden">Amount (₹)</span>
                    <div className="flex items-center justify-end border border-gray-200 rounded-lg px-3 h-[38px] bg-gray-50">
                      <span className="text-gray-800 font-semibold text-sm">
                        {item.amount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Delete */}
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
                <span className="text-gray-500">Total Qty Transferred:</span>
                <span className="font-bold text-indigo-600">{totalQty.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2 text-base">
                <span className="text-gray-500">Total Value:</span>
                <span className="font-bold text-blue-700 text-lg">₹{totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </fieldset>

          {/* ── Actions ─────────────────────────────────────────────────────── */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => navigate("/transferstock")}>
              Cancel
            </Button>
            <Button type="submit" variant="outline">
              {isEdit ? "Update Transfer" : "Save Transfer"}
            </Button>
          </div>
        </form>
      </div>
    </HomeLayout>
  );
};

export default TransferStockAddEdit;
