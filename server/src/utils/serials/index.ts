import mongoose, { Types } from "mongoose";
import { Admin } from "../../models/admin";
import { SerialMove, SerialStock } from "../../models/serial";
import { StockMove } from "../../models/stockmove";
import { ProductService } from "../../models/products";
import { TenantError } from "../tenant";

const oid = (v: any) => (v && typeof v === "object" && !(v instanceof Types.ObjectId) ? v._id || v.id : v);
const s = (v: any) => (v ? String(v) : "");
const bad = (m: string) => new TenantError(m, "BAD_USER_INPUT");
export const normSerial = (v: any) => String(v || "").trim().toUpperCase().replace(/\s+/g, "");

/** IMEI / Serial No. is opt-in: on only when the business has ticked the module. */
export const serialsOn = async (adminid: any) => {
  const a: any = await Admin.findById(oid(adminid)).select("allowedmodules").lean();
  return Array.isArray(a?.allowedmodules) && a.allowedmodules.some((m: string) => String(m).toLowerCase() === "serials");
};

// What each document does to a unit, and the field that links the unit to it.
const ROLE: Record<string, { link: string; to: string; from: string }> = {
  PurchaseInvoice: { link: "purchasedocid", to: "instock", from: "" },
  SalesInvoice: { link: "saledocid", to: "sold", from: "instock" },
  SalesReturn: { link: "returndocid", to: "instock", from: "sold" },
  PurchaseReturn: { link: "vendorreturndocid", to: "returned", from: "instock" },
};

/** Serial numbers on a document's lines, by item. */
const lineSerials = (doc: any) => {
  const out: { productid: string; variantid: string; serials: string[] }[] = [];
  for (const l of doc?.productservice || []) {
    const serials = [...new Set((l.serials || []).map(normSerial).filter(Boolean))] as string[];
    if (serials.length) out.push({ productid: s(oid(l.productserviceid)), variantid: s(oid(l.variantid)), serials });
  }
  return out;
};

const name = async (productid: any) => ((await ProductService.findById(productid).select("name").lean()) as any)?.name || "item";
const dupes = (list: string[]) => list.filter((x, i) => list.indexOf(x) !== i);

/** Before a bill is saved: units must be real, of that item, and free for this bill. */
export const checkSerials = async (docmodel: string, input: any, docid?: any) => {
  const role = ROLE[docmodel];
  if (!role || !input) return;
  const adminid = oid(input.adminid);
  if (!adminid || !(await serialsOn(adminid))) return;
  const lines = lineSerials(input);
  const all = lines.flatMap((l) => l.serials);
  const twice = dupes(all);
  if (twice.length) throw bad(`IMEI / Serial ${twice[0]} is entered twice.`);
  for (const l of input.productservice || []) {
    const n = (l.serials || []).map(normSerial).filter(Boolean).length;
    if (n > Number(l.qty || 0)) throw bad(`${await name(oid(l.productserviceid))}: ${n} serial numbers for a quantity of ${l.qty}.`);
  }
  const mine = docid && Types.ObjectId.isValid(String(docid)) ? String(docid) : "";
  const found: any[] = all.length ? await SerialStock.find({ adminid, serialno: { $in: all } }).lean() : [];
  const byNo = new Map(found.map((x) => [x.serialno, x]));
  for (const l of lines) {
    for (const no of l.serials) {
      const u: any = byNo.get(no);
      if (docmodel === "PurchaseInvoice") {
        // A new unit; it may already exist only as this bill's own or as one sent back to the vendor.
        if (u && s(u[role.link]) !== mine && u.status !== "returned") throw bad(`IMEI / Serial ${no} is already in stock or sold.`);
        continue;
      }
      if (!u) throw bad(`IMEI / Serial ${no} is not in stock.`);
      if (s(u.productid) !== l.productid || s(u.variantid) !== l.variantid) throw bad(`IMEI / Serial ${no} belongs to ${await name(u.productid)}.`);
      if (s(u[role.link]) === mine && u.status === role.to) continue;
      if (u.status !== role.from) {
        const where = u.status === "sold" ? "already sold" : u.status === "returned" ? "sent back to the vendor" : "in stock, not sold";
        throw bad(`IMEI / Serial ${no} is ${where}.`);
      }
      if (docmodel === "SalesReturn" && input.sourceInvoiceId && s(u.saledocid) !== s(oid(input.sourceInvoiceId))) {
        throw bad(`IMEI / Serial ${no} was not sold on this invoice.`);
      }
    }
  }
  // An edited purchase cannot drop a unit that has moved on since.
  if (mine && docmodel === "PurchaseInvoice") await guardRemoval(docmodel, mine, new Set(all));
};

/** Units this document brought in that have moved on: the document cannot let them go. */
export const guardRemoval = async (docmodel: string, docid: any, keep = new Set<string>()) => {
  const role = ROLE[docmodel];
  if (!role || !Types.ObjectId.isValid(String(docid))) return;
  const busy: any = await SerialStock.findOne({
    [role.link]: new Types.ObjectId(String(docid)), serialno: { $nin: [...keep] }, status: { $ne: role.to },
  }).lean();
  if (busy) throw bad(`IMEI / Serial ${busy.serialno} has moved on since (now ${busy.status}); it cannot be taken off this bill.`);
};

const log = (adminid: any, serialno: string, action: string, docmodel: string, doc: any, partyid?: any) =>
  SerialMove.create({ adminid, serialno, action, docmodel, docid: doc._id, docno: doc.billnumber || undefined, partyid: partyid || undefined }).catch(() => {});

