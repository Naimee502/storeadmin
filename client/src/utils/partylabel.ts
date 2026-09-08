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
