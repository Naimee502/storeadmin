import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { addAccounts } from "../../redux/slices/accounts";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import {
  useAccountsQuery,
  useAccountMutations,
  usePartyOutstandingSummaryQuery,
} from "../../graphql/hooks/accounts";
import { hideLoading, showLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import { useAccountLedgersQuery } from "../../graphql/hooks/accountledgers";
import { selectModuleActions, selectIsModuleBusinessEnabled } from "../../redux/slices/permissions";
import { formatINR, toTitleCase } from "../../utils/helper";

const Accounts = () => {
  const actions = useAppSelector(state => selectModuleActions(state, "accounts"));
  /**
   * City and Outstanding are on the grid for everyone — where a party is and
   * what they owe are worth seeing on every setup. Channel is the only
   * conditional column: without the module it would read "-" on every row, so
   * it is dropped rather than shown empty.
   */
  const channelsEnabled = useAppSelector(state => selectIsModuleBusinessEnabled(state, "channels"));
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data, refetch } = useAccountsQuery();
  const { data: ledgerData } = useAccountLedgersQuery();
  const { outstandingById } = usePartyOutstandingSummaryQuery();
  const { deleteAccountMutation, approveAccountMutation } = useAccountMutations();
  const accountList = data?.getAccounts || [];
  console.log("Fetched Accounts:", JSON.stringify(accountList));
  const ledgerList = ledgerData?.getAccountLedgers || [];
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  useEffect(() => {
    const fetchAndDispatch = async () => {
      dispatch(showLoading());
      try {
        const { data } = await refetch();
        if (data?.getAccounts) {
          dispatch(addAccounts(data.getAccounts));
        }
      } catch (error) {
        console.error("Error fetching accounts:", error);
      } finally {
        dispatch(hideLoading());
      }
    };
    fetchAndDispatch();
  }, [dispatch, refetch]);

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Account Code", key: "accountcode" },
    { label: "Name", key: "name" },
    { label: "Mobile", key: "mobile" },
    { label: "Account Ledger", key: "ledgername" },
    { label: "Type", key: "type" },
    // Channel (End User / Retailer / Wholesaler) only when the module is on.
    ...(channelsEnabled ? [{ label: "Channel", key: "channelname" }] : []),
    { label: "City", key: "city" },
    { label: "Outstanding", key: "outstandingLabel" },
    { label: "Status", key: "status" },
  ];

  const tableData = [...accountList].reverse().map((acc, index) => {
    const ledgerName =
    typeof acc.ledgerid === "string"
      ? "-" // string — not populated
      : acc.ledgerid?.ledgername || "-"; // populated object

    return {
      ...acc,
      seqNo: index + 1,
      ledgername: ledgerName,
      type: acc.type ? acc.type.charAt(0).toUpperCase() + acc.type.slice(1) : "-", // ✅ Format nicely
      channelname:
        typeof acc.channel === "object" && acc.channel
          ? acc.channel.channelName || "-"
          : "-",
      // Masters are often typed in ALL CAPS; the column reads better cased.
      city: acc.city ? toTitleCase(acc.city) : "-",
      // Same basis as the payment screen and the party report: opening still
      // due + open bills − advances held. Blank until the figures land so the
      // column never flashes a wrong ₹0.00.
      outstandingLabel:
        outstandingById[acc.id] != null ? formatINR(outstandingById[acc.id]) : "-",
      status: acc.approvalstatus === "pending"
        ? "Pending"
        : (acc.status ? "Active" : "Inactive"),
    };
  });

  const handleExport = () => {
    const exportData = [...accountList].reverse().map((acc: any, index: number) => {

      const ledgerId =
        typeof acc.ledgerid === "string"
          ? acc.ledgerid
          : acc.ledgerid?.id || acc.ledgerid?._id;

      const ledger = ledgerList.find((l) => l.id === ledgerId);

      return {
        ID: index + 1,
        AccountCode: acc.accountcode || "-",
        Name: acc.name || "-",
        Mobile: acc.mobile || "-",
        Email: acc.email || "-",
        Ledger: ledger ? ledger.ledgername : "-",
        // The export mirrors the grid's one conditional column. Email stays in
        // the export even though the grid no longer prints it — a spreadsheet
        // of parties is exactly where you want the address.
        ...(channelsEnabled
          ? { Channel: typeof acc.channel === "object" && acc.channel ? acc.channel.channelName || "-" : "-" }
          : {}),
        City: acc.city ? toTitleCase(acc.city) : "-",
        Outstanding: outstandingById[acc.id] ?? 0,
        Status: acc.status ? "true" : "false",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Accounts");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const dataBlob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(dataBlob, "accounts.xlsx");
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
      const importedAccounts = jsonData.map((row: any) => ({
        accountcode: row.AccountCode || "",
        name: row.Name || "",
        mobile: row.Mobile || "",
        email: row.Email || "",
        status: row.Status === "true" || row.Status === "1" || row.Status === true,
      }));
      console.log("Imported Accounts:", importedAccounts);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleImportClick = () => fileInputRef.current?.click();

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

        <DataTable requireBranchForAdd={true}
          title="Manage Party Accounts"
          columns={columns}
          data={tableData}
          {...actions}
          showView={false}
          onEdit={(row) => navigate(`/accounts/addedit/${row.id}`)}
          onDelete={async (row) => {
            if (window.confirm(`Are you sure you want to delete account "${row.name}"?`)) {
              try {
                await deleteAccountMutation({ variables: { id: row.id } });
                await refetch();
                dispatch(showMessage({ message: "Account deleted successfully.", type: "success" }));
              } catch (error) {
                dispatch(showMessage({ message: "Failed to delete account.", type: "error" }));
              }
            }
          }}
          showConfirm={(row: any) => row.approvalstatus === "pending"}
          confirmTitle="Approve — let this customer sign in"
          onConfirm={async (row: any) => {
            if (!window.confirm(`Approve "${row.name}"? They will be able to sign in to the app and website.`)) return;
            try {
              await approveAccountMutation({ variables: { id: row.id } });
              await refetch();
              dispatch(showMessage({ message: `${row.name} approved — they can sign in now.`, type: "success" }));
            } catch (e: any) {
              dispatch(showMessage({ message: e?.message || "Failed to approve account.", type: "error" }));
            }
          }}
          onImport={handleImportClick}
          onExport={handleExport}
          onAdd={() => navigate("/accounts/addedit")}
          onShowDeleted={() => navigate("/accounts/deletedentries")}
          entriesOptions={[5, 10, 25, 50]}
          defaultEntriesPerPage={10}
          isLoading={isLoading}
        />
      </div>
    </HomeLayout>
  );
};

export default Accounts;
