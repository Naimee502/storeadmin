import { gql } from "@apollo/client";

// Party report (pages/reports/party) — lite invoice selections: only what the
// outstanding / aging / statement maths reads (useOutstanding keys on id and
// totalamount). Same root fields/filters as the full queries. Outstanding is
// all-time, so no date filter is sent.
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
