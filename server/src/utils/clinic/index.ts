import jwt from "jsonwebtoken";
import cron from "node-cron";
import { Types } from "mongoose";
import { Account } from "../../models/accounts";
import { Admin } from "../../models/admin";
import { AdminSettings } from "../../models/adminsettings";
import { StaffAccount } from "../../models/staffaccounts";
import { Prescription } from "../../models/service";
import { pushNotification } from "../../models/notifications";
import { TenantError } from "../tenant";
import { istDate } from "../ist";
import { isModuleOn } from "../modulegate";
import { dmy } from "../supplierdocs";
import { billBody, billHtml, companyOf, esc, printOptions } from "../billprint";

export const OWNER = "owner";
export const TIMING: Record<string, string> = { before: "Before food", after: "After food", empty: "Empty stomach", bedtime: "At bedtime" };
export const rxNo = (r: any) => `RX-${r?.rxnumber || ""}`;

/** Doctors open for online booking; the owner counts when their own doctor profile is filled. */
export const clinicDoctors = async (adminid: any) => {
  if (!(await isModuleOn("prescriptions", { adminid }))) return [];
  const [staff, st]: any[] = await Promise.all([
    StaffAccount.find({ admin: adminid, status: { $ne: false }, doctor: { $exists: true, $ne: null }, "doctor.online": { $ne: false } })
      .select("name imageurl profilepicture doctor").sort({ name: 1 }).lean(),
    AdminSettings.findOne({ adminid }).select("ownerDoctor").lean(),
  ]);
  const out: any[] = staff.map((s: any) => ({
    id: String(s._id), name: s.name, photo: s.imageurl || s.profilepicture || null, specialization: s.doctor?.specialization || null,
    qualification: s.doctor?.qualification || null, experience: s.doctor?.experience ?? null, fee: s.doctor?.fee ?? null, about: s.doctor?.about || null,
  }));
  const o = st?.ownerDoctor;
  if (o && o.online !== false && (o.name || o.specialization || o.regno)) {
    const a: any = await Admin.findById(adminid).select("name").lean();
    out.unshift({ id: OWNER, name: o.name || a?.name || "Doctor", photo: o.photo || null, specialization: o.specialization || null,
      qualification: o.qualification || null, experience: o.experience ?? null, fee: o.fee ?? null, about: o.about || null });
  }
  return out;
};

export const myRxShape = (r: any) => ({
  id: String(r._id), rxnumber: r.rxnumber || null, billdate: r.billdate, doctorname: r.doctorname || null, doctorqualification: r.doctorqualification || null,
  complaints: r.complaints || null, diagnosis: r.diagnosis || null, vitals: r.vitals || null,
  medicines: (r.medicines || []).map((m: any) => ({ ...m, productserviceid: null })), tests: r.tests || null, advice: r.advice || null, nextvisit: r.nextvisit || null,
});

/** The patient's own prescription, or not found. */
export const myRx = async (id: any, partyid: any, adminid: any) => {
  if (!Types.ObjectId.isValid(String(id))) throw new TenantError("Prescription not found.", "NOT_FOUND");
  const r: any = await Prescription.findOne({ _id: id, adminid, partyacc: partyid, status: true }).lean();
  if (!r) throw new TenantError("Prescription not found.", "NOT_FOUND");
  return r;
};

const PRINT_SECRET = () => `${process.env.JWT_ACCESS_SECRET}:rx-print`;
export const rxPrintToken = (id: any, partyid: any, adminid: any) =>
  jwt.sign({ id: String(id), p: String(partyid), a: String(adminid) }, PRINT_SECRET(), { expiresIn: "15m" });

/** Prescription in the common bill layout, for a print link; null when the link is bad or expired. */
export const rxPrintHtml = async (token: string): Promise<string | null> => {
  let t: any;
  try { t = jwt.verify(token, PRINT_SECRET()); } catch { return null; }
  const r: any = await myRx(t.id, t.p, t.a).catch(() => null);
  if (!r) return null;
  const [admin, st, party]: any[] = await Promise.all([
    Admin.findById(t.a).select("companyName address mobile").lean(),
    AdminSettings.findOne({ adminid: t.a }).lean(),
    Account.findById(t.p).select("name mobile city").lean(),
  ]);
  return billHtml(rxNo(r), [rxBody(r, admin, st, party)]);
};

