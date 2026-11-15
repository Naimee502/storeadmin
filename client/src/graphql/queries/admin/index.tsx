import { gql } from "@apollo/client";

// Keep in sync with the Admin Register form.
const ADMIN_FIELDS = `
  id
  admincode
  name
  email
  companyName
  mobile
  address
  noOfBranches
  subscriptionType
  subscribed
  subscribedAt
  subscriptionEnd
  transactionId
  needsReview
  rejected
  businesstype
  businesskind
  allowedmodules
  status
`;

export const GET_ADMINS = gql`
  query GetAdmins {
    getAdmins {
      ${ADMIN_FIELDS}
      gstin
    }
  }
`;

export const GET_DELETED_ADMINS = gql`
  query GetDeletedAdmins($adminId: ID) {
    getDeletedAdmins(adminId: $adminId) {
      ${ADMIN_FIELDS}
    }
  }
`;

// Platform-only read used to confirm a typed platform key.
export const CHECK_PLATFORM_KEY = gql`
  query CheckPlatformKey {
    getPendingSubscriptions {
      id
    }
  }
`;

export const FIND_LOGINS = gql`
  mutation FindLogins($email: String!, $password: String!) {
    findLogins(email: $email, password: $password) {
      kind
      label
    }
  }
`;
