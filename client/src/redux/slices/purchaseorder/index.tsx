import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface PurchaseOrderState {
  orders: any[];
}

const initialState: PurchaseOrderState = {
  orders: [],
};

const purchaseOrderSlice = createSlice({
  name: 'purchaseorder',
  initialState,
  reducers: {
    addPurchaseOrders: (state, action: PayloadAction<any[]>) => {
      state.orders = action.payload;
    },
    clearPurchaseOrders: (state) => {
      state.orders = [];
    },
  },
});

export const { addPurchaseOrders, clearPurchaseOrders } = purchaseOrderSlice.actions;
export default purchaseOrderSlice.reducer;
