/**
 * A mobile number in the one shape WhatsApp will accept.
 *
 * Party Accounts store what the person typing them in typed: "9586400821",
 * "+91 95864 00821", "095864-00821". WhatsApp's wa.me links accept none of
 * those variants — the number has to be digits only WITH the country code,
 * and anything else comes back as "Phone number shared via url is invalid".
 * That is why the WhatsApp share used to land on the contact picker instead
 * of the party's chat: a bare ten-digit number was being handed to wa.me,
 * and wa.me quietly refused it.
 *
 * India is assumed for a bare national number because that is where every
 * account in this system is; pass `countryCode` to override.
 */
export const DEFAULT_COUNTRY_CODE = "91";

export const toWhatsAppNumber = (
  raw?: string | null,
  countryCode: string = DEFAULT_COUNTRY_CODE,
): string | null => {
  // The mobile field is free text and nobody validates it, so it sometimes
  // holds two numbers ("9586400821 / 9876543210", "9586400821, 98765 43210")
  // or a label in front of one ("Mo. 9586400821"). Take the first number;
  // stripping punctuation across the whole string instead would glue two
  // numbers into one twenty-digit nonsense and lose the party either way.
  const first = String(raw ?? "").split(/[,;/|]|\s+(?:or|and)\s+/i)[0];

  let digits = first.replace(/\D/g, "");
  if (!digits) return null;

  // "00" exit code (0091…), then any trunk zeros (0 95864 00821). No real
  // number begins with either once the country code is in front.
  if (digits.startsWith("00")) digits = digits.slice(2);
  digits = digits.replace(/^0+/, "");

  // A bare national number — and ONLY here does the country code go on.
  //
  // The test is LENGTH, never "does it already start with 91", and that is
  // deliberate in both directions:
  //   - 9198765432 is an ordinary ten-digit Indian mobile. Refusing to
  //     prefix it because of its first two digits would send the bill to a
  //     number two digits short.
  //   - 919586400821 is already twelve digits, so it never reaches this
  //     line. "91" cannot end up on twice, whatever shape it arrived in —
  //     "+91…", "91-…", "0091…" all collapse to the same twelve digits.
  if (digits.length === 10) digits = `${countryCode}${digits}`;

  // Too short to be a real number, or long enough to be a mistyped one (an
  // amount pasted into the mobile field, a number entered twice). Better to
  // fall back to the plain share sheet than to open a stranger's chat.
  if (digits.length < 11 || digits.length > 15) return null;

  return digits;
};
