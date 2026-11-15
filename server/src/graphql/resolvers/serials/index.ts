import { Types } from "mongoose";
import { SerialMove, SerialStock } from "../../../models/serial";
import { ProductService } from "../../../models/products";
import { Branch } from "../../../models/branches";
import { Account } from "../../../models/accounts";
import { requireBackofficeTenant } from "../../../utils/tenant";
import { assertModuleOn } from "../../../utils/modulegate";
import { containsRx } from "../../../utils/listquery";
import { normSerial } from "../../../utils/serials";

const s = (v: any) => (v ? String(v) : "");
const ids = (rows: any[], k: string) => [...new Set(rows.map((r) => s(r[k])).filter(Boolean))];

const scopeOf = async (context: any) => {
  const scope = await requireBackofficeTenant(context);
  await assertModuleOn("serials", "IMEI / Serial No.", { adminid: scope.adminid });
  return scope;
};

/** Names for units: item, branch, vendor, customer and bill numbers. */
const shapeAll = async (rows: any[]) => {
  const [products, branches, parties, pinv, sinv]: any[] = await Promise.all([
    ProductService.find({ _id: { $in: ids(rows, "productid") } }).select("name productvariants._id productvariants.name").lean(),
    Branch.find({ _id: { $in: ids(rows, "branchid") } }).select("branchname").lean(),
    Account.find({ _id: { $in: [...ids(rows, "vendorid"), ...ids(rows, "customerid")] } }).select("name mobile").lean(),
    rows.length ? (await import("../../../models/purchaseinvoice")).PurchaseInvoice.find({ _id: { $in: ids(rows, "purchasedocid") } }).select("billnumber").lean() : [],
    rows.length ? (await import("../../../models/salesinvoice")).SalesInvoice.find({ _id: { $in: ids(rows, "saledocid") } }).select("billnumber").lean() : [],
  ]);
  const map = (list: any[]) => new Map(list.map((x: any) => [s(x._id), x]));
  const P = map(products), B = map(branches), A = map(parties), PI = map(pinv), SI = map(sinv);
  return rows.map((u) => {
    const p: any = P.get(s(u.productid));
    const cust: any = A.get(s(u.customerid));
    return {
      id: s(u._id), serialno: u.serialno, productid: s(u.productid), productname: p?.name || null,
      variantid: u.variantid ? s(u.variantid) : null, variantname: p?.productvariants?.find((v: any) => s(v._id) === s(u.variantid))?.name || null,
      branchid: u.branchid ? s(u.branchid) : null, branchname: (B.get(s(u.branchid)) as any)?.branchname || null, status: u.status,
      purchasedocid: u.purchasedocid ? s(u.purchasedocid) : null, purchasebill: (PI.get(s(u.purchasedocid)) as any)?.billnumber || null,
      purchasedate: u.purchasedate || null, vendorname: (A.get(s(u.vendorid)) as any)?.name || null,
      saledocid: u.saledocid ? s(u.saledocid) : null, salebill: (SI.get(s(u.saledocid)) as any)?.billnumber || null,
      saledate: u.saledate || null, customername: cust?.name || null, customermobile: cust?.mobile || null, warrantytill: u.warrantytill || null,
    };
  });
};

export const serialResolvers = {
  Query: {
    getSerials: async (_: any, { filter = {} }: any, context: any) => {
      const sc = await scopeOf(context);
      const q: any = { adminid: sc.adminid };
      if (filter.status) q.status = filter.status;
      if (filter.productid) q.productid = filter.productid;
      if (filter.branchid) q.branchid = filter.branchid;
      if (filter.search) {
        const t = String(filter.search).trim();
        const [prods, parties]: any[] = await Promise.all([
          ProductService.find({ adminid: sc.adminid, name: containsRx(t) }).select("_id").limit(300).lean(),
          Account.find({ admin: sc.adminid, $or: [{ name: containsRx(t) }, { mobile: containsRx(t) }] }).select("_id").limit(300).lean(),
        ]);
        q.$or = [{ serialno: containsRx(normSerial(t)) }, { productid: { $in: prods.map((x: any) => x._id) } }, { customerid: { $in: parties.map((x: any) => x._id) } }];
      }
      return shapeAll(await SerialStock.find(q).sort({ updatedAt: -1 }).limit(1000).lean());
    },
    getAvailableSerials: async (_: any, { productid, variantid }: any, context: any) => {
      const sc = await scopeOf(context);
      return shapeAll(await SerialStock.find({ adminid: sc.adminid, productid, variantid: variantid || null, status: "instock" }).sort({ serialno: 1 }).limit(2000).lean());
    },
    getInvoiceSerials: async (_: any, { invoiceid }: any, context: any) => {
      const sc = await scopeOf(context);
      if (!Types.ObjectId.isValid(String(invoiceid))) return [];
      return shapeAll(await SerialStock.find({ adminid: sc.adminid, saledocid: invoiceid, status: "sold" }).sort({ serialno: 1 }).lean());
    },
    getSerialHistory: async (_: any, { serialno }: any, context: any) => {
      const sc = await scopeOf(context);
      const rows: any[] = await SerialMove.find({ adminid: sc.adminid, serialno: normSerial(serialno) }).sort({ createdAt: 1 }).lean();
      const names = new Map(((await Account.find({ _id: { $in: ids(rows, "partyid") } }).select("name").lean()) as any[]).map((a) => [s(a._id), a.name]));
      return rows.map((r) => ({ action: r.action, docmodel: r.docmodel || null, docno: r.docno || null, partyname: names.get(s(r.partyid)) || null, createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null }));
    },
  },
};
