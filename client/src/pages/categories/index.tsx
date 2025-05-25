import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { useCategoriesQuery, useCategoryMutations } from "../../graphql/hooks/categories";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import { addCategories } from "../../redux/slices/categories";


const Categories = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data, refetch } = useCategoriesQuery();
  const { addCategoryMutation, editCategoryMutation, deleteCategoryMutation } = useCategoryMutations();
  const categoryList = data?.getCategories || [];
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  // Form state for add/edit
  const [formValues, setFormValues] = useState({ categoryname: "", status: false });
  const [formErrors, setFormErrors] = useState<{ categoryname?: string }>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Handle form input change
  const handleFormChange = (name: string, value: string | boolean) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  // Simple validation
  const validateForm = () => {
    const errors: { categoryname?: string } = {};
    if (!formValues.categoryname.trim()) {
      errors.categoryname = "Category Name is required";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle Edit button click: populate form and open form
  const handleEdit = (row: any) => {
    setFormValues({ categoryname: row.categoryname, status: row.status === "Active" });
    setIsEditing(true);
    setEditingId(row.id);
  };

  useEffect(() => {
    const fetchAndDispatch = async () => {
      dispatch(showLoading());
      try {
        const { data } = await refetch();
        if (data?.categories) {
          dispatch(addCategories(data.categories));
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
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
        // Update mutation
        await editCategoryMutation({
          variables: {
            id: editingId,
            input: {
              categoryname: formValues.categoryname,
              status: formValues.status,
            },
          },
        });
        dispatch(showMessage({ message: "Category updated successfully.", type: "success" }));
      } else {
        // Add mutation
        await addCategoryMutation({
          variables: {
            input: {
              categoryname: formValues.categoryname,
              status: formValues.status,
            },
          },
        });
        dispatch(showMessage({ message: "Category added successfully.", type: "success" }));
      }

      await refetch();
      setFormValues({ categoryname: "", status: false });
      setIsEditing(false);
      setEditingId(null);
    } catch (error) {
      if (error?.message?.includes("E11000")) {
        const duplicateField = error?.message?.includes("categoryname")
        ? "Category name"
        : "Field";
        dispatch(showMessage({ message: `${duplicateField} already exists.`, type: 'error' }));
      } else {
        dispatch(showMessage({ message: 'Failed to save category. Please try again.', type: 'error' }));
      }
    }
  };

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Category Code", key: "categorycode" },
    { label: "Category Name", key: "categoryname" },
    { label: "Status", key: "status" },
  ];

  const tableData = categoryList.map((category: any, index: number) => ({
    ...category,
    seqNo: index + 1,
    status: category.status ? "Active" : "Inactive",
  }));

  const handleExport = () => {
    const exportData = categoryList.map((cat: any, index: number) => ({
      ID: index + 1,
      CategoryName: cat.categoryname || "-",
      Status: cat.status ? "true" : "false",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Categories");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const dataBlob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(dataBlob, "categories.xlsx");
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

      const importedCategories = jsonData.map((row) => ({
        categoryname: row.CategoryName || "",
        status: row.Status === "true" || row.Status === "1" || row.Status === true,
      }));

      // You can dispatch import API here (optional)
      console.log("Imported Categories:", importedCategories);
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
          title="Manage Categories"
          columns={columns}
          data={tableData}
          showView={false}
          showEdit={true}
          showDelete={true}
          showImport={true}
          showExport={true}
          showAdd={false}
          onView={(row) => console.log("View", row)}
          onEdit={(row) => handleEdit(row)}
          onDelete={async (row) => {
            if (window.confirm(`Are you sure you want to delete "${row.categoryname}"?`)) {
              try {
                await deleteCategoryMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(showMessage({ message: "Category deleted.", type: "success" }));
              } catch (error) {
                console.error(error);
                dispatch(showMessage({ message: "Failed to delete category.", type: "error" }));
              }
            }
          }}
          onImport={handleImportClick}
          onExport={handleExport}
          onAdd={() => navigate("/categories")}
          entriesOptions={[5, 10, 25]}
          defaultEntriesPerPage={10}
          isLoading={isLoading}
          formFields={[
            { name: "categoryname", label: "Category Name", type: 'text', placeholder: "Enter category name" },
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

export default Categories;
