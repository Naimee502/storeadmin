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

  // Default-on modules are allowed at business level even for older tenants.
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

// Business + branch allowance only (no staff restriction), for role-independent workflow checks.
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

/** Module's saved permission record, any case; `undefined` means never configured. */
export const findSectionPerms = (
  permissions: Record<string, any>,
  moduleId: string
): Record<string, boolean> | undefined => {
  const targetId = moduleId.toLowerCase();
  return Object.entries(permissions || {}).find(([k]) => k.toLowerCase() === targetId)?.[1] as any;
};

/** Action rule: explicit true/false wins; saved module missing the action → deny; no record → allow. */
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
    canClear: allow("clear"),
    showRearrange: allow("rearrange"),
    showDeleted: allow("delete"),
    // Expense Notes → "Expense Claims" checkbox: claims tab + app claims screen.
    showClaims: allow("claims"),
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
