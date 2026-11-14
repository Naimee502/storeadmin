import { SupportTicket, TICKET_PRIORITIES, TICKET_STATUSES } from "../../../models/supportticket";
import { Account } from "../../../models/accounts";
import { StaffAccount } from "../../../models/staffaccounts";
import { pushNotification } from "../../../models/notifications";
import { resolveTenant, TenantError } from "../../../utils/tenant";
import { isActionAllowed } from "../../../utils/permissiongate";

const bad = (msg: string) => new TenantError(msg, "BAD_USER_INPUT");
const iso = (d: any) => (d ? new Date(d).toISOString() : null);

// Who is calling: a back-office login, or a party (customer) seeing only their own tickets.
const callerOf = async (context: any) => {
  const scope = await resolveTenant(context);
  const isParty = scope.mode === "public";
  if (isParty && context?.user?.type !== "party") throw new TenantError("Please sign in.", "UNAUTHENTICATED");
  let name = "";
  const id = context.user?.id;
  if (context.user?.type === "staff") name = ((await StaffAccount.findById(id).select("name").lean()) as any)?.name || "";
  else if (isParty) name = ((await Account.findById(id).select("name").lean()) as any)?.name || "";
  else name = context.user?.name || context.user?.type || "";
  return { scope, isParty, who: { id, type: context.user?.type, name } };
};

const shape = (t: any, isParty: boolean) => ({
  ...t,
  id: String(t._id),
  party: t.partyid ? { id: String(t.partyid._id ?? t.partyid), name: t.partyid.name ?? null } : null,
  assignedto: t.assignedto ? { id: String(t.assignedto._id ?? t.assignedto), name: t.assignedto.name ?? null } : null,
  raisedby: t.raisedby?.id ? { id: String(t.raisedby.id), name: t.raisedby.name } : null,
  comments: (t.comments || [])
    .filter((c: any) => !(isParty && c.internal))
    .map((c: any) => ({ ...c, id: String(c._id), createdAt: iso(c.createdAt) })),
  resolvedAt: iso(t.resolvedAt),
  createdAt: iso(t.createdAt),
  updatedAt: iso(t.updatedAt),
});

const load = async (id: any, adminid: any) =>
  SupportTicket.findOne({ _id: id, adminid }).populate("partyid", "name").populate("assignedto", "name").lean();

// A party may only touch its own tickets.
const mine = async (id: any, c: any) => {
  const t: any = await load(id, c.scope.adminid);
  if (!t || (c.isParty && String(t.partyid?._id ?? t.partyid) !== String(c.who.id))) throw new TenantError("Ticket not found.", "NOT_FOUND");
  return t;
};

const nextNumber = async (adminid: any) => {
  const top: any = await SupportTicket.findOne({ adminid }).sort({ createdAt: -1, _id: -1 }).select("ticketno").lean();
  const n = parseInt(String(top?.ticketno || "").replace(/\D/g, ""), 10) || 0;
  return `TKT-${String(n + 1).padStart(6, "0")}`;
};

const cleanInput = async (input: any, adminid: any) => {
  const subject = String(input?.subject || "").trim();
  if (!subject) throw bad("Subject is required.");
  const priority = input?.priority || "normal";
  if (!(TICKET_PRIORITIES as readonly string[]).includes(priority)) throw bad("Choose a valid priority.");
  if (input?.partyid && !(await Account.exists({ _id: input.partyid, admin: adminid }))) throw bad("That party is not part of this business.");
  if (input?.assignedto && !(await StaffAccount.exists({ _id: input.assignedto, admin: adminid }))) throw bad("That staff member is not part of this business.");
  return {
    subject: subject.slice(0, 200),
    description: String(input?.description || "").slice(0, 5000),
    category: String(input?.category || "").slice(0, 60),
    priority,
    partyid: input?.partyid || null,
    assignedto: input?.assignedto || null,
  };
};

const tellStaff = (t: any, title: string) =>
  t.assignedto
    ? pushNotification({ adminid: t.adminid, targettype: "staff", targetid: t.assignedto._id ?? t.assignedto, ntype: "supportticket", title, message: `${t.ticketno} • ${t.subject}`, webpath: `/supporttickets/addedit/${t._id}`, docmodel: "SupportTicket", docid: t._id }).catch(() => {})
    : null;
const tellParty = (t: any, title: string) =>
  t.partyid
    ? pushNotification({ adminid: t.adminid, targettype: "party", targetid: t.partyid._id ?? t.partyid, ntype: "supportticket", title, message: `${t.ticketno} • ${t.subject}`, docmodel: "SupportTicket", docid: t._id }).catch(() => {})
    : null;

