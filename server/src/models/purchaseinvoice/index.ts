// models/purchaseinvoice.ts
import mongoose from "mongoose";
import { ProductBranchStock } from "../productbranchstock";
import { ProductService } from "../products";
import { convertToBaseUnit } from "../../utils/unitconversation";
import { Transaction } from "../transactions";
import { Payment } from "../payments";
import { getOrCreateAccount } from "../../utils/helper";
import { AccountLedger } from "../accountledgers";
import { AccountGroup } from "../accountgroups";
import { Account } from "../accounts";
import { AdminSettings } from "../adminsettings";

// Default "Purchase" cost ledger. Needed in two places a line-level account
// cannot cover: a product line saved without a purchase account (whose cost used
// to be dropped from the journal entirely), and an "other charge" folded into
// cost rather than posted to its own ledger.
async function getDefaultPurchaseLedgerId(adminid: any, _branchid: any): Promise<any> {
  // The seeded chart of accounts already carries a "Purchase Account" ledger.
  // Prefer it — minting our own would put a second cost head in the P&L beside
  // the one every other purchase already posts to.
  for (const name of ["Purchase Account", "Purchase"]) {
    const led: any = await AccountLedger.findOne({ ledgername: name, admin: adminid }).select("_id").lean();
    if (led?._id) return led._id;
  }

  // Nothing seeded, so make one — but under the right group, and directly as a
  // ledger. getOrCreateAccount() defaults to the "GST Account" group with
  // category "liabilities", which files a cost head on the balance sheet as a
  // liability instead of in the P&L.
  let group: any = await AccountGroup.findOne({ accountgroupname: "Purchase Account", admin: adminid });
  if (!group) {
    group = await AccountGroup.create({
      admin: adminid,
      accountgroupname: "Purchase Account",
      category: "expenses",
      status: true,
    });
  }
  const created: any = await AccountLedger.create({
    admin: adminid,
    accountgroupid: group._id,
    ledgername: "Purchase",
    openingbalance: 0,
    openingbalancetype: "debit",
    status: true,
  });
  return created._id;
}


