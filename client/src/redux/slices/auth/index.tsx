import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface AdminData {
  id: string;
  name: string;
  email: string;
  subscriptionType: 'monthly' | 'yearly' | 'lifetime';
  subscribed: boolean;
  subscribedAt: string;
  subscriptionEnd: string;
  transactionId: string;
  needsReview: boolean;
  rejected: boolean;
  companyName: string;
  mobile: string;
  noOfBranches: number;
  businesstype: 'retail' | 'wholesale' | 'manufacturer' | 'service' | 'trader' | 'other';
  allowedmodules: string[];
  isExpiringSoon?: boolean;
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

interface StaffData {
  id: string;
  name: string;
  email: string;
  role: string;
  branchid?: {
    id: string;
    branchname: string;
  };
  admin?: AdminData;
}

interface AuthState {
  type: 'admin' | 'branch' | 'staff' | null;
  admin: AdminData | null;
  branch: BranchData | null;
  staff: StaffData | null;
}

const initialState: AuthState = {
  type: null,
  admin: null,
  branch: null,
  staff: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    saveAuthData: (
      state,
      action: PayloadAction<{
        type: 'admin' | 'branch' | 'staff';
        admin?: AdminData;
        branch?: BranchData;
        staff?: StaffData;
      }>
    ) => {
      state.type = action.payload.type;
      if (action.payload.type === 'admin' && action.payload.admin) {
        state.admin = action.payload.admin;
        state.branch = null;
        state.staff = null;
      } else if (action.payload.type === 'branch' && action.payload.branch) {
        state.branch = action.payload.branch;
        state.admin = action.payload.branch.admin ?? null;
        state.staff = null;
      } else if (action.payload.type === 'staff' && action.payload.staff) {
        state.staff = action.payload.staff;
        state.admin = action.payload.staff.admin ?? null;
        state.branch = null;
      }
    },
    clearAuthData: () => initialState,
  },
});

export const { saveAuthData, clearAuthData } = authSlice.actions;
export default authSlice.reducer;
