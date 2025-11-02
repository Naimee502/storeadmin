// models/purchaseinvoice.ts
import mongoose from "mongoose";
import { ProductBranchStock } from "../productbranchstock";
import { ProductService } from "../products";
import { convertToBaseUnit } from "../../utils/unitconversation";
import { Transaction } from "../transactions";
import { Payment } from "../payments";
import { getOrCreateAccount } from "../../utils/helper";
import { AccountLedger } from "../accountledgers";

const purchaseInvoiceSchema = new mongoose.Schema(
  {
    paymenttype: { type: String, required: true },
    partyacc: { type: String, required: true },
    taxorsupplytype: { type: String, required: true },
    billdate: { type: String, required: true },
    billtype: { type: String, required: true },
    billnumber: { type: String, required: true },
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
        purchaseunitid: { type: mongoose.Schema.Types.ObjectId },
        unitqty: { type: Number, default: 1 },
        gst: { type: Number, required: true },
        qty: { type: Number, required: true },
        rate: { type: Number, required: true },
        amount: { type: Number, required: true },
        discount: { type: Number, default: 0 },

        purchaseaccountid: mongoose.Schema.Types.Mixed,
        salesaccountid: mongoose.Schema.Types.Mixed,
        serviceaccountid: mongoose.Schema.Types.Mixed
      }
    ],

    isservice: { type: Boolean, default: false },
    status: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// ✅ Extract ObjectId safely
function ledgerIdFromField(field: any): string | null {
  if (!field) return null;
  if (typeof field === "string") return field;
  if (typeof field === "object") return field._id || field.id || null;
  return null;
}

