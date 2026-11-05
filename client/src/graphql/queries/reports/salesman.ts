import { gql } from "@apollo/client";

// Staff performance report (pages/reports/salesman) — only the invoice fields
// that page reads. Same root field/filter as GET_SALES_INVOICES. Dates are
// filtered client-side (the server's billdate range filter casts to Date
// against a String field and never matches).
export const SALESMAN_REPORT_SALES_INVOICES = gql`
  query SalesmanReportSalesInvoices($filter: SalesInvoiceFilterInput) {
    getSalesInvoices(filter: $filter) {
      id
      billdate
      totalamount
      salesmenid { id }
      cancelStatus
    }
  }
`;
