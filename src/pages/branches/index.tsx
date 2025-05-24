import React, { useRef } from "react";
import { useNavigate } from "react-router";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { deleteBranch, addBranches } from "../../redux/slices/branches";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";

const Branches = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const branchList = useAppSelector((state) => state.branches.branches);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const tableData = branchList.map((branch, index) => ({
    ...branch,
    seqNo: index + 1,
    name: branch.branchname,
    status: branch.status ? "Active" : "Inactive",
  }));

  // 📤 Export branches to .xlsx file
  const handleExport = () => {
    const exportData = branchList.map((branch, index) => ({
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

      dispatch(addBranches(importedBranches));
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
          title="Branch List"
          columns={columns}
          data={tableData}
          showView={true}
          showEdit={true}
          showDelete={true}
          showImport={true}
          showExport={true}
          showAdd={true}
          onView={() => console.log("View button clicked")}
          onEdit={(row) => navigate(`/branches/addedit/${row.id}`)}
          onDelete={(row) => {
            if (window.confirm(`Are you sure you want to delete branch ${row.branchname}?`)) {
              dispatch(deleteBranch(row.id));
            }
          }}
          onImport={handleImportClick}
          onExport={handleExport}
          onAdd={() => navigate("/branches/addedit")}
          entriesOptions={[5, 10, 25, 50]}
          defaultEntriesPerPage={10}
        />
      </div>
    </HomeLayout>
  );
};

export default Branches;
