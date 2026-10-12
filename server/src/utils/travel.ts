/**
 * Distance travelled from a day's GPS pings.
 *
 * Raw GPS wobbles: a phone lying on a table still reports points 10–50 m
 * apart, and the odd fix jumps a kilometre and back. Adding every gap up would
 * turn a salesman sitting in one shop into "8 km travelled", so — like Zoho /
 * field-force apps — a gap is only counted when it is a real move:
 *   • the fix is reasonably precise (accuracy ≤ 150 m),
 *   • the gap is bigger than the GPS error of the two fixes (and ≥ 25 m),
 *   • the implied speed is believable for road travel (≤ 150 km/h).
 * Straight-line between points, so a winding road reads a little short; with
 * the app's ~100 m distance filter that difference stays small.
 */

const R = 6371000; // earth radius, metres
const rad = (d: number) => (d * Math.PI) / 180;

export const haversineMeters = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

const MAX_ACCURACY_M = 150;
const MIN_STEP_M = 25;
const MAX_SPEED_MPS = 150 / 3.6;

/** Total metres travelled over pings already sorted by time. */
export const travelledMeters = (pings: any[]): number => {
  let total = 0;
  let last: any = null;
  for (const p of pings) {
    if (p?.latitude == null || p?.longitude == null) continue;
    if (p.accuracy != null && Number(p.accuracy) > MAX_ACCURACY_M) continue;
    if (!last) {
      last = p;
      continue;
    }
    const d = haversineMeters(last, p);
    const noise = Math.max(MIN_STEP_M, Number(last.accuracy || 0), Number(p.accuracy || 0));
    if (d < noise) continue; // jitter — stay anchored at the last real position
    const secs = (new Date(p.pingedAt).getTime() - new Date(last.pingedAt).getTime()) / 1000;
    if (secs > 0 && d / secs > MAX_SPEED_MPS) continue; // GPS jump
    total += d;
    last = p;
  }
  return total;
};
