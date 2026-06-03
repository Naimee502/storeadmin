import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface TenantState {
  adminId: string | null;
  companyName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  tagline: string | null;
  branchId: string | null;
}

const initialState: TenantState = {
  adminId: null,
  companyName: 'My Business',
  logoUrl: null,
  primaryColor: null,
  tagline: null,
  branchId: null,
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

export const { setTenant, setBranch, clearTenant } = tenantSlice.actions;
export default tenantSlice.reducer;