/** One prescription page (same frame as the bills). */
export const rxBody = (r: any, admin: any, st: any, party: any) => {
  const opts = printOptions(st);
  const seller = companyOf(admin, st);
  if (st?.legalName) seller.name = st.legalName;
  const patient = [party?.name || r.customername, party?.mobile || r.customermobile, party?.city].map((x) => String(x || "").trim()).filter(Boolean).join(" - ");
  const v = r.vitals || {};
  const vitals = [["BP", v.bp], ["Pulse", v.pulse], ["Temp", v.temperature], ["Weight", v.weight], ["SpO2", v.spo2], ["Sugar", v.sugar]]
    .filter(([, x]) => x).map(([l, x]) => `${l}: ${esc(x)}`).join(" &nbsp; ");
  const extra = [
    r.tests ? `<strong>Tests:</strong> ${esc(r.tests)}` : "",
    r.advice ? `<strong>Advice:</strong> ${esc(r.advice)}` : "",
    r.nextvisit ? `<strong>Next Visit:</strong> ${esc(dmy(r.nextvisit))}` : "",
  ].filter(Boolean).join("<br/>");
  const doctor = [r.doctorname, r.doctorqualification].filter(Boolean).join(", ");
  return billBody({
    title: "PRESCRIPTION", memo: doctor ? `Dr. ${doctor.replace(/^Dr\.?\s*/i, "")}` : "",
    company: seller, showHeader: opts.showHeader,
    cells: [
      ["Patient", esc(patient || "---")], ["Rx No.", esc(rxNo(r))], ["Date", esc(dmy(r.billdate))],
      ["Complaints", esc(r.complaints || "---")], ["Diagnosis", esc(r.diagnosis || "---")], ["Vitals", vitals || "---"],
    ],
    columns: [{ label: "Sr", align: "c", width: "6%" }, { label: "Medicine", align: "l" }, { label: "Dose", align: "c", width: "12%" },
      { label: "When", align: "c", width: "12%" }, { label: "Food", align: "c", width: "15%" }, { label: "Days", align: "c", width: "9%" }],
    rows: (r.medicines || []).map((m: any, i: number) => [String(i + 1), `${esc(m.name)}${m.notes ? `<div class="desc">${esc(m.notes)}</div>` : ""}`,
      esc(m.dose || "-"), esc(m.frequency || "-"), esc(TIMING[m.timing] || m.timing || "-"), esc(m.days ?? "-")]),
    extra,
    signLeft: r.doctorregno ? `Reg. No. ${r.doctorregno}` : undefined,
    signCompany: null,
    signLabel: doctor ? `Dr. ${doctor.replace(/^Dr\.?\s*/i, "")}` : "Doctor's Signature",
  });
};

const tell = (r: any, title: string, message: string) =>
  r?.partyacc ? pushNotification({ adminid: r.adminid, targettype: "party", targetid: r.partyacc?._id || r.partyacc?.id || r.partyacc, ntype: "prescription", title, message, docmodel: "Prescription", docid: r._id || r.id }).catch(() => {}) : null;

/** Tell the patient when a prescription is written for them. */
export const withRxNotify = (map: any) => {
  if (!map?.Mutation?.addPrescription) return map;
  const orig = map.Mutation.addPrescription;
  return {
    ...map,
    Mutation: {
      ...map.Mutation,
      addPrescription: async (...args: any[]) => {
        const r = await orig(...args);
        try {
          if (r?.partyacc) tell(r, `Prescription ${rxNo(r)} from ${r.doctorname || "your doctor"}`, r.nextvisit ? `Next visit ${dmy(r.nextvisit)}` : "Open My Prescriptions to see it");
        } catch { /* best-effort */ }
        return r;
      },
    },
  };
};

const addDays = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** Daily: remind patients the day before their next visit. */
export const startRxReminderScheduler = () => {
  cron.schedule("17 10 * * *", async () => {
    try {
      const rows: any[] = await Prescription.find({ status: true, nextvisit: addDays(istDate(), 1), partyacc: { $ne: null } }).lean();
      for (const r of rows) tell(r, "Your next visit is tomorrow", `${r.doctorname ? `Dr. ${String(r.doctorname).replace(/^Dr\.?\s*/i, "")} · ` : ""}${dmy(r.nextvisit)}`);
    } catch (e) {
      console.error("prescription reminders failed:", e);
    }
  }, { timezone: "Asia/Kolkata" });
};
