// Price-list lookup from pulled (or cached) lists and assignments, same rules as the server's resolvePrice.
import { GET_PRICE_ASSIGNMENTS, GET_PRICE_LIST_BY_ID } from "../graphql/queries/pricelists";
import { getOfflineClient } from "./outbox";
import { localDoc, localDocs } from "./localdb";

export type LocalPrice =
  // Price found, or no list applies (price null: use the product's own rate).
  | { status: "ok"; price: { rate: number; discount: number; discounttype: string } | null }
  // A list that may apply is not cached: the result is a guess.
  | { status: "unknown" };

const idOf = (v: any): string => (!v ? "" : typeof v === "string" ? v : String(v.id ?? v._id ?? ""));

function read(query: any, variables: any): any {
  try {
    return getOfflineClient()?.cache.readQuery({ query, variables }) ?? null;
  } catch {
    return null;
  }
}

// True for a failure caused by having no network (not a server answer).
export function isNoNetworkError(err: any): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const ne = err?.networkError;
  return !!ne && typeof ne.statusCode !== "number" && !ne.result;
}

export function resolvePriceLocally(v: {
  adminid?: string;
  productid: string;
  variantid: string;
  unitid: string;
  accountid?: string | null;
  channelid?: string | null;
  region?: string | null;
  staff?: boolean;
  noStaffDiscount?: boolean;
}): LocalPrice {
  if (!v.adminid) return { status: "unknown" };
  const all: any[] | undefined = localDocs("priceassignment") ?? read(GET_PRICE_ASSIGNMENTS, { adminid: v.adminid })?.getPriceAssignments;
  if (!Array.isArray(all)) return { status: "unknown" };
  const active = all.filter((a) => a && a.status !== false);
  const of = (type: string, target: string) => active.filter((a) => a.targettype === type && String(a.targetid) === target);
  // Same order as the server: customer, channel+region, channel, region.
  const picked: any[] = [];
  if (v.accountid) picked.push(...of("customer", String(v.accountid)));
  if (v.channelid && v.region) picked.push(...of("channel_region", `${v.channelid}--${v.region}`));
  if (v.channelid) picked.push(...of("channel", String(v.channelid)));
  if (v.region) picked.push(...of("region", String(v.region)));
  if (!picked.length) return { status: "ok", price: null };
  for (const a of picked) {
    const listId = idOf(a.pricelistid);
    if (!listId) continue;
    const pulled = localDoc("pricelist", listId);
    const res = Array.isArray(pulled?.items) ? { getPriceListById: pulled } : read(GET_PRICE_LIST_BY_ID, { id: listId });
    // Not stored: the server might still match here.
    if (!res) return { status: "unknown" };
    const list = res.getPriceListById;
    if (!list) continue;
    const item = (list.items || []).find(
      (i: any) => idOf(i.productid) === v.productid && idOf(i.variantid) === v.variantid && idOf(i.unitid) === v.unitid
    );
    if (!item) continue;
    let discount = Number(item.discount) || 0;
    let discounttype = item.discounttype || "fixed";
    if (discounttype === "percentage") {
      discount = Math.round((((Number(item.rate) || 0) * discount) / 100) * 100) / 100;
      discounttype = "fixed";
    }
    if (v.staff && v.noStaffDiscount) discount = 0;
    return { status: "ok", price: { rate: Number(item.rate) || 0, discount, discounttype } };
  }
  return { status: "ok", price: null };
}
