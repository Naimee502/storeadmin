import { gql } from "apollo-server-express";

export const supplierPortalTypeDefs = gql`
  type SupplierLogin {
    id: ID
    accessToken: String!
    name: String!
  }

  type SupplierOrder {
    id: ID!
    billnumber: String
    billdate: String
    totalamount: Float!
    items: Int!
    "pending, confirmed, received, cancelled, returned"
    orderStatus: String!
  }

  type SupplierBill {
    id: ID!
    billnumber: String
    billdate: String
    totalamount: Float!
    outstanding: Float!
  }

  type SupplierPayment {
    id: ID!
    paymentcode: String
    paymentdate: String
    "payment (paid to you), receipt or refund (paid by you)"
    type: String!
    mode: String
    amount: Float!
    reference: String
  }

  "What the business shows a supplier: orders, bills, payments and balance."
  type SupplierPortal {
    name: String!
    company: String
    mobile: String
    "Positive: the business owes the supplier. Negative: the supplier owes the business."
    payable: Float!
    orders: [SupplierOrder!]!
    bills: [SupplierBill!]!
    payments: [SupplierPayment!]!
  }

  type SupplierDocLine {
    lineid: ID!
    name: String!
    unit: String
    qty: Float!
    rate: Float!
    discount: Float
    gst: Float
    amount: Float!
  }

  type SupplierDocCharge {
    name: String
    amount: Float!
  }

  "One purchase order (kind order) or purchase bill (kind bill) of the signed-in supplier."
  type SupplierDocument {
    id: ID!
    kind: String!
    billnumber: String
    billdate: String
    duedate: String
    orderStatus: String
    notes: String
    suppliernote: String
    subtotal: Float!
    totaldiscount: Float!
    totalgst: Float!
    roundoff: Float
    totalamount: Float!
    outstanding: Float
    "True for a pending order the supplier may still change."
    editable: Boolean!
    lines: [SupplierDocLine!]!
    charges: [SupplierDocCharge!]!
  }

  input SupplierOrderLineInput {
    lineid: ID!
    qty: Float!
    rate: Float!
  }

  type Query {
    getSupplierPortal: SupplierPortal!
    getSupplierDocument(kind: String!, id: ID!): SupplierDocument!
  }

  type Mutation {
    "Supplier sign-in: mobile, then the OTP mailed to the supplier's email."
    loginSupplier(adminId: ID!, mobile: String!, otp: String): SupplierLogin!
    "Supplier changes quantity or rate of a pending order; a line with qty 0 is removed."
    updateSupplierOrder(id: ID!, lines: [SupplierOrderLineInput!]!, note: String): SupplierDocument!
    "Short-lived link to a printable page of the bill or order."
    supplierPrintLink(kind: String!, id: ID!): String!
  }
`;
