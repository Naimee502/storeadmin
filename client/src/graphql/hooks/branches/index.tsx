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
  GET_DELETED_BRANCHES,
} from '../../queries/branches';
import { useAppSelector } from '../../../redux/hooks';

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
