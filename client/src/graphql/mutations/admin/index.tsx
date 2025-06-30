import { gql } from "@apollo/client";

export const CREATE_ADMIN = gql`
  mutation CreateAdmin($input: CreateAdminInput!) {
    createAdmin(input: $input) {
      id
      name
      email
      subscriptionType
      subscribed     
      subscribedAt
      subscriptionEnd
      transactionId
    }
  }
`;

export const CONFIRM_SUBSCRIPTION = gql`
  mutation ConfirmSubscription(
    $email: String!
    $transactionId: String!
    $subscriptionType: String!
  ) {
    confirmSubscription(
      email: $email
      transactionId: $transactionId
      subscriptionType: $subscriptionType
    ) {
      id
      name
      email
      subscribed
      subscribedAt
      subscriptionEnd
      transactionId
      needsReview
    }
  }
`;

export const LOGIN_ADMIN = gql`
  mutation LoginAdmin($email: String!, $password: String!) {
    loginAdmin(email: $email, password: $password) {
      id
      name
      email
      subscriptionType
      subscribed
      subscribedAt
      subscriptionEnd
      transactionId
      needsReview
      rejected
    }
  }
`;

export const APPROVE_SUBSCRIPTION = gql`
  mutation ApproveSubscription($email: String!) {
    approveSubscription(email: $email) {
      id
      name
      email
      subscribed
      subscribedAt
      subscriptionEnd
      transactionId
      needsReview
      rejected
    }
  }
`;

export const REJECT_SUBSCRIPTION = gql`
  mutation RejectSubscription($email: String!) {
    rejectSubscription(email: $email) {
      id
      name
      email
      subscribed
      needsReview
      rejected
    }
  }
`;

export const GET_PENDING_SUBSCRIPTIONS = gql`
  query GetPendingSubscriptions {
    getPendingSubscriptions {
      id
      name
      email
      transactionId
      subscriptionType
      needsReview
      createdAt
    }
  }
`;
