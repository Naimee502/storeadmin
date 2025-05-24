import { createSlice } from '@reduxjs/toolkit';
import type { RootState } from '../../store';

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
    addBranch: (state, action) => {
      const newId = crypto.randomUUID();
      const branchcode = `#BRC${String(state.branches.length + 1).padStart(4, '0')}`;
      const newBranch = {
        ...action.payload,
        id: newId,
        branchcode,
      };
      console.log('New Branch Added:', newBranch);
      state.branches.push(newBranch);
    },

    editBranch: (state, action) => {
      const index = state.branches.findIndex(branch => branch.id === action.payload.id);
      if (index !== -1) {
        const existingBranch = state.branches[index];
        state.branches[index] = {
          ...action.payload,
          branchcode: existingBranch.branchcode,
        };
      }
    },

    deleteBranch: (state, action) => {
      state.branches = state.branches.filter(branch => branch.id !== action.payload);
    },
  },
});

export const { addBranch, editBranch, deleteBranch } = branchSlice.actions;

export const getBranchById = (state: RootState, id: string) =>
  state.branches.branches.find((branch: Branch) => branch.id === id);

export default branchSlice.reducer;
