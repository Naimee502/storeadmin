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
  state: string;
  country: string;
  pincode: string;
  gstnumber: string;
  pan: string;
  openingbalance: number;
  openingbalancetype: "debit" | "credit";
  creditlimit: number;
  bankname: string;
  bankaccountnumber: string;
  ifsc: string;
  upiid: string;
  billingcycle: "daily" | "weekly" | "monthly";
  duedays: number;
  type: "customer" | "vendor" | "expense" | "bank" | "other";
  isposcustomer: boolean;
  status: boolean;
  adminid: string;
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
