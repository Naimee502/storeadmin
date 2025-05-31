import { useMutation, useQuery } from '@apollo/client';
import {
  ADD_SIZE,
  DELETE_SIZE,
  EDIT_SIZE,
  RESET_SIZE,       
} from '../../mutations/sizes';
import {
  GET_SIZES,
  GET_SIZE_BY_ID,
  GET_DELETED_SIZES,  
} from '../../queries/sizes';

export const useSizeMutations = () => {
  const [addSizeMutation] = useMutation(ADD_SIZE);
  const [editSizeMutation] = useMutation(EDIT_SIZE);
  const [deleteSizeMutation] = useMutation(DELETE_SIZE);
  const [resetSizeMutation] = useMutation(RESET_SIZE);  

  return {
    addSizeMutation,
    editSizeMutation,
    deleteSizeMutation,
    resetSizeMutation,    
  };
};

export const useSizesQuery = () => {
  const { data, loading, error, refetch } = useQuery(GET_SIZES);
  return { data, loading, error, refetch };
};

export const useDeletedSizesQuery = () => {
  const { data, loading, error, refetch } = useQuery(GET_DELETED_SIZES);
  return { data, loading, error, refetch };
};

export const useSizeByIDQuery = (id: string) => {
  const { data, loading, error } = useQuery(GET_SIZE_BY_ID, {
    variables: { id },
    skip: !id,
  });
  return { data, loading, error };
};
