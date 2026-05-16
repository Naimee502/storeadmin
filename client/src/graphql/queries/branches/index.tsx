import { gql } from '@apollo/client';

export const GET_BRANCHES = gql`
  query GetBranches($adminId: ID) {
    getBranches(adminId: $adminId) {
      id
      branchcode
      branchname
      mobile
      password
      logo
      imageurl
      location
      address
      city
      pincode
      phone
      email
      status
      allowedmodules
      admin {
        id
        name
        email
        subscriptionType
        subscribed
        subscribedAt
        subscriptionEnd
        transactionId
        businesstype
        isMultibranch
        isChannelCustomers
        allowedmodules
        needsReview
        rejected
        isExpiringSoon
      }
    }
  }
`;

export const GET_DELETED_BRANCHES = gql`
  query GetDeletedBranches($adminId: ID) {
    getDeletedBranches(adminId: $adminId) {
      id
      branchcode
      branchname
      mobile
      password
      logo
      imageurl
      location
      address
      city
      pincode
      phone
      email
      status
      allowedmodules
      admin {
        id
        name
        email
        subscriptionType
        subscribed
        subscribedAt
        subscriptionEnd
        transactionId
        businesstype
        isMultibranch
        isChannelCustomers
        allowedmodules
        needsReview
        rejected
        isExpiringSoon
      }
    }
  }
`;

export const GET_BRANCH_BY_ID = gql`
  query GetBranchById($id: ID!, $adminId: ID) {
    getBranch(id: $id, adminId: $adminId) {
      id
      branchcode
      branchname
      mobile
      password
      logo
      imageurl
      location
      address
      city
      pincode
      phone
      email
      status
      allowedmodules
      admin {
        id
        name
        email
        subscriptionType
        subscribed
        subscribedAt
        subscriptionEnd
        transactionId
        businesstype
        isMultibranch
        isChannelCustomers
        allowedmodules
        needsReview
        rejected
        isExpiringSoon
      }
    }
  }
`;
