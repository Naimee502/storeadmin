import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { useUnitsQuery, useUnitMutations } from "../../graphql/hooks/units";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import { addUnits } from "../../redux/slices/units";

const Units = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const fileInputRef = useRef(null);
  const { data, refetch } = useUnitsQuery();
  const { addUnitMutation, editUnitMutation, deleteUnitMutation } = useUnitMutations();
  const unitList = data?.getUnits || [];
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  const [formValues, setFormValues] = useState({ unitname: "", status: true });
  const [formErrors, setFormErrors] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const handleFormChange = (name, value) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const errors = {};
    if (!formValues.unitname.trim()) {
      errors.unitname = "Unit name is required";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEdit = (row) => {
    setFormValues({ unitname: row.unitname, status: row.status === "Active" });
    setIsEditing(true);
    setEditingId(row.id);
  };

  useEffect(() => {
    const fetchAndDispatch = async () => {
      dispatch(showLoading());
      try {
        const { data } = await refetch();
        if (data?.getUnits) {
          dispatch(addUnits(data.getUnits));
        }
      } catch (error) {
        console.error("Error fetching units:", error);
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
        await editUnitMutation({
          variables: {
            id: editingId,
            input: { unitname: formValues.unitname, status: formValues.status },
          },
        });
        dispatch(showMessage({ message: "Unit updated successfully.", type: "success" }));
      } else {
        await addUnitMutation({
          variables: {
            input: { unitname: formValues.unitname, status: formValues.status },
          },
        });
        dispatch(showMessage({ message: "Unit added successfully.", type: "success" }));
      }
      await refetch();
      setFormValues({ unitname: "", status: true });
      setIsEditing(false);
      setEditingId(null);
    } catch (error) {
      if (error?.message?.includes("E11000")) {
        const duplicateField = error?.message?.includes("unitname") ? "Unit name" : "Field";
        dispatch(showMessage({ message: `${duplicateField} already exists.`, type: "error" }));
      } else {
        dispatch(showMessage({ message: "Failed to save unit. Please try again.", type: "error" }));
      }
    } finally {
        dispatch(hideLoading());
    }
  };

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Unit Code", key: "unitcode" },
    { label: "Unit Name", key: "unitname" },
    { label: "Status", key: "status" },
  ];

  const tableData = unitList.map((unit, index) => ({
    ...unit,
    seqNo: index + 1,
    status: unit.status ? "Active" : "Inactive",
  }));

  const handleExport = () => {
    const exportData = unitList.map((unit, index) => ({
      ID: index + 1,
      UnitName: unit.unitname || "-",
      Status: unit.status ? "true" : "false",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Units");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const dataBlob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(dataBlob, "units.xlsx");
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target?.result);
      const workbook = XLSX.read(data, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      const importedUnits = jsonData.map((row) => ({
        unitname: row.UnitName || "",
        status: row.Status === "true" || row.Status === "1" || row.Status === true,
      }));

      console.log("Imported Units:", importedUnits);
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
          title="Manage Units"
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
            if (window.confirm(`Are you sure you want to delete \"${row.unitname}\"?`)) {
              try {
                await deleteUnitMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(showMessage({ message: "Unit deleted.", type: "success" }));
              } catch (error) {
                console.error(error);
                dispatch(showMessage({ message: "Failed to delete unit.", type: "error" }));
              }
            }
          }}
          onImport={handleImportClick}
          onExport={handleExport}
          onAdd={() => navigate("/units")}
          onShowDeleted={() =>navigate("/units/deletedentries")}
          entriesOptions={[5, 10, 25]}
          defaultEntriesPerPage={10}
          isLoading={isLoading}
          formFields={[
            { name: "unitname", label: "Unit Name", type: "text", placeholder: "Enter unit name" },
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

export default Units;