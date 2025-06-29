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
import { useAppSelector } from '../../../redux/hooks';

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
  const { type, admin, branch } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_SIZES, {
    variables: { adminId },
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useDeletedSizesQuery = () => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_SIZES, {
    variables: { adminId },
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useSizeByIDQuery = (id: string) => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : undefined;

  const { data, loading, error } = useQuery(GET_SIZE_BY_ID, {
    variables: { id, adminId },
    skip: !id,
  });

  return { data, loading, error };
};
