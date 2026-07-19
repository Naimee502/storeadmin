import { gql } from "apollo-server-express";

export const notificationTypeDefs = gql`
  type Notification {
    id: ID!
    adminid: ID
    branchid: ID
    targettype: String!
    targetid: ID
    ntype: String
    title: String!
    message: String
    webpath: String
    appscreen: String
    docmodel: String
    docid: ID
    read: Boolean!
    createdAt: String
  }

  input NotificationFilterInput {
    adminid: ID!
    targettype: String!
    targetid: ID
    unreadOnly: Boolean
    limit: Int
  }

  extend type Query {
    getNotifications(filter: NotificationFilterInput!): [Notification!]!
  }

  extend type Mutation {
    markNotificationRead(id: ID!): Boolean
    markAllNotificationsRead(filter: NotificationFilterInput!): Boolean
  }
`;
