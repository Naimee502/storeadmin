import { gql } from "apollo-server-express";

export const serialTypeDefs = gql`
  extend type SalesInvoiceProductService { serials: [String!] }
  extend input SalesInvoiceProductServiceInput { serials: [String!] }
  extend type PurchaseInvoiceProductService { serials: [String!] }
  extend input PurchaseInvoiceProductServiceInput { serials: [String!] }
  extend type SalesReturnProductService { serials: [String!] }
  extend input SalesReturnProductServiceInput { serials: [String!] }
  extend type PurchaseReturnProductService { serials: [String!] }
  extend input PurchaseReturnProductServiceInput { serials: [String!] }

  type SerialUnit {
    id: ID!
    serialno: String!
    productid: ID!
    productname: String
    variantid: ID
    variantname: String
    branchid: ID
    branchname: String
    "instock, sold, returned"
    status: String!
    purchasedocid: ID
    purchasebill: String
    purchasedate: String
    vendorname: String
    saledocid: ID
    salebill: String
    saledate: String
    customername: String
    customermobile: String
    warrantytill: String
  }

  type SerialHistoryLine {
    action: String!
    docmodel: String
    docno: String
    partyname: String
    createdAt: String
  }

  input SerialFilter {
    search: String
    status: String
    productid: ID
    branchid: ID
  }

  extend type Query {
    getSerials(filter: SerialFilter): [SerialUnit!]!
    "Units of an item in stock, for a sale line."
    getAvailableSerials(productid: ID!, variantid: ID): [SerialUnit!]!
    "Units sold on an invoice, for a return line."
    getInvoiceSerials(invoiceid: ID!): [SerialUnit!]!
    "One unit and everything that happened to it."
    getSerialHistory(serialno: String!): [SerialHistoryLine!]!
  }
`;
