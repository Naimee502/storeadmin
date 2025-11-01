import { gql } from "apollo-server-express";

export const accountLedgerTypeDefs = gql`
  enum LedgerType {
    customer
    vendor
    bank
    cash
    gst
    expense
    income
    other
  }

  enum OpeningBalanceType {
    debit
    credit
  }

  type Admin {
    id: ID!
    name: String
  }

  type Branch {
    id: ID!
    branchname: String
  }

  type AccountGroup {
    id: ID!
    accountgroupname: String!
  }

  type AccountLedger {
    id: ID!
    ledgercode: String!
    ledgername: String!
    accountgroupid: AccountGroup!
    admin: Admin!
    branchid: Branch
    ledgertype: LedgerType!
    openingbalance: Float
    openingbalancetype: OpeningBalanceType!
    status: Boolean!
    createdAt: String
    updatedAt: String
  }

  input AccountLedgerInput {
    ledgername: String!
    accountgroupid: ID!
    admin: ID!
    branchid: ID
    ledgertype: LedgerType
    openingbalance: Float
    openingbalancetype: OpeningBalanceType
    status: Boolean
  }

  type Query {
    getAccountLedgers(adminId: ID, branchId: ID): [AccountLedger!]!
    getDeletedAccountLedgers(adminId: ID, branchId: ID): [AccountLedger!]!
    getAccountLedgerById(id: ID!, adminId: ID, branchId: ID): AccountLedger
  }

  type Mutation {
    addAccountLedger(input: AccountLedgerInput!): AccountLedger!
    editAccountLedger(id: ID!, input: AccountLedgerInput!): AccountLedger!
    deleteAccountLedger(id: ID!): Boolean!
    resetAccountLedger(id: ID!): Boolean!
  }
`;
