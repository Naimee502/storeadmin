import { gql } from "apollo-server-express";

export const paymentTypeDefs = gql`
  # Payment Invoice Settlement Line
  type PaymentInvoice {
    invoiceid: ID!
    invoicemodel: String!
    settledamount: Float!
    discount: Float
    commission: Float
    allocatedmode: String
    allocatedat: String
  }

  input PaymentInvoiceInput {
    invoiceid: ID!
    invoicemodel: String!
    settledamount: Float!
    discount: Float
    commission: Float
    allocatedmode: String
  }

  # One open bill of a party, with what is still owed on it.
  type OutstandingBill {
    id: ID!
    billnumber: String
    billdate: String
    totalamount: Float!
    outstanding: Float!
    invoicemodel: String!
  }

  # A proposed FIFO spread of an amount over those bills — shown to the user
  # for confirmation BEFORE the payment is saved.
  type AllocationProposalLine {
    invoiceid: ID!
    invoicemodel: String!
    billnumber: String
    billdate: String
    outstanding: Float!
    settledamount: Float!
    fullysettled: Boolean!
  }

  type AllocationProposal {
    lines: [AllocationProposalLine!]!
    totaloutstanding: Float!
    allocated: Float!
    unallocated: Float!
    # Opening balance leg — what the party carried in, and how much of this
    # amount went to clearing it before any bill was touched.
    openingdue: Float!
    openingsettled: Float!
  }

  # Account Type
  type Account {
    id: ID!
    name: String!
  }

  # Ledger Type
  type AccountLedger {
    id: ID!
    ledgername: String!
  }

  # Payment Main
  type Payment {
    id: ID!
    adminid: ID!
    branchid: ID!
    paymentcode: String
    paymentdate: String
    type: String!
    mode: String!
    partyid: Account           # optional
    # The non-cash leg when there is no party — Capital, Loan, Rent, Salary,
    # Interest. Exactly one of partyid / counterledgerid is set.
    counterledgerid: AccountLedger
    ledgerid: AccountLedger!   # required
    invoices: [PaymentInvoice!]
    amount: Float!
    # Concession totals for the whole payment (Σ of the lines, plus the
    # Ledger-mode figures that have no line to sit on).
    discount: Float
    commission: Float
    openingsettled: Float
    unallocatedamount: Float
    allocationmode: String
    reference: String
    remarks: String
    transactionid: ID
    createdby_id: ID
    createdby_name: String
    createdby_type: String
    orderedby_id: ID
    orderedby_name: String
    orderedby_type: String
    updatedby: ID
    status: Boolean!
    createdAt: String
    updatedAt: String
  }

  # Payment Input
  input PaymentInput {
    adminid: ID!
    branchid: ID!
    paymentdate: String
    type: String!
    mode: String!
    partyid: ID                  # optional
    counterledgerid: ID          # the non-cash leg when there is no party
    ledgerid: ID!                # required
    invoices: [PaymentInvoiceInput!]
    amount: Float!
    discount: Float
    commission: Float
    openingsettled: Float
    unallocatedamount: Float
    allocationmode: String
    reference: String
    remarks: String
    transactionid: ID
    createdby_id: ID
    createdby_name: String
    createdby_type: String
    updatedby: ID
    status: Boolean
  }

  # Payment Filter Input
  input PaymentFilterInput {
    adminid: ID
    branchid: ID
    type: String
    partyid: ID
    counterledgerid: ID
    ledgerid: ID
    paymentcode: String
    dateFrom: String
    dateTo: String
    status: Boolean
    includeDownline: Boolean
  }

  # Queries
  type Query {
    getPayments(filter: PaymentFilterInput): [Payment!]!
    getDeletedPayments(filter: PaymentFilterInput): [Payment!]!
    getPaymentById(id: ID!, adminid: ID): Payment

    # Open bills for a party, oldest first. Computed on the SERVER so the
    # figures survive a stale client cache and cannot be raced.
    getPartyOutstandingBills(
      partyid: ID!
      invoicemodel: String!
      adminid: ID!
      branchid: ID
      excludePaymentId: ID
    ): [OutstandingBill!]!

    # Dry-run a direct payment: what would this amount settle?
    previewAllocation(
      partyid: ID!
      invoicemodel: String!
      adminid: ID!
      branchid: ID
      amount: Float!
      excludePaymentId: ID
      # Fill this bill before anything else — COD handed over for a delivery.
      priorityInvoiceId: ID
    ): AllocationProposal!
  }

  # Mutations
  type Mutation {
    addPayment(input: PaymentInput!): Payment!
    editPayment(id: ID!, input: PaymentInput!): Payment!
    deletePayment(id: ID!): Boolean!
    resetPayment(id: ID!): Boolean!

    # Re-spread an existing payment over different bills. Touches allocations
    # only — the journal is untouched because the party leg does not change.
    reallocatePayment(id: ID!, invoices: [PaymentInvoiceInput!]!): Payment!
  }
`;
