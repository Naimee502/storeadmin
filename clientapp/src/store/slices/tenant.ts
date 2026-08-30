import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface TenantState {
  adminId: string | null;
  companyName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  tagline: string | null;
  branchId: string | null;
  // Human-entered business code (e.g. "#ADM0001"). Identifies the business at
  // activation; it no longer decides the theme — `primaryColor` does.
  businessCode: string | null;
}

const initialState: TenantState = {
  adminId: null,
  companyName: 'My Business',
  logoUrl: null,
  primaryColor: null,
  tagline: null,
  branchId: null,
  businessCode: null,
};

const tenantSlice = createSlice({
  name: 'tenant',
  initialState,
  reducers: {
    setTenant: (state, action: PayloadAction<TenantState>) => {
      state.adminId      = action.payload.adminId;
      state.companyName  = action.payload.companyName;
      state.logoUrl      = action.payload.logoUrl;
      state.primaryColor = action.payload.primaryColor;
      state.tagline      = action.payload.tagline;
      state.branchId     = action.payload.branchId;
      state.businessCode = action.payload.businessCode ?? null;
    },
    // Branding is read once at activation so the very first screen already
    // wears it, but the admin can change it in the web panel afterwards. This
    // lets the running app pick that up without re-activating.
    setBranding: (
      state,
      action: PayloadAction<{ logoUrl?: string | null; primaryColor?: string | null }>
    ) => {
      if (action.payload.logoUrl !== undefined) state.logoUrl = action.payload.logoUrl;
      if (action.payload.primaryColor !== undefined) state.primaryColor = action.payload.primaryColor;
    },
    // Update just the active admin/branch (e.g. when a staff member logs in)
    // without wiping the rest of the tenant branding configured earlier.
    setBranch: (
      state,
      action: PayloadAction<{ adminId?: string | null; branchId: string | null }>
    ) => {
      if (action.payload.adminId) state.adminId = action.payload.adminId;
      state.branchId = action.payload.branchId;
    },
    clearTenant: () => initialState,
  },
});

export const { setTenant, setBranding, setBranch, clearTenant } = tenantSlice.actions;
export default tenantSlice.reducer;
