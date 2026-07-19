import { gql } from '@apollo/client';

export const ADD_BRANCH = gql`
  mutation AddBranch($input: BranchInput!) {
    addBranch(input: $input) {
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

export const EDIT_BRANCH = gql`
  mutation EditBranch($id: ID!, $input: BranchInput!) {
    editBranch(id: $id, input: $input) {
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
        subscribed
        subscriptionType
        subscribedAt
        subscriptionEnd
        transactionId
      }
    }
  }
`;

export const DELETE_BRANCH = gql`
  mutation DeleteBranch($id: ID!) {
    deleteBranch(id: $id)
  }
`;

export const RESET_BRANCH = gql`
  mutation ResetBranch($id: ID!) {
    resetBranch(id: $id)
  }
`;

export const LOGIN_BRANCH = gql`
  mutation LoginBranch($email: String!, $password: String!) {
    loginBranch(email: $email, password: $password) {
      accessToken
      branch {
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
          subscribed
          subscriptionType
          subscribedAt
          subscriptionEnd
          transactionId
          needsReview
          rejected
          businesstype
          companyName
          mobile
          address
          noOfBranches
          allowedmodules
        }
      }
    }
  }
`;
