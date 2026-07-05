import {
  Attendance, Holiday, LeaveType, LeaveRequest, LeaveBalance,
} from "../../../models/attendance";
import { StaffAccount } from "../../../models/staffaccounts";
import { Branch } from "../../../models/branches";

const pad2 = (n: number) => String(n).padStart(2, "0");
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const toStaffRef = (doc: any) => {
  if (!doc) return null;
  return {
    id: doc._id?.toString() ?? doc.id,
    name: doc.name ?? null,
    staffcode: doc.staffcode ?? null,
    mobile: doc.mobile ?? null,
    email: doc.email ?? null,
    role: doc.role ?? null,
  };
};

const toLeaveTypeRef = (doc: any) => {
  if (!doc) return null;
  return {
    id: doc._id?.toString() ?? doc.id,
    name: doc.name ?? null,
    code: doc.code ?? null,
    color: doc.color ?? null,
    isPaid: doc.isPaid ?? null,
  };
};

const toIso = (d: any) => (d ? new Date(d).toISOString() : null);

const formatPunch = (p: any) => ({
  ...p,
  id: p._id?.toString(),
  timestamp: toIso(p.timestamp),
  createdAt: toIso(p.createdAt),
});

const formatLog = (log: any) => {
  if (!log) return null;
  return {
    ...log,
    id: log._id.toString(),
    staffid:
      log.staffid && typeof log.staffid === "object" && (log.staffid as any).name !== undefined
        ? toStaffRef(log.staffid)
        : log.staffid ? { id: String(log.staffid) } : null,
    firstPunchIn: toIso(log.firstPunchIn),
    lastPunchOut: toIso(log.lastPunchOut),
    createdAt: toIso(log.createdAt),
    updatedAt: toIso(log.updatedAt),
    punches: (log.punches ?? []).map(formatPunch),
  };
};

const formatHoliday = (h: any) => ({
  ...h,
  id: h._id.toString(),
  createdAt: toIso(h.createdAt),
  updatedAt: toIso(h.updatedAt),
});

const formatLeaveType = (lt: any) => ({
  ...lt,
  id: lt._id.toString(),
  createdAt: toIso(lt.createdAt),
  updatedAt: toIso(lt.updatedAt),
});

const formatLeaveRequest = (lr: any) => {
  if (!lr) return null;
  return {
    ...lr,
    id: lr._id.toString(),
    staffid:
      lr.staffid && typeof lr.staffid === "object" && (lr.staffid as any).name !== undefined
        ? toStaffRef(lr.staffid)
        : lr.staffid ? { id: String(lr.staffid) } : null,
    leavetypeid:
      lr.leavetypeid && typeof lr.leavetypeid === "object" && (lr.leavetypeid as any).name !== undefined
        ? toLeaveTypeRef(lr.leavetypeid)
        : lr.leavetypeid ? { id: String(lr.leavetypeid) } : null,
    approvedAt: toIso(lr.approvedAt),
    createdAt: toIso(lr.createdAt),
    updatedAt: toIso(lr.updatedAt),
  };
};

const formatLeaveBalance = (lb: any) => {
  const allocated = Number(lb.allocated || 0);
  const used = Number(lb.used || 0);
  const pending = Number(lb.pending || 0);
  const carriedForward = Number(lb.carriedForward || 0);
  const balance = Math.max(0, allocated + carriedForward - used - pending);
  return {
    ...lb,
    id: lb._id.toString(),
    staffid:
      lb.staffid && typeof lb.staffid === "object" && (lb.staffid as any).name !== undefined
        ? toStaffRef(lb.staffid)
        : lb.staffid ? { id: String(lb.staffid) } : null,
    leavetypeid:
      lb.leavetypeid && typeof lb.leavetypeid === "object" && (lb.leavetypeid as any).name !== undefined
        ? toLeaveTypeRef(lb.leavetypeid)
        : lb.leavetypeid ? { id: String(lb.leavetypeid) } : null,
    allocated, used, pending, carriedForward, balance,
  };
};

const buildLogQuery = (filter: any = {}) => {
  const q: any = { status_active: true };
  if (filter.adminid) q.adminid = filter.adminid;
  if (filter.branchid) q.branchid = filter.branchid;
  if (filter.staffid) q.staffid = filter.staffid;
  if (filter.status) q.status = filter.status;
  if (filter.dateFrom || filter.dateTo) {
    q.date = {};
    if (filter.dateFrom) q.date.$gte = filter.dateFrom;
    if (filter.dateTo) q.date.$lte = filter.dateTo;
  }
  return q;
};

