import { gql } from "apollo-server-express";

export const expenseClaimTypeDefs = gql`
  type ExpenseClaimStaffRef {
    id: ID!
    name: String
    staffcode: String
    role: String
    mobile: String
  }

  type ExpenseClaim {
    id: ID!
    adminid: ID!
    branchid: ID
    claimnumber: String
    staffid: ExpenseClaimStaffRef
    claimdate: String
    category: String
    amount: Float!
    distancekm: Float
    description: String
    receipts: [String!]!
    status: String!
    approvedamount: Float
    expenseledgerid: ID
    expenseledgername: String
    expensenoteid: ID
    expensenumber: String
    # How much of the approved amount has been reimbursed through Payments.
    paidamount: Float!
    approverremarks: String
    rejectionreason: String
    actionedby_name: String
    actionedby_type: String
    actionedAt: String
    createdby_name: String
    createdby_type: String
    isactive: Boolean!
    createdAt: String
    updatedAt: String
  }

  input ExpenseClaimInput {
    # Back-office users filing on a staff member's behalf pass staffid.
    # A staff login always files for itself and this is ignored.
    staffid: ID
    claimdate: String!
    category: String!
    amount: Float!
    distancekm: Float
    description: String
    receipts: [String!]
  }

  input ExpenseClaimFilterInput {
    branchid: ID
    staffid: ID
    status: String
    dateFrom: String
    dateTo: String
  }

  type Query {
    isExpenseClaimsEnabled: Boolean!
    getExpenseClaims(filter: ExpenseClaimFilterInput): [ExpenseClaim!]!
    getDeletedExpenseClaims(filter: ExpenseClaimFilterInput): [ExpenseClaim!]!
    getMyExpenseClaims: [ExpenseClaim!]!
    getExpenseClaimById(id: ID!): ExpenseClaim
  }

  type Mutation {
    addExpenseClaim(input: ExpenseClaimInput!): ExpenseClaim!
    editExpenseClaim(id: ID!, input: ExpenseClaimInput!): ExpenseClaim!
    cancelExpenseClaim(id: ID!): ExpenseClaim!
    approveExpenseClaim(id: ID!, approvedamount: Float, expenseledgerid: ID, remarks: String): ExpenseClaim!
    rejectExpenseClaim(id: ID!, reason: String!): ExpenseClaim!
    deleteExpenseClaim(id: ID!): Boolean!
    resetExpenseClaim(id: ID!): Boolean!
  }
`;
