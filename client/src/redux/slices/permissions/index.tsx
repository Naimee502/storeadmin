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

// Selectors for slice-based access
export const selectModuleActions = (state: any, moduleId: string) => {
  const role = state.auth.type?.toString().toLowerCase();
  const { permissions, isLoaded } = state.permissions;
  
  const mod = findModule(moduleId);
  
  // Fresh install admin bypass: if admin and no permissions saved, grant all.
  const isAdminBypass = role === "admin" && isLoaded && Object.keys(permissions).length === 0;

  const allow = (action: ModuleAction) => {
    if (isAdminBypass) return true;
    if (!mod || !mod.actions.includes(action)) return false;

    // Use normalized moduleId for lookup
    const targetId = moduleId.toLowerCase();
    const sectionPerms = Object.entries(permissions).find(([k]) => k.toLowerCase() === targetId)?.[1] as any;

    const userPerm = sectionPerms?.[action];
    if (userPerm === false) return false;
    if (userPerm === true) return true;

    // If undefined:
    if (role === "admin") return true; 
    return false; // Others are denied by default if undefined
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
