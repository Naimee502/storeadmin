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

    "ISO date"

    updatedAt: String
    id: ID!
    unitcode: String!
    unitname: String!
    status: Boolean!
    admin: Admin
  }

  input UnitInput {

    "Set by offline sync so a retried save returns the same document."

    clientRequestId: String
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
    editUnit(id: ID!, input: UnitInput!, expectedUpdatedAt: String): Unit!
    deleteUnit(id: ID!, expectedUpdatedAt: String): Boolean!
    resetUnit(id: ID!): Boolean!
  }
`;
