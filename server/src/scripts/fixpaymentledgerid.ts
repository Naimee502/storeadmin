// ---------------------------------------------------------------------------
// One-time repair: auto-created Payments stored the PARTY ledger in
// `Payment.ledgerid` instead of the Cash/Bank ledger.
//
// `Payment.ledgerid` is the cash/bank side of the entry — the UI labels it
// "Cash / Bank Ledger" and `buildPaymentEntries()` in the payments resolver
// reads it as such. SalesInvoice / PurchaseInvoice used to write
// `customer.ledgerid` / `vendor.ledgerid` there when auto-creating the
// settlement payment.
//
// The Transaction created alongside was always correct (it used payLedger
// directly), so nothing is wrong in the books UNTIL somebody opens one of these
// payments in Payments ▸ Edit and saves. `editPayment` then rebuilds the
// journal from `input.ledgerid` and posts:
//
//     Dr  <party>   X
//         Cr  <party>   X      ← net zero, Cash never debited
//
// which silently corrupts the Cash Book and the party balance while still
// passing the "debit == credit" check.
//
// This script fixes `Payment.ledgerid` only. It also REPORTS (never rewrites)
// transactions that already show the corrupted signature, so they can be
// reviewed by hand.
//
// Run:
//     cd server
//     npx ts-node src/scripts/fixpaymentledgerid.ts            # dry run
//     npx ts-node src/scripts/fixpaymentledgerid.ts --apply    # write changes
// ---------------------------------------------------------------------------

import mongoose from "mongoose";
import dotenv from "dotenv";
import { Payment } from "../models/payments";
import { Account } from "../models/accounts";
import { AccountLedger } from "../models/accountledgers";
import { Transaction } from "../models/transactions";

dotenv.config();

