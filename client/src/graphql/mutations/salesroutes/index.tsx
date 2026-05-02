import { gql } from "@apollo/client";

export const CREATE_SALES_ROUTE = gql`
  mutation CreateSalesRoute($input: SalesRouteInput!) {
    createSalesRoute(input: $input) {
      id
      routecode
      routename
      visitdays
      status
      dayWiseAccounts {
        day
        visitorder
        accounts {
          id
          name
        }
      }
    }
  }
`;

export const UPDATE_SALES_ROUTE = gql`
  mutation UpdateSalesRoute($id: ID!, $input: SalesRouteInput!) {
    updateSalesRoute(id: $id, input: $input) {
      id
      routecode
      routename
      visitdays
      status
      dayWiseAccounts {
        day
        visitorder
        accounts {
          id
          name
        }
      }
    }
  }
`;

export const DELETE_SALES_ROUTE = gql`
  mutation DeleteSalesRoute($id: ID!) {
    deleteSalesRoute(id: $id)
  }
`;

export const RESET_SALES_ROUTE = gql`
  mutation ResetSalesRoute($id: ID!) {
    resetSalesRoute(id: $id)
  }
`;

export const UPDATE_SALES_ROUTE_STATUS = gql`
  mutation UpdateSalesRouteStatus($id: ID!, $status: Boolean!) {
    updateSalesRouteStatus(id: $id, status: $status) {
      id
      status
    }
  }
`;
