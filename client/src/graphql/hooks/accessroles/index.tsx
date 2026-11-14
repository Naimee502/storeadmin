import { useMutation, useQuery } from "@apollo/client";
import { GET_ACCESS_ROLES, GET_DEPARTMENTS, GET_PERMISSION_AUDIT } from "../../queries/accessroles";
import {
  ADD_ACCESS_ROLE, ADD_DEPARTMENT, DELETE_ACCESS_ROLE, DELETE_DEPARTMENT,
  EDIT_ACCESS_ROLE, EDIT_DEPARTMENT, RESET_ACCESS_ROLE, RESET_DEPARTMENT,
} from "../../mutations/accessroles";

export const useDepartmentsQuery = (deleted = false) =>
  useQuery(GET_DEPARTMENTS, { variables: { deleted }, fetchPolicy: "cache-and-network" });

export const useAccessRolesQuery = (deleted = false) =>
  useQuery(GET_ACCESS_ROLES, { variables: { deleted }, fetchPolicy: "cache-and-network" });

export const usePermissionAuditQuery = (limit = 30) =>
  useQuery(GET_PERMISSION_AUDIT, { variables: { limit }, fetchPolicy: "network-only" });

export const useDepartmentMutations = () => {
  const [add] = useMutation(ADD_DEPARTMENT);
  const [edit] = useMutation(EDIT_DEPARTMENT);
  const [remove] = useMutation(DELETE_DEPARTMENT);
  const [reset] = useMutation(RESET_DEPARTMENT);
  return { add, edit, remove, reset };
};

export const useAccessRoleMutations = () => {
  const [add] = useMutation(ADD_ACCESS_ROLE);
  const [edit] = useMutation(EDIT_ACCESS_ROLE);
  const [remove] = useMutation(DELETE_ACCESS_ROLE);
  const [reset] = useMutation(RESET_ACCESS_ROLE);
  return { add, edit, remove, reset };
};
