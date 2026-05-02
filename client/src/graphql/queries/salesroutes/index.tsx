import { gql } from "@apollo/client";

export const GET_SALES_ROUTES = gql`
  query GetSalesRoutes($filter: SalesRouteFilterInput, $limit: Int, $offset: Int) {
    getSalesRoutes(filter: $filter, limit: $limit, offset: $offset) {
      id
      routecode
      routename
      description
      visitdays
      status
      salesmanid {
        id
        name
        mobile
        staffcode
      }
      accounts {
        id
        name
        accountcode
      }
      dayWiseAccounts {
        day
        visitorder
        accounts {
          id
          name
          accountcode
        }
      }
      createdAt
    }
  }
`;

export const GET_SALES_ROUTE_BY_ID = gql`
  query GetSalesRouteById($id: ID!, $adminId: ID, $branchId: ID) {
    getSalesRouteById(id: $id, adminId: $adminId, branchId: $branchId) {
      id
      routecode
      routename
      description
      visitdays
      status
      salesmanid {
        id
        name
        staffcode
      }
      accounts {
        id
        name
        accountcode
      }
      dayWiseAccounts {
        day
        visitorder
        accounts {
          id
          name
          accountcode
        }
      }
    }
  }
`;
