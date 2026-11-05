import { gql } from "@apollo/client";

// Analytical reports (pages/reports/analytics) — only the invoice line fields
// that page reads. Same root field/filter as GET_SALES_INVOICES. Dates are
// filtered client-side (the server's billdate range filter casts to Date
// against a String field and never matches).
export const ANALYTICS_REPORT_SALES_INVOICES = gql`
  query AnalyticsReportSalesInvoices($filter: SalesInvoiceFilterInput) {
    getSalesInvoices(filter: $filter) {
      id
      billdate
      productservice {
        productserviceid { id name }
        variantid { id }
        salesunitid { id }
        unitqty
        qty
        amount
      }
      cancelStatus
    }
  }
`;

// Profit Margin tab only: the variant purchase rate + unit data needed to cost
// an invoice line. Invoices keep no cost snapshot, so cost is derived from the
// variant's current purchaserate (per purchase unit) converted to base units.
export const ANALYTICS_REPORT_PRODUCT_COSTS = gql`
  query AnalyticsReportProductCosts($filter: ProductServiceFilterInput, $limit: Int, $offset: Int) {
    getProductServices(filter: $filter, limit: $limit, offset: $offset) {
      id
      productvariants {
        id
        baseunitid { id }
        purchaseunitid { id }
        purchaserate
        unitconversions {
          unitid { id }
          factor
        }
      }
    }
  }
`;
