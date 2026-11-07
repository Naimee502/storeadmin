import { gql } from "apollo-server-express";

export const commonTypeDefs = gql`
  input ColumnFilter {
    key: String!
    value: String!
  }

  extend type Mutation {
    "Hide deleted entries for good (record stays in the database). Returns how many were hidden."
    clearDeletedEntries(module: String!, ids: [ID!]!): Int!
  }
`;