export const supportTicketResolvers = {
  Query: {
    getSupportTickets: async (_: any, { filter = {} }: any, context: any) => {
      const c = await callerOf(context);
      const q: any = { adminid: c.scope.adminid, status: !filter.deleted };
      if (filter.deleted) q.cleared = { $ne: true };
      if (filter.ticketstatus) q.ticketstatus = filter.ticketstatus;
      if (filter.assignedto) q.assignedto = filter.assignedto;
      if (c.isParty) q.partyid = c.who.id;
      else if (filter.partyid) q.partyid = filter.partyid;
      const rows = await SupportTicket.find(q).sort({ createdAt: -1 }).limit(1000).populate("partyid", "name").populate("assignedto", "name").lean();
      return rows.map((t) => shape(t, c.isParty));
    },
    getSupportTicketById: async (_: any, { id }: any, context: any) => {
      const c = await callerOf(context);
      return shape(await mine(id, c), c.isParty);
    },
  },
  Mutation: {
    addSupportTicket: async (_: any, { input }: any, context: any) => {
      const c = await callerOf(context);
      if (!c.isParty && c.scope.userType !== "admin") {
        const ok = await isActionAllowed("supporttickets", "add", { adminid: c.scope.adminid, branchid: c.scope.branchid, staffid: c.scope.userType === "staff" ? c.scope.userId : undefined });
        if (!ok) throw new TenantError("You do not have add permission for Support Tickets.", "FORBIDDEN");
      }
      const data = await cleanInput(input, c.scope.adminid);
      if (c.isParty) { data.partyid = c.who.id; data.assignedto = null; }
      let created: any = null;
      for (let i = 0; i < 5 && !created; i += 1) {
        try {
          created = await SupportTicket.create({
            ...data, adminid: c.scope.adminid, branchid: c.scope.branchid, ticketno: await nextNumber(c.scope.adminid), raisedby: c.who,
          });
        } catch (e: any) { if (e?.code !== 11000) throw e; } // number taken by a parallel save: try the next one
      }
      if (!created) throw bad("Could not number the ticket. Please try again.");
      const t: any = await load(created._id, c.scope.adminid);
      if (c.isParty) {
        pushNotification({ adminid: t.adminid, targettype: "admin", ntype: "supportticket", title: `New ticket from ${c.who.name || "a customer"}`, message: `${t.ticketno} • ${t.subject}`, webpath: `/supporttickets/addedit/${t._id}`, docmodel: "SupportTicket", docid: t._id }).catch(() => {});
      } else tellStaff(t, "Ticket assigned to you");
      return shape(t, c.isParty);
    },
    editSupportTicket: async (_: any, { id, input }: any, context: any) => {
      const c = await callerOf(context);
      if (c.isParty) throw new TenantError("Only the business can edit a ticket.", "FORBIDDEN");
      const before: any = await mine(id, c);
      if (before.status === false) throw bad("This ticket is deleted. Restore it first to edit it.");
      const data = await cleanInput(input, c.scope.adminid);
      await SupportTicket.updateOne({ _id: id }, { $set: data });
      const t: any = await load(id, c.scope.adminid);
      if (String(before.assignedto?._id ?? "") !== String(t.assignedto?._id ?? "")) tellStaff(t, "Ticket assigned to you");
      return shape(t, false);
    },
    setSupportTicketStatus: async (_: any, { id, ticketstatus }: any, context: any) => {
      const c = await callerOf(context);
      if (!(TICKET_STATUSES as readonly string[]).includes(ticketstatus)) throw bad("Choose a valid status.");
      // A party may only close its own ticket or reopen it.
      if (c.isParty && !["closed", "open"].includes(ticketstatus)) throw new TenantError("You can only close or reopen your ticket.", "FORBIDDEN");
      const before: any = await mine(id, c);
      if (before.status === false) throw bad("This ticket is deleted. Restore it first.");
      const done = ticketstatus === "resolved" || ticketstatus === "closed";
      await SupportTicket.updateOne({ _id: id }, { $set: { ticketstatus, resolvedAt: done ? before.resolvedAt || new Date() : null } });
      const t: any = await load(id, c.scope.adminid);
      if (!c.isParty && before.ticketstatus !== ticketstatus) tellParty(t, `Ticket ${t.ticketno} is now ${ticketstatus === "inprogress" ? "in progress" : ticketstatus}`);
      return shape(t, c.isParty);
    },
    addSupportTicketComment: async (_: any, { id, text, internal }: any, context: any) => {
      const c = await callerOf(context);
      const body = String(text || "").trim();
      if (!body) throw bad("Write a comment first.");
      const before: any = await mine(id, c);
      if (before.status === false) throw bad("This ticket is deleted.");
      const hidden = !c.isParty && !!internal;
      await SupportTicket.updateOne(
        { _id: id },
        { $push: { comments: { text: body.slice(0, 5000), byid: c.who.id, bytype: c.who.type, byname: c.who.name, internal: hidden } } }
      );
      const t: any = await load(id, c.scope.adminid);
      if (c.isParty) tellStaff(t, "Customer replied on a ticket");
      else if (!hidden) tellParty(t, `Reply on ticket ${t.ticketno}`);
      return shape(t, c.isParty);
    },
    deleteSupportTicket: async (_: any, { id }: any, context: any) => {
      const c = await callerOf(context);
      if (c.isParty) throw new TenantError("Only the business can delete a ticket.", "FORBIDDEN");
      return !!(await SupportTicket.findOneAndUpdate({ _id: id, adminid: c.scope.adminid }, { $set: { status: false } }));
    },
    resetSupportTicket: async (_: any, { id }: any, context: any) => {
      const c = await callerOf(context);
      if (c.isParty) throw new TenantError("Only the business can restore a ticket.", "FORBIDDEN");
      return !!(await SupportTicket.findOneAndUpdate({ _id: id, adminid: c.scope.adminid }, { $set: { status: true } }));
    },
  },
};
