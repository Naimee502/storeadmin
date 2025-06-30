import { gql } from 'apollo-server-express';

export const productGroupTypeDefs = gql`
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

  type ProductGroup {
    id: ID!
    productgroupcode: String!
    productgroupname: String!
    status: Boolean!
    admin: Admin
  }

  input ProductGroupInput {
    productgroupname: String!
    status: Boolean!
    admin: ID
  }

  type Query {
    getProductGroups(adminId: ID): [ProductGroup!]!
    getDeletedProductGroups(adminId: ID): [ProductGroup!]!
    getProductGroupById(id: ID!, adminId: ID): ProductGroup
  }

  type Mutation {
    addProductGroup(input: ProductGroupInput!): ProductGroup!
    editProductGroup(id: ID!, input: ProductGroupInput!): ProductGroup!
    deleteProductGroup(id: ID!): Boolean!
    resetProductGroup(id: ID!): Boolean!
  }
`;
