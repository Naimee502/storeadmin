// src/queries/salesmenaccount.ts
import { gql } from '@apollo/client';

export const GET_SALESMEN = gql`
  query GetSalesmen {
    getSalesmenAccounts {
      id
      salesmancode
      name
      mobile
      email
      password
      profilepicture
      address
      commission
      status
    }
  }
`;

export const GET_SALESMAN_BY_ID = gql`
  query GetSalesmanById($id: ID!) {
    getSalesmanAccountById(id: $id) {
      id
      salesmancode
      name
      mobile
      email
      password
      profilepicture
      address
      commission
      status
    }
  }
`;
