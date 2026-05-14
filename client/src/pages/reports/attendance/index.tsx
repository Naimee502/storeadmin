// Attendance & Leave Reports
//
// Three tabs:
//   - Daily Logs    → flatten getAttendanceLogs into a per-day per-staff list
//   - Punch Trail   → per-punch list (audit / discrepancy investigations)
//   - Leave Summary → per-staff allocation/used/pending/balance from
//                     getLeaveBalances (already aggregated server-side)
//
// We deliberately reuse the existing attendance module's queries instead
// of building a parallel reporting endpoint — same data, just shaped for
// the ReportTable component (date-range filters + tabs + export).

import React, { useEffect, useMemo, useState } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { useQuery } from "@apollo/client";
import {
  GET_ATTENDANCE_LOGS,
  GET_ATTENDANCE_PUNCHES,
  GET_LEAVE_BALANCES,
} from "../../../graphql/queries/attendance";
import { useAppSelector } from "../../../redux/hooks";
import { applyDateShortcut, normalizeToYMD } from "../../../utils/helper";

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
};

const minutesToHm = (m?: number | null) => {
  if (!m) return "0h 0m";
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

const cap = (s?: string | null) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "-";

const AttendanceReports: React.FC = () => {
  const reportTabs = ["Daily Logs", "Punch Trail", "Leave Summary"];
  const [activeTab, setActiveTab] = useState<string>(reportTabs[0]);
  const [filters, setFilters] = useState<{ [key: string]: any }>({});
  const [appliedFilters, setAppliedFilters] = useState<{ [key: string]: any }>({});

  // Resolve scope from auth — same pattern as the operational pages.
  const { type, admin, branch, staff } = useAppSelector((s: any) => s.auth);
  const adminId =
    type === "admin"
      ? admin?.id
      : type === "branch"
        ? branch?.admin?.id
        : type === "staff"
          ? staff?.admin?.id
          : undefined;
  const selectedBranchId = useAppSelector((s: any) => s.selectedBranch?.branchId);
  const branchId =
    type === "branch"
      ? branch?.id
      : type === "staff"
        ? staff?.branchid?.id
        : selectedBranchId;

  // Default range = last 30 days
  useEffect(() => {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30)
      .toISOString()
      .slice(0, 10);
    setFilters({ from, to });
    setAppliedFilters({ from, to });
  }, []);

  const filterDef: ReportFilterField[] = [
    { name: "from", label: "From", type: "date" },
    { name: "to", label: "To", type: "date" },
  ];

  /* ============================ DATA ============================ */
  const logsQ = useQuery(GET_ATTENDANCE_LOGS, {
    variables: {
      filter: {
        adminid: adminId,
        branchid: branchId,
        dateFrom: appliedFilters.from,
        dateTo: appliedFilters.to,
      },
    },
    skip: !adminId,
  });

  const punchesQ = useQuery(GET_ATTENDANCE_PUNCHES, {
    variables: {
      filter: {
        adminid: adminId,
        branchid: branchId,
        dateFrom: appliedFilters.from,
        dateTo: appliedFilters.to,
      },
    },
    skip: !adminId || activeTab !== "Punch Trail",
  });

  const balancesQ = useQuery(GET_LEAVE_BALANCES, {
    variables: { filter: { adminid: adminId } },
    skip: !adminId || activeTab !== "Leave Summary",
  });

  /* ============================ ROWS ============================ */
  const dailyRows = useMemo(
    () =>
      (logsQ.data?.getAttendanceLogs ?? []).map((l: any, i: number) => ({
        seq: i + 1,
        date: l.date,
        staff: l.staffid?.name ?? "-",
        code: l.staffid?.staffcode ?? "-",
        status: cap(l.status),
        firstIn: fmtDateTime(l.firstPunchIn),
        lastOut: fmtDateTime(l.lastPunchOut),
        work: minutesToHm(l.totalWorkMinutes),
        late: l.isLate ? `${l.lateByMinutes ?? 0}m` : "-",
        ot: minutesToHm(l.overtimeMinutes),
      })),
    [logsQ.data]
  );

  const punchRows = useMemo(
    () =>
      (punchesQ.data?.getAttendancePunches ?? []).map((p: any, i: number) => ({
        seq: i + 1,
        type: cap(p.type),
        when: fmtDateTime(p.timestamp),
        source: cap(p.source),
        address: p.address ?? "-",
        remarks: p.remarks ?? "-",
      })),
    [punchesQ.data]
  );

  const balanceRows = useMemo(
    () =>
      (balancesQ.data?.getLeaveBalances ?? []).map((b: any, i: number) => ({
        seq: i + 1,
        staff: b.staffid?.name ?? "-",
        code: b.staffid?.staffcode ?? "-",
        type: b.leavetypeid?.name ?? "-",
        year: b.year,
        allocated: b.allocated,
        used: b.used,
        pending: b.pending,
        carried: b.carriedForward,
        balance: b.balance,
      })),
    [balancesQ.data]
  );

  /* ============================ COLUMNS ========================= */
  const dailyColumns = [
    { label: "Seq", key: "seq" },
    { label: "Date", key: "date" },
    { label: "Staff", key: "staff" },
    { label: "Code", key: "code" },
    { label: "Status", key: "status" },
    { label: "First In", key: "firstIn" },
    { label: "Last Out", key: "lastOut" },
    { label: "Work", key: "work" },
    { label: "Late", key: "late" },
    { label: "OT", key: "ot" },
  ];

  const punchColumns = [
    { label: "Seq", key: "seq" },
    { label: "Type", key: "type" },
    { label: "When", key: "when" },
    { label: "Source", key: "source" },
    { label: "Address", key: "address" },
    { label: "Remarks", key: "remarks" },
  ];

  const balanceColumns = [
    { label: "Seq", key: "seq" },
    { label: "Staff", key: "staff" },
    { label: "Code", key: "code" },
    { label: "Type", key: "type" },
    { label: "Year", key: "year" },
    { label: "Allocated", key: "allocated" },
    { label: "Used", key: "used" },
    { label: "Pending", key: "pending" },
    { label: "C/F", key: "carried" },
    { label: "Balance", key: "balance" },
  ];

  const tabConfig: Record<string, { columns: any[]; rows: any[]; title: string }> = {
    "Daily Logs": { columns: dailyColumns, rows: dailyRows, title: "Daily Attendance Logs" },
    "Punch Trail": { columns: punchColumns, rows: punchRows, title: "Punch Trail" },
    "Leave Summary": { columns: balanceColumns, rows: balanceRows, title: "Leave Balance Summary" },
  };

  const { columns, rows, title } = tabConfig[activeTab];

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <h1 className="text-2xl font-semibold mb-4">Attendance & Leave Reports</h1>
        <ReportTable
          title={title}
          tabs={reportTabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          columns={columns}
          data={rows}
          filters={filterDef}
          filterValues={filters}
          onFilterChange={(name, value) =>
            setFilters((prev) => ({ ...prev, [name]: value }))
          }
          onApplyFilters={() => {
            const normalized: any = { ...filters };
            if (normalized.from) normalized.from = normalizeToYMD(normalized.from);
            if (normalized.to) normalized.to = normalizeToYMD(normalized.to);
            setAppliedFilters(normalized);
          }}
          onResetFilters={() => {
            const today = new Date();
            const to = today.toISOString().slice(0, 10);
            const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30)
              .toISOString()
              .slice(0, 10);
            setFilters({ from, to });
            setAppliedFilters({ from, to });
          }}
          dateShortcuts={(key) => applyDateShortcut(key, setFilters, setAppliedFilters)}
        />
      </div>
    </HomeLayout>
  );
};

export default AttendanceReports;
