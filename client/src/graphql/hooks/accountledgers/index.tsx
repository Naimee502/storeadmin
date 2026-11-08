import { useCallback, useEffect } from 'react';
import { useApolloClient, useMutation, useQuery, type WatchQueryFetchPolicy } from '@apollo/client';
import {
  ADD_ACCOUNTLEDGER,
  EDIT_ACCOUNTLEDGER,
  DELETE_ACCOUNTLEDGER,
  RESET_ACCOUNTLEDGER,
} from '../../mutations/accountledgers';

import {
  GET_ACCOUNTLEDGERS,
  GET_ACCOUNTLEDGERS_LIST,
  GET_ACCOUNTLEDGERS_PAGE,
  GET_ACCOUNTLEDGER_BY_ID,
  GET_DELETED_ACCOUNTLEDGERS,
} from '../../queries/accountledgers';

import { useAppSelector } from '../../../redux/hooks';

export const useAccountLedgerMutations = () => {
  const [addAccountLedgerMutation] = useMutation(ADD_ACCOUNTLEDGER);
  const [editAccountLedgerMutation] = useMutation(EDIT_ACCOUNTLEDGER);
  const [deleteAccountLedgerMutation] = useMutation(DELETE_ACCOUNTLEDGER);
  const [resetAccountLedgerMutation] = useMutation(RESET_ACCOUNTLEDGER);

  return {
    addAccountLedgerMutation,
    editAccountLedgerMutation,
    deleteAccountLedgerMutation,
    resetAccountLedgerMutation,
  };
};

/** @param fetchPolicy use "cache-and-network" where a ledger may be brand new. */
export const useAccountLedgersQuery = (fetchPolicy?: WatchQueryFetchPolicy) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const branchId =
    type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_ACCOUNTLEDGERS, {
    variables: { adminId },
    fetchPolicy,
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

// Lite list for the Account Ledgers page.
export const useAccountLedgersListQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_ACCOUNTLEDGERS_LIST, {
    variables: { adminId },
  });

  return { data, loading, error, refetch };
};

export const useDeletedAccountLedgersQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const branchId =
    type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_ACCOUNTLEDGERS, {
    variables: { adminId },
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useAccountLedgerByIDQuery = (id: string) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const branchId =
    type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  const { data, loading, error } = useQuery(GET_ACCOUNTLEDGER_BY_ID, {
    variables: { id, adminId, branchId },
    skip: !id,
  });

  return { data, loading, error };
};

// Account Ledgers list page: one server page at a time.
export const useAccountLedgersPageQuery = ({
  page,
  pageSize,
  search,
  columnFilters = [],
}: {
  page: number;
  pageSize: number;
  search: string;
  columnFilters?: { key: string; value: string }[];
}) => {
  const client = useApolloClient();
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  // Dropdowns elsewhere read the full getAccountLedgers list from cache; drop it so they load fresh.
  const dropFullList = useCallback(() => {
    client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'getAccountLedgers' });
  }, [client]);
  useEffect(() => {
    dropFullList();
  }, [dropFullList]);

  const { data, loading, error, refetch } = useQuery(GET_ACCOUNTLEDGERS_PAGE, {
    variables: { adminId, page, pageSize, search, columnFilters },
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  });

  const refetchPage = useCallback(() => {
    dropFullList();
    return refetch();
  }, [dropFullList, refetch]);

  return {
    items: data?.getAccountLedgersPage?.items ?? [],
    total: data?.getAccountLedgersPage?.total ?? 0,
    loading,
    error,
    refetch: refetchPage,
  };
};

