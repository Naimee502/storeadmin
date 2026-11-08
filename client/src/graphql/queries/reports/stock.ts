import { gql } from "@apollo/client";

// Stock report fields; same variables as GET_PRODUCT_SERVICES so stock is branch-scoped.
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
