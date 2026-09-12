import React, { useState, useEffect, useMemo } from "react";
import FormField from "../formfiled";
import Button from "../button";
import { getBaseQuantity, getInvoiceLineBaseQty, formatDateDMY } from "../../utils/helper";
import { belowCostError } from "../../utils/rates";
import { useAppSelector } from "../../redux/hooks";
import { usePriceResolvers } from "../../graphql/hooks/pricelists";
import { getStockShortfalls } from "../../utils/products/stockcheck";

/** ✅ Invoice line type */
export type InvoiceProduct = {
  productserviceid: string;
  variantid?: string | null;
  salesunitid?: string | null;
  purchaseunitid?: string | null;
  productname: string;
  unitquantity?: number | null;
  quantity: number;
  rate: number;
  discount?: number;
  gst?: number;
  total: number;
  salesaccountid?: string | null;
  purchaseaccountid?: string | null;
  serviceaccountid?: string | null;
  selectedUnitValue?: string | null;
};

type ProductSectionProps = {
  products: InvoiceProduct[];
  setProducts: React.Dispatch<React.SetStateAction<InvoiceProduct[]>>;
  productData: any[];
  partyAccount: any;
  type: "purchase" | "sales";
  onProductsChange?: (products: InvoiceProduct[]) => void;
  navigate: (path: string) => void;
  iservice?: boolean;
  /** Past invoices — powers "last 5 sale rates" history inside the product dropdown */
  invoiceHistory?: any[];
  /** Optional override for which module's permissions to check (e.g., salesorder instead of salesinvoice) */
  permissionModuleId?: string;
};

/** ✅ Safely convert unit value (string | object | null) → string | null */
const getUnitId = (value: any): string | null => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "id" in value) return value.id ?? null;
  return null;
};

/** ✅ Normalize backend product */
const normalizeProduct = (product: any) => ({
  ...product,
  productvariants: product.productvariants?.map((v: any) => ({
    ...v,
    baseunitid: v.baseunitid?.id,
    purchaseunitid: v.purchaseunitid?.id,
    unitconversions: v.unitconversions?.map((uc: any) => ({
      unitid: uc.unitid?.id,
      unitname: uc.unitid?.unitname,
      factor: uc.factor,
    })),
    unitprices: v.unitprices?.map((up: any) => ({
      ...up,
      unitid: up.unitid?.id,
      unitname: up.unitid?.unitname,
    })),
  })),
});

type Option = { label: string; value: string };

