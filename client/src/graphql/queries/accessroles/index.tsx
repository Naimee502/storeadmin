import { gql } from "@apollo/client";

export const GET_DEPARTMENTS = gql`
  query GetDepartments($deleted: Boolean) {
    getDepartments(deleted: $deleted) {
      id
      name
      status
      staffCount
      createdAt
    }
  }
`;

export const GET_ACCESS_ROLES = gql`
  query GetAccessRoles($deleted: Boolean) {
    getAccessRoles(deleted: $deleted) {
      id
      name
      preset
      status
      staffCount
      createdAt
    }
  }
`;

export const GET_PERMISSION_AUDIT = gql`
  query GetPermissionAudit($limit: Int) {
    getPermissionAudit(limit: $limit) {
      id
      scope
      scopeid
      bytype
      byname
      modules
      createdAt
    }
  }
`;
