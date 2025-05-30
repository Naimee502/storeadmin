import { createSlice } from '@reduxjs/toolkit';

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
}

interface AuthState {
  type: 'admin' | 'branch' | null;
  admin: {
    name: string;
  } | null;
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
    saveAuthData: (state, action) => {
      if (action.payload.type === 'admin') {
        state.type = 'admin';
        state.admin = { name: action.payload.name };
        state.branch = null;
      } else if (action.payload.type === 'branch') {
        state.type = 'branch';
        state.branch = action.payload.branch;
        state.admin = null;
      }
    },
    clearAuthData() {
      return { ...initialState };
    },
  },
});

export const { saveAuthData, clearAuthData } = authSlice.actions;
export default authSlice.reducer;

