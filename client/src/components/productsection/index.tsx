import React, { useState, useEffect } from "react";
import FormField from "../formfiled";
import Button from "../button";

export type InvoiceProduct = {
  productid: string;
  productname: string;
  quantity: number;
  rate: number;
  discount?: number;
  gst?: number;
  total: number;
};

type ProductOption = {
  id: string;
  name: string;
  currentstock: number;
  barcode?: string;
  purchaserate?: number;
  salesrate?: number;
};

type ProductSectionProps = {
  products: InvoiceProduct[];
  setProducts: React.Dispatch<React.SetStateAction<InvoiceProduct[]>>;
  productsList: ProductOption[];
  onProductsChange: (products: InvoiceProduct[]) => void;
  type: "purchase" | "sales";
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
    (p) => p.id === currentProduct.productid
  );

  useEffect(() => {
    onProductsChange(products);
  }, [products, onProductsChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === "productid") {
      const selected = productsList.find((p) => p.id === value);
      if (type === "sales" && selected?.currentstock === 0) {
        alert("⚠️ This product is out of stock and cannot be selected.");
        return;
      }
    }

    setCurrentProduct((prev) => ({
      ...prev,
      [name]: ["quantity", "rate", "discount", "gst"].includes(name)
        ? value === "" ? undefined : parseFloat(value)
        : value,
    }));
  };

  useEffect(() => {
    if (selectedProduct) {
      const updatedRate =
        type === "sales"
          ? selectedProduct.salesrate ?? 0
          : selectedProduct.purchaserate ?? 0;

      setCurrentProduct((prev) => ({
        ...prev,
        rate: updatedRate,
      }));
    }
  }, [type, selectedProduct]);

  useEffect(() => {
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
              productid: matchedProduct.id,
            }));
          }
        }
        buffer = "";
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
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
  }, [productsList]);

  const calculateLineTotal = () => {
    const qty = currentProduct.quantity || 0;
    const rate = currentProduct.rate || 0;
    const discount = currentProduct.discount || 0;
    const gst = currentProduct.gst || 0;

    const subtotal = qty * rate - discount;
    const taxAmount = (subtotal * gst) / 100;
    return subtotal + taxAmount;
  };

  const handleAddOrUpdateProduct = () => {
    if (!currentProduct.productid) {
      alert("Please select a product");
      return;
    }
    if (!currentProduct.quantity || !currentProduct.rate) {
      alert("Please enter quantity and rate");
      return;
    }

    const productName =
      productsList.find((p) => p.id === currentProduct.productid)?.name || "";
    const total = calculateLineTotal();

    const updatedProduct: InvoiceProduct = {
      productid: currentProduct.productid!,
      productname: productName,
      quantity: currentProduct.quantity!,
      rate: currentProduct.rate!,
      discount: currentProduct.discount || 0,
      gst: currentProduct.gst || 0,
      total,
    };

    if (editIndex !== null) {
      setProducts((prev) =>
        prev.map((p, i) => (i === editIndex ? updatedProduct : p))
      );
      setEditIndex(null);
    } else {
      const isDuplicate = products.some((p) => p.productid === currentProduct.productid);
      if (isDuplicate) {
        alert("Product already added.");
        return;
      }
      setProducts((prev) => [...prev, updatedProduct]);
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
    const productToEdit = products[index];
    setCurrentProduct({ ...productToEdit });
    setEditIndex(index);
  };

  return (
    <fieldset className="border rounded-xl p-4 space-y-4 mt-6">
      <legend className="text-sm font-medium px-2">Add Products</legend>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField
          key={currentProduct.productid || "product"}
          label="Product"
          name="productid"
          type="select"
          value={currentProduct.productid || ""}
          onChange={handleChange}
          options={productsList.map((p) => ({ value: p.id, label: p.name }))}
          searchable
        />

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
          disabled
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
          {editIndex !== null ? "Update Product" : "Add Product"}
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
        <legend className="text-sm font-medium px-2">Products List</legend>

        {products.length === 0 ? (
          <div className="text-center text-gray-500">No products added.</div>
        ) : (
          <table className="w-full text-left border-collapse border border-gray-300 mt-2">
            <thead>
              <tr>
                <th className="border border-gray-300 p-2">Product</th>
                <th className="border border-gray-300 p-2">Qty</th>
                <th className="border border-gray-300 p-2">Rate</th>
                <th className="border border-gray-300 p-2">Discount</th>
                <th className="border border-gray-300 p-2">GST %</th>
                <th className="border border-gray-300 p-2">Total</th>
                <th className="border border-gray-300 p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, index) => (
                <tr key={index} className="hover:bg-gray-100">
                  <td className="border border-gray-300 p-2">{p.productname}</td>
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
              ))}
            </tbody>
          </table>
        )}
      </fieldset>
    </fieldset>
  );
};

export default ProductSection;
