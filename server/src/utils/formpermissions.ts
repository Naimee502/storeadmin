import { Admin } from "../models/admin";
import { Branch } from "../models/branches";
import { StaffAccount } from "../models/staffaccounts";
import { AccessRole } from "../models/accessroles";

/**
 * Form-field permissions ("which fields a form shows"), per level:
 *   Business (Admin.defaultPermissions.formPermissions)
 *     → Branch (Branch.permissions.formPermissions)
 *       → Staff (StaffAccount.permissions.formPermissions)
 *
 * Merged field by field. A lower level can only TURN OFF more fields: a field
 * the business switched off stays off for every branch and staff member, even
 * if a branch document still holds an old `true` for it. A missing value
 * means "inherit".
 */
// A field is `true`/`false` (both Add and Edit) or `{ add, edit }`; missing means on.
export type FieldRule = boolean | { add?: boolean; edit?: boolean };
export type FormPerms = Record<string, Record<string, FieldRule>>;
export type FieldMode = "add" | "edit";

const modeOf = (v: any, mode: FieldMode): boolean | undefined =>
  v === undefined || v === null ? undefined : typeof v === "object" ? (v[mode] === undefined ? undefined : v[mode] !== false) : v !== false;

/** Is this field on? Without a mode: on if it is on for Add or Edit. */
export const fieldOn = (perms: Record<string, any> | undefined, field: string, mode?: FieldMode): boolean => {
  const v = perms?.[field];
  if (mode) return modeOf(v, mode) !== false;
  return modeOf(v, "add") !== false || modeOf(v, "edit") !== false;
};

// Same value in both modes is kept as a plain boolean, so old readers still understand it.
const compact = (add: boolean | undefined, edit: boolean | undefined): FieldRule | undefined =>
  add === edit ? add : { ...(add !== undefined ? { add } : {}), ...(edit !== undefined ? { edit } : {}) };

export const mergeFormPermissions = (parent: FormPerms = {}, child: FormPerms = {}): FormPerms => {
  const out: FormPerms = {};
  const modules = new Set([...Object.keys(parent || {}), ...Object.keys(child || {})]);
  modules.forEach((m) => {
    const p = (parent || {})[m] || {};
    const c = (child || {})[m] || {};
    const fields = new Set([...Object.keys(p), ...Object.keys(c)]);
    const merged: Record<string, FieldRule> = {};
    fields.forEach((f) => {
      // Per mode: parent off → always off; otherwise the child's value, else the parent's.
      const pick = (mode: FieldMode) => {
        const pv = modeOf(p[f], mode);
        const cv = modeOf(c[f], mode);
        return pv === false ? false : cv !== undefined ? cv : pv;
      };
      const rule = compact(pick("add"), pick("edit"));
      if (rule !== undefined) merged[f] = rule;
    });
    out[m] = merged;
  });
  return out;
};

/** Effective form permissions for the logged-in back-office user. */
export const effectiveFormPermissions = async (opts: {
  adminid: any;
  userType?: string;
  userId?: any;
}): Promise<FormPerms> => {
  const admin: any = await Admin.findById(opts.adminid).select("defaultPermissions").lean();
  let perms: FormPerms = admin?.defaultPermissions?.formPermissions || {};
  if (opts.userType === "branch" && opts.userId) {
    const b: any = await Branch.findById(opts.userId).select("permissions").lean();
    perms = mergeFormPermissions(perms, b?.permissions?.formPermissions);
  } else if (opts.userType === "staff" && opts.userId) {
    const s: any = await StaffAccount.findById(opts.userId).select("permissions branchid accessroleid").lean();
    const b: any = s?.branchid ? await Branch.findById(s.branchid).select("permissions").lean() : null;
    const r: any = s?.accessroleid ? await AccessRole.findOne({ _id: s.accessroleid, status: true }).select("permissions").lean() : null;
    perms = mergeFormPermissions(perms, b?.permissions?.formPermissions);
    perms = mergeFormPermissions(perms, r?.permissions?.formPermissions);
    perms = mergeFormPermissions(perms, s?.permissions?.formPermissions);
  }
  return perms;
};
