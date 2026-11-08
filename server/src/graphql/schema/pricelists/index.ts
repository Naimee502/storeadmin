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

  type PriceListPage {
    items: [PriceList!]!
    total: Int!
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

    "Set by offline sync so a retried save returns the same document."

    clientRequestId: String
    adminid: ID
    name: String!
    description: String
    items: [PriceListItemInput]
    status: Boolean
  }

  input PriceAssignmentInput {

    "Set by offline sync so a retried save returns the same document."

    clientRequestId: String
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
    getPriceListsPage(adminid: ID!, page: Int, pageSize: Int, search: String, columnFilters: [ColumnFilter!]): PriceListPage!
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
    updatePriceList(id: ID!, input: PriceListInput!, expectedUpdatedAt: String): PriceList
    deletePriceList(id: ID!, expectedUpdatedAt: String): Boolean
    resetPriceList(id: ID!): Boolean
    createPriceAssignment(input: PriceAssignmentInput!): PriceAssignment
    updatePriceAssignment(id: ID!, input: PriceAssignmentInput!, expectedUpdatedAt: String): PriceAssignment
    deletePriceAssignment(id: ID!, expectedUpdatedAt: String): Boolean
    resetPriceAssignment(id: ID!): Boolean
  }
`;
