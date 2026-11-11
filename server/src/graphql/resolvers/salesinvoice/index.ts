import { sortLinesByCategory } from "../../../utils/linesort";
import { SalesInvoice } from "../../../models/salesinvoice";
import { AdminSettings } from "../../../models/adminsettings";
import { pushNotification } from "../../../models/notifications";
import { StaffAccount } from "../../../models/staffaccounts";
import { Account } from "../../../models/accounts";
import { Payment } from "../../../models/payments";
import { Transaction } from "../../../models/transactions";
import {
  autoAdjustAdvances,
  getInvoiceOutstanding,
  getPartyStatementConcession,
  getPartyTotalDue,
} from "../../../utils/allocation";
import { partyStockEnabled, sellerPartyOf, assertPartyStockAvailable } from "../../../utils/partystock";
import { assertSalesStockAvailable } from "../../../utils/stockguard";
import { challanForInvoice } from "../deliverychallan";
import { DeliveryChallan } from "../../../models/deliverychallan";
import { Admin } from "../../../models/admin";
import { Branch } from "../../../models/branches";
import { buildEInvoice, buildEWayBill, sellerOf } from "../../../utils/gst";
import { requireBackofficeTenant, TenantError } from "../../../utils/tenant";
import { assertModuleOn } from "../../../utils/modulegate";
import { isActionAllowed } from "../../../utils/permissiongate";
import { SalesReturn } from "../../../models/salesreturn";
import { assertInvoiceCancellable, assertInvoiceReopenable } from "../../../utils/invoicecancel";
import { assertFresh, createOnce, dropDeviceNumber, takeDeviceNumber, conflictError, isoOf, parseExpectedUpdatedAt, raiseDeviceSeq, updateByIdGuarded } from "../../../utils/offlinesync";

// NOTE: the local per-invoice settled-amount helper was removed. Outstanding
// now comes from utils/allocation, so the admin panel, the mobile app, the
// party report and the WhatsApp reminder all quote the same figure — and all
// of them net off sales returns, which this helper never did.

// Party "outstanding" = sum of UNSETTLED sales bills (each bill's total −
// settled, only positive) — same basis as Account.outstanding on the
// salesman app. `excludeInvoiceId`, when given, leaves that one invoice out
// of the sum entirely (used for the printed "Previous Balance", which must
// reflect what the party owed BEFORE this bill — regardless of whether this
// particular bill has since been paid).
const partyBillOutstanding = async (accountId: any, excludeInvoiceId?: any): Promise<number> => {
  if (!accountId) return 0;
  // Includes the opening balance the party carried in, and nets advances we
  // already hold — same basis as Account.outstanding and the payment screen.
  // The concession step is what the Party Statement adds on top, so the bill
  // and the statement show the same balance for the same party.
  const [due, concession] = await Promise.all([
    getPartyTotalDue({
      partyid: accountId,
      invoicemodel: "SalesInvoice",
      excludeInvoiceId,
      signed: true,
    }),
    getPartyStatementConcession({ partyid: accountId }),
  ]);
  return parseFloat((due + concession).toFixed(2));
};

// Resolve who created a doc into a proper { name, type } — so the listing shows
// e.g. "Ravi (Salesman)" / "Pruthvi (Party)" instead of "... (Staff)" or email.
// staff.type='staff' in the token, but the real role (salesman/staff/deliveryboy)
// lives on the StaffAccount; party tokens resolve to the Account name.
const resolveCreatedBy = async (user: any, input: any) => {
  console.log("🧾 [resolveCreatedBy] context.user:", JSON.stringify(user), "| input.createdby_name:", input?.createdby_name, "| input.createdby_type:", input?.createdby_type);
  let name = input?.createdby_name || user?.name || user?.email || "N/A";
  let type = user?.type || input?.createdby_type || "admin";
  try {
    if (user?.type === "staff") {
      const staff = await StaffAccount.findById(user.id).select("role name").lean() as any;
      if (staff) { type = staff.role || "staff"; name = staff.name || name; }
    } else if (user?.type === "account" || user?.type === "party") {
      type = "party";
      const acc = await Account.findById(user.id).select("name").lean() as any;
      if (acc) name = acc.name || name;
    }
  } catch (e) { /* best-effort */ }
  return { createdby_id: user?.id, createdby_name: name, createdby_type: type };
};
import { SalesOrder } from "../../../models/salesorder";
import { refId } from "../../../utils/ordermode";
import { asText, dmyFromText, escapeRegex, notCleared, pageWindow, textMatch } from "../../../utils/listquery";

// Sync the source Sales Order (the canonical lifecycle owner) when delivery is
// updated on the invoice, so order + invoice always agree.
const syncOrderFromInvoice = async (invoiceId: any, patch: any) => {
  try {
    const inv = await SalesInvoice.findById(invoiceId).select("sourceorderid").lean() as any;
    if (inv?.sourceorderid) await SalesOrder.findByIdAndUpdate(inv.sourceorderid, { $set: patch });
  } catch (e) { /* best-effort sync */ }
};

// ✅ Helper to convert populated Mongoose docs to simple ref objects
// Only name-type fields fall back to doc.name. Numeric/other fields must NOT,
// otherwise e.g. a missing latitude (Float) gets the account name (string) and
// GraphQL throws "Float cannot represent non numeric value".
const NAME_KEYS = new Set(["name", "accountname", "ledgername", "unitname"]);
const toSimpleRef = (doc: any, keys: string[] = ["name"]) => {
  if (!doc) return null;
  const ref: any = { id: doc._id?.toString() };
  keys.forEach(key => {
    const v = doc[key];
    if (v !== undefined && v !== null) ref[key] = v;
    else ref[key] = NAME_KEYS.has(key) ? (doc.name ?? null) : null;
  });
  return ref;
};

// ✅ Fields to populate
const populateFields: any[] = [
  "salesmenid",
  "partyacc",
  // Only what formatInvoice reads (name, image, variant names). Populating the
  // whole product — every variant, price slab, conversion row — for every line
  // of every invoice made the listing very slow on large accounts.
  { path: "productservice.productserviceid", select: "name imageurl productvariants._id productvariants.name" },
  "productservice.salesunitid",
  "productservice.salesaccountid",
  "productservice.purchaseaccountid",
  "productservice.serviceaccountid",
  "othercharges.ledgerid",
];

// Listing variant: the same paths, but each populated doc carries ONLY the
// fields formatInvoice copies out. The full party / salesman / ledger / unit
// documents were being loaded for every line of ~2000 invoices and then
// thrown away by formatInvoice.
export const listPopulateFields: any[] = [
  { path: "salesmenid", select: "name" },
  { path: "partyacc", select: "name accountname mobile address city state latitude longitude gstnumber" },
  { path: "productservice.productserviceid", select: "name imageurl productvariants._id productvariants.name" },
  { path: "productservice.salesunitid", select: "unitname" },
  { path: "productservice.salesaccountid", select: "ledgername" },
  { path: "productservice.purchaseaccountid", select: "ledgername" },
  { path: "productservice.serviceaccountid", select: "ledgername" },
  { path: "othercharges.ledgerid", select: "ledgername" },
];

// Plain "staff" role has no invoice-assignment field (unlike salesman's
// salesmenid / deliveryboy's deliveryboyid), so without this broadcast they'd
// only ever hear about an invoice via attendance or by being its creator —
// the reason staff logins saw far fewer notifications than salesman/
// deliveryboy/party. Tell every active "staff"-role StaffAccount at the
// branch about invoice activity, same visibility admin already has.
const notifyBranchStaff = async (
  adminid: any,
  branchid: any,
  excludeIds: any[],
  payload: { ntype: string; title: string; message: string; docmodel: string; docid: any; appscreen?: string }
) => {
  if (!adminid) return;
  const exclude = new Set(excludeIds.filter(Boolean).map((id: any) => String(id)));
  const query: any = { admin: adminid, role: "staff", status: true };
  if (branchid) query.branchid = branchid;
  const staffList: any[] = await StaffAccount.find(query).select("_id").lean();
  for (const s of staffList) {
    if (exclude.has(String(s._id))) continue;
    await pushNotification({ adminid, branchid, targettype: "staff", targetid: s._id, ...payload });
  }
};

