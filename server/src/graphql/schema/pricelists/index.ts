import { gql } from "apollo-server-express";

export const priceListTypeDefs = gql`
  type PriceListItem {
    productid: ProductService
    variantid: String
    unitid: Unit
    quantity: Float
    rate: Float
    discount: Float
    discounttype: String
  }

  type PriceList {
    id: ID!
    adminid: ID!
    name: String!
    description: String
    items: [PriceListItem]
    status: Boolean
    createdAt: Date
    updatedAt: Date
  }

  type PriceAssignment {
    id: ID!
    adminid: ID!
    pricelistid: PriceList
    targettype: String!
    targetid: String!
    priority: Int
    status: Boolean
    createdAt: Date
    updatedAt: Date
  }

  input PriceListItemInput {
    productid: ID!
    variantid: ID!
    unitid: ID!
    quantity: Float
    rate: Float
    discount: Float
    discounttype: String
  }

  input PriceListInput {
    name: String!
    description: String
    items: [PriceListItemInput]
    status: Boolean
  }

  input PriceAssignmentInput {
    pricelistid: ID!
    targettype: String!
    targetid: String!
    priority: Int
    status: Boolean
  }

  extend type Query {
    getPriceLists(adminid: ID!): [PriceList]
    getPriceListById(id: ID!): PriceList
    getPriceAssignments(adminid: ID!): [PriceAssignment]
    resolvePrice(
      productid: ID!
      variantid: ID!
      unitid: ID!
      accountid: ID
      channelid: ID
      region: String
    ): PriceListItem
  }

  extend type Mutation {
    createPriceList(input: PriceListInput!): PriceList
    updatePriceList(id: ID!, input: PriceListInput!): PriceList
    deletePriceList(id: ID!): Boolean
    createPriceAssignment(input: PriceAssignmentInput!): PriceAssignment
    updatePriceAssignment(id: ID!, input: PriceAssignmentInput!): PriceAssignment
    deletePriceAssignment(id: ID!): Boolean
  }
`;
