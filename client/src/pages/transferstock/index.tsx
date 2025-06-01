import React, { useEffect, useState } from "react";
import { useBranchesQuery } from "../../graphql/hooks/branches";
import { useProductsQuery } from "../../graphql/hooks/products";
import { useTransferStockMutations, useTransferStocksQuery } from "../../graphql/hooks/transferstock";
import HomeLayout from "../../layouts/home";
import FormField from "../../components/formfiled";
import Button from "../../components/button";
import FormSwitch from "../../components/formswitch";
import { FaCubes, FaExchangeAlt, FaCalendarAlt } from "react-icons/fa";
import { showMessage } from "../../redux/slices/message";
import { useAppDispatch } from "../../redux/hooks";
import DataTable from "../../components/datatable";
import { useNavigate } from "react-router";
import { hideLoading, showLoading } from "../../redux/slices/loader";

type FormValues = {
  tobranchid: string;
  productid: string;
  transferqty: number | undefined;
  transferdate: string;
  status: boolean;
};

type TransferStockRow = {
  id: string;
  tobranchid: string;
  tobranchname: string;
  productid: string;
  productname: string;
  transferqty: number | undefined;
  transferdate: string;
  status: boolean;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

const TransferStock = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const fromBranchId = localStorage.getItem("branchid") || "";

  const { data: branchesData } = useBranchesQuery();
  const { data: productsData } = useProductsQuery();
  const { data: transfersData, refetch } = useTransferStocksQuery();
  const {
    addTransferStockMutation,
    editTransferStockMutation,
    deleteTransferStockMutation,
  } = useTransferStockMutations();

  const branches = branchesData?.getBranches || [];
  const products = productsData?.getProducts || [];
  const transferStocks: TransferStockRow[] = transfersData?.getTransferStocks || [];

  const toBranchOptions = branches.filter((branch: any) => branch.id !== fromBranchId);

  const [formValues, setFormValues] = useState<FormValues>({
    tobranchid: "",
    productid: "",
    transferqty: undefined,
    transferdate: "",
    status: true,
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

   useEffect(() => {
    if (transfersData?.getTransferStocks) {
      refetch();
    }
  }, [transferStocks, refetch]);

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
    if (!formValues.transferqty || formValues.transferqty <= 0)
      errors.transferqty = "Transfer quantity must be greater than 0";
    if (!formValues.transferdate) errors.transferdate = "Transfer date is required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    dispatch(showLoading());
    const payload = {
      frombranchid: fromBranchId,
      ...formValues,
    };

    try {
      if (isEditing && editingId) {
        await editTransferStockMutation({ variables: { id: editingId, input: payload } });
        dispatch(showMessage({ message: "Stock updated successfully!", type: "success" }));
      } else {
        await addTransferStockMutation({ variables: { input: payload } });
        dispatch(showMessage({ message: "Stock transferred successfully!", type: "success" }));
      }
      await refetch();
      resetForm();
    } catch (err) {
      dispatch(showMessage({ message: "Operation failed!", type: "error" }));
    } finally {
      dispatch(hideLoading());
    }
  };

  const handleEdit = (row: TransferStockRow) => {
    setFormValues({
      tobranchid: row.tobranchid,
      productid: row.productid,
      transferqty: row.transferqty,
      transferdate: row.transferdate,
      status: row.status,
    });
    setIsEditing(true);
    setEditingId(row.id);
  };

  const handleDelete = async (row: TransferStockRow) => {

  };

  const resetForm = () => {
    setFormValues({
      tobranchid: "",
      productid: "",
      transferqty: undefined,
      transferdate: "",
      status: true,
    });
    setFormErrors({});
    setIsEditing(false);
    setEditingId(null);
  };

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "From Branch", key: "frombranchid" }, // or "frombranchname" if you have that
    { label: "To Branch", key: "tobranchid" },
    { label: "Product", key: "productid" },
    { label: "Qty", key: "transferqty" },
    { label: "Date", key: "transferdate" },
    {
      label: "Status",
      key: "status",
      render: (value: boolean) => (value ? "Active" : "Inactive"),
    },
  ];

  const tableData = transferStocks.map((stock, index) => {
    const fromBranch = branches.find((b) => b.id === fromBranchId);
    const toBranch = branches.find((b) => b.id === stock.tobranchid);
    const product = products.find((p) => p.id === stock.productid);

    return {
      ...stock,
      seqNo: index + 1,
      frombranchid: fromBranch?.branchname,
      tobranchid: toBranch?.branchname || stock.tobranchid,
      productid: product?.name || stock.productid,
      status: stock.status ? "Active" : "Inactive",
    };
  });

  if (!fromBranchId) {
    return (
      <HomeLayout>
        <div className="p-6 text-red-600 font-semibold">
          Branch ID is missing in localStorage. Please log in again.
        </div>
      </HomeLayout>
    );
  }

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <div className="w-full px-4 py-6">
          <h2 className="text-xl font-semibold mb-4">Transfer Stock</h2>
          <form onSubmit={handleFormSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <FormField
                label="To Branch"
                name="tobranchid"
                type="select"
                value={formValues.tobranchid}
                onChange={(e) => handleFormChange("tobranchid", e.target.value)}
                error={formErrors.tobranchid}
                options={toBranchOptions.map((branch: any) => ({
                  label: `${branch.branchname} - ${branch.branchcode}`,
                  value: branch.id,
                }))}
                icon={<FaExchangeAlt />}
              />

              <FormField
                label="Product"
                name="productid"
                type="select"
                value={formValues.productid}
                onChange={(e) => {
                  const selectedProductId = e.target.value;
                  const selectedProduct = products.find((p: any) => p.id === selectedProductId);

                  if (selectedProduct?.currentstock === 0) {
                    return; // Prevent selection
                  }

                  handleFormChange("productid", selectedProductId);
                }}
                error={formErrors.productid}
                options={products.map((product: any) => ({
                  label: `${product.name} - ${product.currentstock}${product.currentstock === 0 ? ' (Out of Stock)' : ''}`,
                  value: product.id,
                  disabled: product.currentstock === 0, // Prevent selection if stock is 0
                }))}
                icon={<FaCubes />}
              />

              <FormField
                label="Transfer Quantity"
                name="transferqty"
                type="number"
                value={formValues.transferqty}
                onChange={(e) => handleFormChange("transferqty", parseInt(e.target.value))}
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
          title="Manage Transfer Stocks"
          columns={columns}
          data={tableData}
          showView={false}
          showEdit={true}
          showDelete={true}
          showImport={false}
          showExport={false}
          showAdd={false}
          onEdit={handleEdit}
          onDelete={async (row) => {
            if (window.confirm(`Are you sure you want to deleted transfer stock "${row.productid}"?`)) {
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