// Notify everyone concerned about an invoice lifecycle event (dispatched,
// delivered …). Actor ≠ admin → tell admin; always tell the assigned salesman
// (invoice's salesmenid, else the party's linked salesman) and the party —
// skipping whoever performed the action themselves. Best-effort, never throws.
const notifyInvoiceEvent = async (doc: any, context: any, event: string) => {
  try {
    if (!doc) return;
    const user = context?.user;
    const actor = await resolveCreatedBy(user, {});
    // Unidentifiable actor (expired/missing token): resolveCreatedBy defaults
    // to "admin", which would wrongly skip the admin notification. Treat as
    // unknown instead so the admin still gets notified.
    if (!user) {
      actor.createdby_type = "unknown";
      if (actor.createdby_name === "N/A") actor.createdby_name = "Unknown user";
    }
    const actorLabel = `${actor.createdby_name} (${actor.createdby_type})`;
    const invNo = `INV-${doc.billnumber || ""}`;
    const partyName = doc.partyacc?.name || doc.partyacc?.accountname || "Party";
    const amount = Number(doc.totalamount || 0).toFixed(2);
    const adminid = doc.adminid?._id || doc.adminid;
    const branchid = doc.branchid?._id || doc.branchid;

    if (actor.createdby_type !== "admin") {
      await pushNotification({
        adminid, branchid,
        targettype: "admin",
        ntype: "invoice",
        title: `Invoice ${invNo} ${event}`,
        message: `${partyName} • ₹${amount} • by ${actorLabel}`,
        webpath: "/salesinvoice",
        docmodel: "SalesInvoice",
        docid: doc._id,
      });
    }

    let salesmanId: any = doc.salesmenid?._id || doc.salesmenid;
    if (!salesmanId) {
      const partyRefId = doc.partyacc?._id || doc.partyacc;
      if (partyRefId) {
        const acc: any = await Account.findById(partyRefId).select("salesmanid").lean();
        salesmanId = acc?.salesmanid || null;
      }
    }
    if (salesmanId && String(salesmanId) !== String(user?.id || "")) {
      await pushNotification({
        adminid, branchid,
        targettype: "staff",
        targetid: salesmanId,
        ntype: "invoice",
        title: `Invoice ${invNo} ${event}`,
        message: `${partyName} • ₹${amount} • by ${actorLabel}`,
        appscreen: "Orders",
        docmodel: "SalesInvoice",
        docid: doc._id,
      });
    }

    // Assigned delivery boy — hears about events on invoices he delivers.
    const deliveryBoyId = doc.deliveryboyid?._id || doc.deliveryboyid;
    if (
      deliveryBoyId &&
      String(deliveryBoyId) !== String(user?.id || "") &&
      String(deliveryBoyId) !== String(salesmanId || "")
    ) {
      await pushNotification({
        adminid, branchid,
        targettype: "staff",
        targetid: deliveryBoyId,
        ntype: "invoice",
        title: `Invoice ${invNo} ${event} — ${partyName}`,
        message: `₹${amount} • by ${actorLabel}`,
        appscreen: "Orders",
        docmodel: "SalesInvoice",
        docid: doc._id,
      });
    }

    // Staff creator (staff/deliveryboy app users) — hears about lifecycle
    // changes to invoices they created, same as a salesman does.
    const creatorId = doc.createdby_id;
    const creatorType = String(doc.createdby_type || "").toLowerCase();
    if (
      creatorId &&
      ["staff", "salesman", "deliveryboy"].includes(creatorType) &&
      String(creatorId) !== String(user?.id || "") &&
      String(creatorId) !== String(salesmanId || "") &&
      String(creatorId) !== String(deliveryBoyId || "")
    ) {
      await pushNotification({
        adminid, branchid,
        targettype: "staff",
        targetid: creatorId,
        ntype: "invoice",
        title: `Invoice ${invNo} ${event}`,
        message: `${partyName} • ₹${amount} • by ${actorLabel}`,
        appscreen: "Orders",
        docmodel: "SalesInvoice",
        docid: doc._id,
      });
    }

    // Branch-wide "staff" role — same visibility admin has, since plain
    // staff aren't assignable to invoices the way salesman/deliveryboy are.
    await notifyBranchStaff(
      adminid, branchid,
      [user?.id, salesmanId, deliveryBoyId, creatorId],
      {
        ntype: "invoice",
        title: `Invoice ${invNo} ${event}`,
        message: `${partyName} • ₹${amount} • by ${actorLabel}`,
        appscreen: "Orders",
        docmodel: "SalesInvoice",
        docid: doc._id,
      }
    );

    const partyId = doc.partyacc?._id || doc.partyacc;
    if (partyId && String(partyId) !== String(user?.id || "")) {
      await pushNotification({
        adminid, branchid,
        targettype: "party",
        targetid: partyId,
        ntype: "invoice",
        title: `Your invoice ${invNo} ${event}`,
        message: `₹${amount} • by ${actorLabel}`,
        appscreen: "Orders",
        docmodel: "SalesInvoice",
        docid: doc._id,
      });
    }

    // Channel downline: the parent (upline) party also hears about its child
    // party's invoice events.
    if (partyId) {
      const accDoc: any = await Account.findById(partyId).select("assignaccountid").lean();
      const parentId = accDoc?.assignaccountid;
      if (parentId && String(parentId) !== String(user?.id || "")) {
        await pushNotification({
          adminid, branchid,
          targettype: "party",
          targetid: parentId,
          ntype: "invoice",
          title: `Invoice ${invNo} ${event} — ${partyName}`,
          message: `₹${amount} • by ${actorLabel}`,
          appscreen: "Orders",
          docmodel: "SalesInvoice",
          docid: doc._id,
        });
      }
    }
  } catch (e) { /* notifications are best-effort */ }
};

// ✅ Format invoice function
export const formatInvoice = (inv: any) => ({
  ...inv,
  id: inv._id.toString(),
  salesmenid: toSimpleRef(inv.salesmenid, ["name"]),
  partyacc: toSimpleRef(inv.partyacc, ["accountname", "mobile", "address", "city", "state", "latitude", "longitude", "gstnumber"]),
  createdby_id: inv.createdby_id,
  createdby_name: inv.createdby_name,
  createdby_type: inv.createdby_type,
  autocreate: inv.autocreate || { ledger: true, stock: true },

  othercharges: inv.othercharges?.map((oc: any) => ({
    ...oc,
    ledgerid: toSimpleRef(oc.ledgerid, ["ledgername"])
  })) ?? [],

  productservice: inv.productservice?.map((ps: any) => {
    const variant = ps.productserviceid?.productvariants?.find(
      (v: any) => String(v._id) === String(ps.variantid)
    );

    return {
      ...ps,
      productserviceid: toSimpleRef(ps.productserviceid, ["name", "imageurl"]),
      variantid: variant ? { id: variant._id.toString(), name: variant.name } : null,
      salesunitid: toSimpleRef(ps.salesunitid, ["unitname"]),
      salesaccountid: toSimpleRef(ps.salesaccountid, ["ledgername"]),
      purchaseaccountid: toSimpleRef(ps.purchaseaccountid, ["ledgername"]),
      serviceaccountid: toSimpleRef(ps.serviceaccountid, ["ledgername"]),
      qty: ps.qty ?? 0,
      unitqty: ps.unitqty ?? 1,
      gst: ps.gst ?? 0,
      rate: ps.rate ?? 0,
      amount: ps.amount ?? 0,
      discount: ps.discount ?? 0,
    };
  }) ?? []
});

// Current invoice as the API returns it (for CONFLICT errors).
// Bill with what the GST JSON needs: full party, product variants (HSN) and units (UQC).
const GST_POPULATE: any[] = [
  { path: "partyacc", select: "name mobile gstnumber address city state pincode" },
  { path: "productservice.productserviceid", select: "name isservice productvariants._id productvariants.name productvariants.hsncode servicevariants._id servicevariants.name servicevariants.saccode" },
  { path: "productservice.salesunitid", select: "unitname uqc" },
];

