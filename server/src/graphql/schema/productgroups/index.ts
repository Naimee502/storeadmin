import { gql } from 'apollo-server-express';

export const productGroupTypeDefs = gql`
  type ProductGroup {
    id: ID!
    productgroupcode: String!
    productgroupname: String!
    status: Boolean!
  }

  input ProductGroupInput {
    productgroupname: String!
    status: Boolean!
  }

  type Query {
    getProductGroups: [ProductGroup!]!
    getDeletedProductGroups: [ProductGroup!]! 
    getProductGroupById(id: ID!): ProductGroup
  }

  type Mutation {
    addProductGroup(input: ProductGroupInput!): ProductGroup!
    editProductGroup(id: ID!, input: ProductGroupInput!): ProductGroup!
    deleteProductGroup(id: ID!): Boolean!
    resetProductGroup(id: ID!): Boolean!        
  }
`;
