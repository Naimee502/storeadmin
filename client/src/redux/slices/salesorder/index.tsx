import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface SalesOrderState {
  orders: any[];
}

const initialState: SalesOrderState = {
  orders: [],
};

const salesOrderSlice = createSlice({
  name: 'salesorder',
  initialState,
  reducers: {
    addSalesOrders: (state, action: PayloadAction<any[]>) => {
      state.orders = action.payload;
    },
    clearSalesOrders: (state) => {
      state.orders = [];
    },
  },
});

export const { addSalesOrders, clearSalesOrders } = salesOrderSlice.actions;
export default salesOrderSlice.reducer;
