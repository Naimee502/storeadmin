import { Admin } from "../models/admin";
import { Branch } from "../models/branches";
import { StaffAccount } from "../models/staffaccounts";
import { TenantError } from "./tenant";

/**
 * Server-side module switch.
 *
 * Business Settings → Modules writes `allowedmodules` on Admin (business
 * level), Branch and StaffAccount. The admin panel, the app and the website all
 * hide a module that is switched off, but hiding a screen is not a lock: an old
 * app build or a hand-made request would still reach the resolver. Features
 * that are opt-in per business (Expense Claims, Announcements) call this before
 * doing anything.
 *
 * Same rule as the clients: a missing / null / empty list means "everything
 * on" (tenants created before modules existed).
 */

const cache = new Map<string, { value: string[] | null; at: number }>();
const TTL_MS = 30_000;

const listOf = async (kind: "admin" | "branch" | "staff", id: any): Promise<string[] | null> => {
  if (!id) return null;
  const key = `${kind}:${String(id)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const Model: any = kind === "admin" ? Admin : kind === "branch" ? Branch : StaffAccount;
  let value: string[] | null = null;
  try {
    const doc: any = await Model.findById(id).select("allowedmodules").lean();
    value = Array.isArray(doc?.allowedmodules) && doc.allowedmodules.length > 0 ? doc.allowedmodules : null;
  } catch {
    value = null;
  }
  if (cache.size > 5000) cache.clear();
  cache.set(key, { value, at: Date.now() });
  return value;
};

const includes = (list: string[] | null, moduleId: string) =>
  list === null || list.some((m) => String(m).toLowerCase() === moduleId.toLowerCase());

/** Is the module on for this business (and, when given, this branch / staff)? */
export const isModuleOn = async (
  moduleId: string,
  scope: { adminid: any; branchid?: any; staffid?: any }
): Promise<boolean> => {
  if (!includes(await listOf("admin", scope.adminid), moduleId)) return false;
  if (scope.branchid && !includes(await listOf("branch", scope.branchid), moduleId)) return false;
  if (scope.staffid && !includes(await listOf("staff", scope.staffid), moduleId)) return false;
  return true;
};

/** Throw a clear error when the module is switched off. */
export const assertModuleOn = async (
  moduleId: string,
  label: string,
  scope: { adminid: any; branchid?: any; staffid?: any }
) => {
  if (!(await isModuleOn(moduleId, scope))) {
    throw new TenantError(`${label} is switched off for this business.`);
  }
};
