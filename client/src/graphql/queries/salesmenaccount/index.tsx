// src/queries/salesmenaccount.ts
import { gql } from '@apollo/client';

export const GET_SALESMEN = gql`
  query GetSalesmen($branchid: ID) {
    getSalesmenAccounts(branchid: $branchid) {
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
    }
  }
`;

export const GET_DELETED_SALESMEN = gql`
  query GetDeletedSalesmen($branchid: ID) {
    getDeletedSalesmenAccounts(branchid: $branchid) {
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
    }
  }
`;

export const GET_SALESMAN_BY_ID = gql`
  query GetSalesmanById($id: ID!) {
    getSalesmanAccountById(id: $id) {
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
    }
  }
`;
