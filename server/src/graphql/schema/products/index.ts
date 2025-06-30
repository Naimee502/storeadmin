import { gql } from 'apollo-server-express';

export const productTypeDefs = gql`
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

  type Product {
    id: ID!
    branchid: ID!
    productcode: String!          
    name: String!
    barcode: String!               
    productimage: String
    imageurl: String
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
    admin: Admin
  }

  input ProductInput {
    branchid: ID!
    name: String!
    productimage: String
    imageurl: String
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
    admin: ID
  }

  type Query {
    getProducts(adminId: ID, branchid: ID): [Product!]!
    getDeletedProducts(adminId: ID, branchid: ID): [Product!]!
    getProduct(id: ID!, adminId: ID): Product
  }

  type Mutation {
    addProduct(input: ProductInput!): Product!
    addProducts(inputs: [ProductInput!]!): [Product!]!
    editProduct(id: ID!, input: ProductInput!): Product!
    deleteProduct(id: ID!): Boolean!
    resetProduct(id: ID!): Boolean!
  }
`;
