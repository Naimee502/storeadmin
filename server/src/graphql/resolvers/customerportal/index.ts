import { Admin } from "../../../models/admin";
import { Account } from "../../../models/accounts";
import { Contract, JobCard, Membership } from "../../../models/service";
import { SupportTicket } from "../../../models/supportticket";
import { pushNotification } from "../../../models/notifications";
import { resolveTenant, TenantError } from "../../../utils/tenant";
import { contractShape, jobPrintToken, jobShape, JOB_POPULATE, membershipShape, myJob } from "../../../utils/customerportal";
import { supportTicketResolvers } from "../supportticket";

/** Signed-in customer and their business. */
const me = async (context: any) => {
  if (context?.user?.type !== "party" || !context.user.id) throw new TenantError("Please sign in.", "UNAUTHENTICATED");
  const scope = await resolveTenant(context);
  return { partyid: context.user.id, adminid: scope.adminid };
};
const mineQ = (m: any) => ({ adminid: m.adminid, partyacc: m.partyid, status: true });

export const customerPortalResolvers = {
  Query: {
    getMyServiceSummary: async (_: any, __: any, context: any) => {
      const m = await me(context);
      const [admin, tickets, openTickets, jobcards, activeJobcards, contracts, memberships]: any[] = await Promise.all([
        Admin.findById(m.adminid).select("allowedmodules").lean(),
        SupportTicket.countDocuments({ adminid: m.adminid, partyid: m.partyid, status: true }),
        SupportTicket.countDocuments({ adminid: m.adminid, partyid: m.partyid, status: true, ticketstatus: { $nin: ["resolved", "closed"] } }),
        JobCard.countDocuments(mineQ(m)),
        JobCard.countDocuments({ ...mineQ(m), jobStatus: { $nin: ["delivered", "cancelled"] } }),
        Contract.countDocuments(mineQ(m)),
        Membership.countDocuments(mineQ(m)),
      ]);
      // A menu needs its module on; older businesses with no module list have every module on.
      const list: string[] | null = Array.isArray(admin?.allowedmodules) && admin.allowedmodules.length ? admin.allowedmodules.map((x: string) => String(x).toLowerCase()) : null;
      const on = (id: string) => list === null || list.includes(id);
      const picked = !!list?.includes("supporttickets");
      return {
        tickets: on("supporttickets") && (picked || tickets > 0), openTickets,
        jobcards: on("jobcards") ? jobcards : 0, activeJobcards: on("jobcards") ? activeJobcards : 0,
        contracts: on("contracts") ? contracts : 0, memberships: on("memberships") ? memberships : 0,
      };
    },
    getMyJobCards: async (_: any, __: any, context: any) => {
      const m = await me(context);
      const rows = await JobCard.find(mineQ(m)).sort({ billdate: -1, createdAt: -1 }).limit(200).populate(JOB_POPULATE).lean();
      return rows.map(jobShape);
    },
    getMyJobCard: async (_: any, { id }: any, context: any) => {
      const m = await me(context);
      return jobShape(await myJob(id, m.partyid, m.adminid));
    },
    getMyContracts: async (_: any, __: any, context: any) => {
      const m = await me(context);
      const rows = await Contract.find(mineQ(m)).sort({ enddate: -1 }).limit(200).populate("items.productserviceid", "name").lean();
      return rows.map((c) => contractShape(c));
    },
    getMyMemberships: async (_: any, __: any, context: any) => {
      const m = await me(context);
      const rows = await Membership.find(mineQ(m)).sort({ startdate: -1 }).limit(100)
        .populate({ path: "planid", select: "name services", populate: { path: "services", select: "name" } }).lean();
      return Promise.all(rows.map((r) => membershipShape(r)));
    },
  },
  Mutation: {
    respondMyJobEstimate: async (_: any, { id, approve, note }: any, context: any) => {
      const m = await me(context);
      const j = await myJob(id, m.partyid, m.adminid);
      if (!jobShape(j).canApprove) throw new TenantError("This estimate can no longer be changed.", "BAD_USER_INPUT");
      const set: any = { approved: !!approve, approvedAt: new Date().toISOString().slice(0, 10) };
      // Approval moves a job that was waiting for it into work.
      if (approve && j.jobStatus === "waitingapproval") set.jobStatus = "inprogress";
      const extra = String(note || "").trim().slice(0, 500);
      if (extra) set.notes = [j.notes, `Customer: ${extra}`].filter(Boolean).join("\n");
      await JobCard.updateOne({ _id: j._id, approved: { $ne: true } }, { $set: set });
      const party: any = await Account.findById(m.partyid).select("name").lean();
      pushNotification({
        adminid: m.adminid, branchid: j.branchid, targettype: "admin", ntype: "service",
        title: `Estimate ${approve ? "approved" : "rejected"} by ${party?.name || "customer"}`,
        message: `${jobShape(j).billnumber}${extra ? ` · ${extra.slice(0, 80)}` : ""}`,
        webpath: `/jobcards/addedit/${j._id}`, docmodel: "JobCard", docid: j._id,
      }).catch(() => {});
      return jobShape(await myJob(id, m.partyid, m.adminid));
    },
    requestMyContractService: async (_: any, { id, message }: any, context: any) => {
      const m = await me(context);
      const c: any = await Contract.findOne({ _id: id, ...mineQ(m) }).populate("items.productserviceid", "name").lean();
      if (!c) throw new TenantError("AMC / warranty not found.", "NOT_FOUND");
      const shape = contractShape(c);
      if (shape.state === "expired" || shape.state === "cancelled") throw new TenantError("This AMC / warranty is not active. Please contact us to renew.", "BAD_USER_INPUT");
      const text = String(message || "").trim();
      if (!text) throw new TenantError("Tell us what needs service.", "BAD_USER_INPUT");
      const kind = c.contractType === "warranty" ? "Warranty" : "AMC";
      const items = shape.items.map((i: any) => [i.name, i.serial && `(${i.serial})`].filter(Boolean).join(" ")).filter(Boolean).join(", ");
      return (supportTicketResolvers as any).Mutation.addSupportTicket(_, {
        input: {
          subject: `${kind} service request${c.title ? `: ${c.title}` : ""}`.slice(0, 200),
          category: kind,
          description: `${text}\n\n${kind}: ${c.title || "-"} (${c.startdate} to ${c.enddate})${items ? `\nItems: ${items}` : ""}`,
        },
      }, context);
    },
    myJobCardPrintLink: async (_: any, { id }: any, context: any) => {
      const m = await me(context);
      await myJob(id, m.partyid, m.adminid);
      return `/print/jobcard/${jobPrintToken(id, m.partyid, m.adminid)}`;
    },
  },
};
