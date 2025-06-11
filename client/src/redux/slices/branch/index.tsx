import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface SelectedBranchState {
  branchId: string;
}

const initialState: SelectedBranchState = {
  branchId: localStorage.getItem("branchid") || "",
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
