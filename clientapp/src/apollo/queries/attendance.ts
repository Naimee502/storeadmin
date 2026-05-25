import { gql } from '@apollo/client';

export const GET_ATTENDANCE_SUMMARY = gql`
  query getAttendanceSummary($adminid: ID!, $staffid: ID!, $month: Int, $year: Int) {
    getAttendanceSummary(adminid: $adminid, staffid: $staffid, month: $month, year: $year) {
      staffid { id name }
      month year
      totalPresent totalAbsent totalLeave totalHoliday totalWorkingDays
      totalWorkMinutes
    }
  }
`;

export const GET_ATTENDANCE_LOGS = gql`
  query getAttendanceLogs($adminid: ID!, $staffid: ID!, $limit: Int) {
    getAttendanceLogs(adminid: $adminid, staffid: $staffid, limit: $limit) {
      id date status totalWorkMinutes
      punches { type timestamp lat lng }
    }
  }
`;

export const GET_OPEN_PUNCH = gql`
  query getOpenPunch($staffid: ID!, $adminid: ID!) {
    getOpenPunch(staffid: $staffid, adminid: $adminid) {
      id date
      punches { type timestamp }
    }
  }
`;

export const PUNCH = gql`
  mutation punch($staffid: ID!, $adminid: ID!, $type: String!, $timestamp: String!) {
    punch(staffid: $staffid, adminid: $adminid, type: $type, timestamp: $timestamp) {
      id date status
      punches { type timestamp }
    }
  }
`;

export const GET_LEAVE_REQUESTS = gql`
  query getLeaveRequests($adminid: ID, $staffid: ID) {
    getLeaveRequests(filter: { adminid: $adminid, staffid: $staffid }) {
      id
      fromDate toDate totalDays halfDay halfDaySession
      reason attachmentUrl status
      rejectionReason
      approvedByName approvedAt
      leavetypeid { id name code color isPaid }
      createdAt
    }
  }
`;

export const ADD_LEAVE_REQUEST = gql`
  mutation addLeaveRequest($input: LeaveRequestInput!) {
    addLeaveRequest(input: $input) {
      id fromDate toDate totalDays status
      leavetypeid { id name code color }
    }
  }
`;

export const CANCEL_LEAVE_REQUEST = gql`
  mutation cancelLeaveRequest($id: ID!) {
    cancelLeaveRequest(id: $id) {
      id status
    }
  }
`;
