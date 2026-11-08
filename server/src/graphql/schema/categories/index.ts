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

    "ISO date"

    updatedAt: String
    id: ID!
    categorycode: String!
    categoryname: String!
    image: String
    status: Boolean!
    sortorder: Int
    admin: Admin
  }

  input CategoryInput {

    "Set by offline sync so a retried save returns the same document."

    clientRequestId: String
    categoryname: String!
    image: String
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
    editCategory(id: ID!, input: CategoryInput!, expectedUpdatedAt: String): Category!
    deleteCategory(id: ID!, expectedUpdatedAt: String): Boolean!
    resetCategory(id: ID!): Boolean!
    # Saves the storefront order: \`ids\` is every active category of the
    # business, first to last.
    reorderCategories(adminId: ID!, ids: [ID!]!): Boolean!
  }
`;
