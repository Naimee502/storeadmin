import { useMutation, useQuery } from '@apollo/client';
import {
  ADD_PRODUCTGROUP,
  DELETE_PRODUCTGROUP,
  EDIT_PRODUCTGROUP,
  RESET_PRODUCTGROUP,
} from '../../mutations/productgroups';
import {
  GET_DELETED_PRODUCTGROUPS,
  GET_PRODUCTGROUPS,
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
  const adminId = useAppSelector((state) => state.auth.admin?.id);

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

export const useDeletedProductGroupsQuery = () => {
  const adminId = useAppSelector((state) => state.auth.admin?.id);

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
  const adminId = useAppSelector((state) => state.auth.admin?.id);

  const { data, loading, error } = useQuery(GET_PRODUCTGROUP_BY_ID, {
    variables: { id, adminId },
    skip: !id,
  });

  return { data, loading, error };
};
