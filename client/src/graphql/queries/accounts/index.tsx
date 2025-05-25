// src/queries/accounts.ts
import { gql } from '@apollo/client';

export const GET_ACCOUNTS = gql`
  query GetAccounts {
    getAccounts {
      id
      accountcode
      name
      accountgroupid
      mobile
      email
      address
      city
      pincode
      status
    }
  }
`;

export const GET_ACCOUNT_BY_ID = gql`
  query GetAccountById($id: ID!) {
    getAccountById(id: $id) {
      id
      accountcode
      name
      accountgroupid
      mobile
      email
      address
      city
      pincode
      status
    }
  }
`;
