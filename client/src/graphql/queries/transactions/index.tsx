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
        ledgerid {
          id
          ledgername
        }
        debit
        credit
        productserviceid
        variantid
        remarks
      }
      totaldebit
      totalcredit
      partyid
      invoices {
        invoiceid
        invoicemodel
        settledamount
      }
      createdby_id
      createdby_name
      createdby_type
      updatedby
      status
      createdAt
      updatedAt
    }
  }
`;

// Listing-page query: only the columns the Transactions table renders, no
// journal lines (entries[]) or settlement data. Named GetTransactionsList and
// listed in PAYMENT_SIDE_EFFECT_QUERIES so it refetches with GetTransactions.
export const GET_TRANSACTIONS_LIST = gql`
  query GetTransactionsList($filter: TransactionFilterInput) {
    getTransactions(filter: $filter) {
      id
      transactioncode
      entrytype
      transactiondate
      narration
      totaldebit
      totalcredit
      createdby_name
      createdby_type
      status
      createdAt
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
        ledgerid {
          id
          ledgername
        }
        debit
        credit
        productserviceid
        variantid
        remarks
      }
      totaldebit
      totalcredit
      partyid
      invoices {
        invoiceid
        invoicemodel
        settledamount
      }
      createdby_id
      createdby_name
      createdby_type
      updatedby
      status
      createdAt
      updatedAt
    }
  }
`;

export const PREVIEW_INVOICE_JOURNAL = gql`
  query PreviewInvoiceJournal($invoiceid: ID!, $invoicemodel: String!) {
    previewInvoiceJournal(invoiceid: $invoiceid, invoicemodel: $invoicemodel) {
      ledgerid
      ledgername
      debit
      credit
      remarks
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
        ledgerid {
          id
          ledgername
        }
        debit
        credit
        productserviceid
        variantid
        remarks
      }
      totaldebit
      totalcredit
      partyid
      invoices {
        invoiceid
        invoicemodel
        settledamount
      }
      createdby_id
      createdby_name
      createdby_type
      updatedby
      status
      createdAt
      updatedAt
    }
  }
`;

// Every journal that touches ONE ledger, trimmed to the fields needed to total
// its balance. `ledgerid` is filtered server-side, so this is a handful of rows
// rather than the whole book — but each row still carries its counter-leg, so
// the caller must sum only the entries whose ledgerid matches.
export const GET_LEDGER_MOVEMENTS = gql`
  query GetLedgerMovements($filter: TransactionFilterInput) {
    getTransactions(filter: $filter) {
      id
      source {
        docid
      }
      entries {
        ledgerid {
          id
        }
        debit
        credit
      }
    }
  }
`;
