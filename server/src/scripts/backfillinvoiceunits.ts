// ---------------------------------------------------------------------------
// One-time repair: invoice lines saved without a unit.
//
// The unit only became compulsory recently. Bills entered before that can carry
// lines with no salesunitid / purchaseunitid at all, and those bills can no
// longer be edited: the new validation refuses to save until every line has a
// unit, while the picker had nothing selected to begin with. The UI now shows
// an explicit "— Select unit —" so a line CAN be repaired by hand; this script
// is for not doing that hundreds of times.
//
// What it fills in: the variant's own base unit — and ONLY that. unitqty is left
// exactly as it is, so the script cannot change what any line means.
//
// Why that is safe rather than a guess. Every quantity is converted with
// convertToBaseUnit(qty * unitqty, unitid, variant), and that function returns
// the quantity untouched when the unit is missing OR when the unit IS the base
// unit. So a line that had no unit was already being counted as base units —
// naming the base unit writes down what the books have been assuming all along.
// No stock figure moves, no amount moves, no journal changes.
//
// Lines that already have a unit are never touched, and neither is a line whose
// variant has no base unit of its own — there is nothing defensible to write
// there, so it is reported instead and left for a human.
//
// Run:
//     cd server
//     node dist/scripts/backfillinvoiceunits.js            # dry run, see the counts
//     node dist/scripts/backfillinvoiceunits.js --apply
// ---------------------------------------------------------------------------

import mongoose from "mongoose";
import dotenv from "dotenv";
import { SalesInvoice } from "../models/salesinvoice";
import { PurchaseInvoice } from "../models/purchaseinvoice";
import { ProductService } from "../models/products";

dotenv.config();

const APPLY = process.argv.includes("--apply");

type Spec = {
  label: string;
  Model: any;
  field: "salesunitid" | "purchaseunitid";
};

const SPECS: Spec[] = [
  { label: "Sales Invoice", Model: SalesInvoice, field: "salesunitid" },
  { label: "Purchase Invoice", Model: PurchaseInvoice, field: "purchaseunitid" },
];

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DB_URI;
  if (!uri) {
    throw new Error(
      "No Mongo connection string. This project keeps MONGO_URI in ecosystem.config.js " +
        "(pm2 env), which a hand-run script does not see. Run:\n" +
        '  export MONGO_URI="mongodb://127.0.0.1:27017/pos_billing_erp"'
    );
  }
  await mongoose.connect(uri);
  console.log(`Connected. Mode: ${APPLY ? "APPLY (writing)" : "DRY RUN (no writes)"}\n`);

  // One pass over the catalogue: variant id -> its base unit.
  const baseUnitByVariant = new Map<string, string>();
  const products: any[] = await ProductService.find({})
    .select("productvariants._id productvariants.baseunitid")
    .lean();
  products.forEach((prod: any) =>
    (prod.productvariants || []).forEach((v: any) => {
      if (v?._id && v?.baseunitid) baseUnitByVariant.set(String(v._id), String(v.baseunitid));
    })
  );
  console.log(`Catalogue: ${baseUnitByVariant.size} variant(s) with a base unit\n`);

  for (const spec of SPECS) {
    console.log(`===== ${spec.label} =====`);

    const invoices: any[] = await spec.Model.find({})
      .select("_id billnumber billdate productservice")
      .lean();

    let fixable = 0;
    let lines = 0;
    const repairable: Array<{ inv: any; idx: number[]; units: string[] }> = [];
    const stuck: string[] = [];
    const odd: string[] = [];

    for (const inv of invoices) {
      const idx: number[] = [];
      const units: string[] = [];
      (inv.productservice || []).forEach((line: any, i: number) => {
        if (line?.[spec.field]) return; // already has one
        lines++;
        const base = line?.variantid ? baseUnitByVariant.get(String(line.variantid)) : undefined;
        if (!base) {
          stuck.push(`#${inv.billnumber || inv._id} line ${i + 1}: variant has no base unit`);
          return;
        }
        idx.push(i);
        units.push(base);
        if (!(Number(line?.unitqty) > 0)) {
          odd.push(
            `#${inv.billnumber || inv._id} line ${i + 1}: unitqty is ${line?.unitqty} — this line moves no stock`
          );
        }
      });
      if (idx.length) {
        repairable.push({ inv, idx, units });
        fixable += idx.length;
      }
    }

    console.log(`  ${invoices.length} invoice(s) scanned`);
    console.log(`  ${lines} line(s) with no unit — ${fixable} can take the variant's base unit`);
    repairable.slice(0, 20).forEach(({ inv, idx }) =>
      console.log(
        `    - #${inv.billnumber || inv._id}  ${String(inv.billdate).slice(0, 10)}  line(s) ${idx
          .map((i) => i + 1)
          .join(", ")}`
      )
    );
    if (repairable.length > 20) console.log(`    ... and ${repairable.length - 20} more invoice(s)`);

    if (odd.length) {
      console.log(`  ${odd.length} line(s) carry a unitqty of 0 or less — the unit is filled in,`);
      console.log(`  but the quantity they move stays 0. Worth a look:`);
      odd.slice(0, 20).forEach((x) => console.log(`    ? ${x}`));
      if (odd.length > 20) console.log(`    ... and ${odd.length - 20} more`);
    }

    // Never swallow these — they stay unsaveable until someone opens the bill.
    if (stuck.length) {
      console.log(`  ${stuck.length} line(s) need a human (no base unit to fall back on):`);
      stuck.slice(0, 20).forEach((x) => console.log(`    ! ${x}`));
      if (stuck.length > 20) console.log(`    ... and ${stuck.length - 20} more`);
    }

    if (repairable.length && APPLY) {
      let ok = 0;
      const failed: string[] = [];
      for (const { inv, idx, units } of repairable) {
        try {
          const set: any = {};
          idx.forEach((i, n) => {
            set[`productservice.${i}.${spec.field}`] = new mongoose.Types.ObjectId(units[n]);
            // unitqty is deliberately NOT touched. Every quantity is computed as
            // qty * unitqty, so rewriting it would change what the line means —
            // and a line sitting at 0 moved no stock at all, so "correcting" it
            // to 1 would make a later edit hand back inventory that never left.
            // This script fills in the missing unit and nothing else.
          });
          // updateOne, not save(): the invoice hooks repost journals and move
          // stock, and this repair must move neither.
          await spec.Model.updateOne({ _id: inv._id }, { $set: set });
          ok++;
        } catch (e: any) {
          failed.push(`#${inv.billnumber || inv._id}: ${e?.message || e}`);
        }
      }
      console.log(`  repaired: ${ok} invoice(s), failed: ${failed.length}`);
      failed.slice(0, 20).forEach((f) => console.log(`    ! ${f}`));
    }

    console.log("");
  }

  if (!APPLY) console.log("Dry run — nothing was written. Re-run with --apply.");
  else console.log("Done. Those bills will open and save normally now; no amount or stock changed.");

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
