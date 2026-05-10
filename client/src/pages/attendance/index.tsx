import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { useNavigate, useLocation } from "react-router";
import { FaPlus, FaPrint, FaQrcode, FaIdBadge } from "react-icons/fa";

import HomeLayout from "../../layouts/home";
import DataTable from "../../components/datatable";
import Modal from "../../components/modal";
import FormField from "../../components/formfiled";
import Button from "../../components/button";
import BarcodeImage from "../../components/barcode";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/tabs";

import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { showMessage } from "../../redux/slices/message";

import {
  GET_ATTENDANCE_LOGS,
  GET_ATTENDANCE_PUNCHES,
  GET_ATTENDANCE_SUMMARY,
  GET_HOLIDAYS,
  GET_LEAVE_TYPES,
  GET_LEAVE_REQUESTS,
  GET_LEAVE_BALANCES,
} from "../../graphql/queries/attendance";
import {
  PUNCH,
  ADD_MANUAL_ATTENDANCE,
  EDIT_ATTENDANCE_LOG,
  DELETE_ATTENDANCE_LOG,
  DELETE_PUNCH,
  ADD_HOLIDAY,
  EDIT_HOLIDAY,
  DELETE_HOLIDAY,
  ADD_LEAVE_TYPE,
  EDIT_LEAVE_TYPE,
  DELETE_LEAVE_TYPE,
  ADD_LEAVE_REQUEST,
  EDIT_LEAVE_REQUEST,
  APPROVE_LEAVE_REQUEST,
  REJECT_LEAVE_REQUEST,
  CANCEL_LEAVE_REQUEST,
  DELETE_LEAVE_REQUEST,
  UPSERT_LEAVE_BALANCE,
  DELETE_LEAVE_BALANCE,
} from "../../graphql/mutations/attendance";
import { GET_STAFF } from "../../graphql/queries/staffaccounts";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
};

