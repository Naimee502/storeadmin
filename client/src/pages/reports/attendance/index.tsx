// Attendance & Leave Reports
//
// Tabs:
//   - Daily Logs     → per-day attendance per staff
//   - Punch Trail    → individual punch records
//   - Leave Summary  → leave balances per staff

import React, { useEffect, useMemo, useState } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportFilterField } from "../../../components/reporttable";
import { useQuery } from "@apollo/client";
import {
  GET_ATTENDANCE_LOGS,
  GET_ATTENDANCE_PUNCHES,
  GET_LEAVE_BALANCES,
  GET_LEAVE_REQUESTS,
} from "../../../graphql/queries/attendance";
import { useAppSelector } from "../../../redux/hooks";
import { normalizeToYMD, formatDateDMY, formatDateTimeDMY } from "../../../utils/helper";
import { FaCalendarDay, FaUserClock, FaCalendarCheck, FaUserTimes } from "react-icons/fa";

const reportTabsObj = [
  { id: "Daily Logs", label: "Daily Logs", icon: <FaCalendarDay className="text-blue-600" /> },
  { id: "Punch Trail", label: "Punch Trail", icon: <FaUserClock className="text-amber-600" /> },
  { id: "Leave Summary", label: "Leave Summary", icon: <FaCalendarCheck className="text-emerald-600" /> },
  { id: "Leave Requests", label: "Leave Requests", icon: <FaUserTimes className="text-rose-600" /> },
];

/* ── Helpers ── */
const fmtDateTime = (iso?: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return formatDateTimeDMY(d); // DD-MM-YYYY hh:mm AM/PM
};

