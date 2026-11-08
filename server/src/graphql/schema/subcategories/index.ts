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

    "ISO date"

    updatedAt: String
    id: ID!
    subcategorycode: String!
    subcategoryname: String!
    image: String
    status: Boolean!
    sortorder: Int
    category: Category!
    admin: Admin
  }

  input SubCategoryInput {

    "Set by offline sync so a retried save returns the same document."

    clientRequestId: String
    subcategoryname: String!
    image: String
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
    editSubCategory(id: ID!, input: SubCategoryInput!, expectedUpdatedAt: String): SubCategory!
    deleteSubCategory(id: ID!, expectedUpdatedAt: String): Boolean!
    resetSubCategory(id: ID!): Boolean!
    # Saves the order of one category's sub-categories: \`ids\` is every
    # active sub-category of \`categoryId\`, first to last.
    reorderSubCategories(adminId: ID!, categoryId: ID!, ids: [ID!]!): Boolean!
  }
`;
