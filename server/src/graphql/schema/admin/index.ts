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
    noOfBranches: Int!
    subscriptionType: String
    subscribed: Boolean!
    subscribedAt: String
    subscriptionEnd: String
    transactionId: String
    needsReview: Boolean!
    rejected: Boolean!
    businesstype: String
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
    noOfBranches: Int!
    subscriptionType: String
    businesstype: String
    allowedmodules: [String!]
    status: Boolean
  }

  input AdminUpdateInput {
    name: String
    email: String
    password: String
    companyName: String
    mobile: String
    noOfBranches: Int
    subscriptionType: String
    businesstype: String
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
    loginAdmin(email: String!, password: String!): LoginAdminResponse
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
  }
`;
