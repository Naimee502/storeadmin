import { useQuery, useMutation } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { GET_ATTENDANCE_SUMMARY, GET_ATTENDANCE_LOGS, GET_OPEN_PUNCH, GET_LEAVE_REQUESTS, GET_LEAVE_TYPES } from '../../queries/attendance';
import { PUNCH, ADD_LEAVE_REQUEST, CANCEL_LEAVE_REQUEST } from '../../mutations/attendance';
import type { RootState } from '../../../store/rootreducer';

export const useAttendanceSummaryQuery = (month?: number, year?: number) => {
  const adminId = useSelector((s: RootState) => s.tenant.adminId);
  const staffId = useSelector((s: RootState) => s.auth.user?.id);
  return useQuery(GET_ATTENDANCE_SUMMARY, {
    variables: { adminid: adminId, staffid: staffId, month, year },
    skip: !adminId || !staffId,
    fetchPolicy: 'cache-and-network',
  });
};

export const useAttendanceLogsQuery = (limit = 30) => {
  const adminId = useSelector((s: RootState) => s.tenant.adminId);
  const staffId = useSelector((s: RootState) => s.auth.user?.id);
  return useQuery(GET_ATTENDANCE_LOGS, {
    variables: { adminid: adminId, staffid: staffId, limit },
    skip: !adminId || !staffId,
    fetchPolicy: 'cache-and-network',
  });
};

export const useOpenPunchQuery = () => {
  const adminId = useSelector((s: RootState) => s.tenant.adminId);
  const staffId = useSelector((s: RootState) => s.auth.user?.id);
  return useQuery(GET_OPEN_PUNCH, {
    variables: { staffid: staffId, adminid: adminId },
    skip: !adminId || !staffId,
    fetchPolicy: 'network-only',
  });
};

export const useLeaveRequestsQuery = () => {
  const adminId = useSelector((s: RootState) => s.tenant.adminId);
  const staffId = useSelector((s: RootState) => s.auth.user?.id);
  return useQuery(GET_LEAVE_REQUESTS, {
    variables: { adminid: adminId, staffid: staffId },
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
