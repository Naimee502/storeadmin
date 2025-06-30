import { gql } from 'apollo-server-express';

export const categoryTypeDefs = gql`
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

  type Category {
    id: ID!
    categorycode: String!
    categoryname: String!
    status: Boolean!
    admin: Admin
  }

  input CategoryInput {
    categoryname: String!
    status: Boolean!
    admin: ID
  }

  type Query {
    getCategories(adminId: ID): [Category!]!
    getCategoryById(id: ID!, adminId: ID): Category
    getDeletedCategories(adminId: ID): [Category!]!
  }

  type Mutation {
    addCategory(input: CategoryInput!): Category!
    editCategory(id: ID!, input: CategoryInput!): Category!
    deleteCategory(id: ID!): Boolean!
    resetCategory(id: ID!): Boolean!
  }
`;
