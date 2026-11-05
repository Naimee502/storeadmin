import { Admin } from "../models/admin";
import { Branch } from "../models/branches";
import { StaffAccount } from "../models/staffaccounts";

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
export type FormPerms = Record<string, Record<string, boolean>>;

export const mergeFormPermissions = (parent: FormPerms = {}, child: FormPerms = {}): FormPerms => {
  const out: FormPerms = {};
  const modules = new Set([...Object.keys(parent || {}), ...Object.keys(child || {})]);
  modules.forEach((m) => {
    const p = (parent || {})[m] || {};
    const c = (child || {})[m] || {};
    const fields = new Set([...Object.keys(p), ...Object.keys(c)]);
    const merged: Record<string, boolean> = {};
    fields.forEach((f) => {
      if (p[f] === false) merged[f] = false; // parent off → always off
      else if (c[f] !== undefined) merged[f] = c[f];
      else merged[f] = p[f];
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
    const s: any = await StaffAccount.findById(opts.userId).select("permissions branchid").lean();
    const b: any = s?.branchid ? await Branch.findById(s.branchid).select("permissions").lean() : null;
    perms = mergeFormPermissions(perms, b?.permissions?.formPermissions);
    perms = mergeFormPermissions(perms, s?.permissions?.formPermissions);
  }
  return perms;
};
