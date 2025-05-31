import { useMutation, useQuery } from '@apollo/client';
import {
  ADD_SALESMAN,
  EDIT_SALESMAN,
  DELETE_SALESMAN,
  RESET_SALESMAN,
} from '../../mutations/salesmenaccount';

import {
  GET_SALESMEN,
  GET_SALESMAN_BY_ID,
  GET_DELETED_SALESMEN,
} from '../../queries/salesmenaccount';

export const useSalesmanMutations = () => {
  const [addSalesmanMutation] = useMutation(ADD_SALESMAN);
  const [editSalesmanMutation] = useMutation(EDIT_SALESMAN);
  const [deleteSalesmanMutation] = useMutation(DELETE_SALESMAN);
  const [resetSalesmanMutation] = useMutation(RESET_SALESMAN);

  return {
    addSalesmanMutation,
    editSalesmanMutation,
    deleteSalesmanMutation,
    resetSalesmanMutation, // ✅ new mutation
  };
};

export const useSalesmenQuery = () => {
  const { data, loading, error, refetch } = useQuery(GET_SALESMEN);
  return { data, loading, error, refetch };
};

export const useDeletedSalesmenQuery = () => {
  const { data, loading, error, refetch } = useQuery(GET_DELETED_SALESMEN);
  return { data, loading, error, refetch };
};

export const useSalesmanByIDQuery = (id: string) => {
  const { data, loading, error } = useQuery(GET_SALESMAN_BY_ID, {
    variables: { id },
    skip: !id,
  });
  return { data, loading, error };
};

