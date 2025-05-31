import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { addBranches } from "../../redux/slices/branches";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { useBranchesQuery, useBranchMutations } from "../../graphql/hooks/branches";
import { hideLoading, showLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";

const Branches = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data, refetch } = useBranchesQuery();
  const { deleteBranchMutation } = useBranchMutations();
  const branchList = data?.getBranches || [];
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  useEffect(() => {
    const fetchAndDispatch = async () => {
      dispatch(showLoading());
      try {
        const { data } = await refetch();
        if (data?.branches) {
          dispatch(addBranches(data.branches));
        }
      } catch (error) {
        console.error('Error fetching branches:', error);
      } finally {
        dispatch(hideLoading());
      }
    };

    fetchAndDispatch();
  }, [dispatch, refetch]);

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Branch Code", key: "branchcode" },
    { label: "Name", key: "name" },
    { label: "Email", key: "email" },
    { label: "Mobile Number", key: "mobile" },
    { label: "Location", key: "location" },
    { label: "Address", key: "address" },
    { label: "Status", key: "status" },
  ];

  const tableData = branchList.map((branch: any, index: any) => ({
    ...branch,
    seqNo: index + 1,
    name: branch.branchname,
    status: branch.status ? "Active" : "Inactive",
  }));

  // 📤 Export branches to .xlsx file
  const handleExport = () => {
    const exportData = branchList.map((branch: any, index: any) => ({
      ID: index + 1,
      BranchCode: branch.branchcode || "-",
      BranchName: branch.branchname || "-",
      Mobile: branch.mobile || "-",
      Password: branch.password || "-",
      Logo: branch.logo || "-",
      Location: branch.location || "-",
      Address: branch.address || "-",
      City: branch.city || "-",
      Pincode: branch.pincode || "-",
      Phone: branch.phone || "-",
      Email: branch.email || "-",
      Status: branch.status ? "true" : "false",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Branches");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const dataBlob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(dataBlob, "branches.xlsx");
  };

  // 📥 Import branches from .xlsx file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      const importedBranches = jsonData.map((row: any) => ({
        branchcode: row.BranchCode || "",
        branchname: row.BranchName || "",
        mobile: row.Mobile || "",
        password: row.Password || "",
        logo: row.Logo || "",
        location: row.Location || "",
        address: row.Address || "",
        city: row.City || "",
        pincode: row.Pincode || "",
        phone: row.Phone || "",
        email: row.Email || "",
        status: row.Status === "true" || row.Status === "1" || row.Status === true,
      }));

    };
    reader.readAsArrayBuffer(file);
    e.target.value = ""; // reset input
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        {/* Hidden file input for .xlsx import */}
        <input
          type="file"
          accept=".xlsx"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

        <DataTable
          title="Manage Branches"
          columns={columns}
          data={tableData}
          showView={false}
          showEdit={true}
          showDelete={true}
          showImport={false}
          showExport={false}
          showAdd={true}
          onView={() => console.log("View button clicked")}
          onEdit={(row) => navigate(`/branches/addedit/${row.id}`)}
          onDelete={async (row) => {
            if (window.confirm(`Are you sure you want to delete branch "${row.branchname}"?`)) {
              try {
                await deleteBranchMutation({ variables: { id: row.id } });
                await refetch();
                // ✅ Show success message
                dispatch(showMessage({ message: 'Branch deleted successfully.', type: 'success' }));
              } catch (error) {
                console.error("Delete error:", error);
                // ✅ Show error message
                dispatch(showMessage({ message: 'Failed to delete branch.', type: 'error' }));
              }
            }
          }}
          onImport={handleImportClick}
          onExport={handleExport}
          onAdd={() => navigate("/branches/addedit")}
          onShowDeleted={() =>navigate("/branches/deletedentries")}
          entriesOptions={[5, 10, 25, 50]}
          defaultEntriesPerPage={10}
          isLoading={isLoading}
        />
      </div>
    </HomeLayout>
  );
};

export default Branches;