// ✅ Purchase Invoice Logic
purchaseInvoiceSchema.statics.adjustStockAndTransactions = async function (
  oldInvoice: any,
  newInvoice: any
) {
  const branchid =
    typeof newInvoice.branchid === "string"
      ? new mongoose.Types.ObjectId(newInvoice.branchid)
      : newInvoice.branchid;

  if (!branchid) return;

  // ---------------------- 📦 STOCK HANDLING ----------------------
  if (!newInvoice.isservice) {
    // rollback old stock
    if (oldInvoice) {
      for (const item of oldInvoice.productservice || []) {
        const product = await ProductService.findById(item.productserviceid);
        if (!product) continue;

        const variant = product.productvariants?.find(v => String(v._id) === String(item.variantid));
        const qtyBase = convertToBaseUnit(Number(item.qty) * Number(item.unitqty), item.purchaseunitid, variant);

        await ProductBranchStock.updateOne(
          { productid: item.productserviceid, variantid: item.variantid, branchid },
          { $inc: { currentstock: -qtyBase } }
        );
      }
    }

    // apply new stock
    for (const item of newInvoice.productservice || []) {
      const product = await ProductService.findById(item.productserviceid);
      if (!product) continue;

      const variant = product.productvariants?.find(v => String(v._id) === String(item.variantid));
      const qtyBase = convertToBaseUnit(Number(item.qty) * Number(item.unitqty), item.purchaseunitid, variant);

      await ProductBranchStock.updateOne(
        { productid: item.productserviceid, variantid: item.variantid, branchid },
        { $inc: { currentstock: qtyBase } },
        { upsert: true }
      );
    }
  }

  // ---------------------- 📒 TRANSACTION ENTRIES ----------------------
  const entries: any[] = [];
  let totalDebit = 0;

  for (const item of newInvoice.productservice) {
    const qty = Number(item.qty);
    const rate = Number(item.rate);
    const discount = Number(item.discount);

    const taxable = (rate - discount) * qty;
    const purchaseLedgerId = ledgerIdFromField(item.purchaseaccountid);

    // debit purchase a/c
    if (purchaseLedgerId && taxable > 0) {
      entries.push({
        accountid: new mongoose.Types.ObjectId(purchaseLedgerId),
        debit: taxable, credit: 0
      });
      totalDebit += taxable;
    }

    // GST
    const gstPercent = Number(item.gst);
    if (gstPercent > 0) {
      const gstAmt = (taxable * gstPercent) / 100;
      totalDebit += gstAmt;

      const igst = await AccountLedger.findOne({ ledgername: "Input IGST", admin: newInvoice.adminid });
      const cgst = await AccountLedger.findOne({ ledgername: "Input CGST", admin: newInvoice.adminid });
      const sgst = await AccountLedger.findOne({ ledgername: "Input SGST", admin: newInvoice.adminid });

      const half = gstAmt / 2;

      if (cgst && sgst) {
        entries.push({ accountid: cgst._id, debit: half, credit: 0 });
        entries.push({ accountid: sgst._id, debit: half, credit: 0 });
      } else if (igst) {
        entries.push({ accountid: igst._id, debit: gstAmt, credit: 0 });
      } else {
        const gstAcc = await getOrCreateAccount("Input GST", "other", newInvoice.adminid, newInvoice.branchid);
        entries.push({ accountid: gstAcc._id, debit: gstAmt, credit: 0 });
      }
    }
  }

  // vendor credit
  const partyId = ledgerIdFromField(newInvoice.partyacc);
  if (partyId) {
    entries.push({
      accountid: new mongoose.Types.ObjectId(partyId),
      debit: 0,
      credit: totalDebit,
      remarks: `Purchase Invoice #${newInvoice.billnumber}`
    });
  }

  // ---------------------- 🧾 SAVE TRANSACTION ----------------------
  let trx = await Transaction.findOne({
    "source.docmodel": "PurchaseInvoice",
    "source.docid": newInvoice._id
  });

  if (trx) {
    trx.entries = entries;
    trx.transactiondate = newInvoice.billdate;
    trx.status = true;
    await trx.save();
  } else {
    trx = await Transaction.create({
      adminid: newInvoice.adminid,
      branchid: newInvoice.branchid,
      entrytype: "auto",
      source: { docmodel: "PurchaseInvoice", docid: newInvoice._id },
      transactiondate: newInvoice.billdate,
      narration: `Purchase Invoice #${newInvoice.billnumber}`,
      entries
    });
  }

  // ---------------------- 💵 PAYMENT HANDLING ----------------------
  const existingPay = await Payment.findOne({ "invoices.invoiceid": newInvoice._id });

  if (existingPay) {
    existingPay.amount = newInvoice.totalamount;
    existingPay.invoices[0].settledamount = newInvoice.totalamount;
    existingPay.transactionid = trx._id;
    await existingPay.save();
  } else if (String(newInvoice.paymenttype).toLowerCase() !== "credit") {
    const payDoc = await Payment.create({
      adminid: newInvoice.adminid,
      branchid: newInvoice.branchid,
      type: "payment",
      mode: newInvoice.paymenttype,
      partyid: partyId,
      invoices: [{ invoiceid: newInvoice._id, invoicemodel: "PurchaseInvoice", settledamount: newInvoice.totalamount }],
      amount: newInvoice.totalamount,
      remarks: `Payment for Purchase Invoice #${newInvoice.billnumber}`,
      transactionid: trx._id
    });

    // ensure pay ledger
    const payLedgerName = String(newInvoice.paymenttype).toLowerCase() === "cash" ? "Cash" : "Bank Account";
    let payLedger = await AccountLedger.findOne({ ledgername: payLedgerName, admin: newInvoice.adminid });

    if (!payLedger) {
      const created = await getOrCreateAccount(payLedgerName, "other", newInvoice.adminid, newInvoice.branchid);
      payLedger = { _id: created._id } as any;
    }

    if (!partyId) throw new Error("Party ledger missing for purchase payment.");

    await Transaction.create({
      adminid: newInvoice.adminid,
      branchid: newInvoice.branchid,
      entrytype: "auto",
      source: { docmodel: "Payment", docid: payDoc._id },
      transactiondate: newInvoice.billdate,
      narration: `Payment for Purchase Invoice #${newInvoice.billnumber}`,
      entries: [
        { accountid: payLedger?._id, debit: newInvoice.totalamount, credit: 0 },
        { accountid: new mongoose.Types.ObjectId(partyId), debit: 0, credit: newInvoice.totalamount }
      ]
    });
  }
};

// post save hook
purchaseInvoiceSchema.post("save", async function (doc: any, next) {
  try {
    await (PurchaseInvoice as any).adjustStockAndTransactions(null, doc);
    next();
  } catch (e:any) {
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
