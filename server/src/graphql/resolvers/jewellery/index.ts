import { Types } from "mongoose";
import { MetalRate } from "../../../models/metalrate";
import { requireBackofficeTenant, TenantError } from "../../../utils/tenant";
import { assertModuleOn, isModuleOn } from "../../../utils/modulegate";
import { istDate } from "../../../utils/ist";

const shape = (r: any) => ({ id: String(r._id), date: r.date, metal: r.metal, purity: r.purity, rate: Number(r.rate), createdby_name: r.createdby_name || null, updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : null });

const scopeOf = async (context: any) => {
  const scope = await requireBackofficeTenant(context);
  await assertModuleOn("jewellery", "Jewellery", { adminid: scope.adminid });
  return scope;
};

/** Latest row of each metal + purity on or before the date. */
const latestRates = async (adminid: any, date: string) => {
  const rows: any[] = await MetalRate.aggregate([
    { $match: { adminid, date: { $lte: date } } },
    { $sort: { date: -1 } },
    { $group: { _id: { m: "$metal", p: "$purity" }, doc: { $first: "$$ROOT" } } },
  ]);
  return rows.map((r) => r.doc).sort((a, b) => a.metal.localeCompare(b.metal) || b.purity.localeCompare(a.purity));
};

/** Price before GST of jewel details at a rate per gram (same sum as a jewellery bill line). */
export const jewelPrice = (j: any, rate: number) => {
  const net = Number(j.netweight) > 0 ? Number(j.netweight) : Math.max(0, Number(j.grossweight || 0) - Number(j.stoneweight || 0));
  const metal = r2(net * rate);
  const m = Number(j.making || 0);
  const making = r2(j.makingtype === "percent" ? (metal * m) / 100 : j.makingtype === "fixed" ? m : net * m);
  return r2(metal + making + Number(j.stonecharge || 0) + Number(j.othercharge || 0));
};

/** Today's rates of a business, looked up once per request; null when the module is off. */
const ratesFor = (context: any, adminid: string): Promise<Map<string, number> | null> => {
  const cache: Map<string, Promise<Map<string, number> | null>> = (context.__metalRates ||= new Map());
  if (!cache.has(adminid)) {
    cache.set(adminid, (async () => {
      if (!Types.ObjectId.isValid(adminid) || !(await isModuleOn("jewellery", { adminid }))) return null;
      const rows = await latestRates(new Types.ObjectId(adminid), istDate());
      return new Map(rows.map((x: any) => [`${x.metal}|${x.purity}`, Number(x.rate)]));
    })());
  }
  return cache.get(adminid)!;
};
const adminOf = (p: any) => String(p?.adminid?.id || p?.adminid?._id || p?.adminid || "");

export const jewelleryResolvers = {
  // Variants carry their business so liveprice can find its rates.
  ProductService: {
    productvariants: (p: any) => (Array.isArray(p.productvariants) ? p.productvariants.map((v: any) => ({ ...(v?.toObject ? v.toObject() : v), __adminid: adminOf(p) })) : p.productvariants),
  },
  ProductVariant: {
    liveprice: async (v: any, _: any, context: any) => {
      const j = v?.jewel;
      if (!j?.metal || !v.__adminid || !context) return null;
      const rate = (await ratesFor(context, v.__adminid))?.get(`${j.metal}|${j.purity || ""}`);
      if (!rate) return null;
      const price = jewelPrice(j, rate);
      return price > 0 ? price : null;
    },
  },
  Query: {
    getMetalRates: async (_: any, { date }: any, context: any) => {
      const sc = await scopeOf(context);
      return (await latestRates(sc.adminid, date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : istDate())).map(shape);
    },
    getMetalRateHistory: async (_: any, { metal, purity }: any, context: any) => {
      const sc = await scopeOf(context);
      return (await MetalRate.find({ adminid: sc.adminid, metal, purity }).sort({ date: -1 }).limit(90).lean()).map(shape);
    },
  },
  Mutation: {
    setMetalRates: async (_: any, { date, rates }: any, context: any) => {
      const sc = await scopeOf(context);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) throw new TenantError("Pick the date.", "BAD_USER_INPUT");
      const who = context?.user?.name || context?.user?.email;
      for (const r of rates || []) {
        const metal = String(r.metal || "").trim().toLowerCase();
        const purity = String(r.purity || "").trim().toUpperCase();
        const rate = Number(r.rate);
        if (!metal || !purity) continue;
        if (!(rate > 0)) throw new TenantError(`Enter the rate of ${metal} ${purity}.`, "BAD_USER_INPUT");
        await MetalRate.updateOne({ adminid: sc.adminid, metal, purity, date }, { $set: { rate, createdby_name: who } }, { upsert: true });
      }
      return (await latestRates(sc.adminid, date)).map(shape);
    },
  },
};

const r2 = (n: any) => Math.round((Number(n) || 0) * 100) / 100;
/** Old gold lines are valued here (weight less deduction %, at the rate), so the receipt matches the lines. */
const normaliseOldGold = (input: any) => {
  if (!input || (input.oldgold === undefined && input.oldgoldamount === undefined)) return;
  const lines = (input.oldgold || []).map((l: any) => {
    const weight = Math.max(0, Number(l.weight) || 0);
    const deduction = Math.min(100, Math.max(0, Number(l.deduction) || 0));
    const rate = Math.max(0, Number(l.rate) || 0);
    return { ...l, weight, deduction, rate, amount: r2(weight * (1 - deduction / 100) * rate) };
  }).filter((l: any) => l.weight > 0 && l.rate > 0);
  input.oldgold = lines;
  input.oldgoldamount = r2(lines.reduce((t: number, l: any) => t + l.amount, 0));
};

/** Value old gold on Sales Invoice saves. */
export const withJewellery = (map: any) => {
  if (!map?.Mutation) return map;
  const M = { ...map.Mutation };
  for (const f of ["addSalesInvoice", "editSalesInvoice"]) {
    const orig = M[f];
    if (typeof orig !== "function") continue;
    M[f] = async (...args: any[]) => {
      normaliseOldGold(args[1]?.input);
      return orig(...args);
    };
  }
  return { ...map, Mutation: M };
};
