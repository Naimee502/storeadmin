import { gql } from 'apollo-server-express';

export const accountGroupTypeDefs = gql`
  type Admin {
    id: ID!
    name: String!
    email: String!
    subscriptionType: String
    subscribed: Boolean
    subscribedAt: String
    subscriptionEnd: String
    transactionId: String
    needsReview: Boolean!
    rejected: Boolean!
  }

  type AccountGroup {
    id: ID!
    accountgroupcode: String!
    accountgroupname: String!
    status: Boolean!
    admin: Admin
  }

  input AccountGroupInput {
    accountgroupname: String!
    status: Boolean!
    admin: ID
  }

  type Query {
    getAccountGroups(adminId: ID): [AccountGroup!]!
    getDeletedAccountGroups(adminId: ID): [AccountGroup!]!
    getAccountGroupById(id: ID!, adminId: ID): AccountGroup
  }

  type Mutation {
    addAccountGroup(input: AccountGroupInput!): AccountGroup!
    editAccountGroup(id: ID!, input: AccountGroupInput!): AccountGroup!
    deleteAccountGroup(id: ID!): Boolean!
    resetAccountGroup(id: ID!): Boolean!
  }
`;
