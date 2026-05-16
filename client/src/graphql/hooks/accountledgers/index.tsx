import { useMutation, useQuery } from '@apollo/client';
import {
  ADD_ACCOUNTLEDGER,
  EDIT_ACCOUNTLEDGER,
  DELETE_ACCOUNTLEDGER,
  RESET_ACCOUNTLEDGER,
} from '../../mutations/accountledgers';

import {
  GET_ACCOUNTLEDGERS,
  GET_ACCOUNTLEDGER_BY_ID,
  GET_DELETED_ACCOUNTLEDGERS,
} from '../../queries/accountledgers';

import { useAppSelector } from '../../../redux/hooks';

export const useAccountLedgerMutations = () => {
  const [addAccountLedgerMutation] = useMutation(ADD_ACCOUNTLEDGER);
  const [editAccountLedgerMutation] = useMutation(EDIT_ACCOUNTLEDGER);
  const [deleteAccountLedgerMutation] = useMutation(DELETE_ACCOUNTLEDGER);
  const [resetAccountLedgerMutation] = useMutation(RESET_ACCOUNTLEDGER);

  return {
    addAccountLedgerMutation,
    editAccountLedgerMutation,
    deleteAccountLedgerMutation,
    resetAccountLedgerMutation,
  };
};

export const useAccountLedgersQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const branchId =
    type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_ACCOUNTLEDGERS, {
    variables: { adminId },
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useDeletedAccountLedgersQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const branchId =
    type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_ACCOUNTLEDGERS, {
    variables: { adminId },
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useAccountLedgerByIDQuery = (id: string) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const branchId =
    type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  const { data, loading, error } = useQuery(GET_ACCOUNTLEDGER_BY_ID, {
    variables: { id, adminId, branchId },
    skip: !id,
  });

  return { data, loading, error };
};
