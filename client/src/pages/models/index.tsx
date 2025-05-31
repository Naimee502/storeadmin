import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { useModelsQuery, useModelMutations } from "../../graphql/hooks/models";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import { addModels } from "../../redux/slices/models";

const Models = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data, refetch } = useModelsQuery();
  const { addModelMutation, editModelMutation, deleteModelMutation } = useModelMutations();
  const modelList = data?.getModels || [];
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  const [formValues, setFormValues] = useState({ modelname: "", status: true });
  const [formErrors, setFormErrors] = useState<{ modelname?: string }>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleFormChange = (name: string, value: string | boolean) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const errors: { modelname?: string } = {};
    if (!formValues.modelname.trim()) {
      errors.modelname = "Model name is required";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEdit = (row: any) => {
    setFormValues({ modelname: row.modelname, status: row.status === "Active" });
    setIsEditing(true);
    setEditingId(row.id);
  };

  useEffect(() => {
    const fetchAndDispatch = async () => {
      dispatch(showLoading());
      try {
        const { data } = await refetch();
        if (data?.getModels) {
          dispatch(addModels(data.getModels));
        }
      } catch (error) {
        console.error("Error fetching models:", error);
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
        await editModelMutation({
          variables: {
            id: editingId,
            input: {
              modelname: formValues.modelname,
              status: formValues.status,
            },
          },
        });
        dispatch(showMessage({ message: "Model updated successfully.", type: "success" }));
      } else {
        await addModelMutation({
          variables: {
            input: {
              modelname: formValues.modelname,
              status: formValues.status,
            },
          },
        });
        dispatch(showMessage({ message: "Model added successfully.", type: "success" }));
      }

      await refetch();
      setFormValues({ modelname: "", status: true });
      setIsEditing(false);
      setEditingId(null);
    } catch (error: any) {
      if (error?.message?.includes("E11000")) {
        const duplicateField = error?.message?.includes("modelname") ? "Model name" : "Field";
        dispatch(showMessage({ message: `${duplicateField} already exists.`, type: "error" }));
      } else {
        dispatch(showMessage({ message: "Failed to save model. Please try again.", type: "error" }));
      }
    }
  };

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Model Code", key: "modelcode" },
    { label: "Model Name", key: "modelname" },
    { label: "Status", key: "status" },
  ];

  const tableData = modelList.map((model: any, index: number) => ({
    ...model,
    seqNo: index + 1,
    status: model.status ? "Active" : "Inactive",
  }));

  const handleExport = () => {
    const exportData = modelList.map((model: any, index: number) => ({
      ID: index + 1,
      ModelName: model.modelname || "-",
      Status: model.status ? "true" : "false",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Models");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const dataBlob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(dataBlob, "models.xlsx");
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

      const importedModels = jsonData.map((row) => ({
        modelname: row.ModelName || "",
        status: row.Status === "true" || row.Status === "1" || row.Status === true,
      }));

      // TODO: Add mutation to insert bulk models if required
      console.log("Imported Models:", importedModels);
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
          title="Manage Models"
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
            if (window.confirm(`Are you sure you want to delete "${row.modelname}"?`)) {
              try {
                await deleteModelMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(showMessage({ message: "Model deleted.", type: "success" }));
              } catch (error) {
                console.error(error);
                dispatch(showMessage({ message: "Failed to delete model.", type: "error" }));
              }
            }
          }}
          onImport={handleImportClick}
          onExport={handleExport}
          onAdd={() => navigate("/models")}
          onShowDeleted={() =>navigate("/models/deletedentries")}
          entriesOptions={[5, 10, 25]}
          defaultEntriesPerPage={10}
          isLoading={isLoading}
          formFields={[
            { name: "modelname", label: "Model Name", type: "text", placeholder: "Enter model name" },
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

export default Models;