const dayCountInclusive = (from: string, to: string) => {
  const f = new Date(from);
  const t = new Date(to);
  return Math.max(1, Math.round((t.getTime() - f.getTime()) / 86400000) + 1);
};

export const attendanceResolvers = {
  Query: {
    getAttendanceLogs: async (_: any, { filter = {} }: any) => {
      const logs = await Attendance.find(buildLogQuery(filter)).populate("staffid").sort({ date: -1, createdAt: -1 }).lean();
      return logs.map(formatLog);
    },
    getAttendanceLogById: async (_: any, { id }: { id: string }) => {
      const log = await Attendance.findById(id).populate("staffid").lean();
      return formatLog(log);
    },
    getMyAttendance: async (_: any, { month }: { month?: string }, ctx: any) => {
      const staffid = ctx?.user?.id;
      if (!staffid) return [];
      const q: any = { staffid, status_active: true };
      if (month) q.date = { $gte: `${month}-01`, $lte: `${month}-31` };
      const logs = await Attendance.find(q).sort({ date: -1 }).lean();
      return logs.map(formatLog);
    },
    getAttendancePunches: async (_: any, { filter = {} }: any) => {
      const logs = await Attendance.find(buildLogQuery(filter)).lean();
      const punches: any[] = [];
      for (const log of logs) {
        for (const p of (log as any).punches ?? []) {
          if (filter.type && p.type !== filter.type) continue;
          if (filter.routeid && String(p.routeid) !== String(filter.routeid)) continue;
          punches.push(formatPunch(p));
        }
      }
      punches.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
      return punches;
    },
    getAttendanceSummary: async (_: any, { filter = {} }: any) => {
      const logs = await Attendance.find(buildLogQuery(filter)).lean();
      const summary = {
        totalDays: filter.dateFrom && filter.dateTo ? dayCountInclusive(filter.dateFrom, filter.dateTo) : logs.length,
        presentDays: 0, halfDays: 0, leaveDays: 0, absentDays: 0, holidayDays: 0,
        weekoffDays: 0, lateDays: 0, overtimeMinutes: 0, totalWorkMinutes: 0,
      };
      for (const l of logs as any[]) {
        switch (l.status) {
          case "present": summary.presentDays += 1; break;
          case "halfday": summary.halfDays += 1; break;
          case "leave": summary.leaveDays += 1; break;
          case "absent": summary.absentDays += 1; break;
          case "holiday": summary.holidayDays += 1; break;
          case "weekoff": summary.weekoffDays += 1; break;
        }
        if (l.isLate) summary.lateDays += 1;
        summary.overtimeMinutes += l.overtimeMinutes || 0;
        summary.totalWorkMinutes += l.totalWorkMinutes || 0;
      }
      return summary;
    },
    getOpenPunch: async (_: any, { staffid }: { staffid: string }) => {
      const today = toDateStr(new Date());
      const log: any = await Attendance.findOne({ staffid, date: today, status_active: true }).lean();
      if (!log || !log.punches?.length) return null;
      const sorted = [...log.punches].sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      let openIn: any = null;
      for (const p of sorted) {
        if (p.type === "in") openIn = p;
        else if (p.type === "out") openIn = null;
      }
      return openIn ? formatPunch(openIn) : null;
    },
    getHolidays: async (_: any, { filter = {} }: any) => {
      const q: any = { status: true };
      if (filter.adminid) q.adminid = filter.adminid;
      if (filter.branchid) q.branchid = filter.branchid;
      if (filter.type) q.type = filter.type;
      if (filter.yearFrom || filter.yearTo) {
        q.date = {};
        if (filter.yearFrom) q.date.$gte = filter.yearFrom;
        if (filter.yearTo) q.date.$lte = filter.yearTo;
      }
      const list = await Holiday.find(q).sort({ date: 1 }).lean();
      return list.map(formatHoliday);
    },
    getHolidayById: async (_: any, { id }: { id: string }) => {
      const h = await Holiday.findById(id).lean();
      return h ? formatHoliday(h) : null;
    },
    getLeaveTypes: async (_: any, { adminid }: any) => {
      const q: any = { status: true };
      if (adminid) q.adminid = adminid;
      const list = await LeaveType.find(q).sort({ name: 1 }).lean();
      return list.map(formatLeaveType);
    },
    getLeaveTypeById: async (_: any, { id }: { id: string }) => {
      const lt = await LeaveType.findById(id).lean();
      return lt ? formatLeaveType(lt) : null;
    },
    getLeaveRequests: async (_: any, { filter = {} }: any) => {
      const q: any = { status_active: true };
      if (filter.adminid) q.adminid = filter.adminid;
      if (filter.branchid) q.branchid = filter.branchid;
      if (filter.staffid) q.staffid = filter.staffid;
      if (filter.leavetypeid) q.leavetypeid = filter.leavetypeid;
      if (filter.status) q.status = filter.status;
      if (filter.fromDate || filter.toDate) {
        q.fromDate = {};
        if (filter.fromDate) q.fromDate.$gte = filter.fromDate;
        if (filter.toDate) q.fromDate.$lte = filter.toDate;
      }
      const list = await LeaveRequest.find(q).populate("staffid").populate("leavetypeid").sort({ createdAt: -1 }).lean();
      return list.map(formatLeaveRequest);
    },
    getLeaveRequestById: async (_: any, { id }: { id: string }) => {
      const lr = await LeaveRequest.findById(id).populate("staffid").populate("leavetypeid").lean();
      return formatLeaveRequest(lr);
    },
    getMyLeaveRequests: async (_: any, __: any, ctx: any) => {
      const staffid = ctx?.user?.id;
      if (!staffid) return [];
      const list = await LeaveRequest.find({ staffid, status_active: true }).populate("leavetypeid").sort({ createdAt: -1 }).lean();
      return list.map(formatLeaveRequest);
    },
    getLeaveBalances: async (_: any, { filter = {} }: any) => {
      const q: any = { status_active: { $ne: false } };
      if (filter.adminid) q.adminid = filter.adminid;
      if (filter.staffid) q.staffid = filter.staffid;
      if (filter.leavetypeid) q.leavetypeid = filter.leavetypeid;
      if (filter.year) q.year = filter.year;
      const list = await LeaveBalance.find(q).populate("staffid").populate("leavetypeid").lean();
      return list.map(formatLeaveBalance);
    },
    getMyLeaveBalances: async (_: any, __: any, ctx: any) => {
      const staffid = ctx?.user?.id;
      if (!staffid) return [];
      const list = await LeaveBalance.find({ staffid, status_active: { $ne: false } }).populate("leavetypeid").lean();
      return list.map(formatLeaveBalance);
    },
    getDeletedAttendanceLogs: async (_: any, { filter = {} }: any) => {
      const q: any = { status_active: false };
      if (filter.adminid) q.adminid = filter.adminid;
      if (filter.branchid) q.branchid = filter.branchid;
      if (filter.staffid) q.staffid = filter.staffid;
      const logs = await Attendance.find(q).populate("staffid").sort({ date: -1, updatedAt: -1 }).lean();
      return logs.map(formatLog);
    },
    getDeletedHolidays: async (_: any, { filter = {} }: any) => {
      const q: any = { status: false };
      if (filter.adminid) q.adminid = filter.adminid;
      if (filter.branchid) q.branchid = filter.branchid;
      const list = await Holiday.find(q).sort({ date: -1 }).lean();
      return list.map(formatHoliday);
    },
    getDeletedLeaveTypes: async (_: any, { adminid }: any) => {
      const q: any = { status: false };
      if (adminid) q.adminid = adminid;
      const list = await LeaveType.find(q).sort({ name: 1 }).lean();
      return list.map(formatLeaveType);
    },
    getDeletedLeaveRequests: async (_: any, { filter = {} }: any) => {
      const q: any = { status_active: false };
      if (filter.adminid) q.adminid = filter.adminid;
      if (filter.branchid) q.branchid = filter.branchid;
      const list = await LeaveRequest.find(q).populate("staffid").populate("leavetypeid").sort({ updatedAt: -1 }).lean();
      return list.map(formatLeaveRequest);
    },
    getDeletedLeaveBalances: async (_: any, { filter = {} }: any) => {
      const q: any = { status_active: false };
      if (filter.adminid) q.adminid = filter.adminid;
      if (filter.staffid) q.staffid = filter.staffid;
      if (filter.leavetypeid) q.leavetypeid = filter.leavetypeid;
      if (filter.year) q.year = filter.year;
      const list = await LeaveBalance.find(q).populate("staffid").populate("leavetypeid").sort({ updatedAt: -1 }).lean();
      return list.map(formatLeaveBalance);
    },
  },
  Mutation: {
    punch: async (_: any, { input }: any, ctx: any) => {
      try {
        console.log("🕒 [punch] input:", JSON.stringify(input));
        const staff = await StaffAccount.findById(input.staffid).lean();
        if (!staff) {
          console.warn("🕒 [punch] staff not found:", input.staffid);
          throw new Error("Staff not found");
        }
        const ts = input.timestamp ? new Date(input.timestamp) : new Date();
        const dateStr = toDateStr(ts);
        const adminid = (staff as any).admin;
        // Prefer the staff's assigned branch; fall back to request context, then
        // to the admin's first active branch (staff created without a branch
        // could otherwise never punch in — attendance requires a branch).
        let branchid = (staff as any).branchid || ctx?.branchid;
        if (!branchid && adminid) {
          const fb: any = await Branch.findOne({ admin: adminid, status: true }).select("_id").lean();
          branchid = fb?._id;
          if (branchid) console.log("🕒 [punch] fell back to admin's branch:", String(branchid));
        }
        console.log("🕒 [punch] resolved adminid:", String(adminid), "branchid:", String(branchid));
        if (!adminid) throw new Error("Cannot resolve admin for staff (staff has no admin).");
        if (!branchid) throw new Error("No branch found for this staff. Assign a branch to the staff (or create a branch for the admin) before punching in.");
        let log: any = await Attendance.findOne({ adminid, staffid: input.staffid, date: dateStr });
        if (!log) {
          log = await Attendance.create({ adminid, branchid, staffid: input.staffid, date: dateStr, status: "present" });
        }
      const punch: any = {
        type: input.type, timestamp: ts,
        latitude: input.latitude, longitude: input.longitude, accuracy: input.accuracy,
        address: input.address, routeid: input.routeid || undefined,
        source: input.source || "web", selfieUrl: input.selfieUrl,
        deviceInfo: input.deviceInfo, ipAddress: ctx?.req?.ip, remarks: input.remarks,
      };
      log.punches.push(punch);
      const sorted = [...log.punches].sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      let firstIn: Date | null = null;
      let lastOut: Date | null = null;
      let workMs = 0;
      let breakMs = 0;
      let openIn: Date | null = null;
      let openBreak: Date | null = null;
      for (const p of sorted) {
        const t = new Date(p.timestamp);
        if (p.type === "in") { if (!firstIn) firstIn = t; openIn = t; }
        else if (p.type === "out") { lastOut = t; if (openIn) { workMs += t.getTime() - openIn.getTime(); openIn = null; } }
        else if (p.type === "breakstart") { openBreak = t; }
        else if (p.type === "breakend") { if (openBreak) { breakMs += t.getTime() - openBreak.getTime(); openBreak = null; } }
      }
      log.firstPunchIn = firstIn || log.firstPunchIn;
      log.lastPunchOut = lastOut || log.lastPunchOut;
      log.totalWorkMinutes = Math.round(workMs / 60000);
      log.totalBreakMinutes = Math.round(breakMs / 60000);
      if (log.status === "absent") log.status = "present";
      await log.save();
      const populated = await Attendance.findById(log._id).populate("staffid").lean();
      const formatted = formatLog(populated);
      const created = formatted!.punches[formatted!.punches.length - 1];
      return { log: formatted, punch: created };
      } catch (err: any) {
        console.error("🕒 [punch] ERROR:", err?.message, err);
        throw err;
      }
    },
    addManualAttendance: async (_: any, { input }: any, ctx: any) => {
      const staff = await StaffAccount.findById(input.staffid).lean();
      if (!staff) throw new Error("Staff not found");
      const adminid = (staff as any).admin;
      // Match the punch resolver: prefer staff.branchid, fall back to the
      // request context's branchid so the saved log carries a branchid that
      // the dashboard's branch filter will match.
      const branchid = (staff as any).branchid || ctx?.branchid;
      const punchIn  = input.firstPunchIn  ? new Date(input.firstPunchIn)  : undefined;
      const punchOut = input.lastPunchOut  ? new Date(input.lastPunchOut)  : undefined;
      const totalWorkMinutes = punchIn && punchOut
        ? Math.max(0, Math.round((punchOut.getTime() - punchIn.getTime()) / 60000))
        : undefined;
      const log = await Attendance.findOneAndUpdate(
        { adminid, staffid: input.staffid, date: input.date },
        { $set: { adminid, branchid, staffid: input.staffid, date: input.date, status: input.status,
            firstPunchIn: punchIn,
            lastPunchOut: punchOut,
            totalWorkMinutes,
            notes: input.notes,
            // Always restore status_active. Without this, re-adding manual
            // attendance for a previously soft-deleted (staff, date) row
            // would update the existing soft-deleted document and leave it
            // hidden from getAttendanceLogs (which filters status_active:true).
            status_active: true } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ).populate("staffid").lean();
      return formatLog(log);
    },
    editAttendanceLog: async (_: any, { id, input }: any) => {
      const punchIn  = input.firstPunchIn  ? new Date(input.firstPunchIn)  : undefined;
      const punchOut = input.lastPunchOut  ? new Date(input.lastPunchOut)  : undefined;
      const totalWorkMinutes = punchIn && punchOut
        ? Math.max(0, Math.round((punchOut.getTime() - punchIn.getTime()) / 60000))
        : undefined;
      const log = await Attendance.findByIdAndUpdate(id,
        { $set: { status: input.status,
            firstPunchIn: punchIn,
            lastPunchOut: punchOut,
            totalWorkMinutes,
            notes: input.notes } },
        { new: true }).populate("staffid").lean();
      return formatLog(log);
    },
    deleteAttendanceLog: async (_: any, { id }: { id: string }) => !!(await Attendance.findByIdAndUpdate(id, { status_active: false })),
    deletePunch: async (_: any, { logid, punchid }: any) => {
      const log = await Attendance.findByIdAndUpdate(logid, { $pull: { punches: { _id: punchid } } }, { new: true }).populate("staffid").lean();
      return formatLog(log);
    },
    addHoliday: async (_: any, { input }: any) => {
      const created = await Holiday.create(input);
      return formatHoliday(created.toObject());
    },
    editHoliday: async (_: any, { id, input }: any) => {
      const updated = await Holiday.findByIdAndUpdate(id, input, { new: true }).lean();
      return updated ? formatHoliday(updated) : null;
    },
    deleteHoliday: async (_: any, { id }: { id: string }) => !!(await Holiday.findByIdAndUpdate(id, { status: false })),
    addLeaveType: async (_: any, { input }: any) => {
      const created = await LeaveType.create(input);
      return formatLeaveType(created.toObject());
    },
    editLeaveType: async (_: any, { id, input }: any) => {
      const updated = await LeaveType.findByIdAndUpdate(id, input, { new: true }).lean();
      return updated ? formatLeaveType(updated) : null;
    },
    deleteLeaveType: async (_: any, { id }: { id: string }) => !!(await LeaveType.findByIdAndUpdate(id, { status: false })),
    addLeaveRequest: async (_: any, { input }: any, ctx: any) => {
      const created = await LeaveRequest.create({ ...input, appliedFromIp: ctx?.req?.ip });
      const year = new Date(input.fromDate).getFullYear();
      await LeaveBalance.findOneAndUpdate(
        { adminid: input.adminid, staffid: input.staffid, leavetypeid: input.leavetypeid, year },
        { $inc: { pending: input.totalDays } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      const populated = await LeaveRequest.findById(created._id).populate("staffid").populate("leavetypeid").lean();
      return formatLeaveRequest(populated);
    },
    editLeaveRequest: async (_: any, { id, input }: any) => {
      const updated = await LeaveRequest.findByIdAndUpdate(id, input, { new: true }).populate("staffid").populate("leavetypeid").lean();
      return formatLeaveRequest(updated);
    },
    approveLeaveRequest: async (_: any, { id, approverid, approverName, approverType }: any) => {
      const lr: any = await LeaveRequest.findById(id).populate("leavetypeid");
      if (!lr) throw new Error("Leave request not found");
      if (lr.status !== "pending") throw new Error("Only pending requests can be approved");
      lr.status = "approved";
      lr.approvedById = approverid;
      lr.approvedByName = approverName;
      lr.approvedByType = approverType;
      lr.approvedAt = new Date();
      await lr.save();

      const year = new Date(lr.fromDate).getFullYear();
      await LeaveBalance.findOneAndUpdate(
        { adminid: lr.adminid, staffid: lr.staffid, leavetypeid: lr.leavetypeid, year },
        { $inc: { pending: -lr.totalDays, used: lr.totalDays } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Auto-mark attendance logs for all leave dates so the attendance
      // register shows "leave" instead of "absent" for those days.
      const from = new Date(lr.fromDate);
      const to   = new Date(lr.toDate);
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        const dateStr = toDateStr(d);
        await Attendance.findOneAndUpdate(
          { adminid: lr.adminid, staffid: lr.staffid, date: dateStr },
          {
            $set: {
              adminid: lr.adminid,
              branchid: lr.branchid,
              staffid: lr.staffid,
              date: dateStr,
              status: "leave",
              status_active: true,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }

      // Accounting link: for unpaid leave, the payroll module should deduct
      // (lr.totalDays / workingDaysInMonth) × monthlySalary from the staff's
      // salary ledger. This is handled by the Payroll module when it processes
      // the period — the leave request status "approved" + isPaid=false acts
      // as the trigger. No journal entry is created here directly because the
      // exact daily rate and period are only known at payroll run time.

      const populated = await LeaveRequest.findById(lr._id).populate("staffid").populate("leavetypeid").lean();
      return formatLeaveRequest(populated);
    },
    rejectLeaveRequest: async (_: any, { id, rejectionReason, approverid, approverName, approverType }: any) => {
      const lr: any = await LeaveRequest.findById(id);
      if (!lr) throw new Error("Leave request not found");
      if (lr.status !== "pending") throw new Error("Only pending requests can be rejected");
      lr.status = "rejected";
      lr.rejectionReason = rejectionReason;
      lr.approvedById = approverid;
      lr.approvedByName = approverName;
      lr.approvedByType = approverType;
      lr.approvedAt = new Date();
      await lr.save();
      const year = new Date(lr.fromDate).getFullYear();
      await LeaveBalance.findOneAndUpdate(
        { adminid: lr.adminid, staffid: lr.staffid, leavetypeid: lr.leavetypeid, year },
        { $inc: { pending: -lr.totalDays } }, { new: true }
      );
      const populated = await LeaveRequest.findById(lr._id).populate("staffid").populate("leavetypeid").lean();
      return formatLeaveRequest(populated);
    },
    cancelLeaveRequest: async (_: any, { id }: any) => {
      const lr: any = await LeaveRequest.findById(id);
      if (!lr) throw new Error("Leave request not found");
      if (lr.status === "approved" || lr.status === "rejected") throw new Error("Cannot cancel a finalized request");
      const wasPending = lr.status === "pending";
      lr.status = "cancelled";
      await lr.save();
      if (wasPending) {
        const year = new Date(lr.fromDate).getFullYear();
        await LeaveBalance.findOneAndUpdate(
          { adminid: lr.adminid, staffid: lr.staffid, leavetypeid: lr.leavetypeid, year },
          { $inc: { pending: -lr.totalDays } }
        );
      }
      const populated = await LeaveRequest.findById(lr._id).populate("staffid").populate("leavetypeid").lean();
      return formatLeaveRequest(populated);
    },
    deleteLeaveRequest: async (_: any, { id }: { id: string }) => !!(await LeaveRequest.findByIdAndUpdate(id, { status_active: false })),
    resetAttendanceLog: async (_: any, { id }: { id: string }) => !!(await Attendance.findByIdAndUpdate(id, { status_active: true })),
    resetHoliday: async (_: any, { id }: { id: string }) => !!(await Holiday.findByIdAndUpdate(id, { status: true })),
    resetLeaveType: async (_: any, { id }: { id: string }) => !!(await LeaveType.findByIdAndUpdate(id, { status: true })),
    resetLeaveRequest: async (_: any, { id }: { id: string }) => !!(await LeaveRequest.findByIdAndUpdate(id, { status_active: true })),
    resetLeaveBalance: async (_: any, { id }: { id: string }) => !!(await LeaveBalance.findByIdAndUpdate(id, { status_active: true })),
    deleteLeaveBalance: async (_: any, { id }: { id: string }) => !!(await LeaveBalance.findByIdAndUpdate(id, { status_active: false })),
    upsertLeaveBalance: async (_: any, { input }: any) => {
      const lb = await LeaveBalance.findOneAndUpdate(
        { adminid: input.adminid, staffid: input.staffid, leavetypeid: input.leavetypeid, year: input.year },
        { $set: { allocated: input.allocated, carriedForward: input.carriedForward ?? 0, status_active: true } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).populate("staffid").populate("leavetypeid").lean();
      return formatLeaveBalance(lb);
    },
  },
};
