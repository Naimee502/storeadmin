// hooks/useUnits.ts
import { useMutation, useQuery } from '@apollo/client';
import { ADD_UNIT, DELETE_UNIT, EDIT_UNIT } from '../../mutations/units';
import { GET_UNITS, GET_UNIT_BY_ID } from '../../queries/units';

export const useUnitMutations = () => {
  const [addUnitMutation] = useMutation(ADD_UNIT);
  const [editUnitMutation] = useMutation(EDIT_UNIT);
  const [deleteUnitMutation] = useMutation(DELETE_UNIT);

  return { addUnitMutation, editUnitMutation, deleteUnitMutation };
};

export const useUnitsQuery = () => {
  const { data, loading, error, refetch } = useQuery(GET_UNITS);

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useUnitByIDQuery = (id: string) => {
  const { data, loading, error } = useQuery(GET_UNIT_BY_ID, {
    variables: { id },
    skip: !id,
  });

  return { data, loading, error };
};
