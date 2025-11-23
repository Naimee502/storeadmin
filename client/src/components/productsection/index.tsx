import React, { useState, useEffect } from "react";
import FormField from "../formfiled";
import Button from "../button";

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
    pricing: v.pricing?.map((p: any) => ({
      ...p,
      unitprices: p.unitprices?.map((up: any) => ({
        ...up,
        unitid: up.unitid?.id,
        unitname: up.unitid?.unitname,
      })),
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
}) => {
  const normalizedProducts = productData.map(normalizeProduct);

  const [selectedProduct, setSelectedProduct] = useState<Partial<InvoiceProduct>>({});
  const [editIndex, setEditIndex] = useState<number | null>(null);

  useEffect(() => {
    console.log("🔥 Party Account Received:", JSON.stringify(partyAccount));
  }, [partyAccount]);

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

  /** ✅ Add or update product line */
  const handleAddOrUpdateProduct = () => {
    if (!selectedProduct.productserviceid) return alert("Please select a product");
    if (!selectedProduct.quantity || !selectedProduct.rate) return alert("Enter qty & rate");

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
            const [pid, vid] = e.target.value.split("--");
            const product = normalizedProducts.find((p) => p.id === pid);
            const variant = product?.productvariants.find((v: any) => v.id === vid);

            setSelectedProduct({
              productserviceid: pid,
              variantid: vid,
              productname: product?.name || "",
              rate: type === "sales"
              ? 0                      
              : Number(variant?.purchaserate ?? 0),
              quantity: 1,
              gst: Number(variant?.gst ?? 0),
              salesaccountid: product?.salesaccountid?.id ?? null,
              purchaseaccountid: product?.purchaseaccountid?.id ?? null,
              purchaseunitid: variant?.purchaseunitid?.id ?? null,
            });
          }}
          options={normalizedProducts.flatMap((p) =>
            p.productvariants.map((v: any) => ({
              value: `${p.id}--${v.id}`,
              label: `${p.name} - ${v.name}`,
            }))
          )}
          searchable
          addable
          onAddNew={() => navigate("/products")}
        />

        {/* ✅ Sales Unit Select — FIXED */}
        {type === "sales" && !iservice && (
          <FormField
            label="Unit"
            name="unit"
            type="select"
            value={selectedProduct.selectedUnitValue ?? ""}
            onChange={(e) => {
              const [unitid, qtyStr] = e.target.value.split("--");
              const qty = parseFloat(qtyStr ?? "0");

              const product = normalizedProducts.find(
                (p) => p.id === selectedProduct.productserviceid
              );
              const variant = product?.productvariants.find(
                (v) => v.id === selectedProduct.variantid
              );

              if (!variant) return;

              const state = partyAccount?.state?.toLowerCase();
              const channel = partyAccount?.accounttype?.toLowerCase();

              // STEP 1: Pricing Priority
              const matchedPricing = variant.pricing.find(
                (p: any) =>
                  p.region?.toLowerCase() === state &&
                  p.channel?.toLowerCase() === channel
              );

              const fallbackRetail = variant.pricing.find(
                (p: any) => p.channel?.toLowerCase() === "retail"
              );

              const fallbackEndUser = variant.pricing.find(
                (p: any) => p.channel?.toLowerCase() === "enduser"
              );

              // STEP 2: Pick best pricing based on priority
              let pricingToUse =
                matchedPricing || fallbackRetail || fallbackEndUser || null;

              // STEP 3: If selected unit NOT found in selected pricing, find proper fallback
              let price =
                pricingToUse?.unitprices?.find(
                  (up: any) =>
                    (up.unitid?.id ?? up.unitid) === unitid &&
                    parseFloat(up.quantity) === qty
                ) ?? null;

              // If not found → search inside ALL pricing objects
              if (!price) {
                const priceSearch = variant.pricing.flatMap((p: any) =>
                  p.unitprices.map((up: any) => ({ ...up, priceObj: p }))
                );

                const found = priceSearch.find(
                  (up: any) =>
                    (up.unitid?.id ?? up.unitid) === unitid &&
                    parseFloat(up.quantity) === qty
                );

                if (found) {
                  price = found;
                  pricingToUse = found.priceObj;
                }
              }

              // If STILL nothing → just use fallback default
              if (!price) {
                pricingToUse = variant.pricing[0];
                price = variant.pricing[0].unitprices[0];
              }

              // FINAL RATE
              const correctRate =
                price?.offerprice && price.offerprice > 0
                  ? price.offerprice
                  : price?.salesrate ?? 0;

              setSelectedProduct((prev) => ({
                ...prev,
                salesunitid: unitid,
                rate: Number(correctRate),
                discount: Number(price?.discount ?? 0),
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

                if (!variant?.pricing) return [] as Option[];

                const allUnits = variant.pricing.flatMap((p: any) =>
                  p.unitprices.map((up: any) => ({
                    value: `${up.unitid?.id ?? up.unitid}--${up.quantity}`,
                    label: `${up.quantity} ${
                      up.unitname || up.unitid?.unitname || "Unit"
                    }`,
                  }))
                );

                const unique = Array.from(new Map(allUnits.map((u) => [u.value, u])).values());

                return unique as Option[];
              })()
            }
            searchable
          />
        )}

        {/* ✅ Quantity */}
        <FormField
          label="Quantity"
          name="quantity"
          type="number"
          value={selectedProduct.quantity ?? ""}
          onChange={(e) =>
            setSelectedProduct({ ...selectedProduct, quantity: parseFloat(e.target.value) })
          }
        />

        {/* ✅ Rate */}
        <FormField
          label="Rate"
          name="rate"
          type="number"
          value={selectedProduct.rate ?? ""}
          onChange={(e) =>
            setSelectedProduct({ ...selectedProduct, rate: parseFloat(e.target.value) })
          }
        />

        {/* ✅ Discount */}
        <FormField
          label="Discount"
          name="discount"
          type="number"
          value={selectedProduct.discount ?? ""}
          onChange={(e) =>
            setSelectedProduct({ ...selectedProduct, discount: parseFloat(e.target.value) })
          }
        />

        {/* ✅ GST */}
        <FormField
          label="GST %"
          name="gst"
          type="number"
          value={selectedProduct.gst ?? ""}
          onChange={(e) =>
            setSelectedProduct({ ...selectedProduct, gst: parseFloat(e.target.value) })
          }
        />
      </div>

      {/* ✅ Buttons */}
      <div className="flex gap-4">
        <Button type="button" variant="outline" onClick={handleAddOrUpdateProduct}>
          {editIndex !== null ? "Update" : "Add"}
        </Button>

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
          <table className="w-full border mt-2">
            <thead>
              <tr>
                <th className="border p-2">Name</th>
                {type === "sales" && (<th className="border p-2">Unit</th>)}
                <th className="border p-2">Qty</th>
                <th className="border p-2">Rate</th>
                <th className="border p-2">Disc</th>
                <th className="border p-2">GST%</th>
                <th className="border p-2">Total</th>
                <th className="border p-2">Action</th>
              </tr>
            </thead>

            <tbody>
              {products.map((p, i) => {
                const product = normalizedProducts.find(
                  (pd) => pd.id === p.productserviceid
                );
                const variant = product?.productvariants.find((v: any) => v.id === p.variantid);

                const price = variant?.pricing
                ?.flatMap((p: any) => p.unitprices)
                .find(
                  (up: any) =>
                    (up.unitid?.id ?? up.unitid) === p.salesunitid &&
                    Number(up.quantity) === Number(p.unitquantity)
                );

                return (
                  <tr key={i}>
                    <td className="border p-2">
                      {product?.name} - {variant?.name}
                    </td>
                    {type === "sales" && (
                    <td className="border p-2">
                      {price?.quantity} {price?.unitname}
                    </td>)}
                    <td className="border p-2">{p.quantity}</td>
                    <td className="border p-2">{p.rate.toFixed(2)}</td>
                    <td className="border p-2">{(p.discount ?? 0).toFixed(2)}</td>
                    <td className="border p-2">{(p.gst ?? 0).toFixed(2)}</td>
                    <td className="border p-2">{p.total.toFixed(2)}</td>
                    <td className="border p-2 space-x-2">
                      <button
                        type="button"
                        className="text-blue-500"
                        onClick={() => editProduct(i)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="text-red-500"
                        onClick={() => removeProduct(i)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </fieldset>
    </fieldset>
  );
};

export default ProductSection;
