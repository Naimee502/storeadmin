import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { CalendarDays, ChevronLeft, ChevronRight, List } from "lucide-react";
import DataTable from "../../components/datatable";
import StatusDropdown from "../../components/statusdropdown";
import HomeLayout from "../../layouts/home";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectIsModuleBusinessEnabled, selectModuleActions } from "../../redux/slices/permissions";
import { showMessage } from "../../redux/slices/message";
import { useServerPaging, useServerTable } from "../../hooks/useservertable";
import { useOfflineList } from "../../offline/listing";
import { useProductServicesQuery } from "../../graphql/hooks/products";
import { APPT_STATUS, addDaysYMD, customerLabel, useAppointmentsPageQuery, useAppointmentsQuery, useServiceMutations } from "../../graphql/hooks/service";
import { toInvoiceProducts } from "../../components/servicelines";
import { formatDateDMY, todayYMD } from "../../utils/helper";

const SERVER_FILTER_KEYS = ["partyacc", "billdate", "starttime", "services", "staff", "apptStatus", "notes"];
const STYLE: Record<string, string> = {
  booked: "border-l-slate-400", confirmed: "border-l-sky-500", arrived: "border-l-amber-500", done: "border-l-emerald-500", noshow: "border-l-rose-400", cancelled: "border-l-rose-300 opacity-60",
};
const endOf = (a: any) => {
  const [h, m] = String(a.starttime || "0:0").split(":").map(Number);
  const t = h * 60 + m + (Number(a.duration) || 30);
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};
export const servicesText = (a: any) => (a.services || []).map((l: any) => l.productserviceid?.name).filter(Boolean).join(", ");

/** What a status change offers next; "invoice" makes the bill. */
export function useAppointmentActions() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, "appointments"));
  const invoiceOn = useAppSelector((s) => selectIsModuleBusinessEnabled(s, "salesinvoice"));
  const { data: productData } = useProductServicesQuery();
  const { setAppointmentStatus } = useServiceMutations();
  const optionsFor = (a: any) => {
    if (!actions.showEdit || a.invoiceid) return [];
    const o = Object.entries(APPT_STATUS).filter(([k]) => k !== (a.apptStatus || "booked")).map(([value, label]) => ({ value, label }));
    if (invoiceOn && actions.showConvert && !a.isOffline && !["cancelled", "noshow"].includes(a.apptStatus)) o.push({ value: "invoice", label: "Make Sales Invoice" });
    return o;
  };
  const onStatus = async (a: any, v: string) => {
    if (v === "invoice") {
      return navigate("/salesinvoice/addedit", {
        state: { fromService: { kind: "appointment", id: a.id, partyacc: a.partyacc, isservice: true, notes: `Appointment ${formatDateDMY(a.billdate)} ${a.starttime}`, products: toInvoiceProducts(a.services, productData?.getProductServices || []) } },
      });
    }
    try {
      await setAppointmentStatus({ variables: { id: a.id, apptStatus: v, expectedUpdatedAt: a.updatedAt } });
      dispatch(showMessage({ message: `Marked ${APPT_STATUS[v]}.`, type: "success" }));
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Update failed.", type: "error" }));
    }
  };
  return { actions, optionsFor, onStatus };
}

