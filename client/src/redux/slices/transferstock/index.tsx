import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface TransferStockItem {
  frombranchid: string;
  tobranchid: string;
  productid: string;
  transferqty: number;
  transferdate: string;
  status: boolean;
}

interface TransferStockState {
  transferStocks: TransferStockItem[];
}

const initialState: TransferStockState = {
  transferStocks: [],
};

const transferStockSlice = createSlice({
  name: "transferStock",
  initialState,
  reducers: {
    addTransferStocks: (state, action: PayloadAction<TransferStockItem[]>) => {
      state.transferStocks = action.payload;
    },
    clearTransferStocks: (state) => {
      state.transferStocks = [];
    }
  },
});

export const {
  addTransferStocks,
  clearTransferStocks,
} = transferStockSlice.actions;

export default transferStockSlice.reducer;
