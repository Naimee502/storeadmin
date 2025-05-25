import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface Branch {
  id: string;
  branchcode: string;
  branchname: string;
  mobile: string;
  password: string;
  logo: string;
  location: string;
  address: string;
  city: string;
  pincode: string;
  phone: string;
  email: string;
  status: boolean;
}

interface BranchState {
  branches: Branch[];
}

const initialState: BranchState = {
  branches: [],
};

const branchSlice = createSlice({
  name: 'branches',
  initialState,
  reducers: {
    addBranches: (state, action: PayloadAction<Branch[]>) => {
      state.branches.push(...action.payload);
    },
    clearBranches: (state) => {
      state.branches = [];
    },
  },
});

export const { addBranches, clearBranches } = branchSlice.actions;

export default branchSlice.reducer;
