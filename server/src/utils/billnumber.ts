import mongoose from "mongoose";

// Main-series bill numbering. Device-series numbers ("A/000123", "CN-A/000012")
// are never considered, so offline bills can't break the server sequence.

/** Sorts digit runs by value, so "1000000" comes after "999999". */
export const NUMERIC_COLLATION = { locale: "en", numericOrdering: true };

const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Matches a main-series number: digits only, after the optional prefix ("CN-", "DN-"). */
export const mainSeriesRx = (prefix = "") => new RegExp(`^${escapeRx(prefix)}\\d+$`);

/** Next main-series number after the highest one in the list, padded to 6 digits. */
export function nextMainNumber(numbers: Array<string | null | undefined>, prefix = ""): string {
  const rx = new RegExp(`^${escapeRx(prefix)}(\\d+)$`);
  let max = 0;
  for (const n of numbers) {
    const m = rx.exec(String(n ?? ""));
    if (!m) continue;
    const v = parseInt(m[1], 10);
    if (v > max) max = v;
  }
  return `${prefix}${String(max + 1).padStart(6, "0")}`;
}

/** Next main-series billnumber for a business, from the highest stored one. */
export async function nextMainBillNumber(modelName: string, adminid: any, prefix = ""): Promise<string> {
  const top: any = await mongoose
    .model(modelName)
    .findOne({ adminid, billnumber: { $regex: mainSeriesRx(prefix) } })
    .collation(NUMERIC_COLLATION)
    .sort({ billnumber: -1 })
    .select("billnumber")
    .lean();
  return nextMainNumber([top?.billnumber], prefix);
}

/**
 * Two bills saved at the same moment can take the same number (highest + 1).
 * After a new bill is saved, the later one of a clash moves to the next free number.
 */
export const billNumberGuard = (modelName: string, prefix = "") => (schema: any) => {
  schema.pre("save", function (this: any, next: any) {
    this.$locals.billIsNew = this.isNew;
    next();
  });
  schema.post("save", async function (doc: any) {
    if (!doc?.$locals?.billIsNew || !mainSeriesRx(prefix).test(String(doc.billnumber || ""))) return;
    const M = mongoose.model(modelName);
    for (let i = 0; i < 20; i++) {
      const earlier = await M.exists({ adminid: doc.adminid, billnumber: doc.billnumber, _id: { $lt: doc._id } });
      if (!earlier) return;
      const fresh = await nextMainBillNumber(modelName, doc.adminid, prefix);
      await M.updateOne({ _id: doc._id }, { $set: { billnumber: fresh } });
      doc.billnumber = fresh;
    }
  });
};
