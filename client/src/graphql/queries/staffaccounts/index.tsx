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

// Staff Accounts list page: grid + inline-form fields; view page loads by id.
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

// One page of the Staff Accounts list page: same fields as GET_STAFF_LIST.
export const GET_STAFF_PAGE = gql`
  query GetStaffPage(
    $filter: StaffFilterInput
    $page: Int
    $pageSize: Int
    $search: String
    $columnFilters: [ColumnFilter!]
  ) {
    getStaffAccountsPage(filter: $filter, page: $page, pageSize: $pageSize, search: $search, columnFilters: $columnFilters) {
      total
      items {
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

