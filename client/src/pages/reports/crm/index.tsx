import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import { useAppSelector } from "../../../redux/hooks";
import HomeLayout from "../../../layouts/home";
import ReportTable, { type ReportColumn, type ReportFilterField } from "../../../components/reporttable";
import { GET_LEADS, GET_FOLLOWUPS } from "../../../graphql/queries/lead";
import { GET_QUOTATIONS } from "../../../graphql/queries/quotation";
import { leadNo, useCrmLists } from "../../../graphql/hooks/lead";
import { QUOTATION_STATUS, quotationNo } from "../../../graphql/hooks/quotation";
import { formatDateDMY, formatDateTimeDMY, shiftDaysYMD, timeMs, todayYMD } from "../../../utils/helper";
import { partyLabel } from "../../../utils/partylabel";
import { customerOf } from "../../quotations";
import { FaBan, FaChartPie, FaClipboardList, FaFilter, FaPhoneAlt, FaUserTie, FaFileAlt, FaHourglassHalf, FaCheckCircle } from "react-icons/fa";

type Kind = "crm" | "quotation";
type Tab = { id: string; label: string; icon: React.ReactNode };
const TABS: Record<Kind, Tab[]> = {
  crm: [
    { id: "register", label: "Lead Register", icon: <FaClipboardList className="text-xs text-indigo-600" /> },
    { id: "source", label: "Source-wise", icon: <FaChartPie className="text-xs text-sky-600" /> },
    { id: "funnel", label: "Stage Funnel", icon: <FaFilter className="text-xs text-violet-600" /> },
    { id: "owner", label: "Owner-wise", icon: <FaUserTie className="text-xs text-emerald-600" /> },
    { id: "followup", label: "Follow Up Compliance", icon: <FaPhoneAlt className="text-xs text-amber-600" /> },
    { id: "lost", label: "Lost Reasons", icon: <FaBan className="text-xs text-rose-600" /> },
  ],
  quotation: [
    { id: "register", label: "Quotation Register", icon: <FaFileAlt className="text-xs text-indigo-600" /> },
    { id: "status", label: "Status Summary", icon: <FaChartPie className="text-xs text-sky-600" /> },
    { id: "customer", label: "Customer-wise", icon: <FaUserTie className="text-xs text-emerald-600" /> },
    { id: "expiring", label: "Expiring", icon: <FaHourglassHalf className="text-xs text-amber-600" /> },
    { id: "rejected", label: "Rejected", icon: <FaBan className="text-xs text-rose-600" /> },
    { id: "converted", label: "Converted", icon: <FaCheckCircle className="text-xs text-emerald-600" /> },
  ],
};

const dateTo = (ymd?: string) => (ymd ? `${ymd}￿` : undefined);
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const sum = (rows: any[], f: (r: any) => number) => rows.reduce((t, r) => t + (f(r) || 0), 0);
const endOfDay = (v: any) => {
  const d = new Date(timeMs(v));
  d.setHours(23, 59, 59, 999);
  return d.getTime();
};
// Group rows by a key into summary rows.
const groupBy = (rows: any[], key: (r: any) => string) => {
  const m = new Map<string, any[]>();
  for (const r of rows) {
    const k = key(r) || "—";
    m.set(k, [...(m.get(k) || []), r]);
  }
  return [...m];
};

