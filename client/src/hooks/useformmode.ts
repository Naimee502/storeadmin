import { createContext, createElement, useContext, type ReactNode } from "react";
import { useParams } from "react-router";
import { useAppSelector } from "../redux/hooks";

// A field is true/false (both Add and Edit) or { add, edit }; missing means on.
export type FieldMode = "add" | "edit";
export type FieldRule = boolean | { add?: boolean; edit?: boolean };

const modeOf = (v: any, mode: FieldMode): boolean | undefined =>
  v === undefined || v === null ? undefined : typeof v === "object" ? (v[mode] === undefined ? undefined : v[mode] !== false) : v !== false;

/** Is this field on? Without a mode (lists, import/export): on if on for Add or Edit. */
export const fieldOn = (perms: Record<string, any> | undefined, field: string, mode?: FieldMode): boolean => {
  const v = perms?.[field];
  if (mode) return modeOf(v, mode) !== false;
  return modeOf(v, "add") !== false || modeOf(v, "edit") !== false;
};

/** Both modes of a field, missing = on. */
export const ruleOf = (v: any): { add: boolean; edit: boolean } => ({ add: modeOf(v, "add") !== false, edit: modeOf(v, "edit") !== false });

/** Stored form: one boolean when both modes agree (old readers keep working). */
export const compactRule = (add: boolean, edit: boolean): FieldRule => (add === edit ? add : { add, edit });

/** Add or Edit, from the form route (`/x/addedit/:id` is Edit). */
export const useFormMode = (): FieldMode => (useParams<{ id?: string }>().id ? "edit" : "add");

// Lets FormField hide a switched-off field by its `name`, for forms wrapped in <FormRules>.
const FormRulesContext = createContext<{ perms: Record<string, any> | undefined; mode: FieldMode } | null>(null);

export const FormRules = ({ module, children }: { module: string; children: ReactNode }) => {
  const perms = useAppSelector((s: any) => s.permissions?.permissions?.formPermissions?.[module]);
  const mode = useFormMode();
  return createElement(FormRulesContext.Provider, { value: { perms, mode } }, children);
};

/** False when the surrounding <FormRules> has this field off for the current mode. */
export const useFieldVisible = (name?: string): boolean => {
  const rules = useContext(FormRulesContext);
  return !rules || !name || fieldOn(rules.perms, name, rules.mode);
};
