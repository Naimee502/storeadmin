import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import {
  useSubCategoriesListQuery,
  useSubCategoryMutations,
} from "../../graphql/hooks/subcategories";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import { useCategoriesListQuery } from "../../graphql/hooks/categories";
import { useImageUpload } from "../../graphql/hooks/uploads";
import { selectModuleActions } from "../../redux/slices/permissions";
import CategoryReorder from "../../components/categoryreorder";
import { useReorderSubCategories } from "../../graphql/hooks/subcategories";
import { FaSort, FaTags, FaChevronDown } from "react-icons/fa";

const SubCategories = () => {
  const actions = useAppSelector(state => selectModuleActions(state, "subcategories"));
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { type, admin, branch } = useAppSelector((state) => state.auth);
  // Picker + grouping order only need id/name; lite list shares the Categories page cache.
  const { data: categoriesList, refetch: categoriesRefetch} = useCategoriesListQuery();
  const categoryData = categoriesList?.getCategories || [];

  const adminId = admin?.id;

  // Lite list query — grid columns + inline-form/Rearrange fields only.
  const { data, refetch } = useSubCategoriesListQuery();
  const {
    addSubCategoryMutation,
    editSubCategoryMutation,
    deleteSubCategoryMutation,
  } = useSubCategoryMutations();
  const { uploadImageMutation, deleteImages } = useImageUpload();

  const subCategoryList = data?.getSubCategories || [];

  // Rearrange works one category at a time (sub-categories are ordered per category).
  const { reorderSubCategories, loading: reordering } = useReorderSubCategories();
  const [isReorderOpen, setIsReorderOpen] = useState(false);
  const [reorderCategoryId, setReorderCategoryId] = useState<string>("");
  const categoriesWithSubs = categoryData.filter((c: any) =>
    subCategoryList.some((s: any) => s.category?.id === c.id)
  );
  const openReorder = () => {
    if (!reorderCategoryId || !categoriesWithSubs.some((c: any) => c.id === reorderCategoryId)) {
      setReorderCategoryId(categoriesWithSubs[0]?.id ?? "");
    }
    setIsReorderOpen(true);
  };
  const handleSaveSubOrder = async (ids: string[]) => {
    try {
      await reorderSubCategories(reorderCategoryId, ids);
      await refetch();
      dispatch(showMessage({ message: "Sub category order saved.", type: "success" }));
    } catch (error) {
      console.error(error);
      dispatch(showMessage({ message: "Failed to save sub category order.", type: "error" }));
      throw error;
    }
  };
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  // Form state; the optional image is the app's sub-category tile.
  const [formValues, setFormValues] = useState<{
    subcategoryname: string;
    status: boolean;
    category: string;
    image: string;
  }>({
    subcategoryname: "",
    status: true,
    category: "",
    image: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Image at edit start; deleted after save if replaced or removed.
  const previousImageUrl = useRef<string>("");
  const [formErrors, setFormErrors] = useState<{
    subcategoryname?: string;
    category?: string;
  }>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // A File means the picker fired: preview via blob URL, upload on Save.
  const handleFormChange = (name: string, value: string | boolean | File) => {
    if (value instanceof File) {
      setSelectedFile(value);
      setFormValues((prev) => {
        if (prev.image.startsWith("blob:")) URL.revokeObjectURL(prev.image);
        return { ...prev, image: URL.createObjectURL(value) };
      });
      return;
    }

    // The preview's clears the image.
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
      image: row.image || "",
    });
    setSelectedFile(null);
    previousImageUrl.current = row.image || "";
    setIsEditing(true);
    setEditingId(row.id);
  };

  // Mount only. Cached rows → refresh quietly without the blocking loader.
  useEffect(() => {
    const fetchAndDispatch = async () => {
      const blocking = !data?.getSubCategories?.length;
      if (blocking) dispatch(showLoading());
      try {
        await refetch();
      } catch (error) {
        console.error("Error fetching subcategories:", error);
      } finally {
        if (blocking) dispatch(hideLoading());
      }
    };

    fetchAndDispatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, refetch]);

  const handleFormSubmit = async () => {
    if (!validateForm()) return;
    dispatch(showLoading());
    try {
      const uploadedUrl = selectedFile
        ? (await uploadImageMutation({ variables: { file: selectedFile } })).data?.uploadImage?.url
        : formValues.image;

      if (isEditing && editingId) {
        await editSubCategoryMutation({
          variables: {
            id: editingId,
            input: {
              subcategoryname: formValues.subcategoryname,
              image: uploadedUrl || "",
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
              image: uploadedUrl || "",
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

      const replaced = previousImageUrl.current;
      previousImageUrl.current = "";
      if (replaced && replaced !== uploadedUrl) void deleteImages([replaced]);

      await refetch();
      setFormValues({ subcategoryname: "", status: true, category: "", image: "" });
      setSelectedFile(null);
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

  // Grouped in the app's order: category order, then sub-category order.
  const categoryRank = new Map<string, number>(categoryData.map((c: any, i: number) => [c.id, i]));
  const orderedSubs = [...subCategoryList].sort(
    (a: any, b: any) =>
      (categoryRank.get(a.category?.id) ?? 1e9) - (categoryRank.get(b.category?.id) ?? 1e9)
  );

  const tableData = orderedSubs.map((sub: any, index: number) => ({
    ...sub,
    seqNo: index + 1,
    status: sub.status ? "Active" : "Inactive",
    categoryName: sub.category?.categoryname || "-",
  }));

  const handleExport = () => {
    const exportData = orderedSubs.map((sub: any, index: number) => ({
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
          {...actions}
          // Inline form replaces the Add button on this page.
          showAdd={false}
          showView={false}
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
          toolbarActions={
            actions.showRearrange && categoriesWithSubs.length > 0 ? (
              <button
                onClick={openReorder}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                title="Change the display order"
              >
                <FaSort className="text-indigo-600" />
                Rearrange
              </button>
            ) : null
          }
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

        <CategoryReorder
          isOpen={isReorderOpen}
          onClose={() => setIsReorderOpen(false)}
          title="Rearrange Sub Categories"
          hint="Order is per category — this is how the app's catalogue browse lists them."
          emptyText="No active sub categories in this category."
          resetKey={reorderCategoryId}
          header={
            <label className="block">
              <span className="mb-0.5 block text-[12px] font-medium text-slate-600">Category</span>
              <div className="relative">
                <FaTags className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <select
                  value={reorderCategoryId}
                  onChange={(e) => setReorderCategoryId(e.target.value)}
                  className="h-8 w-full cursor-pointer appearance-none rounded-md border border-slate-300 bg-white pl-8 pr-8 text-[13px] font-medium text-slate-800 hover:border-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {categoriesWithSubs.map((c: any) => {
                    const count = subCategoryList.filter((s: any) => s.category?.id === c.id).length;
                    return (
                      <option key={c.id} value={c.id}>
                        {c.categoryname} ({count})
                      </option>
                    );
                  })}
                </select>
                <FaChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={12} />
              </div>
            </label>
          }
          categories={subCategoryList
            .filter((s: any) => s.category?.id === reorderCategoryId)
            .map((s: any) => ({ id: s.id, categoryname: s.subcategoryname, categorycode: s.subcategorycode }))}
          onSave={handleSaveSubOrder}
          saving={reordering}
        />
      </div>
    </HomeLayout>
  );
};

export default SubCategories;
