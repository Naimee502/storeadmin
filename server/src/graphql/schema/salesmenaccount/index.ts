import { gql } from 'apollo-server-express';

export const salesmenAccountTypeDefs = gql`
  type SalesmenAccount {
    id: ID!
    branchid: ID!         
    salesmancode: String
    name: String!
    mobile: String!
    email: String!
    password: String!
    profilepicture: String!
    productimageurl: String!
    address: String!
    commission: String!
    status: Boolean!
  }

  input SalesmenAccountInput {
    branchid: ID!         
    name: String!
    mobile: String!
    email: String!
    password: String!
    profilepicture: String!
    productimageurl: String!
    address: String!
    commission: String!
    status: Boolean!
  }

  type Query {
    getSalesmenAccounts(branchid: ID): [SalesmenAccount!]!
    getDeletedSalesmenAccounts(branchid: ID): [SalesmenAccount!]!
    getSalesmanAccountById(id: ID!): SalesmenAccount
  }

  type Mutation {
    addSalesmanAccount(input: SalesmenAccountInput!): SalesmenAccount!
    editSalesmanAccount(id: ID!, input: SalesmenAccountInput!): SalesmenAccount!
    deleteSalesmanAccount(id: ID!): Boolean!
    resetSalesmanAccount(id: ID!): Boolean!
  }
`;
