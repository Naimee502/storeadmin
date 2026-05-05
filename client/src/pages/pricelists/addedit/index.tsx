import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import HomeLayout from "../../../layouts/home";
import FormField from "../../../components/formfiled";
import Button from "../../../components/button";
import { useProductServicesQuery } from "../../../graphql/hooks/products";
import { useUnitsQuery } from "../../../graphql/hooks/units";
import { usePriceListByIdQuery, usePriceListMutations } from "../../../graphql/hooks/pricelists";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";

const AddEditPriceList = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { type, admin, branch } = useAppSelector((state) => state.auth);
  const branchId = useAppSelector((state) => state.selectedBranch.branchId);
  const adminId = type === "admin" ? admin?.id : branch?.admin?.id;

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
    if (products.length > 0) {
      // 1. Generate master list of all available unit prices
      const masterItems = products.flatMap((p: any) =>
        (p.productvariants || []).flatMap((v: any) =>
          (v.unitprices || []).map((up: any) => ({
            productid: p.id,
            productname: p.name,
            variantid: v.id,
            variantname: v.name,
            unitid: up.unitid?.id || up.unitid,
            unitname: up.unitid?.unitname || up.unitname || "Unit",
            quantity: up.quantity,
            rate: up.salesrate,
            discount: 0,
            discounttype: "fixed",
          }))
        )
      );

      if (isEdit && priceListData?.getPriceListById) {
        const pl = priceListData.getPriceListById;
        const existingItems = pl.items || [];

        // Merge master list with saved values
        const mergedItems = masterItems.map(m => {
          const found = existingItems.find((e: any) =>
            (e.productid?.id || e.productid) === m.productid &&
            e.variantid === m.variantid &&
            (e.unitid?.id || e.unitid) === m.unitid &&
            e.quantity === m.quantity
          );
          if (found) {
            return {
              ...m,
              rate: found.rate,
              discount: found.discount,
              discounttype: found.discounttype,
            };
          }
          return m;
        });

        setFormData({
          name: pl.name,
          description: pl.description || "",
          items: mergedItems,
        });
      } else if (!isEdit && formData.items.length === 0) {
        setFormData(prev => ({
          ...prev,
          items: masterItems,
        }));
      }
    }
  }, [products, priceListData, isEdit]);

  const calculateOfferRate = (rate: number, discount: number, type: string) => {
    const r = parseFloat(rate.toString()) || 0;
    const d = parseFloat(discount.toString()) || 0;
    if (type === "percentage") {
      return r - (r * d) / 100;
    }
    return r - d;
  };



  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
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
      adminid: adminId,
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
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-left text-sm">
                    <th className="p-2 border">Product & Variant</th>
                    <th className="p-2 border w-24">Qty</th>
                    <th className="p-2 border">Unit</th>
                    <th className="p-2 border w-32">Rate</th>
                    <th className="p-2 border w-40">Discount</th>
                    <th className="p-2 border w-32">Offer Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.map((item, index) => (
                    <tr key={index} className="text-sm hover:bg-gray-50">
                      <td className="p-2 border bg-gray-50 font-medium">
                        {item.productname} - {item.variantname}
                      </td>
                      <td className="p-2 border text-center bg-gray-50">
                        {item.quantity}
                      </td>
                      <td className="p-2 border bg-gray-50">
                        {item.unitname}
                      </td>
                      <td className="p-2 border">
                        <input
                          type="number"
                          className="w-full p-1 border rounded focus:ring-1 focus:ring-blue-500 outline-none"
                          value={item.rate}
                          onChange={(e) => handleItemChange(index, "rate", e.target.value)}
                        />
                      </td>
                      <td className="p-2 border">
                        <div className="flex gap-1">
                          <input
                            type="number"
                            className="w-2/3 p-1 border rounded focus:ring-1 focus:ring-blue-500 outline-none"
                            value={item.discount}
                            onChange={(e) => handleItemChange(index, "discount", e.target.value)}
                          />
                          <select
                            className="w-1/3 p-1 border rounded text-xs outline-none"
                            value={item.discounttype}
                            onChange={(e) => handleItemChange(index, "discounttype", e.target.value)}
                          >
                            <option value="fixed">₹</option>
                            <option value="percentage">%</option>
                          </select>
                        </div>
                      </td>
                      <td className="p-2 border font-bold text-blue-700 bg-blue-50/30">
                        ₹{calculateOfferRate(item.rate, item.discount, item.discounttype).toFixed(2)}
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
            <Button type="submit" variant="outline">Save Price List</Button>
          </div>
        </form>
      </div>
    </HomeLayout>
  );
};

export default AddEditPriceList;
