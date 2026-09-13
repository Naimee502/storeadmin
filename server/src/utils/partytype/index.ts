// ---------------------------------------------------------------------------
// What side of the books a party sits on.
//
// Most parties are one thing: someone you sell to, or someone you buy from.
// But plenty of firms are both — you buy stock from them and you also sell to
// them — and forcing that into two separate accounts means their two balances
// never meet, so nobody can answer "at the end of it, who owes whom?".
//
// So "both" is its own party type, and every screen that used to ask
// `type === "customer"` asks isCustomerParty() instead. A both-party then shows
// up wherever a customer shows up AND wherever a vendor shows up, on one ledger:
// a debit balance means they owe us, a credit balance means we owe them. That is
// the same convention every accounting package uses for a party on both sides,
// and it is why there is one ledger rather than two.
//
// Kept as one tiny module so the admin panel, the salesman app and the server
// cannot drift into three different ideas of what a customer is.
// ---------------------------------------------------------------------------

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

/**
 * Mongo filter for "parties that can act as X".
 *
 * Callers used to write `query.type = "customer"`, which silently excluded a
 * both-party. Use this instead so the exclusion cannot be reintroduced by
 * copying the old line.
 */
export const partyTypeQuery = (want: "customer" | "vendor") =>
  want === "customer" ? { $in: ["customer", "both"] } : { $in: ["vendor", "both"] };
