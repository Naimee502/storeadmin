import { gql } from "apollo-server-express";

export const accessRoleTypeDefs = gql`
  type Department {
    id: ID!
    adminid: ID!
    name: String!
    status: Boolean!
    staffCount: Int
    createdAt: String
  }

  type AccessRole {
    id: ID!
    adminid: ID!
    name: String!
    "Preset it was made from (manager, billing, salesman, storekeeper, technician, accountant)."
    preset: String
    status: Boolean!
    staffCount: Int
    createdAt: String
  }

  type PermissionAuditEntry {
    id: ID!
    scope: String!
    scopeid: ID!
    bytype: String
    byname: String
    modules: [String!]!
    createdAt: String
  }

  input DepartmentInput {
    name: String!
  }

  input AccessRoleInput {
    name: String!
    preset: String
  }

  extend type Query {
    "Deleted ones when deleted is true."
    getDepartments(deleted: Boolean): [Department!]!
    getAccessRoles(deleted: Boolean): [AccessRole!]!
    getPermissionAudit(limit: Int): [PermissionAuditEntry!]!
  }

  extend type Mutation {
    addDepartment(input: DepartmentInput!): Department!
    editDepartment(id: ID!, input: DepartmentInput!): Department!
    deleteDepartment(id: ID!): Boolean!
    resetDepartment(id: ID!): Boolean!
    addAccessRole(input: AccessRoleInput!): AccessRole!
    editAccessRole(id: ID!, input: AccessRoleInput!): AccessRole!
    deleteAccessRole(id: ID!): Boolean!
    resetAccessRole(id: ID!): Boolean!
  }
`;
