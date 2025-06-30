import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface AdminData {
  id: string;
  name: string;
  email: string;
  subscriptionType: 'monthly' | 'yearly';
  subscribed: boolean;
  subscribedAt: string;
  subscriptionEnd: string;
  transactionId: string;
  needsReview: boolean;
  rejected: boolean;
}

interface BranchData {
  id: string;
  branchname: string;
  branchcode: string;
  email: string;
  mobile: string;
  phone: string;
  address: string;
  city: string;
  location: string;
  logo: string;
  pincode: string;
  password: string;
  status: boolean;
  admin?: AdminData;
}

interface AuthState {
  type: 'admin' | 'branch' | null;
  admin: AdminData | null;
  branch: BranchData | null;
}

const initialState: AuthState = {
  type: null,
  admin: null,
  branch: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    saveAuthData: (
      state,
      action: PayloadAction<{
        type: 'admin' | 'branch';
        admin?: AdminData;
        branch?: BranchData;
      }>
    ) => {
      if (action.payload.type === 'admin' && action.payload.admin) {
        state.type = 'admin';
        state.admin = action.payload.admin;
        state.branch = null;
      } else if (action.payload.type === 'branch' && action.payload.branch) {
        state.type = 'branch';
        state.branch = action.payload.branch;
        state.admin = null;
      }
    },
    clearAuthData: () => initialState,
  },
});

export const { saveAuthData, clearAuthData } = authSlice.actions;
export default authSlice.reducer;
