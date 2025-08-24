// src/graphql/transactions.ts
import { gql } from "@apollo/client";

// 🔹 Queries
export const GET_TRANSACTIONS = gql`
  query GetTransactions($filter: TransactionFilterInput) {
    getTransactions(filter: $filter) {
      id
      adminid
      branchid
      transactioncode
      entrytype
      source {
        docmodel
        docid
      }
      transactiondate
      narration
      entries {
        accountid
        debit
        credit
        productserviceid
        variantid
        remarks
      }
      totaldebit
      totalcredit
      createdby
      updatedby
      status
      createdAt
      updatedAt
    }
  }
`;

export const GET_DELETED_TRANSACTIONS = gql`
  query GetDeletedTransactions($filter: TransactionFilterInput) {
    getDeletedTransactions(filter: $filter) {
      id
      adminid
      branchid
      transactioncode
      entrytype
      source {
        docmodel
        docid
      }
      transactiondate
      narration
      entries {
        accountid
        debit
        credit
        productserviceid
        variantid
        remarks
      }
      totaldebit
      totalcredit
      createdby
      updatedby
      status
      createdAt
      updatedAt
    }
  }
`;

export const GET_TRANSACTION_BY_ID = gql`
  query GetTransactionById($id: ID!, $adminid: ID) {
    getTransactionById(id: $id, adminid: $adminid) {
      id
      adminid
      branchid
      transactioncode
      entrytype
      source {
        docmodel
        docid
      }
      transactiondate
      narration
      entries {
        accountid
        debit
        credit
        productserviceid
        variantid
        remarks
      }
      totaldebit
      totalcredit
      createdby
      updatedby
      status
      createdAt
      updatedAt
    }
  }
`;