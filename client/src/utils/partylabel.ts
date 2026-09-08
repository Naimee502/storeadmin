/**
 * One label for a party/vendor wherever they are picked from a dropdown.
 *
 *     Name - Mobile - City
 *
 * Two parties here share a name often enough that the mobile was added to tell
 * them apart; the city is the next thing the person entering an order actually
 * knows about the customer in front of them ("A TO Z TOYS" in Rajkot vs the one
 * in Surat), so it belongs on the same line rather than one screen deeper.
 *
 * Every part is optional — a walk-in with no mobile, or an account with no city,
 * simply drops that segment instead of printing "undefined" or a dangling dash.
 * Keep every party picker on this function so one screen can never drift into
 * showing a different label from the rest.
 */
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

/**
 * The "Party / Ledger" cell of a payment row.
 *
 * A payment posts against EITHER a party — a customer or vendor whose bills it
 * settles — OR a plain ledger (capital, a loan, rent, salary, a bank charge).
 * Show whichever side this one used, so two same-day receipts for the same
 * amount are not indistinguishable in a list.
 *
 * The payment record itself stores only the party's NAME, so the mobile is
 * looked up from the accounts list when one is available; if that account was
 * later deleted, the payment's own stored name still shows. Shared by the
 * Payments module, its Deleted Entries page and the Home activity table so the
 * three can never drift into showing different things.
 */
export const paymentPartyLabel = (
  payment: any,
  accounts: PartyLike[] | null | undefined = []
): string => {
  const acc = payment?.partyid?.id
    ? (accounts || []).find((a: any) => a?.id === payment.partyid.id)
    : null;
  const name = (acc?.name || payment?.partyid?.name || "").trim();
  if (!name) return payment?.counterledgerid?.ledgername || "-";
  const mobile = ((acc as any)?.mobile || "").trim();
  return mobile ? `${name} - ${mobile}` : name;
};
