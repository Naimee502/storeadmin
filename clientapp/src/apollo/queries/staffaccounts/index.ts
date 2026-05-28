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

export const GET_STAFF_ACCOUNT = gql`
  query getStaffAccountById($id: ID!, $adminId: ID) {
    getStaffAccountById(id: $id, adminId: $adminId) {
      id name mobile email staffcode role address salary commission
      branchid        { id branchname }
      ledgerid        { id ledgername }
      assignedChannels { id channelName }
    }
  }
`;
