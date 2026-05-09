import mongoose from "mongoose";

/**
 * ATTENDANCE DOMAIN — single consolidated model file.
 *
 * Everything HR/attendance-related lives here:
 *   - Attendance     (daily log per staff, punches embedded as subdocs)
 *   - Holiday        (calendar of public/company/regional holidays)
 *   - LeaveType      (CL/SL/EL/LOP config per admin)
 *   - LeaveRequest   (staff leave applications + approval workflow)
 *   - LeaveBalance   (per-staff/year/leave-type accrual & usage)
 *
 * They remain SEPARATE Mongoose models (separate MongoDB collections)
 * because they have different unique constraints and access patterns,
 * but they live in one file/folder so the whole module is co-located.
 */

/* ---------------------------------------------------------------- */
/* 1) Attendance (daily log) with embedded punches                  */
/* ---------------------------------------------------------------- */

const punchSubSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["in", "out", "breakstart", "breakend"],
      required: true,
    },

    timestamp: { type: Date, required: true, default: Date.now },

    // Location capture (salesmen on route)
    latitude: { type: Number },
    longitude: { type: Number },
    accuracy: { type: Number },
    address: { type: String },

    // Optional sales-route this was punched on
    routeid: { type: mongoose.Schema.Types.ObjectId, ref: "SalesRoute" },

    source: {
      type: String,
      enum: ["web", "mobile", "biometric", "kiosk", "manual"],
      default: "web",
    },

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

    date: { type: String, required: true, index: true }, // YYYY-MM-DD

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

    shiftStart: { type: String }, // HH:mm
    shiftEnd: { type: String }, // HH:mm

    notes: { type: String },

    // All punch events for this staff/day
    punches: { type: [punchSubSchema], default: [] },

    // soft delete
    status_active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

attendanceSchema.index({ adminid: 1, staffid: 1, date: 1 }, { unique: true });

export const Attendance = mongoose.model("Attendance", attendanceSchema);

/* ---------------------------------------------------------------- */
/* 2) Holiday                                                       */
/* ---------------------------------------------------------------- */

const holidaySchema = new mongoose.Schema(
  {
    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true, index: true },
    branchid: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" }, // null = applies to all branches

    date: { type: String, required: true }, // YYYY-MM-DD
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["public", "company", "regional", "optional"],
      default: "public",
    },
    description: { type: String },

    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

holidaySchema.index({ adminid: 1, date: 1 });

export const Holiday = mongoose.model("Holiday", holidaySchema);

/* ---------------------------------------------------------------- */
/* 3) LeaveType (configuration: CL, SL, EL, LOP, Comp-Off, ...)    */
/* ---------------------------------------------------------------- */

const leaveTypeSchema = new mongoose.Schema(
  {
    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true, index: true },

    name: { type: String, required: true },
    code: { type: String, required: true },

    totalDaysPerYear: { type: Number, default: 0 },
    accrualType: {
      type: String,
      enum: ["yearly", "monthly", "quarterly", "none"],
      default: "yearly",
    },

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

/* ---------------------------------------------------------------- */
/* 4) LeaveRequest (with approval workflow)                         */
/* ---------------------------------------------------------------- */

const leaveRequestSchema = new mongoose.Schema(
  {
    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true, index: true },
    branchid: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    staffid: { type: mongoose.Schema.Types.ObjectId, ref: "StaffAccount", required: true, index: true },

    leavetypeid: { type: mongoose.Schema.Types.ObjectId, ref: "LeaveType", required: true },

    fromDate: { type: String, required: true }, // YYYY-MM-DD
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
    approvedByType: { type: String }, // admin | branch | manager
    approvedAt: { type: Date },

    rejectionReason: { type: String },

    appliedFromIp: { type: String },

    // soft delete
    status_active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const LeaveRequest = mongoose.model("LeaveRequest", leaveRequestSchema);

/* ---------------------------------------------------------------- */
/* 5) LeaveBalance (per staff/year/leave-type)                      */
/* ---------------------------------------------------------------- */

const leaveBalanceSchema = new mongoose.Schema(
  {
    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true, index: true },
    staffid: { type: mongoose.Schema.Types.ObjectId, ref: "StaffAccount", required: true, index: true },
    leavetypeid: { type: mongoose.Schema.Types.ObjectId, ref: "LeaveType", required: true },

    year: { type: Number, required: true },

    allocated: { type: Number, default: 0 },
    used: { type: Number, default: 0 },
    pending: { type: Number, default: 0 }, // pending approval
    carriedForward: { type: Number, default: 0 },

    // soft delete
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
