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

  useEffect(() => {
    onProductsChange(products);
  }, [products, onProductsChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === "productid") {
      const selectedProduct = productsList.find((p) => p.id === value);
      if (type === "sales" && selectedProduct?.currentstock === 0) {
        alert("This product is out of stock and cannot be selected.");
        return; // Prevent selecting out of stock product for sales
      }
    }

    setCurrentProduct((prev) => ({
      ...prev,
      [name]: ["quantity", "rate", "discount", "gst"].includes(name)
        ? value === "" ? undefined : parseFloat(value)
        : value,
    }));
  };

  const calculateLineTotal = () => {
    const qty = currentProduct.quantity || 0;
    const rate = currentProduct.rate || 0;
    const discount = currentProduct.discount || 0;
    const gst = currentProduct.gst || 0;

    const subtotal = qty * rate - discount;
    const taxAmount = (subtotal * gst) / 100;

    return subtotal + taxAmount;
  };

  const addProduct = () => {
    const isDuplicate = products.some(p => p.productid === currentProduct.productid);
    if (isDuplicate) {
      alert("Product already added.");
      return;
    }
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

    const newProduct: InvoiceProduct = {
      productid: currentProduct.productid!,
      productname: productName,
      quantity: currentProduct.quantity!,
      rate: currentProduct.rate!,
      discount: currentProduct.discount || 0,
      gst: currentProduct.gst || 0,
      total,
    };

    setProducts((prev) => [...prev, newProduct]);
    setCurrentProduct({});
  };

  const removeProduct = (index: number) => {
    setProducts((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <fieldset className="border rounded-xl p-4 space-y-4 mt-6">
      <legend className="text-sm font-medium px-2">Add Products</legend>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField
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

      <Button onClick={addProduct} variant="outline" type="button">
        Add Product
      </Button>

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
                  <td className="border border-gray-300 p-2">
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
