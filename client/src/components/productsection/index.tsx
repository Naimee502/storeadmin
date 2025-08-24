import React, { useState, useEffect } from "react";
import FormField from "../formfiled";
import Button from "../button";

export type InvoiceProduct = {
  productserviceid: string;
  variantid?: string | null;
  salesunitid?: string | null;
  purchaseunitid?: string | null;
  productname: string;
  quantity: number;
  rate: number;
  discount?: number;
  gst?: number;
  total: number;
  salesaccountid?: string | null;
  purchaseaccountid?: string | null;
  serviceaccountid?: string | null;
};

type ProductOption = {
  productserviceid: string;
  variantid?: string | null;
  parentId: string;
  name: string;
  currentstock?: number;
  barcode?: string;
  purchaserate?: number;
  salesrate?: number;
  isservice?: boolean;
  salesaccountid?: string | null;
  purchaseaccountid?: string | null;
  serviceaccountid?: string | null;
  salesUnits?: { value: string; label: string; factor: number }[];
  defaultSalesUnit?: string;
  purchaseUnits?: { value: string; label: string; factor: number }[];
  defaultPurchaseUnit?: string;
};

type ProductSectionProps = {
  products: InvoiceProduct[];
  setProducts: React.Dispatch<React.SetStateAction<InvoiceProduct[]>>;
  productsList: ProductOption[];
  onProductsChange: (products: InvoiceProduct[]) => void;
  type: "purchase" | "sales" | "service";
};