const purchaseInvoiceSchema = new mongoose.Schema(
  {
    createdby_id: { type: mongoose.Schema.Types.ObjectId },
    createdby_name: { type: String },
    createdby_type: { type: String },

    paymenttype: { type: String, required: true },
    partyacc: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    taxorsupplytype: { type: String, required: true },
    billdate: { type: String, required: true },
    billtype: { type: String, required: true },
    billnumber: { type: String },
    notes: { type: String },

    invoicetype: { type: String, required: true },
    subtotal: { type: Number, required: true },
    totaldiscount: { type: Number, required: true },
    totalgst: { type: Number, required: true },
    totalamount: { type: Number, required: true },

    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    branchid: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },

    productservice: [
      {
        productserviceid: { type: mongoose.Schema.Types.ObjectId, ref: "ProductService", required: true },
        variantid: { type: mongoose.Schema.Types.ObjectId },
        purchaseunitid: { type: mongoose.Schema.Types.ObjectId, ref: "Unit" },
        unitqty: { type: Number, default: 1 },
        gst: { type: Number, required: true },
        qty: { type: Number, required: true },
        rate: { type: Number, required: true },
        amount: { type: Number, required: true },
        discount: { type: Number, default: 0 },
        salesaccountid: { type: mongoose.Schema.Types.ObjectId, ref: "AccountLedger" },
        purchaseaccountid: { type: mongoose.Schema.Types.ObjectId, ref: "AccountLedger" },
        serviceaccountid: { type: mongoose.Schema.Types.ObjectId, ref: "AccountLedger" },
      }
    ],

    othercharges: [
      {
        ledgerid: { type: mongoose.Schema.Types.ObjectId, ref: "AccountLedger", required: true },
        ledgername: { type: String },
        amount: { type: Number, required: true },
        gstpercent: { type: Number, default: 0 },
        gstamount: { type: Number, default: 0 },
        totalamount: { type: Number, required: true },
        remarks: { type: String },
      }
    ],

    deliverydate: { type: String },
    duedate: { type: String },
    transportname: { type: String },
    vehiclenumber: { type: String },
    ewaybillno: { type: String },
    distance: { type: Number },
    roundoff: { type: Number, default: 0 },
    invoicediscount: { type: Number, default: 0 },
    invoicediscounttype: { type: String, default: "amount" },

    // Money handed over when the bill was entered. Mirror of SalesInvoice.received:
    // 0 = pure credit, totalamount = fully paid, anything between = part paid and
    // the rest stays outstanding for a later Payment-Out.
    paid: { type: Number, default: 0 },

    isservice: { type: Boolean, default: false },

    // The Purchase Order this bill was raised from, when it came from one.
    // Mirrors SalesInvoice.sourceorderid — it is what lets a purchase-order-only
    // business label the bill with the PO number its user actually knows.
    sourceorderid: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder" },
    autocreate: {
      // Stock is the only thing still worth a switch: a service line moves none,
      // and some businesses bill first and enter their purchases later. Journals
      // are not optional -- a document IS an accounting event.
      stock: { type: Boolean, default: true }
    },
    status: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// 🔢 Auto-generate bill number when blank
purchaseInvoiceSchema.pre("save", async function (next) {
  if (!this.billnumber) {
    // Highest existing billnumber, not the latest createdAt — the createdAt
    // sort hands two invoices the same number when docs land out of order.
    // Zero-padded strings sort correctly as strings.
    const lastInvoice: any = await mongoose
      .model("PurchaseInvoice")
      .findOne({ adminid: this.adminid, billnumber: { $ne: null } })
      .sort({ billnumber: -1 })
      .select("billnumber")
      .lean();
    let nextNum = 1;
    if (lastInvoice && lastInvoice.billnumber) {
      const lastNum = parseInt(lastInvoice.billnumber, 10);
      if (!isNaN(lastNum)) nextNum = lastNum + 1;
    }
    this.billnumber = nextNum.toString().padStart(6, "0");
  }
  next();
});

// ✅ Convert ledger ref
function ledgerId(x: any) {
  if (!x) return null;
  if (typeof x === "string") return x;
  return x._id || x.id || null;
}

/**
 * Build the Purchase Invoice accounting journal — Dr Purchase / Dr Input GST
 * (CGST+SGST) / Cr Vendor — and balance it, WITHOUT saving anything.
 * Mirrors adjustStockAndTransactions; used by the manual "Full Journal" preview
 * so a manual journal matches what auto-posting would create.
 */
export async function buildPurchaseInvoiceJournal(newInv: any) {
  const entries: any[] = [];
  let totalDebit = 0;

  // Other charges, the invoice discount and the round-off are all inside
  // `totalamount`, but none of them had a leg. The vendor was credited only
  // products + GST and the balance adjustment below quietly absorbed the rest
  // into that same leg -- so any bill carrying a freight line left the vendor
  // short by exactly that freight.
  //
  // With the concession feature on for this admin they fold into Purchase, so
  // they land on the vendor's balance instead of standing as their own lines;
  // off, each keeps its own ledger. GST never folds -- it is claimable input
  // tax, not a cost.
  const foldSettings: any = await AdminSettings.getOrCreateForAdmin(newInv.adminid);
  const foldIntoPurchase = !!foldSettings?.enablePaymentDiscountCommission;
  // Resolved lazily and remembered: most bills have a purchase account on every
  // line and no charge to fold, so they never need this at all. Calling it
  // eagerly minted a ledger nobody used on the first save for an admin.
  let _defaultCostLedger: any;
  const defaultCostLedgerId = async () => {
    if (_defaultCostLedger === undefined) {
      _defaultCostLedger = await getDefaultPurchaseLedgerId(newInv.adminid, newInv.branchid);
    }
    return _defaultCostLedger;
  };

  for (const item of newInv.productservice) {
    const qty = Number(item.qty);
    const rate = Number(item.rate);
    const discount = Number(item.discount);
    const taxable = parseFloat(((rate - discount) * qty).toFixed(2));
    const gstRate = Number(item.gst);
    const gstAmt = parseFloat(((taxable * gstRate) / 100).toFixed(2));

    const product = await ProductService.findById(item.productserviceid);
    const productName = product?.name || "Unknown Product";
    let variantName = null;
    if (item.variantid && product?.productvariants?.length) {
      const variant = product.productvariants.find(
        (v: any) => v._id.toString() === item.variantid.toString()
      );
      variantName = variant?.name || null;
    }
    const purchaseRemark = variantName
      ? `Purchase of ${productName} (${variantName})`
      : `Purchase of ${productName}`;

    // Falling back to the default Purchase ledger: a line saved without an
    // account used to be skipped, leaving its cost out of the journal entirely.
    const purchaseLedgerId = ledgerId(item.purchaseaccountid) || (await defaultCostLedgerId());
    if (purchaseLedgerId && taxable > 0) {
      entries.push({ ledgerid: purchaseLedgerId, debit: taxable, credit: 0, remarks: purchaseRemark });
      totalDebit += taxable;
    }

    if (gstAmt > 0) {
      const cgst = await AccountLedger.findOne({ ledgername: "Input CGST", admin: newInv.adminid });
      const sgst = await AccountLedger.findOne({ ledgername: "Input SGST", admin: newInv.adminid });
      if (cgst && sgst) {
        const cgstAmt = parseFloat((gstAmt / 2).toFixed(2));
        const sgstAmt = parseFloat((gstAmt - cgstAmt).toFixed(2));
        entries.push({ ledgerid: cgst._id, debit: cgstAmt, credit: 0, remarks: `CGST on ${productName}` });
        entries.push({ ledgerid: sgst._id, debit: sgstAmt, credit: 0, remarks: `SGST on ${productName}` });
        totalDebit += gstAmt;
      } else {
        const gstAcc = await getOrCreateAccount("Input GST", "other", newInv.adminid, newInv.branchid);
        entries.push({ ledgerid: gstAcc.ledgerid || gstAcc._id, debit: gstAmt, credit: 0, remarks: `GST on ${productName}` });
        totalDebit += gstAmt;
      }
    }
  }


  if (newInv.othercharges && newInv.othercharges.length > 0) {
    for (const charge of newInv.othercharges) {
      const amt = parseFloat((Number(charge.amount) || 0).toFixed(2));
      const chargeName = charge.ledgername || "Other Charge";
      if (amt > 0) {
        entries.push({
          ledgerid: foldIntoPurchase
            ? await defaultCostLedgerId()
            : charge.ledgerid || (await defaultCostLedgerId()),
          debit: amt,
          credit: 0,
          remarks: charge.remarks || chargeName,
        });
      }
      const gst = parseFloat((Number(charge.gstamount) || 0).toFixed(2));
      if (gst > 0) {
        const cgst = await AccountLedger.findOne({ ledgername: "Input CGST", admin: newInv.adminid });
        const sgst = await AccountLedger.findOne({ ledgername: "Input SGST", admin: newInv.adminid });
        if (cgst && sgst) {
          const c = parseFloat((gst / 2).toFixed(2));
          entries.push({ ledgerid: cgst._id, debit: c, credit: 0, remarks: `CGST on ${chargeName}` });
          entries.push({ ledgerid: sgst._id, debit: parseFloat((gst - c).toFixed(2)), credit: 0, remarks: `SGST on ${chargeName}` });
        } else {
          const acc: any = await getOrCreateAccount("Input GST", "other", newInv.adminid, newInv.branchid);
          entries.push({ ledgerid: acc.ledgerid || acc._id, debit: gst, credit: 0, remarks: `GST on ${chargeName}` });
        }
      }
    }
  }

  if (newInv.invoicediscount && Number(newInv.invoicediscount) !== 0) {
    let discountAmount = Number(newInv.invoicediscount) || 0;
    if (newInv.invoicediscounttype === "percent") {
      const taxableSubtotal = (newInv.productservice || []).reduce(
        (sum: number, item: any) => sum + (Number(item.rate) - Number(item.discount)) * Number(item.qty),
        0
      );
      discountAmount = (taxableSubtotal * Number(newInv.invoicediscount)) / 100;
    }
    discountAmount = parseFloat(discountAmount.toFixed(2));
    if (discountAmount > 0) {
      // A discount the vendor allowed lowers our cost, so it credits.
      let discLedgerId: any = foldIntoPurchase ? await defaultCostLedgerId() : null;
      if (!foldIntoPurchase) {
        let disc: any = await AccountLedger.findOne({ ledgername: "Discount Received", admin: newInv.adminid }).select("_id").lean();
        if (!disc?._id) {
          const created: any = await getOrCreateAccount("Discount Received", "other", newInv.adminid, newInv.branchid);
          disc = { _id: created?.ledgerid || created?._id };
        }
        discLedgerId = disc?._id;
      }
      if (discLedgerId) {
        entries.push({
          ledgerid: discLedgerId,
          debit: 0,
          credit: discountAmount,
          remarks: foldIntoPurchase ? "Invoice Discount (netted into Purchase)" : "Invoice Discount",
        });
      }
    }
  }

  if (newInv.roundoff && Number(newInv.roundoff) !== 0) {
    let round: any = await AccountLedger.findOne({ ledgername: "Round Off", admin: newInv.adminid }).select("_id").lean();
    if (!round?._id) {
      const created: any = await getOrCreateAccount("Round Off", "other", newInv.adminid, newInv.branchid);
      round = { _id: created?.ledgerid || created?._id };
    }
    const ro = parseFloat(Number(newInv.roundoff).toFixed(2));
    if (round?._id) {
      entries.push(
        ro > 0
          ? { ledgerid: round._id, debit: ro, credit: 0, remarks: "Round Off" }
          : { ledgerid: round._id, debit: 0, credit: Math.abs(ro), remarks: "Round Off" }
      );
    }
  }

  const vendor = await Account.findById(newInv.partyacc).select("ledgerid");
  if (!vendor?.ledgerid) throw new Error("Vendor ledger missing");

  // Credited the bill total outright. It used to be left at 0 for the balance
  // adjustment to fill in, which meant the vendor got whatever made the journal
  // balance rather than what the bill actually said. The adjustment below is now
  // only a paisa-level rounding net.
  entries.push({
    ledgerid: vendor.ledgerid,
    debit: 0,
    credit: parseFloat((Number(newInv.totalamount) || 0).toFixed(2)),
    remarks: `Purchase Invoice #${newInv.billnumber}`,
  });

  const tempDebit = parseFloat(entries.reduce((t, e) => t + (e.debit || 0), 0).toFixed(2));
  const tempCredit = parseFloat(entries.reduce((t, e) => t + (e.credit || 0), 0).toFixed(2));
  if (tempDebit !== tempCredit) {
    const diff = parseFloat((tempDebit - tempCredit).toFixed(2));
    const lastEntry = entries[entries.length - 1];
    if (lastEntry.credit !== undefined) {
      lastEntry.credit = parseFloat((lastEntry.credit + diff).toFixed(2));
    } else if (lastEntry.debit !== undefined) {
      lastEntry.debit = parseFloat((lastEntry.debit - diff).toFixed(2));
    }
  }

  const totalDebitSum = parseFloat(entries.reduce((t, e) => t + (e.debit || 0), 0).toFixed(2));
  const totalCreditSum = parseFloat(entries.reduce((t, e) => t + (e.credit || 0), 0).toFixed(2));

  return { entries, totalDebitSum, totalCreditSum, vendorLedgerId: vendor.ledgerid };
}

purchaseInvoiceSchema.statics.adjustStockAndTransactions = async function (oldInv: any, newInv: any, userContext?: any) {
  console.log("🔵 adjustStockAndTransactions called for invoice:", newInv.billnumber);
  console.log("   userContext:", userContext);
  console.log("   newInv.createdby_id:", newInv.createdby_id);
  console.log("   newInv.createdby_name:", newInv.createdby_name);
  console.log("   newInv.createdby_type:", newInv.createdby_type);
  console.log("   ⚠️  POST SAVE HOOK SHOULD BE DISABLED - if you see duplicate 'adjustStockAndTransactions' calls, the server needs restart!");

  const branchid =
    typeof newInv.branchid === "string"
      ? new mongoose.Types.ObjectId(newInv.branchid)
      : newInv.branchid;
    if (!branchid) return;
    
  // A bill IS an accounting event, so its journal always posts. What was handed
  // over is carried by `paid` instead -- a number, not a yes/no. Stock stays a
  // choice: a service bill moves none.
  const settings: any = await AdminSettings.getOrCreateForAdmin(newInv.adminid);
  const wantsStock =
    newInv.autocreate?.stock ??
    settings?.autoCreateStockOnPurchaseInvoice ?? true;

  // A note typed on the bill is what the user expects to see against it — in the
  // Transactions list and on the receipt it raises. The generated line is only a
  // fallback for when they left the box empty.
  const billNote = String(newInv.notes || "").trim();

  // The Account Ledger statement prints each LEG's remark, never the voucher's
  // narration — so a note typed on the bill has to land on the legs to be seen
  // there at all. Same treatment a hand-entered payment already gets
  // (applyUserRemark in the payments resolver).
  const withBillNote = (legs: any[]) =>
    billNote ? legs.map((e: any) => ({ ...e, remarks: billNote })) : legs;
  // ============================
  // 📦 STOCK ADJUSTMENT
  // ============================
  if (wantsStock && !newInv.isservice) {

  // ============================
  // 1️⃣ Revert Old Invoice Stock
  // ============================
  if (oldInv) {
    for (const item of oldInv.productservice) {

      const product = await ProductService.findById(item.productserviceid);
      if (!product) continue;

      const variant = product.productvariants?.find(
        v => String(v._id) === String(item.variantid)
      );

      const qtyBase = convertToBaseUnit(
        Number(item.qty) * Number(item.unitqty),
        item.purchaseunitid,
        variant
      );

      const stock = await ProductBranchStock.findOne({
        productid: item.productserviceid,
        variantid: item.variantid,
        branchid
      });

      if (!stock) continue;

      const newCurrentStock = stock.currentstock - qtyBase;
      const newCurrentStockAmount = newCurrentStock * stock.averagecost;

      const closingstock = newCurrentStock;
      const closingstockamount = newCurrentStockAmount;

      await ProductBranchStock.updateOne(
        { productid: item.productserviceid, variantid: item.variantid, branchid },
        {
          $set: {
            currentstock: newCurrentStock,
            currentstockamount: newCurrentStockAmount,
            closingstock,
            closingstockamount,
            adminid: newInv.adminid
          }
        }
      );
    }
  }

  // ============================
  // 2️⃣ Apply New Invoice Stock
  // ============================
  for (const item of newInv.productservice) {

    const product = await ProductService.findById(item.productserviceid);
    if (!product) continue;

    const variant = product.productvariants?.find(
      v => String(v._id) === String(item.variantid)
    );

    const qtyBase = convertToBaseUnit(
      Number(item.qty) * Number(item.unitqty),
      item.purchaseunitid,
      variant
    );

    const stock = await ProductBranchStock.findOne({
      productid: item.productserviceid,
      variantid: item.variantid,
      branchid
    });

    let avgCost, newCurrentStock, newCurrentStockAmount;

    if (!stock) {
      // first-time purchase entry
      avgCost = Number(item.rate) || 0;
      newCurrentStock = qtyBase;
      newCurrentStockAmount = qtyBase * avgCost;
    } else {
      // Weighted Avg Cost calculation (Purchase Invoice)
      const oldQty = stock.currentstock;
      const oldAmount = stock.currentstockamount;

      const newAmount = qtyBase * Number(item.rate);
      const totalQty = oldQty + qtyBase;
      const totalAmount = oldAmount + newAmount;

      avgCost = totalQty > 0 ? totalAmount / totalQty : stock.averagecost;

      newCurrentStock = totalQty;
      newCurrentStockAmount = totalAmount;
    }

    const closingstock = newCurrentStock;
    const closingstockamount = newCurrentStockAmount;

    // adminid is written too — a row created by an upsert without it is
    // invisible to getStockDetails, which matches on adminid.
    await ProductBranchStock.updateOne(
      { productid: item.productserviceid, variantid: item.variantid, branchid },
      {
        $set: {
          currentstock: newCurrentStock,
          currentstockamount: newCurrentStockAmount,
          averagecost: avgCost,
          closingstock,
          closingstockamount,
          adminid: newInv.adminid
        }
      },
      { upsert: true }
    );
  }
}


// ============================
// 🧾 PURCHASE LEDGER ENTRIES (WITH REMARKS)
// ============================
const entries: any[] = [];
let totalDebit = 0;

  // Other charges, the invoice discount and the round-off are all inside
  // `totalamount`, but none of them had a leg. The vendor was credited only
  // products + GST and the balance adjustment below quietly absorbed the rest
  // into that same leg -- so any bill carrying a freight line left the vendor
  // short by exactly that freight.
  //
  // With the concession feature on for this admin they fold into Purchase, so
  // they land on the vendor's balance instead of standing as their own lines;
  // off, each keeps its own ledger. GST never folds -- it is claimable input
  // tax, not a cost.
  const foldSettings: any = await AdminSettings.getOrCreateForAdmin(newInv.adminid);
  const foldIntoPurchase = !!foldSettings?.enablePaymentDiscountCommission;
  // Resolved lazily and remembered: most bills have a purchase account on every
  // line and no charge to fold, so they never need this at all. Calling it
  // eagerly minted a ledger nobody used on the first save for an admin.
  let _defaultCostLedger: any;
  const defaultCostLedgerId = async () => {
    if (_defaultCostLedger === undefined) {
      _defaultCostLedger = await getDefaultPurchaseLedgerId(newInv.adminid, newInv.branchid);
    }
    return _defaultCostLedger;
  };

for (const item of newInv.productservice) {
  const qty = Number(item.qty);
  const rate = Number(item.rate);
  const discount = Number(item.discount);
  const taxable = parseFloat(((rate - discount) * qty).toFixed(2));
  const gstRate = Number(item.gst);
  const gstAmt = parseFloat(((taxable * gstRate) / 100).toFixed(2));

  // 🔎 Fetch product + variant name
  const product = await ProductService.findById(item.productserviceid);
  const productName = product?.name || "Unknown Product";

  let variantName = null;
  if (item.variantid && product?.productvariants?.length) {
    const variant = product.productvariants.find(
      (v: any) => v._id.toString() === item.variantid.toString()
    );
    variantName = variant?.name || null;
  }

  const purchaseRemark = variantName
    ? `Purchase of ${productName} (${variantName})`
    : `Purchase of ${productName}`;

  // ===================== PURCHASE LEDGER =====================
  // Same fallback as the builder above: never drop a line's cost.
  const purchaseLedgerId = ledgerId(item.purchaseaccountid) || (await defaultCostLedgerId());
  if (purchaseLedgerId && taxable > 0) {
    entries.push({
      ledgerid: purchaseLedgerId,
      debit: taxable,
      credit: 0,
      remarks: purchaseRemark,
    });
    totalDebit += taxable;
  }

  // ===================== INPUT GST LEDGERS =====================
  if (gstAmt > 0) {
    const cgst = await AccountLedger.findOne({
      ledgername: "Input CGST",
      admin: newInv.adminid,
    });

    const sgst = await AccountLedger.findOne({
      ledgername: "Input SGST",
      admin: newInv.adminid,
    });

    if (cgst && sgst) {
      const cgstAmt = parseFloat((gstAmt / 2).toFixed(2));
      const sgstAmt = parseFloat((gstAmt - cgstAmt).toFixed(2));

      entries.push({
        ledgerid: cgst._id,
        debit: cgstAmt,
        credit: 0,
        remarks: `CGST on ${productName}`,
      });

      entries.push({
        ledgerid: sgst._id,
        debit: sgstAmt,
        credit: 0,
        remarks: `SGST on ${productName}`,
      });

      totalDebit += gstAmt;
    } else {
      const gstAcc = await getOrCreateAccount(
        "Input GST",
        "other",
        newInv.adminid,
        newInv.branchid
      );

      entries.push({
        ledgerid: gstAcc.ledgerid || gstAcc._id,
        debit: gstAmt,
        credit: 0,
        remarks: `GST on ${productName}`,
      });

      totalDebit += gstAmt;
    }
  }
}


  if (newInv.othercharges && newInv.othercharges.length > 0) {
    for (const charge of newInv.othercharges) {
      const amt = parseFloat((Number(charge.amount) || 0).toFixed(2));
      const chargeName = charge.ledgername || "Other Charge";
      if (amt > 0) {
        entries.push({
          ledgerid: foldIntoPurchase
            ? await defaultCostLedgerId()
            : charge.ledgerid || (await defaultCostLedgerId()),
          debit: amt,
          credit: 0,
          remarks: charge.remarks || chargeName,
        });
      }
      const gst = parseFloat((Number(charge.gstamount) || 0).toFixed(2));
      if (gst > 0) {
        const cgst = await AccountLedger.findOne({ ledgername: "Input CGST", admin: newInv.adminid });
        const sgst = await AccountLedger.findOne({ ledgername: "Input SGST", admin: newInv.adminid });
        if (cgst && sgst) {
          const c = parseFloat((gst / 2).toFixed(2));
          entries.push({ ledgerid: cgst._id, debit: c, credit: 0, remarks: `CGST on ${chargeName}` });
          entries.push({ ledgerid: sgst._id, debit: parseFloat((gst - c).toFixed(2)), credit: 0, remarks: `SGST on ${chargeName}` });
        } else {
          const acc: any = await getOrCreateAccount("Input GST", "other", newInv.adminid, newInv.branchid);
          entries.push({ ledgerid: acc.ledgerid || acc._id, debit: gst, credit: 0, remarks: `GST on ${chargeName}` });
        }
      }
    }
  }

  if (newInv.invoicediscount && Number(newInv.invoicediscount) !== 0) {
    let discountAmount = Number(newInv.invoicediscount) || 0;
    if (newInv.invoicediscounttype === "percent") {
      const taxableSubtotal = (newInv.productservice || []).reduce(
        (sum: number, item: any) => sum + (Number(item.rate) - Number(item.discount)) * Number(item.qty),
        0
      );
      discountAmount = (taxableSubtotal * Number(newInv.invoicediscount)) / 100;
    }
    discountAmount = parseFloat(discountAmount.toFixed(2));
    if (discountAmount > 0) {
      // A discount the vendor allowed lowers our cost, so it credits.
      let discLedgerId: any = foldIntoPurchase ? await defaultCostLedgerId() : null;
      if (!foldIntoPurchase) {
        let disc: any = await AccountLedger.findOne({ ledgername: "Discount Received", admin: newInv.adminid }).select("_id").lean();
        if (!disc?._id) {
          const created: any = await getOrCreateAccount("Discount Received", "other", newInv.adminid, newInv.branchid);
          disc = { _id: created?.ledgerid || created?._id };
        }
        discLedgerId = disc?._id;
      }
      if (discLedgerId) {
        entries.push({
          ledgerid: discLedgerId,
          debit: 0,
          credit: discountAmount,
          remarks: foldIntoPurchase ? "Invoice Discount (netted into Purchase)" : "Invoice Discount",
        });
      }
    }
  }

  if (newInv.roundoff && Number(newInv.roundoff) !== 0) {
    let round: any = await AccountLedger.findOne({ ledgername: "Round Off", admin: newInv.adminid }).select("_id").lean();
    if (!round?._id) {
      const created: any = await getOrCreateAccount("Round Off", "other", newInv.adminid, newInv.branchid);
      round = { _id: created?.ledgerid || created?._id };
    }
    const ro = parseFloat(Number(newInv.roundoff).toFixed(2));
    if (round?._id) {
      entries.push(
        ro > 0
          ? { ledgerid: round._id, debit: ro, credit: 0, remarks: "Round Off" }
          : { ledgerid: round._id, debit: 0, credit: Math.abs(ro), remarks: "Round Off" }
      );
    }
  }

  const vendor = await Account.findById(newInv.partyacc).select("ledgerid");
  if (!vendor?.ledgerid) throw new Error("Vendor ledger missing");

  // The bill total outright — see the note in the builder above.
  entries.push({
    ledgerid: vendor.ledgerid,
    debit: 0,
    credit: parseFloat((Number(newInv.totalamount) || 0).toFixed(2)),
    remarks: `Purchase Invoice #${newInv.billnumber}`
  });

  // ============================
  // ⚖️ FINAL BALANCE ADJUSTMENT
  // ============================
  const tempDebit = parseFloat(entries.reduce((t, e) => t + (e.debit || 0), 0).toFixed(2));
  const tempCredit = parseFloat(entries.reduce((t, e) => t + (e.credit || 0), 0).toFixed(2));

  if (tempDebit !== tempCredit) {
    const diff = parseFloat((tempDebit - tempCredit).toFixed(2));
    const lastEntry = entries[entries.length - 1];
    if (lastEntry.credit !== undefined) {
      lastEntry.credit = parseFloat((lastEntry.credit + diff).toFixed(2));
    } else if (lastEntry.debit !== undefined) {
      lastEntry.debit = parseFloat((lastEntry.debit - diff).toFixed(2));
    }
  }

  const finalTotalDebit = parseFloat(entries.reduce((t, e) => t + (e.debit || 0), 0).toFixed(2));
  totalDebit = finalTotalDebit; // Sync with existing variable

  // ============================
  // 🔄 UPSERT INVOICE JOURNAL
  // ============================
  let invoiceTrx = await Transaction.findOne({
    "source.docmodel": "PurchaseInvoice",
    "source.docid": newInv._id
  });

  if (invoiceTrx) {
    const txCreatedById = userContext?.createdby_id || newInv.createdby_id;
    const txCreatedByName = userContext?.createdby_name || newInv.createdby_name;
    const txCreatedByType = userContext?.createdby_type || newInv.createdby_type;

    invoiceTrx.entries = entries;
    invoiceTrx.transactiondate = newInv.billdate;
    invoiceTrx.totaldebit = totalDebit;
    invoiceTrx.totalcredit = totalDebit;
    invoiceTrx.status = true;
    // ✅ Also update createdby if userContext is provided
    if (userContext) {
      invoiceTrx.createdby_id = txCreatedById;
      invoiceTrx.createdby_name = txCreatedByName;
      invoiceTrx.createdby_type = txCreatedByType;
    }
    console.log("   Updated with createdby_id:", txCreatedById);
    await invoiceTrx.save();
  } else {
    const txCreatedById = userContext?.createdby_id || newInv.createdby_id;
    const txCreatedByName = userContext?.createdby_name || newInv.createdby_name;
    const txCreatedByType = userContext?.createdby_type || newInv.createdby_type;

    console.log("✅ Creating Invoice Transaction:");
    console.log("   createdby_id:", txCreatedById);
    console.log("   createdby_name:", txCreatedByName);
    console.log("   createdby_type:", txCreatedByType);

    invoiceTrx = await Transaction.create({
      adminid: newInv.adminid,
      branchid: newInv.branchid,
      entrytype: "auto",
      source: { docmodel: "PurchaseInvoice", docid: newInv._id },
      transactiondate: newInv.billdate,
      narration: `Purchase Invoice #${newInv.billnumber}`,
      entries: withBillNote(entries),
      totaldebit: totalDebit,
      totalcredit: totalDebit,
      createdby_id: txCreatedById,
      createdby_name: txCreatedByName,
      createdby_type: txCreatedByType,
    });

    console.log("   Created Transaction ID:", invoiceTrx._id);
  }

  // ============================
  // 💰 PAYMENT LOGIC
  // ============================
  // `paid` is the whole story: 0 is a pure credit purchase, the full total is a
  // cash purchase, and anything between leaves the rest outstanding for a later
  // Payment-Out. `paymenttype` only says HOW the money went, never how much --
  // except "credit", which is just paid = 0 said in words.
  const invId =
    typeof newInv._id === "string"
      ? new mongoose.Types.ObjectId(newInv._id)
      : newInv._id;

  // Only ever touch the payment THIS bill created, never a manual Payment-Out
  // the user entered against the same bill later.
  const oldPayment = await Payment.findOne({
    "autosource.docmodel": "PurchaseInvoice",
    "autosource.docid": invId,
  });

  const grandTotal = parseFloat(Number(newInv.totalamount || 0).toFixed(2));
  const payType = String(newInv.paymenttype || "").toLowerCase();

  let payAmount =
    payType === "credit" ? 0 : parseFloat(Number(newInv.paid || 0).toFixed(2));
  if (!(payAmount > 0)) payAmount = 0;
  if (payAmount > grandTotal) payAmount = grandTotal;

  // ...and cap again at what is actually still OPEN on this bill. If a separate
  // Payment-Out already collected part of it, "Paid" must not claim that amount a
  // second time -- the bill would end up over-settled and the party would show
  // a phantom debit that never existed.
  const otherPays: any[] = await Payment.find({
    status: true,
    "invoices.invoiceid": invId,
    ...(oldPayment ? { _id: { $ne: oldPayment._id } } : {}),
  })
    .select("invoices")
    .lean();
  let settledElsewhere = 0;
  otherPays.forEach((d: any) =>
    (d.invoices || []).forEach((l: any) => {
      if (String(l.invoiceid) === String(invId)) settledElsewhere += Number(l.settledamount) || 0;
    })
  );
  const room = parseFloat((grandTotal - parseFloat(settledElsewhere.toFixed(2))).toFixed(2));
  if (payAmount > room) payAmount = room > 0 ? room : 0;

  if (payAmount <= 0) {
    if (oldPayment) {
      await Transaction.deleteOne({ _id: oldPayment.transactionid });
      await Payment.deleteOne({ _id: oldPayment._id });
      console.log("Paid is 0 — removed the payment a previous save created.");
    }
    return;
  }

  // Every mode mapped explicitly. It used to be `isCash ? "Cash" : "Bank
  // Account"`, so UPI, Card, Cheque AND Other all silently became Bank Account.
  const LEDGER_BY_MODE: Record<string, string> = {
    cash: "Cash",
    bank: "Bank Account",
    upi: "Bank Account",
    card: "Bank Account",
    cheque: "Bank Account",
    other: "Cash",
  };
  const payLedgerName = LEDGER_BY_MODE[payType] || "Cash";

  let payLedger = await AccountLedger.findOne({
    ledgername: payLedgerName,
    admin: newInv.adminid,
  });
  if (!payLedger) {
    const created = await getOrCreateAccount(payLedgerName, "other", newInv.adminid, newInv.branchid);
    payLedger = { _id: created.ledgerid } as any;
  }

  const cashBankLedgerId: any = payLedger?._id;
  if (!cashBankLedgerId) {
    throw new Error(`Cash/Bank ledger "${payLedgerName}" could not be resolved for admin ${newInv.adminid}`);
  }

  // Money out: Dr Vendor (we owe them less) / Cr Cash. Two legs, balanced by
  // construction.
  const paymentEntries = withBillNote([
    {
      ledgerid: vendor.ledgerid,
      debit: payAmount,
      credit: 0,
      remarks: `Payment made (Invoice ${newInv.billnumber})`,
    },
    {
      ledgerid: cashBankLedgerId,
      debit: 0,
      credit: payAmount,
      remarks: `Vendor payment (Invoice ${newInv.billnumber})`,
    },
  ]);

  const payCreatedById = userContext?.createdby_id || newInv.createdby_id;
  const payCreatedByName = userContext?.createdby_name || newInv.createdby_name;
  const payCreatedByType = userContext?.createdby_type || newInv.createdby_type;

  if (oldPayment) {
    oldPayment.mode = newInv.paymenttype;
    // Same as the sales side: the payment follows the bill's date.
    oldPayment.paymentdate = newInv.billdate;
    // ...and its remarks follow the bill's note. The create branch already did
    // this; the update branch only ever touched the money fields, so a note
    // typed (or changed) on an existing bill reached the Transaction's narration
    // but never the receipt sitting beside it.
    oldPayment.remarks = billNote || `Payment for Purchase Invoice #${newInv.billnumber}`;
    oldPayment.ledgerid = cashBankLedgerId;
    oldPayment.amount = payAmount;
    if (oldPayment.invoices?.length) {
      oldPayment.invoices[0].settledamount = payAmount;
    } else {
      oldPayment.invoices = [
        { invoiceid: invId, invoicemodel: "PurchaseInvoice", settledamount: payAmount } as any,
      ];
    }
    if (userContext) {
      oldPayment.createdby_id = payCreatedById;
      oldPayment.createdby_name = payCreatedByName;
      oldPayment.createdby_type = payCreatedByType;
    }
    await oldPayment.save();

    const updateData: any = {
      $set: {
        entries: paymentEntries,
        totaldebit: payAmount,
        totalcredit: payAmount,
        transactiondate: newInv.billdate,
        narration: `Payment for Purchase Invoice #${newInv.billnumber}`,
      },
    };
    if (userContext) {
      updateData.$set.createdby_id = payCreatedById;
      updateData.$set.createdby_name = payCreatedByName;
      updateData.$set.createdby_type = payCreatedByType;
    }
    await Transaction.updateOne({ _id: oldPayment.transactionid }, updateData);
    return;
  }

  const payTrx = await Transaction.create({
    adminid: newInv.adminid,
    branchid: newInv.branchid,
    entrytype: "auto",
    source: { docmodel: "Payment", docid: invId },
    transactiondate: newInv.billdate,
    narration: `Payment for Purchase Invoice #${newInv.billnumber}`,
    entries: paymentEntries,
    totaldebit: payAmount,
    totalcredit: payAmount,
    createdby_id: payCreatedById,
    createdby_name: payCreatedByName,
    createdby_type: payCreatedByType,
  });

  await Payment.create({
    adminid: newInv.adminid,
    branchid: newInv.branchid,
    type: "payment",
    mode: newInv.paymenttype,
    paymentdate: newInv.billdate,
    partyid: newInv.partyacc,
    ledgerid: cashBankLedgerId,
    invoices: [
      {
        invoiceid: invId,
        invoicemodel: "PurchaseInvoice",
        settledamount: payAmount,
      },
    ],
    amount: payAmount,
    remarks: billNote || `Payment for Purchase Invoice #${newInv.billnumber}`,
    transactionid: payTrx._id,
    autosource: { docmodel: "PurchaseInvoice", docid: invId },
    createdby_id: payCreatedById,
    createdby_name: payCreatedByName,
    createdby_type: payCreatedByType,
  });
};

// ============================
// ❌ DISABLED: Post "save" hook - resolvers now call adjustStockAndTransactions explicitly WITH userContext
// This prevents duplicate Transaction/Payment creation and ensures Created By is never N/A
// ============================
// purchaseInvoiceSchema.post("save", async function (doc: any, next) {
//   try {
//     await (PurchaseInvoice as any).adjustStockAndTransactions(null, doc);
//     next();
//   } catch (e: any) {
//     console.error("Purchase invoice auto error", e);
//     next(e);
//   }
// });

interface PurchaseInvoiceModel extends mongoose.Model<any> {
  adjustStockAndTransactions(oldInvoice: any, newInvoice: any, userContext?: any): Promise<void>;
}

export const PurchaseInvoice = mongoose.model<any, PurchaseInvoiceModel>(
  "PurchaseInvoice",
  purchaseInvoiceSchema
);
