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
      counterledgerid {
        id
        ledgername
      }
      invoices {
        invoiceid
        invoicemodel
        settledamount
        discount
        commission
        allocatedmode
        allocatedat
      }
      amount
      # Payment-level concession totals. The Ledger Statement report rebuilds
      # the journal legs (Cash / Discount Allowed / Party / Commission) from the
      # payment itself, and an OPENING-balance-only receipt carries its
      # discount / commission here and nowhere else.
      discount
      commission
      openingsettled
      unallocatedamount
      allocationmode
      reference
      remarks
      transactionid
      createdby_id
      createdby_name
      createdby_type
      orderedby_id
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
      counterledgerid {
        id
        ledgername
      }
      invoices {
        invoiceid
        invoicemodel
        settledamount
        discount
        commission
        allocatedmode
        allocatedat
      }
      amount
      # Payment-level concession totals. The Ledger Statement report rebuilds
      # the journal legs (Cash / Discount Allowed / Party / Commission) from the
      # payment itself, and an OPENING-balance-only receipt carries its
      # discount / commission here and nowhere else.
      discount
      commission
      openingsettled
      unallocatedamount
      allocationmode
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
      counterledgerid {
        id
        ledgername
      }
      invoices {
        invoiceid
        invoicemodel
        settledamount
        discount
        commission
        allocatedmode
        allocatedat
      }
      amount
      # Payment-level concession totals. A concession given on the party's
      # OPENING balance has no invoice line to sit on (see concessionSplit in
      # payments/addedit), so these are the only copy of it — without them the
      # edit screen re-opened such a payment with empty Discount / Commission
      # boxes and a journal preview missing both legs.
      discount
      commission
      openingsettled
      unallocatedamount
      allocationmode
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

// Open bills for a party, computed on the SERVER. Used by the Direct/On-Account
// flow so the figures can't come from a stale Apollo cache.
export const GET_PARTY_OUTSTANDING_BILLS = gql`
  query GetPartyOutstandingBills(
    $partyid: ID!
    $invoicemodel: String!
    $adminid: ID!
    $branchid: ID
    $excludePaymentId: ID
  ) {
    getPartyOutstandingBills(
      partyid: $partyid
      invoicemodel: $invoicemodel
      adminid: $adminid
      branchid: $branchid
      excludePaymentId: $excludePaymentId
    ) {
      id
      billnumber
      billdate
      totalamount
      outstanding
      invoicemodel
      sourceref
    }
  }
`;

// Dry run for the confirmation dialog: "this ₹X will clear these bills".
// Nothing is written until the user approves the result.
export const PREVIEW_ALLOCATION = gql`
  query PreviewAllocation(
    $partyid: ID!
    $invoicemodel: String!
    $adminid: ID!
    $branchid: ID
    $amount: Float!
    $excludePaymentId: ID
  ) {
    previewAllocation(
      partyid: $partyid
      invoicemodel: $invoicemodel
      adminid: $adminid
      branchid: $branchid
      amount: $amount
      excludePaymentId: $excludePaymentId
    ) {
      totaloutstanding
      allocated
      unallocated
      openingdue
      openingsettled
      lines {
        invoiceid
        invoicemodel
        billnumber
        billdate
        outstanding
        settledamount
        fullysettled
        sourceref
      }
    }
  }
`;