// e-Invoice or e-Way Bill module on, and Add (first time) or Edit (change saved details) allowed for this login.
export async function assertGstOn(scope: any, moduleId: "einvoice" | "ewaybill", action: "add" | "edit") {
  const label = moduleId === "einvoice" ? "e-Invoice" : "e-Way Bill";
  const where = {
    adminid: scope.adminid,
    branchid: scope.userType === "admin" ? undefined : scope.branchid,
    staffid: scope.userType === "staff" ? scope.userId : undefined,
  };
  await assertModuleOn(moduleId, label, where);
  if (!(await isActionAllowed(moduleId, action, where))) {
    throw new TenantError(`You do not have ${action === "add" ? "Add" : "Edit"} permission for ${label}.`);
  }
}

async function gstDoc(kind: "invoice" | "challan", id: string, context: any, moduleId: "einvoice" | "ewaybill") {
  const scope = await requireBackofficeTenant(context);
  await assertGstOn(scope, moduleId, "add");
  const Model: any = kind === "invoice" ? SalesInvoice : DeliveryChallan;
  const doc: any = await Model.findById(id).populate(GST_POPULATE).lean();
  if (!doc || String(doc.adminid) !== String(scope.adminid)) throw new TenantError("Document not found.", "BAD_USER_INPUT");
  const [settings, admin, branch] = await Promise.all([
    AdminSettings.getOrCreateForAdmin(doc.adminid),
    Admin.findById(doc.adminid).select("companyName address mobile").lean(),
    doc.branchid ? Branch.findById(doc.branchid).select("address city pincode").lean() : null,
  ]);
  return { doc, seller: sellerOf(settings, admin, branch) };
}

const exportOf = ({ payload, check }: any) => ({
  ready: check.errors.length === 0,
  errors: check.errors,
  warnings: check.warnings,
  json: check.errors.length === 0 ? payload : null,
});

const loadInvoice = async (id: any) => {
  const inv = await SalesInvoice.findById(id).populate(populateFields).lean();
  return inv ? formatInvoice(inv) : null;
};

// ✅ GraphQL resolvers
// Every line needs a unit. Without one the quantity cannot be converted to the
// product's base unit, so stock moves by the wrong amount and the rate belongs
// to a pack size nobody chose. The form blocks this, but the API is reachable
// without the form — a saved line missing its unit is silently wrong rather
// than loudly rejected, so reject it here.
function assertLineUnits(input: any) {
  const lines = Array.isArray(input?.productservice) ? input.productservice : [];
  const missing: number[] = [];
  lines.forEach((line: any, i: number) => {
    if (!line?.salesunitid) missing.push(i + 1);
  });
  if (missing.length) {
    const which = missing.length === 1 ? `line ${missing[0]}` : `lines ${missing.join(", ")}`;
    throw new Error(
      `Select a unit for ${which} before saving this Sales Invoice.`
    );
  }
}

/** Role, delivery and party filters shared by every sales invoice list. Returns null when nothing can match. */
export async function buildInvoiceQuery(filter: any, context: any): Promise<any | null> {
  const query: any = { status: true };
  const { user } = context;

  // ✅ Role-based filtering
  if (user?.type === 'branch') {
    query.$or = [
      { createdby_type: 'branch', createdby_id: user?.id },
      { branchid: user?.branch_id || user?.id }
    ];
  } else if (user?.type === 'staff') {
    // Delivery views (pool / my deliveries) must NOT be restricted to
    // invoices the user created — they're filtered by delivery assignment.
    const isDeliveryView = !!(filter.unassignedDelivery || filter.deliveryboyid);
    // Collecting payment / settling a specific party's bills: the staff must
    // see ALL of that party's invoices (regardless of who created them),
    // exactly like the admin panel. So a party-scoped query isn't restricted.
    const isPartyScoped = !!filter.partyacc;
    let isDeliveryBoy = false;
    if (!isDeliveryView && !isPartyScoped) {
      const staff = await StaffAccount.findById(user.id).select('role').lean() as any;
      isDeliveryBoy = staff?.role === 'deliveryboy';
    }
    if (!isDeliveryView && !isDeliveryBoy && !isPartyScoped) {
      query.createdby_id = user?.id;
    }
  }

  // ── Delivery filters ──────────────────────────────────────────────
  if (filter.deliveryboyid) query.deliveryboyid = filter.deliveryboyid;
  if (filter.deliveryStatus) query.deliveryStatus = filter.deliveryStatus;
  if (filter.unassignedDelivery) {
    // Available pool: invoices not yet picked up by a delivery boy.
    query.deliveryboyid = { $in: [null, undefined] };
    query.deliveryStatus = { $ne: 'delivered' };
    // Salesman-taken orders are always salesman-fulfilled — the salesman
    // who booked the order hands it over himself. So even after they become
    // invoices they must NOT appear in the delivery-boy pool. Only
    // end-user / party / website / counter orders reach the delivery boy.
    query.orderedby_type = { $ne: 'salesman' };

    // deliveryMode = 'deliveryboy'  → full pool (all qualifying invoices).
    // deliveryMode = 'salesman'     → salesmen deliver their own parties'
    // orders, BUT parties with NO linked salesman have nobody to deliver
    // them — those still reach the delivery-boy pool.
    const settings = filter.adminid ? await AdminSettings.getOrCreateForAdmin(filter.adminid) : null;
    if (settings?.deliveryMode !== 'deliveryboy') {
      const noSalesmanParties = await Account.find({
        admin: filter.adminid,
        status: true,
        $or: [{ salesmanid: null }, { salesmanid: { $exists: false } }],
      }).select('_id').lean();
      if (!noSalesmanParties.length) return null;
      query.partyacc = { $in: noSalesmanParties.map((p: any) => p._id) };
    }
  }

  // Add filters if provided
  if (filter.branchid) query.branchid = filter.branchid;
  if (filter.adminid) query.adminid = filter.adminid;
  if (filter.salesmenid) query.salesmenid = filter.salesmenid;
  if (filter.paymenttype) query.paymenttype = filter.paymenttype;
  if (filter.taxorsupplytype) query.taxorsupplytype = filter.taxorsupplytype;
  if (filter.billtype) query.billtype = filter.billtype;
  if (filter.invoicetype) query.invoicetype = filter.invoicetype;
  if (filter.salesunitid) query.salesunitid = filter.salesunitid;
  if (filter.partyacc) query.partyacc = filter.partyacc;

  // Bill date range filter
  if (filter.billdateFrom || filter.billdateTo) {
    query.billdate = {};
    // billdate is stored as text ("YYYY-MM-DD…"), so compare text with text —
    // a Date here is cast to "Wed Nov 05 2026 …" and the range matched nothing.
    // \uffff after the To day keeps every bill dated on that day.
    if (filter.billdateFrom) query.billdate.$gte = String(filter.billdateFrom).slice(0, 10);
    if (filter.billdateTo) query.billdate.$lte = `${String(filter.billdateTo).slice(0, 10)}\uffff`;
  }
  return query;
}

/**
 * Bills getSalesInvoices leaves out as "fully returned". Repeats its check exactly
 * (lines keyed on the populated product, as the list does) so paged totals match.
 */
async function hiddenReturnedInvoiceIds(base: any): Promise<any[]> {
  const scopeIds = await SalesInvoice.distinct("_id", base);
  if (!scopeIds.length) return [];
  const allReturns: any[] = await SalesReturn.find({ sourceInvoiceId: { $in: scopeIds }, status: true })
    .select("sourceInvoiceId productservice.productserviceid productservice.variantid productservice.qty")
    .lean();
  if (!allReturns.length) return [];
  const returnsByInvoice = new Map<string, any[]>();
  allReturns.forEach((ret: any) => {
    const key = String(ret.sourceInvoiceId);
    const list = returnsByInvoice.get(key);
    if (list) list.push(ret);
    else returnsByInvoice.set(key, [ret]);
  });
  const candidates: any[] = await SalesInvoice.find({ _id: { $in: Array.from(returnsByInvoice.keys()) } })
    .select("productservice.productserviceid productservice.variantid productservice.qty")
    .populate({ path: "productservice.productserviceid", select: "name imageurl productvariants._id productvariants.name" })
    .lean();
  const hidden: any[] = [];
  candidates.forEach((inv: any) => {
    try {
      const returnedByItem: Record<string, number> = {};
      (returnsByInvoice.get(String(inv._id)) || []).forEach((ret: any) => {
        (ret.productservice ?? []).forEach((line: any) => {
          const key = `${String(line.productserviceid || "")}_${String(line.variantid || "")}`;
          returnedByItem[key] = (returnedByItem[key] || 0) + (Number(line.qty) || 0);
        });
      });
      const allFullyReturned = (inv.productservice ?? []).every((line: any) => {
        const key = `${String(line.productserviceid || "")}_${String(line.variantid || "")}`;
        return (returnedByItem[key] || 0) >= (Number(line.qty) || 0);
      });
      if (allFullyReturned) hidden.push(inv._id);
    } catch {
      /* the list keeps a bill it cannot check */
    }
  });
  return hidden;
}

