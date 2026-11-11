import { Types } from "mongoose";
import { AiLog, Opportunity } from "../../../models/ai";
import { Lead, Followup } from "../../../models/lead";
import { Quotation } from "../../../models/quotation";
import { SalesInvoice } from "../../../models/salesinvoice";
import { Account } from "../../../models/accounts";
import { AdminSettings } from "../../../models/adminsettings";
import { TenantError, requireBackofficeTenant } from "../../../utils/tenant";
import { assertModuleOn, isModuleOn } from "../../../utils/modulegate";
import { isActionAllowed } from "../../../utils/permissiongate";
import { notCleared } from "../../../utils/listquery";
import { aiAsk, aiConfig, type AiTool } from "../../../utils/ai";
import { findOpportunities } from "../../../utils/aifinder";
import { salesmanScorecard } from "../../../utils/scorecard";
import { getPartiesTotalDue } from "../../../utils/allocation";
import { partyTypeQuery } from "../../../utils/partytype";
import { ProductService } from "../../../models/products";
import { Insight } from "../../../models/insight";
import { leadQuery, followupQuery, stagesOf, nextLeadNumber, formatLead, LEAD_POPULATE } from "../lead";

const DAY = 86400000;
const oid = (v: any) => (v instanceof Types.ObjectId ? v : new Types.ObjectId(String(v)));
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const sid = (v: any) => (v ? String(v._id ?? v) : null);
const isoOf = (d: any) => (d ? new Date(d).toISOString() : null);
const money = (n: any) => Math.round(Number(n) || 0);

async function gate(context: any, module = "crmdashboard", action = "view") {
  const scope = await requireBackofficeTenant(context);
  const where = {
    adminid: scope.adminid,
    branchid: scope.userType === "admin" ? undefined : scope.branchid,
    staffid: scope.userType === "staff" ? scope.userId : undefined,
  };
  await assertModuleOn("crmdashboard", "CRM Dashboard", where);
  // The dashboard itself is view-only; making a lead from it needs the Leads permission.
  if (module !== "crmdashboard" && !(await isActionAllowed(module, action, where))) {
    throw new TenantError(`You do not have permission to ${action} a ${module === "leads" ? "lead" : module}.`);
  }
  return scope;
}

const oppScope = (scope: any) => {
  const q: any = { adminid: scope.adminid, status: true };
  // Saved with no branch: belongs to every branch.
  if (scope.branchid) q.$and = [{ $or: [{ branchid: scope.branchid }, { branchid: null }] }];
  return q;
};

const formatOpportunity = (o: any) => ({
  ...o,
  id: String(o._id),
  adminid: sid(o.adminid),
  branchid: sid(o.branchid),
  partyacc: sid(o.partyacc),
  leadid: sid(o.leadid),
  convertedleadid: sid(o.convertedleadid),
  dueAt: isoOf(o.dueAt),
  lastorderAt: isoOf(o.lastorderAt),
  foundAt: isoOf(o.foundAt),
  actedAt: isoOf(o.actedAt),
  createdAt: isoOf(o.createdAt),
  updatedAt: isoOf(o.updatedAt),
});

// ---------- Dashboard ----------

