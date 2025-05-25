import { gql } from '@apollo/client';

export const ADD_BRANCH = gql`
  mutation AddBranch($input: BranchInput!) {
    addBranch(input: $input) {
      id
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

export const EDIT_BRANCH = gql`
  mutation EditBranch($id: ID!, $input: BranchInput!) {
    editBranch(id: $id, input: $input) {
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

export const DELETE_BRANCH = gql`
  mutation DeleteBranch($id: ID!) {
    deleteBranch(id: $id)
  }
`;