const todayStr = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const minutesToHm = (m?: number | null) => {
  if (!m) return "0h 0m";
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

// Capitalize the first letter of any string value (safe for null/undefined/numbers)
const cap = (s?: string | null) => {
  if (!s) return "-";
  const str = String(s);
  if (!str.length) return "-";
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/* ================================================================== */
/* Page                                                               */
/* ================================================================== */

const Attendance: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { type, admin, branch } = useAppSelector((s: any) => s.auth);
  // tab can be passed back via navigation state when returning from deleted page
  const initialTab = (location.state as any)?.tab as
    | "logs" | "punches" | "holidays" | "leavetypes" | "leaverequests" | "balances" | "cards"
    | undefined;
  const adminId =
    type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : undefined;
  const branchId = useAppSelector((s: any) => s.selectedBranch?.branchId);

  const [tab, setTab] = useState<
    | "logs"
    | "punches"
    | "holidays"
    | "leavetypes"
    | "leaverequests"
    | "balances"
    | "cards"
  >(initialTab || "logs");

  /* ---------------- Scan-to-punch ---------------- */
  const [scanOpen, setScanOpen] = useState(false);
  const [scanType, setScanType] = useState<"in" | "out" | "breakstart" | "breakend">("in");
  const [scanBuffer, setScanBuffer] = useState("");
  const [scanLog, setScanLog] = useState<
    { staff: string; type: string; ok: boolean; at: string }[]
  >([]);
  const scanInputRef = useRef<HTMLInputElement>(null);

  /* ---------------- Card print ---------------- */
  const [printIds, setPrintIds] = useState<string[] | null>(null); // ids to print, or null = none
  const printRef = useRef<HTMLDivElement>(null);



  /* ------------------ data ------------------ */
  const logsQ = useQuery(GET_ATTENDANCE_LOGS, {
    variables: { filter: { adminid: adminId, branchid: branchId } },
    skip: !adminId,
  });
  const punchesQ = useQuery(GET_ATTENDANCE_PUNCHES, {
    variables: { filter: { adminid: adminId, branchid: branchId } },
    skip: !adminId,
  });
  const summaryQ = useQuery(GET_ATTENDANCE_SUMMARY, {
    variables: { filter: { adminid: adminId, branchid: branchId } },
    skip: !adminId,
  });
  const holidaysQ = useQuery(GET_HOLIDAYS, {
    variables: { filter: { adminid: adminId } },
    skip: !adminId,
  });
  const leaveTypesQ = useQuery(GET_LEAVE_TYPES, {
    variables: { adminid: adminId },
    skip: !adminId,
  });
  const leaveRequestsQ = useQuery(GET_LEAVE_REQUESTS, {
    variables: { filter: { adminid: adminId, branchid: branchId } },
    skip: !adminId,
  });
  const leaveBalancesQ = useQuery(GET_LEAVE_BALANCES, {
    variables: { filter: { adminid: adminId } },
    skip: !adminId,
  });
  const staffQ = useQuery(GET_STAFF, {
    variables: { filter: { adminId } },
    skip: !adminId,
  });

  /* Refetch all active queries on mount — matches categories module so
     returning from /attendance/deletedentries shows fresh data. */
  useEffect(() => {
    if (!adminId) return;
    logsQ.refetch();
    punchesQ.refetch();
    summaryQ.refetch();
    holidaysQ.refetch();
    leaveTypesQ.refetch();
    leaveRequestsQ.refetch();
    leaveBalancesQ.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminId, branchId]);

  const staffOptions = useMemo(
    () =>
      (staffQ.data?.getStaffAccounts ?? []).map((s: any) => ({
        value: s.id,
        label: `${s.name}${s.staffcode ? ` (${s.staffcode})` : ""}`,
      })),
    [staffQ.data]
  );

  const leaveTypeOptions = useMemo(
    () =>
      (leaveTypesQ.data?.getLeaveTypes ?? []).map((lt: any) => ({
        value: lt.id,
        label: `${lt.name} (${lt.code})`,
      })),
    [leaveTypesQ.data]
  );

  /* ------------------ mutations ------------------ */
  const refetchAll = async () => {
    await Promise.all([
      logsQ.refetch(),
      punchesQ.refetch(),
      summaryQ.refetch(),
      holidaysQ.refetch(),
      leaveTypesQ.refetch(),
      leaveRequestsQ.refetch(),
      leaveBalancesQ.refetch(),
    ]);
  };

  const [punchMut] = useMutation(PUNCH);
  const [addManualMut] = useMutation(ADD_MANUAL_ATTENDANCE);
  const [editLogMut] = useMutation(EDIT_ATTENDANCE_LOG);
  const [deleteLogMut] = useMutation(DELETE_ATTENDANCE_LOG);
  const [deletePunchMut] = useMutation(DELETE_PUNCH);
  const [addHolidayMut] = useMutation(ADD_HOLIDAY);
  const [editHolidayMut] = useMutation(EDIT_HOLIDAY);
  const [deleteHolidayMut] = useMutation(DELETE_HOLIDAY);
  const [addLeaveTypeMut] = useMutation(ADD_LEAVE_TYPE);
  const [editLeaveTypeMut] = useMutation(EDIT_LEAVE_TYPE);
  const [deleteLeaveTypeMut] = useMutation(DELETE_LEAVE_TYPE);
  const [addLeaveReqMut] = useMutation(ADD_LEAVE_REQUEST);
  const [editLeaveReqMut] = useMutation(EDIT_LEAVE_REQUEST);
  const [approveLeaveReqMut] = useMutation(APPROVE_LEAVE_REQUEST);
  const [rejectLeaveReqMut] = useMutation(REJECT_LEAVE_REQUEST);
  const [cancelLeaveReqMut] = useMutation(CANCEL_LEAVE_REQUEST);
  const [deleteLeaveReqMut] = useMutation(DELETE_LEAVE_REQUEST);
  const [upsertLeaveBalMut] = useMutation(UPSERT_LEAVE_BALANCE);
  const [deleteLeaveBalMut] = useMutation(DELETE_LEAVE_BALANCE);


  const notify = (msg: string, type: "success" | "error" = "success") =>
    dispatch(showMessage({ message: msg, type }));

  /* ------------------ modal state ------------------ */
  type ModalKind =
    | null
    | "punch"
    | "manualAttendance"
    | "editLog"
    | "holiday"
    | "leaveType"
    | "leaveRequest"
    | "rejectLeave"
    | "leaveBalance";

  const [modal, setModal] = useState<ModalKind>(null);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const openModal = (kind: ModalKind, initial: any = {}, editingRow: any = null) => {
    setModal(kind);
    setForm(initial);
    setEditing(editingRow);
    setFormErrors({});
  };
  const closeModal = () => {
    setModal(null);
    setEditing(null);
    setForm({});
    setFormErrors({});
  };

  const onChange = (e: any) => {
    const { name, value, type: t, checked } = e.target;
    setForm((prev: any) => ({
      ...prev,
      [name]: t === "checkbox" ? checked : value,
    }));
    // Clear error for the changed field so the red border disappears as
    // the user types — same behaviour as the categories module.
    if (name && formErrors[name]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  /* ------------------ validation ------------------ */
  // Required-field rules per modal kind, mirroring the Categories module's
  // validateForm() pattern. Returns true when no errors were found.
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const req = (key: string, label: string) => {
      const v = form[key];
      if (v === undefined || v === null || (typeof v === "string" && !v.trim())) {
        errors[key] = `${label} is required`;
      }
    };

    switch (modal) {
      case "punch":
        req("staffid", "Staff");
        req("type", "Type");
        break;
      case "manualAttendance":
      case "editLog":
        req("staffid", "Staff");
        req("date", "Date");
        req("status", "Status");
        break;
      case "holiday":
        req("date", "Date");
        req("name", "Name");
        req("type", "Type");
        break;
      case "leaveType":
        req("name", "Name");
        req("code", "Code");
        req("accrualType", "Accrual Type");
        if (
          form.totalDaysPerYear === "" ||
          form.totalDaysPerYear === null ||
          form.totalDaysPerYear === undefined ||
          isNaN(parseFloat(form.totalDaysPerYear))
        ) {
          errors.totalDaysPerYear = "Days / Year is required";
        }
        break;
      case "leaveRequest":
        req("staffid", "Staff");
        req("leavetypeid", "Leave Type");
        req("fromDate", "From date");
        req("toDate", "To date");
        req("reason", "Reason");
        if (
          form.totalDays === "" ||
          form.totalDays === null ||
          form.totalDays === undefined ||
          isNaN(parseFloat(form.totalDays))
        ) {
          errors.totalDays = "Total days is required";
        }
        break;
      case "rejectLeave":
        req("rejectionReason", "Rejection reason");
        break;
      case "leaveBalance":
        req("staffid", "Staff");
        req("leavetypeid", "Leave Type");
        req("year", "Year");
        break;
      default:
        break;
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      notify("Please fix the highlighted fields", "error");
      return false;
    }
    return true;
  };

  /* ================================================================ */
  /* Scan-to-punch                                                    */
  /* ================================================================ */
  useEffect(() => {
    if (scanOpen && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [scanOpen]);

  const handleScanSubmit = async (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    const staff = (staffQ.data?.getStaffAccounts ?? []).find(
      (s: any) => s.id === value || s.staffcode === value
    );
    if (!staff) {
      setScanLog((prev) => [
        { staff: value, type: scanType, ok: false, at: new Date().toLocaleTimeString() },
        ...prev,
      ]);
      notify(`Unknown staff code: ${value}`, "error");
      return;
    }
    try {
      await punchMut({
        variables: {
          input: {
            staffid: staff.id,
            type: scanType,
            source: "kiosk",
            remarks: "Scanned via card",
          },
        },
      });
      setScanLog((prev) => [
        { staff: staff.name, type: scanType, ok: true, at: new Date().toLocaleTimeString() },
        ...prev,
      ]);
      notify(`${staff.name} punched ${scanType}`);
      await refetchAll();
    } catch (e: any) {
      setScanLog((prev) => [
        { staff: staff.name, type: scanType, ok: false, at: new Date().toLocaleTimeString() },
        ...prev,
      ]);
      notify(e?.message || "Punch failed", "error");
    }
  };

  /* ================================================================ */
  /* Card printing                                                    */
  /* ================================================================ */
  const handlePrintCards = (ids: string[]) => {
    setPrintIds(ids);
    // Allow render then trigger print
    setTimeout(() => {
      const html = printRef.current?.innerHTML;
      if (!html) return;
      const w = window.open("", "_blank", "width=900,height=700");
      if (!w) return;
      w.document.write(`
        <html>
          <head>
            <title>Staff Cards</title>
            <style>
              @page { size: A4; margin: 8mm; }
              body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
              .grid {
                display: grid;
                grid-template-columns: repeat(4, 54mm);
                gap: 4mm;
                justify-content: start;
              }
              .card {
                width: 54mm;
                height: 86mm;
                border: 0.4mm solid #cccccc;
                border-radius: 2mm;
                background: #fff;
                display: flex;
                flex-direction: column;
                align-items: center;
                page-break-inside: avoid;
                overflow: hidden;
                box-sizing: border-box;
                padding: 0 3mm 3mm 3mm;
              }
              .card-company {
                margin-top: 2.5mm;
                font-size: 6pt;
                font-weight: 700;
                letter-spacing: 0.6pt;
                color: #555;
                text-transform: uppercase;
                text-align: center;
                width: 100%;
              }
              .photo {
                width: 22mm;
                height: 22mm;
                border-radius: 50%;
                object-fit: cover;
                margin-top: 2mm;
                background: #eee;
                border: 0.6mm solid #999;
              }
              .photo.placeholder {
                display: flex;
                align-items: center;
                justify-content: center;
                color: #fff;
                background: #2563eb;
                font-size: 14pt;
                font-weight: 700;
              }
              .name {
                margin-top: 2mm;
                font-size: 10pt;
                font-weight: 700;
                text-align: center;
                color: #111;
                line-height: 1.1;
              }
              .role {
                margin-top: 0.6mm;
                font-size: 6.5pt;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.4pt;
              }
              .meta {
                margin-top: 1mm;
                font-size: 7pt;
                color: #555;
                font-family: monospace;
              }
              .barcode-wrap {
                margin-top: auto;
                width: 100%;
                display: flex;
                justify-content: center;
                padding-top: 2mm;
              }
              .barcode-wrap svg {
                height: 12mm !important;
                width: auto !important;
                display: block;
              }
            </style>
          </head>
          <body>
            <div class="grid">${html}</div>
            <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };</script>
          </body>
        </html>
      `);
      w.document.close();
      setPrintIds(null);
    }, 50);
  };

  /* ================================================================ */
  /* TAB: Daily Logs                                                  */
  /* ================================================================ */
  const logRows = (logsQ.data?.getAttendanceLogs ?? []).map((l: any, i: number) => ({
    ...l,
    seqNo: i + 1,
    staffName: cap(l.staffid?.name),
    staffCode: l.staffid?.staffcode ?? "-",
    firstIn: fmtDateTime(l.firstPunchIn),
    lastOut: fmtDateTime(l.lastPunchOut),
    work: minutesToHm(l.totalWorkMinutes),
    statusLabel: cap(l.status),
  }));

  const summary = summaryQ.data?.getAttendanceSummary;

  const renderLogsTab = () => (
    <>
      <div className="flex flex-wrap gap-2 justify-end mb-3">
        <Button
          variant="outline"
          icon={<FaQrcode />}
          onClick={() => {
            setScanType("in");
            setScanBuffer("");
            setScanOpen(true);
          }}
        >
          Scan to Punch
        </Button>
        <Button
          variant="outline"
          icon={<FaPlus />}
          onClick={() =>
            openModal("punch", {
              staffid: "",
              type: "in",
              source: "web",
              remarks: "",
            })
          }
        >
          Record Punch
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
          {[
            ["Total", summary.totalDays],
            ["Present", summary.presentDays],
            ["Half", summary.halfDays],
            ["Leave", summary.leaveDays],
            ["Absent", summary.absentDays],
            ["Holiday", summary.holidayDays],
            ["Late", summary.lateDays],
            ["OT (m)", summary.overtimeMinutes],
          ].map(([label, value]) => (
            <div
              key={label as string}
              className="bg-white rounded-lg border border-gray-200 px-3 py-2"
            >
              <div className="text-xs text-gray-500">{label}</div>
              <div className="text-lg font-semibold">{value as number}</div>
            </div>
          ))}
        </div>
      )}

      <DataTable
        title="Attendance Daily Logs"
        columns={[
          { label: "Seq", key: "seqNo" },
          { label: "Date", key: "date" },
          { label: "Staff", key: "staffName" },
          { label: "Code", key: "staffCode" },
          { label: "Status", key: "statusLabel" },
          { label: "First In", key: "firstIn" },
          { label: "Last Out", key: "lastOut" },
          { label: "Work", key: "work" },
        ]}
        data={logRows}
        showAdd={true}
        showEdit={true}
        showDelete={true}
        showReset={false}
        showView={false}
        showImport={false}
        showExport={false}
        showDeleted={true}
        onShowDeleted={() =>
          navigate("/attendance/deletedentries", { state: { from: "logs" } })
        }
        onAdd={() =>
          openModal("manualAttendance", {
            staffid: "",
            date: todayStr(),
            status: "present",
            firstPunchIn: "",
            lastPunchOut: "",
            notes: "",
          })
        }
        onEdit={(row) =>
          openModal(
            "editLog",
            {
              staffid: row.staffid?.id ?? "",
              date: row.date,
              status: row.status,
              firstPunchIn: row.firstPunchIn ? row.firstPunchIn.slice(0, 16) : "",
              lastPunchOut: row.lastPunchOut ? row.lastPunchOut.slice(0, 16) : "",
              notes: row.notes ?? "",
            },
            row
          )
        }
        onDelete={async (row) => {
          if (!window.confirm(`Delete attendance log for ${row.staffName} on ${row.date}?`))
            return;
          try {
            await deleteLogMut({ variables: { id: row.id } });
            await logsQ.refetch();
            notify("Log deleted.");
          } catch {
            notify("Failed to delete log.", "error");
          }
        }}
        isLoading={logsQ.loading}
        defaultEntriesPerPage={10}
      />
    </>
  );

  /* ================================================================ */
  /* TAB: Punches                                                     */
  /* ================================================================ */
  const punchRows = (punchesQ.data?.getAttendancePunches ?? []).map(
    (p: any, i: number) => ({
      ...p,
      seqNo: i + 1,
      type: cap(p.type),
      source: cap(p.source),
      address: p.address ?? "-",
      remarks: p.remarks ?? "-",
      when: fmtDateTime(p.timestamp),
    })
  );

  const renderPunchesTab = () => (
    <DataTable
      title="Punches"
      columns={[
        { label: "Seq", key: "seqNo" },
        { label: "Type", key: "type" },
        { label: "When", key: "when" },
        { label: "Source", key: "source" },
        { label: "Address", key: "address" },
        { label: "Remarks", key: "remarks" },
      ]}
      data={punchRows}
      showAdd={false}
      showEdit={false}
      showDelete={false}
      showView={false}
      showImport={false}
      showExport={false}
      showDeleted={false}
      isLoading={punchesQ.loading}
      defaultEntriesPerPage={10}
    />
  );

  /* ================================================================ */
  /* TAB: Holidays                                                    */
  /* ================================================================ */
  const holidayRows = (holidaysQ.data?.getHolidays ?? []).map((h: any, i: number) => ({
    ...h,
    seqNo: i + 1,
    // Display-only labels (capitalized). Original `name`, `type`, `description`
    // are preserved on the row so edit forms get the raw values that match
    // dropdown option values (e.g. "public", not "Public").
    nameLabel: cap(h.name),
    typeLabel: cap(h.type),
    descriptionLabel: h.description ?? "-",
  }));

  const renderHolidaysTab = () => (
    <>
      <DataTable
        title="Holidays"
        columns={[
          { label: "Seq", key: "seqNo" },
          { label: "Date", key: "date" },
          { label: "Name", key: "nameLabel" },
          { label: "Type", key: "typeLabel" },
          { label: "Description", key: "descriptionLabel" },
        ]}
        data={holidayRows}
        showAdd={true}
        showEdit={true}
        showDelete={true}
        showReset={false}
        showView={false}
        showImport={false}
        showExport={false}
        showDeleted={true}
        onShowDeleted={() =>
          navigate("/attendance/deletedentries", { state: { from: "holidays" } })
        }
        onAdd={() =>
          openModal("holiday", {
            date: todayStr(),
            name: "",
            type: "public",
            description: "",
          })
        }
        onEdit={(row) =>
          openModal(
            "holiday",
            {
              date: row.date,
              name: row.name,
              type: row.type,
              description: row.description ?? "",
            },
            row
          )
        }
        onDelete={async (row) => {
          if (!window.confirm(`Delete holiday "${row.name}"?`)) return;
          try {
            await deleteHolidayMut({ variables: { id: row.id } });
            await holidaysQ.refetch();
            notify("Holiday deleted.");
          } catch {
            notify("Failed to delete holiday.", "error");
          }
        }}
        isLoading={holidaysQ.loading}
        defaultEntriesPerPage={10}
      />
    </>
  );

  /* ================================================================ */
  /* TAB: Leave Types                                                 */
  /* ================================================================ */
  const leaveTypeRows = (leaveTypesQ.data?.getLeaveTypes ?? []).map(
    (lt: any, i: number) => ({
      ...lt,
      seqNo: i + 1,
      // Display-only labels (capitalized). Original `name`, `code`, `accrualType`
      // are preserved so the edit form's dropdown values match.
      nameLabel: cap(lt.name),
      codeLabel: cap(lt.code),
      accrualLabel: cap(lt.accrualType),
      paid: lt.isPaid ? "Yes" : "No",
    })
  );

  const renderLeaveTypesTab = () => (
    <>
      <DataTable
        title="Leave Types"
        columns={[
          { label: "Seq", key: "seqNo" },
          { label: "Code", key: "codeLabel" },
          { label: "Name", key: "nameLabel" },
          { label: "Days/Yr", key: "totalDaysPerYear" },
          { label: "Paid", key: "paid" },
          { label: "Accrual", key: "accrualLabel" },
        ]}
        data={leaveTypeRows}
        showAdd={true}
        showEdit={true}
        showDelete={true}
        showReset={false}
        showView={false}
        showImport={false}
        showExport={false}
        showDeleted={true}
        onShowDeleted={() =>
          navigate("/attendance/deletedentries", { state: { from: "leavetypes" } })
        }
        onAdd={() =>
          openModal("leaveType", {
            name: "",
            code: "",
            totalDaysPerYear: 0,
            accrualType: "yearly",
            carryForward: false,
            maxCarryForward: 0,
            isPaid: true,
            allowHalfDay: true,
            requiresApproval: true,
            requiresAttachment: false,
            color: "#3b82f6",
            description: "",
            status: true,
          })
        }
        onEdit={(row) =>
          openModal(
            "leaveType",
            {
              name: row.name,
              code: row.code,
              totalDaysPerYear: row.totalDaysPerYear ?? 0,
              accrualType: row.accrualType ?? "yearly",
              carryForward: !!row.carryForward,
              maxCarryForward: row.maxCarryForward ?? 0,
              isPaid: !!row.isPaid,
              allowHalfDay: !!row.allowHalfDay,
              requiresApproval: !!row.requiresApproval,
              requiresAttachment: !!row.requiresAttachment,
              color: row.color ?? "#3b82f6",
              description: row.description ?? "",
              status: row.status ?? true,
            },
            row
          )
        }
        onDelete={async (row) => {
          if (!window.confirm(`Delete leave type "${row.name}"?`)) return;
          try {
            await deleteLeaveTypeMut({ variables: { id: row.id } });
            await leaveTypesQ.refetch();
            notify("Leave type deleted.");
          } catch {
            notify("Failed to delete leave type.", "error");
          }
        }}
        isLoading={leaveTypesQ.loading}
        defaultEntriesPerPage={10}
      />
    </>
  );

  /* ================================================================ */
  /* TAB: Leave Requests                                              */
  /* ================================================================ */
  const requestRows = (leaveRequestsQ.data?.getLeaveRequests ?? []).map(
    (r: any, i: number) => ({
      ...r,
      seqNo: i + 1,
      staffName: cap(r.staffid?.name),
      typeName: cap(r.leavetypeid?.name),
      range: `${r.fromDate} → ${r.toDate}`,
      status: cap(r.status),
      reason: cap(r.reason),
    })
  );

  const handleApprove = async (row: any) => {
    try {
      await approveLeaveReqMut({
        variables: {
          id: row.id,
          approverid: admin?.id ?? branch?.id ?? null,
          approverName: admin?.name ?? branch?.branchname ?? "Approver",
          approverType: type,
        },
      });
      await Promise.all([leaveRequestsQ.refetch(), leaveBalancesQ.refetch()]);
      notify("Leave approved.");
    } catch {
      notify("Failed to approve.", "error");
    }
  };

  const handleCancel = async (row: any) => {
    if (!window.confirm("Cancel this leave request?")) return;
    try {
      await cancelLeaveReqMut({ variables: { id: row.id } });
      await Promise.all([leaveRequestsQ.refetch(), leaveBalancesQ.refetch()]);
      notify("Leave cancelled.");
    } catch {
      notify("Failed to cancel.", "error");
    }
  };

  const renderLeaveRequestsTab = () => (
    <>
      <DataTable
        title="Leave Requests"
        columns={[
          { label: "Seq", key: "seqNo" },
          { label: "Staff", key: "staffName" },
          { label: "Type", key: "typeName" },
          { label: "Dates", key: "range" },
          { label: "Days", key: "totalDays" },
          { label: "Status", key: "status" },
          { label: "Reason", key: "reason" },
        ]}
        data={requestRows}
        showAdd={true}
        showEdit={true}
        showDelete={true}
        showReset={false}
        showView={false}
        showImport={false}
        showExport={false}
        showDeleted={true}
        onShowDeleted={() =>
          navigate("/attendance/deletedentries", { state: { from: "leaverequests" } })
        }
        onAdd={() =>
          openModal("leaveRequest", {
            staffid: "",
            leavetypeid: "",
            fromDate: todayStr(),
            toDate: todayStr(),
            halfDay: false,
            totalDays: 1,
            reason: "",
          })
        }
        onEdit={(row) =>
          openModal(
            "leaveRequest",
            {
              staffid: row.staffid?.id ?? "",
              leavetypeid: row.leavetypeid?.id ?? "",
              fromDate: row.fromDate,
              toDate: row.toDate,
              halfDay: !!row.halfDay,
              totalDays: row.totalDays,
              reason: row.reason ?? "",
            },
            row
          )
        }
        onDelete={async (row) => {
          if (!window.confirm("Delete this leave request?")) return;
          try {
            await deleteLeaveReqMut({ variables: { id: row.id } });
            await leaveRequestsQ.refetch();
            notify("Leave request deleted.");
          } catch {
            notify("Failed to delete.", "error");
          }
        }}
        isLoading={leaveRequestsQ.loading}
        defaultEntriesPerPage={10}
      />
    </>
  );

  /* Inline approve/reject/cancel row buttons (rendered separately) */
  const requestActions = requestRows
    .filter((r: any) => r.status === "pending")
    .slice(0, 5);

  /* ================================================================ */
  /* TAB: Leave Balances                                              */
  /* ================================================================ */
  const balanceRows = (leaveBalancesQ.data?.getLeaveBalances ?? []).map(
    (b: any, i: number) => ({
      ...b,
      seqNo: i + 1,
      staffName: cap(b.staffid?.name),
      typeName: cap(b.leavetypeid?.name),
    })
  );

  const renderLeaveBalancesTab = () => (
    <DataTable
      title="Leave Balances"
      columns={[
        { label: "Seq", key: "seqNo" },
        { label: "Staff", key: "staffName" },
        { label: "Type", key: "typeName" },
        { label: "Year", key: "year" },
        { label: "Allocated", key: "allocated" },
        { label: "Used", key: "used" },
        { label: "Pending", key: "pending" },
        { label: "C/F", key: "carriedForward" },
        { label: "Balance", key: "balance" },
      ]}
      data={balanceRows}
      showAdd={true}
      showEdit={true}
      showDelete={true}
      showReset={false}
      showView={false}
      showImport={false}
      showExport={false}
      showDeleted={true}
      onShowDeleted={() =>
        navigate("/attendance/deletedentries", { state: { from: "balances" } })
      }
      onAdd={() =>
        openModal("leaveBalance", {
          staffid: "",
          leavetypeid: "",
          year: new Date().getFullYear(),
          allocated: 0,
          carriedForward: 0,
        })
      }
      onEdit={(row) =>
        openModal(
          "leaveBalance",
          {
            staffid: row.staffid?.id ?? "",
            leavetypeid: row.leavetypeid?.id ?? "",
            year: row.year,
            allocated: row.allocated,
            carriedForward: row.carriedForward,
          },
          row
        )
      }
      onDelete={async (row) => {
        if (!window.confirm(`Delete leave balance for ${row.staffName} (${row.typeName}) year ${row.year}?`))
          return;
        try {
          await deleteLeaveBalMut({ variables: { id: row.id } });
          await leaveBalancesQ.refetch();
          notify("Leave balance deleted.");
        } catch {
          notify("Failed to delete leave balance.", "error");
        }
      }}
      isLoading={leaveBalancesQ.loading}
      defaultEntriesPerPage={10}
    />
  );

  /* ================================================================ */
  /* TAB: Staff Cards                                                 */
  /* ================================================================ */
  const staffList = staffQ.data?.getStaffAccounts ?? [];

  // Role → accent color
  const roleColor = (role?: string) => {
    switch (role) {
      case "salesman":
        return "#16a34a"; // green
      case "deliveryboy":
        return "#ea580c"; // orange
      default:
        return "#2563eb"; // blue
    }
  };

  const companyName =
    admin?.companyName ||
    branch?.admin?.companyName ||
    branch?.branchname ||
    "STAFF ID";

  const StaffCard: React.FC<{ s: any; print?: boolean }> = ({ s, print }) => {
    const code = s.staffcode || s.id;
    const accent = roleColor(s.role);
    const photo = s.imageurl || s.profilepicture;

    if (print) {
      // Print version — uses CSS classes from the print stylesheet (54×86mm portrait)
      return (
        <div className="card" style={{ borderTop: `3mm solid ${accent}` }}>
          <div className="card-company">{companyName}</div>
          {photo ? (
            <img src={photo} alt={s.name} className="photo" />
          ) : (
            <div className="photo placeholder">{s.name?.[0] ?? "?"}</div>
          )}
          <div className="name">{s.name}</div>
          <div className="role" style={{ color: accent }}>
            {s.role}
          </div>
          <div className="meta">{code}</div>
          <div className="barcode-wrap">
            <BarcodeImage value={code} />
          </div>
        </div>
      );
    }

    // Compact on-screen card (~200px wide)
    return (
      <div className="w-full bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
        <div className="h-1.5" style={{ background: accent }} />
        <div className="px-2.5 pt-2 pb-1 text-[10px] text-gray-500 uppercase tracking-wider font-semibold truncate">
          {companyName}
        </div>
        <div className="flex flex-col items-center px-2 pb-2">
          {photo ? (
            <img
              src={photo}
              alt={s.name}
              className="w-12 h-12 rounded-full object-cover border-2"
              style={{ borderColor: accent }}
            />
          ) : (
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-base border-2"
              style={{ background: accent, borderColor: accent }}
            >
              {s.name?.[0] ?? "?"}
            </div>
          )}
          <div className="mt-1.5 text-sm font-semibold text-gray-800 text-center truncate w-full">
            {s.name}
          </div>
          <div
            className="text-[9px] uppercase font-semibold tracking-wide"
            style={{ color: accent }}
          >
            {s.role}
          </div>
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

  const renderCardsTab = () => (
    <>
      <div className="flex justify-between items-center mb-3">
        <div className="text-sm text-gray-600">
          {staffList.length} staff member{staffList.length === 1 ? "" : "s"}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            icon={<FaPrint />}
            onClick={() => handlePrintCards(staffList.map((s: any) => s.id))}
            disabled={!staffList.length}
          >
            Print All Cards
          </Button>
        </div>
      </div>

      {staffList.length === 0 ? (
        <div className="text-center text-gray-500 py-12 border border-dashed rounded-lg">
          No staff members found.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {staffList.map((s: any) => (
            <div key={s.id} className="flex flex-col items-center gap-1 w-[180px]">
              <StaffCard s={s} />
              <button
                onClick={() => handlePrintCards([s.id])}
                className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
              >
                <FaIdBadge size={10} /> Print
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Hidden printable area; populated when printIds is set */}
      <div style={{ position: "absolute", left: -99999, top: -99999 }}>
        <div ref={printRef}>
          {printIds &&
            staffList
              .filter((s: any) => printIds.includes(s.id))
              .map((s: any) => <StaffCard key={s.id} s={s} print />)}
        </div>
      </div>
    </>
  );

  /* ================================================================ */
  /* Modal handlers                                                   */
  /* ================================================================ */
  const submitPunch = async () => {
    if (!validateForm()) return;
    try {
      await punchMut({
        variables: {
          input: {
            staffid: form.staffid,
            type: form.type,
            timestamp: form.timestamp || undefined,
            latitude: form.latitude ? parseFloat(form.latitude) : undefined,
            longitude: form.longitude ? parseFloat(form.longitude) : undefined,
            address: form.address || undefined,
            source: form.source || "web",
            remarks: form.remarks || undefined,
          },
        },
      });
      await refetchAll();
      notify("Punch recorded.");
      closeModal();
    } catch (e: any) {
      notify(e?.message || "Failed to record punch", "error");
    }
  };

  const submitManualAttendance = async () => {
    if (!validateForm()) return;
    try {
      // NOTE: ManualAttendanceInput on the server only accepts the fields
      // below. adminid/branchid are derived from the staff record by the
      // resolver, so do NOT send them or the GraphQL validator will reject
      // the request and the entry won't be saved.
      await addManualMut({
        variables: {
          input: {
            staffid: form.staffid,
            date: form.date,
            status: form.status,
            firstPunchIn: form.firstPunchIn || undefined,
            lastPunchOut: form.lastPunchOut || undefined,
            notes: form.notes || undefined,
          },
        },
      });
      await refetchAll();
      notify("Attendance saved.");
      closeModal();
    } catch (e: any) {
      notify(e?.message || "Failed to save", "error");
    }
  };

  const submitEditLog = async () => {
    if (!editing?.id) return;
    if (!validateForm()) return;
    try {
      await editLogMut({
        variables: {
          id: editing.id,
          input: {
            staffid: form.staffid,
            date: form.date,
            status: form.status,
            firstPunchIn: form.firstPunchIn || undefined,
            lastPunchOut: form.lastPunchOut || undefined,
            notes: form.notes || undefined,
          },
        },
      });
      await refetchAll();
      notify("Log updated.");
      closeModal();
    } catch (e: any) {
      notify(e?.message || "Failed to update", "error");
    }
  };

  const submitHoliday = async () => {
    if (!validateForm()) return;
    try {
      const input = {
        adminid: adminId,
        branchid: branchId || undefined,
        date: form.date,
        name: form.name,
        type: form.type || "public",
        description: form.description || undefined,
        status: true,
      };
      if (editing?.id) {
        await editHolidayMut({ variables: { id: editing.id, input } });
        notify("Holiday updated.");
      } else {
        await addHolidayMut({ variables: { input } });
        notify("Holiday added.");
      }
      await holidaysQ.refetch();
      closeModal();
    } catch (e: any) {
      notify(e?.message || "Failed to save holiday", "error");
    }
  };

  const submitLeaveType = async () => {
    if (!validateForm()) return;
    try {
      const input = {
        adminid: adminId,
        name: form.name,
        code: form.code,
        totalDaysPerYear: parseFloat(form.totalDaysPerYear) || 0,
        accrualType: form.accrualType || "yearly",
        carryForward: !!form.carryForward,
        maxCarryForward: parseFloat(form.maxCarryForward) || 0,
        isPaid: !!form.isPaid,
        allowHalfDay: !!form.allowHalfDay,
        requiresApproval: !!form.requiresApproval,
        requiresAttachment: !!form.requiresAttachment,
        color: form.color || "#3b82f6",
        description: form.description || undefined,
        status: true,
      };
      if (editing?.id) {
        await editLeaveTypeMut({ variables: { id: editing.id, input } });
        notify("Leave type updated.");
      } else {
        await addLeaveTypeMut({ variables: { input } });
        notify("Leave type added.");
      }
      await leaveTypesQ.refetch();
      closeModal();
    } catch (e: any) {
      notify(e?.message || "Failed to save", "error");
    }
  };

  const submitLeaveRequest = async () => {
    if (!validateForm()) return;
    try {
      const input = {
        adminid: adminId,
        branchid: branchId,
        staffid: form.staffid,
        leavetypeid: form.leavetypeid,
        fromDate: form.fromDate,
        toDate: form.toDate,
        halfDay: !!form.halfDay,
        halfDaySession: form.halfDaySession || undefined,
        totalDays: parseFloat(form.totalDays) || 1,
        reason: form.reason,
        attachmentUrl: form.attachmentUrl || undefined,
      };
      if (editing?.id) {
        await editLeaveReqMut({ variables: { id: editing.id, input } });
        notify("Leave request updated.");
      } else {
        await addLeaveReqMut({ variables: { input } });
        notify("Leave request submitted.");
      }
      await Promise.all([leaveRequestsQ.refetch(), leaveBalancesQ.refetch()]);
      closeModal();
    } catch (e: any) {
      notify(e?.message || "Failed to submit", "error");
    }
  };

  const submitReject = async () => {
    if (!editing?.id) return;
    if (!validateForm()) return;
    try {
      await rejectLeaveReqMut({
        variables: {
          id: editing.id,
          rejectionReason: form.rejectionReason,
          approverid: admin?.id ?? branch?.id ?? null,
          approverName: admin?.name ?? branch?.branchname ?? "Approver",
          approverType: type,
        },
      });
      await Promise.all([leaveRequestsQ.refetch(), leaveBalancesQ.refetch()]);
      notify("Leave rejected.");
      closeModal();
    } catch (e: any) {
      notify(e?.message || "Failed to reject", "error");
    }
  };

  const submitLeaveBalance = async () => {
    if (!validateForm()) return;
    try {
      await upsertLeaveBalMut({
        variables: {
          input: {
            adminid: adminId,
            staffid: form.staffid,
            leavetypeid: form.leavetypeid,
            year: parseInt(form.year, 10),
            allocated: parseFloat(form.allocated) || 0,
            carriedForward: parseFloat(form.carriedForward) || 0,
          },
        },
      });
      await leaveBalancesQ.refetch();
      notify("Balance saved.");
      closeModal();
    } catch (e: any) {
      notify(e?.message || "Failed to save balance", "error");
    }
  };

  /* ================================================================ */
  /* Modal content per kind                                           */
  /* ================================================================ */
  const renderModalContent = () => {
    if (!modal) return null;

    const buttons = (onSubmit: () => void) => (
      <div className="flex justify-end gap-3 pt-4">
        <Button variant="outline" onClick={closeModal}>
          Cancel
        </Button>
        <Button variant="outline" onClick={onSubmit}>
          Save
        </Button>
      </div>
    );

    if (modal === "punch") {
      return (
        <div className="space-y-3">
          <FormField
            label="Staff"
            name="staffid"
            type="select"
            options={staffOptions}
            value={form.staffid}
            onChange={onChange}
            searchable
            required
            error={formErrors.staffid}
          />
          <FormField
            label="Type"
            name="type"
            type="select"
            options={[
              { value: "in", label: "Punch In" },
              { value: "out", label: "Punch Out" },
              { value: "breakstart", label: "Break Start" },
              { value: "breakend", label: "Break End" },
            ]}
            value={form.type}
            onChange={onChange}
            required
            error={formErrors.type}
          />
          <FormField
            label="Timestamp (optional)"
            name="timestamp"
            type="datetime-local"
            value={form.timestamp}
            onChange={onChange}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Latitude"
              name="latitude"
              type="number"
              value={form.latitude}
              onChange={onChange}
            />
            <FormField
              label="Longitude"
              name="longitude"
              type="number"
              value={form.longitude}
              onChange={onChange}
            />
          </div>
          <FormField
            label="Address"
            name="address"
            value={form.address}
            onChange={onChange}
          />
          <FormField
            label="Source"
            name="source"
            type="select"
            options={[
              { value: "web", label: "Web" },
              { value: "mobile", label: "Mobile" },
              { value: "biometric", label: "Biometric" },
              { value: "kiosk", label: "Kiosk" },
              { value: "manual", label: "Manual" },
            ]}
            value={form.source}
            onChange={onChange}
          />
          <FormField
            label="Remarks"
            name="remarks"
            value={form.remarks}
            onChange={onChange}
          />
          {buttons(submitPunch)}
        </div>
      );
    }

    if (modal === "manualAttendance" || modal === "editLog") {
      return (
        <div className="space-y-3">
          <FormField
            label="Staff"
            name="staffid"
            type="select"
            options={staffOptions}
            value={form.staffid}
            onChange={onChange}
            searchable
            disabled={modal === "editLog"}
            required
            error={formErrors.staffid}
          />
          <FormField
            label="Date"
            name="date"
            type="date"
            value={form.date}
            onChange={onChange}
            disabled={modal === "editLog"}
            required
            error={formErrors.date}
          />
          <FormField
            label="Status"
            name="status"
            type="select"
            options={[
              { value: "present", label: "Present" },
              { value: "absent", label: "Absent" },
              { value: "halfday", label: "Half Day" },
              { value: "leave", label: "Leave" },
              { value: "holiday", label: "Holiday" },
              { value: "weekoff", label: "Week Off" },
            ]}
            value={form.status}
            onChange={onChange}
            required
            error={formErrors.status}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="First Punch In"
              name="firstPunchIn"
              type="datetime-local"
              value={form.firstPunchIn}
              onChange={onChange}
            />
            <FormField
              label="Last Punch Out"
              name="lastPunchOut"
              type="datetime-local"
              value={form.lastPunchOut}
              onChange={onChange}
            />
          </div>
          <FormField
            label="Notes"
            name="notes"
            value={form.notes}
            onChange={onChange}
          />
          {buttons(modal === "editLog" ? submitEditLog : submitManualAttendance)}
        </div>
      );
    }

    if (modal === "holiday") {
      return (
        <div className="space-y-3">
          <FormField
            label="Date"
            name="date"
            type="date"
            value={form.date}
            onChange={onChange}
            required
            error={formErrors.date}
          />
          <FormField
            label="Name"
            name="name"
            value={form.name}
            onChange={onChange}
            required
            error={formErrors.name}
          />
          <FormField
            label="Type"
            name="type"
            type="select"
            options={[
              { value: "public", label: "Public" },
              { value: "company", label: "Company" },
              { value: "regional", label: "Regional" },
              { value: "optional", label: "Optional" },
            ]}
            value={form.type}
            onChange={onChange}
            required
            error={formErrors.type}
          />
          <FormField
            label="Description"
            name="description"
            value={form.description}
            onChange={onChange}
          />
          {buttons(submitHoliday)}
        </div>
      );
    }

    if (modal === "leaveType") {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Name"
              name="name"
              value={form.name}
              onChange={onChange}
              required
              error={formErrors.name}
            />
            <FormField
              label="Code"
              name="code"
              value={form.code}
              onChange={onChange}
              required
              error={formErrors.code}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Days / Year"
              name="totalDaysPerYear"
              type="number"
              value={form.totalDaysPerYear}
              onChange={onChange}
              required
              error={formErrors.totalDaysPerYear}
            />
            <FormField
              label="Accrual"
              name="accrualType"
              type="select"
              options={[
                { value: "yearly", label: "Yearly" },
                { value: "monthly", label: "Monthly" },
                { value: "quarterly", label: "Quarterly" },
                { value: "none", label: "None" },
              ]}
              value={form.accrualType}
              onChange={onChange}
              required
              error={formErrors.accrualType}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Carry Forward"
              name="carryForward"
              type="checkbox"
              value={form.carryForward}
              onChange={onChange}
            />
            <FormField
              label="Max Carry Fwd"
              name="maxCarryForward"
              type="number"
              value={form.maxCarryForward}
              onChange={onChange}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Paid"
              name="isPaid"
              type="checkbox"
              value={form.isPaid}
              onChange={onChange}
            />
            <FormField
              label="Allow Half Day"
              name="allowHalfDay"
              type="checkbox"
              value={form.allowHalfDay}
              onChange={onChange}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Requires Approval"
              name="requiresApproval"
              type="checkbox"
              value={form.requiresApproval}
              onChange={onChange}
            />
            <FormField
              label="Requires Attachment"
              name="requiresAttachment"
              type="checkbox"
              value={form.requiresAttachment}
              onChange={onChange}
            />
          </div>
          <FormField
            label="Description"
            name="description"
            value={form.description}
            onChange={onChange}
          />
          {buttons(submitLeaveType)}
        </div>
      );
    }

    if (modal === "leaveRequest") {
      return (
        <div className="space-y-3">
          <FormField
            label="Staff"
            name="staffid"
            type="select"
            options={staffOptions}
            value={form.staffid}
            onChange={onChange}
            searchable
            required
            error={formErrors.staffid}
          />
          <FormField
            label="Leave Type"
            name="leavetypeid"
            type="select"
            options={leaveTypeOptions}
            value={form.leavetypeid}
            onChange={onChange}
            searchable
            required
            error={formErrors.leavetypeid}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="From"
              name="fromDate"
              type="date"
              value={form.fromDate}
              onChange={onChange}
              required
              error={formErrors.fromDate}
            />
            <FormField
              label="To"
              name="toDate"
              type="date"
              value={form.toDate}
              onChange={onChange}
              required
              error={formErrors.toDate}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Half Day"
              name="halfDay"
              type="checkbox"
              value={form.halfDay}
              onChange={onChange}
            />
            <FormField
              label="Total Days"
              name="totalDays"
              type="number"
              value={form.totalDays}
              onChange={onChange}
              required
              error={formErrors.totalDays}
            />
          </div>
          <FormField
            label="Reason"
            name="reason"
            value={form.reason}
            onChange={onChange}
            required
            error={formErrors.reason}
          />
          {buttons(submitLeaveRequest)}
        </div>
      );
    }

    if (modal === "rejectLeave") {
      return (
        <div className="space-y-3">
          <FormField
            label="Rejection Reason"
            name="rejectionReason"
            value={form.rejectionReason}
            onChange={onChange}
            required
            error={formErrors.rejectionReason}
          />
          {buttons(submitReject)}
        </div>
      );
    }

    if (modal === "leaveBalance") {
      return (
        <div className="space-y-3">
          <FormField
            label="Staff"
            name="staffid"
            type="select"
            options={staffOptions}
            value={form.staffid}
            onChange={onChange}
            searchable
            disabled={!!editing}
            required
            error={formErrors.staffid}
          />
          <FormField
            label="Leave Type"
            name="leavetypeid"
            type="select"
            options={leaveTypeOptions}
            value={form.leavetypeid}
            onChange={onChange}
            searchable
            disabled={!!editing}
            required
            error={formErrors.leavetypeid}
          />
          <FormField
            label="Year"
            name="year"
            type="number"
            value={form.year}
            onChange={onChange}
            disabled={!!editing}
            required
            error={formErrors.year}
          />
          <FormField
            label="Allocated"
            name="allocated"
            type="number"
            value={form.allocated}
            onChange={onChange}
          />
          <FormField
            label="Carried Forward"
            name="carriedForward"
            type="number"
            value={form.carriedForward}
            onChange={onChange}
          />
          {buttons(submitLeaveBalance)}
        </div>
      );
    }

    return null;
  };

  const modalTitle = (() => {
    switch (modal) {
      case "punch":
        return "Record Punch";
      case "manualAttendance":
        return "Add Manual Attendance";
      case "editLog":
        return "Edit Attendance Log";
      case "holiday":
        return editing ? "Edit Holiday" : "Add Holiday";
      case "leaveType":
        return editing ? "Edit Leave Type" : "Add Leave Type";
      case "leaveRequest":
        return editing ? "Edit Leave Request" : "Apply for Leave";
      case "rejectLeave":
        return "Reject Leave";
      case "leaveBalance":
        return editing ? "Edit Balance" : "Set Balance";
      default:
        return "";
    }
  })();

  /* ================================================================ */
  /* Render                                                           */
  /* ================================================================ */
  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <h1 className="text-2xl font-semibold mb-4">Attendance & Leave</h1>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="logs">Record Punch</TabsTrigger>
            <TabsTrigger value="leaverequests">Leave Requests</TabsTrigger>
            <TabsTrigger value="holidays">Holidays</TabsTrigger>
            <TabsTrigger value="leavetypes">Leave Types</TabsTrigger>
            <TabsTrigger value="balances">Balances</TabsTrigger>
            <TabsTrigger value="punches">Punches</TabsTrigger>
            <TabsTrigger value="cards">Staff Cards</TabsTrigger>
          </TabsList>

          <TabsContent value="logs">{renderLogsTab()}</TabsContent>
          <TabsContent value="leaverequests">
            {requestActions.length > 0 && (
              <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="text-sm font-semibold text-yellow-800 mb-2">
                  Pending approvals
                </div>
                <div className="flex flex-wrap gap-2">
                  {requestActions.map((r: any) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-2 bg-white border rounded-md px-2 py-1 text-sm"
                    >
                      <span className="font-medium">{r.staffName}</span>
                      <span className="text-gray-500">
                        {r.typeName} · {r.totalDays}d
                      </span>
                      <Button
                        variant="outline"
                        className="!py-1 !px-2 !text-xs"
                        onClick={() => handleApprove(r)}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        className="!py-1 !px-2 !text-xs"
                        onClick={() =>
                          openModal("rejectLeave", { rejectionReason: "" }, r)
                        }
                      >
                        Reject
                      </Button>
                      <Button
                        variant="outline"
                        className="!py-1 !px-2 !text-xs"
                        onClick={() => handleCancel(r)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {renderLeaveRequestsTab()}
          </TabsContent>
          <TabsContent value="holidays">{renderHolidaysTab()}</TabsContent>
          <TabsContent value="leavetypes">{renderLeaveTypesTab()}</TabsContent>
          <TabsContent value="balances">{renderLeaveBalancesTab()}</TabsContent>
          <TabsContent value="punches">{renderPunchesTab()}</TabsContent>
          <TabsContent value="cards">{renderCardsTab()}</TabsContent>
        </Tabs>

        <Modal
          isOpen={!!modal}
          onClose={closeModal}
          type="custom"
          title={modalTitle}
          size="md"
        >
          {renderModalContent()}
        </Modal>

        {/* Scan-to-Punch Modal */}
        <Modal
          isOpen={scanOpen}
          onClose={() => setScanOpen(false)}
          type="custom"
          title="Scan Staff Card to Punch"
          size="md"
        >
          <div className="space-y-3">
            <FormField
              label="Punch Type"
              name="scanType"
              type="select"
              options={[
                { value: "in", label: "Punch In" },
                { value: "out", label: "Punch Out" },
                { value: "breakstart", label: "Break Start" },
                { value: "breakend", label: "Break End" },
              ]}
              value={scanType}
              onChange={(e: any) => setScanType(e.target.value)}
            />
            <div>
              <label className="text-sm font-medium text-gray-700">
                Scan or enter staff code
              </label>
              <input
                ref={scanInputRef}
                value={scanBuffer}
                onChange={(e) => setScanBuffer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleScanSubmit(scanBuffer);
                    setScanBuffer("");
                  }
                }}
                placeholder="Scan barcode or type code, then press Enter"
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>

            {scanLog.length > 0 && (
              <div className="border-t pt-3">
                <div className="text-sm font-semibold mb-2">Recent scans</div>
                <div className="max-h-48 overflow-auto space-y-1">
                  {scanLog.map((entry, i) => (
                    <div
                      key={i}
                      className={`text-sm flex justify-between px-2 py-1 rounded ${entry.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
                        }`}
                    >
                      <span>
                        {entry.staff} · {entry.type}
                      </span>
                      <span className="text-xs">{entry.at}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setScanOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </HomeLayout>
  );
};

export default Attendance;
