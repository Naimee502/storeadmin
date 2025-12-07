import { useMutation, useQuery } from '@apollo/client';
import {
  ADD_STAFF,
  EDIT_STAFF,
  DELETE_STAFF,
  RESET_STAFF,
} from '../../mutations/staffaccounts';

import {
  GET_STAFF,
  GET_STAFF_BY_ID,
  GET_DELETED_STAFF,
} from '../../queries/staffaccounts';

import { useAppSelector } from '../../../redux/hooks';

// ---------------------------------------------
// MUTATIONS
// ---------------------------------------------
export const useStaffMutations = () => {
  const [addStaffMutation] = useMutation(ADD_STAFF);
  const [editStaffMutation] = useMutation(EDIT_STAFF);
  const [deleteStaffMutation] = useMutation(DELETE_STAFF);
  const [resetStaffMutation] = useMutation(RESET_STAFF);

  return {
    addStaffMutation,
    editStaffMutation,
    deleteStaffMutation,
    resetStaffMutation,
  };
};

// ---------------------------------------------
// STAFF LIST QUERY
// ---------------------------------------------
export const useStaffQuery = () => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const branchid =
    type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : undefined;

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_STAFF, {
    variables: { filter: { branchid, adminId } },
    skip: !adminId,
  });

  return { data, loading, error, refetch };
};

// ---------------------------------------------
// DELETED STAFF QUERY
// ---------------------------------------------
export const useDeletedStaffQuery = () => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const branchid =
    type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : undefined;

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_STAFF, {
    variables: { filter: { branchid, adminId } },
    skip: !adminId,
  });

  return { data, loading, error, refetch };
};

// ---------------------------------------------
// GET STAFF BY ID
// ---------------------------------------------
export const useStaffByIDQuery = (id: string) => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : undefined;

  const { data, loading, error } = useQuery(GET_STAFF_BY_ID, {
    variables: { id, adminId },
    skip: !id || !adminId,
  });

  return { data, loading, error };
};
