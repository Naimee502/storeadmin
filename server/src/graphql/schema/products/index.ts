import { gql } from 'apollo-server-express';

export const productTypeDefs = gql`
  type Product {
    id: ID!
    productcode: String!          
    name: String!
    barcode: String!               
    productimage: String
    productimageurl: String
    categoryid: ID!
    productgroupnameid: ID!
    modelid: ID!
    brandid: ID!
    sizeid: ID!
    purchaseunitid: ID!
    purchaserate: Float!
    salesunitid: ID!
    salesrate: Float!
    gst: Float!
    openingstock: Int
    openingstockamount: Float
    currentstock: Int
    currentstockamount: Float
    minimumstock: Int
    description: String
    productlikecount: Int
    status: Boolean!
    createdAt: String
    updatedAt: String
  }

  input ProductInput {
    name: String!
    productimage: String
    productimageurl: String
    categoryid: ID!
    productgroupnameid: ID!
    modelid: ID!
    brandid: ID!
    sizeid: ID!
    purchaseunitid: ID!
    purchaserate: Float!
    salesunitid: ID!
    salesrate: Float!
    gst: Float
    openingstock: Int
    openingstockamount: Float
    currentstock: Int
    currentstockamount: Float
    minimumstock: Int
    description: String
    productlikecount: Int
    status: Boolean
  }

  type Query {
    getProducts: [Product!]!
    getDeletedProducts: [Product!]!
    getProduct(id: ID!): Product
  }

  type Mutation {
    addProduct(input: ProductInput!): Product!
    addProducts(inputs: [ProductInput!]!): [Product!]!
    editProduct(id: ID!, input: ProductInput!): Product!
    deleteProduct(id: ID!): Boolean!
    resetProduct(id: ID!): Boolean!
  }
`;