/** Bring the units linked to a document in line with it (only items the document really moved). */
export const syncSerials = async (docmodel: string, docid: any) => {
  const role = ROLE[docmodel];
  try {
    if (!role || !docid || !Types.ObjectId.isValid(String(docid))) return;
    const id = new Types.ObjectId(String(docid));
    const doc: any = await mongoose.model(docmodel).findById(id).lean();
    if (!doc?.adminid || !(await serialsOn(doc.adminid))) return;
    const moved = new Set((await StockMove.aggregate([
      { $match: { docid: id } },
      { $group: { _id: { p: "$productid", v: "$variantid" }, q: { $sum: "$qty" } } },
    ])).filter((g) => Math.abs(Number(g.q)) > 1e-9).map((g) => `${s(g._id.p)}|${s(g._id.v)}`));
    const want = new Map<string, { productid: string; variantid: string }>();
    for (const l of lineSerials(doc)) {
      if (!moved.has(`${l.productid}|${l.variantid}`)) continue;
      l.serials.forEach((no) => want.set(no, l));
    }
    const linked: any[] = await SerialStock.find({ adminid: doc.adminid, [role.link]: id, status: role.to }).lean();
    const have = new Set(linked.map((u) => u.serialno));
    const party = doc.partyacc || undefined;
    const warrantyOf = async (productid: any, variantid: any) => {
      const p: any = await ProductService.findById(productid).select("productvariants._id productvariants.warrantymonths").lean();
      const m = Number(p?.productvariants?.find((v: any) => s(v._id) === s(variantid))?.warrantymonths || 0);
      if (!(m > 0) || !doc.billdate) return undefined;
      const d = new Date(`${String(doc.billdate).slice(0, 10)}T12:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() + m);
      return d.toISOString().slice(0, 10);
    };

    // Taken off (or the bill no longer moves stock): undo.
    for (const u of linked.filter((x) => !want.has(x.serialno))) {
      if (docmodel === "PurchaseInvoice") {
        await SerialStock.deleteOne({ _id: u._id, status: "instock" });
      } else if (docmodel === "SalesInvoice") {
        await SerialStock.updateOne({ _id: u._id }, { $set: { status: "instock" }, $unset: { saledocid: "", saledate: "", customerid: "", warrantytill: "" } });
      } else if (docmodel === "SalesReturn") {
        await SerialStock.updateOne({ _id: u._id }, { $set: { status: "sold", saledocid: u.lastsaledocid || u.saledocid }, $unset: { returndocid: "" } });
      } else {
        await SerialStock.updateOne({ _id: u._id }, { $set: { status: "instock" }, $unset: { vendorreturndocid: "" } });
      }
      log(doc.adminid, u.serialno, "undone", docmodel, doc, party);
    }
    // Added.
    for (const [no, l] of want) {
      if (have.has(no)) continue;
      const key = { adminid: doc.adminid, serialno: no };
      if (docmodel === "PurchaseInvoice") {
        await SerialStock.updateOne(key, {
          $set: { productid: l.productid, variantid: l.variantid || null, status: "instock", branchid: doc.branchid, purchasedocid: id, purchasedate: doc.billdate, vendorid: party },
          $unset: { saledocid: "", saledate: "", customerid: "", warrantytill: "", vendorreturndocid: "", returndocid: "" },
        }, { upsert: true });
      } else if (docmodel === "SalesInvoice") {
        await SerialStock.updateOne({ ...key, status: "instock" }, {
          $set: { status: "sold", saledocid: id, lastsaledocid: id, saledate: doc.billdate, customerid: party, branchid: doc.branchid, warrantytill: await warrantyOf(l.productid, l.variantid) },
        });
      } else if (docmodel === "SalesReturn") {
        await SerialStock.updateOne({ ...key, status: "sold" }, { $set: { status: "instock", returndocid: id, branchid: doc.branchid }, $unset: { saledocid: "", customerid: "", warrantytill: "" } });
      } else {
        await SerialStock.updateOne({ ...key, status: "instock" }, { $set: { status: "returned", vendorreturndocid: id } });
      }
      log(doc.adminid, no, role.to === "instock" ? (docmodel === "SalesReturn" ? "returned by customer" : "bought") : role.to, docmodel, doc, party);
    }
  } catch (e) {
    console.error("serial sync failed:", e);
  }
};

const idOf = (args: any[], result: any) => (result && typeof result === "object" ? oid(result) : null) || args[1]?.id;

/** Check serials before these bill mutations and keep units in step after them. */
export const withSerials = (map: any, docmodel: string, fields: string[]) => {
  if (!map?.Mutation) return map;
  const M = { ...map.Mutation };
  for (const f of fields) {
    const orig = M[f];
    if (typeof orig !== "function") continue;
    M[f] = async (...args: any[]) => {
      const a = args[1] || {};
      if (a.input) await checkSerials(docmodel, a.input, a.id);
      // Deleting or cancelling a purchase / return cannot strand units that moved on.
      else if (a.id && /^(delete|cancel)/.test(f) && (docmodel === "PurchaseInvoice" || docmodel === "SalesReturn")) await guardRemoval(docmodel, a.id);
      const result = await orig(...args);
      const id = f === "convertSalesOrderToInvoice" ? oid(result) : idOf(args, result);
      if (id) await syncSerials(docmodel, id);
      return result;
    };
  }
  return { ...map, Mutation: M };
};
