import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { findModule, type ModuleAction } from "../../../config/modules";

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

    // Use normalized moduleId for lookup
    const targetId = moduleId.toLowerCase();
    const sectionPerms = Object.entries(permissions).find(([k]) => k.toLowerCase() === targetId)?.[1] as any;

    const userPerm = sectionPerms?.[action];
    if (userPerm === false) return false;
    if (userPerm === true) return true;

    // If undefined: module is already in allowedmodules (checked above),
    // so allow the action for all roles. Admin can explicitly deny via false.
    return true;
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
    showReset: allow("reset"),
    showDeleted: allow("delete"),
  };
};

export default permissionsSlice.reducer;
