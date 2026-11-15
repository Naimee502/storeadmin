import { gql } from 'apollo-server-express';

export const adminTypeDefs = gql`
  type Admin {
    id: ID!
    admincode: String
    name: String!
    email: String!
    password: String!
    companyName: String!
    mobile: String!
    address: String
    "GSTIN, kept in Business Settings → GST Profile."
    gstin: String
    noOfBranches: Int!
    subscriptionType: String
    subscribed: Boolean!
    subscribedAt: String
    subscriptionEnd: String
    transactionId: String
    needsReview: Boolean!
    rejected: Boolean!
    businesstype: String
    "Business Kind under the type, e.g. kirana under retail."
    businesskind: String
    allowedmodules: [String!]
    createdAt: String
    updatedAt: String
    status: Boolean!
  }

  input CreateAdminInput {
    name: String!
    email: String!
    password: String!
    companyName: String!
    mobile: String!
    address: String
    "GSTIN, kept in Business Settings → GST Profile."
    gstin: String
    noOfBranches: Int!
    subscriptionType: String
    businesstype: String
    allowedmodules: [String!]
    status: Boolean
    "Product / service form fields the business type shows or hides: { products: { field: true|false }, services: {...} }."
    formfields: JSON
    businesskind: String
    "Starter masters of the type: { units: [{ name, uqc }], categories: [name] }."
    starter: JSON
  }

  input AdminUpdateInput {
    name: String
    email: String
    password: String
    companyName: String
    mobile: String
    address: String
    "GSTIN, kept in Business Settings → GST Profile."
    gstin: String
    noOfBranches: Int
    subscriptionType: String
    businesstype: String
    businesskind: String
    allowedmodules: [String!]
    status: Boolean
  }

  type LoginAdminResponse {
    accessToken: String!
    admin: Admin!
  }

  type Query {
    getAdmins: [Admin]
    getAdminById(id: ID!): Admin
    getAdminByEmail(email: String!): Admin
    getAdminByCode(admincode: String!): Admin
    getPendingSubscriptions: [Admin!]!
    getDeletedAdmins(adminId: ID): [Admin!]!
  }

  type Mutation {
    createAdmin(input: CreateAdminInput!): Admin
    loginAdmin(email: String!, password: String!, otp: String): LoginAdminResponse
    confirmSubscription(
      email: String!
      transactionId: String!
      subscriptionType: String!
    ): Admin
    approveSubscription(email: String!): Admin
    rejectSubscription(email: String!): Admin
    updateAdminById(id: ID!, input: AdminUpdateInput!): Admin
    deleteAdmin(id: ID!): Boolean!
    resetAdmin(id: ID!): Boolean!
    "Adds starter units and categories the business does not have yet; returns how many were added."
    addStarterMasters(adminid: ID, starter: JSON!): Int!
  }
`;
