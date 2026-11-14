import { gql } from "apollo-server-express";

export const supplierPortalTypeDefs = gql`
  type SupplierLogin {
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

  type Query {
    getSupplierPortal: SupplierPortal!
  }

  type Mutation {
    "Supplier sign-in: mobile, then the OTP mailed to the supplier's email."
    loginSupplier(adminId: ID!, mobile: String!, otp: String): SupplierLogin!
  }
`;
