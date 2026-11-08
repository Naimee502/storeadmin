// src/graphql/transactions.ts
import { gql } from "@apollo/client";

// Queries
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

// Listing-page columns only; refetched with GetTransactions via PAYMENT_SIDE_EFFECT_QUERIES.
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

// Journals touching one ledger; sum only entries whose ledgerid matches.
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

// One page of the Transactions list (same columns as GET_TRANSACTIONS_LIST).
export const GET_TRANSACTIONS_PAGE = gql`
  query GetTransactionsPage(
    $filter: TransactionFilterInput
    $page: Int
    $pageSize: Int
    $search: String
    $columnFilters: [ColumnFilter!]
  ) {
    getTransactionsPage(filter: $filter, page: $page, pageSize: $pageSize, search: $search, columnFilters: $columnFilters) {
      total
      items {
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
  }
`;
