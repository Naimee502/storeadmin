import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { 
  useAccountGroupsQuery, 
  useAccountGroupMutations 
} from "../../graphql/hooks/accountgroups";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import { addAccountGroups } from "../../redux/slices/accountgroups";

const AccountGroups = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data, refetch } = useAccountGroupsQuery();
  const { addAccountGroupMutation, editAccountGroupMutation, deleteAccountGroupMutation } = useAccountGroupMutations();
  const accountGroupList = data?.getAccountGroups || [];
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  const [formValues, setFormValues] = useState({ accountgroupname: "", status: true });
  const [formErrors, setFormErrors] = useState<{ accountgroupname?: string }>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleFormChange = (name: string, value: string | boolean) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const errors: { accountgroupname?: string } = {};
    if (!formValues.accountgroupname.trim()) {
      errors.accountgroupname = "Account group name is required";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEdit = (row: any) => {
    setFormValues({ accountgroupname: row.accountgroupname, status: row.status === "Active" });
    setIsEditing(true);
    setEditingId(row.id);
  };

  useEffect(() => {
    const fetchAndDispatch = async () => {
      dispatch(showLoading());
      try {
        const { data } = await refetch();
        if (data?.getAccountGroups) {
          dispatch(addAccountGroups(data.getAccountGroups));
        }
      } catch (error) {
        console.error("Error fetching account groups:", error);
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
        await editAccountGroupMutation({
          variables: {
            id: editingId,
            input: {
              accountgroupname: formValues.accountgroupname,
              status: formValues.status,
            },
          },
        });
        dispatch(showMessage({ message: "Account group updated successfully.", type: "success" }));
      } else {
        await addAccountGroupMutation({
          variables: {
            input: {
              accountgroupname: formValues.accountgroupname,
              status: formValues.status,
            },
          },
        });
        dispatch(showMessage({ message: "Account group added successfully.", type: "success" }));
      }

      await refetch();
      setFormValues({ accountgroupname: "", status: true });
      setIsEditing(false);
      setEditingId(null);
    } catch (error: any) {
      if (error?.message?.includes("E11000")) {
        const duplicateField = error?.message?.includes("accountgroupname") ? "Account group name" : "Field";
        dispatch(showMessage({ message: `${duplicateField} already exists.`, type: "error" }));
      } else {
        dispatch(showMessage({ message: "Failed to save account group. Please try again.", type: "error" }));
      }
    }
  };

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Account Group Code", key: "accountgroupcode" },
    { label: "Account Group Name", key: "accountgroupname" },
    { label: "Status", key: "status" },
  ];

  const tableData = accountGroupList.map((ag: any, index: number) => ({
    ...ag,
    seqNo: index + 1,
    status: ag.status ? "Active" : "Inactive",
  }));

  const handleExport = () => {
    const exportData = accountGroupList.map((ag: any, index: number) => ({
      ID: index + 1,
      AccountGroupName: ag.accountgroupname || "-",
      Status: ag.status ? "true" : "false",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "AccountGroups");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const dataBlob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(dataBlob, "accountgroups.xlsx");
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

      const importedAccountGroups = jsonData.map((row) => ({
        accountgroupname: row.AccountGroupName || "",
        status: row.Status === "true" || row.Status === "1" || row.Status === true,
      }));

      // TODO: Add mutation to insert bulk account groups if required
      console.log("Imported Account Groups:", importedAccountGroups);
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
          title="Manage Account Groups"
          columns={columns}
          data={tableData}
          showView={false}
          showEdit={true}
          showDelete={true}
          showDeleted={true}
          showImport={false}
          showExport={false}
          showAdd={false}
          onEdit={handleEdit}
          onDelete={async (row) => {
            if (window.confirm(`Are you sure you want to delete "${row.accountgroupname}"?`)) {
              try {
                await deleteAccountGroupMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(showMessage({ message: "Account group deleted.", type: "success" }));
              } catch (error) {
                console.error(error);
                dispatch(showMessage({ message: "Failed to delete account group.", type: "error" }));
              }
            }
          }}
          onShowDeleted={() =>navigate("/accountgroups/deletedentries")}
          onImport={handleImportClick}
          onExport={handleExport}
          onAdd={() => navigate("/accountgroups")}
          entriesOptions={[5, 10, 25]}
          defaultEntriesPerPage={10}
          isLoading={isLoading}
          formFields={[
            { name: "accountgroupname", label: "Account Group Name", type: "text", placeholder: "Enter account group name" },
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

export default AccountGroups;
