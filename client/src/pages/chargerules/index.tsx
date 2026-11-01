import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import FormField from "../../components/formfiled";
import FormSwitch from "../../components/formswitch";
import { showMessage } from "../../redux/slices/message";
import { useChargeRulesQuery, useChargeRuleMutations } from "../../graphql/hooks/chargerules";
import { useAccountLedgersQuery } from "../../graphql/hooks/accountledgers";

type Draft = {
  name: string;
  ledgerid: string;
  chargeType: string;
  value: string | number;
  gstpercent: string | number;
  minOrderValue: string | number;
  freeAboveValue: string | number;
  applyTo: string;       // "all" | party | salesman | staff | website
  paymentType: string;   // "any" | cash | cod | upi | card | credit
  onlyWhenDeliveryBoy: boolean;
  priority: string | number;
  active: boolean;
};

const EMPTY: Draft = {
  name: "", ledgerid: "", chargeType: "flat", value: "", gstpercent: "",
  minOrderValue: "", freeAboveValue: "", applyTo: "all", paymentType: "any",
  onlyWhenDeliveryBoy: false, priority: 0, active: true,
};

const CREATOR_OPTIONS = [
  { value: "all", label: "Everyone" },
  { value: "party", label: "Party" },
  { value: "salesman", label: "Salesman" },
  { value: "staff", label: "Staff" },
  { value: "website", label: "Website" },
];
const PAYMENT_OPTIONS = [
  { value: "any", label: "Any payment" },
  { value: "cash", label: "Cash" },
  { value: "cod", label: "COD" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "credit", label: "Credit" },
];

