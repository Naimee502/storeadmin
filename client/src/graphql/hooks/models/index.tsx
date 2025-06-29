import { useMutation, useQuery } from '@apollo/client';

import {
  ADD_MODEL,
  DELETE_MODEL,
  EDIT_MODEL,
  RESET_MODEL,
} from '../../mutations/models';
import {
  GET_MODELS,
  GET_MODEL_BY_ID,
  GET_DELETED_MODELS,
} from '../../queries/models';
import { useAppSelector } from '../../../redux/hooks';

export const useModelMutations = () => {
  const [addModelMutation] = useMutation(ADD_MODEL);
  const [editModelMutation] = useMutation(EDIT_MODEL);
  const [deleteModelMutation] = useMutation(DELETE_MODEL);
  const [resetModelMutation] = useMutation(RESET_MODEL);

  return {
    addModelMutation,
    editModelMutation,
    deleteModelMutation,
    resetModelMutation,
  };
};

export const useModelsQuery = () => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_MODELS, {
    variables: { adminId },
    skip: !adminId,
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useDeletedModelsQuery = () => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_MODELS, {
    variables: { adminId },
    skip: !adminId,
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useModelByIDQuery = (id: string) => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : undefined;

  const { data, loading, error } = useQuery(GET_MODEL_BY_ID, {
    variables: { id, adminId },
    skip: !id || !adminId,
  });

  return { data, loading, error };
};
