import { useMutation, useQuery } from '@apollo/client';
import {
  ADD_UNIT,
  DELETE_UNIT,
  EDIT_UNIT,
  RESET_UNIT,
} from '../../mutations/units';
import {
  GET_UNITS,
  GET_UNIT_BY_ID,
  GET_DELETED_UNITS,
} from '../../queries/units';
import { useAppSelector } from '../../../redux/hooks';

export const useUnitMutations = () => {
  const [addUnitMutation] = useMutation(ADD_UNIT);
  const [editUnitMutation] = useMutation(EDIT_UNIT);
  const [deleteUnitMutation] = useMutation(DELETE_UNIT);
  const [resetUnitMutation] = useMutation(RESET_UNIT);

  return {
    addUnitMutation,
    editUnitMutation,
    deleteUnitMutation,
    resetUnitMutation,
  };
};

export const useUnitsQuery = () => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_UNITS, {
    variables: { adminId },
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useDeletedUnitsQuery = () => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_UNITS, {
    variables: { adminId },
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useUnitByIDQuery = (id: string) => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : undefined;

  const { data, loading, error } = useQuery(GET_UNIT_BY_ID, {
    variables: { id, adminId },
    skip: !id,
  });

  return { data, loading, error };
};
