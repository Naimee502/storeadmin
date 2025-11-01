import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface AccountLedger {
  id: string;
  ledgercode: string;
  ledgername: string;
  accountgroupid?: string | null;
  status: boolean;
}

interface AccountLedgersState {
  accountledgers: AccountLedger[];
}

const initialState: AccountLedgersState = {
  accountledgers: [],
};

const accountLedgersSlice = createSlice({
  name: "accountledgers",
  initialState,
  reducers: {
    addAccountLedgers: (state, action: PayloadAction<AccountLedger[]>) => {
      state.accountledgers = action.payload;
    },
    clearAccountLedgers: (state) => {
      state.accountledgers = [];
    },
  },
});

export const { addAccountLedgers, clearAccountLedgers } = accountLedgersSlice.actions;
export default accountLedgersSlice.reducer;
