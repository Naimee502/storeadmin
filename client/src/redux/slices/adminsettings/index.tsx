import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface AdminSettings {
  id: string;
  adminid: string;
  autoCreateLedgerOnSalesInvoice: boolean;
  autoCreateStockOnSalesInvoice: boolean;
  autoCreateLedgerOnPurchaseInvoice: boolean;
  autoCreateStockOnPurchaseInvoice: boolean;
  autoCreateLedgerOnExpense: boolean;
  autoCreateLedgerOnSalesReturn: boolean;
  autoCreateLedgerOnPurchaseReturn: boolean;
  allowNegativeStock: boolean;
  preventDuplicateInvoiceNumbers: boolean;
  defaultGstPercent: number;
  defaultPaymentType: string;
  defaultTaxOrSupplyType: string;
  defaultBillType: string;
  salesInvoicePrefix: string;
  purchaseInvoicePrefix: string;
  salesReturnPrefix: string;
  purchaseReturnPrefix: string;
  salesOrderPrefix: string;
  purchaseOrderPrefix: string;
  expenseNotePrefix: string;
  enableGst: boolean;
  allowAdminToManageBusinessSettings: boolean;
  allowAdminToManageModules: boolean;
  allowAdminToManagePermissions: boolean;
  printShowCompanyHeader?: boolean;
  printShowCompanyNameInSignature?: boolean;
  printShowTermsAndConditions?: boolean;
  printTermsAndConditions?: string;
  printShowPartyBalance?: boolean;
}

interface AdminSettingsState {
  settings: AdminSettings | null;
}

const initialState: AdminSettingsState = {
  settings: null,
};

const adminSettingsSlice = createSlice({
  name: "adminsettings",
  initialState,
  reducers: {
    setAdminSettings: (state, action: PayloadAction<AdminSettings>) => {
      state.settings = action.payload;
    },
    updateAdminSettingsLocally: (state, action: PayloadAction<Partial<AdminSettings>>) => {
      if (state.settings) {
        state.settings = { ...state.settings, ...action.payload };
      }
    },
    clearAdminSettings: (state) => {
      state.settings = null;
    },
  },
});

export const { setAdminSettings, updateAdminSettingsLocally, clearAdminSettings } = adminSettingsSlice.actions;
export default adminSettingsSlice.reducer;
