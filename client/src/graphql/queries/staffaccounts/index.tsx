import { gql } from '@apollo/client';

export const GET_STAFF = gql`
  query GetStaff($filter: StaffFilterInput) {
    getStaffAccounts(filter: $filter) {
      id
      staffcode
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
      ledgerid {
        id
        ledgername
      }
      branchid {
        id
        branchname
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

export const GET_DELETED_STAFF = gql`
  query GetDeletedStaff($filter: StaffFilterInput) {
    getDeletedStaffAccounts(filter: $filter) {
      id
      staffcode
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
      ledgerid {
        id
        ledgername
      }
      branchid {
        id
        branchname
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


export const GET_STAFF_BY_ID = gql`
  query GetStaffById($id: ID!, $adminId: ID) {
    getStaffAccountById(id: $id, adminId: $adminId) {
      id
      staffcode
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
      ledgerid {
        id
        ledgername
      }
      branchid {
        id
        branchname
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

