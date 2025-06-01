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

export const useAccountsQuery = (branchid?: string) => {
  const { data, loading, error, refetch } = useQuery(GET_ACCOUNTS, {
    variables: { branchid },
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useDeletedAccountsQuery = (branchid?: string) => {
  const { data, loading, error, refetch } = useQuery(GET_DELETED_ACCOUNTS, {
    variables: { branchid },
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useAccountByIDQuery = (id: string) => {
  const { data, loading, error } = useQuery(GET_ACCOUNT_BY_ID, {
    variables: { id },
    skip: !id,
  });

  return { data, loading, error };
};
