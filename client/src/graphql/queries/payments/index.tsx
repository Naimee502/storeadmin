import { gql } from "@apollo/client";

// 🔹 Queries
export const GET_PAYMENTS = gql`
  query GetPayments($filter: PaymentFilterInput) {
    getPayments(filter: $filter) {
      id
      adminid
      branchid
      paymentcode
      paymentdate
      type
      mode
      partyid {
        id
        name
      }
      ledgerid {
        id
        ledgername
      }
      invoices {
        invoiceid
        invoicemodel
        settledamount
        discount
        commission
      }
      amount
      reference
      remarks
      transactionid
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

export const GET_DELETED_PAYMENTS = gql`
  query GetDeletedPayments($filter: PaymentFilterInput) {
    getDeletedPayments(filter: $filter) {
      id
      adminid
      branchid
      paymentcode
      paymentdate
      type
      mode
      partyid {
        id
        name
      }
      ledgerid {
        id
        ledgername
      }
      invoices {
        invoiceid
        invoicemodel
        settledamount
        discount
        commission
      }
      amount
      reference
      remarks
      transactionid
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

export const GET_PAYMENT_BY_ID = gql`
  query GetPaymentById($id: ID!, $adminid: ID) {
    getPaymentById(id: $id, adminid: $adminid) {
      id
      adminid
      branchid
      paymentcode
      paymentdate
      type
      mode
      partyid {
        id
        name
      }
      ledgerid {
        id
        ledgername
      }
      invoices {
        invoiceid
        invoicemodel
        settledamount
        discount
        commission
      }
      amount
      reference
      remarks
      transactionid
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
