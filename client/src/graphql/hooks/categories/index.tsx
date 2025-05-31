import { useMutation, useQuery } from '@apollo/client';
import { 
  ADD_CATEGORY, 
  DELETE_CATEGORY, 
  EDIT_CATEGORY, 
  RESET_CATEGORY // import reset mutation
} from '../../mutations/categories';
import { 
  GET_CATEGORIES, 
  GET_CATEGORY_BY_ID, 
  GET_DELETED_CATEGORIES // import deleted categories query
} from '../../queries/categories';

export const useCategoryMutations = () => {
  const [addCategoryMutation] = useMutation(ADD_CATEGORY);
  const [editCategoryMutation] = useMutation(EDIT_CATEGORY);
  const [deleteCategoryMutation] = useMutation(DELETE_CATEGORY);
  const [resetCategoryMutation] = useMutation(RESET_CATEGORY); // added reset mutation

  return { addCategoryMutation, editCategoryMutation, deleteCategoryMutation, resetCategoryMutation };
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

export const useDeletedCategoriesQuery = () => {
  const { data, loading, error, refetch } = useQuery(GET_DELETED_CATEGORIES);

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