/** Every number the CRM dashboard shows, in one pass. */
async function crmDashboard(scope: any, days: number) {
  const since = new Date(Date.now() - days * DAY);
  const sinceYmd = ymd(since);
  const today = ymd(new Date());
  const dayEnd = new Date(`${today}T23:59:59.999+05:30`);
  const dayStart = new Date(`${today}T00:00:00+05:30`);

  const stages = await stagesOf(scope.adminid);
  const closed = stages.filter((s: any) => s.kind !== "open").map((s: any) => s.key);
  const lost = stages.filter((s: any) => s.kind === "lost").map((s: any) => s.key);
  const won = stages.filter((s: any) => s.kind === "won").map((s: any) => s.key);
  const leadBase = { ...(await leadQuery(scope)), status: true };
  const fupBase = { ...(await followupQuery(scope)), status: true };
  const quoteBase: any = { adminid: scope.adminid, status: true };
  if (scope.branchid) quoteBase.$and = [{ $or: [{ branchid: scope.branchid }, { branchid: null }] }];

  const [byStage, bySource, trend, fresh, wonAgg, fupDue, fupOverdue, fupDone, quotes, openOpps, hot, todayCalls] = await Promise.all([
    Lead.aggregate([{ $match: leadBase }, { $group: { _id: "$stage", n: { $sum: 1 }, value: { $sum: { $ifNull: ["$expectedvalue", 0] } } } }]),
    Lead.aggregate([
      { $match: { ...leadBase, createdAt: { $gte: since } } },
      { $group: { _id: { $ifNull: ["$source", "Other"] }, n: { $sum: 1 } } },
      { $sort: { n: -1 } }, { $limit: 8 },
    ]),
    Lead.aggregate([
      { $match: { ...leadBase, createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "+05:30" } }, n: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Lead.countDocuments({ ...leadBase, createdAt: { $gte: since } }),
    Lead.aggregate([
      { $match: { ...leadBase, stage: { $in: won }, closedAt: { $gte: since } } },
      { $group: { _id: null, n: { $sum: 1 }, value: { $sum: { $ifNull: ["$expectedvalue", 0] } } } },
    ]),
    Followup.countDocuments({ ...fupBase, doneAt: null, dueAt: { $gte: dayStart, $lte: dayEnd } }),
    Followup.countDocuments({ ...fupBase, doneAt: null, dueAt: { $lt: dayStart } }),
    Followup.countDocuments({ ...fupBase, doneAt: { $gte: since } }),
    Quotation.aggregate([
      { $match: { ...quoteBase, billdate: { $gte: sinceYmd } } },
      { $group: { _id: "$quotationStatus", n: { $sum: 1 }, value: { $sum: { $ifNull: ["$totalamount", 0] } } } },
    ]),
    Opportunity.aggregate([
      { $match: { ...oppScope(scope), state: "open" } },
      { $group: { _id: "$kind", n: { $sum: 1 }, value: { $sum: { $ifNull: ["$value", 0] } } } },
    ]),
    Lead.find({ ...leadBase, stage: { $nin: closed } }).sort({ expectedvalue: -1, createdAt: -1 }).limit(8).populate(LEAD_POPULATE).lean(),
    Followup.find({ ...fupBase, doneAt: null, dueAt: { $lte: dayEnd } }).sort({ dueAt: 1 }).limit(10)
      .populate({ path: "leadid", select: "name company mobile city stage" }).lean(),
  ]);

  const stageRows: any[] = stages.map((s: any) => {
    const hit = byStage.find((r: any) => r._id === s.key);
    return { key: s.key, label: s.label, kind: s.kind, count: hit?.n || 0, value: money(hit?.value) };
  });
  const openCount = stageRows.filter((s: any) => s.kind === "open").reduce((n: number, s: any) => n + s.count, 0);
  const lostCount = byStage.filter((r: any) => lost.includes(r._id)).reduce((n: number, r: any) => n + r.n, 0);
  const wonCount = wonAgg[0]?.n || 0;
  const quoteOf = (k: string) => quotes.find((q: any) => q._id === k) || { n: 0, value: 0 };
  const quoteSent = quotes.reduce((n: number, q: any) => n + q.n, 0);
  const quoteAccepted = quoteOf("accepted").n + quoteOf("converted").n;

  return {
    days,
    openLeads: openCount,
    newLeads: fresh,
    wonLeads: wonCount,
    lostLeads: lostCount,
    wonValue: money(wonAgg[0]?.value),
    // Of the leads closed in the period, how many were won.
    conversion: wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0,
    followupsDueToday: fupDue,
    followupsOverdue: fupOverdue,
    followupsDone: fupDone,
    quotationsSent: quoteSent,
    quotationsValue: money(quotes.reduce((n: number, q: any) => n + q.value, 0)),
    quotationsAccepted: quoteAccepted,
    quotationsAcceptedValue: money(quoteOf("accepted").value + quoteOf("converted").value),
    quoteWinRate: quoteSent > 0 ? Math.round((quoteAccepted / quoteSent) * 100) : 0,
    opportunities: openOpps.reduce((n: number, o: any) => n + o.n, 0),
    opportunityValue: money(openOpps.reduce((n: number, o: any) => n + o.value, 0)),
    stages: stageRows,
    sources: bySource.map((s: any) => ({ label: String(s._id), count: s.n })),
    trend: trend.map((t: any) => ({ date: t._id, count: t.n })),
    opportunityKinds: openOpps.map((o: any) => ({ kind: String(o._id), count: o.n, value: money(o.value) })),
    hotLeads: hot.map(formatLead),
    todayFollowups: todayCalls.map((f: any) => ({
      id: String(f._id),
      dueAt: isoOf(f.dueAt),
      type: f.type,
      note: f.note,
      overdue: new Date(f.dueAt).getTime() < dayStart.getTime(),
      leadid: f.leadid ? { id: String(f.leadid._id), name: f.leadid.name, company: f.leadid.company, mobile: f.leadid.mobile, city: f.leadid.city } : null,
    })),
  };
}

// ---------- Agent ----------

const SYSTEM = `You are the business assistant inside a billing and CRM system used by small businesses in India.
You answer about sales, customers, payments, stock, staff and leads.
Answer only from the tools. Never invent a number, a name or a mobile number; if a tool returns nothing, say so plainly.
Reply in the language and script the user wrote in: English, Hindi, Hinglish, Gujarati (ગુજરાતી) or Gujarati typed in English letters. In 2-6 short lines. Amounts in rupees.
You may suggest what to do next, but you cannot send anything or change any record: the staff taps to do that.
When the user asks for a message to a customer, write the message itself, ready to copy.`;

/** Read-only tools, already scoped to this login's tenant and branch. */
async function agentTools(scope: any): Promise<AiTool[]> {
  const leadBase = async () => ({ ...(await leadQuery(scope)), status: true });
  const where = {
    adminid: scope.adminid,
    branchid: scope.userType === "admin" ? undefined : scope.branchid,
    staffid: scope.userType === "staff" ? scope.userId : undefined,
  };
  // The agent may only read what this login could open itself.
  const [canLeads, canSales, canPayments, canStock, canStaff] = await Promise.all([
    isActionAllowed("leads", "view", where),
    isActionAllowed("salesinvoice", "view", where),
    isActionAllowed("payments", "view", where),
    isActionAllowed("products", "view", where),
    isActionAllowed("reports.salesmen", "view", where),
  ]);
  const billQuery = (days: number) => {
    const q: any = { adminid: oid(scope.adminid), status: true, cancelStatus: { $ne: "cancelled" }, billdate: { $gte: ymd(new Date(Date.now() - days * DAY)) } };
    if (scope.branchid) q.branchid = oid(scope.branchid);
    return q;
  };
  const crmTools: AiTool[] = [
    {
      name: "crm_summary",
      description: "Counts and value for leads, follow ups and quotations over the last N days.",
      parameters: { type: "object", properties: { days: { type: "integer", description: "How many days back, default 30" } } },
      run: async (a) => {
        const d = await crmDashboard(scope, Math.min(Math.max(Number(a?.days) || 30, 1), 365));
        return {
          days: d.days, openLeads: d.openLeads, newLeads: d.newLeads, wonLeads: d.wonLeads, lostLeads: d.lostLeads,
          wonValue: d.wonValue, conversionPercent: d.conversion, followupsDueToday: d.followupsDueToday,
          followupsOverdue: d.followupsOverdue, quotationsSent: d.quotationsSent, quotationsValue: d.quotationsValue,
          quotationsAccepted: d.quotationsAccepted, quoteWinRatePercent: d.quoteWinRate,
          byStage: d.stages.map((s: any) => ({ stage: s.label, count: s.count })),
          bySource: d.sources,
        };
      },
    },
    {
      name: "list_leads",
      description: "Open leads, biggest expected value first. Use overdue:true for leads whose follow up is past due.",
      parameters: {
        type: "object",
        properties: {
          overdue: { type: "boolean" },
          stage: { type: "string", description: "Stage key, e.g. new, contacted, quotation" },
          source: { type: "string" },
          limit: { type: "integer" },
        },
      },
      run: async (a) => {
        const stages = await stagesOf(scope.adminid);
        const closed = stages.filter((s: any) => s.kind !== "open").map((s: any) => s.key);
        const q: any = { ...(await leadBase()), stage: { $nin: closed } };
        if (a?.stage) q.stage = a.stage;
        if (a?.source) q.source = new RegExp(String(a.source), "i");
        if (a?.overdue) q.$or = [{ nextfollowupAt: null }, { nextfollowupAt: { $lt: new Date() } }];
        const rows: any[] = await Lead.find(q).sort({ expectedvalue: -1, createdAt: -1 })
          .limit(Math.min(Number(a?.limit) || 10, 25))
          .select("name company mobile city stage source expectedvalue requirement nextfollowupAt").lean();
        return rows.map((l) => ({
          name: l.company || l.name, contact: l.name, mobile: l.mobile, city: l.city, stage: l.stage,
          source: l.source, expectedValue: money(l.expectedvalue), wants: l.requirement,
          nextFollowUp: isoOf(l.nextfollowupAt),
        }));
      },
    },
    {
      name: "list_opportunities",
      description: "Customers worth calling, found in the business's own data: dormant customers, cold quotations, overdue follow ups, AMC due, service due.",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", description: "dormant, coldquote, nofollowup, amcdue or servicedue" },
          limit: { type: "integer" },
        },
      },
      run: async (a) => {
        const q: any = { ...oppScope(scope), state: "open" };
        if (a?.kind) q.kind = String(a.kind);
        const rows: any[] = await Opportunity.find(q).sort({ score: -1 }).limit(Math.min(Number(a?.limit) || 10, 25))
          .select("kind name mobile city title reason score value dueAt").lean();
        return rows.map((o) => ({ kind: o.kind, name: o.name, mobile: o.mobile, city: o.city, why: o.reason, score: o.score, value: money(o.value), dueAt: isoOf(o.dueAt) }));
      },
    },
    {
      name: "list_followups",
      description: "Follow ups that are due. when: today, overdue or upcoming.",
      parameters: { type: "object", properties: { when: { type: "string" }, limit: { type: "integer" } } },
      run: async (a) => {
        const today = ymd(new Date());
        const start = new Date(`${today}T00:00:00+05:30`);
        const end = new Date(`${today}T23:59:59.999+05:30`);
        const q: any = { ...(await followupQuery(scope)), status: true, doneAt: null };
        if (a?.when === "overdue") q.dueAt = { $lt: start };
        else if (a?.when === "upcoming") q.dueAt = { $gt: end };
        else q.dueAt = { $gte: start, $lte: end };
        const rows: any[] = await Followup.find(q).sort({ dueAt: 1 }).limit(Math.min(Number(a?.limit) || 10, 25))
          .populate({ path: "leadid", select: "name company mobile city" }).select("dueAt type note leadid").lean();
        return rows.map((f) => ({
          dueAt: isoOf(f.dueAt), type: f.type, note: f.note,
          lead: f.leadid ? { name: f.leadid.company || f.leadid.name, mobile: f.leadid.mobile, city: f.leadid.city } : null,
        }));
      },
    },
  ];

  const salesTools: AiTool[] = [
    {
      name: "top_customers",
      description: "Best customers by billed value over the last N days.",
      parameters: { type: "object", properties: { days: { type: "integer" }, limit: { type: "integer" } } },
      run: async (a) => {
        const since = ymd(new Date(Date.now() - (Number(a?.days) || 90) * DAY));
        const q: any = { adminid: oid(scope.adminid), status: true, cancelStatus: { $ne: "cancelled" }, billdate: { $gte: since } };
        if (scope.branchid) q.branchid = oid(scope.branchid);
        const rows: any[] = await SalesInvoice.aggregate([
          { $match: q },
          { $group: { _id: "$partyacc", total: { $sum: "$totalamount" }, bills: { $sum: 1 } } },
          { $sort: { total: -1 } }, { $limit: Math.min(Number(a?.limit) || 10, 25) },
        ]);
        const parties = await Account.find({ _id: { $in: rows.map((r) => r._id) } }).select("name mobile city").lean();
        const byId = new Map(parties.map((p: any) => [String(p._id), p]));
        return rows.map((r) => {
          const p: any = byId.get(String(r._id)) || {};
          return { name: p.name, mobile: p.mobile, city: p.city, billed: money(r.total), bills: r.bills };
        });
      },
    },
    {
      name: "sales_summary",
      description: "Sales over the last N days: billed value, bills, average bill, best selling items, and how it compares with the N days before.",
      parameters: { type: "object", properties: { days: { type: "integer", description: "How many days back, default 30" } } },
      run: async (a) => {
        const days = Math.min(Math.max(Number(a?.days) || 30, 1), 365);
        const [now, before, items] = await Promise.all([
          SalesInvoice.aggregate([{ $match: billQuery(days) }, { $group: { _id: null, total: { $sum: "$totalamount" }, bills: { $sum: 1 }, parties: { $addToSet: "$partyacc" } } }]),
          SalesInvoice.aggregate([
            { $match: { ...billQuery(days * 2), billdate: { $gte: ymd(new Date(Date.now() - days * 2 * DAY)), $lt: ymd(new Date(Date.now() - days * DAY)) } } },
            { $group: { _id: null, total: { $sum: "$totalamount" }, bills: { $sum: 1 } } },
          ]),
          SalesInvoice.aggregate([
            { $match: billQuery(days) },
            { $unwind: "$productservice" },
            { $group: { _id: "$productservice.productserviceid", qty: { $sum: "$productservice.qty" }, amount: { $sum: "$productservice.amount" } } },
            { $sort: { amount: -1 } }, { $limit: 5 },
          ]),
        ]);
        const n = now[0] || { total: 0, bills: 0, parties: [] };
        const b = before[0] || { total: 0, bills: 0 };
        const names = await ProductService.find({ _id: { $in: items.map((i: any) => i._id) } }).select("name").lean();
        const nameBy = new Map(names.map((x: any) => [String(x._id), x.name]));
        return {
          days,
          billed: money(n.total),
          bills: n.bills,
          customers: (n.parties || []).length,
          averageBill: money(n.bills ? n.total / n.bills : 0),
          previousPeriodBilled: money(b.total),
          changePercent: b.total ? Math.round(((n.total - b.total) / b.total) * 100) : null,
          topItems: items.map((i: any) => ({ name: nameBy.get(String(i._id)), qty: Math.round(Number(i.qty)), amount: money(i.amount) })),
        };
      },
    },
  ];

  const paymentTools: AiTool[] = [
    {
      name: "outstanding",
      description: "Customers who still owe money, biggest first, with how many bills are open.",
      parameters: { type: "object", properties: { limit: { type: "integer" } } },
      run: async (a) => {
        const parties: any[] = await Account.find({ admin: scope.adminid, status: true, type: partyTypeQuery("customer") }).select("name mobile city").limit(2000).lean();
        if (!parties.length) return [];
        const dues = await getPartiesTotalDue({ partyids: parties.map((p) => p._id), adminid: scope.adminid });
        return parties
          .map((p) => ({ name: p.name, mobile: p.mobile, city: p.city, due: Number(dues[String(p._id)] || 0) }))
          .filter((p) => p.due > 1)
          .sort((x, y) => y.due - x.due)
          .slice(0, Math.min(Number(a?.limit) || 10, 25))
          .map((p) => ({ ...p, due: money(p.due) }));
      },
    },
  ];

  const stockTools: AiTool[] = [
    {
      name: "stock_alerts",
      description: "Items about to run out, from what they actually sell per day, and what is in stock now.",
      parameters: { type: "object", properties: { limit: { type: "integer" } } },
      run: async (a) => {
        const rows: any[] = await Insight.find({ adminid: scope.adminid, status: true, state: "open", kind: "stockout" })
          .sort({ value: -1 }).limit(Math.min(Number(a?.limit) || 10, 25)).select("name title reason value").lean();
        return rows.map((r) => ({ item: r.name, status: r.title, detail: r.reason, monthlySalesAtRisk: money(r.value) }));
      },
    },
  ];

  const staffTools: AiTool[] = [
    {
      name: "salesman_performance",
      description: "How each salesman did over the last N days: billed value, bills, customers, and the discount they gave.",
      parameters: { type: "object", properties: { days: { type: "integer" } } },
      run: async (a) => {
        const days = Math.min(Math.max(Number(a?.days) || 30, 1), 365);
        const rows = await salesmanScorecard(scope, days);
        return rows.map((r: any) => ({
          name: r.name, billed: money(r.billed), bills: r.bills, customers: r.customers,
          newCustomers: r.newCustomers, discountGiven: money(r.discount), discountPercent: r.discountPercent,
        }));
      },
    },
  ];

  const pulseTools: AiTool[] = [
    {
      name: "business_pulse",
      description: "What needs attention now: customers buying less, payments running late, items a customer stopped buying.",
      parameters: { type: "object", properties: { kind: { type: "string", description: "slipping, paymentrisk or stoppeditem" }, limit: { type: "integer" } } },
      run: async (a) => {
        const q: any = { adminid: scope.adminid, status: true, state: "open", kind: { $ne: "stockout" } };
        if (a?.kind) q.kind = String(a.kind);
        const rows: any[] = await Insight.find(q).sort({ value: -1 }).limit(Math.min(Number(a?.limit) || 10, 25))
          .select("kind name mobile city title reason value").lean();
        return rows.map((r) => ({ kind: r.kind, name: r.name, mobile: r.mobile, city: r.city, what: r.title, why: r.reason, value: money(r.value) }));
      },
    },
  ];

  return [
    ...(canLeads ? crmTools : []),
    ...(canSales ? [...salesTools, ...pulseTools] : []),
    ...(canPayments ? paymentTools : []),
    ...(canStock ? stockTools : []),
    ...(canStaff ? staffTools : []),
  ];
}

