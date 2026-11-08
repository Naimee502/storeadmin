import { ApolloError } from "apollo-server-express";
import { Types } from "mongoose";
import { isoOf } from "../../../utils/offlinesync";
import { tenantOf } from "../offlinedevice";
import { SYNC_COLLECTIONS, SyncCollection, SyncCtx } from "./collections";

// Max records per collection in one call; the rest come with nextSince.
const CAP = 5000;
// Writes still in flight when the pull starts are picked up by the next pull.
const OVERLAP_MS = 5000;
const ORDER = { updatedAt: 1, _id: 1 } as const;
const HIDDEN = new Set(["_id", "__v", "password", "otp", "otpExpiry", "fcmtoken", "smtpPassEnc"]);

// JSON as GraphQL would send the list item: ids as strings, dates as epoch ms text.
const toWire = (v: any): any => {
  if (v === null || v === undefined) return v;
  if (v instanceof Types.ObjectId || v?._bsontype) return String(v);
  if (v instanceof Date) return String(v.getTime());
  if (Array.isArray(v)) return v.map(toWire);
  if (typeof v !== "object") return v;
  const out: any = {};
  if (v._id !== undefined && v.id === undefined) out.id = String(v._id);
  for (const [k, val] of Object.entries(v)) {
    if (!HIDDEN.has(k) && val !== undefined) out[k] = toWire(val);
  }
  return out;
};

async function pullCollection(name: string, c: SyncCollection, ctx: SyncCtx, since: Date | null) {
  const scope = c.scope ? await c.scope(ctx) : { [c.tenant]: ctx.adminid };
  const window = since
    ? c.changed ? await c.changed(ctx, since) : { updatedAt: { $gt: since } }
    : c.live ?? { status: true };
  const filter = { $and: [scope, window] };

  let rows: any[] = await c.find(filter).sort(ORDER).limit(CAP + 1);
  let nextSince: string | null = null;
  if (rows.length > CAP) {
    rows = rows.slice(0, CAP);
    const last = rows[CAP - 1];
    // Records sharing the last timestamp come too, so the next call can start strictly after it.
    const ties = await c.find({ $and: [filter, { updatedAt: last.updatedAt ?? null }, { _id: { $gt: last._id } }] }).sort(ORDER);
    rows = rows.concat(ties);
    nextSince = isoOf(last.updatedAt) ?? new Date(0).toISOString();
  }

  const isLive = c.isLive ?? ((d: any) => d.status === true);
  const live = since ? rows.filter(isLive) : rows;
  const deletedIds = since ? rows.filter((d) => !isLive(d)).map((d) => String(d._id)) : [];
  const shaped = c.shape ? await c.shape(live, ctx) : live;
  const docs = shaped.map((d: any) => {
    const w = toWire(d);
    // ISO like the billing types return it; edits send it back as expectedUpdatedAt.
    w.updatedAt = isoOf(d?.updatedAt);
    return w;
  });
  return { collection: name, docs, deletedIds, nextSince };
}

export const syncResolvers = {
  Query: {
    syncPull: async (_: any, { collections, since }: { collections: string[]; since?: string | null }, context: any) => {
      const user = context?.user;
      if (!user?.id) throw new ApolloError("Please sign in again.", "UNAUTHENTICATED");
      if (!["admin", "branch", "staff"].includes(String(user.type))) {
        throw new ApolloError("Sync is not available for this login.", "FORBIDDEN");
      }
      const names = Array.from(new Set((collections || []).map((n) => String(n).toLowerCase())));
      const unknown = names.filter((n) => !SYNC_COLLECTIONS[n]);
      if (unknown.length) throw new ApolloError(`Unknown sync collection: ${unknown.join(", ")}`, "BAD_USER_INPUT");

      let sinceAt: Date | null = null;
      if (since !== null && since !== undefined && since !== "") {
        const iso = isoOf(String(since).trim());
        if (!iso) throw new ApolloError("since is not a valid date.", "BAD_USER_INPUT");
        sinceAt = new Date(iso);
      }

      // Taken before the queries so nothing written meanwhile is missed.
      const serverTime = new Date(Date.now() - OVERLAP_MS).toISOString();
      const { adminid } = await tenantOf(context);
      const ctx: SyncCtx = { context, adminid };
      const changes = await Promise.all(names.map((n) => pullCollection(n, SYNC_COLLECTIONS[n], ctx, sinceAt)));
      return { serverTime, changes };
    },
  },
};
