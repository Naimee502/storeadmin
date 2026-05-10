import { gql } from "apollo-server-express";

export const expenseNoteTypeDefs = gql`
  # =====================
  # COMMON LEDGER REF
  # =====================
  type LedgerRef {
    id: ID!
    ledgername: String!
  }

  # Lightweight staff projection used by ExpenseNote.staffid. Keeps the form
  # form able to show name/code/role and pre-fill amount from the staff's
  # configured monthly salary without round-tripping to a separate query.
  type ExpenseStaffRef {
    id: ID!
    name: String!
    staffcode: String
    role: String
    ledgerid: ID
    salary: Float
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
    category: String
    staffid: ExpenseStaffRef
    salaryPeriod: String
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
    # "general" | "tada" | "salary" | "other". Defaults server-side to "general".
    category: String
    staffid: ID
    salaryPeriod: String
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
    category: String
    staffid: ID
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
    # Returns the canonical expense ledger for "tada" or "salary" — creates it
    # under the right Account Group if missing. Returns null for "general".
    getExpenseCategoryLedger(adminid: ID!, category: String!): LedgerRef
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