// ---------- Resolver ----------

export const aiResolvers = {
  Query: {
    getCrmDashboard: async (_: any, { days = 30 }: any, context: any) => {
      const scope = await gate(context);
      return crmDashboard(scope, Math.min(Math.max(Number(days) || 30, 1), 365));
    },

    getOpportunities: async (_: any, { kind, state = "open", limit = 50 }: any, context: any) => {
      const scope = await gate(context);
      const q: any = { ...oppScope(scope), state };
      if (kind) q.kind = kind;
      const rows = await Opportunity.find(q).sort({ score: -1, dueAt: 1 }).limit(Math.min(Number(limit) || 50, 200)).lean();
      return rows.map(formatOpportunity);
    },

    getAiStatus: async (_: any, __: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const c = await aiConfig(scope.adminid);
      const s: any = await AdminSettings.getOrCreateForAdmin(scope.adminid);
      return {
        on: c.on && !c.reason,
        enabled: c.on,
        agentOn: s?.aiAgentOn !== false,
        hasKey: !!c.key,
        keysource: c.keysource || null,
        model: c.model,
        cap: c.cap,
        used: c.used,
        left: c.left,
        reason: c.reason || null,
      };
    },

    getAiLogs: async (_: any, { limit = 50 }: any, context: any) => {
      const scope = await gate(context);
      const rows = await AiLog.find({ adminid: scope.adminid }).sort({ createdAt: -1 }).limit(Math.min(Number(limit) || 50, 200)).lean();
      return rows.map((l: any) => ({ ...l, id: String(l._id), createdAt: isoOf(l.createdAt) }));
    },
  },

  Mutation: {
    // Re-runs the finders; safe to call as often as the screen likes.
    refreshOpportunities: async (_: any, __: any, context: any) => {
      const scope = await gate(context);
      const stages = await stagesOf(scope.adminid);
      const out = await findOpportunities(scope.adminid, { closedStages: stages.filter((s: any) => s.kind !== "open").map((s: any) => s.key) });
      return { found: out.found, kinds: Object.entries(out.kinds).map(([kind, count]) => ({ kind, count: Number(count), value: 0 })) };
    },

    setOpportunityState: async (_: any, { id, state }: any, context: any) => {
      const scope = await gate(context);
      if (!["open", "done", "dismissed"].includes(state)) throw new Error("Unknown state.");
      const o: any = await Opportunity.findById(id).lean();
      if (!o || String(o.adminid) !== String(scope.adminid)) throw new TenantError("Not found.", "BAD_USER_INPUT");
      await Opportunity.updateOne({ _id: o._id }, { $set: { state, actedby_name: context?.user?.name || context?.user?.email, actedAt: new Date() } });
      const next: any = await Opportunity.findById(o._id).lean();
      return formatOpportunity(next);
    },

    /** Turns a found opportunity into a real lead, so the usual follow-up flow takes over. */
    convertOpportunityToLead: async (_: any, { id }: any, context: any) => {
      const scope = await gate(context, "leads", "add");
      const o: any = await Opportunity.findById(id).lean();
      if (!o || String(o.adminid) !== String(scope.adminid)) throw new TenantError("Not found.", "BAD_USER_INPUT");
      if (o.convertedleadid) return formatLead(await Lead.findById(o.convertedleadid).populate(LEAD_POPULATE).lean());
      const stages = await stagesOf(scope.adminid);
      const created: any = await Lead.create({
        adminid: scope.adminid,
        branchid: scope.branchid || o.branchid || undefined,
        leadnumber: await nextLeadNumber(scope.adminid),
        name: o.name || "Customer",
        mobile: o.mobile,
        city: o.city,
        source: "AI Opportunity",
        subsource: o.kind,
        requirement: o.title,
        notes: o.reason,
        expectedvalue: o.value || undefined,
        stage: stages[0]?.key,
        partyid: o.partyacc || undefined,
        createdby_id: context?.user?.id ? String(context.user.id) : undefined,
        createdby_name: context?.user?.name || context?.user?.email,
        createdby_type: context?.user?.type || "admin",
      });
      await Opportunity.updateOne({ _id: o._id }, { $set: { state: "converted", convertedleadid: created._id, actedAt: new Date(), actedby_name: context?.user?.name || context?.user?.email } });
      return formatLead(await Lead.findById(created._id).populate(LEAD_POPULATE).lean());
    },

    /** The dashboard agent: answers from this tenant's data only. */
    askAi: async (_: any, { question }: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const where = {
        adminid: scope.adminid,
        branchid: scope.userType === "admin" ? undefined : scope.branchid,
        staffid: scope.userType === "staff" ? scope.userId : undefined,
      };
      // Reached from the CRM dashboard and from the main dashboard; either is enough.
      if (!(await isModuleOn("crmdashboard", where)) && !(await isModuleOn("reports.pulse", where))) {
        throw new TenantError("The assistant is not switched on for this business.");
      }
      const q = String(question || "").trim();
      if (!q) throw new Error("Type a question first.");
      const s: any = await AdminSettings.getOrCreateForAdmin(scope.adminid);
      if (s?.aiAgentOn === false) return { ok: false, answer: "", steps: [], reason: "The AI agent is switched off for this business." };
      const today = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
      const r = await aiAsk(scope.adminid, {
        task: "ask",
        system: `${SYSTEM}\nToday is ${today}.`,
        prompt: q,
        question: q,
        tools: await agentTools(scope),
        user: context?.user,
        branchid: scope.branchid,
        maxSteps: 5,
      });
      return { ok: r.ok, answer: r.text, steps: r.steps.map((x) => x.tool), reason: r.reason || null };
    },

    /** Pulls product, quantity, city and budget out of a pasted enquiry. */
    aiReadInquiry: async (_: any, { text }: any, context: any) => {
      const scope = await gate(context);
      const body = String(text || "").trim();
      if (!body) throw new Error("Paste the enquiry text first.");
      const r = await aiAsk(scope.adminid, {
        task: "readinquiry",
        json: true,
        system: "Pull contact and requirement details out of a customer enquiry. The text may be English, Hindi, Hinglish or Gujarati, in any script. Return only fields you actually find; leave the rest null. Never invent a mobile number.",
        prompt: `Return JSON with keys: name, company, mobile, email, city, state, requirement, qty (number or null), expectedvalue (number or null), temperature ("hot","warm" or "cold"), score (0-100), reason (one short line on why that score).\n\nEnquiry:\n${body.slice(0, 4000)}`,
        user: context?.user,
        branchid: scope.branchid,
      });
      if (!r.ok || !r.data) return { ok: false, reason: r.reason || "The AI could not read that text.", fields: null };
      const d = r.data;
      return {
        ok: true,
        reason: null,
        fields: {
          name: d.name ?? null, company: d.company ?? null, mobile: d.mobile ?? null, email: d.email ?? null,
          city: d.city ?? null, state: d.state ?? null, requirement: d.requirement ?? null,
          qty: typeof d.qty === "number" ? d.qty : null,
          expectedvalue: typeof d.expectedvalue === "number" ? d.expectedvalue : null,
          temperature: d.temperature ?? null,
          score: typeof d.score === "number" ? d.score : null,
          scorereason: d.reason ?? null,
        },
      };
    },

    /** A message for one lead, ready for the staff to read and send. */
    aiDraftMessage: async (_: any, { leadid, channel = "whatsapp", instruction }: any, context: any) => {
      const scope = await gate(context);
      const l: any = await Lead.findOne({ ...(await leadQuery(scope)), _id: leadid }).lean();
      if (!l) throw new TenantError("Lead not found.", "BAD_USER_INPUT");
      const s: any = await AdminSettings.getOrCreateForAdmin(scope.adminid);
      const quotes: any[] = await Quotation.find({ adminid: scope.adminid, leadid: l._id, status: true })
        .select("billnumber totalamount billdate quotationStatus").sort({ createdAt: -1 }).limit(3).lean();
      const facts = {
        name: l.name, company: l.company, city: l.city, requirement: l.requirement,
        wants: (l.products || []).map((p: any) => p.name).filter(Boolean),
        expectedValue: l.expectedvalue, stage: l.stage, lastContact: isoOf(l.lastcontactAt),
        quotations: quotes.map((q) => ({ number: q.billnumber, amount: money(q.totalamount), date: q.billdate, status: q.quotationStatus })),
        ourBusiness: s?.legalName || s?.tradeName || "",
      };
      const r = await aiAsk(scope.adminid, {
        task: "draftmessage",
        system: `Write one short follow-up message a small-business owner in India would actually send on ${channel === "email" ? "email" : channel === "call" ? "a phone call (a short script)" : "WhatsApp"}. Polite, specific, no filler, no emoji unless it fits WhatsApp. Use only the facts given. Never invent prices or dates. Match the customer's likely language from their city and details - Gujarati for Gujarat, Hindi elsewhere in the north, otherwise English - and write it in the script that customer would read most easily. Return the message text only.`,
        prompt: `${instruction ? `What the sender wants to say: ${String(instruction).slice(0, 300)}\n\n` : ""}Lead details:\n${JSON.stringify(facts)}`,
        user: context?.user,
        branchid: scope.branchid,
      });
      return { ok: r.ok, text: r.text, reason: r.reason || null };
    },

    /** The same, for a found opportunity; the draft is saved on the row. */
    aiDraftForOpportunity: async (_: any, { id }: any, context: any) => {
      const scope = await gate(context);
      const o: any = await Opportunity.findById(id).lean();
      if (!o || String(o.adminid) !== String(scope.adminid)) throw new TenantError("Not found.", "BAD_USER_INPUT");
      const s: any = await AdminSettings.getOrCreateForAdmin(scope.adminid);
      const r = await aiAsk(scope.adminid, {
        task: "draftmessage",
        system: "Write one short WhatsApp message a small-business owner in India would send to win this customer back or move the deal on. Polite, specific, under 40 words, no emoji, no invented prices. Return the message text only.",
        prompt: JSON.stringify({ customer: o.name, city: o.city, why: o.reason, about: o.title, ourBusiness: s?.legalName || s?.tradeName || "" }),
        user: context?.user,
        branchid: scope.branchid,
      });
      if (r.ok && r.text) await Opportunity.updateOne({ _id: o._id }, { $set: { draftmessage: r.text } });
      return { ok: r.ok, text: r.text || o.draftmessage || "", reason: r.reason || null };
    },
  },
};

export const opportunityCleanup = { model: "Opportunity", tenant: "adminid", notCleared };
