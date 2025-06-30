import { gql } from 'apollo-server-express';

export const accountTypeDefs = gql`
  type Admin {
    id: ID!
    name: String!
    email: String!
    subscriptionType: String
    subscribed: Boolean
    subscribedAt: String
    subscriptionEnd: String
    transactionId: String
  }

  type Account {
    id: ID!
    accountcode: String!
    name: String!
    accountgroupid: String!
    mobile: String
    email: String
    address: String
    city: String
    pincode: String
    status: Boolean!
    branchid: ID
    admin: Admin
  }

  input AccountInput {
    name: String!
    accountgroupid: String!
    mobile: String
    email: String
    address: String
    city: String
    pincode: String
    status: Boolean!
    branchid: String
    admin: ID
  }

  type Query {
    getAccounts(adminId: ID, branchid: ID): [Account!]!
    getDeletedAccounts(adminId: ID, branchid: ID): [Account!]!
    getAccountById(id: ID!, adminId: ID): Account
  }

  type Mutation {
    addAccount(input: AccountInput!): Account!
    editAccount(id: ID!, input: AccountInput!): Account!
    deleteAccount(id: ID!): Boolean!
    resetAccount(id: ID!): Boolean!
  }
`;
