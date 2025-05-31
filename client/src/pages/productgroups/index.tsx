import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { useProductGroupsQuery, useProductGroupMutations } from "../../graphql/hooks/productgroups";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import { addProductGroups } from "../../redux/slices/productgroups";

const ProductGroups = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data, refetch } = useProductGroupsQuery();
  const { addProductGroupMutation, editProductGroupMutation, deleteProductGroupMutation } = useProductGroupMutations();
  const productGroupList = data?.getProductGroups || [];
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  const [formValues, setFormValues] = useState({ productgroupname: "", status: true });
  const [formErrors, setFormErrors] = useState<{ productgroupname?: string }>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleFormChange = (name: string, value: string | boolean) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const errors: { productgroupname?: string } = {};
    if (!formValues.productgroupname.trim()) {
      errors.productgroupname = "Product group name is required";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEdit = (row: any) => {
    setFormValues({ productgroupname: row.productgroupname, status: row.status === "Active" });
    setIsEditing(true);
    setEditingId(row.id);
  };

  useEffect(() => {
    const fetchAndDispatch = async () => {
      dispatch(showLoading());
      try {
        const { data } = await refetch();
        if (data?.getProductGroups) {
          dispatch(addProductGroups(data.getProductGroups));
        }
      } catch (error) {
        console.error("Error fetching product groups:", error);
      } finally {
        dispatch(hideLoading());
      }
    };

    fetchAndDispatch();
  }, [dispatch, refetch]);

  const handleFormSubmit = async () => {
    if (!validateForm()) return;
    try {
      if (isEditing && editingId) {
        await editProductGroupMutation({
          variables: {
            id: editingId,
            input: {
              productgroupname: formValues.productgroupname,
              status: formValues.status,
            },
          },
        });
        dispatch(showMessage({ message: "Product group updated successfully.", type: "success" }));
      } else {
        await addProductGroupMutation({
          variables: {
            input: {
              productgroupname: formValues.productgroupname,
              status: formValues.status,
            },
          },
        });
        dispatch(showMessage({ message: "Product group added successfully.", type: "success" }));
      }

      await refetch();
      setFormValues({ productgroupname: "", status: true });
      setIsEditing(false);
      setEditingId(null);
    } catch (error: any) {
      if (error?.message?.includes("E11000")) {
        const duplicateField = error?.message?.includes("productgroupname") ? "Product group name" : "Field";
        dispatch(showMessage({ message: `${duplicateField} already exists.`, type: "error" }));
      } else {
        dispatch(showMessage({ message: "Failed to save product group. Please try again.", type: "error" }));
      }
    }
  };

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Product Group Code", key: "productgroupcode" },
    { label: "Product Group Name", key: "productgroupname" },
    { label: "Status", key: "status" },
  ];

  const tableData = productGroupList.map((pg: any, index: number) => ({
    ...pg,
    seqNo: index + 1,
    status: pg.status ? "Active" : "Inactive",
  }));

  const handleExport = () => {
    const exportData = productGroupList.map((pg: any, index: number) => ({
      ID: index + 1,
      ProductGroupName: pg.productgroupname || "-",
      Status: pg.status ? "true" : "false",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ProductGroups");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const dataBlob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(dataBlob, "productgroups.xlsx");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      const importedProductGroups = jsonData.map((row) => ({
        productgroupname: row.ProductGroupName || "",
        status: row.Status === "true" || row.Status === "1" || row.Status === true,
      }));

      // TODO: Add mutation to insert bulk product groups if required
      console.log("Imported Product Groups:", importedProductGroups);
    };

    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <input
          type="file"
          accept=".xlsx"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

        <DataTable
          title="Manage Product Groups"
          columns={columns}
          data={tableData}
          showView={false}
          showEdit={true}
          showDelete={true}
          showImport={false}
          showExport={false}
          showAdd={false}
          onView={(row) => console.log("View", row)}
          onEdit={handleEdit}
          onDelete={async (row) => {
            if (window.confirm(`Are you sure you want to delete "${row.productgroupname}"?`)) {
              try {
                await deleteProductGroupMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(showMessage({ message: "Product group deleted.", type: "success" }));
              } catch (error) {
                console.error(error);
                dispatch(showMessage({ message: "Failed to delete product group.", type: "error" }));
              }
            }
          }}
          onImport={handleImportClick}
          onExport={handleExport}
          onAdd={() => navigate("/productgroups")}
           onShowDeleted={() =>navigate("/productgroups/deletedentries")}
          entriesOptions={[5, 10, 25]}
          defaultEntriesPerPage={10}
          isLoading={isLoading}
          formFields={[
            { name: "productgroupname", label: "Product Group Name", type: "text", placeholder: "Enter product group name" },
          ]}
          formValues={formValues}
          formErrors={formErrors}
          onFormChange={handleFormChange}
          onFormSubmit={handleFormSubmit}
        />
      </div>
    </HomeLayout>
  );
};

export default ProductGroups;
