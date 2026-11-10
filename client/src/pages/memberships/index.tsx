import { useState } from "react";
import { useNavigate } from "react-router";
import DataTable from "../../components/datatable";
import FormField from "../../components/formfiled";
import HomeLayout from "../../layouts/home";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import { showMessage } from "../../redux/slices/message";
import { useServerPaging, useServerTable } from "../../hooks/useservertable";
import { useOfflineList } from "../../offline/listing";
import { useProductServicesQuery } from "../../graphql/hooks/products";
import {
  customerLabel, sessionsLeft, useAppointmentsQuery, useMembershipPlansQuery, useMembershipsPageQuery, useServiceMutations,
} from "../../graphql/hooks/service";
import { formatDateDMY, todayYMD } from "../../utils/helper";

const SERVER_FILTER_KEYS = ["partyacc", "plan", "startdate", "enddate", "amount"];
const money = (n: any) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const EMPTY_PLAN = { id: "", name: "", sessions: "", validitydays: "", price: "", services: [] as string[], notes: "" };

/** Plan add / edit dialog (plans are a small master inside Memberships). */
function PlanDialog({ plan, onClose }: { plan: typeof EMPTY_PLAN; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const { addMembershipPlan, editMembershipPlan } = useServiceMutations();
  const { data: productData } = useProductServicesQuery();
  const [p, setP] = useState(plan);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!p.name.trim()) return dispatch(showMessage({ message: "Plan name is required.", type: "error" }));
    const num = (v: any) => (v === "" || v === null || v === undefined ? null : Number(v));
    const input = { name: p.name.trim(), sessions: num(p.sessions), validitydays: num(p.validitydays), price: num(p.price), services: p.services, notes: p.notes || undefined };
    setSaving(true);
    try {
      if (p.id) await editMembershipPlan({ variables: { id: p.id, input } });
      else await addMembershipPlan({ variables: { input } });
      dispatch(showMessage({ message: "Plan saved.", type: "success" }));
      onClose();
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Could not save the plan.", type: "error" }));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg space-y-3 rounded-lg bg-white p-4 text-[13px] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="font-semibold text-slate-800">{p.id ? "Edit Plan" : "Add Plan"}</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><FormField label="Plan Name" name="name" type="text" value={p.name} placeholder="Plan Name" onChange={(e: any) => setP({ ...p, name: e.target.value })} /></div>
          <FormField label="Sessions (blank = unlimited)" name="sessions" type="number" value={p.sessions} onChange={(e: any) => setP({ ...p, sessions: e.target.value })} />
          <FormField label="Validity (Days)" name="validitydays" type="number" value={p.validitydays} onChange={(e: any) => setP({ ...p, validitydays: e.target.value })} />
          <FormField label="Price (₹)" name="price" type="number" value={p.price} onChange={(e: any) => setP({ ...p, price: e.target.value })} />
          <div className="col-span-2">
            <FormField label="Services Covered" name="services" type="multiselect" searchable value={p.services}
              options={(productData?.getProductServices || []).filter((x: any) => x.isservice).map((x: any) => ({ value: x.id, label: x.name }))}
              onChange={(e: any) => setP({ ...p, services: e.target.value || [] })} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="h-8 rounded-md border border-slate-300 px-3" onClick={onClose}>Cancel</button>
          <button type="button" disabled={saving} className="h-8 rounded-md bg-indigo-600 px-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60" onClick={save}>Save Plan</button>
        </div>
      </div>
    </div>
  );
}