const Appointments = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [view, setView] = useState<"day" | "list">(() => (sessionStorage.getItem("appointments:view") as any) || "day");
  const [day, setDay] = useState(todayYMD());
  const { actions, optionsFor, onStatus } = useAppointmentActions();
  const { deleteAppointment } = useServiceMutations();
  const table = useServerTable("appointments", SERVER_FILTER_KEYS);
  const { items, total, loading, refetch } = useAppointmentsPageQuery(table.variables);
  const serverPaging = useServerPaging(table, total, loading);
  const offline = useOfflineList("appointment", table.page);
  const { data: dayData, loading: dayLoading } = useAppointmentsQuery({ billdateFrom: day, billdateTo: day }, view !== "day");
  const switchView = (v: "day" | "list") => {
    sessionStorage.setItem("appointments:view", v);
    setView(v);
  };

  // Day view: one column per staff member, unassigned last.
  const byStaff = useMemo(() => {
    const m = new Map<string, { name: string; list: any[] }>();
    for (const a of (dayData?.getAppointments || []).filter((x: any) => x.billdate === day)) {
      const k = a.staffid?.id || "";
      if (!m.has(k)) m.set(k, { name: a.staffid?.name || "Unassigned", list: [] });
      m.get(k)!.list.push(a);
    }
    return [...m.entries()].sort(([a], [b]) => (a ? 0 : 1) - (b ? 0 : 1)).map(([, v]) => ({ ...v, list: v.list.sort((x, y) => String(x.starttime).localeCompare(String(y.starttime))) }));
  }, [dayData, day]);

  const columns = [
    { label: "Seq", key: "seqNo" },
    { label: "Date", key: "billdate" },
    { label: "Time", key: "starttime" },
    { label: "Customer", key: "partyacc" },
    { label: "Services", key: "services" },
    { label: "Staff", key: "staff" },
    { label: "Status", key: "apptStatus" },
    { label: "Notes", key: "notes" },
  ];
  const buildRow = (a: any, i: number) => ({
    id: a.id,
    seqNo: i >= 0 ? table.offset + i + 1 : "",
    billdate: formatDateDMY(a.billdate),
    starttime: `${a.starttime} - ${endOf(a)}`,
    partyacc: customerLabel(a),
    services: servicesText(a) || "—",
    staff: a.staffid?.name || "—",
    apptStatus: <StatusDropdown current={a.apptStatus || "booked"} options={optionsFor(a)} onSelect={(v) => onStatus(a, v)} />,
    notes: a.notes || "—",
    raw: a,
  });
  const serverRows = items.map((a: any, i: number) => offline.decorate(buildRow(a, i), "seqNo"));
  const rows = offline.rows.length ? [...offline.rows.map((a: any) => offline.decorate(buildRow(a, -1), "seqNo")), ...serverRows] : serverRows;

  const toggle = (
    <div className="inline-flex h-8 overflow-hidden rounded-md border border-slate-300 text-[13px]">
      {([["day", "Day View", CalendarDays], ["list", "List", List]] as const).map(([k, label, Icon]) => (
        <button key={k} type="button" onClick={() => switchView(k)} className={`inline-flex items-center gap-1.5 px-3 ${view === k ? "bg-indigo-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}>
          <Icon size={14} /> {label}
        </button>
      ))}
    </div>
  );

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {toggle}
          {view === "day" && (
            <div className="flex items-center gap-1">
              <button type="button" title="Previous Day" className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white hover:bg-slate-50" onClick={() => setDay(addDaysYMD(day, -1))}><ChevronLeft size={15} /></button>
              <input type="date" className="h-8 rounded-md border border-slate-300 px-2 text-[13px]" value={day} onChange={(e) => setDay(e.target.value || todayYMD())} />
              <button type="button" title="Next Day" className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white hover:bg-slate-50" onClick={() => setDay(addDaysYMD(day, 1))}><ChevronRight size={15} /></button>
              <button type="button" className="h-8 rounded-md border border-slate-300 bg-white px-3 text-[13px] hover:bg-slate-50" onClick={() => setDay(todayYMD())}>Today</button>
            </div>
          )}
          {view === "day" && actions.showAdd && (
            <button type="button" onClick={() => navigate(`/appointments/addedit?date=${day}`)} className="ml-auto h-8 shrink-0 whitespace-nowrap rounded-md bg-indigo-600 px-3 text-[13px] font-semibold text-white hover:bg-indigo-700">
              + Book Appointment
            </button>
          )}
        </div>

        {view === "day" ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {!byStaff.length && <div className="w-full rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-[13px] text-slate-500">{dayLoading ? "Loading…" : `No appointments on ${formatDateDMY(day)}.`}</div>}
            {byStaff.map((col) => (
              <div key={col.name} className="min-w-[220px] flex-1 basis-0 rounded-lg border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-[13px] font-semibold text-slate-700">
                  {col.name}<span className="text-[12px] font-normal text-slate-500">{col.list.length}</span>
                </div>
                <div className="space-y-2 p-2">
                  {col.list.map((a) => (
                    <div key={a.id} className={`rounded-md border border-slate-200 border-l-4 bg-white p-2 text-[13px] shadow-sm ${STYLE[a.apptStatus] || ""}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800">{a.starttime} - {endOf(a)}</span>
                        <StatusDropdown current={a.apptStatus || "booked"} options={optionsFor(a)} onSelect={(v) => onStatus(a, v)} />
                      </div>
                      <button type="button" className="mt-1 block w-full truncate text-left text-slate-700 hover:text-indigo-600" title="Edit" onClick={() => actions.showEdit && navigate(`/appointments/addedit/${a.id}`)}>
                        {customerLabel(a)}
                      </button>
                      {servicesText(a) && <div className="truncate text-[12px] text-slate-500">{servicesText(a)}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <DataTable
            title="Appointments"
            columns={columns}
            data={rows}
            serverPaging={serverPaging}
            showAdd={actions.showAdd}
            showEdit={(row: any) => actions.showEdit && !row.raw?.invoiceid}
            showDelete={actions.showDelete}
            showDeleted={actions.showDelete || actions.canReset}
            showView={false}
            showImport={false}
            showExport={false}
            onAdd={() => navigate("/appointments/addedit")}
            onEdit={(row) => navigate(`/appointments/addedit/${row.id}`)}
            onDelete={async (row) => {
              if (!window.confirm(`Delete the appointment of ${row.customer}?`)) return;
              try {
                await deleteAppointment({ variables: { id: row.id, expectedUpdatedAt: row.raw?.updatedAt } });
                await refetch();
                dispatch(showMessage({ message: "Appointment deleted.", type: "success" }));
              } catch (e: any) {
                dispatch(showMessage({ message: e?.message || "Failed to delete.", type: "error" }));
              }
            }}
            onShowDeleted={() => navigate("/appointments/deletedentries")}
            isLoading={loading}
          />
        )}
      </div>
    </HomeLayout>
  );
};

export default Appointments;
