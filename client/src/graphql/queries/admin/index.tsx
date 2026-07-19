import { gql } from "@apollo/client";

// Field set kept in sync with the Admin Register form. companyName,
// mobile, and noOfBranches were missing earlier — without them the list
// table and the edit modal would receive `undefined` for those fields.
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
  allowedmodules
  status
`;

export const GET_ADMINS = gql`
  query GetAdmins {
    getAdmins {
      ${ADMIN_FIELDS}
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
