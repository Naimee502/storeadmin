import { gql } from "@apollo/client";

export const GET_ADMINS = gql`
  query GetAdmins {
    getAdmins {
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
      isMultibranch
      isChannelCustomers
      allowedmodules
      status
    }
  }
`;


export const GET_DELETED_ADMINS = gql`
  query GetDeletedAdmins($adminId: ID) {
    getDeletedAdmins(adminId: $adminId) {
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
      isMultibranch
      isChannelCustomers
      allowedmodules
      status
    }
  }
`;
