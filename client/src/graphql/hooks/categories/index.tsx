import { useMutation, useQuery } from '@apollo/client';
import {
  ADD_CATEGORY,
  DELETE_CATEGORY,
  EDIT_CATEGORY,
  RESET_CATEGORY,
} from '../../mutations/categories';
import {
  GET_CATEGORIES,
  GET_CATEGORY_BY_ID,
  GET_DELETED_CATEGORIES,
} from '../../queries/categories';

import { useAppSelector } from '../../../redux/hooks';

export const useCategoryMutations = () => {
  const [addCategoryMutation] = useMutation(ADD_CATEGORY);
  const [editCategoryMutation] = useMutation(EDIT_CATEGORY);
  const [deleteCategoryMutation] = useMutation(DELETE_CATEGORY);
  const [resetCategoryMutation] = useMutation(RESET_CATEGORY);

  return {
    addCategoryMutation,
    editCategoryMutation,
    deleteCategoryMutation,
    resetCategoryMutation,
  };
};

export const useCategoriesQuery = () => {
  const adminId = useAppSelector((state) => state.auth.admin?.id);

  const { data, loading, error, refetch } = useQuery(GET_CATEGORIES, {
    variables: { adminId },
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useDeletedCategoriesQuery = () => {
  const adminId = useAppSelector((state) => state.auth.admin?.id);

  const { data, loading, error, refetch } = useQuery(GET_DELETED_CATEGORIES, {
    variables: { adminId },
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useCategoryByIDQuery = (id: string) => {
  const adminId = useAppSelector((state) => state.auth.admin?.id);

  const { data, loading, error } = useQuery(GET_CATEGORY_BY_ID, {
    variables: { id, adminId },
    skip: !id,
  });

  return { data, loading, error };
};
