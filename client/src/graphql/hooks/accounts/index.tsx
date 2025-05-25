// src/hooks/accounts.ts
import { useMutation, useQuery } from '@apollo/client';
import {
  ADD_ACCOUNT,
  DELETE_ACCOUNT,
  EDIT_ACCOUNT,
} from '../../mutations/accounts';
import {
  GET_ACCOUNTS,
  GET_ACCOUNT_BY_ID,
} from '../../queries/accounts';

export const useAccountMutations = () => {
  const [addAccountMutation] = useMutation(ADD_ACCOUNT);
  const [editAccountMutation] = useMutation(EDIT_ACCOUNT);
  const [deleteAccountMutation] = useMutation(DELETE_ACCOUNT);

  return {
    addAccountMutation,
    editAccountMutation,
    deleteAccountMutation,
  };
};

export const useAccountsQuery = () => {
  const { data, loading, error, refetch } = useQuery(GET_ACCOUNTS);

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
