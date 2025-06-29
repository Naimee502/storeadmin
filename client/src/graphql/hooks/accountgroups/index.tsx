import { useMutation, useQuery } from '@apollo/client';
import {
  ADD_ACCOUNTGROUP,
  DELETE_ACCOUNTGROUP,
  EDIT_ACCOUNTGROUP,
  RESET_ACCOUNTGROUP,
} from '../../mutations/accountgroups';
import {
  GET_ACCOUNTGROUPS,
  GET_ACCOUNTGROUP_BY_ID,
  GET_DELETED_ACCOUNTGROUPS,
} from '../../queries/accountgroups';
import { useAppSelector } from '../../../redux/hooks';

export const useAccountGroupMutations = () => {
  const [addAccountGroupMutation] = useMutation(ADD_ACCOUNTGROUP);
  const [editAccountGroupMutation] = useMutation(EDIT_ACCOUNTGROUP);
  const [deleteAccountGroupMutation] = useMutation(DELETE_ACCOUNTGROUP);
  const [resetAccountGroupMutation] = useMutation(RESET_ACCOUNTGROUP);

  return {
    addAccountGroupMutation,
    editAccountGroupMutation,
    deleteAccountGroupMutation,
    resetAccountGroupMutation,
  };
};

export const useAccountGroupsQuery = () => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_ACCOUNTGROUPS, {
    variables: { adminId },
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useDeletedAccountGroupsQuery = () => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_ACCOUNTGROUPS, {
    variables: { adminId },
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useAccountGroupByIDQuery = (id: string) => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : undefined;

  const { data, loading, error } = useQuery(GET_ACCOUNTGROUP_BY_ID, {
    variables: { id, adminId },
    skip: !id,
  });

  return { data, loading, error };
};
