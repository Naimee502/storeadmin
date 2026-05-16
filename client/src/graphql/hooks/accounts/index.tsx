import { useMutation, useQuery } from '@apollo/client';
import {
  ADD_ACCOUNT,
  DELETE_ACCOUNT,
  EDIT_ACCOUNT,
  RESET_ACCOUNT,
} from '../../mutations/accounts';
import {
  GET_ACCOUNTS,
  GET_ACCOUNT_BY_ID,
} from '../../queries/accounts';
import { useAppSelector } from '../../../redux/hooks';

export const useAccountMutations = () => {
  const [addAccountMutation] = useMutation(ADD_ACCOUNT);
  const [editAccountMutation] = useMutation(EDIT_ACCOUNT);
  const [deleteAccountMutation] = useMutation(DELETE_ACCOUNT);
  const [resetAccountMutation] = useMutation(RESET_ACCOUNT);

  return {
    addAccountMutation,
    editAccountMutation,
    deleteAccountMutation,
    resetAccountMutation,
  };
};

export const useAccountsQuery = (status: boolean = true) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;
  const branchid =
    type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_ACCOUNTS, {
    variables: {
      filter: {
        admin: adminId,
        status,
      },
    },
    skip: !adminId,
  });

  return { data, loading, error, refetch };
};

export const useDeletedAccountsQuery = () => {
  return useAccountsQuery(false);
};

export const useAccountByIDQuery = (id: string) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error } = useQuery(GET_ACCOUNT_BY_ID, {
    variables: { id, adminId },
    skip: !id || !adminId,
  });

  return { data, loading, error };
};
