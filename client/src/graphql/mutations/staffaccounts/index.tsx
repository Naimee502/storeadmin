import { gql } from '@apollo/client';

export const ADD_STAFF = gql`
  mutation AddStaff($input: StaffAccountInput!) {
    addStaffAccount(input: $input) {
      id
      staffcode
      branchid {
        id
        branchname
      }
      name
      mobile
      email
      password
      profilepicture
      imageurl
      address
      commission
      salary
      target
      role
      status
      accountgroupid {
        id
        accountgroupname
      }
      admin {
        id
        name
        email
      }
      createdAt
      updatedAt
    }
  }
`;


export const EDIT_STAFF = gql`
  mutation EditStaff($id: ID!, $input: StaffAccountInput!) {
    editStaffAccount(id: $id, input: $input) {
      id
      staffcode
      branchid {
        id
        branchname
      }
      name
      mobile
      email
      password
      profilepicture
      imageurl
      address
      commission
      salary
      target
      role
      status
      accountgroupid {
        id
        accountgroupname
      }
      admin {
        id
        name
        email
      }
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_STAFF = gql`
  mutation DeleteStaff($id: ID!) {
    deleteStaffAccount(id: $id)
  }
`;

export const RESET_STAFF = gql`
  mutation ResetStaff($id: ID!) {
    resetStaffAccount(id: $id)
  }
`;

export const LOGIN_STAFF = gql`
  mutation LoginStaff($email: String!, $password: String!) {
    loginStaff(email: $email, password: $password) {
      accessToken
      staff {
        id
        staffcode
        name
        mobile
        email
        role
        status
        branchid {
          id
          branchname
        }
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
          noOfBranches
          allowedmodules
        }
      }
    }
  }
`;
