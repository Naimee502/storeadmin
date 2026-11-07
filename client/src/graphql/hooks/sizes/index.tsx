import { useCallback, useEffect } from 'react';
import { useApolloClient, useMutation, useQuery } from '@apollo/client';
import {
  ADD_SIZE,
  DELETE_SIZE,
  EDIT_SIZE,
  RESET_SIZE,
} from '../../mutations/sizes';
import {
  GET_SIZES,
  GET_SIZES_LIST,
  GET_SIZES_PAGE,
  GET_SIZE_BY_ID,
  GET_DELETED_SIZES,
} from '../../queries/sizes';
import { useAppSelector } from '../../../redux/hooks';

export const useSizeMutations = () => {
  const [addSizeMutation] = useMutation(ADD_SIZE);
  const [editSizeMutation] = useMutation(EDIT_SIZE);
  const [deleteSizeMutation] = useMutation(DELETE_SIZE);
  const [resetSizeMutation] = useMutation(RESET_SIZE);

  return {
    addSizeMutation,
    editSizeMutation,
    deleteSizeMutation,
    resetSizeMutation,
  };
};

export const useSizesQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_SIZES, {
    variables: { adminId },
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

// Lite list query for the Sizes list page (no admin ref).
export const useSizesListQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_SIZES_LIST, {
    variables: { adminId },
  });

  return { data, loading, error, refetch };
};

export const useDeletedSizesQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_SIZES, {
    variables: { adminId },
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useSizeByIDQuery = (id: string) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error } = useQuery(GET_SIZE_BY_ID, {
    variables: { id, adminId },
    skip: !id,
  });

  return { data, loading, error };
};

// Sizes list page: one server page at a time.
export const useSizesPageQuery = ({
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

  // Dropdowns elsewhere read the full getSizes list from cache; drop it so they load fresh.
  const dropFullList = useCallback(() => {
    client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'getSizes' });
  }, [client]);
  useEffect(() => {
    dropFullList();
  }, [dropFullList]);

  const { data, loading, error, refetch } = useQuery(GET_SIZES_PAGE, {
    variables: { adminId, page, pageSize, search, columnFilters },
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  });

  const refetchPage = useCallback(() => {
    dropFullList();
    return refetch();
  }, [dropFullList, refetch]);

  return {
    items: data?.getSizesPage?.items ?? [],
    total: data?.getSizesPage?.total ?? 0,
    loading,
    error,
    refetch: refetchPage,
  };
};

// Full Sizes list for Export, fetched fresh (the page holds only one page).
export const useSizesExportList = () => {
  const client = useApolloClient();
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  return useCallback(async (): Promise<any[]> => {
    const { data } = await client.query({ query: GET_SIZES_LIST, variables: { adminId }, fetchPolicy: 'network-only' });
    return data?.getSizes || [];
  }, [client, adminId]);
};
