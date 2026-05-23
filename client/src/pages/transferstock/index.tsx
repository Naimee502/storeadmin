import React, { useEffect, useState } from "react";
import { useBranchesQuery } from "../../graphql/hooks/branches";
import { useProductServicesQuery } from "../../graphql/hooks/products";
import { useTransferStockMutations, useTransferStocksQuery } from "../../graphql/hooks/transferstock";
import HomeLayout from "../../layouts/home";
import FormField from "../../components/formfiled";
import Button from "../../components/button";
import FormSwitch from "../../components/formswitch";
import { FaExchangeAlt, FaCalendarAlt } from "react-icons/fa";
import { showMessage } from "../../redux/slices/message";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import DataTable from "../../components/datatable";
import { useNavigate } from "react-router";
import { hideLoading, showLoading } from "../../redux/slices/loader";
import { getBaseQuantity } from "../../utils/helper";

type FormValues = {
  tobranchid: string;
  productid: string;
  variantid: string;
  transferunitid: string;
  transferqty: number | undefined;
  transferdate: string;
  status: boolean;
};

type TransferStockRow = {
  id: string;
  frombranchid: string;
  tobranchid: string;
  tobranchname: string;
  productid: string;
  variantid: string;
  productname: string;
  transferunitid: string;
  transferqty: number | undefined;
  transferdate: string;
  status: boolean;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

const TransferStock = () => {
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "transferstock"));
  const dispatch = useAppDispatch();
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);
  const storedBranchId = localStorage.getItem("branchid") || "";
  const storedAdminId = localStorage.getItem("adminid") || "";

  const adminId = type === 'admin' ? admin?.id
    : type === 'branch' ? (branch?.admin?.id || admin?.id || storedAdminId)
    : type === 'staff' ? (staff?.admin?.id || admin?.id || storedAdminId)
    : (admin?.id || storedAdminId);
  const { data: branchesData } = useBranchesQuery();
  const firstBranchId = branchesData?.getBranches?.[0]?.id || "";

  const branchId = type === 'admin' ? (selectedBranchId || firstBranchId)
    : type === 'branch' ? (branch?.id || selectedBranchId || storedBranchId || firstBranchId)
    : type === 'staff' ? (staff?.branchid?.id || selectedBranchId || storedBranchId || firstBranchId)
    : (selectedBranchId || storedBranchId || firstBranchId);
  const frombranchid = branchId ? branchId : undefined;
  const { data: transfersData, refetch } = useTransferStocksQuery();
  console.log("TransferStocksData:", JSON.stringify(transfersData));
  const { data: productData, refetch: productRefetch } = useProductServicesQuery();
  console.log("ProductServicesData:", JSON.stringify(productData));
  const transferProductData = productData?.getProductServices ?? [];
  const [selectedVariantStock, setSelectedVariantStock] = useState<number>(0);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);

  const {
    addTransferStockMutation,
    editTransferStockMutation,
    deleteTransferStockMutation,
  } = useTransferStockMutations();

  const branches = branchesData?.getBranches || [];
  const products = transferProductData || [];
  const transferStocks: TransferStockRow[] = transfersData?.getTransferStocks || [];

  const [formValues, setFormValues] = useState<FormValues>({
    tobranchid: "",
    productid: "",
    variantid: "",
    transferunitid: "",
    transferqty: undefined,
    transferdate: new Date().toISOString().slice(0, 10),
    status: true,
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [transferUnitOptions, setTransferUnitOptions] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const handleFormChange = (name: keyof FormValues, value: string | number | boolean) => {
    setFormValues((prev) => ({
      ...prev,
      [name]: value as never,
    }));
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    if (!formValues.tobranchid) errors.tobranchid = "To Branch is required";
    if (!formValues.productid) errors.productid = "Product is required";
    if (!formValues.transferqty || formValues.transferqty <= 0) {
      errors.transferqty = "Transfer quantity must be greater than 0";
    } else {
      const baseQty = getBaseQuantity(
        Number(formValues.transferqty),
        formValues.transferunitid,
        selectedVariant
      );

      if (baseQty > selectedVariantStock) {
        errors.transferqty = `Transfer quantity cannot exceed available stock (${selectedVariantStock} in base units)`;
      }
    }
    if (!formValues.transferdate) errors.transferdate = "Transfer date is required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    dispatch(showLoading());

    const creatorName =
      type === "admin" ? admin?.name :
      type === "branch" ? branch?.branchname || branch?.name :
      type === "staff" ? staff?.name : undefined;

    const payload = {
      frombranchid,
      tobranchid: formValues.tobranchid,
      productid: formValues.productid,
      variantid: formValues.variantid,
      transferunitid: formValues.transferunitid,
      transferqty: formValues.transferqty,
      transferdate: formValues.transferdate,
      status: formValues.status,
      admin: adminId,
      createdby_id: admin?.id || branch?.id || staff?.id,
      createdby_name: creatorName,
      createdby_type: type || 'admin',
    };

    console.log("Submitting transfer stock:", JSON.stringify(payload)); 

    try {
      if (isEditing && editingId) {
        await editTransferStockMutation({
          variables: { id: editingId, input: payload },
        });
        dispatch(showMessage({ message: "Stock updated successfully!", type: "success" }));
      } else {
        await addTransferStockMutation({
          variables: { input: payload },
        });
        dispatch(showMessage({ message: "Stock transferred successfully!", type: "success" }));
      }

      if (refetch) {
        await refetch();
      }

      resetForm(); // Reset only after successful operation
    } catch (error: any) {
      console.error("Error during transfer stock operation:", error);
      dispatch(showMessage({ message: "Operation failed!", type: "error" }));
    } finally {
      dispatch(hideLoading());
    }
  };

  const handleEdit = (row: TransferStockRow) => {
    // Find product and variant
    const product = products.find((p) => p.id === row.productid);
    const variant = product?.productvariants?.find((v) => v.id === row.variantid);

    if (!variant) return;

    const options = (variant.unitconversions || []).map((uc) => {
      const unitId = typeof uc.unitid === "object" ? uc.unitid.id : uc.unitid;
      const unitName = typeof uc.unitid === "object" ? uc.unitid.unitname : "Unit";
      return {
        label: `${unitName} → Factor: ${uc.factor}`,
        value: unitId,
      };
    });

    // Fallback to base unit if no conversions found
    if (options.length === 0 && variant.baseunitid) {
      const baseUnitId = typeof variant.baseunitid === "object" ? variant.baseunitid.id : variant.baseunitid;
      const baseUnitName = typeof variant.baseunitid === "object" ? variant.baseunitid.unitname : "Base Unit";

      options.push({
        label: baseUnitName,
        value: baseUnitId,
      });
    }

    setTransferUnitOptions(options);

    // Populate form values
    setFormValues({
      tobranchid: row.tobranchid,
      productid: row.productid,
      variantid: row.variantid || "",
      transferunitid: row.transferunitid || options[0]?.value || "",
      transferqty: row.transferqty,
      transferdate: row.transferdate,
      status: typeof row.status === "string" ? row.status === "Active" : !!row.status,
    });

    setIsEditing(true);
    setEditingId(row.id);

    console.log("Editing Variant:", variant);
    console.log("Transfer Unit Options:", options);
  };

  const resetForm = () => {
    setFormValues({
      tobranchid: "",
      productid: "",
      variantid: "",
      transferunitid: "",
      transferqty: undefined,
      transferdate: new Date().toISOString().slice(0, 10),
      status: true,
    });
    setFormErrors({});
    setIsEditing(false);
    setEditingId(null);
  };

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "From Branch", key: "frombranchid" },
    { label: "To Branch", key: "tobranchname" },
    { label: "Product", key: "productname" },
    { label: "Qty", key: "transferqty" },
    { label: "Unit", key: "transferunitname" },
    { label: "Purchase Rate", key: "purchaserate" },
    { label: "Date", key: "transferdate" },
    { label: "Created By", key: "createdByDisplay" },
    {
      label: "Status",
      key: "status",
      render: (value: boolean) => (value ? "Active" : "Inactive"),
    },
  ];

  const tableData = transferStocks.map((stock, index) => {
    const fromBranch = branches.find((b) => b.id === stock.frombranchid);
    const toBranch = branches.find((b) => b.id === stock.tobranchid);
    const product = products.find((p) => p.id === stock.productid);

    // find variant
    const variant = product?.productvariants?.find(v => v.id === stock.variantid);

    // find unit name from variant.unitconversions OR baseunit
    let unitName = "";
    if (variant) {
      const uc = variant.unitconversions?.find(u => {
        const unitId = typeof u.unitid === "object" ? u.unitid.id : u.unitid;
        return unitId === stock.transferunitid;
      });

      if (uc) {
        unitName = typeof uc.unitid === "object" ? uc.unitid.unitname : "Unit";
      } else if (variant.baseunitid) {
        unitName = typeof variant.baseunitid === "object"
          ? variant.baseunitid.unitname
          : "Base Unit";
      }
    }

    return {
      ...stock,
      seqNo: index + 1,
      frombranchid: fromBranch?.branchname || stock.frombranchid,
      tobranchname: toBranch?.branchname || stock.tobranchid,
      productname: product?.name || stock.productid,
      purchaserate: product?.productvariants[0]?.purchaserate,
      transferunitname: unitName,   // ⇦ NEW FIELD
      createdByDisplay: stock.createdby_name || "N/A",
      status: stock.status ? "Active" : "Inactive",
    };
  });

  const toBranchOptions = branches
    .filter((b) => b.id !== frombranchid || b.id === formValues.tobranchid)
    .map((b) => ({ label: `${b.branchname} - ${b.branchcode}`, value: b.id }));

  const productOptions = products.flatMap((p) =>
    p.productvariants?.map((v) => ({
      label: `${p.name} - ${v.name} - ${v.currentstock}${v.currentstock === 0 ? " (Out of Stock)" : ""}`,
      value: `${p.id}|${v.id}`, // encode both product and variant IDs
      disabled: v.currentstock === 0,
    })) || []
  );

  const selectedProductOption = formValues.productid && formValues.variantid
  ? `${formValues.productid}|${formValues.variantid}`
  : "";

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <div className="w-full px-4 py-6">
          <h2 className="text-xl font-semibold mb-4">Transfer Stock</h2>
          <form onSubmit={handleFormSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <FormField
                label="To Branch"
                name="tobranchid"
                type="select"
                value={formValues.tobranchid}
                onChange={(e) => handleFormChange("tobranchid", e.target.value)}
                error={formErrors.tobranchid}
                options={toBranchOptions}
                icon={<FaExchangeAlt />}
              />

              <FormField
                label="Product"
                name="productid"
                type="select"
                value={selectedProductOption}
                onChange={(e) => {
                  const [prodId, varId] = e.target.value.split("|");

                  // Find selected product
                  const product = products.find((p) => p.id === prodId);
                  if (!product) return;

                  // Find selected variant
                  const variant = product.productvariants.find((v) => v.id === varId);
                  if (!variant) return;

                  console.log("Selected Product:", product);
                  console.log("Selected Variant:", variant.unitconversions);
                  setSelectedVariant(variant);    
                  setSelectedVariantStock(variant.currentstock || 0);

                  // Optional: prevent selecting out-of-stock variants
                  if (variant.currentstock === 0 && prodId !== formValues.productid) {
                    alert("⚠️ This product variant is out of stock and cannot be selected.");
                    return;
                  }

                  // Update form values
                  handleFormChange("productid", prodId);
                  handleFormChange("variantid", varId);

                  // Prepare Transfer Unit Options from unit conversions
                  const options = (variant.unitconversions || []).map((uc) => {
                    const unitId = typeof uc.unitid === "object" ? uc.unitid.id : uc.unitid;
                    const unitName = typeof uc.unitid === "object" ? uc.unitid.unitname : "Unit";
                    return {
                      label: `${unitName} → Factor: ${uc.factor}`,
                      value: unitId,
                    };
                  });

                  // Fallback to base unit if unitConversions is empty
                  if (options.length === 0 && variant.baseunitid) {
                    const baseUnitId = typeof variant.baseunitid === "object" ? variant.baseunitid.id : variant.baseunitid;
                    const baseUnitName = typeof variant.baseunitid === "object" ? variant.baseunitid.unitname : "Base Unit";

                    options.push({
                      label: baseUnitName,
                      value: baseUnitId,
                    });
                  }

                  setTransferUnitOptions(options);
                  handleFormChange("transferunitid", options[0]?.value || "");
                }}
                error={formErrors.productid}
                options={productOptions}
              />

              {transferUnitOptions.length > 0 && (
                <FormField
                  label="Transfer Unit"
                  name="transferunitid"
                  type="select"
                  value={formValues.transferunitid}
                  onChange={(e) => handleFormChange("transferunitid", e.target.value)}
                  options={transferUnitOptions}
                />
              )}

              <FormField
                label="Transfer Quantity"
                name="transferqty"
                type="number"
                value={formValues.transferqty}
                onChange={(e) => {
                const qty = parseFloat(e.target.value);

                const baseQty = getBaseQuantity(
                  qty,
                  formValues.transferunitid,
                  selectedVariant 
                );

                // ❗ Show error only (DO NOT BLOCK INPUT)
                if (baseQty > selectedVariantStock) {
                  setFormErrors((prev) => ({
                    ...prev,
                    transferqty: `Available stock is (${selectedVariantStock} in base units)`,
                  }));
                } else {
                  setFormErrors((prev) => {
                    const { transferqty, ...rest } = prev;
                    return rest;
                  });
                }

                handleFormChange("transferqty", qty);
              }}
                error={formErrors.transferqty}
                icon={<FaExchangeAlt />}
                placeholder="Enter quantity"
              />

              <FormField
                label="Transfer Date"
                name="transferdate"
                type="date"
                value={formValues.transferdate}
                onChange={(e) => handleFormChange("transferdate", e.target.value)}
                error={formErrors.transferdate}
                icon={<FaCalendarAlt />}
              />

              <FormSwitch
                label="Status"
                name="status"
                checked={formValues.status}
                onChange={(value) => handleFormChange("status", value)}
              />
            </div>

            <Button variant="outline" type="submit">
              {isEditing ? "Update Transfer Stock" : "Transfer Stock"}
            </Button>
          </form>
        </div>

        <DataTable
          {...actions}
          title="Manage Transfer Stocks"
          columns={columns}
          data={tableData}
          
          
          
          
          
          
          onEdit={handleEdit}
          onDelete={async (row) => {
            if (window.confirm(`Are you sure you want to delete transfer stock for product "${row.productname}"?`)) {
              try {
                await deleteTransferStockMutation({ variables: { id: row.id } });
                dispatch(showMessage({ message: "Transfer stock deleted", type: "success" }));
                await refetch();
              } catch (error) {
                dispatch(showMessage({ message: "Failed to delete transfer stock", type: "error" }));
              }
            }
          }}
          onShowDeleted={() => navigate("/transferstock/deletedentries")}
        />
      </div>
    </HomeLayout>
  );
};

export default TransferStock;
