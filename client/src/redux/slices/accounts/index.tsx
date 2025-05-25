import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface Account {
  id: string;
  accountcode: string;
  name: string;
  accountgroupid: string;
  mobile: string;
  email: string;
  address: string;
  city: string;
  pincode: string;
  status: boolean;
}

interface AccountState {
  accounts: Account[];
}

const initialState: AccountState = {
  accounts: [],
};

const accountSlice = createSlice({
  name: 'accounts',
  initialState,
  reducers: {
    addAccounts: (state, action: PayloadAction<Account[]>) => {
      state.accounts.push(...action.payload);
    },
    clearAccounts: (state) => {
      state.accounts = [];
    },
  },
});

export const { addAccounts, clearAccounts } = accountSlice.actions;

export default accountSlice.reducer;
