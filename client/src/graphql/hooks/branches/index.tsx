import { useMutation, useQuery } from '@apollo/client';
import {
  ADD_BRANCH,
  DELETE_BRANCH,
  EDIT_BRANCH,
  RESET_BRANCH,
} from '../../mutations/branches';
import {
  GET_BRANCH_BY_ID,
  GET_BRANCHES,
  GET_BRANCHES_LIST,
  GET_BRANCHES_PAGE,
  GET_DELETED_BRANCHES,
} from '../../queries/branches';
import { LOGIN_BRANCH } from '../../mutations/branches';
import { useAppSelector } from '../../../redux/hooks';

export const useLoginBranchMutation = () => useMutation(LOGIN_BRANCH);

export const useBranchMutations = () => {
  const [addBranchMutation] = useMutation(ADD_BRANCH);
  const [editBranchMutation] = useMutation(EDIT_BRANCH);
  const [deleteBranchMutation] = useMutation(DELETE_BRANCH);
  const [resetBranchMutation] = useMutation(RESET_BRANCH);

  return {
    addBranchMutation,
    editBranchMutation,
    deleteBranchMutation,
    resetBranchMutation,
  };
};

export const useBranchesQuery = () => {
  const adminId = useAppSelector((state) => state.auth.admin?.id);

  const { data, loading, error, refetch } = useQuery(GET_BRANCHES, {
    variables: adminId ? { adminId } : {},
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

// Lite list (Branches page) — same filter as useBranchesQuery, fewer fields.
export const useBranchesListQuery = () => {
  const adminId = useAppSelector((state) => state.auth.admin?.id);

  const { data, loading, error, refetch } = useQuery(GET_BRANCHES_LIST, {
    variables: adminId ? { adminId } : {},
  });

  return { data, loading, error, refetch };
};

/** Branches list page: one server page; `listVariables` lets Export fetch all rows. */
export const useBranchesPageQuery = ({
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
  const adminId = useAppSelector((state) => state.auth.admin?.id);
  const listVariables = adminId ? { adminId } : {};

  const { data, loading, error, refetch } = useQuery(GET_BRANCHES_PAGE, {
    variables: { ...listVariables, page, pageSize, search, columnFilters },
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  });

  return {
    items: data?.getBranchesPage?.items ?? [],
    total: data?.getBranchesPage?.total ?? 0,
    loading,
    error,
    refetch,
    listVariables,
  };
};

export const useDeletedBranchesQuery = () => {
  const adminId = useAppSelector((state) => state.auth.admin?.id);

  const { data, loading, error, refetch } = useQuery(GET_DELETED_BRANCHES, {
    variables: adminId ? { adminId } : {},
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useBranchByIDQuery = (id: string) => {
  const adminId = useAppSelector((state) => state.auth.admin?.id);

  const { data, loading, error } = useQuery(GET_BRANCH_BY_ID, {
    variables: adminId ? { id, adminId } : { id },
    skip: !id,
  });

  return { data, loading, error };
};
