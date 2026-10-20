import { requireBackofficeTenant } from "../../../utils/tenant";

/**
 * Reverse geocoding (GPS point → postal address) through OpenStreetMap's
 * Nominatim service. Free, no API key — but its usage policy asks for an
 * identifying User-Agent, at most ~1 request a second, and caching. Party
 * creation is a handful of lookups a day, so a small in-memory cache keyed on
 * the point (rounded to ~10 m) is plenty, and it runs server-side so the
 * phones never call a third party directly.
 *
 * Best effort: any failure returns null and the form is simply typed by hand.
 */
const cache = new Map<string, any>();
const CACHE_MAX = 500;
let lastCallAt = 0;

const pick = (...vals: any[]) => vals.find((v) => typeof v === "string" && v.trim())?.trim() ?? "";

export const geocodeResolvers = {
  Query: {
    reverseGeocode: async (_: any, { latitude, longitude }: { latitude: number; longitude: number }, context: any) => {
      await requireBackofficeTenant(context);
      if (!isFinite(latitude) || !isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        return null;
      }

      const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
      if (cache.has(key)) return cache.get(key);

      // Respect Nominatim's 1 request / second.
      const wait = 1100 - (Date.now() - lastCallAt);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastCallAt = Date.now();

      try {
        const nominatim = async (zoom: number) => {
          const url =
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=${zoom}` +
            `&accept-language=en&lat=${latitude}&lon=${longitude}`;
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 8000);
          try {
            const res = await fetch(url, {
              headers: { "User-Agent": "RudraERP/1.0 (rudra.digisysindiatech.com)" },
              signal: ctrl.signal,
            });
            if (!res.ok) {
              console.warn(`[reverseGeocode] zoom ${zoom} HTTP ${res.status}`);
              return null;
            }
            const json: any = await res.json();
            console.log(
              `[reverseGeocode] ${latitude},${longitude} zoom ${zoom} →`,
              JSON.stringify({ display_name: json?.display_name, address: json?.address })
            );
            return json;
          } finally {
            clearTimeout(timer);
          }
        };

        const data: any = await nominatim(18);
        if (!data) return null;
        const a = data?.address ?? {};


        const city = pick(a.city, a.town, a.village, a.municipality, a.city_district, a.county, a.state_district);
        const street = [pick(a.house_number, a.building), pick(a.road, a.pedestrian, a.street, a.footway, a.path)]
          .filter(Boolean)
          .join(" ");
        const area = pick(
          a.neighbourhood, a.suburb, a.quarter, a.residential, a.hamlet,
          a.industrial, a.commercial, a.retail, a.allotments, a.isolated_dwelling, a.locality
        );
        let address = [pick(a.shop, a.amenity, a.office, a.building), street, area]
          .filter(Boolean)
          .filter((v, i, arr) => arr.indexOf(v) === i && v !== city)
          .join(", ");

        // No road / area tags (common on the edge of town): use OSM's full
        // label as the address instead of leaving it empty.
        if (!address && typeof data?.display_name === "string") {
          address = data.display_name.trim();
        }

        const result = {
          address,
          city,
          state: pick(a.state),
          pincode: String(a.postcode ?? "").replace(/\s/g, ""),
          country: pick(a.country),
        };

        console.log(`[reverseGeocode] ${latitude},${longitude} result →`, JSON.stringify(result));
        if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
        // A result with no street-level address is not remembered, so the
        // next capture at that spot asks OSM again.
        if (result.address) cache.set(key, result);
        return result;
      } catch (e: any) {
        console.warn("[reverseGeocode] failed:", e?.message);
        return null;
      }
    },
  },
};
