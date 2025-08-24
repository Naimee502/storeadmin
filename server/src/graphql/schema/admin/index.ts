import { gql } from 'apollo-server-express';

export const adminTypeDefs = gql`
  type Admin {
    id: ID!
    name: String!
    email: String!
    password: String!
    subscriptionType: String
    subscribed: Boolean!
    subscribedAt: String
    subscriptionEnd: String
    transactionId: String
    needsReview: Boolean!
    rejected: Boolean!
    businesstype: String
    isMultibranch: Boolean
    isChannelCustomers: Boolean
    allowedmodules: [String!]
    createdAt: String
    updatedAt: String
    status: Boolean!
  }

  input CreateAdminInput {
    name: String!
    email: String!
    password: String!
    subscriptionType: String
    businesstype: String
    isMultibranch: Boolean
    isChannelCustomers: Boolean
    allowedmodules: [String!]
    status: Boolean
  }

  input AdminUpdateInput {
    name: String
    email: String
    password: String
    subscriptionType: String
    businesstype: String
    isMultibranch: Boolean
    isChannelCustomers: Boolean
    allowedmodules: [String!]
    status: Boolean
  }

  type Query {
    getAdmins: [Admin]
    getAdminByEmail(email: String!): Admin
    getPendingSubscriptions: [Admin!]!
    getDeletedAdmins(adminId: ID): [Admin!]!
  }

  type Mutation {
    createAdmin(input: CreateAdminInput!): Admin
    loginAdmin(email: String!, password: String!): Admin
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
