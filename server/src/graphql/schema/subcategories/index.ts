import { gql } from 'apollo-server-express';

export const subCategoryTypeDefs = gql`

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

  type SubCategory {
    id: ID!
    subcategorycode: String!
    subcategoryname: String!
    status: Boolean!
    category: Category!
    admin: Admin
  }

  input SubCategoryInput {
    subcategoryname: String!
    status: Boolean!
    category: ID!
    admin: ID
  }

  type Query {
    getSubCategories(adminId: ID, categoryId: ID): [SubCategory!]!
    getSubCategoryById(id: ID!, adminId: ID): SubCategory
    getDeletedSubCategories(adminId: ID, categoryId: ID): [SubCategory!]!
  }

  type Mutation {
    addSubCategory(input: SubCategoryInput!): SubCategory!
    editSubCategory(id: ID!, input: SubCategoryInput!): SubCategory!
    deleteSubCategory(id: ID!): Boolean!
    resetSubCategory(id: ID!): Boolean!
  }
`;
