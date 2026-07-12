import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { useNavigate, useLocation } from "react-router";
import {
  FaPlus, FaPrint, FaQrcode, FaIdBadge, FaCheck, FaTimes,
  FaBan, FaCalendarAlt, FaUserClock, FaClock, FaLeaf,
} from "react-icons/fa";

import HomeLayout from "../../layouts/home";
import DataTable from "../../components/datatable";
import Modal from "../../components/modal";
import FormField from "../../components/formfiled";
import Button from "../../components/button";
import BarcodeImage from "../../components/barcode";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/tabs";

import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { showMessage } from "../../redux/slices/message";
import { selectModuleActions } from "../../redux/slices/permissions";

import {
  GET_ATTENDANCE_LOGS, GET_ATTENDANCE_PUNCHES, GET_ATTENDANCE_SUMMARY,
  GET_HOLIDAYS, GET_LEAVE_TYPES, GET_LEAVE_REQUESTS, GET_LEAVE_BALANCES,
} from "../../graphql/queries/attendance";
import {
  PUNCH, ADD_MANUAL_ATTENDANCE, EDIT_ATTENDANCE_LOG, DELETE_ATTENDANCE_LOG, DELETE_PUNCH,
  ADD_HOLIDAY, EDIT_HOLIDAY, DELETE_HOLIDAY,
  ADD_LEAVE_TYPE, EDIT_LEAVE_TYPE, DELETE_LEAVE_TYPE,
  ADD_LEAVE_REQUEST, EDIT_LEAVE_REQUEST,
  APPROVE_LEAVE_REQUEST, REJECT_LEAVE_REQUEST, CANCEL_LEAVE_REQUEST, DELETE_LEAVE_REQUEST,
  UPSERT_LEAVE_BALANCE, DELETE_LEAVE_BALANCE,
} from "../../graphql/mutations/attendance";
import { GET_STAFF } from "../../graphql/queries/staffaccounts";
import { formatDateDMY } from "../../utils/helper";

/* ─── helpers ─────────────────────────────────────────────────────── */

const pad  = (n: number) => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const monthStart = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-01`; };
const fmtDate    = (iso?: string | null) => { if (!iso) return "-"; const d = new Date(iso); return isNaN(d.getTime()) ? iso : formatDateDMY(d); };
const fmtTime    = (iso?: string | null) => { if (!iso) return "-"; const d = new Date(iso); return isNaN(d.getTime()) ? iso : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); };
const toHm       = (m?: number | null)   => { if (!m) return "0h 0m"; return `${Math.floor(m/60)}h ${m%60}m`; };
const cap        = (s?: string | null)   => { if (!s) return "-"; return String(s).charAt(0).toUpperCase() + String(s).slice(1); };
const daysBetween = (from: string, to: string) => {
  const f = new Date(from), t = new Date(to);
  return Math.max(1, Math.round((t.getTime() - f.getTime()) / 86400000) + 1);
};

/* ─── Status badges ────────────────────────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  present:   "bg-green-100 text-green-800",
  absent:    "bg-red-100 text-red-800",
  halfday:   "bg-yellow-100 text-yellow-800",
  leave:     "bg-blue-100 text-blue-800",
  holiday:   "bg-purple-100 text-purple-800",
  weekoff:   "bg-gray-100 text-gray-600",
  pending:   "bg-yellow-100 text-yellow-800",
  approved:  "bg-green-100 text-green-800",
  rejected:  "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-500",
};

const StatusBadge: React.FC<{ value: string }> = ({ value }) => {
  const cls = STATUS_COLORS[value?.toLowerCase()] || "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {cap(value)}
    </span>
  );
};

/* ─── Stat card ────────────────────────────────────────────────────── */

const StatCard: React.FC<{ label: string; value: number | string; color: string; icon?: React.ReactNode }> = ({ label, value, color, icon }) => (
  <div className={`rounded-xl border p-4 flex items-center gap-3 bg-white`}>
    {icon && <div className={`text-2xl ${color}`}>{icon}</div>}
    <div>
      <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
    </div>
  </div>
);

/* ─── Leave Balance progress card ──────────────────────────────────── */

const BalanceCard: React.FC<{ type: any; allocated: number; used: number; pending: number; balance: number; carried: number }> = ({ type, allocated, used, pending, balance, carried }) => {
  const total = allocated + carried;
  const usedPct  = total > 0 ? Math.round((used / total) * 100) : 0;
  const pendPct  = total > 0 ? Math.round((pending / total) * 100) : 0;
  const color    = type?.color || "#3b82f6";

  return (
    <div className="bg-white rounded-xl border p-4 min-w-[200px]">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="font-semibold text-sm text-gray-800 truncate">{type?.name || "Leave"}</span>
        <span className="ml-auto text-xs text-gray-500 font-mono">{type?.code}</span>
      </div>
      {/* progress bar */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2 flex">
        <div className="h-full rounded-l-full bg-red-400 transition-all" style={{ width: `${usedPct}%` }} />
        <div className="h-full bg-yellow-300 transition-all" style={{ width: `${pendPct}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-x-3 text-xs text-gray-600">
        <div><span className="font-semibold text-gray-800">{balance}</span> remaining</div>
        <div><span className="font-semibold text-gray-800">{used}</span> used</div>
        <div><span className="font-semibold text-gray-800">{pending}</span> pending</div>
        <div><span className="font-semibold text-gray-800">{carried}</span> C/F</div>
      </div>
      <div className="mt-1 text-xs text-gray-400">Allocated: {allocated}{carried > 0 ? ` + ${carried} C/F` : ""}</div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════ */
/* Page                                                               */
/* ═══════════════════════════════════════════════════════════════════ */

