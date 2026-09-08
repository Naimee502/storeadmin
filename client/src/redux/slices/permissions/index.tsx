import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { findModule, DEFAULT_ON_MODULE_IDS, type ModuleAction } from "../../../config/modules";

interface PermissionsState {
  permissions: Record<string, Record<string, boolean>>;
  isLoaded: boolean;
}

const initialState: PermissionsState = {
  permissions: {},
  isLoaded: false,
};

const permissionsSlice = createSlice({
  name: "permissions",
  initialState,
  reducers: {
    setPermissions: (state, action: PayloadAction<Record<string, Record<string, boolean>>>) => {
      state.permissions = action.payload;
      state.isLoaded = true;
    },
    clearPermissions: (state) => {
      state.permissions = {};
      state.isLoaded = false;
    },
  },
});

export const { setPermissions, clearPermissions } = permissionsSlice.actions;

// ── Helper: check if moduleId is in the user's allowedmodules chain ──
const isModuleInAllowed = (state: any, moduleId: string): boolean => {
  const role = state.auth.type?.toString().toLowerCase();
  const mid = moduleId.toLowerCase();

  // Default-on modules (newly added) are always allowed at the business level
  // even for tenants whose allowedmodules array predates the module. Branch/
  // staff overrides below still apply.
  if (DEFAULT_ON_MODULE_IDS.includes(mid)) return true;

  const includes = (arr: string[] | null | undefined) => {
    if (!arr || !Array.isArray(arr)) return true; // null/undefined = no restriction
    return arr.some((m: string) => m.toLowerCase() === mid);
  };

  // Level 1: Business (admin) allowed
  const businessAllowed = state.auth.admin?.allowedmodules;
  if (!includes(businessAllowed)) return false;

  // Level 2: Branch allowed (for branch and staff roles)
  if (role === "branch" || role === "staff") {
    const branchAllowed = state.auth.branch?.allowedmodules;
    if (!includes(branchAllowed)) return false;
  }

  // Level 3: Staff allowed (for staff role only)
  if (role === "staff") {
    const staffAllowed = state.auth.staff?.allowedmodules;
    if (!includes(staffAllowed)) return false;
  }

  return true;
};

// Selector to check if a specific module is allowed
export const selectIsModuleAllowed = (state: any, moduleId: string): boolean => {
  return isModuleInAllowed(state, moduleId);
};

// Business-level "is this module part of how the company works" check —
// business + branch allowance only, deliberately SKIPPING the staff-level
// restriction (Level 3 above). Use this for workflow decisions that must
// look the same for every role at a branch (e.g. "does this business
// convert Sales Orders to Sales Invoices, or keep orders standalone?"),
// as opposed to selectIsModuleAllowed which also gates a staff member's own
// page access and should stay staff-restricted for that purpose.
export const selectIsModuleBusinessEnabled = (state: any, moduleId: string): boolean => {
  const mid = moduleId.toLowerCase();
  if (DEFAULT_ON_MODULE_IDS.includes(mid)) return true;

  const includes = (arr: string[] | null | undefined) => {
    if (!arr || !Array.isArray(arr)) return true;
    return arr.some((m: string) => m.toLowerCase() === mid);
  };

  const businessAllowed = state.auth.admin?.allowedmodules;
  if (!includes(businessAllowed)) return false;

  const role = state.auth.type?.toString().toLowerCase();
  if (role === "branch" || role === "staff") {
    const branchAllowed = state.auth.branch?.allowedmodules;
    if (!includes(branchAllowed)) return false;
  }

  return true;
};

/**
 * Find a module's saved permission record, whatever case it was stored under.
 * `undefined` means the module has no record at all — nothing was ever
 * configured for it — which is different from a record that simply does not
 * grant a particular action.
 */
export const findSectionPerms = (
  permissions: Record<string, any>,
  moduleId: string
): Record<string, boolean> | undefined => {
  const targetId = moduleId.toLowerCase();
  return Object.entries(permissions || {}).find(([k]) => k.toLowerCase() === targetId)?.[1] as any;
};

/**
 * The ONE rule for "is this action allowed", used by both the runtime gate here
 * and the Business Permissions matrix, so a checkbox can never disagree with
 * what the app actually does.
 *
 *   • explicit true / false        → obey it.
 *   • module saved, action MISSING → deny. The admin has configured this
 *     module; an action absent from that record was never granted to it.
 *   • no record for the module     → allow (nothing configured yet).
 *
 * The middle case is the one that shipped a bug: when a new action is added to
 * a module (Print and WhatsApp on Sales / Purchase Orders), every tenant whose
 * permissions were saved BEFORE that release has a record without the new key.
 * The matrix drew those boxes unchecked — `!!draft?.[id]?.[action]` — while the
 * old rule here read the same missing key as "allow", so the buttons appeared
 * in the Actions column of a business that had never been given them. A new
 * capability now stays off until someone ticks it, which is also what the
 * server's own permissions resolver documents ("missing = deny by default").
 */
export const resolveAction = (
  sectionPerms: Record<string, boolean> | undefined,
  action: string
): boolean => {
  if (!sectionPerms) return true;
  return sectionPerms[action] === true;
};

// Selectors for slice-based access
export const selectModuleActions = (state: any, moduleId: string) => {
  const role = state.auth.type?.toString().toLowerCase();
  const { permissions, isLoaded } = state.permissions;

  const mod = findModule(moduleId);

  // ── Gate: if module is not in allowedmodules, deny everything ──
  const moduleAllowed = isModuleInAllowed(state, moduleId);

  // Fresh install admin bypass: if admin and no permissions saved, grant all.
  const isAdminBypass = role === "admin" && isLoaded && Object.keys(permissions).length === 0;

  const allow = (action: ModuleAction) => {
    // If the module itself is not allowed at any level, deny all actions
    if (!moduleAllowed) return false;

    if (isAdminBypass) return true;
    if (!mod || !mod.actions.includes(action)) return false;

    return resolveAction(findSectionPerms(permissions, moduleId), action);
  };

  return {
    showView: allow("view"),
    showAdd: allow("add"),
    showEdit: allow("edit"),
    showDelete: allow("delete"),
    showPrint: allow("print"),
    showReturn: allow("return"),
    showCancel: allow("cancel"),
    showConvert: allow("convert"),
    showWhatsApp: allow("whatsapp"),
    showImport: allow("import"),
    showExport: allow("export"),
    showExportExcel: allow("exportexcel"),
    showExportCsv: allow("exportcsv"),
    showExportPdf: allow("exportpdf"),
    canReset: allow("reset"),
    showDeleted: allow("delete"),
  };
};
export const selectIsFormFieldEnabled = (state: any, moduleId: string, fieldId: string): boolean => {
  const { permissions } = state.permissions;
  if (!permissions || !permissions.formPermissions) return true;
  
  const modulePerms = permissions.formPermissions[moduleId];
  if (!modulePerms) return true;
  
  if (modulePerms[fieldId] !== undefined) {
    return !!modulePerms[fieldId];
  }
  
  return true;
};

export default permissionsSlice.reducer;
