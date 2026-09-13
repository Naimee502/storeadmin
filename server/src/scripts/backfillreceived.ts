// ---------------------------------------------------------------------------
// One-time migration for the "Received / Paid" model.
//
// Three separate jobs, in increasing order of how much they touch:
//
// 1. BACKFILL received / paid — NET OF WHAT IS ALREADY RECORDED.
//    Invoices predate the field, so they all read as 0, which would make every
//    old cash bill look unpaid. The old `paymenttype` maps cleanly: "credit"
//    collected nothing, anything else collected the lot.
//
//    But a bill may ALREADY have a payment against it, entered by hand in the
//    Payments screen. Writing the full total on top of that would claim the same
//    money twice. So what goes in is the total MINUS whatever is already
//    allocated: a bill that manual payments already cover gets 0, and only a
//    genuinely unrecorded collection gets a figure.
//
// 2. STAMP autosource on the receipts invoices created for themselves.
//    Re-saving an invoice used to find its receipt by "any payment against this
//    bill". That lookup is now `autosource`, so without this stamp an old
//    invoice re-saved would not find its own receipt and would raise a SECOND
//    one. This is the job you must not skip.
//
// 3. POST the receipts those backfilled figures imply (--post-receipts).
//    A non-zero `received` with no receipt behind it is a promise the books have
//    not kept: nothing changes until somebody happens to edit that invoice, and
//    then the party balance moves on a random day months later. Far better to
//    write them all at once, deliberately, here.
//
// 4. REPORT invoices with no journal.
//    Journals used to be optional, so anything saved while the flag was off is
//    missing from the books. Removing the flag does not post them retroactively.
//    Reported by default; pass --post-journals to actually write them, because
//    posting historical journals is a real accounting act and should be a
//    deliberate second decision rather than a side effect of a backfill.
//
// Run:
//     cd server
//     npx ts-node src/scripts/backfillreceived.ts            # dry run, see the counts
//     npx ts-node src/scripts/backfillreceived.ts --apply     # jobs 1 + 2
//     npx ts-node src/scripts/backfillreceived.ts --apply --post-journals --post-receipts
//
// Re-running is safe: job 1 recomputes from what is currently recorded, so a
// second pass over already-migrated data writes the same values.
// ---------------------------------------------------------------------------

import mongoose from "mongoose";
import dotenv from "dotenv";
import { SalesInvoice, buildSalesInvoiceJournal } from "../models/salesinvoice";
import { PurchaseInvoice, buildPurchaseInvoiceJournal } from "../models/purchaseinvoice";
import { Payment } from "../models/payments";
import { Transaction } from "../models/transactions";
import { Account } from "../models/accounts";
import { AccountLedger } from "../models/accountledgers";

dotenv.config();

const APPLY = process.argv.includes("--apply");
const POST_JOURNALS = process.argv.includes("--post-journals");
const POST_RECEIPTS = process.argv.includes("--post-receipts");

// Same mapping the invoice models use, so a backfilled receipt lands on the same
// ledger a freshly saved one would.
const LEDGER_BY_MODE: Record<string, string> = {
  cash: "Cash", bank: "Bank Account", upi: "Bank Account",
  card: "Bank Account", cheque: "Bank Account", other: "Cash",
};
const money = (n: any) => `₹${(Number(n) || 0).toFixed(2)}`;

type Spec = {
  label: string;
  Model: any;
  docmodel: "SalesInvoice" | "PurchaseInvoice";
  field: "received" | "paid";
  build: (inv: any) => Promise<any>;
};

