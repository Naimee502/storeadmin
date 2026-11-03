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
      allowedmodules
      assignedChannels {
        id
        channelName
      }
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

// Staff Accounts list page: the grid columns plus everything the inline
// Add/Edit form loads from a row (branch, account group, image, address,
// salary/commission/target, role, status, assigned channels). Password hash,
// allowed modules, ledger and admin are left out — the view page fetches by id.
export const GET_STAFF_LIST = gql`
  query GetStaffList($filter: StaffFilterInput) {
    getStaffAccounts(filter: $filter) {
      id
      staffcode
      name
      mobile
      email
      imageurl
      address
      commission
      salary
      target
      role
      status
      assignedChannels {
        id
        channelName
      }
      accountgroupid {
        id
        accountgroupname
      }
      branchid {
        id
        branchname
      }
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
      allowedmodules
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
      allowedmodules
      assignedChannels {
        id
        channelName
      }
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

