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
        const url =
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18` +
          `&accept-language=en&lat=${latitude}&lon=${longitude}`;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch(url, {
          headers: { "User-Agent": "RudraERP/1.0 (rudra.digisysindiatech.com)" },
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!res.ok) return null;
        const data: any = await res.json();
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

        // Outskirts and villages often have no road / area tags at all. Fall
        // back to the leading parts of OSM's full label, minus the pieces that
        // already go into City / State / Pin / Country.
        if (!address && typeof data?.display_name === "string") {
          const drop = new Set(
            [city, a.state, a.state_district, a.county, a.country, a.postcode, a.city_district]
              .filter(Boolean)
              .map((v: string) => String(v).trim().toLowerCase())
          );
          address = data.display_name
            .split(",")
            .map((x: string) => x.trim())
            .filter((x: string) => x && !drop.has(x.toLowerCase()) && !/^\d{6}$/.test(x) && !/taluka|district/i.test(x))
            .slice(0, 3)
            .join(", ");
        }

        const result = {
          address,
          city,
          state: pick(a.state),
          pincode: String(a.postcode ?? "").replace(/\s/g, ""),
          country: pick(a.country),
        };

        if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
        cache.set(key, result);
        return result;
      } catch (e: any) {
        console.warn("[reverseGeocode] failed:", e?.message);
        return null;
      }
    },
  },
};
