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
