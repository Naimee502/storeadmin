import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface SelectedBranchState {
  branchId: string;
}

/**
 * Starts empty on purpose.
 *
 * Reading localStorage here evaluated ONCE at module load, so after a LOGOUT
 * (which resets every slice to its initialState) the old branch came back from
 * a value captured before the user even signed out. The saved branch is
 * restored explicitly at startup instead — see src/index.tsx.
 */
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
