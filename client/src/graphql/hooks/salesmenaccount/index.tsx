import { useMutation, useQuery } from '@apollo/client';
import {
  ADD_SALESMAN,
  EDIT_SALESMAN,
  DELETE_SALESMAN,
} from '../../mutations/salesmenaccount';

import {
  GET_SALESMEN,
  GET_SALESMAN_BY_ID,
} from '../../queries/salesmenaccount';

export const useSalesmanMutations = () => {
  const [addSalesmanMutation] = useMutation(ADD_SALESMAN);
  const [editSalesmanMutation] = useMutation(EDIT_SALESMAN);
  const [deleteSalesmanMutation] = useMutation(DELETE_SALESMAN);

  return {
    addSalesmanMutation,
    editSalesmanMutation,
    deleteSalesmanMutation,
  };
};

export const useSalesmenQuery = () => {
  const { data, loading, error, refetch } = useQuery(GET_SALESMEN);

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useSalesmanByIDQuery = (id: string) => {
  const { data, loading, error } = useQuery(GET_SALESMAN_BY_ID, {
    variables: { id },
    skip: !id,
  });

  return { data, loading, error };
};
