// ---------------------------------------------------------------------------
// One-time repair: a "Purchase" ledger filed under the wrong group.
//
// The received/paid migration needed a default cost ledger for purchase lines
// saved without an account of their own. It reached for getOrCreateAccount(),
// whose group defaults to "GST Account" with category "liabilities" — so a cost
// head ended up on the Balance Sheet as a liability instead of in the P&L, and
// the GST reports gained a member that has nothing to do with tax.
//
// The model no longer does this (it prefers the seeded "Purchase Account"
// ledger, and creates under "Purchase Account"/expenses only as a last resort).
// This script cleans up what the earlier run already wrote.
//
// Two outcomes per stray ledger, whichever fits:
//
//   a) A proper "Purchase Account" ledger already exists for that admin.
//      Every journal leg pointing at the stray is repointed to it and the stray
//      is retired, so the P&L carries ONE purchase head rather than two.
//
//   b) There is no proper ledger to move to. The stray is kept but refiled
//      under a "Purchase Account" group with category "expenses", which is
//      enough to put it back in the P&L.
//
// Journal amounts are never touched — only which ledger a leg points at — so
// every transaction stays balanced by construction.
//
// Run:
//     cd server
//     npx ts-node src/scripts/fixpurchaseledgergroup.ts            # dry run
//     npx ts-node src/scripts/fixpurchaseledgergroup.ts --apply
// ---------------------------------------------------------------------------

import mongoose from "mongoose";
import dotenv from "dotenv";
import { AccountLedger } from "../models/accountledgers";
import { AccountGroup } from "../models/accountgroups";
import { Account } from "../models/accounts";
import { Transaction } from "../models/transactions";

dotenv.config();

const APPLY = process.argv.includes("--apply");

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

  // Two shapes to catch, because the ledger's NAME depends on how it was made:
  //
  //   - getOrCreateAccount() made an Account called "Purchase", and the Account
  //     pre-save hook named its ledger "Purchase - #ACC0016". Searching ledgers
  //     for "Purchase" finds nothing, which is why the first run of this script
  //     reported all clear while the stray was sitting right there.
  //   - the model now creates a ledger called plainly "Purchase".
  //
  // So: collect ledgers whose name is "Purchase" or "Purchase - #ACC…", plus any
  // ledger belonging to an Account named "Purchase".
  const byName: any[] = await AccountLedger.find({
    ledgername: { $regex: /^Purchase( - #ACC\d+)?$/i },
  })
    .populate("accountgroupid")
    .lean();

  const purchaseAccounts: any[] = await Account.find({ name: /^Purchase$/i })
    .select("_id name accountcode ledgerid admin")
    .lean();
  const viaAccount: any[] = [];
  for (const acc of purchaseAccounts) {
    if (!acc.ledgerid) continue;
    const led: any = await AccountLedger.findById(acc.ledgerid).populate("accountgroupid").lean();
    if (led) viaAccount.push(led);
  }

  const seen = new Set<string>();
  const candidates = [...byName, ...viaAccount].filter((l: any) => {
    const k = String(l._id);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Only the misfiled ones need touching: a cost head belongs in an expense group.
  const strays = candidates.filter((l: any) => {
    const cat = String(l?.accountgroupid?.category || "").toLowerCase();
    return cat !== "expenses";
  });

  if (!strays.length) {
    console.log("Nothing to repair — every 'Purchase' ledger already sits in an expense group.\n");
    // Print what WAS found, so a second empty result is informative rather than
    // just reassuring.
    if (candidates.length) {
      console.log("Purchase ledgers seen:");
      candidates.forEach((l: any) =>
        console.log(`  - "${l.ledgername}"  group "${l?.accountgroupid?.accountgroupname || "(none)"}" (${l?.accountgroupid?.category || "?"})`)
      );
    } else {
      console.log("No ledger named 'Purchase' or 'Purchase - #ACC…' exists at all.");
      const anyPurchase: any[] = await AccountLedger.find({ ledgername: /purchase/i })
        .populate("accountgroupid")
        .lean();
      if (anyPurchase.length) {
        console.log("\nLedgers with 'purchase' in the name:");
        anyPurchase.forEach((l: any) =>
          console.log(`  - "${l.ledgername}"  group "${l?.accountgroupid?.accountgroupname || "(none)"}" (${l?.accountgroupid?.category || "?"})`)
        );
      }
    }
    await mongoose.disconnect();
    return;
  }

  console.log(`${strays.length} misfiled 'Purchase' ledger(s):\n`);

  for (const stray of strays) {
    const groupName = stray?.accountgroupid?.accountgroupname || "(no group)";
    const groupCat = stray?.accountgroupid?.category || "(none)";
    console.log(`- "${stray.ledgername}"  ${stray._id}  admin ${stray.admin}`);
    console.log(`    currently in "${groupName}" (category: ${groupCat})`);

    const legs = await Transaction.countDocuments({ "entries.ledgerid": stray._id });
    console.log(`    journal legs pointing at it: ${legs}`);

    // (a) Prefer the seeded ledger every other purchase already posts to.
    // The seeded chart of accounts creates this one directly as a ledger, so
    // its name has no "- #ACC…" suffix.
    const proper: any = await AccountLedger.findOne({
      ledgername: "Purchase Account",
      admin: stray.admin,
      status: { $ne: false },
      _id: { $ne: stray._id },
    })
      .select("_id ledgername")
      .lean();

    if (proper?._id) {
      console.log(`    → repoint those legs to "${proper.ledgername}" (${proper._id}) and retire this one`);
      if (APPLY) {
        // Positional $set on the matched array element, looped until no leg is
        // left — a single update only rewrites the FIRST match per document.
        let moved = 0;
        for (;;) {
          const res: any = await Transaction.updateMany(
            { "entries.ledgerid": stray._id },
            { $set: { "entries.$[leg].ledgerid": proper._id } },
            { arrayFilters: [{ "leg.ledgerid": stray._id }] }
          );
          const n = res?.modifiedCount ?? 0;
          moved += n;
          if (!n) break;
        }
        await AccountLedger.updateOne({ _id: stray._id }, { $set: { status: false } });
        await Account.updateMany({ ledgerid: stray._id }, { $set: { status: false } });
        console.log(`    ✔ repointed ${moved} transaction(s), stray retired`);
      }
      continue;
    }

    // (b) Nothing to merge into — refile it where a cost head belongs.
    console.log(`    → no "Purchase Account" ledger for this admin; refile under "Purchase Account" (expenses)`);
    if (APPLY) {
      let group: any = await AccountGroup.findOne({
        accountgroupname: "Purchase Account",
        admin: stray.admin,
      });
      if (!group) {
        group = await AccountGroup.create({
          admin: stray.admin,
          accountgroupname: "Purchase Account",
          category: "expenses",
          status: true,
        });
        console.log(`    created group "Purchase Account" (${group._id})`);
      }
      await AccountLedger.updateOne(
        { _id: stray._id },
        { $set: { accountgroupid: group._id, openingbalancetype: "debit" } }
      );
      await Account.updateMany({ ledgerid: stray._id }, { $set: { accountgroupid: group._id } });
      console.log(`    ✔ refiled`);
    }
  }

  console.log("");
  if (!APPLY) console.log("Dry run — nothing was written. Re-run with --apply.");
  else console.log("Done. Check Balance Sheet and Profit & Loss — the purchase cost should now sit in the P&L.");

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
