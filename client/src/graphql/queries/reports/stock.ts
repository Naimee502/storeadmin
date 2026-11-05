import { gql } from "@apollo/client";

// Stock report (pages/reports/stock) — lite product selection: only the
// product/variant stock fields that page reads. Same root field and variables
// as GET_PRODUCT_SERVICES (useProductServicesQuery), so stock is scoped to the
// same branch.
export const STOCK_REPORT_PRODUCTS = gql`
  query StockReportProducts($filter: ProductServiceFilterInput, $limit: Int, $offset: Int) {
    getProductServices(filter: $filter, limit: $limit, offset: $offset) {
      id
      name
      isservice
      productvariants {
        id
        name
        currentstock
        currentstockamount
        minimumstock
        reorderlevel
        racklocation
      }
    }
  }
`;
