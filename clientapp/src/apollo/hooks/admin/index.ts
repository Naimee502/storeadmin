import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { GET_ADMIN_BY_ID } from '../../queries/admin';
import type { RootState } from '../../../store/rootreducer';

export const useAdminQuery = () => {
  const adminId = useSelector((s: RootState) => s.tenant.adminId);
  return useQuery(GET_ADMIN_BY_ID, {
    variables: { adminid: adminId },
    skip: !adminId,
    fetchPolicy: 'cache-and-network',
  });
};
