// models/purchasereturn.ts
//
// Purchase Return (Debit Note) — mirrors PurchaseInvoice with reversed signs.
// Linked to a source PurchaseInvoice via `sourceInvoiceId`.
//
// Stock impact:  SUBTRACT returned qty from ProductBranchStock (we sent it back).
// Accounting:    Credit "Purchase Return" + Input GST, Debit supplier.
// Refund:        For cash/bank originals, optionally create a refund Payment
//                that debits Cash/Bank and credits the supplier.

import mongoose from "mongoose";
import { ProductBranchStock } from "../productbranchstock";
import { ProductService } from "../products";
import { convertToBaseUnit } from "../../utils/unitconversation";
import { Transaction } from "../transactions";
import { Payment } from "../payments";
import { getOrCreateAccount } from "../../utils/helper";
import { AccountLedger } from "../accountledgers";
import { Account } from "../accounts";

const purchaseReturnSchema = new mongoose.Schema(
  {
    sourceInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseInvoice", required: true, index: true },
    sourceBillNumber: { type: String },

    createdby_id: { type: mongoose.Schema.Types.ObjectId },
    createdby_name: { type: String },
    createdby_type: { type: String },

    paymenttype: { type: String, required: true },
    partyacc: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },

    taxorsupplytype: { type: String, required: true },
    returndate: { type: String, required: true },
    billtype: { type: String, required: true },
    billnumber: { type: String },                       // DN-000001
    notes: { type: String },
    reason: { type: String },

    refundMode: { type: String, default: "auto" },     // auto | advance | skip

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

    isservice: { type: Boolean, default: false },
    autocreate: {
      ledger: { type: Boolean, default: true }
    },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

purchaseReturnSchema.pre("save", async function (next) {
  if (!this.billnumber) {
    const last = await mongoose.model("PurchaseReturn")
      .findOne({ adminid: this.adminid })
      .sort({ createdAt: -1 });
    let nextNum = 1;
    if (last && (last as any).billnumber) {
      const num = parseInt(String((last as any).billnumber).replace(/\D/g, ""), 10);
      if (!isNaN(num)) nextNum = num + 1;
    }
    this.billnumber = `DN-${nextNum.toString().padStart(6, "0")}`;
  }
  next();
});

function ledgerId(x: any) {
  if (!x) return null;
  if (typeof x === "string") return x;
  return x._id || x.id || null;
}

purchaseReturnSchema.statics.adjustStockAndTransactions = async function (oldRet: any, newRet: any, userContext?: any) {
  const branchid = typeof newRet.branchid === "string"
    ? new mongoose.Types.ObjectId(newRet.branchid)
    : newRet.branchid;
  if (!branchid) return;

  if (!newRet.autocreate) {
    console.log("Auto-create disabled. Skipping Purchase Return stock and journal.");
    return;
  }

  // ===== STOCK ADJUSTMENT — purchase return REMOVES stock =====
  if (!newRet.isservice) {
    if (oldRet) {
      // Reverse old return: add back what was removed
      for (const item of oldRet.productservice) {
        const product = await ProductService.findById(item.productserviceid);
        if (!product) continue;
        const variant = product.productvariants?.find(v => String(v._id) === String(item.variantid));
        const qtyBase = convertToBaseUnit(Number(item.qty) * Number(item.unitqty), item.purchaseunitid, variant);

        const stock = await ProductBranchStock.findOne({
          productid: item.productserviceid, variantid: item.variantid, branchid
        });
        if (!stock) continue;

        const newStock = stock.currentstock + qtyBase;
        const newAmt = newStock * stock.averagecost;
        await ProductBranchStock.updateOne(
          { productid: item.productserviceid, variantid: item.variantid, branchid },
          { $set: { currentstock: newStock, currentstockamount: newAmt, closingstock: newStock, closingstockamount: newAmt } }
        );
      }
    }

    for (const item of newRet.productservice) {
      const product = await ProductService.findById(item.productserviceid);
      if (!product) continue;
      const variant = product.productvariants?.find(v => String(v._id) === String(item.variantid));
      const qtyBase = convertToBaseUnit(Number(item.qty) * Number(item.unitqty), item.purchaseunitid, variant);

      const stock = await ProductBranchStock.findOne({
        productid: item.productserviceid, variantid: item.variantid, branchid
      });
      let newStock, newAmt;
      if (!stock) {
        newStock = -qtyBase;
        newAmt = 0;
      } else {
        newStock = stock.currentstock - qtyBase;
        newAmt = stock.currentstockamount - qtyBase * stock.averagecost;
      }
      await ProductBranchStock.updateOne(
        { productid: item.productserviceid, variantid: item.variantid, branchid },
        { $set: { currentstock: newStock, currentstockamount: newAmt, closingstock: newStock, closingstockamount: newAmt } },
        { upsert: true }
      );
    }
  }

  // ===== JOURNAL ENTRIES =====
  // Original PI: Dr Purchase / Dr Input GST / Cr Vendor
  // Return PR:   Cr Purchase Return / Cr Input GST / Dr Vendor
  const entries: any[] = [];

  let purchaseReturnLedger = await AccountLedger.findOne({
    ledgername: "Purchase Return", admin: newRet.adminid,
  });
  if (!purchaseReturnLedger) {
    const created = await getOrCreateAccount("Purchase Return", "other", newRet.adminid, newRet.branchid);
    purchaseReturnLedger = { _id: created.ledgerid } as any;
  }

  for (const item of newRet.productservice) {
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
      const variant = product.productvariants.find((v: any) => v?._id.toString() === item.variantid.toString());
      variantName = variant?.name || null;
    }
    const remark = variantName
      ? `Purchase Return of ${productName} (${variantName})`
      : `Purchase Return of ${productName}`;

    if (taxable > 0 && purchaseReturnLedger?._id) {
      entries.push({ ledgerid: purchaseReturnLedger._id, debit: 0, credit: taxable, remarks: remark });
    }

    if (gstAmt > 0) {
      const cgst = await AccountLedger.findOne({ ledgername: "Input CGST", admin: newRet.adminid });
      const sgst = await AccountLedger.findOne({ ledgername: "Input SGST", admin: newRet.adminid });
      if (cgst && sgst) {
        const cgstAmt = parseFloat((gstAmt / 2).toFixed(2));
        const sgstAmt = parseFloat((gstAmt - cgstAmt).toFixed(2));
        entries.push({ ledgerid: cgst._id, debit: 0, credit: cgstAmt, remarks: `Reversal of CGST on ${productName}` });
        entries.push({ ledgerid: sgst._id, debit: 0, credit: sgstAmt, remarks: `Reversal of SGST on ${productName}` });
      } else {
        const gstAcc = await getOrCreateAccount("Input GST", "other", newRet.adminid, newRet.branchid);
        if (gstAcc?.ledgerid) {
          entries.push({ ledgerid: gstAcc.ledgerid, debit: 0, credit: gstAmt, remarks: `Reversal of GST on ${productName}` });
        }
      }
    }
  }

  // ===================== OTHER CHARGES ==========================
  if (newRet.othercharges && newRet.othercharges.length > 0) {
    for (const charge of newRet.othercharges) {
      if (charge.amount > 0) {
        entries.push({
          ledgerid: charge.ledgerid,
          debit: 0,
          credit: charge.amount,
          remarks: charge.remarks || charge.ledgername || "Reversal of Other Charge",
        });

        if (charge.gstamount > 0) {
          const cgst = await AccountLedger.findOne({ ledgername: "Input CGST", admin: newRet.adminid });
          const sgst = await AccountLedger.findOne({ ledgername: "Input SGST", admin: newRet.adminid });

          if (cgst && sgst) {
            const cgstAmt = parseFloat((charge.gstamount / 2).toFixed(2));
            const sgstAmt = parseFloat((charge.gstamount - cgstAmt).toFixed(2));

            entries.push({ ledgerid: cgst._id, debit: 0, credit: cgstAmt, remarks: `Reversal of CGST on ${charge.ledgername || "Other Charge"}` });
            entries.push({ ledgerid: sgst._id, debit: 0, credit: sgstAmt, remarks: `Reversal of SGST on ${charge.ledgername || "Other Charge"}` });
          } else {
            const gstAcc = await getOrCreateAccount("Input GST", "other", newRet.adminid, newRet.branchid);
            if (gstAcc?.ledgerid) {
              entries.push({ ledgerid: gstAcc.ledgerid, debit: 0, credit: charge.gstamount, remarks: `Reversal of GST on ${charge.ledgername || "Other Charge"}` });
            }
          }
        }
      }
    }
  }

  // ===================== ROUND OFF ==========================
  if (newRet.roundoff && newRet.roundoff !== 0) {
    let roundOffLedger = await AccountLedger.findOne({ ledgername: "Round Off", admin: newRet.adminid });
    if (!roundOffLedger) {
      const created = await getOrCreateAccount("Round Off", "expense", newRet.adminid, newRet.branchid);
      if (created) roundOffLedger = { _id: created.ledgerid } as any;
    }

    if (roundOffLedger) {
      if (newRet.roundoff > 0) {
        // Income reversal (Credit)
        entries.push({ ledgerid: roundOffLedger._id, debit: 0, credit: newRet.roundoff, remarks: "Reversal of Round Off" });
      } else {
        // Expense reversal (Debit)
        entries.push({ ledgerid: roundOffLedger._id, debit: Math.abs(newRet.roundoff), credit: 0, remarks: "Reversal of Round Off" });
      }
    }
  }

  // ===================== INVOICE DISCOUNT =======================
  if (newRet.invoicediscount && newRet.invoicediscount !== 0) {
    let discLedger = await AccountLedger.findOne({ ledgername: "Invoice Discount", admin: newRet.adminid });
    if (!discLedger) {
      const created = await getOrCreateAccount("Invoice Discount", "expense", newRet.adminid, newRet.branchid);
      if (created) discLedger = { _id: created.ledgerid } as any;
    }

    // Calculate the actual discount amount in case it's a percentage
    let discountAmount = newRet.invoicediscount;
    if (newRet.invoicediscounttype === "percent") {
      const taxableSubtotal = newRet.productservice.reduce((sum:any, item:any) => {
        return sum + (Number(item.rate) - Number(item.discount)) * Number(item.qty);
      }, 0);
      discountAmount = (taxableSubtotal * newRet.invoicediscount) / 100;
    }

    if (discountAmount > 0 && discLedger) {
      // Reversal of discount received -> Debit
      entries.push({ ledgerid: discLedger._id, debit: parseFloat(discountAmount.toFixed(2)), credit: 0, remarks: "Reversal of Invoice Discount" });
    }
  }

  const vendor = await Account.findById(newRet.partyacc).select("ledgerid");
  if (!vendor?.ledgerid) throw new Error("❌ Vendor ledger missing on Purchase Return");

  entries.push({
    ledgerid: vendor.ledgerid,
    debit: parseFloat(newRet.totalamount.toFixed(2)),
    credit: 0,
    remarks: `Purchase Return ${newRet.billnumber} (against ${newRet.sourceBillNumber || "Invoice"})`,
  });

  // Balance check
  const tempDebit = parseFloat(entries.reduce((t, e) => t + (e.debit || 0), 0).toFixed(2));
  const tempCredit = parseFloat(entries.reduce((t, e) => t + (e.credit || 0), 0).toFixed(2));
  if (tempDebit !== tempCredit) {
    const diff = parseFloat((tempDebit - tempCredit).toFixed(2));
    const last = entries[entries.length - 1];
    if (last.debit !== undefined) last.debit = parseFloat((last.debit - diff).toFixed(2));
  }

  const totalDebit = parseFloat(entries.reduce((t, e) => t + (e.debit || 0), 0).toFixed(2));
  const totalCredit = parseFloat(entries.reduce((t, e) => t + (e.credit || 0), 0).toFixed(2));
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Purchase Return not balanced (Debit ${totalDebit} ≠ Credit ${totalCredit})`);
  }

  // ===== UPSERT TRANSACTION =====
  let trx = await Transaction.findOne({
    "source.docmodel": "PurchaseReturn", "source.docid": newRet._id,
  });
  if (trx) {
    trx.entries = entries;
    trx.transactiondate = newRet.returndate;
    trx.totaldebit = totalDebit;
    trx.totalcredit = totalCredit;
    trx.status = true;
    await trx.save();
  } else {
    trx = await Transaction.create({
      adminid: newRet.adminid,
      branchid: newRet.branchid,
      entrytype: "auto",
      source: { docmodel: "PurchaseReturn", docid: newRet._id },
      transactiondate: newRet.returndate,
      narration: `Purchase Return ${newRet.billnumber}`,
      entries,
      totaldebit: totalDebit,
      totalcredit: totalCredit,
      createdby_id: userContext?.createdby_id,
      createdby_name: userContext?.createdby_name,
      createdby_type: userContext?.createdby_type,
    });
  }

  // ===== REFUND PAYMENT =====
  // For cash/bank: mirror the original purchase payment in reverse —
  // Cash/Bank Dr (we get money back), Vendor Cr.
  const payType = String(newRet.paymenttype).toLowerCase();
  const isCash = payType === "cash";
  const isBank = payType === "bank";
  const refundMode = String(newRet.refundMode || "auto").toLowerCase();

  const existingRefund = await Payment.findOne({
    "invoices.invoiceid": newRet._id,
    "invoices.invoicemodel": "PurchaseReturn",
  });
  if (existingRefund) {
    await Transaction.deleteOne({ _id: existingRefund.transactionid });
    await Payment.deleteOne({ _id: existingRefund._id });
  }

  if (refundMode !== "auto") return;
  if (!isCash && !isBank) return;

  const payLedgerName = isCash ? "Cash" : "Bank Account";
  let payLedger = await AccountLedger.findOne({ ledgername: payLedgerName, admin: newRet.adminid });
  if (!payLedger) {
    const created = await getOrCreateAccount(payLedgerName, "other", newRet.adminid, newRet.branchid);
    payLedger = { _id: created.ledgerid } as any;
  }

  const refundAmt = parseFloat(newRet.totalamount.toFixed(2));
  const refundEntries = [
    { ledgerid: payLedger?._id, debit: refundAmt, credit: 0, remarks: `Refund received (${newRet.billnumber})` },
    { ledgerid: vendor.ledgerid, debit: 0, credit: refundAmt, remarks: `Vendor refund (${newRet.billnumber})` },
  ];

  const refundTrx = await Transaction.create({
    adminid: newRet.adminid,
    branchid: newRet.branchid,
    entrytype: "auto",
    source: { docmodel: "Payment", docid: newRet._id },
    transactiondate: newRet.returndate,
    narration: `Refund for Purchase Return ${newRet.billnumber}`,
    entries: refundEntries,
    totaldebit: refundAmt,
    totalcredit: refundAmt,
    createdby_id: userContext?.createdby_id,
    createdby_name: userContext?.createdby_name,
    createdby_type: userContext?.createdby_type,
  });

  await Payment.create({
    adminid: newRet.adminid,
    branchid: newRet.branchid,
    type: "refund",
    mode: newRet.paymenttype,
    partyid: vendor._id,
    ledgerid: vendor.ledgerid,
    invoices: [
      { invoiceid: newRet._id, invoicemodel: "PurchaseReturn", settledamount: refundAmt },
    ],
    amount: refundAmt,
    remarks: `Refund for Purchase Return ${newRet.billnumber}`,
    transactionid: refundTrx._id,
    createdby_id: userContext?.createdby_id,
    createdby_name: userContext?.createdby_name,
    createdby_type: userContext?.createdby_type,
  });
};

// ❌ DISABLED: Post "save" hook - resolvers now call adjustStockAndTransactions explicitly WITH userContext
// This prevents duplicate Transaction/Payment creation and ensures Created By is never N/A
// purchaseReturnSchema.post("save", async function (doc: any, next) {
//   try {
//     await (PurchaseReturn as any).adjustStockAndTransactions(null, doc);
//     next();
//   } catch (e: any) {
//     console.error("Purchase return auto error", e);
//     next(e);
//   }
// });

interface PurchaseReturnModel extends mongoose.Model<any> {
  adjustStockAndTransactions(oldDoc: any, newDoc: any, userContext?: any): Promise<void>;
}

export const PurchaseReturn = mongoose.model<any, PurchaseReturnModel>("PurchaseReturn", purchaseReturnSchema);
