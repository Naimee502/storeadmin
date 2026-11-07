import { useCallback, useEffect } from 'react';
import { useApolloClient, useMutation, useQuery } from '@apollo/client';
import {
  ADD_ACCOUNTGROUP,
  DELETE_ACCOUNTGROUP,
  EDIT_ACCOUNTGROUP,
  RESET_ACCOUNTGROUP,
} from '../../mutations/accountgroups';
import {
  GET_ACCOUNTGROUPS,
  GET_ACCOUNTGROUPS_LIST,
  GET_ACCOUNTGROUPS_PAGE,
  GET_ACCOUNTGROUP_BY_ID,
  GET_DELETED_ACCOUNTGROUPS,
} from '../../queries/accountgroups';
import { useAppSelector } from '../../../redux/hooks';

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
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_ACCOUNTGROUPS, {
    variables: { adminId },
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

// Lite list (Account Groups page, Account Ledgers group picker) — same filter
// as useAccountGroupsQuery, fewer fields.
export const useAccountGroupsListQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_ACCOUNTGROUPS_LIST, {
    variables: { adminId },
  });

  return { data, loading, error, refetch };
};

export const useDeletedAccountGroupsQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_ACCOUNTGROUPS, {
    variables: { adminId },
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useAccountGroupByIDQuery = (id: string) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error } = useQuery(GET_ACCOUNTGROUP_BY_ID, {
    variables: { id, adminId },
    skip: !id,
  });

  return { data, loading, error };
};

// Account Groups list page: one server page at a time.
export const useAccountGroupsPageQuery = ({
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

  // Dropdowns elsewhere read the full getAccountGroups list from cache; drop it so they load fresh.
  const dropFullList = useCallback(() => {
    client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'getAccountGroups' });
  }, [client]);
  useEffect(() => {
    dropFullList();
  }, [dropFullList]);

  const { data, loading, error, refetch } = useQuery(GET_ACCOUNTGROUPS_PAGE, {
    variables: { adminId, page, pageSize, search, columnFilters },
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  });

  const refetchPage = useCallback(() => {
    dropFullList();
    return refetch();
  }, [dropFullList, refetch]);

  return {
    items: data?.getAccountGroupsPage?.items ?? [],
    total: data?.getAccountGroupsPage?.total ?? 0,
    loading,
    error,
    refetch: refetchPage,
  };
};

// Full Account Groups list for Export, fetched fresh (the page holds only one page).
export const useAccountGroupsExportList = () => {
  const client = useApolloClient();
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  return useCallback(async (): Promise<any[]> => {
    const { data } = await client.query({ query: GET_ACCOUNTGROUPS_LIST, variables: { adminId }, fetchPolicy: 'network-only' });
    return data?.getAccountGroups || [];
  }, [client, adminId]);
};
