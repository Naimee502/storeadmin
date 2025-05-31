// src/hooks/accountgroups.ts
import { useMutation, useQuery } from '@apollo/client';
import {
  ADD_ACCOUNTGROUP,
  DELETE_ACCOUNTGROUP,
  EDIT_ACCOUNTGROUP,
  RESET_ACCOUNTGROUP,
} from '../../mutations/accountgroups';
import {
  GET_ACCOUNTGROUPS,
  GET_ACCOUNTGROUP_BY_ID,
  GET_DELETED_ACCOUNTGROUPS,
} from '../../queries/accountgroups';

export const useAccountGroupMutations = () => {
  const [addAccountGroupMutation] = useMutation(ADD_ACCOUNTGROUP);
  const [editAccountGroupMutation] = useMutation(EDIT_ACCOUNTGROUP);
  const [deleteAccountGroupMutation] = useMutation(DELETE_ACCOUNTGROUP);
  const [resetAccountGroupMutation] = useMutation(RESET_ACCOUNTGROUP);

  return {
    addAccountGroupMutation,
    editAccountGroupMutation,
    deleteAccountGroupMutation,
    resetAccountGroupMutation,
  };
};

export const useAccountGroupsQuery = () => {
  const { data, loading, error, refetch } = useQuery(GET_ACCOUNTGROUPS);

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useDeletedAccountGroupsQuery = () => {
  const { data, loading, error, refetch } = useQuery(GET_DELETED_ACCOUNTGROUPS);

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useAccountGroupByIDQuery = (id: string) => {
  const { data, loading, error } = useQuery(GET_ACCOUNTGROUP_BY_ID, {
    variables: { id },
    skip: !id,
  });

  return { data, loading, error };
};
