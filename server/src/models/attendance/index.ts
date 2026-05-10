import mongoose from "mongoose";

const punchSubSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["in", "out", "breakstart", "breakend"], required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    latitude: { type: Number },
    longitude: { type: Number },
    accuracy: { type: Number },
    address: { type: String },
    routeid: { type: mongoose.Schema.Types.ObjectId, ref: "SalesRoute" },
    source: { type: String, enum: ["web", "mobile", "biometric", "kiosk", "manual"], default: "web" },
    selfieUrl: { type: String },
    deviceInfo: { type: String },
    ipAddress: { type: String },
    remarks: { type: String },
    isAutoOut: { type: Boolean, default: false },
    status: { type: Boolean, default: true },
  },
  { timestamps: true, _id: true }
);

const attendanceSchema = new mongoose.Schema(
  {
    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true, index: true },
    branchid: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    staffid: { type: mongoose.Schema.Types.ObjectId, ref: "StaffAccount", required: true, index: true },
    date: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["present", "absent", "halfday", "leave", "holiday", "weekoff"],
      default: "absent",
    },
    firstPunchIn: { type: Date },
    lastPunchOut: { type: Date },
    totalWorkMinutes: { type: Number, default: 0 },
    totalBreakMinutes: { type: Number, default: 0 },
    isLate: { type: Boolean, default: false },
    lateByMinutes: { type: Number, default: 0 },
    earlyExit: { type: Boolean, default: false },
    earlyExitByMinutes: { type: Number, default: 0 },
    overtimeMinutes: { type: Number, default: 0 },
    shiftStart: { type: String },
    shiftEnd: { type: String },
    notes: { type: String },
    punches: { type: [punchSubSchema], default: [] },
    status_active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
attendanceSchema.index({ adminid: 1, staffid: 1, date: 1 }, { unique: true });
export const Attendance = mongoose.model("Attendance", attendanceSchema);

const holidaySchema = new mongoose.Schema(
  {
    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true, index: true },
    branchid: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
    date: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ["public", "company", "regional", "optional"], default: "public" },
    description: { type: String },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);
holidaySchema.index({ adminid: 1, date: 1 });
export const Holiday = mongoose.model("Holiday", holidaySchema);

const leaveTypeSchema = new mongoose.Schema(
  {
    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    totalDaysPerYear: { type: Number, default: 0 },
    accrualType: { type: String, enum: ["yearly", "monthly", "quarterly", "none"], default: "yearly" },
    carryForward: { type: Boolean, default: false },
    maxCarryForward: { type: Number, default: 0 },
    isPaid: { type: Boolean, default: true },
    allowHalfDay: { type: Boolean, default: true },
    requiresApproval: { type: Boolean, default: true },
    requiresAttachment: { type: Boolean, default: false },
    color: { type: String, default: "#3b82f6" },
    description: { type: String },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);
leaveTypeSchema.index({ adminid: 1, code: 1 }, { unique: true });
export const LeaveType = mongoose.model("LeaveType", leaveTypeSchema);

const leaveRequestSchema = new mongoose.Schema(
  {
    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true, index: true },
    branchid: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    staffid: { type: mongoose.Schema.Types.ObjectId, ref: "StaffAccount", required: true, index: true },
    leavetypeid: { type: mongoose.Schema.Types.ObjectId, ref: "LeaveType", required: true },
    fromDate: { type: String, required: true },
    toDate: { type: String, required: true },
    halfDay: { type: Boolean, default: false },
    halfDaySession: { type: String, enum: ["first", "second", null], default: null },
    totalDays: { type: Number, required: true },
    reason: { type: String, required: true },
    attachmentUrl: { type: String },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
    approvedById: { type: mongoose.Schema.Types.ObjectId },
    approvedByName: { type: String },
    approvedByType: { type: String },
    approvedAt: { type: Date },
    rejectionReason: { type: String },
    appliedFromIp: { type: String },
    status_active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
export const LeaveRequest = mongoose.model("LeaveRequest", leaveRequestSchema);

const leaveBalanceSchema = new mongoose.Schema(
  {
    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true, index: true },
    staffid: { type: mongoose.Schema.Types.ObjectId, ref: "StaffAccount", required: true, index: true },
    leavetypeid: { type: mongoose.Schema.Types.ObjectId, ref: "LeaveType", required: true },
    year: { type: Number, required: true },
    allocated: { type: Number, default: 0 },
    used: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
    carriedForward: { type: Number, default: 0 },
    status_active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
leaveBalanceSchema.index(
  { adminid: 1, staffid: 1, leavetypeid: 1, year: 1 },
  { unique: true }
);
leaveBalanceSchema.virtual("balance").get(function () {
  return Math.max(
    0,
    (this.allocated + this.carriedForward) - this.used - this.pending
  );
});
leaveBalanceSchema.set("toJSON", { virtuals: true });
leaveBalanceSchema.set("toObject", { virtuals: true });
export const LeaveBalance = mongoose.model("LeaveBalance", leaveBalanceSchema);
