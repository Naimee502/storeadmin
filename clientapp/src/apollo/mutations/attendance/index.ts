import { gql } from '@apollo/client';

export const PUNCH = gql`
  mutation punch($staffid: ID!, $adminid: ID!, $type: String!, $timestamp: String!) {
    punch(staffid: $staffid, adminid: $adminid, type: $type, timestamp: $timestamp) {
      id date status
      punches { type timestamp }
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
