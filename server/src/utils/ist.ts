// Business days are Indian calendar days, whatever clock the server runs on.
const pad2 = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD of a moment in IST. */
export const istDate = (d: Date = new Date()) => {
  const ist = new Date(d.getTime() + 330 * 60000);
  return `${ist.getUTCFullYear()}-${pad2(ist.getUTCMonth() + 1)}-${pad2(ist.getUTCDate())}`;
};

/** 00:00 IST of the day a moment falls on. */
export const istDayStart = (d: Date = new Date()) => new Date(`${istDate(d)}T00:00:00.000+05:30`);

/** 23:59:59.999 IST of the day a moment falls on. */
export const istDayEnd = (d: Date = new Date()) => new Date(`${istDate(d)}T23:59:59.999+05:30`);

/** A date or date-time typed without a zone is read as IST. */
export const parseIst = (v: any) => {
  const t = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return new Date(`${t}T00:00:00+05:30`);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(t)) return new Date(`${t}+05:30`);
  return new Date(v);
};
