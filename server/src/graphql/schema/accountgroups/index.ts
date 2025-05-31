import { gql } from 'apollo-server-express';

export const accountGroupTypeDefs = gql`
  type AccountGroup {
    id: ID!
    accountgroupcode: String!
    accountgroupname: String!
    status: Boolean!
  }

  input AccountGroupInput {
    accountgroupname: String!
    status: Boolean!
  }

  type Query {
    getAccountGroups: [AccountGroup!]!
    getDeletedAccountGroups: [AccountGroup!]!
    getAccountGroupById(id: ID!): AccountGroup
  }

  type Mutation {
    addAccountGroup(input: AccountGroupInput!): AccountGroup!
    editAccountGroup(id: ID!, input: AccountGroupInput!): AccountGroup!
    deleteAccountGroup(id: ID!): Boolean!
    resetAccountGroup(id: ID!): Boolean!
  }
`;
