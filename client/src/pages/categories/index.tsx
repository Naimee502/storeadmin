import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { useCategoriesListQuery, useCategoryMutations, useReorderCategories } from "../../graphql/hooks/categories";
import CategoryReorder from "../../components/categoryreorder";
import { FaSort } from "react-icons/fa";
import { useImageUpload } from "../../graphql/hooks/uploads";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import { selectModuleActions } from "../../redux/slices/permissions";
import { SpecDefEditor, type SpecDef } from "../../components/customfields";

const Categories = () => {
  const actions = useAppSelector(state => selectModuleActions(state, "categories"));
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { type, admin, branch } = useAppSelector((state) => state.auth);
  // Lite list query — grid columns + inline-form fields only.
  const { data, refetch } = useCategoriesListQuery();
  const categoryList = data?.getCategories || [];
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  const adminId = admin?.id;

  const { addCategoryMutation, editCategoryMutation, deleteCategoryMutation } =
    useCategoryMutations();
  const { uploadImageMutation, deleteImages } = useImageUpload();
  const { reorderCategories, loading: reordering } = useReorderCategories();
  const [isReorderOpen, setIsReorderOpen] = useState(false);

  const handleSaveOrder = async (ids: string[]) => {
    try {
      await reorderCategories(ids);
      await refetch();
      dispatch(showMessage({ message: "Category order saved.", type: "success" }));
    } catch (error) {
      console.error(error);
      dispatch(showMessage({ message: "Failed to save category order.", type: "error" }));
      throw error;
    }
  };

  // Form state for add/edit
  const [formValues, setFormValues] = useState<{ categoryname: string; status: boolean; image: string }>({
    categoryname: "",
    status: true,
    image: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Image at edit start; deleted after save if replaced or removed.
  const previousImageUrl = useRef<string>("");
  const [formErrors, setFormErrors] = useState<{ categoryname?: string }>({});
  // Spec fields are opt-in per business; off keeps this screen as it was.
  const specsOn = useAppSelector((s: any) => !!s.adminsettings.settings?.productSpecsOn);
  const [specRow, setSpecRow] = useState<any>(null);
  const [specDefs, setSpecDefs] = useState<SpecDef[]>([]);
  const [savingSpecs, setSavingSpecs] = useState(false);

  const openSpecs = (row: any) => {
    const cat = categoryList.find((c: any) => c.id === row.id);
    setSpecRow(cat || row);
    setSpecDefs((cat?.specdefs || []).map((d: any) => ({ ...d, options: d.options || [] })));
  };

  const saveSpecs = async () => {
    setSavingSpecs(true);
    try {
      await editCategoryMutation({
        variables: {
          id: specRow.id,
          input: {
            categoryname: specRow.categoryname,
            image: specRow.image || "",
            status: specRow.status !== false,
            admin: adminId,
            specdefs: specDefs
              .filter((d) => String(d.label || "").trim())
              .map(({ key, label, type, options, print, required }) => ({
                key, label: label.trim(), type, options: (options || []).map((o) => o.trim()).filter(Boolean), print: !!print, required: !!required,
              })),
          },
        },
      });
      await refetch();
      setSpecRow(null);
      dispatch(showMessage({ message: "Spec fields saved.", type: "success" }));
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Could not save spec fields.", type: "error" }));
    } finally {
      setSavingSpecs(false);
    }
  };
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

    // Clear the image; the saved one is deleted on Save.
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

  // Mount only. Cached rows → refresh quietly without the blocking loader.
  useEffect(() => {
    const fetchAndDispatch = async () => {
      const blocking = !data?.getCategories?.length;
      if (blocking) dispatch(showLoading());
      try {
        await refetch();
      } catch (error) {
        console.error("Error fetching categories:", error);
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
      // Upload the picked file only on Save.
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

      // Delete the old image file now that nothing points at it.
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

  // Server returns storefront order, so Seq Number is the app/website position.
  const tableData = [...categoryList].map((cat: any, index: number) => ({
    ...cat,
    seqNo: index + 1,
    status: cat.status ? "Active" : "Inactive",
  }));

  const handleExport = () => {
    const exportData = [...categoryList].map((cat: any, index: number) => ({
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
          showSpecs={specsOn && !!actions?.showEdit}
          onSpecs={openSpecs}
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
          toolbarActions={
            actions.showRearrange && categoryList.length > 1 ? (
              <button
                onClick={() => setIsReorderOpen(true)}
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

        {specRow && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
            <div className="mt-10 w-full max-w-3xl rounded-lg bg-white p-4 shadow-lg">
              <h2 className="mb-2 text-[15px] font-semibold text-slate-800">Spec Fields — {specRow.categoryname}</h2>
              <SpecDefEditor defs={specDefs} onChange={setSpecDefs} />
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" className="h-8 rounded-md border border-slate-300 px-3 text-[13px]" onClick={() => setSpecRow(null)}>Cancel</button>
                <button type="button" disabled={savingSpecs} className="h-8 rounded-md bg-indigo-600 px-3 text-[13px] font-semibold text-white disabled:opacity-50" onClick={saveSpecs}>Save</button>
              </div>
            </div>
          </div>
        )}

        <CategoryReorder
          isOpen={isReorderOpen}
          onClose={() => setIsReorderOpen(false)}
          categories={categoryList.map((c: any) => ({
            id: c.id,
            categoryname: c.categoryname,
            categorycode: c.categorycode,
          }))}
          onSave={handleSaveOrder}
          saving={reordering}
        />
      </div>
    </HomeLayout>
  );
};

export default Categories;
