import { gql } from '@apollo/client';

export const GET_SALES_ROUTES = gql`
  query getSalesRoutes($adminid: ID!, $salesmanid: ID) {
    getSalesRoutes(adminid: $adminid, salesmanid: $salesmanid) {
      id routename routecode status
      salesmanid { id name }
      dayWiseAccounts {
        day visitorder
        accounts { id name mobile }
      }
    }
  }
`;

export const GET_SALESMAN_ORDERS = gql`
  query getSalesOrders($adminid: ID!, $salesmenid: ID) {
    getSalesOrders(adminid: $adminid, salesmenid: $salesmenid) {
      id billnumber billdate totalamount status cancelStatus
      partyaccid { id name }
      productservice { id }
    }
  }
`;

export const UPDATE_SALES_ROUTE = gql`
  mutation UpdateSalesRoute($id: ID!, $input: SalesRouteInput!) {
    updateSalesRoute(id: $id, input: $input) {
      id routename
      dayWiseAccounts {
        day visitorder
        accounts { id name mobile }
      }
    }
  }
`;

export const GET_STAFF_ACCOUNT = gql`
  query getStaffAccountById($id: ID!, $adminid: ID!) {
    getStaffAccountById(id: $id, adminid: $adminid) {
      id name mobile email staffcode role
      branchid { id name }
      ledgerid { id ledgername }
    }
  }
`;
