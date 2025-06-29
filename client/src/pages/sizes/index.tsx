import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { useSizesQuery, useSizeMutations } from "../../graphql/hooks/sizes";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import { addSizes } from "../../redux/slices/sizes";

const Sizes = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
    const { admin } = useAppSelector((state) => state.auth);
  const { data, refetch } = useSizesQuery();
  const { addSizeMutation, editSizeMutation, deleteSizeMutation } = useSizeMutations();
  const sizeList = data?.getSizes || [];
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  const [formValues, setFormValues] = useState({ sizename: "", status: true });
  const [formErrors, setFormErrors] = useState<{ sizename?: string }>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleFormChange = (name: string, value: string | boolean) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const errors: { sizename?: string } = {};
    if (!formValues.sizename.trim()) {
      errors.sizename = "Size name is required";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEdit = (row: any) => {
    setFormValues({ sizename: row.sizename, status: row.status === "Active" });
    setIsEditing(true);
    setEditingId(row.id);
  };

  useEffect(() => {
    const fetchAndDispatch = async () => {
      dispatch(showLoading());
      try {
        const { data } = await refetch();
        if (data?.getSizes) {
          dispatch(addSizes(data.getSizes));
        }
      } catch (error) {
        console.error("Error fetching sizes:", error);
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
        await editSizeMutation({
          variables: {
            id: editingId,
            input: {
              sizename: formValues.sizename,
              status: formValues.status,
              admin: admin?.id
            },
          },
        });
        dispatch(showMessage({ message: "Size updated successfully.", type: "success" }));
      } else {
        await addSizeMutation({
          variables: {
            input: {
              sizename: formValues.sizename,
              status: formValues.status,
              admin: admin?.id
            },
          },
        });
        dispatch(showMessage({ message: "Size added successfully.", type: "success" }));
      }

      await refetch();
      setFormValues({ sizename: "", status: true });
      setIsEditing(false);
      setEditingId(null);
    } catch (error) {
      if (error?.message?.includes("E11000")) {
        const duplicateField = error?.message?.includes("sizename") ? "Size name" : "Field";
        dispatch(showMessage({ message: `${duplicateField} already exists.`, type: "error" }));
      } else {
        dispatch(showMessage({ message: "Failed to save size. Please try again.", type: "error" }));
      }
    } finally {
        dispatch(hideLoading());
    }
  };

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Size Code", key: "sizecode" },
    { label: "Size Name", key: "sizename" },
    { label: "Status", key: "status" },
  ];

  const tableData = sizeList.map((size: any, index: number) => ({
    ...size,
    seqNo: index + 1,
    status: size.status ? "Active" : "Inactive",
  }));

  const handleExport = () => {
    const exportData = sizeList.map((size: any, index: number) => ({
      ID: index + 1,
      SizeName: size.sizename || "-",
      Status: size.status ? "true" : "false",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sizes");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const dataBlob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(dataBlob, "sizes.xlsx");
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

      const importedSizes = jsonData.map((row) => ({
        sizename: row.SizeName || "",
        status: row.Status === "true" || row.Status === "1" || row.Status === true,
      }));

      // Dispatch import mutation if needed
      console.log("Imported Sizes:", importedSizes);
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
          title="Manage Sizes"
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
            if (window.confirm(`Are you sure you want to delete "${row.sizename}"?`)) {
              try {
                await deleteSizeMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(showMessage({ message: "Size deleted.", type: "success" }));
              } catch (error) {
                console.error(error);
                dispatch(showMessage({ message: "Failed to delete size.", type: "error" }));
              }
            }
          }}
          onImport={handleImportClick}
          onExport={handleExport}
          onAdd={() => navigate("/sizes")}
          onShowDeleted={() =>navigate("/sizes/deletedentries")}
          entriesOptions={[5, 10, 25]}
          defaultEntriesPerPage={10}
          isLoading={isLoading}
          formFields={[
            { name: "sizename", label: "Size Name", type: "text", placeholder: "Enter size name" },
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

export default Sizes;
