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
    }
  }
`;


