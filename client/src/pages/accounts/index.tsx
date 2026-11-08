import React, { useRef, useState } from "react";
import { useApolloClient } from "@apollo/client";
import { useNavigate } from "react-router";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import {
  useAccountsPageQuery,
  useAccountMutations,
  usePartyOutstandingSummaryQuery,
} from "../../graphql/hooks/accounts";
import { GET_ACCOUNTS_LIST } from "../../graphql/queries/accounts";
import { showMessage } from "../../redux/slices/message";
import { selectModuleActions, selectIsModuleBusinessEnabled } from "../../redux/slices/permissions";
import { formatINR, toTitleCase } from "../../utils/helper";
import { useServerTable, useServerPaging } from "../../hooks/useservertable";

// Columns the server can filter (Outstanding comes from another query, Seq Number is per page).
const SERVER_FILTER_KEYS = ["accountcode", "name", "mobile", "ledgername", "type", "channelname", "parentname", "city", "status"];

const Accounts = () => {
  const actions = useAppSelector(state => selectModuleActions(state, "accounts"));
  /** City and Outstanding always; Channel only with the channels module. */
  const channelsEnabled = useAppSelector(state => selectIsModuleBusinessEnabled(state, "channels"));
  // Parent party (party under party) — only meaningful with downline on.
  const manageDownline = useAppSelector((s: any) => !!s.adminsettings?.settings?.partyManagesDownline);
  // "Company sees direct-party orders only": list opens on direct parties.
  const directOnlyOn = useAppSelector((s: any) => !!s.adminsettings?.settings?.directPartyOrdersOnly) && manageDownline;
  const [showSubParties, setShowSubParties] = useState(false);
  // Parent Party column only when sub-parties are listed.
  const showParentColumn = manageDownline && (!directOnlyOn || showSubParties);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // One page from the server; direct-only is applied there when sub-parties are hidden.
  const table = useServerTable("accounts", SERVER_FILTER_KEYS);
  const {
    items: visibleAccounts,
    total,
    subPartyCount,
    loading,
    refetch,
    listVariables,
  } = useAccountsPageQuery({ ...table.variables, directPartiesOnly: directOnlyOn && !showSubParties });
  const serverPaging = useServerPaging(table, total, loading);
  const apolloClient = useApolloClient();
  const { outstandingById } = usePartyOutstandingSummaryQuery();
  const { deleteAccountMutation, approveAccountMutation } = useAccountMutations();
  const isLoading = useAppSelector((state) => state.loader.isLoading);

  const columns = [
    { label: "Seq Number", key: "seqNo" },
    { label: "Account Code", key: "accountcode" },
    { label: "Name", key: "name" },
    { label: "Mobile", key: "mobile" },
    { label: "Account Ledger", key: "ledgername" },
    { label: "Type", key: "type" },
    // Channel (End User / Retailer / Wholesaler) only when the module is on.
    ...(channelsEnabled ? [{ label: "Channel", key: "channelname" }] : []),
    ...(showParentColumn ? [{ label: "Parent Party", key: "parentname" }] : []),
    { label: "City", key: "city" },
    { label: "Outstanding", key: "outstandingLabel" },
    { label: "Status", key: "status" },
  ];

  const tableData = visibleAccounts.map((acc: any, index: number) => {
    const ledgerName =
    typeof acc.ledgerid === "string"
      ? "-" // string — not populated
      : acc.ledgerid?.ledgername || "-"; // populated object

    return {
      ...acc,
      seqNo: table.offset + index + 1,
      ledgername: ledgerName,
      type: acc.type ? acc.type.charAt(0).toUpperCase() + acc.type.slice(1) : "-", // ✅ Format nicely
      channelname:
        typeof acc.channel === "object" && acc.channel
          ? acc.channel.channelName || "-"
          : "-",
      parentname: acc.assignaccountid?.name || "-",
      // Masters are often typed in ALL CAPS; the column reads better cased.
      city: acc.city ? toTitleCase(acc.city) : "-",
      // Outstanding = opening due + open bills - advances; blank until loaded.
      outstandingLabel:
        outstandingById[acc.id] != null ? formatINR(outstandingById[acc.id]) : "-",
      status: acc.approvalstatus === "pending"
        ? "Pending"
        : (acc.status ? "Active" : "Inactive"),
    };
  });

  // Export still writes every party: the full list is fetched on click.
  const handleExport = async () => {
    let accountList: any[];
    try {
      const { data: full } = await apolloClient.query({
        query: GET_ACCOUNTS_LIST,
        variables: listVariables,
        fetchPolicy: "network-only",
      });
      accountList = full?.getAccounts || [];
    } catch (error: any) {
      dispatch(showMessage({ message: error?.message || "Failed to export accounts.", type: "error" }));
      return;
    }
    const exportData = [...accountList].reverse().map((acc: any, index: number) => {
      // ledgerid comes populated, so no separate ledger list is needed.
      const ledgerName =
        typeof acc.ledgerid === "object" && acc.ledgerid ? acc.ledgerid.ledgername : "";

      return {
        ID: index + 1,
        AccountCode: acc.accountcode || "-",
        Name: acc.name || "-",
        Mobile: acc.mobile || "-",
        Email: acc.email || "-",
        Ledger: ledgerName || "-",
        // Export mirrors the grid's columns, plus Email.
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
          onView={(row) => navigate(`/accounts/view/${row.id}`)}
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
          toolbarActions={directOnlyOn && subPartyCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowSubParties((v) => !v)}
              className={`inline-flex h-8 items-center rounded-md border px-3 text-[13px] font-medium ${showSubParties ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              {showSubParties ? "Hide sub-parties" : `Show sub-parties (${subPartyCount})`}
            </button>
          ) : undefined}
          onAdd={() => navigate("/accounts/addedit")}
          onShowDeleted={() => navigate("/accounts/deletedentries")}
          entriesOptions={[5, 10, 25, 50]}
          defaultEntriesPerPage={10}
          serverPaging={serverPaging}
          isLoading={loading || isLoading}
        />
      </div>
    </HomeLayout>
  );
};

export default Accounts;
