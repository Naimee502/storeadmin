import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface InvoiceProduct {
  id: string;
  gst: number;
  qty: number;
  rate: number;
  amount: number;
}

export interface SalesInvoice {
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
  products: InvoiceProduct[];
  subtotal: number;
  totaldiscount: number;
  totalgst: number;
  totalamount: number;
}

interface SalesInvoiceState {
  invoices: SalesInvoice[];
}

const initialState: SalesInvoiceState = {
  invoices: [],
};

const salesInvoiceSlice = createSlice({
  name: 'salesinvoice',
  initialState,
  reducers: {
    addSalesInvoices: (state, action: PayloadAction<SalesInvoice[]>) => {
      state.invoices.push(...action.payload);
    },
    clearInvoices: (state) => {
      state.invoices = [];
    },
  },
});

export const { addSalesInvoices, clearInvoices } = salesInvoiceSlice.actions;

export default salesInvoiceSlice.reducer;
