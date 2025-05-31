import { gql } from '@apollo/client';

export const GET_BRANCHES = gql`
  query GetBranches {
    getBranches {
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

export const GET_DELETED_BRANCHES = gql`
  query GetDeletedBranches {
    getDeletedBranches {
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

export const GET_BRANCH_BY_ID = gql`
  query GetBranchById($id: ID!) {
    getBranch(id: $id) {
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