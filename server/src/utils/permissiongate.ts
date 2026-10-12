import { Admin } from "../models/admin";
import { Branch } from "../models/branches";
import { StaffAccount } from "../models/staffaccounts";

/**
 * Server-side twin of the admin panel's resolveAction() (redux/slices/permissions).
 *
 * Effective permissions = Admin defaults, overridden by Branch, overridden by
 * Staff — the same merge getEffectivePermissions does. Then the same rule:
 *   • nothing saved at all            → allow (fresh install)
 *   • no record for the module        → allow (nothing configured yet)
 *   • module saved, action missing    → deny  (never granted)
 *   • explicit true / false           → obey it
 */
export const isActionAllowed = async (
  moduleId: string,
  action: string,
  scope: { adminid: any; branchid?: any; staffid?: any }
): Promise<boolean> => {
  const [admin, branch, staff]: any[] = await Promise.all([
    Admin.findById(scope.adminid).select("defaultPermissions").lean(),
    scope.branchid ? Branch.findById(scope.branchid).select("permissions").lean() : null,
    scope.staffid ? StaffAccount.findById(scope.staffid).select("permissions").lean() : null,
  ]);

  const layers = [admin?.defaultPermissions, branch?.permissions, staff?.permissions].filter(Boolean);
  const anythingSaved = layers.some((l: any) => Object.keys(l || {}).some((k) => k !== "formPermissions"));
  if (!anythingSaved) return true;

  const key = moduleId.toLowerCase();
  let record: Record<string, boolean> | undefined;
  for (const layer of layers) {
    const entry = Object.entries(layer || {}).find(([k]) => k.toLowerCase() === key)?.[1] as any;
    if (entry) record = { ...(record || {}), ...entry };
  }
  if (!record) return true;
  return record[action] === true;
};

/**
 * Is ANY of these actions allowed? Used for modules where unticking every
 * permission box means "this business does not use it" (Announcements): the
 * menu then disappears from the admin panel, the app and the website.
 */
export const isAnyActionAllowed = async (
  moduleId: string,
  actions: string[],
  scope: { adminid: any; branchid?: any; staffid?: any }
): Promise<boolean> => {
  for (const a of actions) {
    if (await isActionAllowed(moduleId, a, scope)) return true;
  }
  return false;
};
