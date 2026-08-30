import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { useCategoriesQuery, useCategoryMutations } from "../../graphql/hooks/categories";
import { useImageUpload } from "../../graphql/hooks/uploads";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import { addCategories } from "../../redux/slices/categories";
import { selectModuleActions } from "../../redux/slices/permissions";

const Categories = () => {
  const actions = useAppSelector(state => selectModuleActions(state, "categories"));
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { type, admin, branch } = useAppSelector((state) => state.auth);
  const { data, refetch } = useCategoriesQuery();
  const categoryList = data?.getCategories || [];
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  const adminId = admin?.id;

  const { addCategoryMutation, editCategoryMutation, deleteCategoryMutation } =
    useCategoryMutations();
  const { uploadImageMutation, deleteImages } = useImageUpload();

  // Form state for add/edit
  const [formValues, setFormValues] = useState<{ categoryname: string; status: boolean; image: string }>({
    categoryname: "",
    status: true,
    image: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // The image this category had when editing started. If the save ends up
  // storing something else — a replacement, or nothing at all — the old file
  // is left on the server with no page able to show it, so it is deleted once
  // the save succeeds.
  const previousImageUrl = useRef<string>("");
  const [formErrors, setFormErrors] = useState<{ categoryname?: string }>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Handle form input change — a File means the image picker just fired,
  // so preview it immediately (blob URL) and hold the real file for upload
  // on Save, same pattern as the product form.
  const handleFormChange = (name: string, value: string | boolean | File) => {
    if (value instanceof File) {
      setSelectedFile(value);
      setFormValues((prev) => {
        if (prev.image.startsWith("blob:")) URL.revokeObjectURL(prev.image);
        return { ...prev, image: URL.createObjectURL(value) };
      });
      return;
    }

    // The preview's ✕ clears the image. Whatever file was picked but not yet
    // uploaded goes with it; the previously saved one is deleted on Save.
    if (name === "image" && value === "") {
      setSelectedFile(null);
      setFormValues((prev) => {
        if (prev.image.startsWith("blob:")) URL.revokeObjectURL(prev.image);
        return { ...prev, image: "" };
      });
      return;
    }

    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  // Simple validation
  const validateForm = () => {
    const errors: { categoryname?: string } = {};
    if (!formValues.categoryname.trim()) {
      errors.categoryname = "Category name is required";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle Edit button click: populate form and open form
  const handleEdit = (row: any) => {
    setFormValues({
      categoryname: row.categoryname,
      status: row.status === "Active",
      image: row.image || "",
    });
    setSelectedFile(null);
    previousImageUrl.current = row.image || "";
    setIsEditing(true);
    setEditingId(row.id);
  };

  useEffect(() => {
    const fetchAndDispatch = async () => {
      dispatch(showLoading());
      try {
        await refetch();
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
    dispatch(showLoading());
    try {
      // Upload the newly picked file (if any) now — same as the product
      // form, upload only happens on Save, not on file pick.
      const uploadedUrl = selectedFile
        ? (await uploadImageMutation({ variables: { file: selectedFile } })).data?.uploadImage?.url
        : formValues.image;

      if (isEditing && editingId) {
        // Edit mutation
        await editCategoryMutation({
          variables: {
            id: editingId,
            input: {
              categoryname: formValues.categoryname,
              image: uploadedUrl || "",
              status: formValues.status,
              admin: adminId
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
              image: uploadedUrl || "",
              status: formValues.status,
              admin: adminId
            },
          },
        });
        dispatch(showMessage({ message: "Category added successfully.", type: "success" }));
      }

      // Saved, and the category now points at `uploadedUrl` — so if it used to
      // point somewhere else, that file is unreachable and can go.
      const replaced = previousImageUrl.current;
      previousImageUrl.current = "";
      if (replaced && replaced !== uploadedUrl) void deleteImages([replaced]);

      await refetch();
      setFormValues({ categoryname: "", status: true, image: "" });
      setSelectedFile(null);
      setIsEditing(false);
      setEditingId(null);
    } catch (error) {
      if (error?.message?.includes("E11000")) {
        dispatch(showMessage({ message: "Category name already exists.", type: "error" }));
      } else {
        dispatch(showMessage({ message: "Failed to save category. Please try again.", type: "error" }));
      }
    } finally {
      dispatch(hideLoading());
    }
  };

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Category Code", key: "categorycode" },
    { label: "Category Name", key: "categoryname" },
    { label: "Status", key: "status" },
  ];

  const tableData = [...categoryList].reverse().map((cat: any, index: number) => ({
    ...cat,
    seqNo: index + 1,
    status: cat.status ? "Active" : "Inactive",
  }));

  const handleExport = () => {
    const exportData = [...categoryList].reverse().map((cat: any, index: number) => ({
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

      // TODO: Call addCategories mutation for bulk insert
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
          {...actions}
          // Inline form replaces the Add button on this page.
          showAdd={false}
          showView={false}
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
          onShowDeleted={() => navigate("/categories/deletedentries")}
          entriesOptions={[5, 10, 25]}
          defaultEntriesPerPage={10}
          isLoading={isLoading}
          formFields={[
            {
              name: "categoryname",
              label: "Category Name",
              type: "text",
              placeholder: "Enter category name",
            },
            {
              name: "image",
              label: "Image",
              type: "file",
              accept: "image/*",
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

export default Categories;
