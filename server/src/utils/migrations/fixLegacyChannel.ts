/**
 * One-time migration: convert legacy `productvariants.pricing.channel` values
 * (e.g. the string "enduser") into proper Channel ObjectId references.
 *
 * Run once after deploying the channel-as-ObjectId schema change:
 *
 *   ts-node src/utils/migrations/fixLegacyChannel.ts
 *
 * Safe to re-run — it only touches docs whose channel is not already a valid
 * ObjectId.
 */

import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
import { ProductService } from "../../models/products";
import { Channel } from "../../models/channel";

dotenv.config();

async function getOrCreateDefaultChannel(
  adminId: Types.ObjectId
): Promise<Types.ObjectId> {
  let channel =
    (await Channel.findOne({ admin: adminId, isDefault: true })) ||
    (await Channel.findOne({ admin: adminId, channelName: /^end ?user$/i }));

  if (!channel) {
    channel = await Channel.create({
      admin: adminId,
      channelName: "End User",
      isDefault: true,
      status: true,
    });
  }
  return channel._id as Types.ObjectId;
}

export async function fixLegacyChannel() {
  // Find every product where any pricing.channel is non-ObjectId.
  // We pull all and filter in memory because querying mixed types is awkward.
  const products = await ProductService.find({}).lean();

  let touched = 0;
  for (const p of products) {
    let dirty = false;
    const variants = p.productvariants || [];
    for (const v of variants) {
      const pricing = v.pricing || [];
      for (const pr of pricing) {
        const ch = (pr as any).channel;
        // Already a real ObjectId instance → leave it.
        if (ch instanceof Types.ObjectId) continue;
        // Valid ObjectId-shaped string → coerce, but don't replace.
        if (typeof ch === "string" && Types.ObjectId.isValid(ch) && ch.length === 24) {
          (pr as any).channel = new Types.ObjectId(ch);
          dirty = true;
          continue;
        }
        // Anything else (null, "", "enduser", garbage) → admin default.
        (pr as any).channel = await getOrCreateDefaultChannel(p.adminid);
        dirty = true;
      }
    }
    if (dirty) {
      await ProductService.updateOne(
        { _id: p._id },
        { $set: { productvariants: variants } }
      );
      touched++;
    }
  }
  return touched;
}

// Allow running directly: `ts-node fixLegacyChannel.ts`
if (require.main === module) {
  (async () => {
    await mongoose.connect(process.env.MONGO_URI!);
    const n = await fixLegacyChannel();
    console.log(`✅ Migrated ${n} product document(s).`);
    await mongoose.disconnect();
  })();
}
