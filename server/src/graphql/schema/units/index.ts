import { gql } from 'apollo-server-express';

export const unitTypeDefs = gql`
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

  type Unit {
    id: ID!
    unitcode: String!
    unitname: String!
    status: Boolean!
    admin: Admin
  }

  input UnitInput {
    unitname: String!
    status: Boolean!
    admin: ID
  }

  type UnitPage {
    items: [Unit!]!
    total: Int!
  }

  type Query {
    getUnits(adminId: ID): [Unit!]!
    getUnitsPage(adminId: ID, page: Int, pageSize: Int, search: String, columnFilters: [ColumnFilter!]): UnitPage!
    getDeletedUnits(adminId: ID): [Unit!]!
    getUnitById(id: ID!, adminId: ID): Unit
  }

  type Mutation {
    addUnit(input: UnitInput!): Unit!
    editUnit(id: ID!, input: UnitInput!): Unit!
    deleteUnit(id: ID!): Boolean!
    resetUnit(id: ID!): Boolean!
  }
`;