const ChargeRules = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const actions = useAppSelector((s) => selectModuleActions(s, "chargerules"));
  const { admin } = useAppSelector((s: any) => s.auth);
  const adminId = admin?.id;

  const { data, refetch } = useChargeRulesQuery(adminId);
  const { addChargeRule, editChargeRule, deleteChargeRule } = useChargeRuleMutations();
  const { data: ledgerData } = useAccountLedgersQuery();

  const rules = data?.getChargeRules || [];
  const ledgerOptions = useMemo(
    () => (ledgerData?.getAccountLedgers || []).map((l: any) => ({ value: l.id, label: l.ledgername })),
    [ledgerData]
  );

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => { refetch?.(); }, [refetch]);

  const set = (k: keyof Draft, v: any) => setDraft((d) => ({ ...d, [k]: v }));
  const reset = () => { setDraft(EMPTY); setEditingId(null); };

  const buildInput = () => ({
    adminid: adminId,
    name: String(draft.name).trim(),
    ledgerid: draft.ledgerid || null,
    chargeType: draft.chargeType,
    value: Number(draft.value || 0),
    gstpercent: Number(draft.gstpercent || 0),
    minOrderValue: Number(draft.minOrderValue || 0),
    freeAboveValue: Number(draft.freeAboveValue || 0),
    applyToCreatorTypes: draft.applyTo === "all" ? [] : [draft.applyTo],
    paymentTypes: draft.paymentType === "any" ? [] : [draft.paymentType],
    onlyWhenDeliveryBoy: !!draft.onlyWhenDeliveryBoy,
    priority: Number(draft.priority || 0),
    active: !!draft.active,
  });

  const handleSave = async () => {
    if (!draft.name.trim()) {
      dispatch(showMessage({ message: "Charge name is required.", type: "error" }));
      return;
    }
    if (Number(draft.value || 0) <= 0) {
      dispatch(showMessage({ message: "Amount / percent must be greater than 0.", type: "error" }));
      return;
    }
    try {
      if (editingId) {
        await editChargeRule({ variables: { id: editingId, input: buildInput() } });
        dispatch(showMessage({ message: "Charge rule updated.", type: "success" }));
      } else {
        await addChargeRule({ variables: { input: buildInput() } });
        dispatch(showMessage({ message: "Charge rule added.", type: "success" }));
      }
      await refetch();
      reset();
    } catch (e: any) {
      dispatch(showMessage({ message: e?.message || "Failed to save.", type: "error" }));
    }
  };

  const handleEdit = (row: any) => {
    const r = rules.find((x: any) => x.id === row.id);
    if (!r) return;
    setEditingId(r.id);
    setDraft({
      name: r.name || "",
      ledgerid: r.ledgerid?.id || "",
      chargeType: r.chargeType || "flat",
      value: r.value ?? "",
      gstpercent: r.gstpercent ?? "",
      minOrderValue: r.minOrderValue ?? "",
      freeAboveValue: r.freeAboveValue ?? "",
      applyTo: (r.applyToCreatorTypes && r.applyToCreatorTypes[0]) || "all",
      paymentType: (r.paymentTypes && r.paymentTypes[0]) || "any",
      onlyWhenDeliveryBoy: !!r.onlyWhenDeliveryBoy,
      priority: r.priority ?? 0,
      active: r.active !== false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const columns = [
    { label: "S.No", key: "seqNo" },
    { label: "Charge", key: "name" },
    { label: "Type", key: "typeText" },
    { label: "Value", key: "valueText" },
    { label: "Applies To", key: "appliesText" },
    { label: "Payment", key: "paymentText" },
    { label: "Free Above", key: "freeText" },
    { label: "Active", key: "activeText" },
  ];

  const tableData = [...rules].reverse().map((r: any, i: number) => ({
    ...r,
    seqNo: i + 1,
    typeText: r.chargeType === "percent" ? "Percent" : "Flat",
    valueText: r.chargeType === "percent" ? `${r.value}%` : `₹${r.value}`,
    appliesText: r.applyToCreatorTypes?.length ? r.applyToCreatorTypes.join(", ") : "Everyone",
    paymentText: r.paymentTypes?.length ? r.paymentTypes.join(", ").toUpperCase() : "Any",
    freeText: r.freeAboveValue ? `₹${r.freeAboveValue}` : "—",
    activeText: r.active ? "Active" : "Off",
  }));

  return (
    <HomeLayout>
      <div className="w-full space-y-3 p-4">
        {/* Add / Edit form — compact card, Save in its header (Enter also saves) */}
        <div
          className="rounded-lg border border-slate-200 bg-white"
          onKeyDown={(e) => {
            const t = e.target as HTMLElement;
            if (e.key === "Enter" && !e.defaultPrevented && t.tagName === "INPUT") {
              e.preventDefault();
              handleSave();
            }
          }}
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-1.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {editingId ? "Edit charge rule" : "Add charge rule"}
            </h2>
            <div className="ml-auto flex items-center gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex h-7 items-center rounded-md border border-slate-300 bg-white px-2.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel edit
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex h-7 items-center gap-1.5 rounded-md bg-indigo-600 px-3 text-[12px] font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                {editingId ? "Update Rule" : "Add Rule"}
                <kbd className="rounded border border-white/40 px-1 text-[10px] font-medium leading-4 text-white/80">Enter</kbd>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 items-end gap-x-3 gap-y-2 p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <FormField label="Charge Name" name="name" value={draft.name}
              onChange={(e: any) => set("name", e.target.value)} placeholder="e.g. Delivery Charge" />

            <FormField label="Post to Ledger" name="ledgerid" type="select" searchable
              value={draft.ledgerid} onChange={(e: any) => set("ledgerid", e.target.value)}
              options={ledgerOptions} />

            <FormField label="Charge Type" name="chargeType" type="select"
              value={draft.chargeType} onChange={(e: any) => set("chargeType", e.target.value)}
              options={[{ value: "flat", label: "Flat amount (₹)" }, { value: "percent", label: "Percent of order (%)" }]} />

            <FormField label="Amount / Percent" name="value" type="number"
              value={draft.value} onChange={(e: any) => set("value", e.target.value)} />

            <FormField label="GST %" name="gstpercent" type="number"
              value={draft.gstpercent} onChange={(e: any) => set("gstpercent", e.target.value)} />

            <FormField label="Apply if order ≥ (₹)" name="minOrderValue" type="number"
              value={draft.minOrderValue} onChange={(e: any) => set("minOrderValue", e.target.value)} />

            <FormField label="Free above (₹, 0 = never)" name="freeAboveValue" type="number"
              value={draft.freeAboveValue} onChange={(e: any) => set("freeAboveValue", e.target.value)} />

            <FormField label="Apply To" name="applyTo" type="select"
              value={draft.applyTo} onChange={(e: any) => set("applyTo", e.target.value)}
              options={CREATOR_OPTIONS} />

            <FormField label="Payment Type" name="paymentType" type="select"
              value={draft.paymentType} onChange={(e: any) => set("paymentType", e.target.value)}
              options={PAYMENT_OPTIONS} />

            <FormField label="Priority" name="priority" type="number"
              value={draft.priority} onChange={(e: any) => set("priority", e.target.value)} />

            <FormSwitch label="Only when Delivery Boy" name="onlyWhenDeliveryBoy"
              checked={draft.onlyWhenDeliveryBoy}
              onChange={(v: boolean) => set("onlyWhenDeliveryBoy", v)} />

            <FormSwitch label="Active" name="active" checked={draft.active}
              onChange={(v: boolean) => set("active", v)} />
          </div>
        </div>

        {/* Existing rules */}
        <DataTable
          {...actions}
          title="Charge Rules (auto-applied to orders)"
          columns={columns}
          data={tableData}
          showAdd={false}
          showPrint={false}
          showView={false}
          onEdit={(row: any) => handleEdit(row)}
          onDelete={async (row: any) => {
            if (!window.confirm(`Delete charge rule "${row.name}"?`)) return;
            try {
              await deleteChargeRule({ variables: { id: row.id } });
              await refetch();
              dispatch(showMessage({ message: "Charge rule deleted.", type: "success" }));
            } catch (e: any) {
              dispatch(showMessage({ message: e?.message || "Failed to delete.", type: "error" }));
            }
          }}
          showDeleted={true}
          onShowDeleted={() => navigate("/chargerules/deletedentries")}
          showImport={false}
          showExport={false}
        />
      </div>
    </HomeLayout>
  );
};

export default ChargeRules;
