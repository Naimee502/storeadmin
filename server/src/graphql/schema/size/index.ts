import { gql } from 'apollo-server-express';

export const sizeTypeDefs = gql`
  type Size {
    id: ID!
    sizecode: String!
    sizename: String!
    status: Boolean!
  }

  input SizeInput {
    sizename: String!
    status: Boolean!
  }

  type Query {
    getSizes: [Size!]!
    getSizeById(id: ID!): Size
  }

  type Mutation {
    addSize(input: SizeInput!): Size!
    editSize(id: ID!, input: SizeInput!): Size!
    deleteSize(id: ID!): Boolean!
  }
`;
