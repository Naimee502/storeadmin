// Party picker label "Name - Mobile - City"; missing parts are dropped.
export type PartyLike = {
  /** Party Accounts carry `name`; invoice snapshots carry `accountname`. */
  name?: string | null;
  accountname?: string | null;
  mobile?: string | null;
  city?: string | null;
};

export const partyLabel = (
  party: PartyLike | null | undefined,
  /** POS uses "•"; the form pages use "-". Only the separator differs. */
  separator: string = "-"
): string => {
  if (!party) return "";
  return [
    (party.name || party.accountname || "").trim(),
    (party.mobile || "").trim(),
    (party.city || "").trim(),
  ]
    .filter(Boolean)
    .join(` ${separator} `);
};

// "Party / Ledger" cell of a payment row; mobile looked up from accounts when available.
export const paymentPartyLabel = (
  payment: any,
  accounts: PartyLike[] | null | undefined = []
): string => {
  const acc = payment?.partyid?.id
    ? (accounts || []).find((a: any) => a?.id === payment.partyid.id)
    : null;
  const name = (acc?.name || payment?.partyid?.name || "").trim();
  if (!name) return payment?.counterledgerid?.ledgername || "-";
  // Payments store only the name; rebuild the label from the account if it exists.
  return partyLabel({
    name,
    mobile: (acc as any)?.mobile || null,
    city: (acc as any)?.city || null,
  });
};

// Split a partyLabel into name and "mobile · city" for two-line cells.
export const splitPartyLabel = (
  label: string | null | undefined
): { name: string; mobile: string; city: string } => {
  const text = String(label ?? "").trim();
  const parts = text.split(" - ").map((p) => p.trim());
  const idx = parts.findIndex((p, i) => i > 0 && /^\+?[\d\s]{7,15}$/.test(p));
  if (idx === -1) return { name: text, mobile: "", city: "" };
  return {
    name: parts.slice(0, idx).join(" - "),
    mobile: parts[idx],
    city: parts.slice(idx + 1).join(" - "),
  };
};
