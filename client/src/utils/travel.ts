/**
 * Running distance over a day's GPS trail — same rules as the server's
 * utils/travel.ts (getTravelSummary), so the per-row "KM so far" column adds
 * up to the day's total: jitter smaller than the GPS error is ignored, poor
 * fixes (> 150 m accuracy) and impossible jumps (> 150 km/h) are skipped.
 */
const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

const haversine = (a: any, b: any) => {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** Cumulative km after each ping (pings sorted oldest first). */
export const cumulativeKm = (pings: any[]): number[] => {
  let total = 0;
  let last: any = null;
  return pings.map((p) => {
    const usable = p?.latitude != null && p?.longitude != null && !(p.accuracy != null && Number(p.accuracy) > 150);
    if (usable) {
      if (!last) last = p;
      else {
        const d = haversine(last, p);
        const noise = Math.max(25, Number(last.accuracy || 0), Number(p.accuracy || 0));
        const secs = (new Date(p.pingedAt).getTime() - new Date(last.pingedAt).getTime()) / 1000;
        const jump = secs > 0 && d / secs > 150 / 3.6;
        if (d >= noise && !jump) {
          total += d;
          last = p;
        }
      }
    }
    return Math.round((total / 1000) * 100) / 100;
  });
};
