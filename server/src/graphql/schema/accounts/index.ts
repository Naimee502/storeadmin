import { gql } from 'apollo-server-express';

export const accountTypeDefs = gql`
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
  }

  type Query {
    getAccounts: [Account!]!
    getAccountById(id: ID!): Account
  }

  type Mutation {
    addAccount(input: AccountInput!): Account!
    editAccount(id: ID!, input: AccountInput!): Account!
    deleteAccount(id: ID!): Boolean!
  }
`;
