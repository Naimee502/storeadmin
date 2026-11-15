import { gql } from "apollo-server-express";

export const jewelleryTypeDefs = gql`
  "How a jewellery line's price was worked out."
  type JewelLine {
    metal: String
    purity: String
    grossweight: Float
    stoneweight: Float
    netweight: Float
    "Per gram."
    metalrate: Float
    metalvalue: Float
    "pergram, percent (of metal value) or fixed"
    makingtype: String
    making: Float
    makingamount: Float
    stonecharge: Float
    othercharge: Float
    huid: String
  }
  input JewelLineInput {
    metal: String
    purity: String
    grossweight: Float
    stoneweight: Float
    netweight: Float
    metalrate: Float
    metalvalue: Float
    makingtype: String
    making: Float
    makingamount: Float
    stonecharge: Float
    othercharge: Float
    huid: String
  }
  type OldGoldLine { description: String metal: String purity: String weight: Float deduction: Float rate: Float amount: Float }
  input OldGoldLineInput { description: String metal: String purity: String weight: Float deduction: Float rate: Float amount: Float }

  extend type SalesInvoiceProductService { jewel: JewelLine }
  extend input SalesInvoiceProductServiceInput { jewel: JewelLineInput }
  extend type SalesInvoice { oldgold: [OldGoldLine!] oldgoldamount: Float }
  extend input SalesInvoiceInput { oldgold: [OldGoldLineInput!] oldgoldamount: Float }

  type MetalRate {
    id: ID!
    date: String!
    metal: String!
    purity: String!
    "Per gram."
    rate: Float!
    createdby_name: String
    updatedAt: String
  }
  input MetalRateInput { metal: String! purity: String! rate: Float! }

  extend type Query {
    "Latest rate of each metal and purity (on or before the date; today when blank)."
    getMetalRates(date: String): [MetalRate!]!
    "Rates of one metal and purity, newest first."
    getMetalRateHistory(metal: String!, purity: String!): [MetalRate!]!
  }
  extend type Mutation {
    "Save the day's rates (per gram)."
    setMetalRates(date: String!, rates: [MetalRateInput!]!): [MetalRate!]!
  }
`;
