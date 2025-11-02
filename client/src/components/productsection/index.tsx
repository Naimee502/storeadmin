import React, { useState, useEffect } from "react";
import FormField from "../formfiled";
import Button from "../button";

export type InvoiceProduct = {
  productserviceid: string;
  variantid?: string | null;
  salesunitid?: string | null;
  purchaseunitid?: string | null;
  productname: string;
  unitquantity?: number;
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
  accountsList: any[];
  unitsList: any[];
  partyAccount: any;
  type: "purchase" | "sales";
  onProductsChange?: (products: InvoiceProduct[]) => void;
  navigate: (path: string) => void;
  iservice?: boolean;
};

const ProductSection: React.FC<ProductSectionProps> = ({
  products,
  setProducts,
  productData,
  accountsList,
  unitsList,
  partyAccount,
  type,
  onProductsChange,
  navigate,
  iservice = false,
}) => {
  const normalizeProduct = (product: any) => ({
    ...product,
    productvariants: product.productvariants?.map((v: any) => ({
      ...v,
      baseunitid: v.baseunitid?.id,
      purchaseunitid: v.purchaseunitid?.id,
      unitconversions: v.unitconversions?.map((uc: any) => ({
        unitid: uc.unitid?.id,
        factor: uc.factor,
      })),
      pricing: v.pricing?.map((p: any) => ({
        ...p,
        unitprices: p.unitprices?.map((up: any) => ({
          ...up,
          unitid: up.unitid?.id,
        }))
      }))
    })),
  });

  const normalizedProducts = productData.map(normalizeProduct);

  const [selectedProduct, setSelectedProduct] = useState<Partial<InvoiceProduct>>({});
  const [editIndex, setEditIndex] = useState<number | null>(null);

  useEffect(() => {
    if (onProductsChange) onProductsChange(products);
  }, [products, onProductsChange]);

  // ✅ Barcode scanning uses normalizedProducts now
  useEffect(() => {
    if (iservice) return;

    let buffer = "";
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        const scanned = buffer.trim();
        if (scanned.length > 0) {
          const matchedVariant = normalizedProducts
            .flatMap((p) =>
              p.productvariants.map((v: any) => ({
                ...v,
                productServiceId: p.id,
                productname: p.name,
                salesaccountid: p.salesaccountid,
                purchaseaccountid: p.purchaseaccountid,
              }))
            )
            .find((v) => v.productbarcode === scanned);

          if (matchedVariant) {
            const firstUnit = matchedVariant.unitconversions?.[0];
            const firstPrice = matchedVariant.pricing?.[0]?.unitprices?.find(
              (up: any) => up.unitid?.toString() === firstUnit?.unitid?.toString()
            );

            setSelectedProduct({
              productserviceid: matchedVariant.productServiceId,
              variantid: matchedVariant.id,
              productname: matchedVariant.productname,
              salesunitid: type === "sales" ? firstUnit?.unitid : null,
              purchaseunitid: type === "purchase" ? firstUnit?.unitid : null,
              rate: firstPrice?.salesrate || matchedVariant.purchaserate || 0,
              gst: matchedVariant.gst || 0,
              salesaccountid: matchedVariant.salesaccountid,
              purchaseaccountid: matchedVariant.purchaseaccountid,
            });
          }
        }
        buffer = "";
        if (timer) clearTimeout(timer);
      } else if (e.key.length === 1) {
        buffer += e.key;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          buffer = "";
        }, 150);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [normalizedProducts, type, iservice]);

  const calculateLineTotal = () => {
    const qty = selectedProduct.quantity || 0;
    const rate = selectedProduct.rate || 0;
    const discount = selectedProduct.discount || 0;
    const gst = selectedProduct.gst || 0;
    const subtotal = qty * rate - discount;
    return subtotal + (subtotal * gst) / 100;
  };

  const handleAddOrUpdateProduct = () => {
    if (!selectedProduct.productserviceid) return alert("Please select a product/service.");
    if (!selectedProduct.quantity || !selectedProduct.rate) return alert("Enter quantity and rate.");

    const total = calculateLineTotal();
    const productLine: InvoiceProduct = {
      productserviceid: selectedProduct.productserviceid!,
      variantid: selectedProduct.variantid || null,
      salesunitid: type === "sales" ? selectedProduct.salesunitid || null : null,
      purchaseunitid: type === "purchase" ? selectedProduct.purchaseunitid || null : null,
      productname: selectedProduct.productname || "",
      unitquantity: type === "sales" ? selectedProduct.unitquantity! : 0,
      quantity: selectedProduct.quantity!,
      rate: selectedProduct.rate!,
      discount: selectedProduct.discount ?? 0,
      gst: selectedProduct.gst ?? 0,
      total,
      salesaccountid: selectedProduct.salesaccountid ?? null,
      purchaseaccountid: selectedProduct.purchaseaccountid ?? null,
      serviceaccountid: selectedProduct.serviceaccountid ?? null,
      selectedUnitValue: selectedProduct.selectedUnitValue ?? null,
    };

    if (editIndex !== null) {
      setProducts((prev) => prev.map((p, i) => (i === editIndex ? productLine : p)));
      setEditIndex(null);
    } else {
      setProducts((prev) => [...prev, productLine]);
    }

    setSelectedProduct({});
  };

  const removeProduct = (index: number) => {
    setProducts((prev) => prev.filter((_, i) => i !== index));
    if (editIndex === index) setEditIndex(null);
  };

  const editProduct = (index: number) => {
    setSelectedProduct({ ...products[index] });
    setEditIndex(index);
  };

  return (
    <fieldset className="border rounded-xl p-4 space-y-4 mt-6">
      <legend className="text-sm font-medium px-2">
        {iservice ? "Add Services" : "Add Products"}
      </legend>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Product / Service select */}
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
            if (iservice) {
              const svId = e.target.value;
              const service = normalizedProducts.find(
                (p) => p.isservice && p.servicevariants?.some((sv: any) => sv.id === svId)
              );
              if (!service) return;
              const variant = service.servicevariants.find((sv: any) => sv.id === svId);

              setSelectedProduct({
                productserviceid: service.id,
                variantid: variant?.id || null,
                productname: service.name,
                rate: variant?.servicerate || 0,
                gst: variant?.gst || 0,
                serviceaccountid: service.serviceaccountid,
              });
            } else {
              const [pid, vid] = e.target.value.split("--");
              const product = normalizedProducts.find((p) => p.id === pid);
              const variant = product?.productvariants.find((v: any) => v.id === vid);

              if (variant && product) {
                if (type === "purchase") {
                  const firstUnit = variant.unitconversions?.[0];

                  setSelectedProduct({
                    productserviceid: pid,
                    variantid: vid,
                    productname: product.name,
                    purchaseunitid: firstUnit?.unitid || null,
                    rate: variant.purchaserate || 0,
                    gst: variant.gst || 0,
                    salesaccountid: product.salesaccountid,
                    purchaseaccountid: product.purchaseaccountid,
                    serviceaccountid: product.serviceaccountid,
                  });
                } else {
                  setSelectedProduct({
                    productserviceid: pid,
                    variantid: vid,
                    productname: product.name,
                    rate: 0,
                    quantity: 0,
                    discount: 0,
                    gst: variant.gst || 0,
                    salesaccountid: product.salesaccountid,
                    purchaseaccountid: product.purchaseaccountid,
                    serviceaccountid: product.serviceaccountid,
                    selectedUnitValue: null,
                  });
                }
              }
            }
          }}
          options={
            iservice
              ? normalizedProducts
                  .filter((p) => p.isservice)
                  .flatMap((p) =>
                    p.servicevariants.map((sv: any) => ({
                      value: sv.id,
                      label: `${p.name} - ${sv.name}`,
                    }))
                  )
              : normalizedProducts
                  .filter((p) => !p.isservice)
                  .flatMap((p) =>
                    p.productvariants.map((v: any) => ({
                      value: `${p.id}--${v.id}`,
                      label: `${p.name} - ${v.name}`,
                    }))
                  )
          }
          searchable
          addable
          onAddNew={() => navigate("/products")}
        />

        {/* Unit select for sales */}
        {type === "sales" && !iservice && (
          <FormField
            label="Unit"
            name="unit"
            type="select"
            value={selectedProduct.selectedUnitValue ?? ""}
            onChange={(e) => {
              const [unitid, quantityStr] = e.target.value.split("--");
              const qty = Number(quantityStr);

              const variant = normalizedProducts
                .find((p) => p.id === selectedProduct.productserviceid)
                ?.productvariants.find((v: any) => v.id === selectedProduct.variantid);

              if (!variant) return;

              const unitPrice = variant.pricing?.[0]?.unitprices?.find(
                (up: any) =>
                  up.unitid?.toString() === unitid?.toString() &&
                  up.quantity === qty
              );

              if (!unitPrice) return;

              setSelectedProduct((prev) => ({
                ...prev,
                salesunitid: unitid,
                rate: unitPrice.offerprice || unitPrice.salesrate,
                discount: unitPrice.discount || 0,
                gst: variant.gst || 0,
                unitquantity: qty,
                selectedUnitValue: e.target.value,
              }));
            }}
            options={
              normalizedProducts
                .find((p) => p.id === selectedProduct.productserviceid)
                ?.productvariants.find((v: any) => v.id === selectedProduct.variantid)
                ?.pricing?.[0]?.unitprices.map((up: any) => {
                  const unit = unitsList.find(
                    (u) => u.id?.toString() === up.unitid?.toString()
                  );
                  return {
                    value: `${up.unitid}--${up.quantity}`,
                    label: `${up.quantity} ${unit?.unitname || "Unit"}`,
                  };
                }) || []
            }
            searchable
          />
        )}

        {/* Quantity */}
        <FormField
          label="Quantity"
          name="quantity"
          type="number"
          value={selectedProduct.quantity ?? ""}
          onChange={(e) => setSelectedProduct({ ...selectedProduct, quantity: +e.target.value })}
        />

        {/* Rate */}
        <FormField
          label="Rate"
          name="rate"
          type="number"
          value={selectedProduct.rate ?? ""}
          onChange={(e) => setSelectedProduct({ ...selectedProduct, rate: +e.target.value })}
        />

        {/* Discount */}
        <FormField
          label="Discount"
          name="discount"
          type="number"
          value={selectedProduct.discount ?? ""}
          onChange={(e) => setSelectedProduct({ ...selectedProduct, discount: +e.target.value })}
        />

        {/* GST */}
        <FormField
          label="GST %"
          name="gst"
          type="number"
          value={selectedProduct.gst ?? ""}
          onChange={(e) => setSelectedProduct({ ...selectedProduct, gst: +e.target.value })}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <Button onClick={handleAddOrUpdateProduct} variant="outline" type="button">
          {editIndex !== null ? "Update" : "Add"}
        </Button>
        {editIndex !== null && (
          <Button type="button" variant="outline" onClick={() => {
            setEditIndex(null);
            setSelectedProduct({});
          }}>
            Cancel Edit
          </Button>
        )}
      </div>

      {/* Product List */}
      <fieldset className="border rounded-xl p-4 mt-4">
        <legend className="text-sm font-medium px-2">
          {iservice ? "Services List" : "Products List"}
        </legend>

        {products.length === 0 ? (
          <div className="text-center text-gray-500">
            No {iservice ? "services" : "products"} added.
          </div>
        ) : (
          <table className="w-full text-left border-collapse border border-gray-300 mt-2">
            <thead>
              <tr>
                <th className="border p-2">Name</th>
                {type === "sales" && !iservice && <th className="border p-2">Unit</th>}
                <th className="border p-2">Qty</th>
                <th className="border p-2">Rate</th>
                <th className="border p-2">Discount</th>
                <th className="border p-2">GST %</th>
                <th className="border p-2">Total</th>
                <th className="border p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => {
                const product = normalizedProducts.find((prod) => prod.id === p.productserviceid);
                const variant = product?.productvariants.find((v: any) => v.id === p.variantid);
                const unitId = p.salesunitid || p.purchaseunitid;

                const pricing = variant?.pricing?.[0]?.unitprices?.find(
                  (up: any) => up.unitid?.toString() === unitId?.toString()
                );

                const unitInfo = unitsList.find(
                  (u) => u.id?.toString() === unitId?.toString()
                );

                return (
                  <tr key={i}>
                    <td className="border p-2">{variant ? `${product?.name} - ${variant.name}` : p.productname}</td>

                    {type === "sales" && !iservice && (
                      <td className="border p-2">
                        {pricing && unitInfo ? `${pricing.quantity} ${unitInfo.unitname}` : ""}
                      </td>
                    )}

                    <td className="border p-2">{p.quantity}</td>
                    <td className="border p-2">{p.rate.toFixed(2)}</td>
                    <td className="border p-2">{(p.discount ?? 0).toFixed(2)}</td>
                    <td className="border p-2">{(p.gst ?? 0).toFixed(2)}</td>
                    <td className="border p-2">{p.total.toFixed(2)}</td>
                    <td className="border p-2 space-x-2">
                      <button className="text-blue-500" onClick={() => editProduct(i)} type="button">Edit</button>
                      <button className="text-red-500" onClick={() => removeProduct(i)} type="button">Remove</button>
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
