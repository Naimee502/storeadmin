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
      admin {
        id
        name
        email
        subscribed
        subscriptionType
        subscribedAt
        subscriptionEnd
        transactionId
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
      admin {
        id
        name
        email
        subscribed
        subscriptionType
        subscribedAt
        subscriptionEnd
        transactionId
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
      admin {
        id
        name
        email
        subscribed
        subscriptionType
        subscribedAt
        subscriptionEnd
        transactionId
      }
    }
  }
`;