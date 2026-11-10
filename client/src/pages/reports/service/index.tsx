import React, { useEffect, useState } from "react";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportColumn, type ReportFilterField } from "../../../components/reporttable";
import {
  APPT_STATUS, CONTRACT_TYPE, JOB_STATUS, customerLabel, jobCardNo, sessionsLeft,
  useAppointmentsQuery, useContractsQuery, useJobCardsQuery, useMembershipsQuery,
} from "../../../graphql/hooks/service";
import { formatDateDMY, normalizeToYMD, shiftDaysYMD, todayYMD } from "../../../utils/helper";
import { FaBell, FaCalendarCheck, FaFileContract, FaIdCard, FaUserClock, FaWrench } from "react-icons/fa";
import { useProductServicesQuery } from "../../../graphql/hooks/products";

const tabs = [
  { id: "appointments", label: "Appointments", icon: <FaCalendarCheck className="text-xs text-pink-600" /> },
  { id: "staff", label: "Staff Summary", icon: <FaUserClock className="text-xs text-indigo-600" /> },
  { id: "jobcards", label: "Job Cards", icon: <FaWrench className="text-xs text-sky-600" /> },
  { id: "due", label: "Service Due", icon: <FaBell className="text-xs text-amber-600" /> },
  { id: "amc", label: "AMC / Warranty Due", icon: <FaFileContract className="text-xs text-teal-600" /> },
  { id: "packages", label: "Package Balance", icon: <FaIdCard className="text-xs text-violet-600" /> },
];
const dateTo = (ymd?: string) => (ymd ? `${ymd}￿` : undefined);
const days = (from?: string, to?: string) => (from && to ? Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 86400000)) : 0);
const lineTotal = (lines: any[] = []) => lines.reduce((s, l) => s + (Number(l.amount) || Number(l.qty || 0) * Number(l.rate || 0)), 0);

const ServiceReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [filters, setFilters] = useState<{ [key: string]: any }>({});
  const [applied, setApplied] = useState<{ [key: string]: any }>({});
  useEffect(() => {
    const range = { fromDate: shiftDaysYMD(-30), toDate: todayYMD() };
    setFilters(range);
    setApplied(range);
  }, []);

  const fromDate: string | undefined = applied.fromDate || undefined;
  const toDate: string | undefined = applied.toDate || undefined;
  const dated = { billdateFrom: fromDate, billdateTo: dateTo(toDate) };
  const tab = activeTab;
  // Same list queries as the screens, so the report also works offline from the device's data.
  const appts = useAppointmentsQuery(dated, !["appointments", "staff"].includes(tab));
  const jobs = useJobCardsQuery(dated, tab !== "jobcards");
  const contracts = useContractsQuery({}, tab !== "amc");
  const members = useMembershipsQuery({}, tab !== "packages");
  const memberAppts = useAppointmentsQuery({}, tab !== "packages" && tab !== "due");
  const dueJobs = useJobCardsQuery({}, tab !== "due");
  const { data: productData } = useProductServicesQuery();
  const variantOf = (l: any) =>
    (productData?.getProductServices || []).find((p: any) => p.id === l.productserviceid?.id)?.servicevariants?.find((v: any) => v.id === (l.variantid?.id || l.variantid)) ||
    (productData?.getProductServices || []).find((p: any) => p.id === l.productserviceid?.id)?.servicevariants?.[0];

  const today = todayYMD();
  const inRange = (ymd?: string) => !!ymd && (!fromDate || ymd >= fromDate) && (!toDate || ymd <= toDate);
  const dateFields: ReportFilterField[] = [
    { name: "fromDate", label: "From Date", type: "date" },
    { name: "toDate", label: "To Date", type: "date" },
  ];

  let tableData: any[] = [];
  let columns: ReportColumn[] = [];
  let filterFields: ReportFilterField[] = dateFields;
  let isLoading = false;

  switch (tab) {
    case "appointments": {
      isLoading = appts.loading;
      tableData = (appts.data?.getAppointments || [])
        .filter((a: any) => inRange(normalizeToYMD(a.billdate) || "") && (!applied.apptStatus || (a.apptStatus || "booked") === applied.apptStatus))
        .map((a: any) => ({
          date: formatDateDMY(a.billdate),
          time: a.starttime,
          partyacc: customerLabel(a),
          staff: a.staffid?.name || "-",
          services: (a.services || []).map((l: any) => l.productserviceid?.name || l.description).filter(Boolean).join(", ") || "-",
          minutes: Number(a.duration) || 0,
          amount: lineTotal(a.services),
          status: APPT_STATUS[a.apptStatus] || "Booked",
          billed: a.invoiceid ? "Yes" : "-",
        }));
      columns = [
        { label: "Date", key: "date" },
        { label: "Time", key: "time" },
        { label: "Customer", key: "partyacc" },
        { label: "Staff", key: "staff" },
        { label: "Services", key: "services" },
        { label: "Minutes", key: "minutes", numeric: true },
        { label: "Amount (₹)", key: "amount", numeric: true },
        { label: "Status", key: "status" },
        { label: "Billed", key: "billed" },
      ];
      filterFields = [...dateFields, { name: "apptStatus", label: "Status", type: "select", options: Object.entries(APPT_STATUS).map(([value, label]) => ({ value, label })) }];
      break;
    }
    case "staff": {
      isLoading = appts.loading;
      const m = new Map<string, any>();
      for (const a of appts.data?.getAppointments || []) {
        if (!inRange(normalizeToYMD(a.billdate) || "")) continue;
        const k = a.staffid?.id || "-";
        const r = m.get(k) || { staff: a.staffid?.name || "Unassigned", total: 0, done: 0, noshow: 0, cancelled: 0, minutes: 0, amount: 0, commission: 0 };
        r.total += 1;
        const s = a.apptStatus || "booked";
        if (s === "done") {
          r.done += 1;
          r.minutes += Number(a.duration) || 0;
          r.amount += lineTotal(a.services);
          for (const l of a.services || []) r.commission += (lineTotal([l]) * Number(variantOf(l)?.commission || 0)) / 100;
        }
        if (s === "noshow") r.noshow += 1;
        if (s === "cancelled") r.cancelled += 1;
        m.set(k, r);
      }
      tableData = [...m.values()].map((r) => ({ ...r, hours: Math.round((r.minutes / 60) * 10) / 10, showRate: r.total ? `${Math.round(((r.total - r.noshow - r.cancelled) / r.total) * 100)}%` : "-" }));
      columns = [
        { label: "Staff", key: "staff" },
        { label: "Booked", key: "total", numeric: true },
        { label: "Done", key: "done", numeric: true },
        { label: "No Show", key: "noshow", numeric: true },
        { label: "Cancelled", key: "cancelled", numeric: true },
        { label: "Show Rate", key: "showRate" },
        { label: "Hours Worked", key: "hours", numeric: true },
        { label: "Done Value (₹)", key: "amount", numeric: true },
        { label: "Commission (₹)", key: "commission", numeric: true },
      ];
      tableData = tableData.map((r) => ({ ...r, commission: Math.round(r.commission * 100) / 100 }));
      break;
    }
    case "due": {
      // Last time each customer had each service, plus that service's "next due" days.
      isLoading = memberAppts.loading || dueJobs.loading;
      const within = Number(applied.within || 30);
      const limit = shiftDaysYMD(within);
      const last = new Map<string, any>();
      const note = (who: any, l: any, ymd: string, from: string) => {
        const days = Number(variantOf(l)?.nextduedays || 0);
        if (!days || !ymd) return;
        const k = `${who.partyacc?.id || who.customermobile || who.customername}|${l.productserviceid?.id}`;
        const prev = last.get(k);
        if (!prev || prev.ymd < ymd) last.set(k, { who, l, ymd, days, from });
      };
      for (const a of memberAppts.data?.getAppointments || []) if (a.apptStatus === "done") for (const l of a.services || []) note(a, l, normalizeToYMD(a.billdate) || "", "Appointment");
      for (const j of dueJobs.data?.getJobCards || []) if (j.jobStatus === "delivered") for (const l of j.estimate || []) note(j, l, normalizeToYMD(j.deliveredAt || j.billdate) || "", "Job Card");
      tableData = [...last.values()]
        .map((x) => {
          const d = new Date(`${x.ymd}T00:00:00`);
          d.setDate(d.getDate() + x.days);
          const dueYmd = d.toISOString().slice(0, 10);
          return { ...x, dueYmd };
        })
        .filter((x) => x.dueYmd <= limit)
        .sort((a, b) => (a.dueYmd < b.dueYmd ? -1 : 1))
        .map((x) => ({
          partyacc: customerLabel(x.who),
          service: [x.l.productserviceid?.name, x.l.variantid?.name].filter(Boolean).join(" - ") || "-",
          last: formatDateDMY(x.ymd),
          from: x.from,
          due: formatDateDMY(x.dueYmd),
          left: x.dueYmd < today ? `Overdue ${days(x.dueYmd, today)} days` : `${days(today, x.dueYmd)} days`,
        }));
      columns = [
        { label: "Customer", key: "partyacc" },
        { label: "Service", key: "service" },
        { label: "Last Done", key: "last" },
        { label: "From", key: "from" },
        { label: "Next Due", key: "due" },
        { label: "Due In", key: "left" },
      ];
      filterFields = [{ name: "within", label: "Due Within", type: "select", options: [{ value: "7", label: "7 Days" }, { value: "30", label: "30 Days" }, { value: "60", label: "60 Days" }, { value: "90", label: "90 Days" }] }];
      break;
    }
    case "jobcards": {
      isLoading = jobs.loading;
      tableData = (jobs.data?.getJobCards || [])
        .filter((j: any) => inRange(normalizeToYMD(j.billdate) || "") && (!applied.jobStatus || (j.jobStatus || "received") === applied.jobStatus))
        .map((j: any) => {
          const open = !["delivered", "cancelled"].includes(j.jobStatus);
          const end = j.deliveredAt ? normalizeToYMD(j.deliveredAt) || today : today;
          return {
            no: jobCardNo(j),
            date: formatDateDMY(j.billdate),
            partyacc: customerLabel(j),
            device: [j.devicename || j.productserviceid?.name, j.serial].filter(Boolean).join(" - ") || "-",
            technician: j.technicianid?.name || "-",
            estimate: Number(j.estimatetotal) || lineTotal(j.estimate),
            days: days(normalizeToYMD(j.billdate) || today, end),
            late: open && j.promisedate && j.promisedate < today ? "Late" : "-",
            status: JOB_STATUS[j.jobStatus] || "Received",
          };
        });
      columns = [
        { label: "Job No", key: "no" },
        { label: "Date", key: "date" },
        { label: "Customer", key: "partyacc" },
        { label: "Device / Serial", key: "device" },
        { label: "Technician", key: "technician" },
        { label: "Estimate (₹)", key: "estimate", numeric: true },
        { label: "Turnaround Days", key: "days", numeric: true },
        { label: "Promise", key: "late" },
        { label: "Status", key: "status" },
      ];
      filterFields = [...dateFields, { name: "jobStatus", label: "Status", type: "select", options: Object.entries(JOB_STATUS).map(([value, label]) => ({ value, label })) }];
      break;
    }
    case "amc": {
      isLoading = contracts.loading;
      const within = Number(applied.within || 30);
      const limit = shiftDaysYMD(within);
      tableData = (contracts.data?.getContracts || [])
        .filter((c: any) => c.enddate && c.enddate <= limit && c.contractStatus !== "cancelled")
        .map((c: any) => ({
          partyacc: customerLabel(c),
          title: c.title || "-",
          type: CONTRACT_TYPE[c.contractType] || c.contractType || "-",
          start: formatDateDMY(c.startdate),
          end: formatDateDMY(c.enddate),
          left: c.enddate < today ? "Expired" : `${days(today, c.enddate)} days`,
          visits: c.visitsallowed ? `${c.visitsdone || 0} / ${c.visitsallowed}` : "-",
          amount: Number(c.amount) || 0,
        }));
      columns = [
        { label: "Customer", key: "partyacc" },
        { label: "Contract", key: "title" },
        { label: "Type", key: "type" },
        { label: "Start", key: "start" },
        { label: "End", key: "end" },
        { label: "Due In", key: "left" },
        { label: "Visits", key: "visits" },
        { label: "Amount (₹)", key: "amount", numeric: true },
      ];
      filterFields = [{ name: "within", label: "Ending Within", type: "select", options: [{ value: "7", label: "7 Days" }, { value: "30", label: "30 Days" }, { value: "60", label: "60 Days" }, { value: "90", label: "90 Days" }] }];
      break;
    }
    case "packages": {
      isLoading = members.loading;
      const used = memberAppts.data?.getAppointments || [];
      tableData = (members.data?.getMemberships || [])
        .filter((m: any) => m.memberStatus !== "cancelled")
        .map((m: any) => {
          const left = sessionsLeft(m, used);
          return {
            partyacc: customerLabel(m),
            plan: m.planid?.name || "-",
            start: formatDateDMY(m.startdate),
            end: m.enddate ? formatDateDMY(m.enddate) : "-",
            sessions: Number(m.sessions) || 0,
            used: m.sessions ? Number(m.sessions) - (left ?? 0) : 0,
            left: left ?? 0,
            status: m.enddate && m.enddate < today ? "Expired" : left === 0 && m.sessions ? "Used Up" : "Active",
            amount: Number(m.amount) || 0,
          };
        });
      columns = [
        { label: "Member", key: "partyacc" },
        { label: "Plan", key: "plan" },
        { label: "Start", key: "start" },
        { label: "Valid Till", key: "end" },
        { label: "Sessions", key: "sessions", numeric: true },
        { label: "Used", key: "used", numeric: true },
        { label: "Left", key: "left", numeric: true },
        { label: "Amount (₹)", key: "amount", numeric: true },
        { label: "Status", key: "status" },
      ];
      filterFields = [];
      break;
    }
  }

  const current = tabs.find((t) => t.id === activeTab)!;

  return (
    <HomeLayout>
      <div className="w-full p-4 font-sans">
        <div className="mb-3 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition-colors ${
                activeTab === t.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <ReportTable
          moduleId="reports.service"
          title={`Service — ${current.label}`}
          columns={columns}
          data={tableData}
          filterFields={filterFields}
          filters={filters}
          setFilters={setFilters}
          appliedFilters={applied}
          setAppliedFilters={setApplied}
          isLoading={isLoading}
          showExport
          showCsv
          showPdf
          exportFileName={`Service-${current.label.replace(/[\s/]+/g, "")}`}
          showTotals
        />
      </div>
    </HomeLayout>
  );
};

export default ServiceReports;
