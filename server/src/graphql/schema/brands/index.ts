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
    needsReview: Boolean!
    rejected: Boolean!
  }

  type Brand {

    "ISO date"

    updatedAt: String
    id: ID!
    brandcode: String!
    brandname: String!
    status: Boolean!
    admin: Admin
  }

  input BrandInput {

    "Set by offline sync so a retried save returns the same document."

    clientRequestId: String
    brandname: String!
    status: Boolean!
    admin: ID
}

  type BrandPage {
    items: [Brand!]!
    total: Int!
  }

  type Query {
    getBrands(adminId: ID): [Brand!]!
    getBrandsPage(adminId: ID, page: Int, pageSize: Int, search: String, columnFilters: [ColumnFilter!]): BrandPage!
    getBrandById(id: ID!, adminId: ID): Brand
    getDeletedBrands(adminId: ID): [Brand!]!
  }

  type Mutation {
    addBrand(input: BrandInput!): Brand!
    editBrand(id: ID!, input: BrandInput!, expectedUpdatedAt: String): Brand!
    deleteBrand(id: ID!, expectedUpdatedAt: String): Boolean!
    resetBrand(id: ID!): Boolean!
  }
`;