/** Search across the columns shown in the invoice list. */
async function invoiceSearchClause(term: string, adminid?: any): Promise<any> {
  const rx = new RegExp(escapeRegex(term), "i");
  const partyScope: any = { $or: [{ name: rx }, { mobile: rx }, { city: rx }] };
  if (adminid) partyScope.admin = adminid;
  const partyIds = await Account.find(partyScope).distinct("_id");

  const or: any[] = [
    { partyacc: { $in: partyIds } },
    { billnumber: rx },
    { paymenttype: rx },
    { orderedby_name: rx },
    { createdby_name: rx },
  ];
  const billNo = term.replace(/^inv-?/i, "");
  if (billNo && billNo !== term) or.push({ billnumber: new RegExp(escapeRegex(billNo), "i") });
  const amount = Number(term);
  if (term !== "" && Number.isFinite(amount)) or.push({ totalamount: amount });
  // List shows dates as DD-MM-YYYY; bills store YYYY-MM-DD text.
  const dmy = term.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) or.push({ billdate: new RegExp(`^${dmy[3]}-${dmy[2]}-${dmy[1]}`) });
  return { $or: or };
}

/** Column filters, matched against the text each column shows in the list. */
async function columnFilterClauses(filters: any[] = [], adminid?: any): Promise<any[]> {
  const clauses: any[] = [];
  for (const f of filters) {
    const term = String(f?.value ?? "").trim();
    if (!term) continue;
    const rx = new RegExp(escapeRegex(term), "i");
    switch (f?.key) {
      case "paymenttype":
        clauses.push({ paymenttype: rx });
        break;
      case "partyacc": {
        const scope: any = { $or: [{ name: rx }, { mobile: rx }, { city: rx }] };
        if (adminid) scope.admin = adminid;
        clauses.push({ partyacc: { $in: await Account.find(scope).distinct("_id") } });
        break;
      }
      case "totalitem":
        clauses.push(textMatch({ $toString: { $size: { $ifNull: ["$productservice", []] } } }, term));
        break;
      case "totalqty":
        clauses.push(textMatch({ $toString: { $sum: { $ifNull: ["$productservice.qty", []] } } }, term));
        break;
      case "billdate":
        clauses.push(textMatch(dmyFromText("$billdate"), term));
        break;
      case "billtype_billnumber":
        clauses.push(textMatch({ $concat: ["INV-", asText("$billnumber")] }, term));
        break;
      case "totalamount":
        clauses.push(textMatch(asText("$totalamount"), term));
        break;
      case "orderedByDisplay":
        // Rows without an orderer show "—".
        clauses.push({ $or: [{ orderedby_name: rx }, { orderedby_type: rx }, ...("—".includes(term) ? [{ orderedby_name: { $in: [null, ""] } }] : [])] });
        break;
      case "deliveryDisplay":
        clauses.push(textMatch({
          $switch: {
            branches: [
              { case: { $eq: ["$cancelStatus", "cancelled"] }, then: "cancelled" },
              { case: { $in: ["$deliveryStatus", ["dispatched", "delivered"]] }, then: "$deliveryStatus" },
            ],
            default: "confirmed",
          },
        }, term));
        break;
      case "status":
        clauses.push(textMatch({
          $cond: [{ $eq: ["$cancelStatus", "cancelled"] }, "Cancelled", { $cond: ["$status", "Active", "Inactive"] }],
        }, term));
        break;
    }
  }
  return clauses;
}

