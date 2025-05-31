import { useMutation, useQuery } from '@apollo/client';
import {
  ADD_PRODUCTGROUP,
  DELETE_PRODUCTGROUP,
  EDIT_PRODUCTGROUP,
  RESET_PRODUCTGROUP, // add this import
} from '../../mutations/productgroups';
import {
  GET_DELETED_PRODUCTGROUPS,
  GET_PRODUCTGROUPS,
  GET_PRODUCTGROUP_BY_ID,
} from '../../queries/productgroups';

export const useProductGroupMutations = () => {
  const [addProductGroupMutation] = useMutation(ADD_PRODUCTGROUP);
  const [editProductGroupMutation] = useMutation(EDIT_PRODUCTGROUP);
  const [deleteProductGroupMutation] = useMutation(DELETE_PRODUCTGROUP);
  const [resetProductGroupMutation] = useMutation(RESET_PRODUCTGROUP); // new mutation hook

  return {
    addProductGroupMutation,
    editProductGroupMutation,
    deleteProductGroupMutation,
    resetProductGroupMutation, // expose it here
  };
};

export const useProductGroupsQuery = () => {
  const { data, loading, error, refetch } = useQuery(GET_PRODUCTGROUPS);

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useDeletedProductGroupsQuery = () => {
  const { data, loading, error, refetch } = useQuery(GET_DELETED_PRODUCTGROUPS);

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useProductGroupByIDQuery = (id: string) => {
  const { data, loading, error } = useQuery(GET_PRODUCTGROUP_BY_ID, {
    variables: { id },
    skip: !id,
  });

  return { data, loading, error };
};