const Memberships = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, "memberships"));
  const [tab, setTab] = useState<"members" | "plans">("members");
  const [editing, setEditing] = useState<typeof EMPTY_PLAN | null>(null);
  const table = useServerTable("memberships", SERVER_FILTER_KEYS);
  const { items, total, loading, refetch } = useMembershipsPageQuery(table.variables);
  const serverPaging = useServerPaging(table, total, loading);
  const offline = useOfflineList("membership", table.page);
  const { data: planData, loading: plansLoading } = useMembershipPlansQuery();
  const { data: apptData } = useAppointmentsQuery();
  const { deleteMembership, deleteMembershipPlan } = useServiceMutations();
  const today = todayYMD();

  const memberCols = [
    { label: "Seq", key: "seqNo" },
    { label: "Member", key: "partyacc" },
    { label: "Plan", key: "plan" },
    { label: "Start", key: "startdate" },
    { label: "Valid Till", key: "enddate" },
    { label: "Sessions Left", key: "left" },
    { label: "Amount", key: "amount" },
    { label: "State", key: "state" },
  ];
  const buildRow = (m: any, i: number) => {
    const left = sessionsLeft(m, apptData?.getAppointments || []);
    const state = m.memberStatus === "cancelled" ? "Cancelled" : m.enddate && m.enddate < today ? "Expired" : left === 0 ? "Used Up" : "Active";
    return {
      id: m.id,
      seqNo: i >= 0 ? table.offset + i + 1 : "",
      partyacc: customerLabel(m),
      plan: m.planid?.name || "—",
      startdate: formatDateDMY(m.startdate),
      enddate: m.enddate ? formatDateDMY(m.enddate) : "—",
      left: left === null ? "Unlimited" : `${left} of ${m.sessions}`,
      amount: m.amount ? `₹${money(m.amount)}` : "—",
      state: <span className={state === "Active" ? "text-emerald-700" : "font-semibold text-rose-600"}>{state}</span>,
      raw: m,
    };
  };
  const serverRows = items.map((m: any, i: number) => offline.decorate(buildRow(m, i), "seqNo"));
  const rows = offline.rows.length ? [...offline.rows.map((m: any) => offline.decorate(buildRow(m, -1), "seqNo")), ...serverRows] : serverRows;

  const planRows = (planData?.getMembershipPlans || []).map((p: any, i: number) => ({
    id: p.id, seqNo: i + 1, name: p.name, sessions: p.sessions || "Unlimited", validity: p.validitydays ? `${p.validitydays} days` : "—",
    price: p.price ? `₹${money(p.price)}` : "—", services: (p.services || []).map((s: any) => s.name).join(", ") || "Any", raw: p,
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6 space-y-3">
        <div className="inline-flex h-8 overflow-hidden rounded-md border border-slate-300 text-[13px]">
          {([["members", "Members"], ["plans", "Plans"]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`px-3 ${tab === k ? "bg-indigo-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}>{label}</button>
          ))}
        </div>
        {tab === "members" ? (
          <DataTable
            title="Memberships"
            columns={memberCols}
            data={rows}
            serverPaging={serverPaging}
            showAdd={actions.showAdd}
            showEdit={actions.showEdit}
            showDelete={actions.showDelete}
            showDeleted={actions.showDelete || actions.canReset}
            showView={false}
            showImport={false}
            showExport={false}
            onAdd={() => navigate("/memberships/addedit")}
            onEdit={(row) => navigate(`/memberships/addedit/${row.id}`)}
            onDelete={async (row) => {
              if (!window.confirm(`Delete the membership of ${row.customer}?`)) return;
              try {
                await deleteMembership({ variables: { id: row.id, expectedUpdatedAt: row.raw?.updatedAt } });
                await refetch();
                dispatch(showMessage({ message: "Membership deleted.", type: "success" }));
              } catch (e: any) {
                dispatch(showMessage({ message: e?.message || "Failed to delete.", type: "error" }));
              }
            }}
            onShowDeleted={() => navigate("/memberships/deletedentries")}
            isLoading={loading}
          />
        ) : (
          <DataTable
            title="Membership Plans"
            columns={[
              { label: "S.No", key: "seqNo" }, { label: "Plan", key: "name" }, { label: "Sessions", key: "sessions" },
              { label: "Validity", key: "validity" }, { label: "Price", key: "price" }, { label: "Services", key: "services" },
            ]}
            data={planRows}
            showAdd={actions.showAdd}
            showEdit={actions.showEdit}
            showDelete={actions.showDelete}
            showDeleted={false}
            showView={false}
            showImport={false}
            showExport={false}
            onAdd={() => setEditing({ ...EMPTY_PLAN })}
            onEdit={(row) => {
              const p = row.raw;
              setEditing({ id: p.id, name: p.name, sessions: p.sessions ?? "", validitydays: p.validitydays ?? "", price: p.price ?? "", services: (p.services || []).map((s: any) => s.id), notes: p.notes || "" });
            }}
            onDelete={async (row) => {
              if (!window.confirm(`Delete plan ${row.name}?`)) return;
              try {
                await deleteMembershipPlan({ variables: { id: row.id, expectedUpdatedAt: row.raw?.updatedAt } });
                dispatch(showMessage({ message: "Plan deleted.", type: "success" }));
              } catch (e: any) {
                dispatch(showMessage({ message: e?.message || "Failed to delete.", type: "error" }));
              }
            }}
            isLoading={plansLoading}
          />
        )}
      </div>
      {editing && <PlanDialog plan={editing} onClose={() => setEditing(null)} />}
    </HomeLayout>
  );
};

export default Memberships;
