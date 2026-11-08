import { gql } from "@apollo/client";

// Staff performance report fields; dates filtered client-side (server billdate filter never matches).
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
