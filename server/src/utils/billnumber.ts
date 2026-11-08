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
