import { gql } from 'apollo-server-express';

export const brandTypeDefs = gql`
  type Brand {
    id: ID!
    brandcode: String!
    brandname: String!
    status: Boolean!
  }

  input BrandInput {
    brandname: String!
    status: Boolean!
  }

  type Query {
    getBrands: [Brand!]!
    getBrandById(id: ID!): Brand
    getDeletedBrands: [Brand!]!
  }

  type Mutation {
    addBrand(input: BrandInput!): Brand!
    editBrand(id: ID!, input: BrandInput!): Brand!
    deleteBrand(id: ID!): Boolean!
    resetBrand(id: ID!): Boolean!
  }
`;
