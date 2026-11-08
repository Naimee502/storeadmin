// Mobile number as WhatsApp wants it: digits with country code (India by default).
export const DEFAULT_COUNTRY_CODE = "91";

export const toWhatsAppNumber = (
  raw?: string | null,
  countryCode: string = DEFAULT_COUNTRY_CODE,
): string | null => {
  // Free-text field may hold two numbers or a label; take the first number.
  const first = String(raw ?? "").split(/[,;/|]|\s+(?:or|and)\s+/i)[0];

  let digits = first.replace(/\D/g, "");
  if (!digits) return null;

  // Strip "00" exit code and trunk zeros.
  if (digits.startsWith("00")) digits = digits.slice(2);
  digits = digits.replace(/^0+/, "");

  // Add the country code only for a bare 10-digit number (by length, not a "91" prefix).
  if (digits.length === 10) digits = `${countryCode}${digits}`;

  // Implausible length: fall back to the plain share sheet.
  if (digits.length < 11 || digits.length > 15) return null;

  return digits;
};
