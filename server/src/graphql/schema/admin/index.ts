import { gql } from 'apollo-server-express';

export const adminTypeDefs = gql`
  type Admin {
    id: ID!
    name: String!
    email: String!
    password: String!
    subscriptionType: String!
    subscribed: Boolean!
    subscribedAt: String
    subscriptionEnd: String
    transactionId: String
    createdAt: String
    updatedAt: String
  }

  input CreateAdminInput {
    name: String!
    email: String!
    password: String!
    subscriptionType: String!
  }

  type Query {
    getAdmins: [Admin]
    getAdminByEmail(email: String!): Admin
  }

  type Mutation {
    createAdmin(input: CreateAdminInput!): Admin
    loginAdmin(email: String!, password: String!): Admin
    confirmSubscription(email: String!, transactionId: String!, subscriptionType: String!): Admin
  }
`;
