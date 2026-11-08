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

// Branches list page: grid + export fields; shares the cache with GET_BRANCHES.
export const GET_BRANCHES_LIST = gql`
  query GetBranchesList($adminId: ID) {
    getBranches(adminId: $adminId) {
      id
      branchcode
      branchname
      mobile
      password
      logo
      location
      address
      city
      pincode
      phone
      email
      status
    }
  }
`;

// One page of the Branches list page: same fields as GET_BRANCHES_LIST.
export const GET_BRANCHES_PAGE = gql`
  query GetBranchesPage(
    $adminId: ID
    $page: Int
    $pageSize: Int
    $search: String
    $columnFilters: [ColumnFilter!]
  ) {
    getBranchesPage(adminId: $adminId, page: $page, pageSize: $pageSize, search: $search, columnFilters: $columnFilters) {
      total
      items {
        id
        branchcode
        branchname
        mobile
        password
        logo
        location
        address
        city
        pincode
        phone
        email
        status
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
