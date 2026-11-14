import { gql } from "@apollo/client";

export const ADD_DEPARTMENT = gql`
  mutation AddDepartment($input: DepartmentInput!) {
    addDepartment(input: $input) { id name status staffCount }
  }
`;
export const EDIT_DEPARTMENT = gql`
  mutation EditDepartment($id: ID!, $input: DepartmentInput!) {
    editDepartment(id: $id, input: $input) { id name status staffCount }
  }
`;
export const DELETE_DEPARTMENT = gql`
  mutation DeleteDepartment($id: ID!) { deleteDepartment(id: $id) }
`;
export const RESET_DEPARTMENT = gql`
  mutation ResetDepartment($id: ID!) { resetDepartment(id: $id) }
`;

export const ADD_ACCESS_ROLE = gql`
  mutation AddAccessRole($input: AccessRoleInput!) {
    addAccessRole(input: $input) { id name preset status staffCount }
  }
`;
export const EDIT_ACCESS_ROLE = gql`
  mutation EditAccessRole($id: ID!, $input: AccessRoleInput!) {
    editAccessRole(id: $id, input: $input) { id name preset status staffCount }
  }
`;
export const DELETE_ACCESS_ROLE = gql`
  mutation DeleteAccessRole($id: ID!) { deleteAccessRole(id: $id) }
`;
export const RESET_ACCESS_ROLE = gql`
  mutation ResetAccessRole($id: ID!) { resetAccessRole(id: $id) }
`;
