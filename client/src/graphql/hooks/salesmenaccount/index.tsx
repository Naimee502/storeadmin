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

import { useAppSelector } from '../../../redux/hooks';

export const useSalesmanMutations = () => {
  const [addSalesmanMutation] = useMutation(ADD_SALESMAN);
  const [editSalesmanMutation] = useMutation(EDIT_SALESMAN);
  const [deleteSalesmanMutation] = useMutation(DELETE_SALESMAN);
  const [resetSalesmanMutation] = useMutation(RESET_SALESMAN);

  return {
    addSalesmanMutation,
    editSalesmanMutation,
    deleteSalesmanMutation,
    resetSalesmanMutation,
  };
};

export const useSalesmenQuery = () => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const branchid =
    type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : undefined;

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_SALESMEN, {
    variables: { branchid, adminId },
    skip: !adminId,
  });

  return { data, loading, error, refetch };
};

export const useDeletedSalesmenQuery = () => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const branchid =
    type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : undefined;

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_SALESMEN, {
    variables: { branchid, adminId },
    skip: !adminId,
  });

  return { data, loading, error, refetch };
};

export const useSalesmanByIDQuery = (id: string) => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : undefined;

  const { data, loading, error } = useQuery(GET_SALESMAN_BY_ID, {
    variables: { id, adminId },
    skip: !id || !adminId,
  });

  return { data, loading, error };
};
