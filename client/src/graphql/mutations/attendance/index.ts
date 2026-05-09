import { gql } from "@apollo/client";

/* ------------------------------------------------------------------ */
/* Attendance                                                         */
/* ------------------------------------------------------------------ */

export const PUNCH = gql`
  mutation Punch($input: PunchInput!) {
    punch(input: $input) {
      log {
        id
        date
        status
        firstPunchIn
        lastPunchOut
        totalWorkMinutes
        punches {
          id
          type
          timestamp
        }
      }
      punch {
        id
        type
        timestamp
        latitude
        longitude
        address
        source
      }
    }
  }
`;

export const ADD_MANUAL_ATTENDANCE = gql`
  mutation AddManualAttendance($input: ManualAttendanceInput!) {
    addManualAttendance(input: $input) {
      id
      date
      status
      firstPunchIn
      lastPunchOut
      notes
    }
  }
`;

export const EDIT_ATTENDANCE_LOG = gql`
  mutation EditAttendanceLog($id: ID!, $input: ManualAttendanceInput!) {
    editAttendanceLog(id: $id, input: $input) {
      id
      date
      status
      firstPunchIn
      lastPunchOut
      notes
    }
  }
`;

export const DELETE_ATTENDANCE_LOG = gql`
  mutation DeleteAttendanceLog($id: ID!) {
    deleteAttendanceLog(id: $id)
  }
`;

export const DELETE_PUNCH = gql`
  mutation DeletePunch($logid: ID!, $punchid: ID!) {
    deletePunch(logid: $logid, punchid: $punchid) {
      id
      punches {
        id
        type
        timestamp
      }
    }
  }
`;

/* ------------------------------------------------------------------ */
/* Holiday                                                            */
/* ------------------------------------------------------------------ */

export const ADD_HOLIDAY = gql`
  mutation AddHoliday($input: HolidayInput!) {
    addHoliday(input: $input) {
      id
      date
      name
      type
    }
  }
`;

export const EDIT_HOLIDAY = gql`
  mutation EditHoliday($id: ID!, $input: HolidayInput!) {
    editHoliday(id: $id, input: $input) {
      id
      date
      name
      type
    }
  }
`;

export const DELETE_HOLIDAY = gql`
  mutation DeleteHoliday($id: ID!) {
    deleteHoliday(id: $id)
  }
`;

/* ------------------------------------------------------------------ */
/* LeaveType                                                          */
/* ------------------------------------------------------------------ */

export const ADD_LEAVE_TYPE = gql`
  mutation AddLeaveType($input: LeaveTypeInput!) {
    addLeaveType(input: $input) {
      id
      name
      code
    }
  }
`;

export const EDIT_LEAVE_TYPE = gql`
  mutation EditLeaveType($id: ID!, $input: LeaveTypeInput!) {
    editLeaveType(id: $id, input: $input) {
      id
      name
      code
    }
  }
`;

export const DELETE_LEAVE_TYPE = gql`
  mutation DeleteLeaveType($id: ID!) {
    deleteLeaveType(id: $id)
  }
`;

/* ------------------------------------------------------------------ */
/* LeaveRequest                                                       */
/* ------------------------------------------------------------------ */

export const ADD_LEAVE_REQUEST = gql`
  mutation AddLeaveRequest($input: LeaveRequestInput!) {
    addLeaveRequest(input: $input) {
      id
      status
      fromDate
      toDate
    }
  }
`;

export const EDIT_LEAVE_REQUEST = gql`
  mutation EditLeaveRequest($id: ID!, $input: LeaveRequestInput!) {
    editLeaveRequest(id: $id, input: $input) {
      id
      status
    }
  }
`;

export const APPROVE_LEAVE_REQUEST = gql`
  mutation ApproveLeaveRequest(
    $id: ID!
    $approverid: ID
    $approverName: String
    $approverType: String
  ) {
    approveLeaveRequest(
      id: $id
      approverid: $approverid
      approverName: $approverName
      approverType: $approverType
    ) {
      id
      status
      approvedAt
      approvedByName
    }
  }
`;

export const REJECT_LEAVE_REQUEST = gql`
  mutation RejectLeaveRequest(
    $id: ID!
    $rejectionReason: String!
    $approverid: ID
    $approverName: String
    $approverType: String
  ) {
    rejectLeaveRequest(
      id: $id
      rejectionReason: $rejectionReason
      approverid: $approverid
      approverName: $approverName
      approverType: $approverType
    ) {
      id
      status
      rejectionReason
    }
  }
`;

export const CANCEL_LEAVE_REQUEST = gql`
  mutation CancelLeaveRequest($id: ID!) {
    cancelLeaveRequest(id: $id) {
      id
      status
    }
  }
`;

export const DELETE_LEAVE_REQUEST = gql`
  mutation DeleteLeaveRequest($id: ID!) {
    deleteLeaveRequest(id: $id)
  }
`;

/* ------------------------------------------------------------------ */
/* LeaveBalance                                                       */
/* ------------------------------------------------------------------ */

export const UPSERT_LEAVE_BALANCE = gql`
  mutation UpsertLeaveBalance($input: LeaveBalanceInput!) {
    upsertLeaveBalance(input: $input) {
      id
      year
      allocated
      used
      pending
      carriedForward
      balance
    }
  }
`;

export const DELETE_LEAVE_BALANCE = gql`
  mutation DeleteLeaveBalance($id: ID!) {
    deleteLeaveBalance(id: $id)
  }
`;

/* ------------------------------------------------------------------ */
/* Reset (restore from soft delete)                                   */
/* ------------------------------------------------------------------ */

export const RESET_ATTENDANCE_LOG = gql`
  mutation ResetAttendanceLog($id: ID!) {
    resetAttendanceLog(id: $id)
  }
`;

export const RESET_HOLIDAY = gql`
  mutation ResetHoliday($id: ID!) {
    resetHoliday(id: $id)
  }
`;

export const RESET_LEAVE_TYPE = gql`
  mutation ResetLeaveType($id: ID!) {
    resetLeaveType(id: $id)
  }
`;

export const RESET_LEAVE_REQUEST = gql`
  mutation ResetLeaveRequest($id: ID!) {
    resetLeaveRequest(id: $id)
  }
`;

export const RESET_LEAVE_BALANCE = gql`
  mutation ResetLeaveBalance($id: ID!) {
    resetLeaveBalance(id: $id)
  }
`;
