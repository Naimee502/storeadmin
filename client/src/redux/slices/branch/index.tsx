import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface SelectedBranchState {
  branchId: string;
}

// Starts empty so logout can't restore a stale branch; restored in src/index.tsx.
const initialState: SelectedBranchState = {
  branchId: "",
};

const selectedBranchSlice = createSlice({
  name: "selectedBranch",
  initialState,
  reducers: {
    setBranchId: (state, action: PayloadAction<string>) => {
      state.branchId = action.payload;
      localStorage.setItem("branchid", action.payload);
    },
    clearBranchId: (state) => {
      state.branchId = "";
      localStorage.removeItem("branchid");
    },
  },
});

export const { setBranchId, clearBranchId } = selectedBranchSlice.actions;

export default selectedBranchSlice.reducer;