const ProductSection: React.FC<ProductSectionProps> = ({
  products,
  setProducts,
  productsList,
  onProductsChange,
  type,
}) => {
  const [currentProduct, setCurrentProduct] = useState<Partial<InvoiceProduct>>({});
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const selectedProduct = productsList.find(
    (p) =>
      p.productserviceid === currentProduct.productserviceid &&
      p.variantid === currentProduct.variantid
  );

  // Notify parent on products change
  useEffect(() => {
    onProductsChange(products);
  }, [products, onProductsChange]);

  // Handle input changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === "productserviceid") {
      const [productserviceid, variantid] = value.split("--");
      const selected = productsList.find(
        (p) => p.productserviceid === productserviceid && p.variantid === variantid
      );

      if (type === "sales" && selected?.currentstock === 0) {
        alert("⚠️ This product is out of stock and cannot be selected.");
        return;
      }

      setCurrentProduct((prev) => ({
        ...prev,
        productserviceid,
        variantid,
        salesunitid: type === "sales" ? selected?.defaultSalesUnit ?? null : prev.salesunitid,
        purchaseunitid:
          type === "purchase" ? selected?.defaultPurchaseUnit ?? null : prev.purchaseunitid,
      }));
    } else if (name === "salesunitid" || name === "purchaseunitid") {
      setCurrentProduct((prev) => ({
        ...prev,
        [name]: value,
      }));
    } else if (name === "rate") {
      setCurrentProduct((prev) => ({
        ...prev,
        rate: parseFloat(value) || 0,
      }));
    } else {
      setCurrentProduct((prev) => ({
        ...prev,
        [name]: ["quantity", "discount", "gst"].includes(name)
          ? value === ""
            ? undefined
            : parseFloat(value)
          : value,
      }));
    }
  };

  // Auto-set rate & account IDs on product/unit select
  useEffect(() => {
    if (!selectedProduct) return;

    const baseRate =
      type === "sales"
        ? selectedProduct.salesrate ?? 0
        : type === "purchase"
        ? selectedProduct.purchaserate ?? 0
        : 0;

    console.log("Selected Product Full:", selectedProduct);

    let factor = 1;

    if (type === "sales") {
      const selectedUnit = selectedProduct.salesUnits?.find(
        (u) => String(u.value) === String(currentProduct.salesunitid)
      );
      factor = Number(selectedUnit?.factor ?? 1);
    } else if (type === "purchase") {
      const selectedUnit = selectedProduct.purchaseUnits?.find(
        (u) => String(u.value) === String(currentProduct.purchaseunitid)
      );
      factor = Number(selectedUnit?.factor ?? 1);
    }

    setCurrentProduct((prev) => ({
      ...prev,
      salesunitid: prev.salesunitid ?? selectedProduct.defaultSalesUnit ?? null,
      purchaseunitid: prev.purchaseunitid ?? selectedProduct.defaultPurchaseUnit ?? null,
      rate: baseRate * factor,
      salesaccountid: selectedProduct.salesaccountid ?? null,
      purchaseaccountid: selectedProduct.purchaseaccountid ?? null,
      serviceaccountid: selectedProduct.serviceaccountid ?? null,
    }));

    console.log("Selected Product:", selectedProduct.name);
    console.log("Selected Unit Factor:", factor);
    console.log("Calculated Rate:", baseRate * factor);
  }, [selectedProduct, currentProduct.salesunitid, currentProduct.purchaseunitid, type]);

  // Barcode scanning (only for products)
  useEffect(() => {
    if (type === "service") return;

    let buffer = "";
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        const scannedBarcode = buffer.trim();
        if (scannedBarcode.length > 0) {
          const matchedProduct = productsList.find((p) => p.barcode === scannedBarcode);
          if (matchedProduct) {
            setCurrentProduct((prev) => ({
              ...prev,
              productserviceid: matchedProduct.productserviceid,
              variantid: matchedProduct.variantid,
              salesunitid:
                type === "sales" ? matchedProduct.defaultSalesUnit ?? null : prev.salesunitid,
              purchaseunitid:
                type === "purchase"
                  ? matchedProduct.defaultPurchaseUnit ?? null
                  : prev.purchaseunitid,
            }));
          }
        }
        buffer = "";
        if (timer) clearTimeout(timer);
      } else if (e.key.length === 1) {
        buffer += e.key;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          buffer = "";
          timer = null;
        }, 100);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timer) clearTimeout(timer);
    };
  }, [productsList, type]);

  const calculateLineTotal = () => {
    const qty = currentProduct.quantity || 0;
    const rate = currentProduct.rate || 0;
    const discount = currentProduct.discount || 0;
    const gst = currentProduct.gst || 0;
    const subtotal = qty * rate - discount;
    return subtotal + (subtotal * gst) / 100;
  };

  const handleAddOrUpdateProduct = () => {
    if (!currentProduct.productserviceid || !currentProduct.variantid) {
      alert("Please select a product/service.");
      return;
    }
    if (!currentProduct.quantity || !currentProduct.rate) {
      alert("Please enter quantity and rate.");
      return;
    }

    const total = calculateLineTotal();
    const productLine: InvoiceProduct = {
      productserviceid: currentProduct.productserviceid,
      variantid: currentProduct.variantid,
      salesunitid: type === "sales" ? currentProduct.salesunitid || null : null,
      purchaseunitid: type === "purchase" ? currentProduct.purchaseunitid || null : null,
      productname: selectedProduct?.name || "",
      quantity: currentProduct.quantity!,
      rate: currentProduct.rate!,
      discount: currentProduct.discount ?? 0,
      gst: currentProduct.gst ?? 0,
      total,
      salesaccountid:
        currentProduct.salesaccountid ?? selectedProduct?.salesaccountid ?? null,
      purchaseaccountid:
        currentProduct.purchaseaccountid ?? selectedProduct?.purchaseaccountid ?? null,
      serviceaccountid:
        currentProduct.serviceaccountid ?? selectedProduct?.serviceaccountid ?? null,
    };

    console.log("Adding/Updating Product:", productLine);

    const isDuplicate = products.some(
      (p, i) =>
        p.productserviceid === productLine.productserviceid &&
        p.variantid === productLine.variantid &&
        i !== editIndex
    );

    if (editIndex !== null) {
      setProducts((prev) => prev.map((p, i) => (i === editIndex ? productLine : p)));
      setEditIndex(null);
    } else {
      if (isDuplicate) {
        alert("Product already added.");
        return;
      }
      setProducts((prev) => [...prev, productLine]);
    }

    setCurrentProduct({});
  };

  const removeProduct = (index: number) => {
    setProducts((prev) => prev.filter((_, i) => i !== index));
    if (editIndex === index) {
      setEditIndex(null);
      setCurrentProduct({});
    }
  };

  const editProduct = (index: number) => {
    setCurrentProduct({ ...products[index] });
    setEditIndex(index);
  };

  const unitFieldName =
    type === "sales" ? "salesunitid" : type === "purchase" ? "purchaseunitid" : undefined;
  const unitOptions =
    type === "sales"
      ? selectedProduct?.salesUnits ?? []
      : type === "purchase"
      ? selectedProduct?.purchaseUnits ?? []
      : [];
  const unitValue =
    type === "sales"
      ? currentProduct.salesunitid ?? ""
      : type === "purchase"
      ? currentProduct.purchaseunitid ?? ""
      : "";

  return (
    <fieldset className="border rounded-xl p-4 space-y-4 mt-6">
      <legend className="text-sm font-medium px-2">
        {type === "service" ? "Add Services" : "Add Products"}
      </legend>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField
          label={type === "service" ? "Service" : "Product"}
          name="productserviceid"
          type="select"
          value={
            currentProduct.productserviceid && currentProduct.variantid
              ? `${currentProduct.productserviceid}--${currentProduct.variantid}`
              : ""
          }
          onChange={handleChange}
          options={productsList.map((p) => ({
            value: `${p.productserviceid}--${p.variantid}`,
            label: p.name,
          }))}
          searchable
        />

        {unitFieldName && (
          <FormField
            label="Unit"
            name={unitFieldName}
            type="select"
            value={unitValue}
            onChange={handleChange}
            options={unitOptions}
            searchable
          />
        )}

        <FormField
          label="Quantity"
          name="quantity"
          type="number"
          value={currentProduct.quantity ?? ""}
          onChange={handleChange}
        />

        <FormField
          label="Rate"
          name="rate"
          type="number"
          value={currentProduct.rate ?? ""}
          onChange={handleChange}
          disabled={type !== "service"}
        />

        <FormField
          label="Discount"
          name="discount"
          type="number"
          value={currentProduct.discount ?? ""}
          onChange={handleChange}
        />

        <FormField
          label="GST %"
          name="gst"
          type="number"
          value={currentProduct.gst ?? ""}
          onChange={handleChange}
        />

        <div className="flex items-end">
          <div className="text-sm font-semibold">
            Total (incl. GST): ₹{calculateLineTotal().toFixed(2)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={handleAddOrUpdateProduct} variant="outline" type="button">
          {editIndex !== null ? "Update" : "Add"}
        </Button>
        {editIndex !== null && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setEditIndex(null);
              setCurrentProduct({});
            }}
          >
            Cancel Edit
          </Button>
        )}
      </div>

      <fieldset className="border rounded-xl p-4 mt-4">
        <legend className="text-sm font-medium px-2">
          {type === "service" ? "Services List" : "Products List"}
        </legend>

        {products.length === 0 ? (
          <div className="text-center text-gray-500">
            No {type === "service" ? "services" : "products"} added.
          </div>
        ) : (
          <table className="w-full text-left border-collapse border border-gray-300 mt-2">
            <thead>
              <tr>
                <th className="border border-gray-300 p-2">
                  {type === "service" ? "Service" : "Product"}
                </th>
                <th className="border border-gray-300 p-2">Unit</th>
                <th className="border border-gray-300 p-2">Qty</th>
                <th className="border border-gray-300 p-2">Rate</th>
                <th className="border border-gray-300 p-2">Discount</th>
                <th className="border border-gray-300 p-2">GST %</th>
                <th className="border border-gray-300 p-2">Total</th>
                <th className="border border-gray-300 p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, index) => {
                const productObj = productsList.find(
                  (prod) =>
                    prod.productserviceid === p.productserviceid &&
                    prod.variantid === p.variantid
                );

                let unitLabel: string | undefined = undefined;
                if (type === "sales") {
                  unitLabel = productObj?.salesUnits?.find((u) => u.value === p.salesunitid)?.label ?? p.salesunitid ?? "";
                } else if (type === "purchase") {
                  unitLabel = productObj?.purchaseUnits?.find((u) => u.value === p.purchaseunitid)?.label ?? p.purchaseunitid ?? "";
                }

                return (
                  <tr key={index} className="hover:bg-gray-100">
                    <td className="border border-gray-300 p-2">{p.productname}</td>
                    <td className="border border-gray-300 p-2">{unitLabel}</td>
                    <td className="border border-gray-300 p-2">{p.quantity}</td>
                    <td className="border border-gray-300 p-2">{p.rate.toFixed(2)}</td>
                    <td className="border border-gray-300 p-2">{(p.discount ?? 0).toFixed(2)}</td>
                    <td className="border border-gray-300 p-2">{(p.gst ?? 0).toFixed(2)}</td>
                    <td className="border border-gray-300 p-2">{p.total.toFixed(2)}</td>
                    <td className="border border-gray-300 p-2 space-x-2">
                      <button
                        className="text-blue-500 hover:text-blue-700"
                        onClick={() => editProduct(index)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="text-red-500 hover:text-red-700"
                        onClick={() => removeProduct(index)}
                        type="button"
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
