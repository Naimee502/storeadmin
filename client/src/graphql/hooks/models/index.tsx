import { useCallback, useEffect } from 'react';
import { useApolloClient, useMutation, useQuery } from '@apollo/client';

import {
  ADD_MODEL,
  DELETE_MODEL,
  EDIT_MODEL,
  RESET_MODEL,
} from '../../mutations/models';
import {
  GET_MODELS,
  GET_MODELS_LIST,
  GET_MODELS_PAGE,
  GET_MODEL_BY_ID,
  GET_DELETED_MODELS,
} from '../../queries/models';
import { useAppSelector } from '../../../redux/hooks';

export const useModelMutations = () => {
  const [addModelMutation] = useMutation(ADD_MODEL);
  const [editModelMutation] = useMutation(EDIT_MODEL);
  const [deleteModelMutation] = useMutation(DELETE_MODEL);
  const [resetModelMutation] = useMutation(RESET_MODEL);

  return {
    addModelMutation,
    editModelMutation,
    deleteModelMutation,
    resetModelMutation,
  };
};

export const useModelsQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_MODELS, {
    variables: { adminId },
    skip: !adminId,
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

// Lite list query for the Models list page (no admin ref).
export const useModelsListQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_MODELS_LIST, {
    variables: { adminId },
    skip: !adminId,
  });

  return { data, loading, error, refetch };
};

export const useDeletedModelsQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_MODELS, {
    variables: { adminId },
    skip: !adminId,
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useModelByIDQuery = (id: string) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error } = useQuery(GET_MODEL_BY_ID, {
    variables: { id, adminId },
    skip: !id || !adminId,
  });

  return { data, loading, error };
};

// Models list page: one server page at a time.
export const useModelsPageQuery = ({
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

  // Dropdowns elsewhere read the full getModels list from cache; drop it so they load fresh.
  const dropFullList = useCallback(() => {
    client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'getModels' });
  }, [client]);
  useEffect(() => {
    dropFullList();
  }, [dropFullList]);

  const { data, loading, error, refetch } = useQuery(GET_MODELS_PAGE, {
    variables: { adminId, page, pageSize, search, columnFilters },
    skip: !adminId,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  });

  const refetchPage = useCallback(() => {
    dropFullList();
    return refetch();
  }, [dropFullList, refetch]);

  return {
    items: data?.getModelsPage?.items ?? [],
    total: data?.getModelsPage?.total ?? 0,
    loading,
    error,
    refetch: refetchPage,
  };
};

// Full Models list for Export, fetched fresh (the page holds only one page).
export const useModelsExportList = () => {
  const client = useApolloClient();
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  return useCallback(async (): Promise<any[]> => {
    if (!adminId) return [];
    const { data } = await client.query({ query: GET_MODELS_LIST, variables: { adminId }, fetchPolicy: 'network-only' });
    return data?.getModels || [];
  }, [client, adminId]);
};
