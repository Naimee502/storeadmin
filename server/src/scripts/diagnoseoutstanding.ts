// ---------------------------------------------------------------------------
// Why is / isn't a bill showing as outstanding?
//
// Prints, straight from the database, every number that goes into a party's
// outstanding calculation — invoices, payment allocations, returns, and whether
// each return was refunded in cash. Read-only; writes nothing.
//
// Run:
//     cd server
//     npx ts-node src/scripts/diagnoseoutstanding.ts              # all parties that have invoices
//     npx ts-node src/scripts/diagnoseoutstanding.ts "s"          # by party name
//     npx ts-node src/scripts/diagnoseoutstanding.ts 6a80...af7   # by party id
// ---------------------------------------------------------------------------

import mongoose from "mongoose";
import dotenv from "dotenv";
import { Account } from "../models/accounts";
import { SalesInvoice } from "../models/salesinvoice";
import { SalesReturn } from "../models/salesreturn";
import { Payment } from "../models/payments";
import { Transaction } from "../models/transactions";

dotenv.config();

const arg = process.argv[2];
const money = (n: any) => `₹${(Number(n) || 0).toFixed(2)}`;

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DB_URI;
  if (!uri) throw new Error("Set MONGO_URI in server/.env first.");
  await mongoose.connect(uri);

  // ── Which party? ────────────────────────────────────────────────────────
  let parties: any[] = [];
  if (arg && mongoose.Types.ObjectId.isValid(arg)) {
    parties = await Account.find({ _id: arg }).lean();
  } else if (arg) {
    parties = await Account.find({ name: { $regex: arg, $options: "i" } }).lean();
  } else {
    const ids = await SalesInvoice.distinct("partyacc", { status: true });
    parties = await Account.find({ _id: { $in: ids } }).lean();
  }

  if (!parties.length) {
    console.log("No matching party found.");
    await mongoose.disconnect();
    return;
  }

  for (const party of parties) {
    console.log("\n" + "=".repeat(78));
    console.log(`PARTY: ${party.name}   id=${party._id}   ledger=${party.ledgerid}`);
    console.log("=".repeat(78));

    const invoices: any[] = await SalesInvoice.find({ partyacc: party._id })
      .select("_id billnumber billdate totalamount status branchid paymenttype")
      .sort({ billdate: 1 })
      .lean();

    if (!invoices.length) {
      console.log("  (no sales invoices)");
      continue;
    }

    for (const inv of invoices) {
      const id = String(inv._id);

      // Payment allocations pointing at this invoice
      const pays: any[] = await Payment.find({ "invoices.invoiceid": inv._id })
        .select("paymentcode amount status type invoices unallocatedamount allocationmode")
        .lean();
      let paid = 0;
      const payLines: string[] = [];
      pays.forEach((p) =>
        (p.invoices || []).forEach((l: any) => {
          if (String(l.invoiceid) !== id) return;
          const counted = p.status !== false;
          if (counted) paid += Number(l.settledamount) || 0;
          payLines.push(
            `      ${p.paymentcode || p._id}  ${money(l.settledamount)}  type=${p.type}  status=${p.status}` +
              (counted ? "" : "   <-- DELETED, not counted")
          );
        })
      );

      // Journal ("Agst Ref") settlements
      const txns: any[] = await Transaction.find({ "invoices.invoiceid": inv._id })
        .select("_id narration status invoices")
        .lean();
      let jrnl = 0;
      const txnLines: string[] = [];
      txns.forEach((t) =>
        (t.invoices || []).forEach((l: any) => {
          if (String(l.invoiceid) !== id) return;
          const counted = t.status !== false;
          if (counted) jrnl += Number(l.settledamount) || 0;
          txnLines.push(
            `      ${t._id}  ${money(l.settledamount)}  ${t.narration || ""}` +
              (counted ? "" : "   <-- inactive, not counted")
          );
        })
      );

      // Returns against this invoice, and whether each was refunded in cash
      const rets: any[] = await SalesReturn.find({ sourceInvoiceId: inv._id })
        .select("_id billnumber totalamount refundMode status returndate")
        .lean();
      let netted = 0;
      const retLines: string[] = [];
      for (const r of rets) {
        const refund = await Payment.findOne({
          "invoices.invoiceid": r._id,
          "invoices.invoicemodel": "SalesReturn",
          status: true,
        })
          .select("paymentcode amount")
          .lean();
        const active = r.status !== false;
        const counts = active && !refund;
        if (counts) netted += Number(r.totalamount) || 0;
        retLines.push(
          `      ${r.billnumber || r._id}  ${money(r.totalamount)}  refundMode=${r.refundMode}  status=${r.status}` +
            (refund
              ? `   <-- REFUNDED by ${(refund as any).paymentcode}, so NOT netted`
              : active
              ? "   <-- netted off the invoice"
              : "   <-- deleted, not netted")
        );
      }

      const outstanding = Math.max(
        0,
        Number(((Number(inv.totalamount) || 0) - paid - jrnl - netted).toFixed(2))
      );

      console.log(`\n  INV-${inv.billnumber}   ${inv.billdate}   ${money(inv.totalamount)}   paymenttype=${inv.paymenttype}   status=${inv.status}`);
      console.log(`    branch = ${inv.branchid}`);
      console.log(`    payments   (-${money(paid)})${payLines.length ? "" : "   none"}`);
      payLines.forEach((l) => console.log(l));
      console.log(`    journals   (-${money(jrnl)})${txnLines.length ? "" : "   none"}`);
      txnLines.forEach((l) => console.log(l));
      console.log(`    returns    (-${money(netted)})${retLines.length ? "" : "   none"}`);
      retLines.forEach((l) => console.log(l));
      console.log(
        `    => OUTSTANDING = ${money(inv.totalamount)} - ${money(paid)} - ${money(jrnl)} - ${money(netted)} = ${money(outstanding)}` +
          (outstanding > 0 ? "   [SHOWN in payment screen]" : "   [HIDDEN]")
      );
    }
  }

  console.log("\n");
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
