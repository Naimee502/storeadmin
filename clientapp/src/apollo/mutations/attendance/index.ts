import { gql } from '@apollo/client';

export const PUNCH = gql`
  mutation punch($input: PunchInput!) {
    punch(input: $input) {
      log {
        id date status totalWorkMinutes
        firstPunchIn lastPunchOut
        punches { id type timestamp }
      }
      punch { id type timestamp }
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
