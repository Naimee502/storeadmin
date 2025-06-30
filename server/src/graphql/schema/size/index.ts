import { gql } from 'apollo-server-express';

export const sizeTypeDefs = gql`
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

  type Size {
    id: ID!
    sizecode: String!
    sizename: String!
    status: Boolean!
    admin: Admin
  }

  input SizeInput {
    sizename: String!
    status: Boolean!
    admin: ID
  }

  type Query {
    getSizes(adminId: ID): [Size!]!
    getDeletedSizes(adminId: ID): [Size!]!
    getSizeById(id: ID!, adminId: ID): Size
  }

  type Mutation {
    addSize(input: SizeInput!): Size!
    editSize(id: ID!, input: SizeInput!): Size!
    deleteSize(id: ID!): Boolean!
    resetSize(id: ID!): Boolean!
  }
`;
