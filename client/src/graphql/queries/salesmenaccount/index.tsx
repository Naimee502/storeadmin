import { gql } from '@apollo/client';

export const GET_SALESMEN = gql`
  query GetSalesmen($branchid: ID, $adminId: ID) {
    getSalesmenAccounts(branchid: $branchid, adminId: $adminId) {
      id
      branchid
      salesmancode
      name
      mobile
      email
      password
      profilepicture
      imageurl
      address
      commission
      target
      status
      admin {
        id
        name
        email
      }
    }
  }
`;

export const GET_DELETED_SALESMEN = gql`
  query GetDeletedSalesmen($branchid: ID, $adminId: ID) {
    getDeletedSalesmenAccounts(branchid: $branchid, adminId: $adminId) {
      id
      branchid
      salesmancode
      name
      mobile
      email
      password
      profilepicture
      imageurl
      address
      commission
      target
      status
      admin {
        id
        name
        email
      }
    }
  }
`;

export const GET_SALESMAN_BY_ID = gql`
  query GetSalesmanById($id: ID!, $adminId: ID) {
    getSalesmanAccountById(id: $id, adminId: $adminId) {
      id
      branchid
      salesmancode
      name
      mobile
      email
      password
      profilepicture
      imageurl
      address
      commission
      target
      status
      admin {
        id
        name
        email
      }
    }
  }
`;
