import { gql } from "@apollo/client";

// Same business-event notifications the app's bell shows — targettype
// "party" scoped to this account, created server-side by the exact same
// order/payment resolvers the website already calls (addSalesOrder,
// editSalesOrder, addPayment, etc.), so nothing extra needs to fire this —
// it's purely a matter of the website reading & displaying them.
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
