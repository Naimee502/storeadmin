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

// Is a business module enabled (admin-level allowedmodules)?
// null/empty allowedmodules = "all modules allowed" (legacy tenants).
export const useModuleEnabled = (moduleId: string): boolean => {
  const { data } = useAdminQuery();
  const allowed: string[] | null = (data as any)?.getAdminById?.allowedmodules ?? null;
  if (allowed === null || allowed.length === 0) return true;
  return allowed.some((m) => (m || '').toLowerCase() === moduleId.toLowerCase());
};