const CrmReports: React.FC<{ kind: Kind }> = ({ kind }) => {
  const tabs = TABS[kind];
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [filters, setFilters] = useState<{ [key: string]: any }>({});
  const [appliedFilters, setAppliedFilters] = useState<{ [key: string]: any }>({});
  useEffect(() => {
    const range = { fromDate: shiftDaysYMD(-30), toDate: todayYMD() };
    setFilters(range);
    setAppliedFilters(range);
  }, []);
  const { stages, stageOf } = useCrmLists();

  const { type, branch, staff } = useAppSelector((s) => s.auth);
  const selectedBranchId = useAppSelector((s) => s.selectedBranch.branchId);
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;
  const fromDate: string | undefined = appliedFilters.fromDate || undefined;
  const toDate: string | undefined = appliedFilters.toDate || undefined;
  const ready = !!(fromDate || toDate);

  // The same list queries the screens use, so the reports also read the device's data offline.
  const { data: leadData, loading: leadLoading } = useQuery(GET_LEADS, {
    variables: { filter: { branchid, createdAtFrom: fromDate, createdAtTo: toDate } },
    skip: !ready || kind !== "crm",
    fetchPolicy: "cache-and-network",
  });
  const { data: fuData, loading: fuLoading } = useQuery(GET_FOLLOWUPS, {
    variables: { filter: { branchid, dueAtFrom: fromDate, dueAtTo: toDate } },
    skip: !ready || kind !== "crm" || activeTab !== "followup",
    fetchPolicy: "cache-and-network",
  });
  const { data: qtData, loading: qtLoading } = useQuery(GET_QUOTATIONS, {
    variables: { filter: { branchid, billdateFrom: fromDate, billdateTo: dateTo(toDate) } },
    skip: !ready || kind !== "quotation",
    fetchPolicy: "cache-and-network",
  });

  const leads: any[] = useMemo(() => (leadData?.getLeads || []).filter((l: any) => l.status !== false), [leadData]);
  const quotes: any[] = useMemo(() => (qtData?.getQuotations || []).filter((q: any) => q.status !== false && q.quotationStatus !== "revised"), [qtData]);
  const kindOf = (l: any) => stageOf(l.stage)?.kind || "open";

  const ownerOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of leads) if (l.ownerid?.id) m.set(l.ownerid.id, l.ownerid.name || "—");
    return [...m].map(([value, label]) => ({ value, label }));
  }, [leads]);
  const sourceOptions = useMemo(() => [...new Set(leads.map((l) => l.source).filter(Boolean))].map((s) => ({ value: s, label: s })), [leads]);
  const leadPass = (l: any) =>
    (!appliedFilters.ownerid || l.ownerid?.id === appliedFilters.ownerid) && (!appliedFilters.source || l.source === appliedFilters.source);

  const dateFields: ReportFilterField[] = [
    { name: "fromDate", label: "From Date", type: "date" },
    { name: "toDate", label: "To Date", type: "date" },
  ];

  let tableData: any[] = [];
  let columns: ReportColumn[] = [];
  let filterFields: ReportFilterField[] = dateFields;

  if (kind === "crm") {
    filterFields = [
      ...dateFields,
      { name: "source", label: "Source", type: "select", options: sourceOptions },
      { name: "ownerid", label: "Owner", type: "select", options: ownerOptions, searchable: true },
    ];
    const rows = leads.filter(leadPass);
    const summary = (list: any[]) => {
      const won = list.filter((l) => kindOf(l) === "won");
      const lost = list.filter((l) => kindOf(l) === "lost");
      return {
        leads: list.length,
        open: list.length - won.length - lost.length,
        won: won.length,
        lost: lost.length,
        conversion: pct(won.length, list.length),
        value: sum(list, (l) => Number(l.expectedvalue)),
        wonvalue: sum(won, (l) => Number(l.expectedvalue)),
      };
    };
    const summaryCols: ReportColumn[] = [
      { label: "Leads", key: "leads", numeric: true },
      { label: "Open", key: "open", numeric: true },
      { label: "Won", key: "won", numeric: true },
      { label: "Lost", key: "lost", numeric: true },
      { label: "Conversion %", key: "conversion" },
      { label: "Pipeline Value (₹)", key: "value", numeric: true },
      { label: "Won Value (₹)", key: "wonvalue", numeric: true },
    ];
    switch (activeTab) {
      case "register":
        tableData = rows.map((l) => ({
          no: leadNo(l),
          date: formatDateDMY(l.createdAt),
          lead: partyLabel(l) || l.name,
          company: l.company || "—",
          source: l.source || "—",
          stage: stageOf(l.stage)?.label || l.stage,
          owner: l.ownerid?.name || "—",
          value: Number(l.expectedvalue) || 0,
          next: l.nextfollowupAt ? formatDateTimeDMY(l.nextfollowupAt) : "—",
          last: l.lastcontactAt ? formatDateTimeDMY(l.lastcontactAt) : "—",
        }));
        columns = [
          { label: "Lead No", key: "no" }, { label: "Date", key: "date" }, { label: "Lead", key: "lead" }, { label: "Company", key: "company" },
          { label: "Source", key: "source" }, { label: "Stage", key: "stage" }, { label: "Owner", key: "owner" },
          { label: "Value (₹)", key: "value", numeric: true }, { label: "Next Follow Up", key: "next" }, { label: "Last Contact", key: "last" },
        ];
        break;
      case "source":
        tableData = groupBy(rows, (l) => l.source).map(([source, list]) => ({ source, ...summary(list) })).sort((a, b) => b.leads - a.leads);
        columns = [{ label: "Source", key: "source" }, ...summaryCols];
        break;
      case "owner":
        tableData = groupBy(rows, (l) => l.ownerid?.name).map(([owner, list]) => ({
          owner, ...summary(list),
          overdue: list.filter((l) => kindOf(l) === "open" && timeMs(l.nextfollowupAt) < Date.now()).length,
          nofollowup: list.filter((l) => kindOf(l) === "open" && !l.nextfollowupAt).length,
        })).sort((a, b) => b.wonvalue - a.wonvalue);
        columns = [{ label: "Owner", key: "owner" }, ...summaryCols, { label: "Overdue", key: "overdue", numeric: true }, { label: "No Follow Up", key: "nofollowup", numeric: true }];
        break;
      case "funnel": {
        // Each stage counts the leads in it or past it (won leads passed every open stage).
        const order = stages.map((s) => s.key);
        const reach = (key: string) => {
          const i = order.indexOf(key);
          return rows.filter((l) => {
            const at = order.indexOf(l.stage);
            if (stageOf(key)?.kind !== "open") return l.stage === key;
            return kindOf(l) === "won" || at >= i;
          });
        };
        tableData = stages.map((s) => {
          const inStage = rows.filter((l) => l.stage === s.key);
          const reached = reach(s.key);
          return {
            stage: s.label,
            now: inStage.length,
            reached: reached.length,
            share: pct(reached.length, rows.length),
            value: sum(inStage, (l) => Number(l.expectedvalue)),
          };
        });
        columns = [
          { label: "Stage", key: "stage" }, { label: "In Stage Now", key: "now", numeric: true }, { label: "Reached", key: "reached", numeric: true },
          { label: "% of Leads", key: "share" }, { label: "Value in Stage (₹)", key: "value", numeric: true },
        ];
        break;
      }
      case "followup": {
        const fus: any[] = (fuData?.getFollowups || []).filter((f: any) => f.status !== false && (!appliedFilters.ownerid || f.assignedto?.id === appliedFilters.ownerid));
        tableData = groupBy(fus, (f) => f.assignedto?.name).map(([person, list]) => {
          const ontime = list.filter((f) => f.doneAt && timeMs(f.doneAt) <= endOfDay(f.dueAt)).length;
          const late = list.filter((f) => f.doneAt && timeMs(f.doneAt) > endOfDay(f.dueAt)).length;
          const overdue = list.filter((f) => !f.doneAt && timeMs(f.dueAt) < Date.now()).length;
          const pending = list.filter((f) => !f.doneAt && timeMs(f.dueAt) >= Date.now()).length;
          return { person, total: list.length, ontime, late, overdue, pending, compliance: pct(ontime, list.length - pending) };
        });
        columns = [
          { label: "Assigned To", key: "person" }, { label: "Due", key: "total", numeric: true }, { label: "Done On Time", key: "ontime", numeric: true },
          { label: "Done Late", key: "late", numeric: true }, { label: "Overdue", key: "overdue", numeric: true }, { label: "Upcoming", key: "pending", numeric: true },
          { label: "On-time %", key: "compliance" },
        ];
        filterFields = [...dateFields, { name: "ownerid", label: "Assigned To", type: "select", options: ownerOptions, searchable: true }];
        break;
      }
      case "lost": {
        const lost = rows.filter((l) => kindOf(l) === "lost");
        tableData = groupBy(lost, (l) => l.lostreason).map(([reason, list]) => ({
          reason, count: list.length, share: pct(list.length, lost.length), value: sum(list, (l) => Number(l.expectedvalue)),
        })).sort((a, b) => b.count - a.count);
        columns = [{ label: "Reason", key: "reason" }, { label: "Leads", key: "count", numeric: true }, { label: "% of Lost", key: "share" }, { label: "Value (₹)", key: "value", numeric: true }];
        break;
      }
    }
  } else {
    const custOptions = [...new Map(quotes.map((q) => [customerOf(q).name, customerOf(q).name])).keys()].filter(Boolean).map((n) => ({ value: n, label: n }));
    filterFields = [...dateFields, { name: "customer", label: "Customer", type: "select", options: custOptions, searchable: true }];
    const rows = quotes.filter((q) => !appliedFilters.customer || customerOf(q).name === appliedFilters.customer);
    const row = (q: any) => ({
      no: quotationNo(q),
      date: formatDateDMY(q.billdate),
      customer: q.partyacc ? partyLabel(q.partyacc) : [customerOf(q).name, customerOf(q).mobile].filter(Boolean).join(" - "),
      subject: q.subject || "—",
      validtill: q.validtill ? formatDateDMY(q.validtill) : "—",
      taxable: Math.round((Number(q.totalamount || 0) - Number(q.totalgst || 0)) * 100) / 100,
      gst: Number(q.totalgst) || 0,
      total: Number(q.totalamount) || 0,
      status: QUOTATION_STATUS[q.quotationStatus] || "Draft",
      reason: q.statusreason || "—",
      by: q.createdby_name || "—",
    });
    const base: ReportColumn[] = [
      { label: "Quotation No", key: "no" }, { label: "Date", key: "date" }, { label: "Customer", key: "customer" }, { label: "Subject", key: "subject" },
    ];
    const money: ReportColumn[] = [{ label: "Taxable (₹)", key: "taxable", numeric: true }, { label: "GST (₹)", key: "gst", numeric: true }, { label: "Total (₹)", key: "total", numeric: true }];
    const today = todayYMD();
    switch (activeTab) {
      case "register":
        tableData = rows.map(row);
        columns = [...base, { label: "Valid Till", key: "validtill" }, ...money, { label: "Status", key: "status" }, { label: "Made By", key: "by" }];
        break;
      case "status": {
        const closed = rows.filter((q) => ["accepted", "converted", "rejected"].includes(q.quotationStatus));
        const winners = rows.filter((q) => ["accepted", "converted"].includes(q.quotationStatus));
        tableData = Object.keys(QUOTATION_STATUS).filter((k) => k !== "revised").map((k) => {
          const list = rows.filter((q) => (q.quotationStatus || "draft") === k);
          return { status: QUOTATION_STATUS[k], count: list.length, value: sum(list, (q) => Number(q.totalamount)), share: pct(list.length, rows.length) };
        });
        tableData.push({ status: `Win rate (of closed): ${pct(winners.length, closed.length)}%`, count: winners.length, value: sum(winners, (q) => Number(q.totalamount)), share: "" });
        columns = [{ label: "Status", key: "status" }, { label: "Quotations", key: "count", numeric: true }, { label: "Value (₹)", key: "value", numeric: true }, { label: "% of All", key: "share" }];
        break;
      }
      case "customer":
        tableData = groupBy(rows, (q) => customerOf(q).name).map(([customer, list]) => {
          const won = list.filter((q) => ["accepted", "converted"].includes(q.quotationStatus));
          return { customer, count: list.length, won: won.length, value: sum(list, (q) => Number(q.totalamount)), wonvalue: sum(won, (q) => Number(q.totalamount)), rate: pct(won.length, list.length) };
        }).sort((a, b) => b.value - a.value);
        columns = [
          { label: "Customer", key: "customer" }, { label: "Quotations", key: "count", numeric: true }, { label: "Won", key: "won", numeric: true },
          { label: "Quoted Value (₹)", key: "value", numeric: true }, { label: "Won Value (₹)", key: "wonvalue", numeric: true }, { label: "Win %", key: "rate" },
        ];
        break;
      case "expiring":
        // Still open and valid for 7 days or less (or already past).
        tableData = rows
          .filter((q) => ["draft", "sent", undefined, null].includes(q.quotationStatus) && q.validtill && q.validtill <= shiftDaysYMD(7))
          .map((q) => ({ ...row(q), left: q.validtill < today ? "Expired" : `${Math.round((Date.parse(q.validtill) - Date.parse(today)) / 86400000)} days` }))
          .sort((a, b) => (a.validtill > b.validtill ? 1 : -1));
        columns = [...base, { label: "Valid Till", key: "validtill" }, { label: "Left", key: "left" }, { label: "Total (₹)", key: "total", numeric: true }, { label: "Status", key: "status" }];
        break;
      case "rejected":
        tableData = rows.filter((q) => q.quotationStatus === "rejected").map(row);
        columns = [...base, { label: "Total (₹)", key: "total", numeric: true }, { label: "Reason", key: "reason" }];
        break;
      case "converted":
        tableData = rows.filter((q) => q.quotationStatus === "converted").map(row);
        columns = [...base, ...money, { label: "Made By", key: "by" }];
        break;
    }
  }

  const current = tabs.find((t) => t.id === activeTab)!;
  const title = kind === "crm" ? "CRM" : "Quotation";
  const loading = kind === "crm" ? leadLoading || fuLoading : qtLoading;

  return (
    <HomeLayout>
      <div className="w-full p-4 font-sans">
        <div className="mb-3 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition-colors ${
                activeTab === tab.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        <ReportTable
          moduleId={kind === "crm" ? "reports.crm" : "reports.quotation"}
          title={`${title} — ${current.label}`}
          columns={columns}
          data={tableData}
          filterFields={filterFields}
          filters={filters}
          setFilters={setFilters}
          appliedFilters={appliedFilters}
          setAppliedFilters={setAppliedFilters}
          isLoading={loading}
          showExport
          showCsv
          showPdf
          exportFileName={`${title}-${current.label.replace(/[^A-Za-z]/g, "")}`}
          showTotals
        />
      </div>
    </HomeLayout>
  );
};

export default CrmReports;
