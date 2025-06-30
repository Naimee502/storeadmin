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

  type SalesmenAccount {
    id: ID!
    admin: Admin             
    branchid: ID!
    salesmancode: String
    name: String!
    mobile: String!
    email: String!
    password: String!
    profilepicture: String!
    imageurl: String!
    address: String!
    commission: String!
    target: String!
    status: Boolean!
  }

  input SalesmenAccountInput {
    admin: ID                
    branchid: ID!
    name: String!
    mobile: String!
    email: String!
    password: String!
    profilepicture: String!
    imageurl: String!
    address: String!
    commission: String!
    target: String!
    status: Boolean!
  }

  type Query {
    getSalesmenAccounts(adminId: ID, branchid: ID): [SalesmenAccount!]!
    getDeletedSalesmenAccounts(adminId: ID, branchid: ID): [SalesmenAccount!]!
    getSalesmanAccountById(id: ID!): SalesmenAccount
  }

  type Mutation {
    addSalesmanAccount(input: SalesmenAccountInput!): SalesmenAccount!
    editSalesmanAccount(id: ID!, input: SalesmenAccountInput!): SalesmenAccount!
    deleteSalesmanAccount(id: ID!): Boolean!
    resetSalesmanAccount(id: ID!): Boolean!
  }
`;