const APPLY = process.argv.includes("--apply");
const money = (n: any) => `₹${(Number(n) || 0).toFixed(2)}`;

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DB_URI;
  if (!uri) throw new Error("Set MONGO_URI in server/.env before running this script.");
  await mongoose.connect(uri);
  console.log(`Connected. Mode: ${APPLY ? "APPLY (writing)" : "DRY RUN (no writes)"}\n`);

  const payments: any[] = await Payment.find({ partyid: { $ne: null } })
    .select("_id paymentcode adminid mode ledgerid partyid transactionid")
    .lean();

  // Cache "Cash" / "Bank Account" ledger ids per admin so we don't re-query.
  const ledgerCache = new Map<string, any>();
  async function cashBankLedger(adminid: any, mode: string) {
    const name = String(mode).toLowerCase() === "cash" ? "Cash" : "Bank Account";
    const key = `${adminid}::${name}`;
    if (!ledgerCache.has(key)) {
      const led: any = await AccountLedger.findOne({ ledgername: name, admin: adminid }).select("_id").lean();
      ledgerCache.set(key, led?._id || null);
    }
    return ledgerCache.get(key);
  }

  const partyCache = new Map<string, any>();
  async function partyLedgerId(partyid: any) {
    const key = String(partyid);
    if (!partyCache.has(key)) {
      const acc: any = await Account.findById(partyid).select("ledgerid").lean();
      partyCache.set(key, acc?.ledgerid || null);
    }
    return partyCache.get(key);
  }

  let broken = 0;
  let fixed = 0;
  const unresolved: string[] = [];

  for (const p of payments) {
    const partyLed = await partyLedgerId(p.partyid);
    if (!partyLed || String(p.ledgerid) !== String(partyLed)) continue;

    broken++;
    const correct = await cashBankLedger(p.adminid, p.mode);
    if (!correct) {
      unresolved.push(`${p.paymentcode || p._id} (mode=${p.mode}) — no Cash/Bank ledger found for this admin`);
      continue;
    }

    console.log(`${p.paymentcode || p._id}: ledgerid ${p.ledgerid} -> ${correct}`);
    if (APPLY) {
      await Payment.updateOne({ _id: p._id }, { $set: { ledgerid: correct } });
      fixed++;
    }
  }

  // ── Backfill unallocatedamount on payments that pre-date the field ───────
  // Old On-Account payments (an amount saved with no bills ticked) have no
  // unallocatedamount at all, so they never show in the "Unallocated" column
  // and are invisible to the advance auto-adjust. Derive it from what they
  // actually settle: unallocated = amount − (settled − discount + commission).
  const missing: any[] = await Payment.find({
    status: true,
    unallocatedamount: { $exists: false },
  })
    .select("_id paymentcode amount invoices")
    .lean();

  let backfilled = 0;
  for (const p of missing) {
    const lines = p.invoices || [];
    const settled = lines.reduce((t: number, l: any) => t + (Number(l.settledamount) || 0), 0);
    const disc = lines.reduce((t: number, l: any) => t + (Number(l.discount) || 0), 0);
    const comm = lines.reduce((t: number, l: any) => t + (Number(l.commission) || 0), 0);
    const unallocated = Math.max(0, Number((Number(p.amount) - (settled - disc + comm)).toFixed(2)));
    const mode = lines.length ? "manual" : "on_account";

    if (unallocated > 0) {
      console.log(`${p.paymentcode || p._id}: unallocated ₹${unallocated.toFixed(2)} (${mode})`);
    }
    if (APPLY) {
      await Payment.updateOne(
        { _id: p._id },
        { $set: { unallocatedamount: unallocated, allocationmode: mode } }
      );
      backfilled++;
    }
  }

  // ── Relabel opening-only payments that were stamped "manual" ────────────
  // `prepareAllocation` used to treat "no bill lines BUT openingsettled > 0" as
  // a manual settlement, so Manage Payments showed "Invoice-wise" for a receipt
  // the user had explicitly recorded as Direct / On Account. No bill lines at
  // all means the money went on account and/or onto the opening balance.
  const mislabelled: any[] = await Payment.find({
    status: true,
    allocationmode: { $nin: ["on_account", null] },
    $or: [{ invoices: { $size: 0 } }, { invoices: { $exists: false } }],
  })
    .select("_id paymentcode amount openingsettled allocationmode")
    .lean();

  for (const p of mislabelled) {
    console.log(
      `${p.paymentcode || p._id}: allocationmode "${p.allocationmode}" -> "on_account"` +
        ` (${money(p.amount)}, opening settled ${money(p.openingsettled)})`
    );
    if (APPLY) {
      await Payment.updateOne({ _id: p._id }, { $set: { allocationmode: "on_account" } });
    }
  }

  // ── Journals that posted less than the cash received ────────────────────
  // The party leg used to be the sum of settledamount rather than the amount.
  // Any payment that left money on account or cleared an opening balance
  // therefore under-posted its journal by the difference. Detect and list them;
  // opening each one and pressing Update rebuilds the entry correctly.
  const withTrx: any[] = await Payment.find({ status: true, transactionid: { $ne: null } })
    .select("paymentcode amount invoices transactionid")
    .lean();

  const underPosted: string[] = [];
  for (const p of withTrx) {
    const trx: any = await Transaction.findById(p.transactionid).select("totaldebit").lean();
    if (!trx) continue;
    const disc = (p.invoices || []).reduce((t: number, l: any) => t + (Number(l.discount) || 0), 0);
    const expected = Number((Number(p.amount) + disc).toFixed(2));
    const posted = Number(trx.totaldebit) || 0;
    if (Math.abs(expected - posted) > 0.01) {
      underPosted.push(
        `  - ${p.paymentcode || p._id}  amount ${money(p.amount)}  journal posted ${money(posted)}  (short by ${money(expected - posted)})`
      );
    }
  }

  // Transactions already damaged by a re-save: every entry on the same ledger.
  const suspects: any[] = await Transaction.find({ "source.docmodel": "Payment" })
    .select("_id narration entries transactiondate")
    .lean();
  const corrupted = suspects.filter((t: any) => {
    const ids = (t.entries || []).map((e: any) => String(e.ledgerid));
    return ids.length > 1 && new Set(ids).size === 1;
  });

  console.log("\n──────────── SUMMARY ────────────");
  console.log(`Payments scanned          : ${payments.length}`);
  console.log(`Wrong ledgerid found      : ${broken}`);
  console.log(`Fixed                     : ${APPLY ? fixed : 0}${APPLY ? "" : "  (dry run — re-run with --apply)"}`);
  console.log(`Missing unallocatedamount : ${missing.length}`);
  console.log(`Backfilled                : ${APPLY ? backfilled : 0}`);
  console.log(`Mislabelled Invoice-wise  : ${mislabelled.length}${APPLY ? " (relabelled)" : "  (dry run)"}`);
  if (unresolved.length) {
    console.log(`\nCould not resolve (${unresolved.length}) — create the ledger, then re-run:`);
    unresolved.forEach((u) => console.log(`  - ${u}`));
  }
  if (underPosted.length) {
    console.log(`\n⚠  ${underPosted.length} payment(s) whose journal is smaller than the cash received.`);
    console.log("   Open each in Payments ▸ Edit and press Update to rebuild the entry:");
    underPosted.slice(0, 50).forEach((l) => console.log(l));
    if (underPosted.length > 50) console.log(`  ... and ${underPosted.length - 50} more`);
  }
  if (corrupted.length) {
    console.log(`\n⚠  ${corrupted.length} transaction(s) look already corrupted (all legs on one ledger).`);
    console.log("   NOT touched by this script — review and repost these by hand:");
    corrupted.slice(0, 50).forEach((t: any) =>
      console.log(`  - ${t._id}  ${String(t.transactiondate).slice(0, 10)}  ${t.narration || ""}`)
    );
    if (corrupted.length > 50) console.log(`  ... and ${corrupted.length - 50} more`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
