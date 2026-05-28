import { useQuery, useMutation } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { GET_PRODUCTS, GET_SALES_ORDERS, GET_ACCOUNTS, GET_ACCOUNT, GET_TRANSACTIONS } from '../../queries/accounts';
import { ADD_SALES_ORDER, CANCEL_SALES_ORDER } from '../../mutations/accounts';
import type { RootState } from '../../../store/rootreducer';

export const useProductsQuery = (limit = 100, offset = 0) => {
  const adminId = useSelector((s: RootState) => s.tenant.adminId);
  return useQuery(GET_PRODUCTS, {
    variables: { adminid: adminId, limit, offset },
    skip: !adminId,
    fetchPolicy: 'cache-and-network',
  });
};

export const useSalesOrdersQuery = (partyaccid?: string) => {
  const adminId = useSelector((s: RootState) => s.tenant.adminId);
  const userId  = useSelector((s: RootState) => s.auth.user?.id);
  const role    = useSelector((s: RootState) => s.auth.user?.role);
  const resolvedPartyId = role === 'party' ? userId : partyaccid;
  return useQuery(GET_SALES_ORDERS, {
    variables: { adminid: adminId, partyaccid: resolvedPartyId },
    skip: !adminId,
    fetchPolicy: 'cache-and-network',
  });
};

export const useAccountsQuery = () => {
  const adminId = useSelector((s: RootState) => s.tenant.adminId);
  return useQuery(GET_ACCOUNTS, {
    variables: { admin: adminId },
    skip: !adminId,
    fetchPolicy: 'cache-and-network',
  });
};

export const useAccountQuery = (id: string) => {
  const adminId = useSelector((s: RootState) => s.tenant.adminId);
  return useQuery(GET_ACCOUNT, {
    variables: { id, adminId },
    skip: !id || !adminId,
    fetchPolicy: 'cache-and-network',
  });
};

export const useTransactionsQuery = (ledgerid?: string) => {
  const adminId = useSelector((s: RootState) => s.tenant.adminId);
  return useQuery(GET_TRANSACTIONS, {
    variables: { adminid: adminId, ledgerid },
    skip: !adminId,
    fetchPolicy: 'cache-and-network',
  });
};

export const usePartyMutations = () => {
  const [addSalesOrderMutation]    = useMutation(ADD_SALES_ORDER);
  const [cancelSalesOrderMutation] = useMutation(CANCEL_SALES_ORDER);
  return { addSalesOrderMutation, cancelSalesOrderMutation };
};
