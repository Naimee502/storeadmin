import { useMutation, useQuery } from '@apollo/client';
import { ADD_MODEL, DELETE_MODEL, EDIT_MODEL, RESET_MODEL } from '../../mutations/models';
import { GET_MODELS, GET_MODEL_BY_ID, GET_DELETED_MODELS } from '../../queries/models';

export const useModelMutations = () => {
  const [addModelMutation] = useMutation(ADD_MODEL);
  const [editModelMutation] = useMutation(EDIT_MODEL);
  const [deleteModelMutation] = useMutation(DELETE_MODEL);
  const [resetModelMutation] = useMutation(RESET_MODEL);

  return { addModelMutation, editModelMutation, deleteModelMutation, resetModelMutation };
};

export const useModelsQuery = () => {
  const { data, loading, error, refetch } = useQuery(GET_MODELS);

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useDeletedModelsQuery = () => {
  const { data, loading, error, refetch } = useQuery(GET_DELETED_MODELS);

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useModelByIDQuery = (id: string) => {
  const { data, loading, error } = useQuery(GET_MODEL_BY_ID, {
    variables: { id },
    skip: !id,
  });

  return { data, loading, error };
};


