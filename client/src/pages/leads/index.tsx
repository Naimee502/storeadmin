import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { LayoutGrid, List, Phone, MessageCircle } from "lucide-react";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import { showMessage } from "../../redux/slices/message";
import { useServerPaging, useServerTable, useSessionState } from "../../hooks/useservertable";
import { formatDateDMY, timeMs } from "../../utils/helper";
import { isOfflineId } from "../../offline/core";
import { ShortcutButton } from "../followups";
import { useLeadMutations, useLeadsPageQuery, useLeadsQuery, useCrmLists, leadNo, type CrmStage } from "../../graphql/hooks/lead";

const SERVER_FILTER_KEYS = ["leadnumber", "name", "company", "mobile", "city", "source", "stage", "owner"];
const TEMP_STYLE: Record<string, string> = {
  hot: "bg-rose-50 text-rose-700 ring-rose-200",
  warm: "bg-amber-50 text-amber-700 ring-amber-200",
  cold: "bg-sky-50 text-sky-700 ring-sky-200",
};
const STAGE_STYLE: Record<string, string> = {
  won: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  lost: "bg-slate-100 text-slate-500 ring-slate-200",
  open: "bg-indigo-50 text-indigo-700 ring-indigo-200",
};

const digits = (m?: string) => String(m || "").replace(/\D/g, "");
export const waLink = (m?: string) => {
  const d = digits(m);
  return d ? `https://wa.me/${d.length === 10 ? `91${d}` : d}` : "";
};

/** Lead as LeadInput, for edits that change one field (offline leads take a full input). */
export const leadInput = (l: any, patch: Record<string, any> = {}) => ({
  name: l.name,
  company: l.company,
  mobile: l.mobile,
  altmobile: l.altmobile,
  email: l.email,
  address: l.address,
  city: l.city,
  state: l.state,
  pincode: l.pincode,
  gstin: l.gstin,
  source: l.source,
  subsource: l.subsource,
  requirement: l.requirement,
  products: (l.products || []).map((p: any) => ({ productid: p.productid?.id || p.productid || null, variantid: p.variantid || null, unitid: p.unitid?.id || p.unitid || null, unitqty: p.unitqty ?? null, name: p.name, qty: p.qty, note: p.note })),
  expectedvalue: l.expectedvalue,
  stage: l.stage,
  temperature: l.temperature,
  tags: l.tags || [],
  ownerid: l.ownerid?.id || l.ownerid || null,
  lostreason: l.lostreason,
  customfields: (l.customfields || []).map((c: any) => ({ key: c.key, value: c.value })),
  notes: l.notes,
  ...patch,
});

/** Stage change: a server lead uses setLeadStage, a lead still on this device is edited in its queue. */
export const useChangeStage = () => {
  const dispatch = useAppDispatch();
  const { setLeadStage, editLead } = useLeadMutations();
  return async (lead: any, stage: CrmStage, lostreason?: string) => {
    try {
      if (isOfflineId(lead.id)) {
        await editLead({ variables: { id: lead.id, input: leadInput(lead, { stage: stage.key, lostreason: lostreason || null }) } });
      } else {
        await setLeadStage({ variables: { id: lead.id, stage: stage.key, lostreason: lostreason || null, expectedUpdatedAt: lead.updatedAt } });
      }
      dispatch(showMessage({ message: `Moved to ${stage.label}.`, type: "success" }));
      return true;
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Could not change the stage.", type: "error" }));
      return false;
    }
  };
};

/** Asks for the lost reason, then changes the stage. */
export function LostReasonDialog({ lead, stage, onDone }: { lead: any; stage: CrmStage; onDone: (ok: boolean) => void }) {
  const { lostReasons } = useCrmLists();
  const [reason, setReason] = useState(lostReasons[0] || "");
  const [other, setOther] = useState("");
  const change = useChangeStage();
  const final = reason === "Other" ? other.trim() || "Other" : reason;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => onDone(false)}>
      <div className="w-full max-w-sm rounded-lg bg-white p-4 text-[13px] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 font-semibold text-slate-800">Why was {lead.name} lost?</div>
        <select className="mb-2 h-8 w-full rounded-md border border-slate-300 px-2" value={reason} onChange={(e) => setReason(e.target.value)}>
          {lostReasons.map((r: string) => <option key={r} value={r}>{r}</option>)}
        </select>
        {reason === "Other" && (
          <input className="mb-2 h-8 w-full rounded-md border border-slate-300 px-2" placeholder="Reason" value={other} onChange={(e) => setOther(e.target.value)} />
        )}
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" className="h-8 rounded-md border border-slate-300 px-3" onClick={() => onDone(false)}>Cancel</button>
          <button type="button" className="h-8 rounded-md bg-indigo-600 px-3 font-semibold text-white hover:bg-indigo-700" onClick={async () => onDone(await change(lead, stage, final))}>
            Mark Lost
          </button>
        </div>
      </div>
    </div>
  );
}

