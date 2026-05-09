import { gql } from "apollo-server-express";

export const attendanceTypeDefs = gql`
  type StaffRef {
    id: ID
    name: String
    staffcode: String
    mobile: String
    email: String
    role: String
  }

  type AttendancePunch {
    id: ID!
    type: String!
    timestamp: String!
    latitude: Float
    longitude: Float
    accuracy: Float
    address: String
    routeid: ID
    source: String
    selfieUrl: String
    deviceInfo: String
    ipAddress: String
    remarks: String
    isAutoOut: Boolean
    status: Boolean
    createdAt: String
  }

  type AttendanceLog {
    id: ID!
    adminid: ID!
    branchid: ID!
    staffid: StaffRef
    date: String!
    status: String!
    firstPunchIn: String
    lastPunchOut: String
    totalWorkMinutes: Int
    totalBreakMinutes: Int
    isLate: Boolean
    lateByMinutes: Int
    earlyExit: Boolean
    earlyExitByMinutes: Int
    overtimeMinutes: Int
    shiftStart: String
    shiftEnd: String
    notes: String
    punches: [AttendancePunch!]!
    createdAt: String
    updatedAt: String
  }

  input PunchInput {
    staffid: ID!
    type: String!
    timestamp: String
    latitude: Float
    longitude: Float
    accuracy: Float
    address: String
    routeid: ID
    source: String
    selfieUrl: String
    deviceInfo: String
    remarks: String
  }

  input ManualAttendanceInput {
    staffid: ID!
    date: String!
    status: String!
    firstPunchIn: String
    lastPunchOut: String
    notes: String
  }

  input AttendanceFilterInput {
    adminid: ID
    branchid: ID
    staffid: ID
    dateFrom: String
    dateTo: String
    status: String
  }

  input PunchFilterInput {
    adminid: ID
    branchid: ID
    staffid: ID
    dateFrom: String
    dateTo: String
    type: String
    routeid: ID
  }

  type AttendanceSummary {
    totalDays: Int!
    presentDays: Int!
    halfDays: Int!
    leaveDays: Int!
    absentDays: Int!
    holidayDays: Int!
    weekoffDays: Int!
    lateDays: Int!
    overtimeMinutes: Int!
    totalWorkMinutes: Int!
  }

  type PunchResult {
    log: AttendanceLog!
    punch: AttendancePunch!
  }

  type Holiday {
    id: ID!
    adminid: ID!
    branchid: ID
    date: String!
    name: String!
    type: String!
    description: String
    status: Boolean!
    createdAt: String
    updatedAt: String
  }

  input HolidayInput {
    adminid: ID!
    branchid: ID
    date: String!
    name: String!
    type: String
    description: String
    status: Boolean
  }

  input HolidayFilterInput {
    adminid: ID
    branchid: ID
    yearFrom: String
    yearTo: String
    type: String
  }

  type LeaveType {
    id: ID!
    adminid: ID!
    name: String!
    code: String!
    totalDaysPerYear: Float
    accrualType: String
    carryForward: Boolean
    maxCarryForward: Float
    isPaid: Boolean
    allowHalfDay: Boolean
    requiresApproval: Boolean
    requiresAttachment: Boolean
    color: String
    description: String
    status: Boolean
    createdAt: String
    updatedAt: String
  }

  input LeaveTypeInput {
    adminid: ID!
    name: String!
    code: String!
    totalDaysPerYear: Float
    accrualType: String
    carryForward: Boolean
    maxCarryForward: Float
    isPaid: Boolean
    allowHalfDay: Boolean
    requiresApproval: Boolean
    requiresAttachment: Boolean
    color: String
    description: String
    status: Boolean
  }

  type LeaveTypeRef {
    id: ID
    name: String
    code: String
    color: String
    isPaid: Boolean
  }

  type LeaveRequest {
    id: ID!
    adminid: ID!
    branchid: ID!
    staffid: StaffRef
    leavetypeid: LeaveTypeRef
    fromDate: String!
    toDate: String!
    halfDay: Boolean
    halfDaySession: String
    totalDays: Float!
    reason: String!
    attachmentUrl: String
    status: String!
    approvedById: ID
    approvedByName: String
    approvedByType: String
    approvedAt: String
    rejectionReason: String
    createdAt: String
    updatedAt: String
  }

  input LeaveRequestInput {
    adminid: ID!
    branchid: ID!
    staffid: ID!
    leavetypeid: ID!
    fromDate: String!
    toDate: String!
    halfDay: Boolean
    halfDaySession: String
    totalDays: Float!
    reason: String!
    attachmentUrl: String
  }

  input LeaveFilterInput {
    adminid: ID
    branchid: ID
    staffid: ID
    leavetypeid: ID
    status: String
    fromDate: String
    toDate: String
  }

  type LeaveBalance {
    id: ID!
    adminid: ID!
    staffid: StaffRef
    leavetypeid: LeaveTypeRef
    year: Int!
    allocated: Float!
    used: Float!
    pending: Float!
    carriedForward: Float!
    balance: Float!
  }

  input LeaveBalanceFilterInput {
    adminid: ID
    staffid: ID
    leavetypeid: ID
    year: Int
  }

  input LeaveBalanceInput {
    adminid: ID!
    staffid: ID!
    leavetypeid: ID!
    year: Int!
    allocated: Float!
    carriedForward: Float
  }

  extend type Query {
    getAttendanceLogs(filter: AttendanceFilterInput): [AttendanceLog!]!
    getAttendanceLogById(id: ID!): AttendanceLog
    getMyAttendance(month: String): [AttendanceLog!]!
    getAttendancePunches(filter: PunchFilterInput): [AttendancePunch!]!
    getAttendanceSummary(filter: AttendanceFilterInput): AttendanceSummary!
    getOpenPunch(staffid: ID!): AttendancePunch
    getHolidays(filter: HolidayFilterInput): [Holiday!]!
    getHolidayById(id: ID!): Holiday
    getLeaveTypes(adminid: ID): [LeaveType!]!
    getLeaveTypeById(id: ID!): LeaveType
    getLeaveRequests(filter: LeaveFilterInput): [LeaveRequest!]!
    getLeaveRequestById(id: ID!): LeaveRequest
    getMyLeaveRequests: [LeaveRequest!]!
    getLeaveBalances(filter: LeaveBalanceFilterInput): [LeaveBalance!]!
    getMyLeaveBalances: [LeaveBalance!]!
    getDeletedAttendanceLogs(filter: AttendanceFilterInput): [AttendanceLog!]!
    getDeletedHolidays(filter: HolidayFilterInput): [Holiday!]!
    getDeletedLeaveTypes(adminid: ID): [LeaveType!]!
    getDeletedLeaveRequests(filter: LeaveFilterInput): [LeaveRequest!]!
    getDeletedLeaveBalances(filter: LeaveBalanceFilterInput): [LeaveBalance!]!
  }

  extend type Mutation {
    punch(input: PunchInput!): PunchResult!
    addManualAttendance(input: ManualAttendanceInput!): AttendanceLog!
    editAttendanceLog(id: ID!, input: ManualAttendanceInput!): AttendanceLog!
    deleteAttendanceLog(id: ID!): Boolean!
    deletePunch(logid: ID!, punchid: ID!): AttendanceLog!
    addHoliday(input: HolidayInput!): Holiday!
    editHoliday(id: ID!, input: HolidayInput!): Holiday!
    deleteHoliday(id: ID!): Boolean!
    addLeaveType(input: LeaveTypeInput!): LeaveType!
    editLeaveType(id: ID!, input: LeaveTypeInput!): LeaveType!
    deleteLeaveType(id: ID!): Boolean!
    addLeaveRequest(input: LeaveRequestInput!): LeaveRequest!
    editLeaveRequest(id: ID!, input: LeaveRequestInput!): LeaveRequest!
    approveLeaveRequest(id: ID!, approverid: ID, approverName: String, approverType: String): LeaveRequest!
    rejectLeaveRequest(id: ID!, rejectionReason: String!, approverid: ID, approverName: String, approverType: String): LeaveRequest!
    cancelLeaveRequest(id: ID!): LeaveRequest!
    deleteLeaveRequest(id: ID!): Boolean!
    upsertLeaveBalance(input: LeaveBalanceInput!): LeaveBalance!
    deleteLeaveBalance(id: ID!): Boolean!
    resetAttendanceLog(id: ID!): Boolean!
    resetHoliday(id: ID!): Boolean!
    resetLeaveType(id: ID!): Boolean!
    resetLeaveRequest(id: ID!): Boolean!
    resetLeaveBalance(id: ID!): Boolean!
  }
`;
