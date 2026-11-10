import { gql } from "apollo-server-express";

export const quotationTypeDefs = gql`
  type QuotationLine {
    productserviceid: SimpleRef
    variantid: SimpleRef
    salesunitid: SimpleRef
    unitqty: Float
    qty: Float!
    rate: Float
    discount: Float
    gst: Float
    amount: Float
    description: String
    optional: Boolean
  }

  input QuotationLineInput {
    productserviceid: ID
    variantid: ID
    salesunitid: ID
    unitqty: Float
    qty: Float!
    rate: Float
    discount: Float
    gst: Float
    amount: Float
    description: String
    optional: Boolean
  }

  type Quotation {
    id: ID
    adminid: ID
    branchid: ID
    billnumber: String
    "Provisional device number the quotation was made offline with."
    offlineNumber: String
    revision: Int
    rootid: ID
    partyacc: SimpleRef
    leadid: SimpleRef
    customername: String
    customermobile: String
    customeraddress: String
    customercity: String
    customerstate: String
    customergstin: String
    contactperson: String
    billdate: String!
    validtill: String
    subject: String
    intro: String
    terms: String
    notes: String
    productservice: [QuotationLine!]!
    subtotal: Float
    totaldiscount: Float
    totalgst: Float
    totalamount: Float
    quotationStatus: String
    statusreason: String
    statusAt: String
    convertedorderid: ID
    createdby_name: String
    createdby_type: String
    status: Boolean
    createdAt: String
    "ISO date"
    updatedAt: String
  }

  input QuotationInput {
    clientRequestId: String
    billnumber: String
    branchid: ID
    partyacc: ID
    leadid: ID
    customername: String
    customermobile: String
    customeraddress: String
    customercity: String
    customerstate: String
    customergstin: String
    contactperson: String
    billdate: String!
    validtill: String
    subject: String
    intro: String
    terms: String
    notes: String
    productservice: [QuotationLineInput!]!
    subtotal: Float
    totaldiscount: Float
    totalgst: Float
    totalamount: Float
  }

  input QuotationFilterInput {
    branchid: ID
    leadid: ID
    partyacc: ID
    billdateFrom: String
    billdateTo: String
    "Every revision, not only the latest of each number."
    allRevisions: Boolean
  }

  type QuotationPage {
    items: [Quotation!]!
    total: Int!
  }

  extend type Query {
    getQuotations(filter: QuotationFilterInput): [Quotation!]!
    getQuotationsPage(filter: QuotationFilterInput, page: Int, pageSize: Int, search: String, columnFilters: [ColumnFilter!]): QuotationPage!
    getDeletedQuotations(filter: QuotationFilterInput): [Quotation!]!
    getQuotationById(id: ID!): Quotation
  }

  extend type Mutation {
    addQuotation(input: QuotationInput!): Quotation
    editQuotation(id: ID!, input: QuotationInput!, expectedUpdatedAt: String): Quotation
    deleteQuotation(id: ID!, expectedUpdatedAt: String): Boolean
    resetQuotation(id: ID!): Boolean
    "sent, accepted, rejected or converted (with the order made from it)."
    setQuotationStatus(id: ID!, quotationStatus: String!, statusreason: String, convertedorderid: ID, expectedUpdatedAt: String): Quotation
    "New revision (R+1) from this one; this one becomes revised."
    reviseQuotation(id: ID!): Quotation
  }
`;
