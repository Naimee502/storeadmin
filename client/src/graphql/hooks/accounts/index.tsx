import { useMemo } from 'react';
import { useMutation, useQuery, type WatchQueryFetchPolicy } from '@apollo/client';
import {
  ADD_ACCOUNT,
  DELETE_ACCOUNT,
  APPROVE_ACCOUNT,
  EDIT_ACCOUNT,
  RESET_ACCOUNT,
} from '../../mutations/accounts';
import {
  GET_ACCOUNTS,
  GET_ACCOUNT_BY_ID,
  GET_PARTY_OUTSTANDING_SUMMARY,
} from '../../queries/accounts';
import { useAppSelector } from '../../../redux/hooks';

export const useAccountMutations = () => {
  const [addAccountMutation] = useMutation(ADD_ACCOUNT);
  const [editAccountMutation] = useMutation(EDIT_ACCOUNT);
  const [deleteAccountMutation] = useMutation(DELETE_ACCOUNT);
  const [approveAccountMutation] = useMutation(APPROVE_ACCOUNT);
  const [resetAccountMutation] = useMutation(RESET_ACCOUNT);

  return {
    addAccountMutation,
    editAccountMutation,
    deleteAccountMutation,
    approveAccountMutation,
    resetAccountMutation,
  };
};

/** @param fetchPolicy "cache-and-network" where a party may have just been created. */
export const useAccountsQuery = (status: boolean = true, fetchPolicy?: WatchQueryFetchPolicy) => {
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
    fetchPolicy,
  });

  return { data, loading, error, refetch };
};

/**
 * What each party still owes, keyed by account id — the party list's
 * Outstanding column.
 *
 * `status` mirrors `useAccountsQuery`: true for the live list, false for the
 * Deleted Entries view, so each screen gets figures for the rows it shows.
 * Kept out of GET_ACCOUNTS on purpose — the figures walk every invoice,
 * payment, journal and return, so only the screens that print them pay for it.
 */
export const usePartyOutstandingSummaryQuery = (status: boolean = true) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_PARTY_OUTSTANDING_SUMMARY, {
    variables: { filter: { admin: adminId, status } },
    skip: !adminId,
    fetchPolicy: 'cache-and-network',
  });

  const outstandingById = useMemo(() => {
    const map: Record<string, number> = {};
    (data?.getPartyOutstandingSummary || []).forEach((row: any) => {
      if (row?.id) map[row.id] = Number(row.outstanding) || 0;
    });
    return map;
  }, [data]);

  return { outstandingById, loading, error, refetch };
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
