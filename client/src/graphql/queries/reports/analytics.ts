import { gql } from "@apollo/client";

// Analytics report fields; dates filtered client-side (server billdate filter never matches).
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

// Profit Margin: cost derived from the variant's current purchase rate.
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
