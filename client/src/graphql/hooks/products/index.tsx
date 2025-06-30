import { useMutation, useQuery } from '@apollo/client';
import { ADD_PRODUCT, EDIT_PRODUCT, DELETE_PRODUCT, RESET_PRODUCT } from '../../mutations/products';
import { GET_DELETED_PRODUCTS, GET_PRODUCTS, GET_PRODUCT_BY_ID } from '../../queries/products';
import { useAppSelector } from '../../../redux/hooks';

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
  const { type, admin, branch } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminId = type === 'admin' ? admin?.id : branch?.admin?.id;
  const branchid = type === 'admin' ? selectedBranchId : branch?.id;

  const { data, loading, error, refetch } = useQuery(GET_PRODUCTS, {
    variables: { adminId, branchid },
    skip: !adminId,
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useDeletedProductsQuery = () => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminId = type === 'admin' ? admin?.id : branch?.admin?.id;
  const branchid = type === 'admin' ? selectedBranchId : branch?.id;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_PRODUCTS, {
    variables: { adminId, branchid },
    skip: !adminId,
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useProductByIDQuery = (id: string) => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);

  const adminId = type === 'admin' ? admin?.id : branch?.admin?.id;

  const { data, loading, error } = useQuery(GET_PRODUCT_BY_ID, {
    variables: { id, adminId },
    skip: !id || !adminId,
  });

  return { data, loading, error };
};
