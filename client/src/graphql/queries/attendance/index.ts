import { gql } from "@apollo/client";

/* ------------------------------------------------------------------ */
/* Attendance                                                         */
/* ------------------------------------------------------------------ */

export const GET_ATTENDANCE_LOGS = gql`
  query GetAttendanceLogs($filter: AttendanceFilterInput) {
    getAttendanceLogs(filter: $filter) {
      id
      adminid
      branchid
      staffid {
        id
        name
        staffcode
        mobile
        email
        role
      }
      date
      status
      firstPunchIn
      lastPunchOut
      totalWorkMinutes
      totalBreakMinutes
      isLate
      lateByMinutes
      earlyExit
      earlyExitByMinutes
      overtimeMinutes
      shiftStart
      shiftEnd
      notes
      punches {
        id
        type
        timestamp
        latitude
        longitude
        address
        routeid
        source
        selfieUrl
        remarks
        isAutoOut
        status
      }
      createdAt
      updatedAt
    }
  }
`;

export const GET_ATTENDANCE_LOG_BY_ID = gql`
  query GetAttendanceLogById($id: ID!) {
    getAttendanceLogById(id: $id) {
      id
      adminid
      branchid
      staffid {
        id
        name
        staffcode
      }
      date
      status
      firstPunchIn
      lastPunchOut
      totalWorkMinutes
      totalBreakMinutes
      isLate
      lateByMinutes
      overtimeMinutes
      notes
      punches {
        id
        type
        timestamp
        latitude
        longitude
        address
        source
        remarks
      }
    }
  }
`;

export const GET_MY_ATTENDANCE = gql`
  query GetMyAttendance($month: String) {
    getMyAttendance(month: $month) {
      id
      date
      status
      firstPunchIn
      lastPunchOut
      totalWorkMinutes
      isLate
      overtimeMinutes
      punches {
        id
        type
        timestamp
        source
      }
    }
  }
`;

export const GET_ATTENDANCE_PUNCHES = gql`
  query GetAttendancePunches($filter: PunchFilterInput) {
    getAttendancePunches(filter: $filter) {
      id
      type
      timestamp
      latitude
      longitude
      address
      routeid
      source
      selfieUrl
      remarks
    }
  }
`;

export const GET_ATTENDANCE_SUMMARY = gql`
  query GetAttendanceSummary($filter: AttendanceFilterInput) {
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

export const GET_OPEN_PUNCH = gql`
  query GetOpenPunch($staffid: ID!) {
    getOpenPunch(staffid: $staffid) {
      id
      type
      timestamp
      latitude
      longitude
      address
    }
  }
`;

/* ------------------------------------------------------------------ */
/* Holiday                                                            */
/* ------------------------------------------------------------------ */

export const GET_HOLIDAYS = gql`
  query GetHolidays($filter: HolidayFilterInput) {
    getHolidays(filter: $filter) {
      id
      adminid
      branchid
      date
      name
      type
      description
      status
      createdAt
    }
  }
`;

export const GET_HOLIDAY_BY_ID = gql`
  query GetHolidayById($id: ID!) {
    getHolidayById(id: $id) {
      id
      date
      name
      type
      description
      status
    }
  }
`;

/* ------------------------------------------------------------------ */
/* LeaveType                                                          */
/* ------------------------------------------------------------------ */

export const GET_LEAVE_TYPES = gql`
  query GetLeaveTypes($adminid: ID) {
    getLeaveTypes(adminid: $adminid) {
      id
      name
      code
      totalDaysPerYear
      accrualType
      carryForward
      maxCarryForward
      isPaid
      allowHalfDay
      requiresApproval
      requiresAttachment
      color
      description
      status
    }
  }
`;

export const GET_LEAVE_TYPE_BY_ID = gql`
  query GetLeaveTypeById($id: ID!) {
    getLeaveTypeById(id: $id) {
      id
      name
      code
      totalDaysPerYear
      accrualType
      carryForward
      maxCarryForward
      isPaid
      allowHalfDay
      requiresApproval
      requiresAttachment
      color
      description
      status
    }
  }
