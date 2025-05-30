import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface PurchaseProduct {
  id: string;
  gst: number;
  qty: number;
  rate: number;
  amount: number;
}

export interface PurchaseInvoice {
  id: string;
  branchid: string;
  paymenttype: string;
  partyacc: string;
  taxorsupplytype: string;
  billdate: string;
  billtype: string;
  billnumber: string;
  notes: string;
  invoicetype: string;
  products: PurchaseProduct[];
  subtotal: number;
  totaldiscount: number;
  totalgst: number;
  totalamount: number;
}

interface PurchaseInvoiceState {
  invoices: PurchaseInvoice[];
}

const initialState: PurchaseInvoiceState = {
  invoices: [],
};

const purchaseInvoiceSlice = createSlice({
  name: 'purchaseinvoice',
  initialState,
  reducers: {
    addPurchaseInvoices: (state, action: PayloadAction<PurchaseInvoice[]>) => {
      state.invoices.push(...action.payload);
    },
    clearPurchaseInvoices: (state) => {
      state.invoices = [];
    },
  },
});

export const { addPurchaseInvoices, clearPurchaseInvoices } = purchaseInvoiceSlice.actions;

export default purchaseInvoiceSlice.reducer;
