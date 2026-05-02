import { gql } from "apollo-server-express";

export const salesRouteSchema = gql`
  type DayWiseAccounts {
    day: String!
    visitorder: Int
    accounts: [Account]
  }

  type SalesRoute {
    id: ID!
    adminid: ID!
    branchid: ID!
    routecode: String
    routename: String!
    description: String
    visitdays: [String]
    salesmanid: StaffAccount!
    accounts: [Account]
    dayWiseAccounts: [DayWiseAccounts]
    status: Boolean
    createdAt: String
    updatedAt: String
  }

  input DayWiseAccountsInput {
    day: String!
    visitorder: Int
    accounts: [ID]
  }

  input SalesRouteInput {
    adminid: ID
    branchid: ID
    routename: String!
    description: String
    visitdays: [String]
    salesmanid: ID!
    accounts: [ID]
    dayWiseAccounts: [DayWiseAccountsInput]
    status: Boolean
  }

  input SalesRouteFilterInput {
    adminId: ID
    branchId: ID
    salesmanId: ID
    search: String
    status: Boolean
    visitday: String
  }

  extend type Query {
    getSalesRoutes(filter: SalesRouteFilterInput, limit: Int, offset: Int): [SalesRoute]
    getSalesRouteById(id: ID!, adminId: ID, branchId: ID): SalesRoute
  }

  extend type Mutation {
    createSalesRoute(input: SalesRouteInput!): SalesRoute
    updateSalesRoute(id: ID!, input: SalesRouteInput!): SalesRoute
    deleteSalesRoute(id: ID!): Boolean
    updateSalesRouteStatus(id: ID!, status: Boolean!): SalesRoute
    resetSalesRoute(id: ID!): Boolean
  }
`;
