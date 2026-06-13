import { gql } from '@apollo/client';

export const GET_SALES_ROUTES = gql`
  query getSalesRoutes($filter: SalesRouteFilterInput) {
    getSalesRoutes(filter: $filter) {
      id routename routecode status
      salesmanid { id name }
      dayWiseAccounts {
        day visitorder
        accounts {
          id name mobile address city
          latitude longitude
          outstanding
        }
      }
    }
  }
`;

export const GET_SALESMAN_ORDERS = gql`
  query getSalesOrders($adminid: ID, $salesmenid: ID) {
    getSalesOrders(filter: { adminid: $adminid, salesmenid: $salesmenid, includeConverted: true }) {
      id billnumber billdate totalamount status cancelStatus isConverted
      partyacc { id accountname }
      productservice { productserviceid { id } }
    }
  }
`;

export const GET_STAFF_ACCOUNT = gql`
  query getStaffAccountById($id: ID!, $adminId: ID) {
    getStaffAccountById(id: $id, adminId: $adminId) {
      id name mobile email staffcode role address salary commission
      allowedmodules
      branchid        { id branchname }
      ledgerid        { id ledgername }
      assignedChannels { id channelName }
    }
  }
`;
