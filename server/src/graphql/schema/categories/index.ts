import { gql } from 'apollo-server-express';

export const categoryTypeDefs = gql`
  type Category {
    id: ID!
    categorycode: String!
    categoryname: String!
    status: Boolean!
  }

  input CategoryInput {
    categoryname: String!
    status: Boolean!
  }

  type Query {
    getCategories: [Category!]!
    getCategoryById(id: ID!): Category
  }

  type Mutation {
    addCategory(input: CategoryInput!): Category!
    editCategory(id: ID!, input: CategoryInput!): Category!
    deleteCategory(id: ID!): Boolean!
  }
`;
