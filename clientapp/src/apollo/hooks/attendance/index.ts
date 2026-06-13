import { useQuery, useMutation } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { GET_ATTENDANCE_SUMMARY, GET_ATTENDANCE_LOGS, GET_OPEN_PUNCH, GET_LEAVE_REQUESTS, GET_LEAVE_TYPES } from '../../queries/attendance';
import { PUNCH, ADD_LEAVE_REQUEST, CANCEL_LEAVE_REQUEST } from '../../mutations/attendance';
import { GET_STAFF_ACCOUNT } from '../../queries/staffaccounts';
import type { RootState } from '../../../store/rootreducer';

// First and last day of the current month as YYYY-MM-DD.
const monthRange = () => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt  = (d: Date) => d.toISOString().slice(0, 10);
  return { dateFrom: fmt(from), dateTo: fmt(to) };
};

export const useAttendanceSummaryQuery = () => {
  const adminId = useSelector((s: RootState) => s.tenant.adminId);
  const staffId = useSelector((s: RootState) => s.auth.user?.id);
  const { dateFrom, dateTo } = monthRange();
  return useQuery(GET_ATTENDANCE_SUMMARY, {
    variables: { filter: { adminid: adminId, staffid: staffId, dateFrom, dateTo } },
    skip: !adminId || !staffId,
    fetchPolicy: 'cache-and-network',
  });
};

export const useAttendanceLogsQuery = () => {
  const adminId = useSelector((s: RootState) => s.tenant.adminId);
  const staffId = useSelector((s: RootState) => s.auth.user?.id);
  const { dateFrom, dateTo } = monthRange();
  return useQuery(GET_ATTENDANCE_LOGS, {
    variables: { filter: { adminid: adminId, staffid: staffId, dateFrom, dateTo } },
    skip: !adminId || !staffId,
    fetchPolicy: 'cache-and-network',
  });
};

export const useOpenPunchQuery = () => {
  const staffId = useSelector((s: RootState) => s.auth.user?.id);
  return useQuery(GET_OPEN_PUNCH, {
    variables: { staffid: staffId },
    skip: !staffId,
    fetchPolicy: 'network-only',
  });
};

// Punch-in gate: when the attendance module is enabled for a staff/salesman/
// delivery-boy, they must be punched in (active open punch) before doing any
// operation (order / party / payment / delivery). `blocked` = must punch in.
export const usePunchGate = () => {
  const user = useSelector((s: RootState) => s.auth.user);
  const adminId = useSelector((s: RootState) => s.tenant.adminId);
  const role = (user?.role || '').toLowerCase();
  const staffRole = role === 'staff' || role === 'salesman' || role === 'deliveryboy';

  const { data: staffData } = useQuery(GET_STAFF_ACCOUNT, {
    variables: { id: user?.id, adminId },
    skip: !user?.id || !adminId || !staffRole,
    fetchPolicy: 'cache-and-network',
  });
  const allowed: string[] | null = (staffData as any)?.getStaffAccountById?.allowedmodules ?? null;
  // attendance gate active when the module is allowed. null/empty allowedmodules
  // = "all modules allowed" → gate on for field roles.
  const attendanceOn = staffRole && (
    allowed === null || allowed.length === 0 || allowed.some((m) => (m || '').toLowerCase() === 'attendance')
  );

  const { data: punchData, loading } = useQuery(GET_OPEN_PUNCH, {
    variables: { staffid: user?.id },
    skip: !user?.id || !attendanceOn,
    fetchPolicy: 'network-only',
  });
  const punchedIn = !!(punchData as any)?.getOpenPunch;
  const blocked = attendanceOn && !loading && !punchedIn;

  return { blocked, attendanceOn, punchedIn, loading };
};

export const useLeaveRequestsQuery = () => {
  const adminId = useSelector((s: RootState) => s.tenant.adminId);
  const staffId = useSelector((s: RootState) => s.auth.user?.id);
  return useQuery(GET_LEAVE_REQUESTS, {
    variables: { filter: { adminid: adminId, staffid: staffId } },
    skip: !adminId || !staffId,
    fetchPolicy: 'cache-and-network',
  });
};

export const useLeaveTypesQuery = () => {
  const adminId = useSelector((s: RootState) => s.tenant.adminId);
  return useQuery(GET_LEAVE_TYPES, {
    variables: { adminid: adminId },
    skip: !adminId,
    fetchPolicy: 'cache-and-network',
  });
};

export const useAttendanceMutations = () => {
  const [punchMutation]              = useMutation(PUNCH);
  const [addLeaveRequestMutation]    = useMutation(ADD_LEAVE_REQUEST);
  const [cancelLeaveRequestMutation] = useMutation(CANCEL_LEAVE_REQUEST);
  return { punchMutation, addLeaveRequestMutation, cancelLeaveRequestMutation };
};
