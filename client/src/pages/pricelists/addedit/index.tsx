import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import HomeLayout from "../../../layouts/home";
import FormField from "../../../components/formfiled";
import Button from "../../../components/button";
import { useProductServicesQuery } from "../../../graphql/hooks/products";
import { useUnitsQuery } from "../../../graphql/hooks/units";
import { usePriceListByIdQuery, usePriceListMutations } from "../../../graphql/hooks/pricelists";
import { useAppDispatch } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";

const AddEditPriceList = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    items: [] as any[],
  });

  const { data: priceListData, refetch: refetchPriceList } = usePriceListByIdQuery(id || "");
  const { data: productData } = useProductServicesQuery();
  const { data: unitData } = useUnitsQuery();
  const { createPriceList, updatePriceList } = usePriceListMutations();

  const products = productData?.getProductServices || [];
  const units = unitData?.getUnits || [];

  useEffect(() => {
    if (isEdit && priceListData?.getPriceListById) {
      const pl = priceListData.getPriceListById;
      setFormData({
        name: pl.name,
        description: pl.description || "",
        items: pl.items.map((i: any) => ({
          productid: i.productid?.id,
          variantid: i.variantid,
          unitid: i.unitid?.id,
          quantity: i.quantity,
          rate: i.rate,
          discount: i.discount,
          discounttype: i.discounttype,
        })),
      });
    }
  }, [isEdit, priceListData]);

  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          productid: "",
          variantid: "",
          unitid: "",
          quantity: 1,
          rate: 0,
          discount: 0,
          discounttype: "fixed",
        },
      ],
    }));
  };

  const handleRemoveItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    
    if (field === "productvariant") {
      const [pid, vid] = value.split("--");
      newItems[index].productid = pid;
      newItems[index].variantid = vid;
      
      // Auto-fill default rate if possible
      const product = products.find((p: any) => p.id === pid);
      const variant = product?.productvariants.find((v: any) => v.id === vid);
      if (variant?.pricing?.[0]?.unitprices?.[0]) {
        const up = variant.pricing[0].unitprices[0];
        newItems[index].unitid = up.unitid?.id || up.unitid;
        newItems[index].rate = up.salesrate;
      }
    } else {
      newItems[index][field] = value;
    }
    
    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return alert("Name is required");

    const input = {
      name: formData.name,
      description: formData.description,
      items: formData.items.map((i) => ({
        productid: i.productid,
        variantid: i.variantid,
        unitid: i.unitid,
        quantity: parseFloat(i.quantity),
        rate: parseFloat(i.rate),
        discount: parseFloat(i.discount),
        discounttype: i.discounttype,
      })),
      status: true,
    };

    try {
      if (isEdit) {
        await updatePriceList({ variables: { id, input } });
        dispatch(showMessage({ message: "Price list updated successfully", type: "success" }));
      } else {
        await createPriceList({ variables: { input } });
        dispatch(showMessage({ message: "Price list created successfully", type: "success" }));
      }
      navigate("/pricelists");
    } catch (error) {
      console.error(error);
      dispatch(showMessage({ message: "Error saving price list", type: "error" }));
    }
  };

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <h2 className="text-2xl font-bold mb-6">{isEdit ? "Edit Price List" : "Create Price List"}</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Price List Name"
              name="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <FormField
              label="Description"
              name="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="border rounded-xl p-4 bg-white shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Products & Rates</h3>
              <Button type="button" variant="outline" onClick={handleAddItem}>
                + Add Product
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-left text-sm">
                    <th className="p-2 border">Product & Variant</th>
                    <th className="p-2 border">Unit</th>
                    <th className="p-2 border w-24">Qty</th>
                    <th className="p-2 border w-32">Rate</th>
                    <th className="p-2 border w-32">Discount</th>
                    <th className="p-2 border">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.map((item, index) => (
                    <tr key={index} className="text-sm">
                      <td className="p-2 border">
                        <select
                          className="w-full p-1 border rounded"
                          value={`${item.productid}--${item.variantid}`}
                          onChange={(e) => handleItemChange(index, "productvariant", e.target.value)}
                        >
                          <option value="">Select Product</option>
                          {products.flatMap((p: any) =>
                            p.productvariants.map((v: any) => (
                              <option key={`${p.id}--${v.id}`} value={`${p.id}--${v.id}`}>
                                {p.name} - {v.name}
                              </option>
                            ))
                          )}
                        </select>
                      </td>
                      <td className="p-2 border">
                        <select
                          className="w-full p-1 border rounded"
                          value={item.unitid}
                          onChange={(e) => handleItemChange(index, "unitid", e.target.value)}
                        >
                          <option value="">Select Unit</option>
                          {units.map((u: any) => (
                            <option key={u.id} value={u.id}>
                              {u.unitname}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 border">
                        <input
                          type="number"
                          className="w-full p-1 border rounded"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                        />
                      </td>
                      <td className="p-2 border">
                        <input
                          type="number"
                          className="w-full p-1 border rounded"
                          value={item.rate}
                          onChange={(e) => handleItemChange(index, "rate", e.target.value)}
                        />
                      </td>
                      <td className="p-2 border">
                        <div className="flex gap-1">
                          <input
                            type="number"
                            className="w-2/3 p-1 border rounded"
                            value={item.discount}
                            onChange={(e) => handleItemChange(index, "discount", e.target.value)}
                          />
                          <select
                            className="w-1/3 p-1 border rounded text-xs"
                            value={item.discounttype}
                            onChange={(e) => handleItemChange(index, "discounttype", e.target.value)}
                          >
                            <option value="fixed">₹</option>
                            <option value="percentage">%</option>
                          </select>
                        </div>
                      </td>
                      <td className="p-2 border text-center">
                        <button
                          type="button"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleRemoveItem(index)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {formData.items.length === 0 && (
              <p className="text-center text-gray-500 py-4">No products added to this list yet.</p>
            )}
          </div>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate("/pricelists")}>
              Cancel
            </Button>
            <Button type="submit">Save Price List</Button>
          </div>
        </form>
      </div>
    </HomeLayout>
  );
};

export default AddEditPriceList;
