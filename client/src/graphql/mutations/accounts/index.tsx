// src/mutations/accounts.ts
import { gql } from '@apollo/client';

export const ADD_ACCOUNT = gql`
  mutation AddAccount($input: AccountInput!) {
    addAccount(input: $input) {
      id
      accountcode
      name
      type
      accountgroupid {
        id
        accountgroupname
      } 
      mobile
      email
      gstnumber
      pan
      address
      city
      state
      country
      pincode
      openingbalance
      openingbalancetype
      creditlimit
      bankname
      bankaccountnumber
      ifsc
      upiid
      billingcycle
      duedays
      isposcustomer
      assignaccountid {
        id
        name
      }
      salesmanid {
        id
        name
      }
      latitude
      longitude
      status
      branchid {
        id
        branchname
      }
      admin {
        id
        name
        email
      }
      otp
      channel {
        id
        channelName
      }
      region
      createdAt
      updatedAt
    }
  }
`;

export const EDIT_ACCOUNT = gql`
  mutation EditAccount($id: ID!, $input: AccountInput!) {
    editAccount(id: $id, input: $input) {
      id
      accountcode
      name
      type
      accountgroupid {
        id
        accountgroupname
      } 
      mobile
      email
      gstnumber
      pan
      address
      city
      state
      country
      pincode
      openingbalance
      openingbalancetype
      creditlimit
      bankname
      bankaccountnumber
      ifsc
      upiid
      billingcycle
      duedays
      isposcustomer
      assignaccountid {
        id
        name
      }
      salesmanid {
        id
        name
      }
      latitude
      longitude
      status
      branchid {
        id
        branchname
      }
      admin {
        id
        name
        email
      }
      otp
      channel {
        id
        channelName
      }
      region
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_ACCOUNT = gql`
  mutation DeleteAccount($id: ID!) {
    deleteAccount(id: $id)
  }
`;

export const RESET_ACCOUNT = gql`
  mutation ResetAccount($id: ID!) {
    resetAccount(id: $id)
  }
`;