`;

/* ------------------------------------------------------------------ */
/* LeaveRequest                                                       */
/* ------------------------------------------------------------------ */

export const GET_LEAVE_REQUESTS = gql`
  query GetLeaveRequests($filter: LeaveFilterInput) {
    getLeaveRequests(filter: $filter) {
      id
      adminid
      branchid
      staffid {
        id
        name
        staffcode
      }
      leavetypeid {
        id
        name
        code
        color
        isPaid
      }
      fromDate
      toDate
      halfDay
      halfDaySession
      totalDays
      reason
      attachmentUrl
      status
      approvedById
      approvedByName
      approvedByType
      approvedAt
      rejectionReason
      createdAt
    }
  }
`;

export const GET_LEAVE_REQUEST_BY_ID = gql`
  query GetLeaveRequestById($id: ID!) {
    getLeaveRequestById(id: $id) {
      id
      staffid {
        id
        name
      }
      leavetypeid {
        id
        name
      }
      fromDate
      toDate
      halfDay
      totalDays
      reason
      status
      rejectionReason
    }
  }
`;

export const GET_MY_LEAVE_REQUESTS = gql`
  query GetMyLeaveRequests {
    getMyLeaveRequests {
      id
      leavetypeid {
        id
        name
        color
      }
      fromDate
      toDate
      totalDays
      status
      reason
      createdAt
    }
  }
`;

/* ------------------------------------------------------------------ */
/* LeaveBalance                                                       */
/* ------------------------------------------------------------------ */

export const GET_LEAVE_BALANCES = gql`
  query GetLeaveBalances($filter: LeaveBalanceFilterInput) {
    getLeaveBalances(filter: $filter) {
      id
      staffid {
        id
        name
        staffcode
      }
      leavetypeid {
        id
        name
        code
        color
      }
      year
      allocated
      used
      pending
      carriedForward
      balance
    }
  }
`;

export const GET_MY_LEAVE_BALANCES = gql`
  query GetMyLeaveBalances {
    getMyLeaveBalances {
      id
      leavetypeid {
        id
        name
        code
        color
      }
      year
      allocated
      used
      pending
      carriedForward
      balance
    }
  }
`;

/* ------------------------------------------------------------------ */
/* Deleted (soft-deleted) views                                       */
/* ------------------------------------------------------------------ */

export const GET_DELETED_ATTENDANCE_LOGS = gql`
  query GetDeletedAttendanceLogs($filter: AttendanceFilterInput) {
    getDeletedAttendanceLogs(filter: $filter) {
      id
      staffid {
        id
        name
        staffcode
      }
      date
      status
      firstPunchIn
      lastPunchOut
      totalWorkMinutes
      notes
      updatedAt
    }
  }
`;

export const GET_DELETED_HOLIDAYS = gql`
  query GetDeletedHolidays($filter: HolidayFilterInput) {
    getDeletedHolidays(filter: $filter) {
      id
      date
      name
      type
      description
      status
    }
  }
`;

export const GET_DELETED_LEAVE_TYPES = gql`
  query GetDeletedLeaveTypes($adminid: ID) {
    getDeletedLeaveTypes(adminid: $adminid) {
      id
      name
      code
      totalDaysPerYear
      accrualType
      isPaid
      status
    }
  }
`;

export const GET_DELETED_LEAVE_REQUESTS = gql`
  query GetDeletedLeaveRequests($filter: LeaveFilterInput) {
    getDeletedLeaveRequests(filter: $filter) {
      id
      staffid {
        id
        name
        staffcode
      }
      leavetypeid {
        id
        name
      }
      fromDate
      toDate
      totalDays
      reason
      status
      updatedAt
    }
  }
`;

export const GET_DELETED_LEAVE_BALANCES = gql`
  query GetDeletedLeaveBalances($filter: LeaveBalanceFilterInput) {
    getDeletedLeaveBalances(filter: $filter) {
      id
      staffid {
        id
        name
        staffcode
      }
      leavetypeid {
        id
        name
        code
        color
      }
      year
      allocated
      used
      pending
      carriedForward
      balance
    }
  }
`;

