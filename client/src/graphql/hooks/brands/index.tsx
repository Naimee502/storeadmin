import { useMutation, useQuery } from '@apollo/client';
import {
  ADD_BRAND,
  DELETE_BRAND,
  EDIT_BRAND,
  RESET_BRAND,
} from '../../mutations/brands';
import {
  GET_BRANDS,
  GET_DELETED_BRANDS,
  GET_BRAND_BY_ID,
} from '../../queries/brands';
import { useAppSelector } from '../../../redux/hooks';

export const useBrandMutations = () => {
  const [addBrandMutation] = useMutation(ADD_BRAND);
  const [editBrandMutation] = useMutation(EDIT_BRAND);
  const [deleteBrandMutation] = useMutation(DELETE_BRAND);
  const [resetBrandMutation] = useMutation(RESET_BRAND);

  return {
    addBrandMutation,
    editBrandMutation,
    deleteBrandMutation,
    resetBrandMutation,
  };
};

export const useBrandsQuery = () => {
  const adminId = useAppSelector((state) => state.auth.admin?.id);

  const { data, loading, error, refetch } = useQuery(GET_BRANDS, {
    variables: { adminId }, 
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useDeletedBrandsQuery = () => {
  const adminId = useAppSelector((state) => state.auth.admin?.id);

  const { data, loading, error, refetch } = useQuery(GET_DELETED_BRANDS, {
    variables: { adminId }, // pass adminId optionally
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useBrandByIDQuery = (id: string) => {
  const adminId = useAppSelector((state) => state.auth.admin?.id);

  const { data, loading, error } = useQuery(GET_BRAND_BY_ID, {
    variables: { id, adminId }, // pass both id and optional adminId
    skip: !id,
  });

  return { data, loading, error };
};
