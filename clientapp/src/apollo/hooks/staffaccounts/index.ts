import { useQuery, useMutation } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { GET_SALES_ROUTES, GET_SALESMAN_ORDERS, GET_STAFF_ACCOUNT } from '../../queries/staffaccounts';
import { UPDATE_SALES_ROUTE } from '../../mutations/staffaccounts';
import type { RootState } from '../../../store/rootreducer';

export const useSalesRoutesQuery = () => {
  const adminId   = useSelector((s: RootState) => s.tenant.adminId);
  const salesmanId = useSelector((s: RootState) => s.auth.user?.id);
  return useQuery(GET_SALES_ROUTES, {
    variables: { filter: { adminId, salesmanId } },
    skip: !adminId || !salesmanId,
    fetchPolicy: 'cache-and-network',
  });
};

export const useSalesmanOrdersQuery = () => {
  const adminId    = useSelector((s: RootState) => s.tenant.adminId);
  const salesmanId = useSelector((s: RootState) => s.auth.user?.id);
  return useQuery(GET_SALESMAN_ORDERS, {
    variables: { adminid: adminId, salesmenid: salesmanId },
    skip: !adminId || !salesmanId,
    fetchPolicy: 'cache-and-network',
  });
};

export const useStaffAccountQuery = (id: string) => {
  const adminId = useSelector((s: RootState) => s.tenant.adminId);
  return useQuery(GET_STAFF_ACCOUNT, {
    variables: { id, adminid: adminId },
    skip: !id || !adminId,
    fetchPolicy: 'cache-and-network',
  });
};

export const useSalesmanMutations = () => {
  const [updateSalesRouteMutation] = useMutation(UPDATE_SALES_ROUTE);
  return { updateSalesRouteMutation };
};
