import { gql } from "apollo-server-express";

export const expenseNoteTypeDefs = gql`
  # =====================
  # COMMON LEDGER REF
  # =====================
  type LedgerRef {
    id: ID!
    ledgername: String!
  }

  # =====================
  # EXPENSE LINE
  # =====================
  type ExpenseLine {
    expenseledgerid: LedgerRef!
    amount: Float!
    gstpercent: Float
    remarks: String
  }

  input ExpenseLineInput {
    expenseledgerid: ID!
    amount: Float!
    gstpercent: Float
    remarks: String
  }

  # =====================
  # EXPENSE NOTE MAIN
  # =====================
  type ExpenseNote {
    id: ID!
    adminid: ID!
    branchid: ID!
    expensenumber: String
    expensedate: String
    paymenttype: String!
    ledgerid: LedgerRef
    narration: String
    notes: String
    expenses: [ExpenseLine!]!
    totalamount: Float!
    totalgst: Float
    status: Boolean!
    createdAt: String
    updatedAt: String
  }

  # =====================
  # INPUTS
  # =====================
  input ExpenseNoteInput {
    adminid: ID!
    branchid: ID!
    expensedate: String
    paymenttype: String!
    ledgerid: ID
    narration: String
    notes: String
    expenses: [ExpenseLineInput!]!
    totalamount: Float!
    totalgst: Float
    status: Boolean
  }

  input ExpenseNoteFilterInput {
    adminid: ID
    branchid: ID
    paymenttype: String
    expensenumber: String
    dateFrom: String
    dateTo: String
    status: Boolean
  }

  # =====================
  # QUERIES
  # =====================
  type Query {
    getExpenseNotes(filter: ExpenseNoteFilterInput): [ExpenseNote!]!
    getDeletedExpenseNotes(filter: ExpenseNoteFilterInput): [ExpenseNote!]!
    getExpenseNoteById(id: ID!, adminid: ID): ExpenseNote
  }

  # =====================
  # MUTATIONS
  # =====================
  type Mutation {
    addExpenseNote(input: ExpenseNoteInput!): ExpenseNote!
    editExpenseNote(id: ID!, input: ExpenseNoteInput!): ExpenseNote!
    deleteExpenseNote(id: ID!): Boolean!
    resetExpenseNote(id: ID!): Boolean!
  }
`;
