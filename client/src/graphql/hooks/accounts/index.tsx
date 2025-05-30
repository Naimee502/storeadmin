import { useMutation, useQuery } from '@apollo/client';
import {
  ADD_ACCOUNT,
  DELETE_ACCOUNT,
  EDIT_ACCOUNT,
  RESET_ACCOUNT,
} from '../../mutations/accounts';
import {
  GET_ACCOUNTS,
  GET_ACCOUNT_BY_ID,
  GET_DELETED_ACCOUNTS,
} from '../../queries/accounts';

// ✅ Mutations: Add, Edit, Delete, Reset
export const useAccountMutations = () => {
  const [addAccountMutation] = useMutation(ADD_ACCOUNT);
  const [editAccountMutation] = useMutation(EDIT_ACCOUNT);
  const [deleteAccountMutation] = useMutation(DELETE_ACCOUNT);
  const [resetAccountMutation] = useMutation(RESET_ACCOUNT);

  return {
    addAccountMutation,
    editAccountMutation,
    deleteAccountMutation,
    resetAccountMutation,
  };
};

// ✅ Active accounts query
export const useAccountsQuery = () => {
  const { data, loading, error, refetch } = useQuery(GET_ACCOUNTS);

  return {
    data,
    loading,
    error,
    refetch,
  };
};

// ✅ Deleted accounts query
export const useDeletedAccountsQuery = () => {
  const { data, loading, error, refetch } = useQuery(GET_DELETED_ACCOUNTS);

  return {
    data,
    loading,
    error,
    refetch,
  };
};

// ✅ Single account by ID
export const useAccountByIDQuery = (id: string) => {
  const { data, loading, error } = useQuery(GET_ACCOUNT_BY_ID, {
    variables: { id },
    skip: !id,
  });

  return { data, loading, error };
};
