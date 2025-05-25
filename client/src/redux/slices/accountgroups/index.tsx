import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface AccountGroup {
  id: string;
  accountgroupcode: string;
  accountgroupname: string;
  status: boolean;
}

interface AccountGroupsState {
  accountgroups: AccountGroup[];
}

const initialState: AccountGroupsState = {
  accountgroups: [],
};

const accountGroupsSlice = createSlice({
  name: "accountgroups",
  initialState,
  reducers: {
    addAccountGroups: (state, action: PayloadAction<AccountGroup[]>) => {
      state.accountgroups = action.payload;
    },
    clearAccountGroups: (state) => {
      state.accountgroups = [];
    },
  },
});

export const { addAccountGroups, clearAccountGroups } = accountGroupsSlice.actions;
export default accountGroupsSlice.reducer;
