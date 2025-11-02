import { gql } from 'apollo-server-express';

export const salesmenAccountTypeDefs = gql`
  type Admin {
    id: ID!
    name: String!
    email: String!
    subscriptionType: String
    subscribed: Boolean
    subscribedAt: String
    subscriptionEnd: String
    transactionId: String
    needsReview: Boolean!
    rejected: Boolean!
  }

  type Branch {
    id: ID!
    branchname: String!
  }

  type AccountLedger {
    id: ID!
    ledgername: String!
  }

  type SalesmenAccount {
    id: ID!
    admin: Admin
    branchid: Branch
    ledgerid: AccountLedger
    salesmancode: String
    name: String!
    mobile: String!
    email: String!
    password: String!
    profilepicture: String
    imageurl: String
    address: String
    commission: Float
    salary: Float
    target: Float
    type: String
    status: Boolean!
    createdAt: String
    updatedAt: String
  }

  input SalesmenAccountInput {
    admin: ID
    branchid: ID!
    ledgerid: ID
    name: String!
    mobile: String!
    email: String!
    password: String!
    profilepicture: String
    imageurl: String
    address: String
    commission: Float
    salary: Float
    target: Float
    type: String
    status: Boolean
  }

  input SalesmanFilterInput {
    adminId: ID
    branchid: ID
    type: String
    ledgerid: ID
    mobile: String
    email: String
    salary: Float
    commission: Float
    createdFrom: String
    createdTo: String
  }

  type Query {
    getSalesmenAccounts(filter: SalesmanFilterInput): [SalesmenAccount!]!
    getDeletedSalesmenAccounts(filter: SalesmanFilterInput): [SalesmenAccount!]!
    getSalesmanAccountById(id: ID!, adminId: ID): SalesmenAccount
  }

  type Mutation {
    addSalesmanAccount(input: SalesmenAccountInput!): SalesmenAccount!
    editSalesmanAccount(id: ID!, input: SalesmenAccountInput!): SalesmenAccount!
    deleteSalesmanAccount(id: ID!): Boolean!
    resetSalesmanAccount(id: ID!): Boolean!
  }
`;
