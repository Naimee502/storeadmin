import { gql } from "@apollo/client";

export const GET_NOTIFICATIONS = gql`
  query GetNotifications($filter: NotificationFilterInput!) {
    getNotifications(filter: $filter) {
      id
      targettype
      targetid
      ntype
      title
      message
      webpath
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

// Manual outstanding reminder: in-app notification plus mobile/text for WhatsApp.
export const SEND_OUTSTANDING_REMINDER = gql`
  mutation SendOutstandingReminder($input: OutstandingReminderInput!) {
    sendOutstandingReminder(input: $input) {
      success
      mobile
      message
    }
  }
`;
