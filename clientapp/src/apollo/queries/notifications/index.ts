import { gql } from '@apollo/client';

export const GET_NOTIFICATIONS = gql`
  query GetNotifications($filter: NotificationFilterInput!) {
    getNotifications(filter: $filter) {
      id
      ntype
      title
      message
      appscreen
      docmodel
      docid
      read
      createdAt
    }
  }
`;

export const MARK_NOTIFICATION_READ = gql`
  mutation MarkNotificationRead($id: ID!) {
    markNotificationRead(id: $id)
  }
`;

export const MARK_ALL_NOTIFICATIONS_READ = gql`
  mutation MarkAllNotificationsRead($filter: NotificationFilterInput!) {
    markAllNotificationsRead(filter: $filter)
  }
`;