const Attendance: React.FC = () => {
  const navigate  = useNavigate();
  const actions   = useAppSelector(state => selectModuleActions(state, "attendance"));
  const location  = useLocation();
  const dispatch  = useAppDispatch();
  const { type, admin, branch, staff } = useAppSelector((s: any) => s.auth);
  const isStaff   = type === "staff";

  const initialTab = (location.state as any)?.tab as string | undefined;

  const adminId = type === "admin" ? admin?.id
    : type === "branch" ? branch?.admin?.id
    : type === "staff"  ? (staff?.admin?.id ?? admin?.id)
    : undefined;

  const selectedBranchId = useAppSelector((s: any) => s.selectedBranch?.branchId);
  const branchId = type === "staff" ? (staff?.branchid?.id || selectedBranchId) : selectedBranchId;

  const [tab, setTab] = useState<string>(initialTab || "overview");

  /* ── Attendance date/staff filter ── */
  const [logFilter, setLogFilter] = useState({
    dateFrom: monthStart(),
    dateTo:   todayStr(),
    staffid:  "",
    status:   "",
  });

  /* ── Leave request status filter ── */
  const [lrStatus, setLrStatus] = useState("");

  /* ── Scan-to-punch ── */
  const [scanOpen, setScanOpen]     = useState(false);
  const [scanType, setScanType]     = useState<"in"|"out"|"breakstart"|"breakend">("in");
  const [scanBuffer, setScanBuffer] = useState("");
  const [scanLog, setScanLog]       = useState<{ staff: string; type: string; ok: boolean; at: string }[]>([]);
  const scanInputRef = useRef<HTMLInputElement>(null);

  /* ── Card printing ── */
  const [printIds, setPrintIds] = useState<string[] | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  /* ─── Queries ─────────────────────────────────────────────────── */
  const logVars = {
    filter: {
      adminid:  adminId,
      branchid: branchId,
      dateFrom: logFilter.dateFrom || undefined,
      dateTo:   logFilter.dateTo   || undefined,
      staffid:  logFilter.staffid  || undefined,
      status:   logFilter.status   || undefined,
    },
  };

  const logsQ         = useQuery(GET_ATTENDANCE_LOGS,    { variables: logVars, skip: !adminId });
  const punchesQ      = useQuery(GET_ATTENDANCE_PUNCHES, { variables: { filter: { adminid: adminId, branchid: branchId } }, skip: !adminId });
  const summaryQ      = useQuery(GET_ATTENDANCE_SUMMARY, { variables: logVars, skip: !adminId });
  const todaySummaryQ = useQuery(GET_ATTENDANCE_SUMMARY, { variables: { filter: { adminid: adminId, branchid: branchId, dateFrom: todayStr(), dateTo: todayStr() } }, skip: !adminId });
  const holidaysQ     = useQuery(GET_HOLIDAYS,           { variables: { filter: { adminid: adminId } }, skip: !adminId });
  const leaveTypesQ   = useQuery(GET_LEAVE_TYPES,        { variables: { adminid: adminId }, skip: !adminId });
  const leaveRequestsQ= useQuery(GET_LEAVE_REQUESTS,     { variables: { filter: { adminid: adminId, branchid: branchId } }, skip: !adminId });
  const leaveBalancesQ= useQuery(GET_LEAVE_BALANCES,     { variables: { filter: { adminid: adminId } }, skip: !adminId });
  const staffQ        = useQuery(GET_STAFF,              { variables: { filter: { adminId } }, skip: !adminId });

  useEffect(() => {
    if (!adminId) return;
    logsQ.refetch();
    punchesQ.refetch();
    summaryQ.refetch();
    todaySummaryQ.refetch();
    holidaysQ.refetch();
    leaveTypesQ.refetch();
    leaveRequestsQ.refetch();
    leaveBalancesQ.refetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminId, branchId]);

  /* Re-fetch logs whenever filter changes */
  useEffect(() => { if (adminId) { logsQ.refetch(logVars); summaryQ.refetch(logVars); } }, [logFilter]);

  const staffOptions = useMemo(() =>
    (staffQ.data?.getStaffAccounts ?? []).map((s: any) => ({
      value: s.id,
      label: `${s.name}${s.staffcode ? ` (${s.staffcode})` : ""}`,
    })), [staffQ.data]);

  const leaveTypeOptions = useMemo(() =>
    (leaveTypesQ.data?.getLeaveTypes ?? []).map((lt: any) => ({
      value: lt.id,
      label: `${lt.name} (${lt.code})`,
    })), [leaveTypesQ.data]);

  /* ─── Mutations ───────────────────────────────────────────────── */
  const refetchAll = async () => {
    await Promise.all([
      logsQ.refetch(), punchesQ.refetch(), summaryQ.refetch(), todaySummaryQ.refetch(),
      holidaysQ.refetch(), leaveTypesQ.refetch(), leaveRequestsQ.refetch(), leaveBalancesQ.refetch(),
    ]);
  };

  const [punchMut]            = useMutation(PUNCH);
  const [addManualMut]        = useMutation(ADD_MANUAL_ATTENDANCE);
  const [editLogMut]          = useMutation(EDIT_ATTENDANCE_LOG);
  const [deleteLogMut]        = useMutation(DELETE_ATTENDANCE_LOG);
  const [deletePunchMut]      = useMutation(DELETE_PUNCH);
  const [addHolidayMut]       = useMutation(ADD_HOLIDAY);
  const [editHolidayMut]      = useMutation(EDIT_HOLIDAY);
  const [deleteHolidayMut]    = useMutation(DELETE_HOLIDAY);
  const [addLeaveTypeMut]     = useMutation(ADD_LEAVE_TYPE);
  const [editLeaveTypeMut]    = useMutation(EDIT_LEAVE_TYPE);
  const [deleteLeaveTypeMut]  = useMutation(DELETE_LEAVE_TYPE);
  const [addLeaveReqMut]      = useMutation(ADD_LEAVE_REQUEST);
  const [editLeaveReqMut]     = useMutation(EDIT_LEAVE_REQUEST);
  const [approveLeaveReqMut]  = useMutation(APPROVE_LEAVE_REQUEST);
  const [rejectLeaveReqMut]   = useMutation(REJECT_LEAVE_REQUEST);
  const [cancelLeaveReqMut]   = useMutation(CANCEL_LEAVE_REQUEST);
  const [deleteLeaveReqMut]   = useMutation(DELETE_LEAVE_REQUEST);
  const [upsertLeaveBalMut]   = useMutation(UPSERT_LEAVE_BALANCE);
  const [deleteLeaveBalMut]   = useMutation(DELETE_LEAVE_BALANCE);

  const notify = (msg: string, t: "success" | "error" = "success") =>
    dispatch(showMessage({ message: msg, type: t }));

  /* ─── Modal state ─────────────────────────────────────────────── */
  type ModalKind = null |"punch"|"manualAttendance"|"editLog"|"holiday"|"leaveType"|"leaveRequest"|"rejectLeave"|"leaveBalance";

  const [modal, setModal]           = useState<ModalKind>(null);
  const [editing, setEditing]       = useState<any>(null);
  const [form, setForm]             = useState<any>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const openModal = (kind: ModalKind, initial: any = {}, editingRow: any = null) => {
    setModal(kind); setForm(initial); setEditing(editingRow); setFormErrors({});
  };
  const closeModal = () => { setModal(null); setEditing(null); setForm({}); setFormErrors({}); };

  const onChange = (e: any) => {
    const { name, value, type: t, checked } = e.target;
    let v = t === "checkbox" ? checked : value;
    /* Auto-calculate totalDays when dates change */
    if ((name === "fromDate" || name === "toDate") && modal === "leaveRequest") {
      setForm((prev: any) => {
        const from = name === "fromDate" ? v : prev.fromDate;
        const to   = name === "toDate"   ? v : prev.toDate;
        const days = from && to ? daysBetween(from, to) : prev.totalDays;
        return { ...prev, [name]: v, totalDays: days };
      });
    } else if (name === "halfDay" && modal === "leaveRequest") {
      setForm((prev: any) => ({
        ...prev,
        halfDay: checked,
        totalDays: checked ? 0.5 : daysBetween(prev.fromDate, prev.toDate) || 1,
      }));
    } else {
      setForm((prev: any) => ({ ...prev, [name]: v }));
    }
    setFormErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
  };

  /* ─── Validation ──────────────────────────────────────────────── */
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const req = (key: string, label: string) => {
      const v = form[key];
      if (v === undefined || v === null || (typeof v === "string" && !v.trim())) errors[key] = `${label} is required`;
    };
    switch (modal) {
      case "punch":          req("staffid","Staff"); req("type","Type"); break;
      case "manualAttendance":
      case "editLog":        req("staffid","Staff"); req("date","Date"); req("status","Status"); break;
      case "holiday":        req("date","Date"); req("name","Name"); req("type","Type"); break;
      case "leaveType":
        req("name","Name"); req("code","Code"); req("accrualType","Accrual Type");
        if (form.totalDaysPerYear === "" || form.totalDaysPerYear === null || isNaN(parseFloat(form.totalDaysPerYear))) errors.totalDaysPerYear = "Days / Year required";
        break;
      case "leaveRequest":
        req("staffid","Staff"); req("leavetypeid","Leave Type"); req("fromDate","From date"); req("toDate","To date"); req("reason","Reason");
        if (!form.totalDays || isNaN(parseFloat(form.totalDays))) errors.totalDays = "Total days required";
        break;
      case "rejectLeave":    req("rejectionReason","Rejection reason"); break;
      case "leaveBalance":   req("staffid","Staff"); req("leavetypeid","Leave Type"); req("year","Year"); break;
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) { notify("Please fix the highlighted fields","error"); return false; }
    return true;
  };

  /* ─── Approve / Reject / Cancel helpers ───────────────────────── */
  const handleApprove = async (row: any) => {
    try {
      await approveLeaveReqMut({
        variables: {
          id: row.id,
          approverid:   admin?.id ?? branch?.id ?? null,
          approverName: admin?.name ?? branch?.branchname ?? "Approver",
          approverType: type,
        },
      });
      await refetchAll();
      notify("Leave approved — attendance dates marked as Leave.");
    } catch (e: any) { notify(e?.message || "Failed to approve.", "error"); }
  };

  const handleCancel = async (row: any) => {
    if (!window.confirm("Cancel this leave request?")) return;
    try {
      await cancelLeaveReqMut({ variables: { id: row.id } });
      await refetchAll();
      notify("Leave cancelled.");
    } catch { notify("Failed to cancel.", "error"); }
  };

  /* ─── Scan-to-punch ────────────────────────────────────────────── */
  useEffect(() => { if (scanOpen && scanInputRef.current) scanInputRef.current.focus(); }, [scanOpen]);

  const handleScanSubmit = async (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    const s = (staffQ.data?.getStaffAccounts ?? []).find((x: any) => x.id === value || x.staffcode === value);
    if (!s) {
      setScanLog(prev => [{ staff: value, type: scanType, ok: false, at: new Date().toLocaleTimeString() }, ...prev]);
      notify(`Unknown staff code: ${value}`, "error");
      return;
    }
    try {
      await punchMut({ variables: { input: { staffid: s.id, type: scanType, source: "kiosk", remarks: "Scanned via card" } } });
      setScanLog(prev => [{ staff: s.name, type: scanType, ok: true, at: new Date().toLocaleTimeString() }, ...prev]);
      notify(`${s.name} punched ${scanType}`);
      await refetchAll();
    } catch (e: any) {
      setScanLog(prev => [{ staff: s.name, type: scanType, ok: false, at: new Date().toLocaleTimeString() }, ...prev]);
      notify(e?.message || "Punch failed", "error");
    }
  };

  /* ─── Card printing ────────────────────────────────────────────── */
  const handlePrintCards = (ids: string[]) => {
    setPrintIds(ids);
    setTimeout(() => {
      const html = printRef.current?.innerHTML;
      if (!html) return;
      const w = window.open("", "_blank", "width=900,height=700");
      if (!w) return;
      w.document.write(`<html><head><title>Staff Cards</title><style>
        @page{size:A4;margin:8mm}body{font-family:Arial,sans-serif;margin:0;padding:0}
        .grid{display:grid;grid-template-columns:repeat(4,54mm);gap:4mm;justify-content:start}
        .card{width:54mm;height:86mm;border:0.4mm solid #ccc;border-radius:2mm;background:#fff;display:flex;flex-direction:column;align-items:center;page-break-inside:avoid;overflow:hidden;box-sizing:border-box;padding:0 3mm 3mm 3mm}
        .card-company{margin-top:2.5mm;font-size:6pt;font-weight:700;letter-spacing:.6pt;color:#555;text-transform:uppercase;text-align:center;width:100%}
        .photo{width:22mm;height:22mm;border-radius:50%;object-fit:cover;margin-top:2mm;background:#eee;border:0.6mm solid #999}
        .photo.placeholder{display:flex;align-items:center;justify-content:center;color:#fff;background:#2563eb;font-size:14pt;font-weight:700}
        .name{margin-top:2mm;font-size:10pt;font-weight:700;text-align:center;color:#111;line-height:1.1}
        .role{margin-top:.6mm;font-size:6.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.4pt}
        .meta{margin-top:1mm;font-size:7pt;color:#555;font-family:monospace}
        .barcode-wrap{margin-top:auto;width:100%;display:flex;justify-content:center;padding-top:2mm}
        .barcode-wrap svg{height:12mm!important;width:auto!important;display:block}
      </style></head><body><div class="grid">${html}</div>
      <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}</script></body></html>`);
      w.document.close();
      setPrintIds(null);
    }, 50);
  };

  const companyName = admin?.companyName || branch?.admin?.companyName || branch?.branchname || "STAFF ID";
  const roleColor   = (role?: string) => role === "salesman" ? "#16a34a" : role === "deliveryboy" ? "#ea580c" : "#2563eb";

  const StaffCard: React.FC<{ s: any; print?: boolean }> = ({ s, print }) => {
    const code = s.staffcode || s.id;
    const accent = roleColor(s.role);
    const photo  = s.imageurl || s.profilepicture;
    if (print) {
      return (
        <div className="card" style={{ borderTop: `3mm solid ${accent}` }}>
          <div className="card-company">{companyName}</div>
          {photo ? <img src={photo} alt={s.name} className="photo" /> : <div className="photo placeholder">{s.name?.[0] ?? "?"}</div>}
          <div className="name">{s.name}</div>
          <div className="role" style={{ color: accent }}>{s.role}</div>
          <div className="meta">{code}</div>
          <div className="barcode-wrap"><BarcodeImage value={code} /></div>
        </div>
      );
    }
    return (
      <div className="w-full bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
        <div className="h-1.5" style={{ background: accent }} />
        <div className="px-2.5 pt-2 pb-1 text-[10px] text-gray-500 uppercase tracking-wider font-semibold truncate">{companyName}</div>
        <div className="flex flex-col items-center px-2 pb-2">
          {photo ? (
            <img src={photo} alt={s.name} className="w-12 h-12 rounded-full object-cover border-2" style={{ borderColor: accent }} />
          ) : (
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-base border-2" style={{ background: accent, borderColor: accent }}>
              {s.name?.[0] ?? "?"}
            </div>
          )}
          <div className="mt-1.5 text-sm font-semibold text-gray-800 text-center truncate w-full">{s.name}</div>
          <div className="text-[9px] uppercase font-semibold tracking-wide" style={{ color: accent }}>{s.role}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">{code}</div>
          <div className="mt-1 w-full overflow-hidden" style={{ maxHeight: "32px" }}>
            <div style={{ transform: "scale(0.55)", transformOrigin: "top center", height: "32px" }}>
              <BarcodeImage value={code} />
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════ */
  /* TAB: Overview                                                  */
  /* ═══════════════════════════════════════════════════════════════ */
  const todayS   = todaySummaryQ.data?.getAttendanceSummary;
  const allReqs  = leaveRequestsQ.data?.getLeaveRequests ?? [];
  const pendReqs = allReqs.filter((r: any) => r.status === "pending");

  const renderOverviewTab = () => (
    <div className="space-y-6">

      {/* Today's Stats */}
      <div>
        <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Today — {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Present"  value={todayS?.presentDays ?? 0}  color="text-green-600"  icon={<FaUserClock />} />
          <StatCard label="Absent"   value={todayS?.absentDays ?? 0}   color="text-red-500"    icon={<FaTimes />} />
          <StatCard label="On Leave" value={todayS?.leaveDays ?? 0}    color="text-blue-500"   icon={<FaLeaf />} />
          <StatCard label="Half Day" value={todayS?.halfDays ?? 0}     color="text-yellow-500" icon={<FaClock />} />
          <StatCard label="Late"     value={todayS?.lateDays ?? 0}     color="text-orange-500" icon={<FaClock />} />
          <StatCard label="Holiday"  value={todayS?.holidayDays ?? 0}  color="text-purple-500" icon={<FaCalendarAlt />} />
        </div>
      </div>

      {/* Pending Leave Requests */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Pending Leave Requests
            {pendReqs.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-500 text-white text-xs font-bold">{pendReqs.length}</span>
            )}
          </div>
          {pendReqs.length > 0 && (
            <button onClick={() => setTab("leaverequests")} className="text-xs text-blue-600 hover:underline">View all</button>
          )}
        </div>

        {pendReqs.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-6 text-center text-green-700 text-sm font-medium">
            No pending leave requests
          </div>
        ) : (
          <div className="space-y-2">
            {pendReqs.slice(0, 8).map((r: any) => (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-800 text-sm">{r.staffid?.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-2">
                    <span style={{ color: r.leavetypeid?.color || "#3b82f6" }} className="font-medium">
                      {r.leavetypeid?.name}
                    </span>
                    <span>·</span>
                    <span>{formatDateDMY(r.fromDate)}{r.fromDate !== r.toDate ? ` → ${formatDateDMY(r.toDate)}` : ""}</span>
                    <span>·</span>
                    <span className="font-medium">{r.totalDays} day{r.totalDays !== 1 ? "s" : ""}</span>
                  </div>
                  {r.reason && <div className="text-xs text-gray-400 mt-0.5 truncate">{r.reason}</div>}
                </div>
                {!isStaff && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(r)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold border border-green-200 transition"
                    >
                      <FaCheck size={10} /> Approve
                    </button>
                    <button
                      onClick={() => openModal("rejectLeave", { rejectionReason: "" }, r)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold border border-red-200 transition"
                    >
                      <FaTimes size={10} /> Reject
                    </button>
                    <button
                      onClick={() => handleCancel(r)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-semibold border border-gray-200 transition"
                    >
                      <FaBan size={10} /> Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick leave balance summary for staff */}
      {isStaff && (
        <div>
          <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">My Leave Balances</div>
          <div className="flex flex-wrap gap-3">
            {(leaveBalancesQ.data?.getLeaveBalances ?? [])
              .filter((b: any) => b.year === new Date().getFullYear())
              .map((b: any) => (
                <BalanceCard key={b.id}
                  type={b.leavetypeid}
                  allocated={b.allocated} used={b.used}
                  pending={b.pending} balance={b.balance}
                  carried={b.carriedForward}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════ */
  /* TAB: Daily Attendance                                          */
  /* ═══════════════════════════════════════════════════════════════ */
  const summary = summaryQ.data?.getAttendanceSummary;

  const logRows = (logsQ.data?.getAttendanceLogs ?? []).map((l: any, i: number) => ({
    ...l,
    seqNo:     i + 1,
    dateLabel: formatDateDMY(l.date),
    staffName: l.staffid?.name ?? "-",
    staffCode: l.staffid?.staffcode ?? "-",
    firstIn:   fmtTime(l.firstPunchIn),
    lastOut:   fmtTime(l.lastPunchOut),
    work:      toHm(l.totalWorkMinutes),
    lateLabel: l.isLate ? `${l.lateByMinutes}m late` : null,
  }));

  const renderAttendanceTab = () => (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <FormField label="From Date" name="dateFrom" type="date" value={logFilter.dateFrom}
            onChange={(e: any) => setLogFilter(p => ({ ...p, dateFrom: e.target.value }))} />
          <FormField label="To Date" name="dateTo" type="date" value={logFilter.dateTo}
            onChange={(e: any) => setLogFilter(p => ({ ...p, dateTo: e.target.value }))} />
          <FormField label="Staff" name="staffid" type="select" value={logFilter.staffid} searchable
            options={[{ value: "", label: "All Staff" }, ...staffOptions]}
            onChange={(e: any) => setLogFilter(p => ({ ...p, staffid: e.target.value }))} />
          <FormField label="Status" name="status" type="select" value={logFilter.status}
            options={[
              { value: "", label: "All Status" },
              { value: "present", label: "Present" }, { value: "absent", label: "Absent" },
              { value: "halfday", label: "Half Day" }, { value: "leave", label: "Leave" },
              { value: "holiday", label: "Holiday" }, { value: "weekoff", label: "Week Off" },
            ]}
            onChange={(e: any) => setLogFilter(p => ({ ...p, status: e.target.value }))} />
        </div>
      </div>

      {/* Summary strip */}
      {summary && (
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {([
            ["Present",  summary.presentDays,  "bg-green-500"],
            ["Absent",   summary.absentDays,   "bg-red-500"],
            ["Half Day", summary.halfDays,      "bg-yellow-500"],
            ["Leave",    summary.leaveDays,     "bg-blue-500"],
            ["Holiday",  summary.holidayDays,   "bg-purple-500"],
            ["Week Off", summary.weekoffDays,   "bg-gray-400"],
            ["Late",     summary.lateDays,      "bg-orange-500"],
            ["OT (h)",   Math.round((summary.overtimeMinutes || 0)/60), "bg-teal-500"],
          ] as [string, number, string][]).map(([label, value, color]) => (
            <div key={label} className="bg-white rounded-lg border border-gray-200 p-2 text-center">
              <div className={`w-2 h-2 rounded-full ${color} mx-auto mb-1`} />
              <div className="text-lg font-bold text-gray-800">{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          ))}
        </div>
      )}

      <DataTable
        title="Attendance Logs"
        columns={[
          { label: "#",        key: "seqNo" },
          { label: "Date",     key: "dateLabel" },
          { label: "Staff",    key: "staffName" },
          { label: "Code",     key: "staffCode" },
          {
            label: "Status",   key: "status",
            render: (v: any) => <StatusBadge value={v} />,
          },
          {
            label: "Late",     key: "lateLabel",
            render: (v: any) => v ? (
              <span className="text-xs text-orange-600 font-medium">{v}</span>
            ) : <span className="text-xs text-gray-400">—</span>,
          },
          { label: "First In", key: "firstIn" },
          { label: "Last Out", key: "lastOut" },
          { label: "Work",     key: "work" },
        ]}
        data={logRows}
        {...actions}
        showReset={false} showView={false} showImport={false} showExport={false}
        showDeleted={actions.showDeleted}
        onShowDeleted={() => navigate("/attendance/deletedentries", { state: { from: "logs" } })}
        onAdd={() => openModal("manualAttendance", { staffid: isStaff ? (staff?.id||"") : "", date: todayStr(), status: "present", firstPunchIn: "", lastPunchOut: "", notes: "" })}
        onEdit={(row) => openModal("editLog", {
          staffid: row.staffid?.id ?? "", date: row.date, status: row.status,
          firstPunchIn: row.firstPunchIn ? row.firstPunchIn.slice(0,16) : "",
          lastPunchOut: row.lastPunchOut ? row.lastPunchOut.slice(0,16) : "",
          notes: row.notes ?? "",
        }, row)}
        onDelete={async (row) => {
          if (!window.confirm(`Delete log for ${row.staffName} on ${formatDateDMY(row.date)}?`)) return;
          try { await deleteLogMut({ variables: { id: row.id } }); await logsQ.refetch(); notify("Log deleted."); }
          catch { notify("Failed to delete.", "error"); }
        }}
        isLoading={logsQ.loading}
        defaultEntriesPerPage={25}
      />
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════ */
  /* TAB: Leave Requests                                            */
  /* ═══════════════════════════════════════════════════════════════ */

  /* Available balance for the selected leave type (for new request form) */
  const selectedBalance = useMemo(() => {
    if (!form.staffid || !form.leavetypeid) return null;
    const year = form.fromDate ? new Date(form.fromDate).getFullYear() : new Date().getFullYear();
    return (leaveBalancesQ.data?.getLeaveBalances ?? []).find(
      (b: any) => b.staffid?.id === form.staffid && b.leavetypeid?.id === form.leavetypeid && b.year === year
    );
  }, [form.staffid, form.leavetypeid, form.fromDate, leaveBalancesQ.data]);

  const filteredRequests = useMemo(() => {
    const all = leaveRequestsQ.data?.getLeaveRequests ?? [];
    return lrStatus ? all.filter((r: any) => r.status === lrStatus) : all;
  }, [leaveRequestsQ.data, lrStatus]);

  const requestRows = filteredRequests.map((r: any, i: number) => ({
    ...r,
    seqNo:      i + 1,
    staffName:  r.staffid?.name ?? "-",
    typeName:   r.leavetypeid?.name ?? "-",
    typeColor:  r.leavetypeid?.color,
    dateRange:  r.fromDate === r.toDate ? formatDateDMY(r.fromDate) : `${formatDateDMY(r.fromDate)} → ${formatDateDMY(r.toDate)}`,
    isPending:  r.status === "pending",
  }));

  const renderLeaveRequestsTab = () => (
    <div className="space-y-3">
      {/* Status filter */}
      <div className="flex flex-wrap gap-2 items-center">
        {(["", "pending", "approved", "rejected", "cancelled"] as const).map(s => (
          <button
            key={s || "all"}
            onClick={() => setLrStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
              lrStatus === s
                ? "bg-gray-800 text-white border-gray-800"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
            }`}
          >
            {s ? cap(s) : "All"} {!s && `(${(leaveRequestsQ.data?.getLeaveRequests ?? []).length})`}
            {s && ` (${(leaveRequestsQ.data?.getLeaveRequests ?? []).filter((r: any) => r.status === s).length})`}
          </button>
        ))}
      </div>

      <DataTable
        title="Leave Requests"
        columns={[
          { label: "#",      key: "seqNo" },
          { label: "Staff",  key: "staffName" },
          {
            label: "Type",   key: "typeName",
            render: (v: any, row: any) => (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: row.typeColor || "#3b82f6" }} />
                {v}
              </span>
            ),
          },
          { label: "Dates",  key: "dateRange" },
          { label: "Days",   key: "totalDays" },
          {
            label: "Status", key: "status",
            render: (v: any) => <StatusBadge value={v} />,
          },
          { label: "Reason", key: "reason" },
          {
            label: "Actions", key: "isPending",
            render: (_: any, row: any) => {
              if (!row.isPending || isStaff) return null;
              return (
                <div className="flex gap-1 flex-nowrap">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleApprove(row); }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold border border-green-200"
                    title="Approve"
                  >
                    <FaCheck size={9} /> Approve
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); openModal("rejectLeave", { rejectionReason: "" }, row); }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold border border-red-200"
                    title="Reject"
                  >
                    <FaTimes size={9} /> Reject
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCancel(row); }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-semibold border border-gray-200"
                    title="Cancel"
                  >
                    <FaBan size={9} /> Cancel
                  </button>
                </div>
              );
            },
          },
        ]}
        data={requestRows}
        {...actions}
        showReset={false} showView={false} showImport={false} showExport={false}
        showDeleted={actions.showDeleted}
        onShowDeleted={() => navigate("/attendance/deletedentries", { state: { from: "leaverequests" } })}
        onAdd={() => openModal("leaveRequest", {
          staffid: isStaff ? (staff?.id||"") : "", leavetypeid: "",
          fromDate: todayStr(), toDate: todayStr(), halfDay: false, totalDays: 1, reason: "",
        })}
        onEdit={(row) => {
          if (row.status !== "pending") { notify("Only pending requests can be edited.","error"); return; }
          openModal("leaveRequest", {
            staffid: row.staffid?.id ?? "", leavetypeid: row.leavetypeid?.id ?? "",
            fromDate: row.fromDate, toDate: row.toDate, halfDay: !!row.halfDay,
            totalDays: row.totalDays, reason: row.reason ?? "",
          }, row);
        }}
        onDelete={async (row) => {
          if (!window.confirm("Delete this leave request?")) return;
          try { await deleteLeaveReqMut({ variables: { id: row.id } }); await leaveRequestsQ.refetch(); notify("Deleted."); }
          catch { notify("Failed.","error"); }
        }}
        isLoading={leaveRequestsQ.loading}
        defaultEntriesPerPage={25}
      />
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════ */
  /* TAB: Leave Balances                                            */
  /* ═══════════════════════════════════════════════════════════════ */
  const balanceRows = (leaveBalancesQ.data?.getLeaveBalances ?? []).map((b: any, i: number) => ({
    ...b, seqNo: i+1,
    staffName: b.staffid?.name ?? "-",
    typeName:  b.leavetypeid?.name ?? "-",
  }));

  /* Group balances by staff for card display */
  const balancesByStaff = useMemo(() => {
    const all = leaveBalancesQ.data?.getLeaveBalances ?? [];
    const map = new Map<string, { staff: any; balances: any[] }>();
    for (const b of all) {
      const sid = b.staffid?.id || "unknown";
      if (!map.has(sid)) map.set(sid, { staff: b.staffid, balances: [] });
      map.get(sid)!.balances.push(b);
    }
    return Array.from(map.values());
  }, [leaveBalancesQ.data]);

  const [balanceView, setBalanceView] = useState<"cards"|"table">("cards");

  const renderLeaveBalancesTab = () => (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <button onClick={() => setBalanceView("cards")}
          className={`px-3 py-1 rounded text-xs font-semibold border ${balanceView === "cards" ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-300"}`}>
          Cards
        </button>
        <button onClick={() => setBalanceView("table")}
          className={`px-3 py-1 rounded text-xs font-semibold border ${balanceView === "table" ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-300"}`}>
          Table
        </button>
      </div>

      {balanceView === "cards" ? (
        <div className="space-y-6">
          {balancesByStaff.map(({ staff: s, balances }) => (
            <div key={s?.id || "unknown"} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                  {s?.name?.[0] ?? "?"}
                </div>
                {s?.name ?? "Unknown"} <span className="text-xs text-gray-400 font-normal">{s?.staffcode}</span>
              </div>
              <div className="flex flex-wrap gap-3">
                {balances.map((b: any) => (
                  <BalanceCard key={b.id}
                    type={b.leavetypeid}
                    allocated={b.allocated} used={b.used}
                    pending={b.pending} balance={b.balance}
                    carried={b.carriedForward}
                  />
                ))}
              </div>
            </div>
          ))}
          {balancesByStaff.length === 0 && (
            <div className="text-center text-gray-400 py-12 border border-dashed rounded-xl">
              No leave balances found. Add balances for each staff member.
            </div>
          )}
        </div>
      ) : (
        <DataTable
          title="Leave Balances"
          columns={[
            { label: "#",         key: "seqNo" },
            { label: "Staff",     key: "staffName" },
            { label: "Type",      key: "typeName" },
            { label: "Year",      key: "year" },
            { label: "Allocated", key: "allocated" },
            { label: "C/F",       key: "carriedForward" },
            { label: "Used",      key: "used" },
            { label: "Pending",   key: "pending" },
            { label: "Balance",   key: "balance",
              render: (v: any) => <span className={`font-bold ${v > 0 ? "text-green-600" : "text-red-500"}`}>{v}</span> },
          ]}
          data={balanceRows}
          {...actions}
          showReset={false} showView={false} showImport={false} showExport={false}
          showDeleted={actions.showDeleted}
          onShowDeleted={() => navigate("/attendance/deletedentries", { state: { from: "balances" } })}
          onAdd={() => openModal("leaveBalance", { staffid: isStaff ? (staff?.id||"") : "", leavetypeid: "", year: new Date().getFullYear(), allocated: 0, carriedForward: 0 })}
          onEdit={(row) => openModal("leaveBalance", { staffid: row.staffid?.id ?? "", leavetypeid: row.leavetypeid?.id ?? "", year: row.year, allocated: row.allocated, carriedForward: row.carriedForward }, row)}
          onDelete={async (row) => {
            if (!window.confirm(`Delete balance for ${row.staffName} (${row.typeName}) ${row.year}?`)) return;
            try { await deleteLeaveBalMut({ variables: { id: row.id } }); await leaveBalancesQ.refetch(); notify("Deleted."); }
            catch { notify("Failed.","error"); }
          }}
          isLoading={leaveBalancesQ.loading}
          defaultEntriesPerPage={25}
        />
      )}
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════ */
  /* TAB: Holidays                                                  */
  /* ═══════════════════════════════════════════════════════════════ */
  const holidayRows = (holidaysQ.data?.getHolidays ?? []).map((h: any, i: number) => ({
    ...h, seqNo: i+1, dateLabel: formatDateDMY(h.date), nameLabel: h.name, typeLabel: cap(h.type), descriptionLabel: h.description ?? "-",
  }));

  const renderHolidaysTab = () => (
    <DataTable
      title="Holidays"
      columns={[
        { label: "#",           key: "seqNo" },
        { label: "Date",        key: "dateLabel" },
        { label: "Name",        key: "nameLabel" },
        {
          label: "Type",        key: "type",
          render: (v: any) => {
            const colors: Record<string, string> = { public: "bg-purple-100 text-purple-700", company: "bg-blue-100 text-blue-700", regional: "bg-green-100 text-green-700", optional: "bg-gray-100 text-gray-600" };
            return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${colors[v] || ""}`}>{cap(v)}</span>;
          },
        },
        { label: "Description", key: "descriptionLabel" },
      ]}
      data={holidayRows}
      {...actions}
      showReset={false} showView={false} showImport={false} showExport={false}
      showDeleted={actions.showDeleted}
      onShowDeleted={() => navigate("/attendance/deletedentries", { state: { from: "holidays" } })}
      onAdd={() => openModal("holiday", { date: todayStr(), name: "", type: "public", description: "" })}
      onEdit={(row) => openModal("holiday", { date: row.date, name: row.name, type: row.type, description: row.description ?? "" }, row)}
      onDelete={async (row) => {
        if (!window.confirm(`Delete holiday "${row.name}"?`)) return;
        try { await deleteHolidayMut({ variables: { id: row.id } }); await holidaysQ.refetch(); notify("Holiday deleted."); }
        catch { notify("Failed.","error"); }
      }}
      isLoading={holidaysQ.loading}
      defaultEntriesPerPage={25}
    />
  );

  /* ═══════════════════════════════════════════════════════════════ */
  /* TAB: Leave Types                                               */
  /* ═══════════════════════════════════════════════════════════════ */
  const leaveTypeRows = (leaveTypesQ.data?.getLeaveTypes ?? []).map((lt: any, i: number) => ({
    ...lt, seqNo: i+1, paidLabel: lt.isPaid ? "Paid" : "Unpaid", accrualLabel: cap(lt.accrualType),
  }));

  const renderLeaveTypesTab = () => (
    <DataTable
      title="Leave Types"
      columns={[
        { label: "#",       key: "seqNo" },
        {
          label: "Name",    key: "name",
          render: (v: any, row: any) => (
            <span className="inline-flex items-center gap-2 font-medium">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: row.color || "#3b82f6" }} />
              {v}
            </span>
          ),
        },
        { label: "Code",    key: "code" },
        { label: "Days/Yr", key: "totalDaysPerYear" },
        {
          label: "Paid",    key: "isPaid",
          render: (v: any) => <span className={`text-xs font-semibold ${v ? "text-green-600" : "text-gray-500"}`}>{v ? "Paid" : "Unpaid"}</span>,
        },
        { label: "Accrual", key: "accrualLabel" },
        {
          label: "Carry Fwd", key: "carryForward",
          render: (v: any) => <span className="text-xs">{v ? "Yes" : "No"}</span>,
        },
        {
          label: "Half Day",  key: "allowHalfDay",
          render: (v: any) => <span className="text-xs">{v ? "Yes" : "No"}</span>,
        },
      ]}
      data={leaveTypeRows}
      {...actions}
      showReset={false} showView={false} showImport={false} showExport={false}
      showDeleted={actions.showDeleted}
      onShowDeleted={() => navigate("/attendance/deletedentries", { state: { from: "leavetypes" } })}
      onAdd={() => openModal("leaveType", { name: "", code: "", totalDaysPerYear: 0, accrualType: "yearly", carryForward: false, maxCarryForward: 0, isPaid: true, allowHalfDay: true, requiresApproval: true, requiresAttachment: false, color: "#3b82f6", description: "", status: true })}
      onEdit={(row) => openModal("leaveType", { name: row.name, code: row.code, totalDaysPerYear: row.totalDaysPerYear ?? 0, accrualType: row.accrualType ?? "yearly", carryForward: !!row.carryForward, maxCarryForward: row.maxCarryForward ?? 0, isPaid: !!row.isPaid, allowHalfDay: !!row.allowHalfDay, requiresApproval: !!row.requiresApproval, requiresAttachment: !!row.requiresAttachment, color: row.color ?? "#3b82f6", description: row.description ?? "", status: row.status ?? true }, row)}
      onDelete={async (row) => {
        if (!window.confirm(`Delete leave type "${row.name}"?`)) return;
        try { await deleteLeaveTypeMut({ variables: { id: row.id } }); await leaveTypesQ.refetch(); notify("Deleted."); }
        catch { notify("Failed.","error"); }
      }}
      isLoading={leaveTypesQ.loading}
      defaultEntriesPerPage={25}
    />
  );

  /* ═══════════════════════════════════════════════════════════════ */
  /* TAB: Punches                                                   */
  /* ═══════════════════════════════════════════════════════════════ */
  const punchRows = (punchesQ.data?.getAttendancePunches ?? []).map((p: any, i: number) => ({
    ...p, seqNo: i+1, typeLabel: cap(p.type), sourceLabel: cap(p.source), address: p.address ?? "-", remarks: p.remarks ?? "-", when: fmtDate(p.timestamp) + " " + fmtTime(p.timestamp),
  }));

  const renderPunchesTab = () => (
    <DataTable
      title="Punches"
      columns={[
        { label: "#",       key: "seqNo" },
        { label: "Type",    key: "typeLabel" },
        { label: "When",    key: "when" },
        { label: "Source",  key: "sourceLabel" },
        { label: "Address", key: "address" },
        { label: "Remarks", key: "remarks" },
      ]}
      data={punchRows}
      {...actions}
      showAdd={false} showEdit={false} showDelete={false} showView={false}
      showImport={false} showExport={false} showDeleted={false}
      isLoading={punchesQ.loading}
      defaultEntriesPerPage={25}
    />
  );

  /* ═══════════════════════════════════════════════════════════════ */
  /* TAB: Staff Cards                                               */
  /* ═══════════════════════════════════════════════════════════════ */
  const staffList = staffQ.data?.getStaffAccounts ?? [];
  const renderCardsTab = () => (
    <>
      <div className="flex justify-between items-center mb-3">
        <div className="text-sm text-gray-600">{staffList.length} staff member{staffList.length !== 1 ? "s" : ""}</div>
        <Button variant="outline" icon={<FaPrint />} onClick={() => handlePrintCards(staffList.map((s: any) => s.id))} disabled={!staffList.length}>Print All</Button>
      </div>
      {staffList.length === 0 ? (
        <div className="text-center text-gray-500 py-12 border border-dashed rounded-lg">No staff members found.</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {staffList.map((s: any) => (
            <div key={s.id} className="flex flex-col items-center gap-1 w-[180px]">
              <StaffCard s={s} />
              <button onClick={() => handlePrintCards([s.id])} className="text-[11px] text-blue-600 hover:underline flex items-center gap-1">
                <FaIdBadge size={10} /> Print
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ position: "absolute", left: -99999, top: -99999 }}>
        <div ref={printRef}>
          {printIds && staffList.filter((s: any) => printIds.includes(s.id)).map((s: any) => <StaffCard key={s.id} s={s} print />)}
        </div>
      </div>
    </>
  );

  /* ═══════════════════════════════════════════════════════════════ */
  /* Modal submit handlers                                          */
  /* ═══════════════════════════════════════════════════════════════ */
  const submitPunch = async () => {
    if (!validateForm()) return;
    try {
      await punchMut({ variables: { input: { staffid: form.staffid, type: form.type, timestamp: form.timestamp || undefined, latitude: form.latitude ? parseFloat(form.latitude) : undefined, longitude: form.longitude ? parseFloat(form.longitude) : undefined, address: form.address || undefined, source: form.source || "web", remarks: form.remarks || undefined } } });
      await refetchAll(); notify("Punch recorded."); closeModal();
    } catch (e: any) { notify(e?.message || "Failed.", "error"); }
  };

  const submitManualAttendance = async () => {
    if (!validateForm()) return;
    try {
      await addManualMut({ variables: { input: { staffid: form.staffid, date: form.date, status: form.status, firstPunchIn: form.firstPunchIn || undefined, lastPunchOut: form.lastPunchOut || undefined, notes: form.notes || undefined } } });
      await refetchAll(); notify("Attendance saved."); closeModal();
    } catch (e: any) { notify(e?.message || "Failed.", "error"); }
  };

  const submitEditLog = async () => {
    if (!editing?.id || !validateForm()) return;
    try {
      await editLogMut({ variables: { id: editing.id, input: { staffid: form.staffid, date: form.date, status: form.status, firstPunchIn: form.firstPunchIn || undefined, lastPunchOut: form.lastPunchOut || undefined, notes: form.notes || undefined } } });
      await refetchAll(); notify("Log updated."); closeModal();
    } catch (e: any) { notify(e?.message || "Failed.", "error"); }
  };

  const submitHoliday = async () => {
    if (!validateForm()) return;
    try {
      const input = { adminid: adminId, branchid: branchId || undefined, date: form.date, name: form.name, type: form.type || "public", description: form.description || undefined, status: true };
      if (editing?.id) { await editHolidayMut({ variables: { id: editing.id, input } }); notify("Updated."); }
      else { await addHolidayMut({ variables: { input } }); notify("Added."); }
      await holidaysQ.refetch(); closeModal();
    } catch (e: any) { notify(e?.message || "Failed.", "error"); }
  };

  const submitLeaveType = async () => {
    if (!validateForm()) return;
    try {
      const input = { adminid: adminId, name: form.name, code: form.code, totalDaysPerYear: parseFloat(form.totalDaysPerYear) || 0, accrualType: form.accrualType || "yearly", carryForward: !!form.carryForward, maxCarryForward: parseFloat(form.maxCarryForward) || 0, isPaid: !!form.isPaid, allowHalfDay: !!form.allowHalfDay, requiresApproval: !!form.requiresApproval, requiresAttachment: !!form.requiresAttachment, color: form.color || "#3b82f6", description: form.description || undefined, status: true };
      if (editing?.id) { await editLeaveTypeMut({ variables: { id: editing.id, input } }); notify("Updated."); }
      else { await addLeaveTypeMut({ variables: { input } }); notify("Added."); }
      await leaveTypesQ.refetch(); closeModal();
    } catch (e: any) { notify(e?.message || "Failed.", "error"); }
  };

  const submitLeaveRequest = async () => {
    if (!validateForm()) return;
    try {
      const input = { adminid: adminId, branchid: branchId, staffid: form.staffid, leavetypeid: form.leavetypeid, fromDate: form.fromDate, toDate: form.toDate, halfDay: !!form.halfDay, halfDaySession: form.halfDaySession || undefined, totalDays: parseFloat(form.totalDays) || 1, reason: form.reason, attachmentUrl: form.attachmentUrl || undefined };
      if (editing?.id) { await editLeaveReqMut({ variables: { id: editing.id, input } }); notify("Updated."); }
      else { await addLeaveReqMut({ variables: { input } }); notify("Leave request submitted."); }
      await Promise.all([leaveRequestsQ.refetch(), leaveBalancesQ.refetch()]); closeModal();
    } catch (e: any) { notify(e?.message || "Failed.", "error"); }
  };

  const submitReject = async () => {
    if (!editing?.id || !validateForm()) return;
    try {
      await rejectLeaveReqMut({ variables: { id: editing.id, rejectionReason: form.rejectionReason, approverid: admin?.id ?? branch?.id ?? null, approverName: admin?.name ?? branch?.branchname ?? "Approver", approverType: type } });
      await Promise.all([leaveRequestsQ.refetch(), leaveBalancesQ.refetch()]); notify("Leave rejected."); closeModal();
    } catch (e: any) { notify(e?.message || "Failed.", "error"); }
  };

  const submitLeaveBalance = async () => {
    if (!validateForm()) return;
    try {
      await upsertLeaveBalMut({ variables: { input: { adminid: adminId, staffid: form.staffid, leavetypeid: form.leavetypeid, year: parseInt(form.year, 10), allocated: parseFloat(form.allocated) || 0, carriedForward: parseFloat(form.carriedForward) || 0 } } });
      await leaveBalancesQ.refetch(); notify("Balance saved."); closeModal();
    } catch (e: any) { notify(e?.message || "Failed.", "error"); }
  };

  /* ═══════════════════════════════════════════════════════════════ */
  /* Modal content                                                  */
  /* ═══════════════════════════════════════════════════════════════ */
  const Buttons: React.FC<{ onSubmit: () => void }> = ({ onSubmit }) => (
    <div className="flex justify-end gap-3 pt-4 border-t mt-4">
      <Button variant="outline" onClick={closeModal}>Cancel</Button>
      <Button variant="outline" onClick={onSubmit}>Save</Button>
    </div>
  );

  const renderModalContent = () => {
    if (!modal) return null;

    if (modal === "punch") return (
      <div className="space-y-3">
        <FormField label="Staff" name="staffid" type="select" options={staffOptions} value={form.staffid} onChange={onChange} searchable required error={formErrors.staffid} />
        <FormField label="Type" name="type" type="select" options={[{ value:"in",label:"Punch In" },{ value:"out",label:"Punch Out" },{ value:"breakstart",label:"Break Start" },{ value:"breakend",label:"Break End" }]} value={form.type} onChange={onChange} required error={formErrors.type} />
        <FormField label="Timestamp (optional)" name="timestamp" type="datetime-local" value={form.timestamp} onChange={onChange} />
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Latitude"  name="latitude"  type="number" value={form.latitude}  onChange={onChange} />
          <FormField label="Longitude" name="longitude" type="number" value={form.longitude} onChange={onChange} />
        </div>
        <FormField label="Address" name="address" value={form.address} onChange={onChange} />
        <FormField label="Source" name="source" type="select" options={[{ value:"web",label:"Web" },{ value:"mobile",label:"Mobile" },{ value:"biometric",label:"Biometric" },{ value:"kiosk",label:"Kiosk" },{ value:"manual",label:"Manual" }]} value={form.source} onChange={onChange} />
        <FormField label="Remarks" name="remarks" value={form.remarks} onChange={onChange} />
        <Buttons onSubmit={submitPunch} />
      </div>
    );

    if (modal === "manualAttendance" || modal === "editLog") return (
      <div className="space-y-3">
        <FormField label="Staff" name="staffid" type="select" options={staffOptions} value={form.staffid} onChange={onChange} searchable disabled={modal === "editLog"} required error={formErrors.staffid} />
        <FormField label="Date" name="date" type="date" value={form.date} onChange={onChange} disabled={modal === "editLog"} required error={formErrors.date} />
        <FormField label="Status" name="status" type="select" options={[{ value:"present",label:"Present" },{ value:"absent",label:"Absent" },{ value:"halfday",label:"Half Day" },{ value:"leave",label:"Leave" },{ value:"holiday",label:"Holiday" },{ value:"weekoff",label:"Week Off" }]} value={form.status} onChange={onChange} required error={formErrors.status} />
        <div className="grid grid-cols-2 gap-3">
          <FormField label="First Punch In"  name="firstPunchIn"  type="datetime-local" value={form.firstPunchIn}  onChange={onChange} />
          <FormField label="Last Punch Out" name="lastPunchOut" type="datetime-local" value={form.lastPunchOut} onChange={onChange} />
        </div>
        <FormField label="Notes" name="notes" value={form.notes} onChange={onChange} />
        <Buttons onSubmit={modal === "editLog" ? submitEditLog : submitManualAttendance} />
      </div>
    );

    if (modal === "holiday") return (
      <div className="space-y-3">
        <FormField label="Date" name="date" type="date" value={form.date} onChange={onChange} required error={formErrors.date} />
        <FormField label="Name" name="name" value={form.name} onChange={onChange} required error={formErrors.name} />
        <FormField label="Type" name="type" type="select" options={[{ value:"public",label:"Public" },{ value:"company",label:"Company" },{ value:"regional",label:"Regional" },{ value:"optional",label:"Optional" }]} value={form.type} onChange={onChange} required error={formErrors.type} />
        <FormField label="Description" name="description" value={form.description} onChange={onChange} />
        <Buttons onSubmit={submitHoliday} />
      </div>
    );

    if (modal === "leaveType") return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Name" name="name" value={form.name} onChange={onChange} required error={formErrors.name} />
          <FormField label="Code" name="code" value={form.code} onChange={onChange} required error={formErrors.code} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Days / Year" name="totalDaysPerYear" type="number" value={form.totalDaysPerYear} onChange={onChange} required error={formErrors.totalDaysPerYear} />
          <FormField label="Accrual" name="accrualType" type="select" options={[{ value:"yearly",label:"Yearly" },{ value:"monthly",label:"Monthly" },{ value:"quarterly",label:"Quarterly" },{ value:"none",label:"None" }]} value={form.accrualType} onChange={onChange} required error={formErrors.accrualType} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Carry Forward"    name="carryForward"      type="checkbox" value={form.carryForward}      onChange={onChange} />
          <FormField label="Max C/F Days"     name="maxCarryForward"   type="number"   value={form.maxCarryForward}   onChange={onChange} />
          <div className="flex items-center gap-2 pt-5">
            <label className="text-xs text-gray-600 font-medium">Color</label>
            <input type="color" name="color" value={form.color || "#3b82f6"} onChange={onChange} className="w-8 h-8 rounded cursor-pointer border border-gray-300" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Paid Leave"          name="isPaid"             type="checkbox" value={form.isPaid}             onChange={onChange} />
          <FormField label="Allow Half Day"      name="allowHalfDay"       type="checkbox" value={form.allowHalfDay}       onChange={onChange} />
          <FormField label="Requires Approval"   name="requiresApproval"   type="checkbox" value={form.requiresApproval}   onChange={onChange} />
          <FormField label="Requires Attachment" name="requiresAttachment" type="checkbox" value={form.requiresAttachment} onChange={onChange} />
        </div>
        <FormField label="Description" name="description" value={form.description} onChange={onChange} />
        <Buttons onSubmit={submitLeaveType} />
      </div>
    );

    if (modal === "leaveRequest") return (
      <div className="space-y-3">
        {!isStaff && (
          <FormField label="Staff" name="staffid" type="select" options={staffOptions} value={form.staffid} onChange={onChange} searchable required error={formErrors.staffid} />
        )}
        <FormField label="Leave Type" name="leavetypeid" type="select" options={leaveTypeOptions} value={form.leavetypeid} onChange={onChange} searchable required error={formErrors.leavetypeid} />
        {/* Balance indicator */}
        {selectedBalance && (
          <div className={`text-xs px-3 py-2 rounded-lg flex items-center gap-2 ${selectedBalance.balance > 0 ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            <span className="font-semibold">{selectedBalance.balance} day{selectedBalance.balance !== 1 ? "s" : ""} available</span>
            <span className="text-gray-400">({selectedBalance.used} used of {selectedBalance.allocated + selectedBalance.carriedForward})</span>
            {selectedBalance.balance === 0 && <span className="font-bold">— Balance exhausted!</span>}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="From"   name="fromDate" type="date" value={form.fromDate} onChange={onChange} required error={formErrors.fromDate} />
          <FormField label="To"     name="toDate"   type="date" value={form.toDate}   onChange={onChange} required error={formErrors.toDate} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Half Day"   name="halfDay"   type="checkbox" value={form.halfDay}   onChange={onChange} />
          <FormField label="Total Days" name="totalDays" type="number"   value={form.totalDays} onChange={onChange} required error={formErrors.totalDays} />
        </div>
        {form.halfDay && (
          <FormField label="Half Day Session" name="halfDaySession" type="select" options={[{ value:"first",label:"First Half" },{ value:"second",label:"Second Half" }]} value={form.halfDaySession} onChange={onChange} />
        )}
        <FormField label="Reason" name="reason" value={form.reason} onChange={onChange} required error={formErrors.reason} />
        <Buttons onSubmit={submitLeaveRequest} />
      </div>
    );

    if (modal === "rejectLeave") return (
      <div className="space-y-3">
        <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600">
          Rejecting leave for: <strong>{editing?.staffid?.name || editing?.staffName}</strong>
        </div>
        <FormField label="Rejection Reason" name="rejectionReason" value={form.rejectionReason} onChange={onChange} required error={formErrors.rejectionReason} />
        <Buttons onSubmit={submitReject} />
      </div>
    );

    if (modal === "leaveBalance") return (
      <div className="space-y-3">
        <FormField label="Staff" name="staffid" type="select" options={staffOptions} value={form.staffid} onChange={onChange} searchable disabled={!!editing} required error={formErrors.staffid} />
        <FormField label="Leave Type" name="leavetypeid" type="select" options={leaveTypeOptions} value={form.leavetypeid} onChange={onChange} searchable disabled={!!editing} required error={formErrors.leavetypeid} />
        <FormField label="Year" name="year" type="number" value={form.year} onChange={onChange} disabled={!!editing} required error={formErrors.year} />
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Allocated Days"  name="allocated"      type="number" value={form.allocated}      onChange={onChange} />
          <FormField label="Carried Forward" name="carriedForward" type="number" value={form.carriedForward} onChange={onChange} />
        </div>
        <Buttons onSubmit={submitLeaveBalance} />
      </div>
    );

    return null;
  };

  const modalTitle: Record<string, string> = {
    punch: "Record Punch", manualAttendance: "Add Manual Attendance", editLog: "Edit Log",
    holiday: editing ? "Edit Holiday" : "Add Holiday",
    leaveType: editing ? "Edit Leave Type" : "Add Leave Type",
    leaveRequest: editing ? "Edit Leave Request" : "Apply for Leave",
    rejectLeave: "Reject Leave Request",
    leaveBalance: editing ? "Edit Balance" : "Set Leave Balance",
  };

  /* ═══════════════════════════════════════════════════════════════ */
  /* Render                                                         */
  /* ═══════════════════════════════════════════════════════════════ */
  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold">Attendance &amp; Leave</h1>
          <div className="flex gap-2">
            <Button variant="outline" icon={<FaQrcode />} onClick={() => { setScanType("in"); setScanBuffer(""); setScanOpen(true); }}>
              Scan Punch
            </Button>
            <Button variant="outline" icon={<FaPlus />} onClick={() => openModal("punch", { staffid: isStaff ? (staff?.id||"") : "", type:"in", source:"web", remarks:"" })}>
              Record Punch
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="leaverequests">
              Leave Requests
              {pendReqs.length > 0 && !isStaff && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-yellow-500 text-white text-[9px] font-bold">{pendReqs.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="leavebalances">Leave Balances</TabsTrigger>
            {!isStaff && <TabsTrigger value="holidays">Holidays</TabsTrigger>}
            {!isStaff && <TabsTrigger value="leavetypes">Leave Types</TabsTrigger>}
            {!isStaff && <TabsTrigger value="punches">Punches</TabsTrigger>}
            {!isStaff && <TabsTrigger value="cards">Staff Cards</TabsTrigger>}
          </TabsList>

          <TabsContent value="overview">{renderOverviewTab()}</TabsContent>
          <TabsContent value="attendance">{renderAttendanceTab()}</TabsContent>
          <TabsContent value="leaverequests">{renderLeaveRequestsTab()}</TabsContent>
          <TabsContent value="leavebalances">{renderLeaveBalancesTab()}</TabsContent>
          {!isStaff && <TabsContent value="holidays">{renderHolidaysTab()}</TabsContent>}
          {!isStaff && <TabsContent value="leavetypes">{renderLeaveTypesTab()}</TabsContent>}
          {!isStaff && <TabsContent value="punches">{renderPunchesTab()}</TabsContent>}
          {!isStaff && <TabsContent value="cards">{renderCardsTab()}</TabsContent>}
        </Tabs>

        {/* Form modals */}
        <Modal isOpen={!!modal} onClose={closeModal} type="custom" title={modal ? modalTitle[modal] || "" : ""} size="md">
          {renderModalContent()}
        </Modal>

        {/* Scan-to-punch */}
        <Modal isOpen={scanOpen} onClose={() => setScanOpen(false)} type="custom" title="Scan to Punch" size="md">
          <div className="space-y-3">
            <FormField label="Punch Type" name="scanType" type="select" options={[{ value:"in",label:"Punch In" },{ value:"out",label:"Punch Out" },{ value:"breakstart",label:"Break Start" },{ value:"breakend",label:"Break End" }]} value={scanType} onChange={(e: any) => setScanType(e.target.value)} />
            <div>
              <label className="text-sm font-medium text-gray-700">Scan or type staff code</label>
              <input
                ref={scanInputRef}
                value={scanBuffer}
                onChange={e => setScanBuffer(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleScanSubmit(scanBuffer); setScanBuffer(""); } }}
                placeholder="Scan barcode or type code, press Enter"
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            {scanLog.length > 0 && (
              <div className="border-t pt-3">
                <div className="text-sm font-semibold mb-2">Recent scans</div>
                <div className="max-h-48 overflow-auto space-y-1">
                  {scanLog.map((entry, i) => (
                    <div key={i} className={`text-sm flex justify-between px-2 py-1 rounded ${entry.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                      <span>{entry.staff} · {entry.type}</span>
                      <span className="text-xs">{entry.at}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setScanOpen(false)}>Done</Button>
            </div>
          </div>
        </Modal>
      </div>
    </HomeLayout>
  );
};

export default Attendance;
