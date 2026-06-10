import { gql } from "apollo-server-express";

export const channelTypeDefs = gql`
  type Channel {
    id: ID!
    channelCode: String
    channelName: String!
    admin: Admin
    isDefault: Boolean!
    handlesChannels: [Channel]
    status: Boolean!
    createdAt: String
    updatedAt: String
  }

  input CreateChannelInput {
    channelName: String!
    admin: ID!
    isDefault: Boolean
    handlesChannels: [ID]
    status: Boolean
  }

  input UpdateChannelInput {
    channelName: String
    isDefault: Boolean
    handlesChannels: [ID]
    status: Boolean
  }

  type Query {
    getChannels(adminId: ID): [Channel!]!
    getDeletedChannels(adminId: ID): [Channel!]!
    getChannelById(id: ID!): Channel
  }

  type Mutation {
    createChannel(input: CreateChannelInput!): Channel!
    updateChannel(id: ID!, input: UpdateChannelInput!): Channel!
    deleteChannel(id: ID!): Boolean!
    resetChannel(id: ID!): Boolean!
  }
`;
