import { gql } from 'apollo-server-express';

export const brandTypeDefs = gql`
  type Admin {
    id: ID!
    name: String!
    email: String!
    subscriptionType: String
    subscribed: Boolean
    subscribedAt: String
    subscriptionEnd: String
    transactionId: String
  }

  type Brand {
    id: ID!
    brandcode: String!
    brandname: String!
    status: Boolean!
    admin: Admin
  }

  input BrandInput {
    brandname: String!
    status: Boolean!
    admin: ID
}

  type Query {
    getBrands(adminId: ID): [Brand!]!
    getBrandById(id: ID!, adminId: ID): Brand
    getDeletedBrands(adminId: ID): [Brand!]!
  }

  type Mutation {
    addBrand(input: BrandInput!): Brand!
    editBrand(id: ID!, input: BrandInput!): Brand!
    deleteBrand(id: ID!): Boolean!
    resetBrand(id: ID!): Boolean!
  }
`;
