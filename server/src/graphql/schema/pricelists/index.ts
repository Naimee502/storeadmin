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
    adminid: ID
    name: String!
    description: String
    items: [PriceListItemInput]
    status: Boolean
  }

  input PriceAssignmentInput {
    adminid: ID
    pricelistid: ID!
    targettype: String!
    targetid: String!
    status: Boolean
  }

  extend type Query {
    getPriceLists(adminid: ID!): [PriceList]
    getPriceListById(id: ID!): PriceList
    getDeletedPriceLists(adminid: ID!): [PriceList]
    getPriceAssignments(adminid: ID!): [PriceAssignment]
    getDeletedPriceAssignments(adminid: ID!): [PriceAssignment]
    resolvePrice(
      productid: ID!
      variantid: ID!
      unitid: ID!
      adminid: ID
      accountid: ID
      channelid: ID
      region: String
    ): PriceListItem
  }

  extend type Mutation {
    createPriceList(input: PriceListInput!): PriceList
    updatePriceList(id: ID!, input: PriceListInput!): PriceList
    deletePriceList(id: ID!): Boolean
    resetPriceList(id: ID!): Boolean
    createPriceAssignment(input: PriceAssignmentInput!): PriceAssignment
    updatePriceAssignment(id: ID!, input: PriceAssignmentInput!): PriceAssignment
    deletePriceAssignment(id: ID!): Boolean
    resetPriceAssignment(id: ID!): Boolean
  }
`;
