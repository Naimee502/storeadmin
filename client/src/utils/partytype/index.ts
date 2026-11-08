
// Party side of the books; "both" parties count as customer and vendor on one ledger.

export type PartyType = "customer" | "vendor" | "both" | "expense" | "bank" | "other";

const norm = (t: any) => String(t || "").toLowerCase();

/** Sells to them: appears in Payment In, Sales Invoice, Sales Order, POS. */
export const isCustomerParty = (type: any): boolean => {
  const t = norm(type);
  return t === "customer" || t === "both";
};

/** Buys from them: appears in Payment Out, Purchase Invoice, Purchase Order. */
export const isVendorParty = (type: any): boolean => {
  const t = norm(type);
  return t === "vendor" || t === "both";
};

/** On both sides at once — the case that needs the two balances netted. */
export const isBothParty = (type: any): boolean => norm(type) === "both";

/** Mongo filter for parties that can act as X, including "both". */
export const partyTypeQuery = (want: "customer" | "vendor") =>
  want === "customer" ? { $in: ["customer", "both"] } : { $in: ["vendor", "both"] };
