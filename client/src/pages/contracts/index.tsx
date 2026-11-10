import { useState } from "react";
import { useNavigate } from "react-router";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import { showMessage } from "../../redux/slices/message";
import { useServerPaging, useServerTable } from "../../hooks/useservertable";
import { useOfflineList } from "../../offline/listing";
import { CONTRACT_TYPE, addDaysYMD, customerLabel, useContractsPageQuery, useContractsQuery, useServiceMutations } from "../../graphql/hooks/service";
import { formatDateDMY, todayYMD } from "../../utils/helper";

const SERVER_FILTER_KEYS = ["partyacc", "title", "contractType", "startdate", "enddate", "amount"];
const money = (n: any) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const RENEW_DAYS = 30;

/** Active, Expiring (within 30 days), Expired or Cancelled. */
export const contractState = (c: any, today = todayYMD()) => {
  if (c.contractStatus === "cancelled") return "Cancelled";
  if (c.enddate < today) return "Expired";
  if (c.enddate <= addDaysYMD(today, RENEW_DAYS)) return "Expiring";
  return "Active";
};
const STATE_CLS: Record<string, string> = { Active: "text-emerald-700", Expiring: "text-amber-600 font-semibold", Expired: "text-rose-600 font-semibold", Cancelled: "text-slate-400" };

const Contracts = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, "contracts"));
  const [tab, setTab] = useState<"all" | "due">("all");
  const table = useServerTable("contracts", SERVER_FILTER_KEYS);
  const { items, total, loading, refetch } = useContractsPageQuery(table.variables);
  const serverPaging = useServerPaging(table, total, loading);
  const offline = useOfflineList("contract", table.page);
  const { data: allData, loading: dueLoading } = useContractsQuery({}, tab !== "due");
  const { deleteContract } = useServiceMutations();

  const columns = [
    { label: "Seq", key: "seqNo" },
    { label: "Customer", key: "partyacc" },
    { label: "Title", key: "title" },
    { label: "Type", key: "contractType" },
    { label: "Start", key: "startdate" },
    { label: "End", key: "enddate" },
    { label: "Visits", key: "visits" },
    { label: "Amount", key: "amount" },
    { label: "State", key: "state" },
  ];
  const buildRow = (c: any, i: number) => {
    const st = contractState(c);
    return {
      id: c.id,
      seqNo: i >= 0 ? (tab === "all" ? table.offset : 0) + i + 1 : "",
      partyacc: customerLabel(c),
      title: c.title || (c.items || []).map((x: any) => x.productserviceid?.name || x.serial).filter(Boolean).join(", ") || "—",
      contractType: CONTRACT_TYPE[c.contractType] || "AMC",
      startdate: formatDateDMY(c.startdate),
      enddate: formatDateDMY(c.enddate),
      visits: c.visitsallowed ? `${c.visitsdone || 0} / ${c.visitsallowed}` : "—",
      amount: c.amount ? `₹${money(c.amount)}` : "—",
      state: <span className={STATE_CLS[st]}>{st}</span>,
      raw: c,
    };
  };
  const due = (allData?.getContracts || []).filter((c: any) => ["Expiring", "Expired"].includes(contractState(c))).sort((a: any, b: any) => String(a.enddate).localeCompare(String(b.enddate)));
  const serverRows = items.map((c: any, i: number) => offline.decorate(buildRow(c, i), "seqNo"));
  const rows = tab === "due"
    ? due.map(buildRow)
    : offline.rows.length ? [...offline.rows.map((c: any) => offline.decorate(buildRow(c, -1), "seqNo")), ...serverRows] : serverRows;

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6 space-y-3">
        <div className="inline-flex h-8 overflow-hidden rounded-md border border-slate-300 text-[13px]">
          {([["all", "All Contracts"], ["due", "Due for Renewal"]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`px-3 ${tab === k ? "bg-indigo-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}>{label}</button>
          ))}
        </div>
        <DataTable
          key={tab}
          title={tab === "due" ? "AMC / Warranty Due for Renewal" : "AMC / Warranty"}
          columns={columns}
          data={rows}
          serverPaging={tab === "all" ? serverPaging : undefined}
          showAdd={actions.showAdd}
          showEdit={actions.showEdit}
          showDelete={actions.showDelete}
          showDeleted={actions.showDelete || actions.canReset}
          showView={false}
          showImport={false}
          showExport={false}
          onAdd={() => navigate("/contracts/addedit")}
          onEdit={(row) => navigate(`/contracts/addedit/${row.id}`)}
          onDelete={async (row) => {
            if (!window.confirm(`Delete the contract of ${row.customer}?`)) return;
            try {
              await deleteContract({ variables: { id: row.id, expectedUpdatedAt: row.raw?.updatedAt } });
              await refetch();
              dispatch(showMessage({ message: "Contract deleted.", type: "success" }));
            } catch (e: any) {
              dispatch(showMessage({ message: e?.message || "Failed to delete.", type: "error" }));
            }
          }}
          onShowDeleted={() => navigate("/contracts/deletedentries")}
          isLoading={tab === "due" ? dueLoading : loading}
        />
      </div>
    </HomeLayout>
  );
};

export default Contracts;
