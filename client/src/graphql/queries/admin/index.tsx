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
    }
  }
`;
