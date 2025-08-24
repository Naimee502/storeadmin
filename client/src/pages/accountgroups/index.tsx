import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import {
  useAccountGroupsQuery,
  useAccountGroupMutations,
} from "../../graphql/hooks/accountgroups";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import { addAccountGroups } from "../../redux/slices/accountgroups";

const AccountGroups = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { type, admin, branch } = useAppSelector((state) => state.auth);
  const adminId =
    type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : undefined;

  const { data, refetch } = useAccountGroupsQuery();
  const { addAccountGroupMutation, editAccountGroupMutation, deleteAccountGroupMutation } =
    useAccountGroupMutations();
  const accountGroupList = data?.getAccountGroups || [];
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  const [formValues, setFormValues] = useState({
    accountgroupname: "",
    category: "assets",
    status: true,
  });

  const [formErrors, setFormErrors] = useState<{
    accountgroupname?: string;
    category?: string;
  }>({});

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleFormChange = (name: string, value: string | boolean) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const errors: typeof formErrors = {};
    if (!formValues.accountgroupname.trim()) {
      errors.accountgroupname = "Account group name is required";
    }
    if (!formValues.category) {
      errors.category = "Category is required";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEdit = (row: any) => {
    setFormValues({
      accountgroupname: row.accountgroupname,
      category: row.category || "assets",
      status: row.status === "Active",
    });
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
    dispatch(showLoading());
    try {
      const input = {
        accountgroupname: formValues.accountgroupname,
        category: formValues.category,
        status: formValues.status,
        admin: adminId,
      };

      if (isEditing && editingId) {
        await editAccountGroupMutation({ variables: { id: editingId, input } });
        dispatch(showMessage({ message: "Account group updated successfully.", type: "success" }));
      } else {
        await addAccountGroupMutation({ variables: { input } });
        dispatch(showMessage({ message: "Account group added successfully.", type: "success" }));
      }

      await refetch();
      setFormValues({ accountgroupname: "", category: "assets", status: true });
      setIsEditing(false);
      setEditingId(null);
    } catch (error: any) {
      if (error?.message?.includes("E11000")) {
        const duplicateField = error?.message?.includes("accountgroupname")
          ? "Account group name"
          : "Field";
        dispatch(showMessage({ message: `${duplicateField} already exists.`, type: "error" }));
      } else {
        dispatch(
          showMessage({ message: "Failed to save account group. Please try again.", type: "error" })
        );
      }
    } finally {
      dispatch(hideLoading());
    }
  };

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Account Group Code", key: "accountgroupcode" },
    { label: "Account Group Name", key: "accountgroupname" },
    { label: "Category", key: "category" },
    { label: "Status", key: "status" },
  ];

  const capitalize = (str: string) =>
  str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

  const tableData = accountGroupList.map((ag: any, index: number) => ({
    ...ag,
    seqNo: index + 1,
    category: capitalize(ag.category || "assets"),
    status: ag.status ? "Active" : "Inactive",
  }));

  const handleExport = () => {
    const exportData = accountGroupList.map((ag: any, index: number) => ({
      ID: index + 1,
      AccountGroupName: ag.accountgroupname || "-",
      Category: ag.category || "assets",
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
        category: row.Category || "assets",
        status: row.Status === "true" || row.Status === "1" || row.Status === true,
      }));

      console.log("Imported Account Groups:", importedAccountGroups);
      // Optional: You can trigger bulk mutation here
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
          onShowDeleted={() => navigate("/accountgroups/deletedentries")}
          onImport={handleImportClick}
          onExport={handleExport}
          onAdd={() => navigate("/accountgroups")}
          entriesOptions={[5, 10, 25]}
          defaultEntriesPerPage={10}
          isLoading={isLoading}
          formFields={[
            {
              name: "accountgroupname",
              label: "Account Group Name",
              type: "text",
              placeholder: "Enter account group name",
            },
            {
              name: "category",
              label: "Category",
              type: "select",
              options: [
                { label: "Assets", value: "assets" },
                { label: "Liabilities", value: "liabilities" },
                { label: "Income", value: "income" },
                { label: "Expenses", value: "expenses" },
              ],
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

export default AccountGroups;
