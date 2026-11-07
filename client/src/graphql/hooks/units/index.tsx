import { useCallback, useEffect } from 'react';
import { useApolloClient, useMutation, useQuery } from '@apollo/client';
import {
  ADD_UNIT,
  DELETE_UNIT,
  EDIT_UNIT,
  RESET_UNIT,
} from '../../mutations/units';
import {
  GET_UNITS,
  GET_UNITS_LIST,
  GET_UNITS_PAGE,
  GET_UNIT_BY_ID,
  GET_DELETED_UNITS,
} from '../../queries/units';
import { useAppSelector } from '../../../redux/hooks';

export const useUnitMutations = () => {
  const [addUnitMutation] = useMutation(ADD_UNIT);
  const [editUnitMutation] = useMutation(EDIT_UNIT);
  const [deleteUnitMutation] = useMutation(DELETE_UNIT);
  const [resetUnitMutation] = useMutation(RESET_UNIT);

  return {
    addUnitMutation,
    editUnitMutation,
    deleteUnitMutation,
    resetUnitMutation,
  };
};

export const useUnitsQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_UNITS, {
    variables: { adminId },
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

// Lite variant for the Units list page (no admin sub-object).
export const useUnitsListQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_UNITS_LIST, {
    variables: { adminId },
  });

  return { data, loading, error, refetch };
};

export const useDeletedUnitsQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_UNITS, {
    variables: { adminId },
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useUnitByIDQuery = (id: string) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error } = useQuery(GET_UNIT_BY_ID, {
    variables: { id, adminId },
    skip: !id,
  });

  return { data, loading, error };
};

// Units list page: one server page at a time.
export const useUnitsPageQuery = ({
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

  // Dropdowns elsewhere read the full getUnits list from cache; drop it so they load fresh.
  const dropFullList = useCallback(() => {
    client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'getUnits' });
  }, [client]);
  useEffect(() => {
    dropFullList();
  }, [dropFullList]);

  const { data, loading, error, refetch } = useQuery(GET_UNITS_PAGE, {
    variables: { adminId, page, pageSize, search, columnFilters },
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  });

  const refetchPage = useCallback(() => {
    dropFullList();
    return refetch();
  }, [dropFullList, refetch]);

  return {
    items: data?.getUnitsPage?.items ?? [],
    total: data?.getUnitsPage?.total ?? 0,
    loading,
    error,
    refetch: refetchPage,
  };
};

// Full Units list for Export, fetched fresh (the page holds only one page).
export const useUnitsExportList = () => {
  const client = useApolloClient();
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  return useCallback(async (): Promise<any[]> => {
    const { data } = await client.query({ query: GET_UNITS_LIST, variables: { adminId }, fetchPolicy: 'network-only' });
    return data?.getUnits || [];
  }, [client, adminId]);
};