const ProductSection: React.FC<ProductSectionProps> = ({
  products,
  setProducts,
  productData,
  type,
  onProductsChange,
  partyAccount,
  navigate,
  iservice = false,
  invoiceHistory = [],
  permissionModuleId,
}) => {
  const normalizedProducts = productData.map(normalizeProduct);

  // Short-stock flags for lines that never passed through the Add box — an
  // order punched on the app/website is pre-filled straight into the list, and
  // its catalogue only gates on "in stock", not on the number. Shown inline on
  // the row itself rather than as a banner, so a 100-line invoice stays
  // readable and each problem sits next to the quantity that caused it.
  const shortfallByLine = useMemo(() => {
    const map = new Map<number, { required: number; available: number }>();
    if (type !== "sales" || iservice) return map;
    getStockShortfalls(products, normalizedProducts, { isService: iservice }).forEach((s) => {
      s.lineIndexes.forEach((i) => map.set(i, { required: s.required, available: s.available }));
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, productData, type, iservice]);

  const defaultModuleId = type === "sales" ? "salesinvoice" : "purchaseinvoice";
  const moduleId = permissionModuleId || defaultModuleId;
  const formPermissions = useAppSelector((state) => state.permissions.permissions?.formPermissions?.[moduleId] || {});
  const isFieldEnabled = (fieldId: string) => {
    return formPermissions[fieldId] !== false;
  };

  const [selectedProduct, setSelectedProduct] = useState<Partial<InvoiceProduct>>({});

  /** Last 5 times the selected product was sold/purchased — date, party, qty, rate, disc */
  const productSaleHistory = useMemo(() => {
    const pid = selectedProduct.productserviceid;
    if (!pid || !invoiceHistory.length) return [];
    const vid = selectedProduct.variantid;
    const selectedPartyId = partyAccount?.id;
    const rows: { time: number; cells: string[] }[] = [];
    invoiceHistory.forEach((inv: any) => {
      // If a party is selected, only show history for that party
      if (selectedPartyId) {
        const invPartyId = inv.partyacc?.id || inv.partyaccountid;
        if (invPartyId !== selectedPartyId) return;
      }
      (inv.productservice || []).forEach((line: any) => {
        const linePid = line.productserviceid?.id || line.productserviceid;
        const lineVid = line.variantid?.id || line.variantid;
        if (linePid !== pid) return;
        if (vid && lineVid && lineVid !== vid) return;
        rows.push({
          time: new Date(inv.billdate).getTime() || Number(inv.createdAt) || 0,
          cells: [
            formatDateDMY(inv.billdate),
            inv.partyacc?.accountname || "-",
            String(line.qty ?? 0),
            Number(line.rate || 0).toFixed(2),
            Number(line.discount || 0).toFixed(2),
          ],
        });
      });
    });
    return rows
      .sort((a, b) => b.time - a.time)
      .slice(0, 5)
      .map((r) => r.cells);
  }, [invoiceHistory, selectedProduct.productserviceid, selectedProduct.variantid, partyAccount?.id]);

  /** Get purchase/sale history for a specific product in the table */
  const getProductHistory = useMemo(() => {
    return (productId: string, variantId?: string) => {
      if (!productId || !invoiceHistory.length) return [];
      const rows: { time: number; cells: string[] }[] = [];
      invoiceHistory.forEach((inv: any) => {
        (inv.productservice || []).forEach((line: any) => {
          const linePid = line.productserviceid?.id || line.productserviceid;
          const lineVid = line.variantid?.id || line.variantid;
          if (linePid !== productId) return;
          if (variantId && lineVid && lineVid !== variantId) return;
          rows.push({
            time: new Date(inv.billdate).getTime() || Number(inv.createdAt) || 0,
            cells: [
              formatDateDMY(inv.billdate),
              inv.partyacc?.accountname || "-",
              String(line.qty ?? 0),
              Number(line.rate || 0).toFixed(2),
              Number(line.discount || 0).toFixed(2),
            ],
          });
        });
      });
      return rows
        .sort((a, b) => b.time - a.time)
        .slice(0, 5)
        .map((r) => r.cells);
    };
  }, [invoiceHistory]);

  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; field: string } | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [expandedHistoryIndex, setExpandedHistoryIndex] = useState<number | null>(null);

  const [qtyError, setQtyError] = useState<string | null>(null);

  // Selling below cost is blocked on sales lines. Purchase lines are exempt —
  // there the entered rate IS the purchase rate, so there is nothing to
  // compare it against. Rates are normalised per base unit before comparing,
  // so a Piece line and a Dozen line are both judged correctly.
  const rateError = useMemo(() => {
    if (type !== "sales" || iservice) return null;
    if (!selectedProduct?.productserviceid) return null;

    const product = normalizedProducts.find(
      (p: any) => p.id === selectedProduct.productserviceid
    );
    const variant = product?.productvariants?.find(
      (v: any) => v.id === selectedProduct.variantid
    );
    if (!variant) return null;

    const unitId = selectedProduct.salesunitid || variant.baseunitid;
    return belowCostError(variant, unitId, selectedProduct.rate) || null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    type,
    iservice,
    selectedProduct?.productserviceid,
    selectedProduct?.variantid,
    selectedProduct?.salesunitid,
    selectedProduct?.rate,
    productData,
  ]);
  const { resolvePrice } = usePriceResolvers();

  useEffect(() => {
    onProductsChange?.(products);
  }, [products, onProductsChange]);

  useEffect(() => {
    setSelectedProduct({});
  }, [partyAccount]);

  /** ✅ Calculate line total */
  const calculateLineTotal = () => {
    const qty = selectedProduct.quantity || 0;
    const rate = selectedProduct.rate || 0;
    const discount = selectedProduct.discount || 0;
    const gst = selectedProduct.gst || 0;

    const subtotal = qty * (rate - discount);
    const gstAmount = (subtotal * gst) / 100;

    return subtotal + gstAmount;
  };

  // ✅ Handle auto-save on blur for inline editing
  const handleCellBlur = (rowIndex: number, field: string, newValue: string) => {
    const numValue = parseFloat(newValue);
    if (isNaN(numValue)) return;

    setProducts((prev) =>
      prev.map((p, i) => {
        if (i !== rowIndex) return p;

        const updatedProduct = { ...p };

        if (field === "quantity") updatedProduct.quantity = numValue;
        else if (field === "rate") updatedProduct.rate = numValue;
        else if (field === "discount") updatedProduct.discount = numValue;
        else if (field === "gst") updatedProduct.gst = numValue;

        // Recalculate total
        const qty = updatedProduct.quantity || 0;
        const rate = updatedProduct.rate || 0;
        const discount = updatedProduct.discount || 0;
        const gst = updatedProduct.gst || 0;
        const subtotal = qty * (rate - discount);
        const gstAmount = (subtotal * gst) / 100;
        updatedProduct.total = subtotal + gstAmount;

        return updatedProduct;
      })
    );

    setEditingCell(null);
    setEditingValue("");
  };


  /** ✅ Add or update product line */
  const handleAddOrUpdateProduct = () => {
    if (!selectedProduct.productserviceid) return alert("Please select a product");
    if (!selectedProduct.quantity || !selectedProduct.rate) return alert("Enter qty & rate");
    // The button is already disabled in this case; this guards any other path
    // into the handler (keyboard submit, future callers).
    if (rateError) return;

     const product = normalizedProducts.find(
        (p) => p.id === selectedProduct.productserviceid
      );

      const variant = product?.productvariants.find(
        (v: any) => v.id === selectedProduct.variantid
      );

      if (!variant) return;

      const currentStock = Number(variant.currentstock ?? 0);
      const qty = Number(selectedProduct.quantity);

      const selectedUnitId =
        selectedProduct.salesunitid || variant.baseunitid;

      const newBaseQty = getBaseQuantity(qty, selectedUnitId!, variant);

      // 🔥 TOTAL USED STOCK (exclude editing row)
      const usedBaseQty = products
        .filter((_, i) => i !== editIndex)
        .filter(p => p.variantid === selectedProduct.variantid)
        .reduce((sum, p) => sum + getInvoiceLineBaseQty(p, variant), 0);

      // ❌ FINAL SALES VALIDATION
      if (type === "sales" && usedBaseQty + newBaseQty > currentStock) {
        setQtyError(
          `Sales quantity exceeds available stock (${currentStock} in base units)`
        );
        return;
      }

      // ✅ clear error
      setQtyError(null);

    const total = calculateLineTotal();

    const productLine: InvoiceProduct = {
      productserviceid: selectedProduct.productserviceid!,
      variantid: selectedProduct.variantid ?? null,
      salesunitid: type === "sales" ? getUnitId(selectedProduct.salesunitid) : null,
      purchaseunitid: type === "purchase" ? getUnitId(selectedProduct.purchaseunitid) : null,
      productname: selectedProduct.productname || "",
      unitquantity: selectedProduct.unitquantity ?? null,
      quantity: Number(selectedProduct.quantity),
      rate: Number(selectedProduct.rate),
      discount: Number(selectedProduct.discount ?? 0),
      gst: Number(selectedProduct.gst ?? 0),
      total,
      salesaccountid: selectedProduct.salesaccountid ?? null,
      purchaseaccountid: selectedProduct.purchaseaccountid ?? null,
      serviceaccountid: selectedProduct.serviceaccountid ?? null,
      selectedUnitValue: selectedProduct.selectedUnitValue ?? null,
    };

    setProducts((prev) =>
      editIndex !== null
        ? prev.map((p, i) => (i === editIndex ? productLine : p))
        : [...prev, productLine]
    );

    setSelectedProduct({});
    setEditIndex(null);
  };

  /** ✅ Edit row safely */
  const editProduct = (i: number) => {
    const prod = products[i];

    setSelectedProduct({
      ...prod,
      purchaseunitid: getUnitId(prod.purchaseunitid),
      salesunitid: getUnitId(prod.salesunitid),

      // ✅ Needed to show selected unit on edit
      selectedUnitValue:
        prod.salesunitid && prod.unitquantity
          ? `${prod.salesunitid}--${prod.unitquantity}`
          : null,
    });

    setEditIndex(i);
  };

  /** ✅ Remove */
  const removeProduct = (i: number) => {
    setProducts((prev) => prev.filter((_, idx) => idx !== i));
    if (editIndex === i) setEditIndex(null);
  };

  return (
    <fieldset className="border rounded-xl p-4 space-y-4 mt-6">
      <legend className="text-sm font-medium px-2">
        {iservice ? "Add Services" : "Add Products"}
      </legend>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* ✅ Product DropDown */}
        {isFieldEnabled("product") && (
          <FormField
            label={iservice ? "Service" : "Product"}
            name="productserviceid"
            type="select"
            value={
              iservice
                ? selectedProduct.variantid ?? ""
                : `${selectedProduct.productserviceid ?? ""}--${selectedProduct.variantid ?? ""}`
            }
            onChange={(e) => {
              if (!e.target.value) {
                setSelectedProduct({}); // ✕ clear → unselect product
                return;
              }
              const [pid, vid] = e.target.value.split("--");
              const product = normalizedProducts.find((p) => p.id === pid);
              const variant = product?.productvariants.find((v: any) => v.id === vid);

              const salesAccountId = getUnitId(product?.salesaccountid?.id) ?? null;
              const purchaseAccountId = getUnitId(product?.purchaseaccountid?.id) ?? null;
              const purchaseUnitId = getUnitId(variant?.purchaseunitid) ?? null;

              setSelectedProduct({
                productserviceid: pid,
                variantid: vid,
                productname: product?.name || "",
                rate:
                  type === "sales"
                    ? 0
                    : Number(variant?.purchaserate ?? 0),
                quantity: 1,
                gst: Number(variant?.gst ?? 0),
                salesaccountid: salesAccountId,
                purchaseaccountid: purchaseAccountId,
                purchaseunitid: purchaseUnitId,
              });
            }}
            options={normalizedProducts.flatMap((p) =>
              p.productvariants.map((v: any) => ({
                value: `${p.id}--${v.id}`,
                label: `${p.name} - ${v.name} - (Stock: ${v.currentstock ?? 0})`,
              }))
            )}
            searchable
            addable
            onAddNew={() => navigate("/products")}
            historyTitle={
              invoiceHistory.length
                ? selectedProduct.productserviceid
                  ? `Last 5 ${type === "purchase" ? "Purchase" : "Sale"} Rates of this Product`
                  : `Product ${type === "purchase" ? "Purchase" : "Sale"} History`
                : undefined
            }
            historyHeaders={["Date", "Party", "Qty", "Rate (₹)", "Disc (₹)"]}
            historyRows={productSaleHistory}
            historyEmptyText={
              selectedProduct.productserviceid
                ? `This product has no ${type === "purchase" ? "purchase" : "sale"} history yet.`
                : "Select a product first to see its history."
            }
          />
        )}

        {/* ✅ Sales Unit Select — FIXED */}
        {isFieldEnabled("unit") && type === "sales" && !iservice && (
          <FormField
            label="Unit"
            name="unit"
            type="select"
            value={selectedProduct.selectedUnitValue ?? ""}
            onChange={async (e) => {
              const [unitid, qtyStr] = e.target.value.split("--");
              const qty = parseFloat(qtyStr ?? "0");

              const product = normalizedProducts.find(
                (p) => p.id === selectedProduct.productserviceid
              );
              const variant = product?.productvariants.find(
                (v) => v.id === selectedProduct.variantid
              );

              if (!variant) return;

              // --- NEW RESOLUTION LOGIC ---
              let resolvedPrice = null;
              try {
                resolvedPrice = await resolvePrice({
                  productid: selectedProduct.productserviceid,
                  variantid: selectedProduct.variantid,
                  unitid,
                  accountid: partyAccount?.id,
                  channelid: partyAccount?.channel,
                  region: partyAccount?.region
                });
              } catch (err) {
                console.error("Price resolution failed, falling back:", err);
              }

              let correctRate = 0;
              let discount = 0;

              if (resolvedPrice) {
                correctRate = resolvedPrice.rate;
                discount = resolvedPrice.discount;
              } else {
                // FALLBACK to product-embedded pricing
                let price = variant.unitprices?.find(
                  (up: any) =>
                    (up.unitid?.id ?? up.unitid) === unitid &&
                    parseFloat(up.quantity) === qty
                ) ?? null;

                if (!price) {
                  price = variant.unitprices?.[0];
                }
                correctRate =
                  price?.offerprice && price.offerprice > 0
                    ? price.offerprice
                    : price?.salesrate ?? 0;
                discount = price?.discount ?? 0;
              }

              setSelectedProduct((prev) => ({
                ...prev,
                salesunitid: unitid,
                rate: Number(correctRate),
                discount: Number(discount),
                gst: Number(variant?.gst ?? 0),
                unitquantity: Number(qty),
                selectedUnitValue: e.target.value,
              }));
            }}
            options={
              (() => {
                const product = normalizedProducts.find(
                  (p) => p.id === selectedProduct.productserviceid
                );
                const variant = product?.productvariants.find(
                  (v) => v.id === selectedProduct.variantid
                );

                if (!variant?.unitprices) return [] as Option[];

                const allUnits = variant.unitprices.map((up: any) => ({
                  value: `${up.unitid?.id ?? up.unitid}--${up.quantity}`,
                  label: `${up.quantity} ${
                    up.unitname || up.unitid?.unitname || "Unit"
                  }`,
                }));

                const unique = Array.from(new Map(allUnits.map((u) => [u.value, u])).values());

                return unique as Option[];
              })()
            }
            searchable
          />
        )}

        {/* ✅ Quantity */}
        {isFieldEnabled("quantity") && (
          <FormField
            label="Quantity"
            name="quantity"
            type="number"
            value={selectedProduct.quantity ?? ""}
            onChange={(e) => {
              const qty = parseFloat(e.target.value);

              const product = normalizedProducts.find(
                (p) => p.id === selectedProduct.productserviceid
              );

              const variant = product?.productvariants.find(
                (v: any) => v.id === selectedProduct.variantid
              );

              if (!variant) return;

              const selectedUnitId = selectedProduct.salesunitid || variant.baseunitid;
              const baseQty = getBaseQuantity(qty, selectedUnitId, variant);

              const currentStock = Number(variant.currentstock ?? 0);

              // ✅ SALES ONLY validation
              if (type === "sales" && baseQty > currentStock) {
                setQtyError(
                  `Available stock (${currentStock} in base units)`
                );
              } else {
                setQtyError(null);
              }

              setSelectedProduct((prev) => ({
                ...prev,
                quantity: qty,
              }));
            }}
            error={qtyError}
          />
        )}

        {/* ✅ Rate */}
        {isFieldEnabled("rate") && (
          <FormField
            label="Rate"
            name="rate"
            type="number"
            value={selectedProduct.rate ?? ""}
            onChange={(e) =>
              setSelectedProduct({ ...selectedProduct, rate: parseFloat(e.target.value) })
            }
            error={rateError ?? undefined}
          />
        )}

        {/* ✅ Discount */}
        {isFieldEnabled("discount") && (
          <FormField
            label="Discount"
            name="discount"
            type="number"
            value={selectedProduct.discount ?? ""}
            onChange={(e) =>
              setSelectedProduct({ ...selectedProduct, discount: parseFloat(e.target.value) })
            }
          />
        )}

        {/* ✅ GST */}
        {isFieldEnabled("gst") && (
          <FormField
            label="GST %"
            name="gst"
            type="number"
            value={selectedProduct.gst ?? ""}
            onChange={(e) =>
              setSelectedProduct({ ...selectedProduct, gst: parseFloat(e.target.value) })
            }
          />
        )}
      </div>

      {/* ✅ Buttons */}
      <div className="flex gap-4">
        {isFieldEnabled("add_product_button") && (
          <Button
            type="button"
            variant="outline"
            onClick={handleAddOrUpdateProduct}
            disabled={!!rateError}
            title={rateError || undefined}
          >
            {editIndex !== null ? "Update" : "Add"}
          </Button>
        )}

        {editIndex !== null && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSelectedProduct({});
              setEditIndex(null);
            }}
          >
            Cancel
          </Button>
        )}
      </div>

      {/* ✅ Table */}
      <fieldset className="border rounded-xl p-4 mt-4">
        <legend className="text-sm font-medium px-2">
          {iservice ? "Services List" : "Products List"}
        </legend>

        {products.length === 0 ? (
          <div className="text-center text-gray-500">
            No {iservice ? "services" : "products"} added.
          </div>
        ) : (
          <div className="overflow-x-auto border-collapse">
            <table className="w-full border mt-2 border-collapse" style={{ tableLayout: "fixed", overflow: "visible" }}>
              <thead>
                <tr>
                  <th className="border p-2 w-80">Name</th>
                  {type === "sales" && (<th className="border p-2 w-20">Unit</th>)}
                  <th className="border p-2 w-16">Qty</th>
                  <th className="border p-2 w-24">Rate</th>
                  <th className="border p-2 w-20">Disc</th>
                  <th className="border p-2 w-16">GST%</th>
                  <th className="border p-2 w-24">Total</th>
                  <th className="border p-2 w-32">Action</th>
                </tr>
              </thead>

            <tbody>
              {products.map((p, i) => {
                const product = normalizedProducts.find(
                  (pd) => pd.id === p.productserviceid
                );
                const variant = product?.productvariants.find((v: any) => v.id === p.variantid);

                const shortfall = shortfallByLine.get(i);

                const price = variant?.unitprices
                ?.find(
                  (up: any) =>
                    (up.unitid?.id ?? up.unitid) === p.salesunitid &&
                    Number(up.quantity) === Number(p.unitquantity)
                );

                return (
                  <tr key={i}>
                    {/* Product Name */}
                    <td
                      className={`border p-2 w-80 align-top ${shortfall ? "bg-red-50 text-red-600" : ""}`}
                      style={
                        shortfall
                          ? { boxShadow: "inset 0 0 0 2px #ef4444", overflow: "visible" }
                          : { overflow: "visible" }
                      }
                    >
                      {product?.name} - {variant?.name} - (Stock: {variant?.currentstock ?? 0})
                      {shortfall && (
                        <div className="text-xs font-medium text-red-600">
                          Not enough stock — ordered {shortfall.required}, available{" "}
                          {shortfall.available} (base units), short by{" "}
                          {parseFloat((shortfall.required - shortfall.available).toFixed(2))}
                        </div>
                      )}
                    </td>

                    {/* Unit (Sales only) */}
                    {type === "sales" && (
                      <td className="border p-2 w-20 truncate text-center">
                        {price?.quantity} {price?.unitname}
                      </td>
                    )}

                    {/* Quantity - Double-click to edit */}
                    {isFieldEnabled("quantity") && (
                      <td
                        className="border p-2 w-16 cursor-pointer hover:bg-gray-100 text-center"
                        onDoubleClick={() => {
                          setEditingCell({ rowIndex: i, field: "quantity" });
                          setEditingValue(String(p.quantity));
                        }}
                      >
                        {editingCell?.rowIndex === i && editingCell?.field === "quantity" ? (
                          <input
                            type="number"
                            autoFocus
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={() => handleCellBlur(i, "quantity", editingValue)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleCellBlur(i, "quantity", editingValue);
                              if (e.key === "Escape") {
                                setEditingCell(null);
                                setEditingValue("");
                              }
                            }}
                            className="w-full border border-gray-300 px-2 py-1 rounded text-gray-700"
                            step="0.01"
                          />
                        ) : (
                          p.quantity
                        )}
                      </td>
                    )}

                    {/* Rate - Double-click to edit */}
                    {isFieldEnabled("rate") && (
                      <td
                        className="border p-2 w-24 cursor-pointer hover:bg-gray-100 text-center"
                        onDoubleClick={() => {
                          setEditingCell({ rowIndex: i, field: "rate" });
                          setEditingValue(String(p.rate));
                        }}
                      >
                        {editingCell?.rowIndex === i && editingCell?.field === "rate" ? (
                          <input
                            type="number"
                            autoFocus
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={() => handleCellBlur(i, "rate", editingValue)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleCellBlur(i, "rate", editingValue);
                              if (e.key === "Escape") {
                                setEditingCell(null);
                                setEditingValue("");
                              }
                            }}
                            className="w-full border border-gray-300 px-2 py-1 rounded text-gray-700"
                            step="0.01"
                          />
                        ) : (
                          p.rate.toFixed(2)
                        )}
                      </td>
                    )}

                    {/* Discount - Double-click to edit */}
                    {isFieldEnabled("discount") && (
                      <td
                        className="border p-2 w-20 cursor-pointer hover:bg-gray-100 text-center"
                        onDoubleClick={() => {
                          setEditingCell({ rowIndex: i, field: "discount" });
                          setEditingValue(String(p.discount ?? 0));
                        }}
                      >
                        {editingCell?.rowIndex === i && editingCell?.field === "discount" ? (
                          <input
                            type="number"
                            autoFocus
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={() => handleCellBlur(i, "discount", editingValue)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleCellBlur(i, "discount", editingValue);
                              if (e.key === "Escape") {
                                setEditingCell(null);
                                setEditingValue("");
                              }
                            }}
                            className="w-full border border-gray-300 px-2 py-1 rounded text-gray-700"
                            step="0.01"
                          />
                        ) : (
                          (p.discount ?? 0).toFixed(2)
                        )}
                      </td>
                    )}

                    {/* GST - Double-click to edit */}
                    {isFieldEnabled("gst") && (
                      <td
                        className="border p-2 w-16 cursor-pointer hover:bg-gray-100 text-center"
                        onDoubleClick={() => {
                          setEditingCell({ rowIndex: i, field: "gst" });
                          setEditingValue(String(p.gst ?? 0));
                        }}
                      >
                        {editingCell?.rowIndex === i && editingCell?.field === "gst" ? (
                          <input
                            type="number"
                            autoFocus
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={() => handleCellBlur(i, "gst", editingValue)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleCellBlur(i, "gst", editingValue);
                              if (e.key === "Escape") {
                                setEditingCell(null);
                                setEditingValue("");
                              }
                            }}
                            className="w-full border border-gray-300 px-2 py-1 rounded text-gray-700"
                            step="0.01"
                          />
                        ) : (
                          (p.gst ?? 0).toFixed(2)
                        )}
                      </td>
                    )}

                    {/* Total - Auto-calculated, read-only */}
                    <td className="border p-2 w-24 text-center font-medium">{p.total.toFixed(2)}</td>

                    {/* Action Buttons */}
                    <td className="border p-2 w-32">
                      <div className="flex gap-1 justify-center flex-wrap">
                        <button
                          type="button"
                          className="text-blue-500 hover:text-blue-700 font-medium text-xs whitespace-nowrap"
                          onClick={() => editProduct(i)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-purple-500 hover:text-purple-700 font-medium text-xs whitespace-nowrap"
                          onClick={() => setExpandedHistoryIndex(expandedHistoryIndex === i ? null : i)}
                        >
                          {expandedHistoryIndex === i ? "Hide" : "History"}
                        </button>
                        <button
                          type="button"
                          className="text-red-500 hover:text-red-700 font-medium text-xs whitespace-nowrap"
                          onClick={() => removeProduct(i)}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* History Row - Expandable */}
                  {expandedHistoryIndex === i && (
                    <tr key={`${i}-history`} className="bg-gray-50">
                      <td colSpan={type === "sales" ? 9 : 8} className="border p-4">
                        <div>
                          <h4 className="font-semibold text-sm mb-3">
                            {type === "purchase" ? "Purchase History" : "Sale History"}
                          </h4>
                          {(() => {
                            const history = getProductHistory(p.productserviceid, p.variantid ?? undefined);
                            if (!history || history.length === 0) {
                              return <p className="text-gray-500 text-sm">No history available for this product.</p>;
                            }
                            return (
                              <table className="w-full text-sm border">
                                <thead>
                                  <tr className="bg-gray-100">
                                    <th className="border p-2 text-left">Date</th>
                                    <th className="border p-2 text-left">Party</th>
                                    <th className="border p-2 text-center">Qty</th>
                                    <th className="border p-2 text-center">Rate (₹)</th>
                                    <th className="border p-2 text-center">Disc (₹)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {history.map((row, idx) => (
                                    <tr key={idx}>
                                      <td className="border p-2">{row[0]}</td>
                                      <td className="border p-2">{row[1]}</td>
                                      <td className="border p-2 text-center">{row[2]}</td>
                                      <td className="border p-2 text-center">{row[3]}</td>
                                      <td className="border p-2 text-center">{row[4]}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  )}
                );
              })}
            </tbody>
            </table>
          </div>
        )}
      </fieldset>
    </fieldset>
  );
};

export default ProductSection;