const minutesToHm = (m?: number | null) => {
  if (!m) return "0h 0m";
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

const cap = (s?: string | null) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "-";

/* ── Component ── */
const AttendanceReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>(reportTabsObj[0].id);
  const [filters, setFilters] = useState<{ [key: string]: any }>({});
  const [appliedFilters, setAppliedFilters] = useState<{ [key: string]: any }>({});

  // Resolve scope from auth
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
      .toISOString().slice(0, 10);
    setFilters({ fromDate: from, toDate: to });
    setAppliedFilters({ fromDate: from, toDate: to });
  }, []);

  /* ── Queries ── */
  const logsQ = useQuery(GET_ATTENDANCE_LOGS, {
    variables: {
      filter: {
        adminid: adminId,
        branchid: branchId,
        dateFrom: appliedFilters.fromDate,
        dateTo: appliedFilters.toDate,
      },
    },
    skip: !adminId || (activeTab !== "Daily Logs"),
  });

  const punchesQ = useQuery(GET_ATTENDANCE_PUNCHES, {
    variables: {
      filter: {
        adminid: adminId,
        branchid: branchId,
        dateFrom: appliedFilters.fromDate,
        dateTo: appliedFilters.toDate,
      },
    },
    skip: !adminId || activeTab !== "Punch Trail",
  });

  const balancesQ = useQuery(GET_LEAVE_BALANCES, {
    variables: { filter: { adminid: adminId } },
    skip: !adminId || activeTab !== "Leave Summary",
  });

  const leaveReqQ = useQuery(GET_LEAVE_REQUESTS, {
    variables: {
      filter: {
        adminid: adminId,
        branchid: branchId,
      },
    },
    skip: !adminId || activeTab !== "Leave Requests",
  });

  /* ── Row builders ── */
  const dailyRows = useMemo(() => {
    const rows = logsQ.data?.getAttendanceLogs ?? [];
    return rows
      .filter((l: any) => {
        const d = l.date;
        if (appliedFilters.fromDate && d < appliedFilters.fromDate) return false;
        if (appliedFilters.toDate && d > appliedFilters.toDate) return false;
        if (appliedFilters.staffName && !(l.staffid?.name ?? "").toLowerCase().includes(appliedFilters.staffName.toLowerCase())) return false;
        if (appliedFilters.status && cap(l.status) !== appliedFilters.status) return false;
        return true;
      })
      .map((l: any, i: number) => ({
        seq: i + 1,
        date: formatDateDMY(l.date),
        staff: l.staffid?.name ?? "-",
        code: l.staffid?.staffcode ?? "-",
        status: cap(l.status),
        firstIn: fmtDateTime(l.firstPunchIn),
        lastOut: fmtDateTime(l.lastPunchOut),
        workHours: minutesToHm(l.totalWorkMinutes),
        breakHours: minutesToHm(l.totalBreakMinutes),
        late: l.isLate ? `${l.lateByMinutes ?? 0} min` : "-",
        overtime: minutesToHm(l.overtimeMinutes),
        notes: l.notes ?? "-",
      }));
  }, [logsQ.data, appliedFilters]);

  const punchRows = useMemo(() => {
    return (punchesQ.data?.getAttendancePunches ?? []).map((p: any, i: number) => ({
      seq: i + 1,
      type: cap(p.type),
      when: fmtDateTime(p.timestamp),
      source: cap(p.source),
      address: p.address ?? "-",
      remarks: p.remarks ?? "-",
    }));
  }, [punchesQ.data]);

  const balanceRows = useMemo(() => {
    return [...(balancesQ.data?.getLeaveBalances ?? [])].reverse()
      .filter((b: any) => {
        if (appliedFilters.leaveYear && String(b.year) !== String(appliedFilters.leaveYear)) return false;
        return true;
      })
      .map((b: any, i: number) => ({
        seq: i + 1,
        staff: b.staffid?.name ?? "-",
        code: b.staffid?.staffcode ?? "-",
        leaveType: b.leavetypeid?.name ?? "-",
        year: b.year,
        allocated: b.allocated,
        used: b.used,
        pending: b.pending,
        carriedForward: b.carriedForward,
        balance: b.balance,
      }));
  }, [balancesQ.data, appliedFilters]);

  const leaveReqRows = useMemo(() => {
    return (leaveReqQ.data?.getLeaveRequests ?? [])
      .filter((r: any) => {
        const from = r.fromDate ? normalizeToYMD(r.fromDate) : null;
        if (appliedFilters.fromDate && from && from < appliedFilters.fromDate) return false;
        if (appliedFilters.toDate && from && from > appliedFilters.toDate) return false;
        if (appliedFilters.leaveStatus && cap(r.status) !== appliedFilters.leaveStatus) return false;
        return true;
      })
      .map((r: any, i: number) => ({
        seq: i + 1,
        staff: r.staffid?.name ?? "-",
        code: r.staffid?.staffcode ?? "-",
        leaveType: r.leavetypeid?.name ?? "-",
        fromDate: r.fromDate ? formatDateDMY(r.fromDate) : "-",
        toDate: r.toDate ? formatDateDMY(r.toDate) : "-",
        totalDays: r.totalDays,
        halfDay: r.halfDay ? "Yes" : "No",
        reason: r.reason ?? "-",
        status: cap(r.status),
        approvedBy: r.approvedByName ?? "-",
      }));
  }, [leaveReqQ.data, appliedFilters]);

  /* ── Per-tab config ── */
  type TabConfig = { columns: any[]; rows: any[]; filterFields: ReportFilterField[]; title: string; exportFileName: string };

  const statusOptions = [
    { label: "Present", value: "Present" },
    { label: "Absent", value: "Absent" },
    { label: "Half Day", value: "Half day" },
    { label: "Leave", value: "Leave" },
    { label: "Holiday", value: "Holiday" },
    { label: "Week Off", value: "Week off" },
  ];

  const leaveStatusOptions = [
    { label: "Pending", value: "Pending" },
    { label: "Approved", value: "Approved" },
    { label: "Rejected", value: "Rejected" },
  ];

  const tabConfigs: Record<string, TabConfig> = {
    "Daily Logs": {
      title: "Daily Attendance Logs",
      exportFileName: "AttendanceDailyLogs",
      filterFields: [
        { name: "fromDate", label: "From Date", type: "date" },
        { name: "toDate", label: "To Date", type: "date" },
        { name: "status", label: "Status", type: "select", options: statusOptions },
      ],
      columns: [
        { label: "Seq", key: "seq" },
        { label: "Date", key: "date" },
        { label: "Staff", key: "staff" },
        { label: "Staff Code", key: "code" },
        { label: "Status", key: "status" },
        { label: "First In", key: "firstIn" },
        { label: "Last Out", key: "lastOut" },
        { label: "Work Hours", key: "workHours" },
        { label: "Break Hours", key: "breakHours" },
        { label: "Late By", key: "late" },
        { label: "Overtime", key: "overtime" },
        { label: "Notes", key: "notes" },
      ],
      rows: dailyRows,
    },
    "Punch Trail": {
      title: "Punch Trail",
      exportFileName: "AttendancePunchTrail",
      filterFields: [
        { name: "fromDate", label: "From Date", type: "date" },
        { name: "toDate", label: "To Date", type: "date" },
      ],
      columns: [
        { label: "Seq", key: "seq" },
        { label: "Type", key: "type" },
        { label: "Date & Time", key: "when" },
        { label: "Source", key: "source" },
        { label: "Address", key: "address" },
        { label: "Remarks", key: "remarks" },
      ],
      rows: punchRows,
    },
    "Leave Summary": {
      title: "Leave Balance Summary",
      exportFileName: "LeaveBalanceSummary",
      filterFields: [
        {
          name: "leaveYear",
          label: "Year",
          type: "select",
          options: Array.from({ length: 5 }, (_, i) => {
            const y = new Date().getFullYear() - i;
            return { label: String(y), value: String(y) };
          }),
        },
      ],
      columns: [
        { label: "Seq", key: "seq" },
        { label: "Staff", key: "staff" },
        { label: "Staff Code", key: "code" },
        { label: "Leave Type", key: "leaveType" },
        { label: "Year", key: "year" },
        { label: "Allocated", key: "allocated", numeric: true },
        { label: "Used", key: "used", numeric: true },
        { label: "Pending", key: "pending", numeric: true },
        { label: "Carried Fwd", key: "carriedForward", numeric: true },
        { label: "Balance", key: "balance", numeric: true },
      ],
      rows: balanceRows,
    },
    "Leave Requests": {
      title: "Leave Requests",
      exportFileName: "LeaveRequests",
      filterFields: [
        { name: "fromDate", label: "From Date", type: "date" },
        { name: "toDate", label: "To Date", type: "date" },
        { name: "leaveStatus", label: "Status", type: "select", options: leaveStatusOptions },
      ],
      columns: [
        { label: "Seq", key: "seq" },
        { label: "Staff", key: "staff" },
        { label: "Staff Code", key: "code" },
        { label: "Leave Type", key: "leaveType" },
        { label: "From Date", key: "fromDate" },
        { label: "To Date", key: "toDate" },
        { label: "Days", key: "totalDays", numeric: true },
        { label: "Half Day", key: "halfDay" },
        { label: "Reason", key: "reason" },
        { label: "Status", key: "status" },
        { label: "Approved By", key: "approvedBy" },
      ],
      rows: leaveReqRows,
    },
  };

  const { columns, rows, filterFields, title, exportFileName } =
    tabConfigs[activeTab] ?? tabConfigs["Daily Logs"];

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6 font-sans">
        <div className="flex flex-wrap gap-2 mb-4">
          {reportTabsObj.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  isActive
                    ? "!bg-slate-900 !text-white shadow-sm border border-slate-900"
                    : "bg-white text-gray-700 hover:text-black hover:bg-gray-100 border border-gray-200"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        <ReportTable moduleId="reports.attendance"
          title={title}
          columns={columns}
          data={rows}
          filterFields={filterFields}
          filters={filters}
          setFilters={setFilters}
          appliedFilters={appliedFilters}
          setAppliedFilters={setAppliedFilters}
          showExport
          showCsv
          showPdf
          exportFileName={exportFileName}
          showTotals
        />
      </div>
    </HomeLayout>
  );
};

export default AttendanceReports;
