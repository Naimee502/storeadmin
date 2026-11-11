import FormField from "../formfiled";
import { useAppSelector } from "../../redux/hooks";

export type CustomFieldDef = { key: string; label: string; entity: string; type: string; options?: string[]; print?: boolean; required?: boolean };
export type CustomFieldValue = { key: string; value?: string };

/** The business's custom fields for an entity (Business Settings → Custom Fields). */
export const useCustomFieldDefs = (entity: "product" | "lead"): CustomFieldDef[] =>
  useAppSelector((s: any) => (s.adminsettings.settings?.customFieldDefs || []).filter((d: CustomFieldDef) => d.entity === entity));

export const ITEM_TYPES = [
  { value: "finished", label: "Finished Goods" },
  { value: "raw", label: "Raw Material" },
  { value: "semifinished", label: "Semi-finished / Sub-assembly" },
  { value: "consumable", label: "Consumable" },
  { value: "spare", label: "Spare Part" },
  { value: "kit", label: "Kit / Bundle" },
];

/** Values in the shape the API saves: one entry per defined field that has a value. */
export const cleanCustomFields = (defs: CustomFieldDef[], values: CustomFieldValue[] = []): CustomFieldValue[] =>
  defs
    .map((d) => ({ key: d.key, value: String(values.find((v) => v.key === d.key)?.value ?? "").trim() }))
    .filter((v) => v.value);

/** Missing required fields, by label. */
export const missingCustomFields = (defs: CustomFieldDef[], values: CustomFieldValue[] = []) =>
  defs.filter((d) => d.required && !String(values.find((v) => v.key === d.key)?.value ?? "").trim()).map((d) => d.label);

/** Inputs for an entity's custom fields; nothing when the business has none. */
export default function CustomFieldsSection({ entity, values, onChange, title = "Specifications" }: {
  entity: "product" | "lead";
  values: CustomFieldValue[];
  onChange: (next: CustomFieldValue[]) => void;
  title?: string;
}) {
  const defs = useCustomFieldDefs(entity);
  if (!defs.length) return null;
  const valueOf = (key: string) => values.find((v) => v.key === key)?.value ?? "";
  const set = (key: string, value: string) => onChange([...values.filter((v) => v.key !== key), { key, value }]);
  return (
    <fieldset className="border rounded-xl p-4 space-y-4">
      <legend className="text-sm font-medium px-2">{title}</legend>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {defs.map((d) => (
          <FormField
            key={d.key}
            label={d.label}
            name={`cf-${d.key}`}
            type={d.type === "number" ? "number" : d.type === "date" ? "date" : d.type === "select" ? "select" : "text"}
            options={d.type === "select" ? (d.options || []).map((o) => ({ value: o, label: o })) : undefined}
            searchable={d.type === "select"}
            required={d.required}
            value={valueOf(d.key)}
            onChange={(e: any) => set(d.key, String(e.target.value ?? ""))}
          />
        ))}
      </div>
    </fieldset>
  );
}

export type SpecDef = { key: string; label: string; type: string; options?: string[]; print?: boolean; required?: boolean };

const specKey = (label: string, defs: SpecDef[]) => {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "") || "spec";
  let k = base, n = 2;
  while (defs.some((d) => d.key === k)) k = `${base}${n++}`;
  return k;
};

/** Defines a category's spec fields. Keys stay fixed once products use them. */
export function SpecDefEditor({ defs, onChange }: { defs: SpecDef[]; onChange: (next: SpecDef[]) => void }) {
  const edit = (i: number, patch: Partial<SpecDef>) => onChange(defs.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const cell = "h-8 rounded-md border border-slate-300 bg-white px-2 text-[13px]";
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] leading-snug text-slate-400">
        Every product in this category fills these in per variant. "Print" shows the spec under the item on quotations.
      </div>
      {defs.map((d, i) => (
        <div key={d.key} className="flex flex-wrap items-center gap-1.5">
          <input className={`${cell} w-44`} value={d.label} placeholder="Label" onChange={(e) => edit(i, { label: e.target.value })} />
          <div className="w-32">
            <FormField label="" name={`sd${i}type`} type="select" value={d.type}
              options={[{ value: "text", label: "Text" }, { value: "number", label: "Number" }, { value: "select", label: "Dropdown" }, { value: "date", label: "Date" }]}
              onChange={(e: any) => e.target.value && edit(i, { type: e.target.value })} />
          </div>
          {d.type === "select" && (
            <input className={`${cell} w-64`} placeholder="Choices, comma separated" value={(d.options || []).join(", ")}
              onChange={(e) => edit(i, { options: e.target.value.split(",").map((x) => x.trim()) })} />
          )}
          <label className="flex items-center gap-1 text-[12px] text-slate-600"><input type="checkbox" checked={!!d.required} onChange={(e) => edit(i, { required: e.target.checked })} /> Required</label>
          <label className="flex items-center gap-1 text-[12px] text-slate-600"><input type="checkbox" checked={!!d.print} onChange={(e) => edit(i, { print: e.target.checked })} /> Print</label>
          <button type="button" className={`${cell} text-rose-600`} title="Remove" onClick={() => onChange(defs.filter((_, j) => j !== i))}>x</button>
        </div>
      ))}
      <button type="button" className={`${cell} text-indigo-600`}
        onClick={() => onChange([...defs, { key: specKey(`spec${defs.length + 1}`, defs), label: "", type: "text", options: [], print: false, required: false }])}>
        + Add spec field
      </button>
    </div>
  );
}

/** Spec inputs for one variant, driven by its category's defs. */
export function SpecValues({ defs, values, onChange }: { defs: SpecDef[]; values: CustomFieldValue[]; onChange: (next: CustomFieldValue[]) => void }) {
  if (!defs.length) return null;
  const valueOf = (key: string) => values.find((v) => v.key === key)?.value ?? "";
  const set = (key: string, value: string) => onChange([...values.filter((v) => v.key !== key), { key, value }]);
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {defs.map((d) => (
        <FormField
          key={d.key}
          label={d.label || d.key}
          name={`spec_${d.key}`}
          type={d.type === "select" ? "select" : d.type === "number" ? "number" : d.type === "date" ? "date" : "text"}
          searchable={d.type === "select"}
          options={d.type === "select" ? (d.options || []).filter(Boolean).map((o) => ({ value: o, label: o })) : undefined}
          value={valueOf(d.key)}
          onChange={(e: any) => set(d.key, e.target.value)}
        />
      ))}
    </div>
  );
}
