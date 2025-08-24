import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import {
  useSubCategoriesQuery,
  useSubCategoryMutations,
} from "../../graphql/hooks/subcategories";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import { useCategoriesQuery } from "../../graphql/hooks/categories";

const SubCategories = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { type, admin, branch } = useAppSelector((state) => state.auth);
  const { data: categoriesList, refetch: categoriesRefetch} = useCategoriesQuery();
  const categoryData = categoriesList?.getCategories || [];

  const adminId =
    type === "admin"
      ? admin?.id
      : type === "branch"
      ? branch?.admin?.id
      : undefined;

  const { data, refetch } = useSubCategoriesQuery();
  const {
    addSubCategoryMutation,
    editSubCategoryMutation,
    deleteSubCategoryMutation,
  } = useSubCategoryMutations();

  const subCategoryList = data?.getSubCategories || [];
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  // Form state for add/edit
  const [formValues, setFormValues] = useState({
    subcategoryname: "",
    status: true,
    category: "",
  });
  const [formErrors, setFormErrors] = useState<{
    subcategoryname?: string;
    category?: string;
  }>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Handle form input change
  const handleFormChange = (name: string, value: string | boolean) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  // Simple validation
  const validateForm = () => {
    const errors: { subcategoryname?: string; category?: string } = {};
    if (!formValues.subcategoryname.trim()) {
      errors.subcategoryname = "SubCategory name is required";
    }
    if (!formValues.category.trim()) {
      errors.category = "Category is required";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle Edit button click: populate form and open form
  const handleEdit = (row: any) => {
    setFormValues({
      subcategoryname: row.subcategoryname,
      status: row.status === "Active",
      category: row.category?.id || "",
    });
    setIsEditing(true);
    setEditingId(row.id);
  };

  useEffect(() => {
    const fetchAndDispatch = async () => {
      dispatch(showLoading());
      try {
        await refetch();
      } catch (error) {
        console.error("Error fetching subcategories:", error);
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
        await editSubCategoryMutation({
          variables: {
            id: editingId,
            input: {
              subcategoryname: formValues.subcategoryname,
              status: formValues.status,
              admin: adminId,
              category: formValues.category,
            },
          },
        });
        dispatch(
          showMessage({
            message: "SubCategory updated successfully.",
            type: "success",
          })
        );
      } else {
        await addSubCategoryMutation({
          variables: {
            input: {
              subcategoryname: formValues.subcategoryname,
              status: formValues.status,
              admin: adminId,
              category: formValues.category,
            },
          },
        });
        dispatch(
          showMessage({
            message: "SubCategory added successfully.",
            type: "success",
          })
        );
      }

      await refetch();
      setFormValues({ subcategoryname: "", status: true, category: "" });
      setIsEditing(false);
      setEditingId(null);
    } catch (error) {
      if (error?.message?.includes("E11000")) {
        const duplicateField = error?.message?.includes("subcategoryname")
          ? "SubCategory name"
          : "Field";
        dispatch(
          showMessage({
            message: `${duplicateField} already exists.`,
            type: "error",
          })
        );
      } else {
        dispatch(
          showMessage({
            message: "Failed to save subcategory. Please try again.",
            type: "error",
          })
        );
      }
    } finally {
      dispatch(hideLoading());
    }
  };

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "SubCategory Code", key: "subcategorycode" },
    { label: "SubCategory Name", key: "subcategoryname" },
    { label: "Category", key: "categoryName" },
    { label: "Status", key: "status" },
  ];

  const tableData = subCategoryList.map((sub: any, index: number) => ({
    ...sub,
    seqNo: index + 1,
    status: sub.status ? "Active" : "Inactive",
    categoryName: sub.category?.categoryname || "-",
  }));

  const handleExport = () => {
    const exportData = subCategoryList.map((sub: any, index: number) => ({
      ID: index + 1,
      SubCategoryName: sub.subcategoryname || "-",
      Category: sub.category?.categoryname || "-",
      Status: sub.status ? "true" : "false",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "SubCategories");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const dataBlob = new Blob([excelBuffer], {
      type: "application/octet-stream",
    });
    saveAs(dataBlob, "subcategories.xlsx");
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

      const importedSubCategories = jsonData.map((row) => ({
        subcategoryname: row.SubCategoryName || "",
        status:
          row.Status === "true" || row.Status === "1" || row.Status === true,
        category: row.Category || "",
      }));

      console.log("Imported SubCategories:", importedSubCategories);
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
          title="Manage SubCategories"
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
            if (
              window.confirm(
                `Are you sure you want to delete "${row.subcategoryname}"?`
              )
            ) {
              try {
                await deleteSubCategoryMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(
                  showMessage({ message: "SubCategory deleted.", type: "success" })
                );
              } catch (error) {
                console.error(error);
                dispatch(
                  showMessage({
                    message: "Failed to delete subcategory.",
                    type: "error",
                  })
                );
              }
            }
          }}
          onImport={handleImportClick}
          onExport={handleExport}
          onAdd={() => navigate("/subcategories")}
          onShowDeleted={() => navigate("/subcategories/deletedentries")}
          entriesOptions={[5, 10, 25]}
          defaultEntriesPerPage={10}
          isLoading={isLoading}
          formFields={[
            {
              name: "category",
              label: "Category",
              type: "select",
              placeholder: "Select category",
              options: categoryData.map((cat: any) => ({
                label: cat.categoryname,
                value: cat.id,
              })),
              searchable: true,
            },
            {
              name: "subcategoryname",
              label: "SubCategory Name",
              type: "text",
              placeholder: "Enter subcategory name",
            },
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

export default SubCategories;
