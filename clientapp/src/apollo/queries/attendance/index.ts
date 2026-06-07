import { gql } from '@apollo/client';

export const GET_ATTENDANCE_SUMMARY = gql`
  query getAttendanceSummary($filter: AttendanceFilterInput) {
    getAttendanceSummary(filter: $filter) {
      totalDays
      presentDays
      halfDays
      leaveDays
      absentDays
      holidayDays
      weekoffDays
      lateDays
      overtimeMinutes
      totalWorkMinutes
    }
  }
`;

export const GET_ATTENDANCE_LOGS = gql`
  query getAttendanceLogs($filter: AttendanceFilterInput) {
    getAttendanceLogs(filter: $filter) {
      id
      date
      status
      firstPunchIn
      lastPunchOut
      totalWorkMinutes
      punches { id type timestamp latitude longitude }
    }
  }
`;

export const GET_OPEN_PUNCH = gql`
  query getOpenPunch($staffid: ID!) {
    getOpenPunch(staffid: $staffid) {
      id type timestamp
    }
  }
`;

export const GET_LEAVE_REQUESTS = gql`
  query getLeaveRequests($filter: LeaveFilterInput) {
    getLeaveRequests(filter: $filter) {
      id
      fromDate toDate totalDays halfDay halfDaySession
      reason attachmentUrl status
      rejectionReason approvedByName approvedAt
      leavetypeid { id name code color isPaid }
      createdAt
    }
  }
`;

export const GET_LEAVE_TYPES = gql`
  query getLeaveTypes($adminid: ID) {
    getLeaveTypes(adminid: $adminid) {
      id name code color isPaid totalDaysPerYear
    }
  }
`;
