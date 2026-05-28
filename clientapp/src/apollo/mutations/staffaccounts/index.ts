import { gql } from '@apollo/client';

export const LOGIN_STAFF = gql`
  mutation LoginStaffByMobile($adminId: ID!, $mobile: String!, $password: String!) {
    loginStaffByMobile(adminId: $adminId, mobile: $mobile, password: $password) {
      accessToken
      staff {
        id
        name
        mobile
        email
        role
        admin { id }
      }
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
