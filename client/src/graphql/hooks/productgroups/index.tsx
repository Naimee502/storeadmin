import { useCallback, useEffect } from 'react';
import { useApolloClient, useMutation, useQuery } from '@apollo/client';
import {
  ADD_PRODUCTGROUP,
  DELETE_PRODUCTGROUP,
  EDIT_PRODUCTGROUP,
  RESET_PRODUCTGROUP,
} from '../../mutations/productgroups';
import {
  GET_DELETED_PRODUCTGROUPS,
  GET_PRODUCTGROUPS,
  GET_PRODUCTGROUPS_LIST,
  GET_PRODUCTGROUPS_PAGE,
  GET_PRODUCTGROUP_BY_ID,
} from '../../queries/productgroups';
import { useAppSelector } from '../../../redux/hooks';

export const useProductGroupMutations = () => {
  const [addProductGroupMutation] = useMutation(ADD_PRODUCTGROUP);
  const [editProductGroupMutation] = useMutation(EDIT_PRODUCTGROUP);
  const [deleteProductGroupMutation] = useMutation(DELETE_PRODUCTGROUP);
  const [resetProductGroupMutation] = useMutation(RESET_PRODUCTGROUP);

  return {
    addProductGroupMutation,
    editProductGroupMutation,
    deleteProductGroupMutation,
    resetProductGroupMutation,
  };
};

export const useProductGroupsQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_PRODUCTGROUPS, {
    variables: { adminId },
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

// Lite variant for the Product Groups list page (no admin sub-object).
export const useProductGroupsListQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_PRODUCTGROUPS_LIST, {
    variables: { adminId },
  });

  return { data, loading, error, refetch };
};

export const useDeletedProductGroupsQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_PRODUCTGROUPS, {
    variables: { adminId },
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useProductGroupByIDQuery = (id: string) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error } = useQuery(GET_PRODUCTGROUP_BY_ID, {
    variables: { id, adminId },
    skip: !id,
  });

  return { data, loading, error };
};

// Product Groups list page: one server page at a time.
export const useProductGroupsPageQuery = ({
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

  // Dropdowns elsewhere read the full getProductGroups list from cache; drop it so they load fresh.
  const dropFullList = useCallback(() => {
    client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'getProductGroups' });
  }, [client]);
  useEffect(() => {
    dropFullList();
  }, [dropFullList]);

  const { data, loading, error, refetch } = useQuery(GET_PRODUCTGROUPS_PAGE, {
    variables: { adminId, page, pageSize, search, columnFilters },
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  });

  const refetchPage = useCallback(() => {
    dropFullList();
    return refetch();
  }, [dropFullList, refetch]);

  return {
    items: data?.getProductGroupsPage?.items ?? [],
    total: data?.getProductGroupsPage?.total ?? 0,
    loading,
    error,
    refetch: refetchPage,
  };
};

// Full Product Groups list for Export, fetched fresh (the page holds only one page).
export const useProductGroupsExportList = () => {
  const client = useApolloClient();
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  return useCallback(async (): Promise<any[]> => {
    const { data } = await client.query({ query: GET_PRODUCTGROUPS_LIST, variables: { adminId }, fetchPolicy: 'network-only' });
    return data?.getProductGroups || [];
  }, [client, adminId]);
};
