// models/purchaseinvoice.ts
import mongoose from "mongoose";
import { ProductBranchStock } from "../productbranchstock";
import { ProductService } from "../products";
import { convertToBaseUnit } from "../../utils/unitconversation";
import { Transaction } from "../transactions";
import { Payment } from "../payments";
import { getOrCreateAccount } from "../../utils/helper";
import { AccountLedger } from "../accountledgers";
import { Account } from "../accounts";
import { AdminSettings } from "../adminsettings";

const purchaseInvoiceSchema = new mongoose.Schema(
  {
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

    isservice: { type: Boolean, default: false },
    autocreate: { type: Boolean, default: false },
    status: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// 🔢 Auto-generate bill number when blank
purchaseInvoiceSchema.pre("save", async function (next) {
  if (!this.billnumber) {
    const lastInvoice = await mongoose
      .model("PurchaseInvoice")
      .findOne({ adminid: this.adminid })
      .sort({ createdAt: -1 });
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

purchaseInvoiceSchema.statics.adjustStockAndTransactions = async function (oldInv: any, newInv: any) {
  const branchid =
    typeof newInv.branchid === "string"
      ? new mongoose.Types.ObjectId(newInv.branchid)
      : newInv.branchid;
    if (!branchid) return;
    
  // Resolve auto-posting flags. Per-invoice `autocreate` overrides; if it's
  // not provided we fall back to AdminSettings so accounting doesn't depend
  // on the user remembering to toggle the checkbox.
  const settings: any = await AdminSettings.getOrCreateForAdmin(newInv.adminid);
  const wantsLedger =
    newInv.autocreate ??
    settings?.autoCreateLedgerOnPurchaseInvoice ?? true;
  const wantsStock =
    newInv.autocreate ??
    settings?.autoCreateStockOnPurchaseInvoice ?? true;

  if (!wantsLedger && !wantsStock) {
    console.log("Auto-create disabled (per-invoice or AdminSettings). Skipping.");
    return;
  }
  // ============================
  // 📦 STOCK ADJUSTMENT
  // ============================
  if (!newInv.isservice) {

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
            closingstockamount
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

    await ProductBranchStock.updateOne(
      { productid: item.productserviceid, variantid: item.variantid, branchid },
      {
        $set: {
          currentstock: newCurrentStock,
          currentstockamount: newCurrentStockAmount,
          averagecost: avgCost,
          closingstock,
          closingstockamount
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
  const purchaseLedgerId = ledgerId(item.purchaseaccountid);
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
        ledgerid: gstAcc._id,
        debit: gstAmt,
        credit: 0,
        remarks: `GST on ${productName}`,
      });

      totalDebit += gstAmt;
    }
  }
}

  const vendor = await Account.findById(newInv.partyacc).select("ledgerid");
  if (!vendor?.ledgerid) throw new Error("Vendor ledger missing");

  entries.push({
    ledgerid: vendor.ledgerid,
    debit: 0,
    credit: 0, // Will be set below
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
    invoiceTrx.entries = entries;
    invoiceTrx.transactiondate = newInv.billdate;
    invoiceTrx.totaldebit = totalDebit;
    invoiceTrx.totalcredit = totalDebit;
    invoiceTrx.status = true;
    await invoiceTrx.save();
  } else {
    invoiceTrx = await Transaction.create({
      adminid: newInv.adminid,
      branchid: newInv.branchid,
      entrytype: "auto",
      source: { docmodel: "PurchaseInvoice", docid: newInv._id },
      transactiondate: newInv.billdate,
      narration: `Purchase Invoice #${newInv.billnumber}`,
      entries,
      totaldebit: totalDebit,
      totalcredit: totalDebit
    });
  }

  // ============================
  // 💰 PAYMENT LOGIC (UPDATED)
  // ============================
  const payType = String(newInv.paymenttype).toLowerCase();
  const isCredit = payType === "credit";
  const isCash = payType === "cash";
  const isBank = payType === "bank";

  const invId =
    typeof newInv._id === "string"
      ? new mongoose.Types.ObjectId(newInv._id)
      : newInv._id;

  const oldPayment = await Payment.findOne({
    "invoices.invoiceid": invId,
    "invoices.invoicemodel": "PurchaseInvoice"
  });

  if (isCredit) {
    if (oldPayment) {
      await Transaction.deleteOne({ _id: oldPayment.transactionid });
      await Payment.deleteOne({ _id: oldPayment._id });
    }
    return;
  }

  const payLedgerName = isCash ? "Cash" : "Bank Account";
  let payLedger = await AccountLedger.findOne({ ledgername: payLedgerName, admin: newInv.adminid });

  if (!payLedger) {
    const created = await getOrCreateAccount(payLedgerName, "other", newInv.adminid, newInv.branchid);
    payLedger = { _id: created._id } as any;
  }

  const paymentEntries = [
    { ledgerid: vendor.ledgerid, debit: newInv.totalamount, credit: 0 },
    { ledgerid: payLedger?._id, debit: 0, credit: newInv.totalamount }
  ];

  if (oldPayment) {
    oldPayment.mode = newInv.paymenttype;
    oldPayment.ledgerid = vendor.ledgerid;
    oldPayment.amount = newInv.totalamount;
    oldPayment.invoices[0].settledamount = newInv.totalamount;
    await oldPayment.save();

    await Transaction.updateOne(
      { _id: oldPayment.transactionid },
      {
        $set: {
          entries: paymentEntries,
          totaldebit: newInv.totalamount,
          totalcredit: newInv.totalamount,
          transactiondate: newInv.billdate,
          narration: `Payment for Purchase Invoice #${newInv.billnumber}`
        }
      }
    );
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
    totaldebit: newInv.totalamount,
    totalcredit: newInv.totalamount
  });

  await Payment.create({
    adminid: newInv.adminid,
    branchid: newInv.branchid,
    type: "payment",
    mode: newInv.paymenttype,
    partyid: vendor._id,
    ledgerid: vendor.ledgerid,
    invoices: [
      { invoiceid: invId, invoicemodel: "PurchaseInvoice", settledamount: newInv.totalamount }
    ],
    amount: newInv.totalamount,
    remarks: `Payment for Purchase Invoice #${newInv.billnumber}`,
    transactionid: payTrx._id
  });
};

// ============================
// ✅ Handle new invoice (create)
// ============================
purchaseInvoiceSchema.post("save", async function (doc: any, next) {
  try {
    await (PurchaseInvoice as any).adjustStockAndTransactions(null, doc);
    next();
  } catch (e: any) {
    console.error("Purchase invoice auto error", e);
    next(e);
  }
});

interface PurchaseInvoiceModel extends mongoose.Model<any> {
  adjustStockAndTransactions(oldInvoice: any, newInvoice: any): Promise<void>;
}

export const PurchaseInvoice = mongoose.model<any, PurchaseInvoiceModel>(
  "PurchaseInvoice",
  purchaseInvoiceSchema
);
