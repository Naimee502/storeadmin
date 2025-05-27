// server/src/graphql/typeDefs/salesmenAccountTypeDefs.ts
import { gql } from 'apollo-server-express';

export const salesmenAccountTypeDefs = gql`
  type SalesmenAccount {
    id: ID!
    salesmancode: String
    name: String!
    mobile: String!
    email: String!
    password: String!
    profilepicture: String!
    address: String!
    commission: String!
    status: Boolean!
  }

  input SalesmenAccountInput {
    name: String!
    mobile: String!
    email: String!
    password: String!
    profilepicture: String!
    address: String!
    commission: String!
    status: Boolean!
  }

  type Query {
    getSalesmenAccounts: [SalesmenAccount!]!
    getSalesmanAccountById(id: ID!): SalesmenAccount
  }

  type Mutation {
    addSalesmanAccount(input: SalesmenAccountInput!): SalesmenAccount!
    editSalesmanAccount(id: ID!, input: SalesmenAccountInput!): SalesmenAccount!
    deleteSalesmanAccount(id: ID!): Boolean!
  }
`;
