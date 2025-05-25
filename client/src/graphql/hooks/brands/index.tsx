import { useMutation, useQuery } from '@apollo/client';
import { ADD_BRAND, DELETE_BRAND, EDIT_BRAND } from '../../mutations/brands';
import { GET_BRANDS, GET_BRAND_BY_ID } from '../../queries/brands';

export const useBrandMutations = () => {
  const [addBrandMutation] = useMutation(ADD_BRAND);
  const [editBrandMutation] = useMutation(EDIT_BRAND);
  const [deleteBrandMutation] = useMutation(DELETE_BRAND);

  return { addBrandMutation, editBrandMutation, deleteBrandMutation };
};

export const useBrandsQuery = () => {
  const { data, loading, error, refetch } = useQuery(GET_BRANDS);

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useBrandByIDQuery = (id: string) => {
  const { data, loading, error } = useQuery(GET_BRAND_BY_ID, {
    variables: { id },
    skip: !id,
  });

  return { data, loading, error };
};
