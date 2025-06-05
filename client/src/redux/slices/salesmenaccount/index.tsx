import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface Salesman {
  id: string;
  salesmancode: string;
  name: string;
  mobile: string;
  email: string;
  password: string;
  profilepicture: string;
  address: string;
  commission: string;
  target: string;
  status: boolean;
}

interface SalesmanState {
  salesmen: Salesman[];
}

const initialState: SalesmanState = {
  salesmen: [],
};

const salesmanAccountSlice = createSlice({
  name: 'salesmenaccount',
  initialState,
  reducers: {
    addSalesmen: (state, action: PayloadAction<Salesman[]>) => {
      state.salesmen.push(...action.payload);
    },
    clearSalesmen: (state) => {
      state.salesmen = [];
    },
  },
});

export const { addSalesmen, clearSalesmen } = salesmanAccountSlice.actions;

export default salesmanAccountSlice.reducer;
