import { useMutation, useQuery } from '@apollo/client';
import { ADD_PRODUCT, EDIT_PRODUCT, DELETE_PRODUCT, RESET_PRODUCT } from '../../mutations/products';
import { GET_DELETED_PRODUCTS, GET_PRODUCTS, GET_PRODUCT_BY_ID } from '../../queries/products';

export const useProductMutations = () => {
  const [addProductMutation] = useMutation(ADD_PRODUCT);
  const [editProductMutation] = useMutation(EDIT_PRODUCT);
  const [deleteProductMutation] = useMutation(DELETE_PRODUCT);
  const [resetProductMutation] = useMutation(RESET_PRODUCT); 

  return {
    addProductMutation,
    editProductMutation,
    deleteProductMutation,
    resetProductMutation,
  };
};

export const useProductsQuery = () => {
  const { data, loading, error, refetch } = useQuery(GET_PRODUCTS);

  return {
    data,
    loading,
    error,
    refetch
  };
};

export const useDeletedProductsQuery = () => {
  const { data, loading, error, refetch } = useQuery(GET_DELETED_PRODUCTS);

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useProductByIDQuery = (id: string) => {
  const { data, loading, error } = useQuery(GET_PRODUCT_BY_ID, {
    variables: { id },
    skip: !id,
  });

  return { data, loading, error };
};
