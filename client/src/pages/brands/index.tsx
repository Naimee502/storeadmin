import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { useBrandsQuery, useBrandMutations } from "../../graphql/hooks/brands";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import { addBrands } from "../../redux/slices/brands";  

const Brands = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data, refetch } = useBrandsQuery();
  const { addBrandMutation, editBrandMutation, deleteBrandMutation } = useBrandMutations();
  const brandList = data?.getBrands || [];
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  const [formValues, setFormValues] = useState({ brandname: "", status: true });
  const [formErrors, setFormErrors] = useState<{ brandname?: string }>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleFormChange = (name: string, value: string | boolean) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const errors: { brandname?: string } = {};
    if (!formValues.brandname.trim()) {
      errors.brandname = "Brand name is required";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEdit = (row: any) => {
    setFormValues({ brandname: row.brandname, status: row.status === "Active" });
    setIsEditing(true);
    setEditingId(row.id);
  };

  useEffect(() => {
    const fetchAndDispatch = async () => {
      dispatch(showLoading());
      try {
        const { data } = await refetch();
        if (data?.getBrands) {
          dispatch(addBrands(data.getBrands));
        }
      } catch (error) {
        console.error("Error fetching brands:", error);
      } finally {
        dispatch(hideLoading());
      }
    };

    fetchAndDispatch();
  }, [dispatch, refetch]);

  const handleFormSubmit = async () => {
    if (!validateForm()) return;
    dispatch(showLoading());
    try {
      if (isEditing && editingId) {
        await editBrandMutation({
          variables: {
            id: editingId,
            input: {
              brandname: formValues.brandname,
              status: formValues.status,
            },
          },
        });
        dispatch(showMessage({ message: "Brand updated successfully.", type: "success" }));
      } else {
        await addBrandMutation({
          variables: {
            input: {
              brandname: formValues.brandname,
              status: formValues.status,
            },
          },
        });
        dispatch(showMessage({ message: "Brand added successfully.", type: "success" }));
      }

      await refetch();
      setFormValues({ brandname: "", status: true });
      setIsEditing(false);
      setEditingId(null);
    } catch (error: any) {
      if (error?.message?.includes("E11000")) {
        const duplicateField = error?.message?.includes("brandname") ? "Brand name" : "Field";
        dispatch(showMessage({ message: `${duplicateField} already exists.`, type: "error" }));
      } else {
        dispatch(showMessage({ message: "Failed to save brand. Please try again.", type: "error" }));
      }
    } finally {
          dispatch(hideLoading());
    }
  };

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Brand Code", key: "brandcode" },
    { label: "Brand Name", key: "brandname" },
    { label: "Status", key: "status" },
  ];

  const tableData = brandList.map((brand: any, index: number) => ({
    ...brand,
    seqNo: index + 1,
    status: brand.status ? "Active" : "Inactive",
  }));

  const handleExport = () => {
    const exportData = brandList.map((brand: any, index: number) => ({
      ID: index + 1,
      BrandName: brand.brandname || "-",
      Status: brand.status ? "true" : "false",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Brands");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const dataBlob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(dataBlob, "brands.xlsx");
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

      const importedBrands = jsonData.map((row) => ({
        brandname: row.BrandName || "",
        status: row.Status === "true" || row.Status === "1" || row.Status === true,
      }));

      // TODO: Dispatch import mutation if needed
      console.log("Imported Brands:", importedBrands);
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
          title="Manage Brands"
          columns={columns}
          data={tableData}
          showView={false}
          showEdit={true}
          showDelete={true}
          showImport={false}
          showExport={false}
          showAdd={false}
          onView={(row) => console.log("View", row)}
          onEdit={(row) => handleEdit(row)}
          onDelete={async (row) => {
            if (window.confirm(`Are you sure you want to delete "${row.brandname}"?`)) {
              try {
                await deleteBrandMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(showMessage({ message: "Brand deleted.", type: "success" }));
              } catch (error) {
                console.error(error);
                dispatch(showMessage({ message: "Failed to delete brand.", type: "error" }));
              }
            }
          }}
          onImport={handleImportClick}
          onExport={handleExport}
          onAdd={() => navigate("/brands")}
          onShowDeleted={() =>navigate("/brands/deletedentries")}
          entriesOptions={[5, 10, 25]}
          defaultEntriesPerPage={10}
          isLoading={isLoading}
          formFields={[
            { name: "brandname", label: "Brand Name", type: "text", placeholder: "Enter brand name" },
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

export default Brands;