const SPECS: Spec[] = [
  {
    label: "Sales Invoice",
    Model: SalesInvoice,
    docmodel: "SalesInvoice",
    field: "received",
    build: buildSalesInvoiceJournal,
  },
  {
    label: "Purchase Invoice",
    Model: PurchaseInvoice,
    docmodel: "PurchaseInvoice",
    field: "paid",
    build: buildPurchaseInvoiceJournal,
  },
];

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DB_URI;
  if (!uri) throw new Error("Set MONGO_URI in server/.env before running this script.");
  await mongoose.connect(uri);
  console.log(`Connected. Mode: ${APPLY ? "APPLY (writing)" : "DRY RUN (no writes)"}`);
  console.log(`Missing journals: ${POST_JOURNALS ? "WILL BE POSTED" : "report only"}\n`);

  for (const spec of SPECS) {
    console.log(`===== ${spec.label} =====`);

    // ---- Job A: stamp autosource FIRST ----
    // Has to precede the backfill: an invoice whose own receipt is stamped here
    // is one the backfill must leave alone.
    const unstamped: any[] = await Payment.find({
      "autosource.docid": { $in: [null, undefined] },
      "invoices.invoicemodel": spec.docmodel,
    })
      .select("_id paymentcode invoices transactionid")
      .lean();

    let stamped = 0;
    const autoIds: any[] = [];
    for (const pay of unstamped) {
      const line = (pay.invoices || []).find(
        (l: any) => l?.invoicemodel === spec.docmodel && l?.invoiceid
      );
      if (!line || !pay.transactionid) continue;
      const trx: any = await Transaction.findById(pay.transactionid).select("entrytype source").lean();
      const isAuto =
        trx?.entrytype === "auto" &&
        trx?.source?.docmodel === "Payment" &&
        String(trx?.source?.docid) === String(line.invoiceid);
      if (!isAuto) continue; // a manual collection — never claim it
      stamped++;
      autoIds.push(pay._id);
      if (APPLY) {
        await Payment.updateOne(
          { _id: pay._id },
          { $set: { autosource: { docmodel: spec.docmodel, docid: line.invoiceid } } }
        );
      }
    }
    console.log(`  autosource: ${stamped} auto-created receipt(s) stamped`);

    // ---- Job A2: an auto receipt belongs on its bill's date ----
    // `paymentdate` was never set when these were written, so each one fell back
    // to the schema's Date.now and carried the day it was SAVED. The Transaction
    // beside it always got the bill's date, which is why only the Payments list
    // looked wrong. Re-running this is safe: it only moves rows already off.
    const already: any[] = await Payment.find({ "autosource.docmodel": spec.docmodel })
      .select("_id paymentdate autosource")
      .lean();
    const pending: any[] = autoIds.length
      ? await Payment.find({ _id: { $in: autoIds } }).select("_id paymentdate invoices").lean()
      : [];

    const day = (d: any) => {
      const x = new Date(d);
      return isNaN(x.getTime()) ? null : x.toISOString().slice(0, 10);
    };

    let redated = 0;
    const seenPay = new Set<string>();
    for (const pay of [...already, ...pending]) {
      if (seenPay.has(String(pay._id))) continue;
      seenPay.add(String(pay._id));

      const invId =
        pay?.autosource?.docid ||
        (pay.invoices || []).find((l: any) => l?.invoicemodel === spec.docmodel)?.invoiceid;
      if (!invId) continue;

      const inv: any = await spec.Model.findById(invId).select("billdate").lean();
      const want = inv?.billdate ? day(inv.billdate) : null;
      if (!want || day(pay.paymentdate) === want) continue;

      redated++;
      if (APPLY) {
        await Payment.updateOne({ _id: pay._id }, { $set: { paymentdate: new Date(inv.billdate) } });
      }
    }
    console.log(`  paymentdate: ${redated} receipt(s) sitting on the wrong date`);

    // ---- Job B: backfill, NET of whatever is already allocated ----
    const invoices: any[] = await spec.Model.find({})
      .select("_id billnumber billdate paymenttype totalamount partyacc adminid branchid createdby_id createdby_name createdby_type")
      .lean();

    // One pass over every allocation line, rather than a query per invoice.
    const allocated: Record<string, number> = {};
    const ownReceipt = new Set<string>();
    const allPays: any[] = await Payment.find({ status: true, "invoices.invoicemodel": spec.docmodel })
      .select("invoices autosource")
      .lean();
    allPays.forEach((pay: any) => {
      (pay.invoices || []).forEach((l: any) => {
        if (l?.invoicemodel !== spec.docmodel || !l?.invoiceid) return;
        const k = String(l.invoiceid);
        allocated[k] = (allocated[k] || 0) + (Number(l.settledamount) || 0);
        if (pay?.autosource?.docid && String(pay.autosource.docid) === k) ownReceipt.add(k);
      });
    });

    let zeroed = 0;
    let carried = 0;
    const needReceipt: Array<{ inv: any; amount: number }> = [];

    for (const inv of invoices) {
      const k = String(inv._id);
      // Already owned by the new model — its figure is the user's, not ours.
      if (ownReceipt.has(k)) continue;

      const isCredit = String(inv.paymenttype || "").toLowerCase() === "credit";
      const total = parseFloat((Number(inv.totalamount) || 0).toFixed(2));
      const already = parseFloat((allocated[k] || 0).toFixed(2));
      const value = isCredit ? 0 : Math.max(0, parseFloat((total - already).toFixed(2)));

      value > 0 ? carried++ : zeroed++;
      if (value > 0) needReceipt.push({ inv, amount: value });
      if (APPLY) await spec.Model.updateOne({ _id: inv._id }, { $set: { [spec.field]: value } });
    }
    console.log(
      `  ${spec.field}: ${zeroed} set to 0 (credit, or already covered by an existing payment), ` +
        `${carried} carry an unrecorded collection`
    );

    // ---- Job C: write the receipts those figures imply ----
    if (needReceipt.length) {
      console.log(`  receipts: ${needReceipt.length} to create${POST_RECEIPTS ? "" : "  (pass --post-receipts to write them)"}`);
      needReceipt.slice(0, 10).forEach(({ inv, amount }) =>
        console.log(`    - #${inv.billnumber || inv._id}  ${money(amount)}`)
      );
      if (needReceipt.length > 10) console.log(`    ... and ${needReceipt.length - 10} more`);
    }

    if (needReceipt.length && APPLY && POST_RECEIPTS) {
      const ledgerCache = new Map<string, any>();
      async function cashBankLedger(adminid: any, branchid: any, mode: string) {
        const name = LEDGER_BY_MODE[String(mode || "").toLowerCase()] || "Cash";
        const key = `${adminid}::${name}`;
        if (!ledgerCache.has(key)) {
          let led: any = await AccountLedger.findOne({ ledgername: name, admin: adminid }).select("_id").lean();
          ledgerCache.set(key, led?._id || null);
        }
        return { id: ledgerCache.get(key), name };
      }

      let ok = 0;
      const skipped: string[] = [];
      for (const { inv, amount } of needReceipt) {
        try {
          const party: any = await Account.findById(inv.partyacc).select("ledgerid").lean();
          if (!party?.ledgerid) { skipped.push(`#${inv.billnumber}: party ledger missing`); continue; }
          const { id: cashId, name } = await cashBankLedger(inv.adminid, inv.branchid, inv.paymenttype);
          if (!cashId) { skipped.push(`#${inv.billnumber}: "${name}" ledger not found — create it first`); continue; }

          const inward = spec.docmodel === "SalesInvoice";
          const entries = inward
            ? [
                { ledgerid: cashId, debit: amount, credit: 0, remarks: `Payment received (Invoice ${inv.billnumber})` },
                { ledgerid: party.ledgerid, debit: 0, credit: amount, remarks: `Customer payment (Invoice ${inv.billnumber})` },
              ]
            : [
                { ledgerid: party.ledgerid, debit: amount, credit: 0, remarks: `Payment made (Invoice ${inv.billnumber})` },
                { ledgerid: cashId, debit: 0, credit: amount, remarks: `Vendor payment (Invoice ${inv.billnumber})` },
              ];

          const trx: any = await Transaction.create({
            adminid: inv.adminid,
            branchid: inv.branchid,
            entrytype: "auto",
            source: { docmodel: "Payment", docid: inv._id },
            transactiondate: inv.billdate,
            narration: `${inward ? "Receipt" : "Payment"} for ${spec.label} #${inv.billnumber} (backfilled)`,
            entries,
            totaldebit: amount,
            totalcredit: amount,
            createdby_id: inv.createdby_id,
            createdby_name: inv.createdby_name,
            createdby_type: inv.createdby_type,
          });

          await Payment.create({
            adminid: inv.adminid,
            branchid: inv.branchid,
            type: inward ? "receipt" : "payment",
            mode: inv.paymenttype,
            paymentdate: inv.billdate,
            partyid: inv.partyacc,
            ledgerid: cashId,
            invoices: [{ invoiceid: inv._id, invoicemodel: spec.docmodel, settledamount: amount }],
            amount,
            remarks: `${inward ? "Receipt" : "Payment"} for ${spec.label} #${inv.billnumber} (backfilled)`,
            transactionid: trx._id,
            autosource: { docmodel: spec.docmodel, docid: inv._id },
            createdby_id: inv.createdby_id,
            createdby_name: inv.createdby_name,
            createdby_type: inv.createdby_type,
          });
          ok++;
        } catch (e: any) {
          skipped.push(`#${inv.billnumber}: ${e?.message || e}`);
        }
      }
      console.log(`  receipts written: ${ok}, skipped: ${skipped.length}`);
      skipped.slice(0, 20).forEach((x) => console.log(`    ! ${x}`));
      if (skipped.length > 20) console.log(`    ... and ${skipped.length - 20} more`);
    }

    // ---- Job D: invoices with no journal ----
    const all: any[] = await spec.Model.find({})
      .select("_id billnumber billdate totalamount adminid branchid")
      .lean();
    const posted = new Set(
      (
        await Transaction.find({ "source.docmodel": spec.docmodel })
          .select("source.docid")
          .lean()
      ).map((t: any) => String(t?.source?.docid))
    );
    const missing = all.filter((inv) => !posted.has(String(inv._id)));

    console.log(`  journals: ${missing.length} invoice(s) have none`);
    missing.slice(0, 20).forEach((inv) =>
      console.log(
        `    - #${inv.billnumber || inv._id}  ${String(inv.billdate).slice(0, 10)}  ${money(inv.totalamount)}`
      )
    );
    if (missing.length > 20) console.log(`    ... and ${missing.length - 20} more`);

    if (missing.length && APPLY && POST_JOURNALS) {
      let ok = 0;
      const failed: string[] = [];
      for (const stub of missing) {
        try {
          // Build from the FULL document — the journal needs every line, and the
          // list above was fetched lean with only a few fields selected.
          const inv: any = await spec.Model.findById(stub._id).lean();
          const built = await spec.build(inv);
          if (!built?.entries?.length) {
            failed.push(`#${stub.billnumber || stub._id}: builder returned no entries`);
            continue;
          }
          const dr = parseFloat(
            built.entries.reduce((t: number, e: any) => t + (e.debit || 0), 0).toFixed(2)
          );
          const cr = parseFloat(
            built.entries.reduce((t: number, e: any) => t + (e.credit || 0), 0).toFixed(2)
          );
          if (Math.abs(dr - cr) > 0.01) {
            failed.push(`#${stub.billnumber || stub._id}: unbalanced ${money(dr)} vs ${money(cr)}`);
            continue;
          }
          await Transaction.create({
            adminid: inv.adminid,
            branchid: inv.branchid,
            entrytype: "auto",
            source: { docmodel: spec.docmodel, docid: inv._id },
            transactiondate: inv.billdate,
            narration: `${spec.label} #${inv.billnumber} (backfilled)`,
            entries: built.entries,
            totaldebit: dr,
            totalcredit: cr,
            createdby_id: inv.createdby_id,
            createdby_name: inv.createdby_name,
            createdby_type: inv.createdby_type,
          });
          ok++;
        } catch (e: any) {
          failed.push(`#${stub.billnumber || stub._id}: ${e?.message || e}`);
        }
      }
      console.log(`  journals posted: ${ok}, skipped: ${failed.length}`);
      // Never swallow these: a skipped invoice stays missing from the books, and
      // the only way anyone finds out is if it is printed here.
      failed.slice(0, 30).forEach((f) => console.log(`    ! ${f}`));
      if (failed.length > 30) console.log(`    ... and ${failed.length - 30} more`);
    }

    console.log("");
  }

  if (!APPLY) console.log("Dry run — nothing was written. Re-run with --apply.");
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
