import { gql } from 'apollo-server-express';

export const unitTypeDefs = gql`
  type Unit {
    id: ID!
    unitcode: String!
    unitname: String!
    status: Boolean!
  }

  input UnitInput {
    unitname: String!
    status: Boolean!
  }

  type Query {
    getUnits: [Unit!]!
    getDeletedUnits: [Unit!]!
    getUnitById(id: ID!): Unit
  }

  type Mutation {
    addUnit(input: UnitInput!): Unit!
    editUnit(id: ID!, input: UnitInput!): Unit!
    deleteUnit(id: ID!): Boolean!
    resetUnit(id: ID!): Boolean!
  }
`;
