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
      businesstype
      companyName
      mobile
      address
      noOfBranches
      allowedmodules
    }
  }
`;

export const UPDATE_ADMIN_BY_ID = gql`
  mutation UpdateAdminById($id: ID!, $input: AdminUpdateInput!) {
    updateAdminById(id: $id, input: $input) {
      id
      name
      email
      subscriptionType
      subscribed
      businesstype
      companyName
      mobile
      address
      noOfBranches
      allowedmodules
      status
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
      businesstype
      companyName
      mobile
      noOfBranches
      allowedmodules
    }
  }
`;

export const LOGIN_ADMIN = gql`
  mutation LoginAdmin($email: String!, $password: String!) {
    loginAdmin(email: $email, password: $password) {
      accessToken
      admin {
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
        businesstype
        companyName
        mobile
        address
        noOfBranches
        allowedmodules
      }
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
      businesstype
      companyName
      mobile
      noOfBranches
      allowedmodules
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
      businesstype
      companyName
      mobile
      noOfBranches
      allowedmodules
    }
  }
`;


export const DELETE_ADMIN = gql`
  mutation DeleteAdmin($id: ID!) {
    deleteAdmin(id: $id)
  }
`;

export const RESET_ADMIN = gql`
  mutation ResetAdmin($id: ID!) {
    resetAdmin(id: $id)
  }
`;
