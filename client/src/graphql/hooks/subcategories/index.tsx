import { useMutation, useQuery } from '@apollo/client';
import {
  ADD_SUBCATEGORY,
  EDIT_SUBCATEGORY,
  DELETE_SUBCATEGORY,
  RESET_SUBCATEGORY,
} from '../../mutations/subcategories';
import {
  GET_SUBCATEGORIES,
  GET_SUBCATEGORY_BY_ID,
  GET_DELETED_SUBCATEGORIES,
} from '../../queries/subcategories';

import { useAppSelector } from '../../../redux/hooks';

// 🔹 SubCategory Mutations
export const useSubCategoryMutations = () => {
  const [addSubCategoryMutation] = useMutation(ADD_SUBCATEGORY);
  const [editSubCategoryMutation] = useMutation(EDIT_SUBCATEGORY);
  const [deleteSubCategoryMutation] = useMutation(DELETE_SUBCATEGORY);
  const [resetSubCategoryMutation] = useMutation(RESET_SUBCATEGORY);

  return {
    addSubCategoryMutation,
    editSubCategoryMutation,
    deleteSubCategoryMutation,
    resetSubCategoryMutation,
  };
};

// 🔹 Fetch all active SubCategories (optional filter by categoryId)
export const useSubCategoriesQuery = (categoryId?: string) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin'
      ? admin?.id
      : type === 'branch'
      ? branch?.admin?.id
      : type === 'staff'
      ? staff?.admin?.id
      : undefined;

  const { data, loading, error, refetch } = useQuery(GET_SUBCATEGORIES, {
    variables: { adminId, categoryId },
  });

  return { data, loading, error, refetch };
};

// 🔹 Fetch all deleted SubCategories (optional filter by categoryId)
export const useDeletedSubCategoriesQuery = (categoryId?: string) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin'
      ? admin?.id
      : type === 'branch'
      ? branch?.admin?.id
      : type === 'staff'
      ? staff?.admin?.id
      : undefined;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_SUBCATEGORIES, {
    variables: { adminId, categoryId },
  });

  return { data, loading, error, refetch };
};

// 🔹 Fetch a single SubCategory by ID
export const useSubCategoryByIDQuery = (id: string) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin'
      ? admin?.id
      : type === 'branch'
      ? branch?.admin?.id
      : type === 'staff'
      ? staff?.admin?.id
      : undefined;

  const { data, loading, error } = useQuery(GET_SUBCATEGORY_BY_ID, {
    variables: { id, adminId },
    skip: !id,
  });

  return { data, loading, error };
};
