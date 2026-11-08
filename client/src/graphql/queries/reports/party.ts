import { gql } from "@apollo/client";

// Party report invoice fields for outstanding/aging; all-time, no date filter.
const INVOICE_FIELDS = `
  id
  billnumber
  billdate
  duedate
  totalamount
  notes
  partyacc { id }
  cancelStatus
`;

export const PARTY_REPORT_SALES_INVOICES = gql`
  query PartyReportSalesInvoices($filter: SalesInvoiceFilterInput) {
    getSalesInvoices(filter: $filter) {
      ${INVOICE_FIELDS}
    }
  }
`;

export const PARTY_REPORT_PURCHASE_INVOICES = gql`
  query PartyReportPurchaseInvoices($filter: PurchaseInvoiceFilterInput) {
    getPurchaseInvoices(filter: $filter) {
      ${INVOICE_FIELDS}
    }
  }
`;
