import { useMutation, useQuery } from '@apollo/client';
import { ADD_CATEGORY, DELETE_CATEGORY, EDIT_CATEGORY } from '../../mutations/categories';
import { GET_CATEGORIES, GET_CATEGORY_BY_ID } from '../../queries/categories';

export const useCategoryMutations = () => {
  const [addCategoryMutation] = useMutation(ADD_CATEGORY);
  const [editCategoryMutation] = useMutation(EDIT_CATEGORY);
  const [deleteCategoryMutation] = useMutation(DELETE_CATEGORY);

  return { addCategoryMutation, editCategoryMutation, deleteCategoryMutation };
};

export const useCategoriesQuery = () => {
  const { data, loading, error, refetch } = useQuery(GET_CATEGORIES);
  
  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useCategoryByIDQuery = (id: string) => {
  const { data, loading, error } = useQuery(GET_CATEGORY_BY_ID, {
    variables: { id },
    skip: !id,
  });

  return { data, loading, error };
};
