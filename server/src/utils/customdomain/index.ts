import { AdminSettings } from "../../models/adminsettings";

// ─────────────────────────────────────────────────────────────────────────────
// Custom domains for the customer website (clientweb).
//
// A business can have its storefront on its own domain (dkmarketing.com)
// instead of / as well as rudra.digisysindiatech.com/<storeslug>. The domain is
// saved in Business Settings -> Website Storefront -> Custom Domain, always in
// the normalised form below (lowercase, no protocol / path / port / "www."),
// so "https://WWW.DkMarketing.com/" and "dkmarketing.com" are the same thing.
// ─────────────────────────────────────────────────────────────────────────────

const DOMAIN_RE = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** "https://WWW.DkMarketing.com:443/shop" -> "dkmarketing.com" ("" if blank). */
export const normalizeDomain = (raw: any): string => {
  let d = String(raw ?? "").trim().toLowerCase();
  d = d.replace(/^[a-z]+:\/\//, ""); // protocol
  d = d.split("/")[0].split("?")[0].split("#")[0]; // path / query
  d = d.split(":")[0]; // port
  d = d.replace(/^www\./, "").replace(/\.$/, "");
  return d;
};

export const isValidDomain = (d: string) => DOMAIN_RE.test(d);

// ── CORS: allow the browser on a saved custom domain to call the API ─────────
// Cached for a minute so every request doesn't hit the database. A domain
// saved in Business Settings starts working within that minute.
let cache: { at: number; domains: Set<string> } = { at: 0, domains: new Set() };
const CACHE_MS = 60 * 1000;

export const getCustomDomains = async (): Promise<Set<string>> => {
  if (Date.now() - cache.at < CACHE_MS) return cache.domains;
  const rows: any[] = await AdminSettings.find({ customDomain: { $exists: true, $nin: [null, ""] } })
    .select("customDomain")
    .lean();
  cache = { at: Date.now(), domains: new Set(rows.map((r) => String(r.customDomain))) };
  return cache.domains;
};

/** Forget the cache (called when a business saves its custom domain). */
export const clearCustomDomainCache = () => {
  cache = { at: 0, domains: new Set() };
};

/** Is this browser Origin one of the saved custom domains (with or without www)? */
export const isCustomDomainOrigin = async (origin?: string) => {
  if (!origin) return false;
  const host = normalizeDomain(origin);
  if (!host) return false;
  const domains = await getCustomDomains();
  return domains.has(host);
};
