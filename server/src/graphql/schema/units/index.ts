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

  type Query {
    getUnits(adminId: ID): [Unit!]!
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
