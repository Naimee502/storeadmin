import { gql } from 'apollo-server-express';

export const accountGroupTypeDefs = gql`
  enum AccountCategory {
    assets
    liabilities
    income
    expenses
  }

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

    "ISO date"

    updatedAt: String
    id: ID!
    accountgroupcode: String!
    accountgroupname: String!
    category: AccountCategory!
    status: Boolean!
    admin: Admin
  }

  input AccountGroupInput {

    "Set by offline sync so a retried save returns the same document."

    clientRequestId: String
    accountgroupname: String!
    category: AccountCategory!
    status: Boolean!
    admin: ID
  }

  type AccountGroupPage {
    items: [AccountGroup!]!
    total: Int!
  }

  type Query {
    getAccountGroups(adminId: ID): [AccountGroup!]!
    getAccountGroupsPage(adminId: ID, page: Int, pageSize: Int, search: String, columnFilters: [ColumnFilter!]): AccountGroupPage!
    getDeletedAccountGroups(adminId: ID): [AccountGroup!]!
    getAccountGroupById(id: ID!, adminId: ID): AccountGroup
  }

  type Mutation {
    addAccountGroup(input: AccountGroupInput!): AccountGroup!
    editAccountGroup(id: ID!, input: AccountGroupInput!, expectedUpdatedAt: String): AccountGroup!
    deleteAccountGroup(id: ID!, expectedUpdatedAt: String): Boolean!
    resetAccountGroup(id: ID!): Boolean!
  }
`;