/** Source order numbers for a set of invoices, fetched in one query. */
export async function sourceOrderNoMap(invoices: any[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  const orderIds = Array.from(new Set(invoices.map((inv: any) => refId(inv.sourceorderid)).filter(Boolean).map(String)));
  if (!orderIds.length) return map;
  try {
    const orders: any[] = await SalesOrder.find({ _id: { $in: orderIds } }).select("billnumber").lean();
    orders.forEach((o: any) => map.set(String(o._id), o.billnumber || null));
  } catch {
    /* a label is never worth failing the list over */
  }
  return map;
}

// Saved bill for an offline retry, looked up in the caller's own business.
const findInvoiceByRequest = async (adminid: string, requestId: string) => {
  const doc: any = await SalesInvoice.findOne({ adminid, clientRequestId: requestId }).populate(populateFields).lean();
  return doc ? formatInvoice(doc) : null;
};

async function addSalesInvoiceNow(_: any, { input, autoPayment }: any, context: any) {
      assertLineUnits(input);
      // A device number is provisional: moved to offlineNumber.
      const deviceNo = takeDeviceNumber("salesinvoice", input);
      // ✅ Extract user info from context and populate createdby fields
      // (resolves staff → real role + name, party → account name).
      const { user } = context;
      const createdbyData = await resolveCreatedBy(user, input);

      // Stock is the only auto-posting switch left; the journal always posts.
      const settings = await AdminSettings.getOrCreateForAdmin(input.adminid);
      const autoCreateData = {
        autocreate: { stock: settings?.autoCreateStockOnSalesInvoice ?? true },
      };
      // Goods that already left with a challan: this invoice posts the ledger only.
      const challan: any = await challanForInvoice(input);
      if (challan) {
        if (challan.challanStatus === "returned") throw new Error("That delivery challan was returned; it cannot be invoiced.");
        input.sourcechallanid = challan._id;
        if (challan.stockapplied) autoCreateData.autocreate.stock = false;
      }

      // `autoPayment: false` means the caller already collected the money
      // elsewhere (an order converted to an invoice), so this bill must not
      // raise a second receipt. In the received-amount model that is simply
      // nothing received here.
      if (autoPayment === false) input.received = 0;

      // Stock guard — the panel's Add Products box checks quantity against
      // available stock, but lines that arrive pre-filled (Convert to Invoice
      // from an app/website order, where the catalogue only gates on in/out of
      // stock) never pass through it. Checked here, before anything is written,
      // so a short invoice fails cleanly instead of leaving negative stock.
      // Party stock: a bill to a sub-party comes out of its parent party's
      // stock, not the company's — check that instead.
      const psSeller = autoCreateData.autocreate.stock && !input.isservice && (await partyStockEnabled(input.adminid))
        ? await sellerPartyOf(input.partyacc) : null;
      if (psSeller && settings?.allowNegativeStock !== true) {
        await assertPartyStockAvailable({ sellerId: psSeller, productservice: input.productservice || [] });
      }
      await assertSalesStockAvailable({
        adminid: input.adminid,
        branchid: input.branchid,
        productservice: input.productservice || [],
        isservice: input.isservice,
        // Business Settings -> "Allow negative stock" is the escape hatch for
        // businesses that bill first and enter purchases later.
        wantsStock: !psSeller && autoCreateData.autocreate.stock && settings?.allowNegativeStock !== true,
      });

      // Bill lines category-wise, then A-Z (also covers order -> invoice conversion).
      if (Array.isArray(input.productservice)) input.productservice = await sortLinesByCategory(input.productservice);

      const created = await SalesInvoice.create({ ...input, ...createdbyData, ...autoCreateData });
      console.log("✅ Created invoice autocreate:", created.autocreate);
      await raiseDeviceSeq(input.adminid, deviceNo);

      // Converting an order → invoice confirms the source order (canonical status).
      if (input.sourceorderid) {
        try {
          await SalesOrder.findByIdAndUpdate(input.sourceorderid, {
            $set: { isConverted: true, orderStatus: "confirmed" },
          });
        } catch (e) { /* best-effort */ }
      }

      // ✅ Explicitly call adjustStockAndTransactions WITH userContext
      // (ensures Transaction/Payment Created By is never N/A)
      await SalesInvoice.adjustStockAndTransactions(null, created, createdbyData);

      // Apply any advance this party has already paid to the new bill.
      // Allocation-only — the ledger was credited when the advance arrived, so
      // no journal entry is created (Tally's bill-adjustment journal is net-zero
      // for the same reason). Best-effort: never fail a valid invoice over this.
      try {
        const settings: any = await AdminSettings.getOrCreateForAdmin(created.adminid);
        if (settings?.autoAdjustAdvanceOnInvoice !== false) {
          const used = await autoAdjustAdvances({
            invoiceid: created._id,
            invoicemodel: "SalesInvoice",
            partyid: created.partyacc,
            adminid: created.adminid,
          });
          if (used > 0) console.log(`Applied advance of ${used} to SalesInvoice ${created.billnumber}`);
        }
      } catch (e: any) {
        console.warn("Advance auto-adjust skipped:", e?.message);
      }

      const doc: any = await SalesInvoice.findById(created._id)
        .populate(populateFields)
        .lean();

      // ── Notifications ──────────────────────────────────────────
      // Run in the BACKGROUND: they are best-effort, write nothing the invoice
      // depends on, and on a branch with many staff / delivery boys they were
      // dozens of sequential DB writes the user sat waiting for after Save.
      // The response returns as soon as the invoice + its stock/journal are
      // committed; notifications follow a moment later.
      void (async () => {
      // Actor ≠ admin → tell admin. Back-office actor (admin/branch/staff) →
      // tell the assigned salesman (invoice's, else the party's linked
      // salesman) + the party. Skip whoever performed the action themselves.
      try {
        const invNo = `INV-${doc?.billnumber || ""}`;
        const partyName = doc?.partyacc?.name || doc?.partyacc?.accountname || "Party";
        const amount = Number(doc?.totalamount || 0).toFixed(2);
        const isConversion = !!input.sourceorderid;
        const titleBase = isConversion
          ? `Order converted to invoice ${invNo}`
          : `New invoice ${invNo} created`;
        const actorLabel = `${createdbyData.createdby_name} (${createdbyData.createdby_type})`;
        const isBackOffice = ["admin", "branch", "staff"].includes(createdbyData.createdby_type);

        if (createdbyData.createdby_type !== "admin") {
          await pushNotification({
            adminid: input.adminid,
            branchid: input.branchid,
            targettype: "admin",
            ntype: "invoice",
            title: titleBase,
            message: `${partyName} • ₹${amount} • by ${actorLabel}`,
            webpath: "/salesinvoice",
            docmodel: "SalesInvoice",
            docid: created._id,
          });
        }

        // Branch-wide "staff" role — same live visibility admin gets, since
        // plain staff have no invoice-assignment field of their own.
        await notifyBranchStaff(
          input.adminid, input.branchid,
          [createdbyData.createdby_id],
          {
            ntype: "invoice",
            title: titleBase,
            message: `${partyName} • ₹${amount} • by ${actorLabel}`,
            appscreen: "Orders",
            docmodel: "SalesInvoice",
            docid: created._id,
          }
        );

        let notifiedSalesmanId: any = null; // avoid double-notifying the same staff below
        if (isBackOffice) {
          let salesmanId: any = doc?.salesmenid?._id || doc?.salesmenid || input.salesmenid;
          if (!salesmanId) {
            const partyRefId = doc?.partyacc?._id || doc?.partyacc || input.partyacc;
            if (partyRefId) {
              const acc: any = await Account.findById(partyRefId).select("salesmanid").lean();
              salesmanId = acc?.salesmanid || null;
            }
          }
          notifiedSalesmanId = salesmanId;
          if (salesmanId && String(salesmanId) !== String(createdbyData.createdby_id || "")) {
            await pushNotification({
              adminid: input.adminid,
              branchid: input.branchid,
              targettype: "staff",
              targetid: salesmanId,
              ntype: "invoice",
              title: `${titleBase} — ${partyName}`,
              message: `₹${amount} • by ${actorLabel}`,
              appscreen: "Orders",
              docmodel: "SalesInvoice",
              docid: created._id,
            });
          }
          const partyId = doc?.partyacc?._id || doc?.partyacc || input.partyacc;
          if (partyId) {
            await pushNotification({
              adminid: input.adminid,
              branchid: input.branchid,
              targettype: "party",
              targetid: partyId,
              ntype: "invoice",
              title: titleBase,
              message: `₹${amount} • by ${actorLabel}`,
              appscreen: "Orders",
              docmodel: "SalesInvoice",
              docid: created._id,
            });
          }
        }

        // Channel downline (party hierarchy via assignaccountid):
        // • parent (upline) party hears about its child party's invoice;
        // • a parent converting/creating for a child also notifies the child.
        const invPartyId = doc?.partyacc?._id || doc?.partyacc || input.partyacc;
        if (invPartyId) {
          const accDoc: any = await Account.findById(invPartyId).select("assignaccountid").lean();
          const parentId = accDoc?.assignaccountid;
          if (parentId && String(parentId) !== String(createdbyData.createdby_id || "")) {
            await pushNotification({
              adminid: input.adminid,
              branchid: input.branchid,
              targettype: "party",
              targetid: parentId,
              ntype: "invoice",
              title: `${titleBase} — ${partyName}`,
              message: `₹${amount} • by ${actorLabel}`,
              appscreen: "Orders",
              docmodel: "SalesInvoice",
              docid: created._id,
            });
          }
          if (
            createdbyData.createdby_type === "party" &&
            String(createdbyData.createdby_id || "") !== String(invPartyId)
          ) {
            await pushNotification({
              adminid: input.adminid,
              branchid: input.branchid,
              targettype: "party",
              targetid: invPartyId,
              ntype: "invoice",
              title: titleBase,
              message: `₹${amount} • by ${actorLabel}`,
              appscreen: "Orders",
              docmodel: "SalesInvoice",
              docid: created._id,
            });
          }
        }

        // Conversion: the staff/salesman/deliveryboy who punched the SOURCE
        // ORDER hears that it became an invoice (e.g. staff punches order,
        // admin converts → staff gets notified).
        if (input.sourceorderid) {
          const srcOrder: any = await SalesOrder.findById(input.sourceorderid)
            .select("createdby_id createdby_type").lean();
          const srcType = String(srcOrder?.createdby_type || "").toLowerCase();
          if (
            srcOrder?.createdby_id &&
            ["staff", "salesman", "deliveryboy"].includes(srcType) &&
            String(srcOrder.createdby_id) !== String(createdbyData.createdby_id || "") &&
            String(srcOrder.createdby_id) !== String(notifiedSalesmanId || "")
          ) {
            await pushNotification({
              adminid: input.adminid,
              branchid: input.branchid,
              targettype: "staff",
              targetid: srcOrder.createdby_id,
              ntype: "invoice",
              title: `${titleBase} — ${partyName}`,
              message: `₹${amount} • by ${actorLabel}`,
              appscreen: "Orders",
              docmodel: "SalesInvoice",
              docid: created._id,
            });
          }
        }

        // New delivery in the shared pool → tell every active delivery boy.
        // Pool invoices have no deliveryboyid, so without this broadcast no
        // delivery boy would ever hear about new available deliveries.
        const settings: any = input.adminid
          ? await AdminSettings.getOrCreateForAdmin(input.adminid)
          : null;
        // Mirrors the pool filter: full pool in delivery-boy mode; in salesman
        // mode only parties WITHOUT a linked salesman reach the pool.
        let poolEligible =
          !doc?.deliveryboyid &&
          String(doc?.orderedby_type || "") !== "salesman";
        if (poolEligible && settings?.deliveryMode !== "deliveryboy") {
          const pAcc: any = invPartyId
            ? await Account.findById(invPartyId).select("salesmanid").lean()
            : null;
          poolEligible = !pAcc?.salesmanid;
        }
        if (poolEligible) {
          const boys: any[] = await StaffAccount.find({
            admin: input.adminid, role: "deliveryboy", status: true,
          }).select("_id").lean();
          for (const b of boys) {
            await pushNotification({
              adminid: input.adminid,
              branchid: input.branchid,
              targettype: "staff",
              targetid: b._id,
              ntype: "invoice",
              title: `New delivery available — ${partyName}`,
              message: `${invNo} • ₹${amount}`,
              appscreen: "Deliveries",
              docmodel: "SalesInvoice",
              docid: created._id,
            });
          }
        }
      } catch (e) { /* notifications are best-effort */ }
      })();

      return formatInvoice(doc);
    }

export const salesInvoiceResolvers = {
  Query: {
    getEInvoiceExport: async (_: any, { invoiceId }: any, context: any) => {
      const { doc, seller } = await gstDoc("invoice", invoiceId, context, "einvoice");
      return exportOf(buildEInvoice(doc, seller));
    },

    getEWayBillExport: async (_: any, { sourceType, id }: any, context: any) => {
      const kind = sourceType === "challan" ? "challan" : "invoice";
      const { doc, seller } = await gstDoc(kind, id, context, "ewaybill");
      return exportOf(buildEWayBill(doc, kind, seller));
    },

    getSalesInvoices: async (_: any, { filter = {} }: { filter?: any }, context: any) => {
      const query = await buildInvoiceQuery(filter, context);
      if (!query) return [];

      const invoices = await SalesInvoice.find(query).sort({ createdAt: 1, _id: 1 })
        .populate(listPopulateFields)
        .lean();

      // ✅ Filter out invoices that have been fully returned.
      // All returns for the listed invoices are fetched in ONE query and
      // grouped in memory — previously this ran one query per invoice, which on
      // an account with ~2000 bills meant ~2000 round trips on every load.
      const invoiceIds = invoices.map((inv: any) => inv._id);
      const allReturns: any[] = invoiceIds.length
        ? await SalesReturn.find({ sourceInvoiceId: { $in: invoiceIds }, status: true })
            .select("sourceInvoiceId productservice.productserviceid productservice.variantid productservice.qty")
            .lean()
        : [];
      const returnsByInvoice = new Map<string, any[]>();
      allReturns.forEach((ret: any) => {
        const key = String(ret.sourceInvoiceId);
        const list = returnsByInvoice.get(key);
        if (list) list.push(ret);
        else returnsByInvoice.set(key, [ret]);
      });

      // Source order numbers, also in one query (was one query per invoice via
      // the `sourceorderno` field resolver).
      const orderIds = Array.from(
        new Set(invoices.map((inv: any) => refId(inv.sourceorderid)).filter(Boolean).map(String))
      );
      const orderNoById = new Map<string, string | null>();
      if (orderIds.length) {
        try {
          const orders: any[] = await SalesOrder.find({ _id: { $in: orderIds } }).select("billnumber").lean();
          orders.forEach((o: any) => orderNoById.set(String(o._id), o.billnumber || null));
        } catch (e) {
          /* a label is never worth failing the list over */
        }
      }

      const filteredInvoices = invoices.map((inv: any) => {
        try {
          const returns = returnsByInvoice.get(String(inv._id)) || [];
          if (returns.length === 0) return inv;

          // Calculate returned quantities per item
          const returnedByItem: Record<string, number> = {};
          returns.forEach((ret: any) => {
            (ret.productservice ?? []).forEach((line: any) => {
              const key = `${String(line.productserviceid || "")}_${String(line.variantid || "")}`;
              returnedByItem[key] = (returnedByItem[key] || 0) + (Number(line.qty) || 0);
            });
          });

          // Check if ALL items are fully returned
          const allFullyReturned = (inv.productservice ?? []).every((line: any) => {
            // Key built exactly as before this refactor (behaviour unchanged).
            const key = `${String(line.productserviceid || "")}_${String(line.variantid || "")}`;
            return (returnedByItem[key] || 0) >= (Number(line.qty) || 0);
          });

          // Return invoice only if NOT all items are fully returned
          return !allFullyReturned ? inv : null;
        } catch (error: any) {
          console.error(`❌ Error filtering invoice ${inv.billnumber}:`, error.message);
          return inv; // Include on error (safe fallback)
        }
      });

      // Filter out null values
      const result = filteredInvoices.filter(Boolean).map((inv: any) => {
        const out: any = formatInvoice(inv);
        const oid = refId(inv.sourceorderid);
        out.__sourceorderno = oid ? orderNoById.get(String(oid)) ?? null : null;
        return out;
      });
      return result;
    },

    getSalesInvoicesPage: async (
      _: any,
      { filter = {}, page = 1, pageSize = 25, search = "", columnFilters = [] }: { filter?: any; page?: number; pageSize?: number; search?: string; columnFilters?: any[] },
      context: any
    ) => {
      const base = await buildInvoiceQuery(filter, context);
      if (!base) return { items: [], total: 0 };

      const clauses: any[] = [base];
      if (!filter.includeCancelled) clauses.push({ cancelStatus: { $ne: "cancelled" } });

      const hidden = await hiddenReturnedInvoiceIds(base);
      if (hidden.length) clauses.push({ _id: { $nin: hidden } });

      const term = String(search || "").trim();
      if (term) clauses.push(await invoiceSearchClause(term, filter.adminid));
      clauses.push(...(await columnFilterClauses(columnFilters || [], filter.adminid)));

      const query = { $and: clauses };
      const { skip, limit: size } = pageWindow(page, pageSize);

      const [total, rows] = await Promise.all([
        SalesInvoice.countDocuments(query),
        SalesInvoice.find(query)
          .sort({ createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(size)
          .populate(listPopulateFields)
          .lean(),
      ]);

      const orderNoById = await sourceOrderNoMap(rows);
      const items = rows.map((inv: any) => {
        const out: any = formatInvoice(inv);
        const oid = refId(inv.sourceorderid);
        out.__sourceorderno = oid ? orderNoById.get(String(oid)) ?? null : null;
        return out;
      });
      return { items, total };
    },

    getDeletedSalesInvoices: async (_: any, { filter = {} }: { filter?: any }, context: any) => {
      const query: any = { status: false, ...notCleared };
      const { user } = context;

      // ✅ Role-based filtering
      if (user?.type === 'branch') {
        query.$or = [
          { createdby_type: 'branch', createdby_id: user?.id },
          { branchid: user?.branch_id || user?.id }
        ];
      } else if (user?.type === 'staff') {
        query.createdby_id = user?.id;
      }

      if (filter.branchid) query.branchid = filter.branchid;
      if (filter.adminid) query.adminid = filter.adminid;
      if (filter.salesmenid) query.salesmenid = filter.salesmenid;

      const invoices = await SalesInvoice.find(query).sort({ createdAt: 1, _id: 1 })
        .populate(populateFields)
        .lean();

      return invoices.map(formatInvoice);
    },

    getSalesInvoiceById: async (_: any, { id }: { id: string }) => {
      const inv = await SalesInvoice.findById(id)
        .populate(populateFields)
        .lean();
      return inv ? formatInvoice(inv) : null;
    },
  },

  Mutation: {
    // `autoPayment` is an INTERNAL arg (not in the schema). Passing false stops
    // adjustStockAndTransactions from posting the automatic receipt, which it
    // otherwise does for every non-credit payment type. The order-only flow
    // needs that: the bill must stay open so the money can be collected on the
    // Payments screen, exactly like a Sales Invoice raised by hand.
    addSalesInvoice: (_: any, args: any, context: any) =>
      createOnce(context, args?.input, findInvoiceByRequest, () => addSalesInvoiceNow(_, args, context)),

    // One-tap convert (used by the mobile app, which has no invoice form).
    // Builds the invoice input from the source order and reuses addSalesInvoice
    // so all the auto-posting (ledger / stock / payment) runs exactly the same.
    // `autoPayment` is an INTERNAL arg (not in the schema): the order-only
    // auto-conversion passes false so no receipt is posted and the bill stays
    // open for collection. The invoice keeps the ORDER's own payment type —
    // this is a plain mirror of the order, nothing is rewritten.
    convertSalesOrderToInvoice: async (_: any, { id, autoPayment }: any, context: any) => {
      console.log("🔄 [convertSalesOrderToInvoice] id:", id, "| context.user:", JSON.stringify(context?.user));
      const order: any = await SalesOrder.findById(id).lean();
      if (!order) throw new Error("Sales Order not found");
      if (order.isConverted) throw new Error("This order is already converted to an invoice.");
      if (order.cancelStatus === "cancelled") throw new Error("A cancelled order cannot be converted.");

      const str = (v: any) => (v == null ? null : v.toString());
      const input: any = {
        adminid: str(order.adminid),
        branchid: str(order.branchid),
        salesmenid: str(order.salesmenid),
        paymenttype: order.paymenttype,
        partyacc: str(order.partyacc),
        taxorsupplytype: order.taxorsupplytype || "regular",
        billdate: new Date().toISOString().slice(0, 10),
        billtype: (order.billtype && order.billtype !== "order") ? order.billtype : "taxInvoice",
        notes: order.notes,
        ordertype: order.ordertype,
        isservice: !!order.isservice,
        subtotal: order.subtotal,
        totaldiscount: order.totaldiscount,
        totalgst: order.totalgst,
        totalamount: order.totalamount,
        invoicediscount: order.invoicediscount,
        invoicediscounttype: order.invoicediscounttype,
        roundoff: order.roundoff,
        deliverydate: order.deliverydate,
        duedate: order.duedate,
        transportname: order.transportname,
        vehiclenumber: order.vehiclenumber,
        ewaybillno: order.ewaybillno,
        distance: order.distance,
        productservice: (order.productservice || []).map((p: any) => ({
          productserviceid: str(p.productserviceid),
          variantid: str(p.variantid),
          salesunitid: str(p.salesunitid),
          unitqty: p.unitqty ?? 1,
          gst: p.gst ?? 0,
          qty: p.qty ?? 0,
          rate: p.rate ?? 0,
          amount: p.amount ?? 0,
          discount: p.discount ?? 0,
          salesaccountid: str(p.salesaccountid),
          purchaseaccountid: str(p.purchaseaccountid),
          serviceaccountid: str(p.serviceaccountid),
        })),
        othercharges: (order.othercharges || []).map((c: any) => ({
          ledgerid: str(c.ledgerid),
          ledgername: c.ledgername,
          amount: c.amount ?? 0,
          gstpercent: c.gstpercent ?? 0,
          gstamount: c.gstamount ?? 0,
          totalamount: c.totalamount ?? 0,
          remarks: c.remarks,
        })),
        // Track origin + who booked the order.
        sourceorderid: str(order._id),
        orderedby_id: str(order.createdby_id),
        orderedby_name: order.createdby_name,
        orderedby_type: order.createdby_type,
      };

      return await (salesInvoiceResolvers as any).Mutation.addSalesInvoice(_, { input, autoPayment }, context);
    },

    editSalesInvoice: async (_: any, { id, input, expectedUpdatedAt }: any, context: any) => {
      dropDeviceNumber("salesinvoice", input);
      const expected = parseExpectedUpdatedAt(expectedUpdatedAt);
      assertLineUnits(input);
      const { user } = context;
      const userContext = {
        createdby_id: user?.id,
        createdby_name: user?.name || user?.email,
        createdby_type: user?.type || 'admin',
      };

      const oldInv = await SalesInvoice.findById(id);
      if (!oldInv) throw new Error("Invoice not found");
      const guardAt = await assertFresh(oldInv.updatedAt, expected, () => loadInvoice(id));
      // Editing a cancelled bill would post stock and a journal for a document
      // that is supposed to have none. Re-open it first — that is the deliberate
      // act that puts it back in the books.
      if (String(oldInv.cancelStatus || "") === "cancelled") {
        throw new Error("This invoice is cancelled. Re-open it before editing.");
      }

      // ✅ Always use AdminSettings for autocreate (ignore user input)
      const settings = await AdminSettings.getOrCreateForAdmin(oldInv.adminid);
      const autoCreateData = {
        autocreate: { stock: settings?.autoCreateStockOnSalesInvoice ?? true },
      };
      // The challan link is fixed at create; its stock was moved by the challan.
      input.sourcechallanid = oldInv.sourcechallanid ?? null;
      if (oldInv.sourcechallanid) {
        const c: any = await DeliveryChallan.findById(oldInv.sourcechallanid).select("stockapplied").lean();
        if (c?.stockapplied) autoCreateData.autocreate.stock = false;
      }

      // Same guard as create, but netting off what this invoice already held —
      // the stock hook restores the old lines before deducting the new ones, so
      // only the increase has to be available.
      const editSeller = autoCreateData.autocreate.stock && !(input.isservice ?? oldInv.isservice)
        && (await partyStockEnabled(oldInv.adminid))
        ? await sellerPartyOf(input.partyacc || oldInv.partyacc) : null;
      if (editSeller && settings?.allowNegativeStock !== true) {
        await assertPartyStockAvailable({
          sellerId: editSeller,
          productservice: input.productservice || oldInv.productservice || [],
          // Only credit back what the old version actually took from this seller.
          oldProductservice: oldInv.partystockapplied && String(oldInv.partystockseller || "") === editSeller
            && String(oldInv.cancelStatus || "") !== "cancelled" ? oldInv.productservice : [],
        });
      }
      await assertSalesStockAvailable({
        adminid: oldInv.adminid,
        branchid: input.branchid || oldInv.branchid,
        productservice: input.productservice || oldInv.productservice || [],
        isservice: input.isservice ?? oldInv.isservice,
        oldInv,
        wantsStock: !editSeller && autoCreateData.autocreate.stock && settings?.allowNegativeStock !== true,
      });

      if (Array.isArray(input.productservice)) input.productservice = await sortLinesByCategory(input.productservice);

      const updated = await updateByIdGuarded(SalesInvoice, id, guardAt, { ...input, ...autoCreateData }, { new: true });
      if (guardAt && !updated) throw await conflictError(() => loadInvoice(id));

      if (updated) {
        await SalesInvoice.adjustStockAndTransactions(oldInv, updated, userContext);
      }

      const inv = await SalesInvoice.findById(id)
        .populate(populateFields)
        .lean();
      return inv ? formatInvoice(inv) : null;
    },

    deleteSalesInvoice: async (_: any, { id, expectedUpdatedAt }: { id: string; expectedUpdatedAt?: string }) => {
      const expected = parseExpectedUpdatedAt(expectedUpdatedAt);
      if (!expected) return !!(await SalesInvoice.findByIdAndUpdate(id, { status: false }));
      const current: any = await SalesInvoice.findById(id).select("updatedAt").lean();
      if (!current) return false;
      const guardAt = await assertFresh(current.updatedAt, expected, () => loadInvoice(id));
      const done = await updateByIdGuarded(SalesInvoice, id, guardAt, { status: false });
      if (!done) throw await conflictError(() => loadInvoice(id));
      return true;
    },

    // ── Cancel / re-open ──────────────────────────────────────────────────
    // The bill stays on record with its number; what is reversed is everything
    // it did to the books. Both directions go through the same hook the normal
    // save uses, so stock, journal and receipt can never be handled one way on
    // the way out and another on the way back.
    cancelSalesInvoice: async (_: any, { id, reason, expectedUpdatedAt }: any, context: any) => {
      const expected = parseExpectedUpdatedAt(expectedUpdatedAt);
      const oldInv = await SalesInvoice.findById(id);
      if (!oldInv) throw new Error("Invoice not found");
      const guardAt = await assertFresh(oldInv.updatedAt, expected, () => loadInvoice(id));

      await assertInvoiceCancellable({
        inv: oldInv,
        docmodel: "SalesInvoice",
        ReturnModel: SalesReturn,
        returnLabel: "Sales Return",
      });

      const user = context?.user;
      const updated = await updateByIdGuarded(
        SalesInvoice,
        id,
        guardAt,
        {
          cancelStatus: "cancelled",
          cancelReason: reason || "",
          cancelledAt: new Date(),
          cancelledByName: user?.name || user?.email || null,
        },
        { new: true }
      );
      if (guardAt && !updated) throw await conflictError(() => loadInvoice(id));
      if (updated) await SalesInvoice.adjustStockAndTransactions(oldInv, updated, null);

      const inv = await SalesInvoice.findById(id).populate(populateFields).lean();
      return inv ? formatInvoice(inv) : null;
    },

    reopenSalesInvoice: async (_: any, { id, expectedUpdatedAt }: { id: string; expectedUpdatedAt?: string }, context: any) => {
      const expected = parseExpectedUpdatedAt(expectedUpdatedAt);
      const oldInv = await SalesInvoice.findById(id);
      if (!oldInv) throw new Error("Invoice not found");
      const guardAt = await assertFresh(oldInv.updatedAt, expected, () => loadInvoice(id));
      assertInvoiceReopenable(oldInv, "SalesInvoice");

      // The goods went back on the shelf at cancel time, so re-opening takes
      // them out again — and has to be checked against today's stock, not
      // against what was there when the bill was written.
      const settings = await AdminSettings.getOrCreateForAdmin(oldInv.adminid);
      const reopenStock = (oldInv.autocreate?.stock ?? settings?.autoCreateStockOnSalesInvoice ?? true) && !oldInv.isservice;
      const reopenSeller = reopenStock && (await partyStockEnabled(oldInv.adminid)) ? await sellerPartyOf(oldInv.partyacc) : null;
      if (reopenSeller && settings?.allowNegativeStock !== true) {
        await assertPartyStockAvailable({ sellerId: reopenSeller, productservice: oldInv.productservice || [] });
      }
      await assertSalesStockAvailable({
        adminid: oldInv.adminid,
        branchid: oldInv.branchid,
        productservice: oldInv.productservice || [],
        isservice: oldInv.isservice,
        oldInv: null, // a cancelled bill holds no stock to net off
        wantsStock: !reopenSeller && reopenStock && settings?.allowNegativeStock !== true,
      });

      const user = context?.user;
      const userContext = {
        createdby_id: user?.id,
        createdby_name: user?.name || user?.email,
        createdby_type: user?.type || "admin",
      };
      const updated = await updateByIdGuarded(
        SalesInvoice,
        id,
        guardAt,
        { cancelStatus: "open", cancelReason: null, cancelledAt: null, cancelledByName: null },
        { new: true }
      );
      if (guardAt && !updated) throw await conflictError(() => loadInvoice(id));
      if (updated) await SalesInvoice.adjustStockAndTransactions(oldInv, updated, userContext);

      const inv = await SalesInvoice.findById(id).populate(populateFields).lean();
      return inv ? formatInvoice(inv) : null;
    },

    resetSalesInvoice: async (_: any, { id }: { id: string }) => {
      return !!(await SalesInvoice.findByIdAndUpdate(id, { status: true }));
    },

    // ── Delivery transitions (sync back to the canonical source order) ────
    markSalesInvoiceDispatched: async (_: any, { id, deliveryboyid }: any, context: any) => {
      const update: any = { deliveryStatus: "dispatched" };
      if (deliveryboyid) update.deliveryboyid = deliveryboyid;
      const updated = await SalesInvoice.findByIdAndUpdate(id, update, { new: true })
        .populate(populateFields).lean();
      if (!updated) throw new Error("Invoice not found");
      await syncOrderFromInvoice(id, { orderStatus: "dispatched", deliveryStatus: "dispatched", ...(deliveryboyid ? { deliveryboyid } : {}) });
      await notifyInvoiceEvent(updated, context, "dispatched");
      return formatInvoice(updated);
    },

    markSalesInvoiceDelivered: async (_: any, { id, byId, byName, byType }: any, context: any) => {
      const user = context?.user;
      const deliveredAt = new Date();
      const by = {
        deliveredById: byId || user?.id || null,
        deliveredByName: byName || user?.name || user?.email || null,
        deliveredByType: byType || user?.type || null,
      };
      const updated = await SalesInvoice.findByIdAndUpdate(
        id,
        { deliveryStatus: "delivered", deliveredAt, ...by },
        { new: true }
      ).populate(populateFields).lean();
      if (!updated) throw new Error("Invoice not found");
      await syncOrderFromInvoice(id, { orderStatus: "delivered", deliveryStatus: "delivered", deliveredAt, ...by });
      await notifyInvoiceEvent(updated, context, "delivered");
      return formatInvoice(updated);
    },

    // Details the GST portal returned (IRN, QR, e-Way Bill); only these fields are written.
    saveInvoiceGstDetails: async (_: any, { id, input }: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const inv: any = await SalesInvoice.findById(id).select("adminid irn ewaybillno").lean();
      if (!inv || String(inv.adminid) !== String(scope.adminid)) throw new TenantError("Invoice not found.", "BAD_USER_INPUT");
      // Each half needs its own module; changing saved details or cancelling needs Edit.
      if (["irn", "irnAckNo", "irnAckDate", "signedQr", "irnStatus"].some((k) => input?.[k] !== undefined)) {
        await assertGstOn(scope, "einvoice", inv.irn || input?.irnStatus ? "edit" : "add");
      }
      if (["ewaybillno", "ewaybilldate", "ewaybillvalidupto"].some((k) => input?.[k] !== undefined)) {
        await assertGstOn(scope, "ewaybill", inv.ewaybillno ? "edit" : "add");
      }
      const allowed = ["irn", "irnAckNo", "irnAckDate", "signedQr", "irnStatus", "ewaybillno", "ewaybilldate", "ewaybillvalidupto"];
      const $set: any = {};
      for (const k of allowed) if (input?.[k] !== undefined) $set[k] = typeof input[k] === "string" ? input[k].trim() : input[k];
      if ($set.irn && !/^[0-9a-f]{64}$/i.test($set.irn)) throw new Error("IRN must be 64 letters/digits as shown on the portal.");
      if ($set.ewaybillno && !/^\d{12}$/.test($set.ewaybillno)) throw new Error("E-Way Bill number must be 12 digits.");
      if ($set.irn && !$set.irnStatus) $set.irnStatus = "generated";
      await SalesInvoice.updateOne({ _id: id }, { $set });
      return loadInvoice(id);
    },

    assignInvoiceDeliveryBoy: async (_: any, { id, deliveryboyid }: any, context: any) => {
      const updated = await SalesInvoice.findByIdAndUpdate(
        id,
        { deliveryboyid, deliveryStatus: "dispatched" },
        { new: true }
      ).populate(populateFields).lean();
      if (!updated) throw new Error("Invoice not found");
      await syncOrderFromInvoice(id, { orderStatus: "dispatched", deliveryStatus: "dispatched", deliveryboyid });
      await notifyInvoiceEvent(updated, context, "assigned for delivery");
      return formatInvoice(updated);
    },
  },

  // Per-invoice outstanding (role-free). Only computed when `outstanding` is
  // selected (e.g. bill allocation), so listings pay no cost.
  SalesInvoice: {
    // ISO string (was epoch ms); clients send it back as expectedUpdatedAt.
    updatedAt: (parent: any) => isoOf(parent?.updatedAt),
    outstanding: async (parent: any) =>
      getInvoiceOutstanding({ invoiceid: parent?.id, invoicemodel: "SalesInvoice" }),
    // Number of the Sales Order this bill came from ("000009"). Order-only
    // businesses never see an invoice number, so their receipt screen labels
    // the bill with this instead — the same number they confirmed the order
    // under. Null for a directly-created invoice.
    sourceorderno: async (parent: any) => {
      // Pre-resolved in bulk by getSalesInvoices.
      if (parent && "__sourceorderno" in parent) return parent.__sourceorderno;
      try {
        const oid = refId(parent?.sourceorderid);
        if (!oid) return null;
        const order: any = await SalesOrder.findById(oid).select("billnumber").lean();
        return order?.billnumber || null;
      } catch (e) {
        // A label is never worth failing the whole invoice list over.
        return null;
      }
    },
    // "Previous Balance" = what the party owed on their OTHER unsettled
    // bills, before this one — this invoice is excluded from the sum
    // entirely, regardless of whether it's since been paid.
    partyPreviousBalance: async (parent: any) => {
      const partyId = refId(parent?.partyacc);
      return await partyBillOutstanding(partyId, parent?.id);
    },
    // "Current Balance" = Previous Balance + this bill's own Grand Total —
    // a running statement figure (like a physical bill), not net of whether
    // this particular bill has already been settled.
    partyCurrentBalance: async (parent: any) => {
      const partyId = refId(parent?.partyacc);
      const previous = await partyBillOutstanding(partyId, parent?.id);
      const total = Number(parent?.totalamount || 0);
      return parseFloat((previous + total).toFixed(2));
    },
  },
};
