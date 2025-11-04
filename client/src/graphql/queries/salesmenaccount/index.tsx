import { gql } from '@apollo/client';

export const GET_SALESMEN = gql`
  query GetSalesmen($filter: SalesmanFilterInput) {
    getSalesmenAccounts(filter: $filter) {
      id
      salesmancode
      name
      mobile
      email
      password
      profilepicture
      imageurl
      address
      commission
      salary
      target
      type
      status
      accountgroupid {
        id
        accountgroupname
      } 
      ledgerid {
        id
        ledgername
      }
      branchid {
        id
        branchname
      }
      admin {
        id
        name
        email
      }
      createdAt
      updatedAt
    }
  }
`;


export const GET_DELETED_SALESMEN = gql`
  query GetDeletedSalesmen($filter: SalesmanFilterInput) {
    getDeletedSalesmenAccounts(filter: $filter) {
      id
      salesmancode
      name
      mobile
      email
      password
      profilepicture
      imageurl
      address
      commission
      salary
      target
      type
      status
      accountgroupid {
        id
        accountgroupname
      } 
      ledgerid {
        id
        ledgername
      }
      branchid {
        id
        branchname
      }
      admin {
        id
        name
        email
      }
      createdAt
      updatedAt
    }
  }
`;


export const GET_SALESMAN_BY_ID = gql`
  query GetSalesmanById($id: ID!, $adminId: ID) {
    getSalesmanAccountById(id: $id, adminId: $adminId) {
      id
      salesmancode
      name
      mobile
      email
      password
      profilepicture
      imageurl
      address
      commission
      salary
      target
      type
      status
      accountgroupid {
        id
        accountgroupname
      } 
      ledgerid {
        id
        ledgername
      }
      branchid {
        id
        branchname
      }
      admin {
        id
        name
        email
      }
      createdAt
      updatedAt
    }
  }
`;
