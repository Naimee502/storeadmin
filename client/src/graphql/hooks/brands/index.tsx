import { useCallback, useEffect } from 'react';
import { useApolloClient, useMutation, useQuery } from '@apollo/client';
import {
  ADD_BRAND,
  DELETE_BRAND,
  EDIT_BRAND,
  RESET_BRAND,
} from '../../mutations/brands';
import {
  GET_BRANDS,
  GET_BRANDS_LIST,
  GET_BRANDS_PAGE,
  GET_DELETED_BRANDS,
  GET_BRAND_BY_ID,
} from '../../queries/brands';
import { useAppSelector } from '../../../redux/hooks';

export const useBrandMutations = () => {
  const [addBrandMutation] = useMutation(ADD_BRAND);
  const [editBrandMutation] = useMutation(EDIT_BRAND);
  const [deleteBrandMutation] = useMutation(DELETE_BRAND);
  const [resetBrandMutation] = useMutation(RESET_BRAND);

  return {
    addBrandMutation,
    editBrandMutation,
    deleteBrandMutation,
    resetBrandMutation,
  };
};

export const useBrandsQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_BRANDS, {
    variables: { adminId }, 
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

// Lite list query for the Brands list page (no admin ref).
export const useBrandsListQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_BRANDS_LIST, {
    variables: { adminId },
  });

  return { data, loading, error, refetch };
};

export const useDeletedBrandsQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_BRANDS, {
    variables: { adminId }, // pass adminId optionally
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useBrandByIDQuery = (id: string) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error } = useQuery(GET_BRAND_BY_ID, {
    variables: { id, adminId }, // pass both id and optional adminId
    skip: !id,
  });

  return { data, loading, error };
};

// Brands list page: one server page at a time.
export const useBrandsPageQuery = ({
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

  // Dropdowns elsewhere read the full getBrands list from cache; drop it so they load fresh.
  const dropFullList = useCallback(() => {
    client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'getBrands' });
  }, [client]);
  useEffect(() => {
    dropFullList();
  }, [dropFullList]);

  const { data, loading, error, refetch } = useQuery(GET_BRANDS_PAGE, {
    variables: { adminId, page, pageSize, search, columnFilters },
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  });

  const refetchPage = useCallback(() => {
    dropFullList();
    return refetch();
  }, [dropFullList, refetch]);

  return {
    items: data?.getBrandsPage?.items ?? [],
    total: data?.getBrandsPage?.total ?? 0,
    loading,
    error,
    refetch: refetchPage,
  };
};

// Full Brands list for Export, fetched fresh (the page holds only one page).
export const useBrandsExportList = () => {
  const client = useApolloClient();
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  return useCallback(async (): Promise<any[]> => {
    const { data } = await client.query({ query: GET_BRANDS_LIST, variables: { adminId }, fetchPolicy: 'network-only' });
    return data?.getBrands || [];
  }, [client, adminId]);
};