const Board = ({ leads, onOpen }: { leads: any[]; onOpen: (l: any) => void }) => {
  const { stages } = useCrmLists();
  const change = useChangeStage();
  const [lost, setLost] = useState<{ lead: any; stage: CrmStage } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const now = Date.now();
  const byStage = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const s of stages) m[s.key] = [];
    for (const l of leads) (m[l.stage] || m[stages[0].key]).push(l);
    return m;
  }, [leads, stages]);

  const drop = async (stage: CrmStage, id: string) => {
    setOver(null);
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.stage === stage.key) return;
    if (stage.kind === "lost") setLost({ lead, stage });
    else await change(lead, stage);
  };

  return (
    // Columns share the screen width; scroll only when there are too many stages to fit.
    <div className="flex gap-2 overflow-x-auto pb-2">
      {stages.map((s) => {
        const list = byStage[s.key] || [];
        const value = list.reduce((t, l) => t + (Number(l.expectedvalue) || 0), 0);
        return (
          <div
            key={s.key}
            className={`flex min-w-[150px] flex-1 basis-0 flex-col rounded-lg border bg-slate-50 ${over === s.key ? "border-indigo-400" : "border-slate-200"}`}
            onDragOver={(e) => { e.preventDefault(); setOver(s.key); }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => drop(s, e.dataTransfer.getData("text/plain"))}
          >
            <div className="flex items-center justify-between gap-1 border-b border-slate-200 px-2 py-1.5">
              <span className="truncate text-[13px] font-semibold text-slate-800">{s.label}</span>
              <span className="shrink-0 text-[11px] text-slate-500">{list.length}{value ? ` · ₹${value.toLocaleString("en-IN")}` : ""}</span>
            </div>
            <div className="flex min-h-[120px] max-h-[calc(100vh-190px)] flex-col gap-1.5 overflow-y-auto p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {list.map((l) => {
                const due = timeMs(l.nextfollowupAt) || 0;
                return (
                  <div
                    key={l.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", l.id)}
                    onClick={() => onOpen(l)}
                    className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[12px] leading-snug shadow-sm hover:border-indigo-300"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="truncate font-semibold text-slate-800" title={l.name}>{l.name}</span>
                      {l.temperature && (
                        <span className={`shrink-0 rounded px-1.5 text-[10px] font-semibold capitalize ring-1 ${TEMP_STYLE[l.temperature] || ""}`}>{l.temperature}</span>
                      )}
                    </div>
                    {l.company && <div className="truncate text-slate-500" title={l.company}>{l.company}</div>}
                    <div className="truncate text-slate-500">{[l.mobile, l.city].filter(Boolean).join(" · ")}</div>
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">{l.source || ""}</span>
                      {l.expectedvalue ? <span className="font-medium text-slate-700">₹{Number(l.expectedvalue).toLocaleString("en-IN")}</span> : null}
                    </div>
                    {due > 0 && (
                      <div className={`mt-1 text-[11px] ${due < now ? "font-semibold text-rose-600" : "text-slate-500"}`}>
                        Follow Up {formatDateDMY(l.nextfollowupAt)}{due < now ? " (overdue)" : ""}
                      </div>
                    )}
                    {l.ownerid?.name && <div className="text-[11px] text-slate-400">{l.ownerid.name}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {lost && <LostReasonDialog lead={lost.lead} stage={lost.stage} onDone={() => setLost(null)} />}
    </div>
  );
};

const Leads = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, "leads"));
  const { stageOf } = useCrmLists();
  const [view, setView] = useSessionState<"list" | "board">("leads:view", "list");
  const table = useServerTable("leads", SERVER_FILTER_KEYS);
  const { items, total, loading, refetch } = useLeadsPageQuery(table.variables);
  const serverPaging = useServerPaging(table, total, loading);
  const { data: allData } = useLeadsQuery(view !== "board");
  const { deleteLead } = useLeadMutations();

  const columns = [
    { label: "Seq", key: "seqNo" },
    { label: "Lead No", key: "leadnumber" },
    { label: "Name", key: "name" },
    { label: "Company", key: "company" },
    { label: "Mobile", key: "mobile" },
    { label: "City", key: "city" },
    { label: "Source", key: "source" },
    { label: "Stage", key: "stage" },
    { label: "Owner", key: "owner" },
    { label: "Next Follow Up", key: "nextfollowup" },
    { label: "Contact", key: "contact" },
  ];

  const rows = items.map((l: any, i: number) => {
    const st = stageOf(l.stage);
    const overdue = timeMs(l.nextfollowupAt) < Date.now();
    return {
      id: l.id,
      seqNo: table.offset + i + 1,
      leadnumber: leadNo(l),
      name: l.name,
      company: l.company || "—",
      mobile: l.mobile || "—",
      city: l.city || "—",
      source: l.source || "—",
      stage: <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ring-1 ${STAGE_STYLE[st?.kind || "open"]}`}>{st?.label || l.stage}</span>,
      owner: l.ownerid?.name || "—",
      nextfollowup: l.nextfollowupAt
        ? <span className={overdue ? "font-semibold text-rose-600" : ""}>{formatDateDMY(l.nextfollowupAt)}</span>
        : "—",
      contact: l.mobile ? (
        <span className="flex gap-2">
          <a href={`tel:${digits(l.mobile)}`} title="Call" className="text-indigo-600 hover:text-indigo-800" onClick={(e) => e.stopPropagation()}><Phone size={15} /></a>
          <a href={waLink(l.mobile)} target="_blank" rel="noreferrer" title="WhatsApp" className="text-emerald-600 hover:text-emerald-800" onClick={(e) => e.stopPropagation()}><MessageCircle size={15} /></a>
        </span>
      ) : "—",
      raw: l,
    };
  });

  const toggle = (
    <div className="inline-flex h-8 overflow-hidden rounded-md border border-slate-300 text-[13px]">
      {(["list", "board"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => setView(v)}
          className={`inline-flex items-center gap-1 px-3 ${view === v ? "bg-indigo-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}
        >
          {v === "list" ? <List size={14} /> : <LayoutGrid size={14} />}
          {v === "list" ? "List" : "Board"}
        </button>
      ))}
    </div>
  );

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        {view === "board" ? (
          <>
            <div className="mb-2 flex items-center justify-between">
              <h1 className="text-[15px] font-semibold text-slate-800">Leads</h1>
              <div className="flex gap-2">
                {toggle}
                {actions.showAdd && (
                  <ShortcutButton label="Add Lead" keyCode="N" onClick={() => navigate("/leads/addedit")} />
                )}
              </div>
            </div>
            <Board leads={allData?.getLeads || []} onOpen={(l) => navigate(`/leads/addedit/${l.id}`)} />
          </>
        ) : (
          <DataTable
            title="Leads"
            columns={columns}
            data={rows}
            serverPaging={serverPaging}
            toolbarActions={toggle}
            showAdd={actions.showAdd}
            showEdit={actions.showEdit}
            showDelete={actions.showDelete}
            showDeleted={actions.showDelete || actions.canReset}
            showView={false}
            showImport={false}
            showExport={false}
            onAdd={() => navigate("/leads/addedit")}
            onEdit={(row) => navigate(`/leads/addedit/${row.id}`)}
            onDelete={async (row) => {
              if (!window.confirm(`Delete lead ${row.name}?`)) return;
              try {
                await deleteLead({ variables: { id: row.id, expectedUpdatedAt: row.raw?.updatedAt } });
                await refetch();
                dispatch(showMessage({ message: "Lead deleted.", type: "success" }));
              } catch (e: any) {
                dispatch(showMessage({ message: e?.message || "Failed to delete.", type: "error" }));
              }
            }}
            onShowDeleted={() => navigate("/leads/deletedentries")}
            isLoading={loading}
          />
        )}
      </div>
    </HomeLayout>
  );
};

export default Leads;
