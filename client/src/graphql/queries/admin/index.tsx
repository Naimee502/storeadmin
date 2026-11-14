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

// Business named by a login link (/login?b=code): its name and the login tabs it shows.
export const GET_LOGIN_BUSINESS = gql`
  query GetLoginBusiness($admincode: String!) {
    getAdminByCode(admincode: $admincode) {
      id
      companyName
    }
  }
`;

export const GET_LOGIN_BUSINESS_BY_ID = gql`
  query GetLoginBusinessById($id: ID!) {
    getAdminById(id: $id) {
      id
      companyName
    }
  }
`;

export const GET_LOGIN_TABS = gql`
  query GetLoginTabs($adminid: ID!) {
    getAdminSettings(adminid: $adminid) {
      id
      loginTabs
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
