// ---------------------------------------------------------------------------
// One-time repair: invoice journals whose party leg does not match the bill.
//
// The purchase journal used to push its vendor leg with `credit: 0` and let a
// "final balance adjustment" fill it in afterwards. That made the vendor
// whatever amount happened to balance the entry — products + GST — rather than
// what the bill actually said. Other charges, the invoice discount and the
// round-off had no leg at all, so every bill carrying a freight line left the
// vendor short by exactly that freight.
//
// The builder now credits the vendor the bill total outright and posts the
// missing legs, but nothing rewrites journals that are already on disk. This
// script finds them and reposts.
//
// The sales side is checked too, though it is expected to come back clean: it
// always debited the customer `totalamount` explicitly and balanced itself by
// adjusting a Sales leg, never the party one.
//
// How it repairs: the existing Transaction is updated IN PLACE, keeping its _id,
// so anything pointing at it (the invoice's own link, reports, audit trails)
// stays intact. A rebuilt entry that does not balance is skipped and reported —
// never written — because a half-posted journal is worse than a known-stale one.
//
// Run:
//     cd server
//     npx ts-node src/scripts/repostinvoicejournals.ts            # dry run
//     npx ts-node src/scripts/repostinvoicejournals.ts --apply
// ---------------------------------------------------------------------------

import mongoose from "mongoose";
import dotenv from "dotenv";
import { SalesInvoice, buildSalesInvoiceJournal } from "../models/salesinvoice";
import { PurchaseInvoice, buildPurchaseInvoiceJournal } from "../models/purchaseinvoice";
import { Account } from "../models/accounts";
import { Transaction } from "../models/transactions";

dotenv.config();

const APPLY = process.argv.includes("--apply");
const money = (n: any) => `₹${(Number(n) || 0).toFixed(2)}`;
const r2 = (n: any) => parseFloat((Number(n) || 0).toFixed(2));

const SPECS = [
  {
    label: "Purchase Invoice",
    Model: PurchaseInvoice,
    docmodel: "PurchaseInvoice" as const,
    build: buildPurchaseInvoiceJournal,
    // Money owed to a vendor sits on the credit side of their ledger.
    partyAmount: (legs: any[]) => r2(legs.reduce((t, e) => t + (e.credit || 0) - (e.debit || 0), 0)),
  },
  {
    label: "Sales Invoice",
    Model: SalesInvoice,
    docmodel: "SalesInvoice" as const,
    build: buildSalesInvoiceJournal,
    // Money owed by a customer sits on the debit side.
    partyAmount: (legs: any[]) => r2(legs.reduce((t, e) => t + (e.debit || 0) - (e.credit || 0), 0)),
  },
];

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DB_URI;
  if (!uri) {
    // On a dev box MONGO_URI comes from server/.env. On the VPS it lives inside
    // ecosystem.config.js, which pm2 injects into the app process only — a
    // script run by hand never sees it. Hence the second form.
    throw new Error(
      "MONGO_URI not set.\n" +
        "  Local : add it to server/.env\n" +
        "  VPS   : pass it inline, e.g.\n" +
        "          MONGO_URI=\"mongodb://127.0.0.1:27017/pos_billing_erp\" node dist/scripts/<script>.js"
    );
  }
  await mongoose.connect(uri);
  console.log(`Connected. Mode: ${APPLY ? "APPLY (writing)" : "DRY RUN (no writes)"}\n`);

  for (const spec of SPECS) {
    console.log(`===== ${spec.label} =====`);

    const invoices: any[] = await spec.Model.find({})
      .select("_id billnumber billdate totalamount partyacc")
      .lean();

    // One pass for the journals, keyed by the invoice they came from.
    const trxByInvoice = new Map<string, any>();
    (
      await Transaction.find({ "source.docmodel": spec.docmodel })
        .select("_id source entries")
        .lean()
    ).forEach((t: any) => {
      const k = String(t?.source?.docid);
      if (k) trxByInvoice.set(k, t);
    });

    const partyLedgerCache = new Map<string, any>();
    async function partyLedgerId(partyacc: any) {
      const k = String(partyacc);
      if (!partyLedgerCache.has(k)) {
        const acc: any = await Account.findById(partyacc).select("ledgerid").lean();
        partyLedgerCache.set(k, acc?.ledgerid ? String(acc.ledgerid) : null);
      }
      return partyLedgerCache.get(k);
    }

    const drifted: Array<{ inv: any; trx: any; was: number; should: number }> = [];
    let noJournal = 0;

    for (const inv of invoices) {
      const trx = trxByInvoice.get(String(inv._id));
      if (!trx) { noJournal++; continue; }

      const pid = await partyLedgerId(inv.partyacc);
      if (!pid) continue;

      const legs = (trx.entries || []).filter((e: any) => String(e.ledgerid) === pid);
      if (!legs.length) continue;

      const was = spec.partyAmount(legs);
      const should = r2(inv.totalamount);
      if (Math.abs(was - should) > 0.01) drifted.push({ inv, trx, was, should });
    }

    console.log(`  ${invoices.length} invoice(s); ${noJournal} with no journal (use backfillreceived --post-journals)`);
    console.log(`  ${drifted.length} whose party leg does not match the bill`);

    drifted.slice(0, 25).forEach(({ inv, was, should }) =>
      console.log(
        `    - #${inv.billnumber || inv._id}  ${String(inv.billdate).slice(0, 10)}` +
          `  party has ${money(was)}, bill says ${money(should)}  (short by ${money(should - was)})`
      )
    );
    if (drifted.length > 25) console.log(`    ... and ${drifted.length - 25} more`);

    if (drifted.length && APPLY) {
      let ok = 0;
      const skipped: string[] = [];
      for (const { inv, trx } of drifted) {
        try {
          // Rebuild from the FULL document — the list above was fetched lean
          // with only a handful of fields selected.
          const full: any = await spec.Model.findById(inv._id).lean();
          const built = await spec.build(full);
          if (!built?.entries?.length) {
            skipped.push(`#${inv.billnumber}: builder returned no entries`);
            continue;
          }
          const dr = r2(built.entries.reduce((t: number, e: any) => t + (e.debit || 0), 0));
          const cr = r2(built.entries.reduce((t: number, e: any) => t + (e.credit || 0), 0));
          if (Math.abs(dr - cr) > 0.01) {
            skipped.push(`#${inv.billnumber}: rebuilt entry does not balance (${money(dr)} vs ${money(cr)})`);
            continue;
          }
          await Transaction.updateOne(
            { _id: trx._id },
            { $set: { entries: built.entries, totaldebit: dr, totalcredit: cr } }
          );
          ok++;
        } catch (e: any) {
          skipped.push(`#${inv.billnumber}: ${e?.message || e}`);
        }
      }
      console.log(`  reposted: ${ok}, skipped: ${skipped.length}`);
      skipped.slice(0, 25).forEach((x) => console.log(`    ! ${x}`));
      if (skipped.length > 25) console.log(`    ... and ${skipped.length - 25} more`);
    }

    console.log("");
  }

  if (!APPLY) console.log("Dry run — nothing was written. Re-run with --apply.");
  else console.log("Done. Check the affected parties' statements — their closing balances will have moved.");

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
