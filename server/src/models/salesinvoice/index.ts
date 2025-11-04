// models/salesinvoice.ts
import mongoose from "mongoose";
import { ProductBranchStock } from "../productbranchstock";
import { ProductService } from "../products";
import { convertToBaseUnit } from "../../utils/unitconversation";
import { Transaction } from "../transactions";
import { Payment } from "../payments";
import { getOrCreateAccount } from "../../utils/helper";
import { AccountLedger } from "../accountledgers";
import { Account } from "../accounts";

const salesInvoiceSchema = new mongoose.Schema(
  {
    salesmenid: { type: mongoose.Schema.Types.ObjectId, ref: "SalesmenAccount", required: true },
    paymenttype: { type: String, required: true },
    partyacc: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },

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
        salesunitid: { type: mongoose.Schema.Types.ObjectId },
        unitqty: { type: Number, default: 1 },
        gst: { type: Number, required: true },
        qty: { type: Number, required: true },
        rate: { type: Number, required: true },
        amount: { type: Number, required: true },
        discount: { type: Number, default: 0 },
        salesaccountid: mongoose.Schema.Types.Mixed,
        purchaseaccountid: mongoose.Schema.Types.Mixed,
        serviceaccountid: mongoose.Schema.Types.Mixed
      }
    ],

    isservice: { type: Boolean, default: false },
    status: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// ✅ Convert ledger reference
function ledgerId(x: any) {
  if (!x) return null;
  if (typeof x === "string") return x;
  return x._id || x.id || null;
}

salesInvoiceSchema.statics.adjustStockAndTransactions = async function (oldInv: any, newInv: any) {
  const branchid =
    typeof newInv.branchid === "string"
      ? new mongoose.Types.ObjectId(newInv.branchid)
      : newInv.branchid;

  if (!branchid) return;

  // ============================
  // 📦 STOCK ADJUSTMENT (Weighted Avg like Purchase)
  // ============================
  if (!newInv.isservice) {

    // 1️⃣ REVERT OLD INVOICE STOCK
    if (oldInv) {
      for (const item of oldInv.productservice) {
        const product = await ProductService.findById(item.productserviceid);
        if (!product) continue;

        const variant = product.productvariants?.find(v => String(v._id) === String(item.variantid));

        const qtyBase = convertToBaseUnit(
          Number(item.qty) * Number(item.unitqty),
          item.salesunitid,
          variant
        );

        const stock = await ProductBranchStock.findOne({
          productid: item.productserviceid,
          variantid: item.variantid,
          branchid
        });

        if (!stock) continue;

        const newCurrentStock = stock.currentstock + qtyBase;
        const newCurrentStockAmount = newCurrentStock * stock.averagecost;

        await ProductBranchStock.updateOne(
          { productid: item.productserviceid, variantid: item.variantid, branchid },
          {
            $set: {
              currentstock: newCurrentStock,
              currentstockamount: newCurrentStockAmount,
              closingstock: newCurrentStock,
              closingstockamount: newCurrentStockAmount
            }
          }
        );
      }
    }

    // 2️⃣ APPLY NEW INVOICE STOCK
    for (const item of newInv.productservice) {
      const product = await ProductService.findById(item.productserviceid);
      if (!product) continue;

      const variant = product.productvariants?.find(v => String(v._id) === String(item.variantid));

      const qtyBase = convertToBaseUnit(
        Number(item.qty) * Number(item.unitqty),
        item.salesunitid,
        variant
      );

      const stock = await ProductBranchStock.findOne({
        productid: item.productserviceid,
        variantid: item.variantid,
        branchid
      });

      let newCurrentStock, newCurrentStockAmount;

      // Sales uses AVG cost from stock table (not rate)
      if (!stock) {
        newCurrentStock = 0 - qtyBase;
        newCurrentStockAmount = 0;
      } else {
        const oldQty = stock.currentstock;
        const oldAmount = stock.currentstockamount;

        newCurrentStock = oldQty - qtyBase;
        newCurrentStockAmount = oldAmount - (qtyBase * stock.averagecost);
      }

      await ProductBranchStock.updateOne(
        { productid: item.productserviceid, variantid: item.variantid, branchid },
        {
          $set: {
            currentstock: newCurrentStock,
            currentstockamount: newCurrentStockAmount,
            closingstock: newCurrentStock,
            closingstockamount: newCurrentStockAmount
          }
        },
        { upsert: true }
      );
    }
  }

  // ============================
  // 💼 SALES LEDGER ENTRIES
  // ============================
  const entries: any[] = [];
  let totalDebit = 0;

  for (const item of newInv.productservice) {
    const qty = Number(item.qty);
    const rate = Number(item.rate);
    const discount = Number(item.discount);
    const taxable = (rate - discount) * qty;

    const salesLedgerId = ledgerId(item.salesaccountid) || ledgerId(item.serviceaccountid);
    if (salesLedgerId && taxable > 0) {
      entries.push({ ledgerid: salesLedgerId, debit: 0, credit: taxable });
      totalDebit += taxable;
    }

    const gst = Number(item.gst);
    if (gst > 0) {
      const gstAmt = (taxable * gst) / 100;
      totalDebit += gstAmt;

      const cgst = await AccountLedger.findOne({ ledgername: "Output CGST", admin: newInv.adminid });
      const sgst = await AccountLedger.findOne({ ledgername: "Output SGST", admin: newInv.adminid });

      if (cgst && sgst) {
        entries.push({ ledgerid: cgst._id, credit: gstAmt / 2, debit: 0 });
        entries.push({ ledgerid: sgst._id, credit: gstAmt / 2, debit: 0 });
      } else {
        const gstAcc = await getOrCreateAccount("Output GST", "other", newInv.adminid, newInv.branchid);
        entries.push({ ledgerid: gstAcc._id, credit: gstAmt, debit: 0 });
      }
    }
  }

  const customer = await Account.findById(newInv.partyacc).select("ledgerid");
  if (!customer?.ledgerid) throw new Error("Customer ledger missing");

  entries.push({
    ledgerid: customer.ledgerid,
    debit: newInv.totalamount,
    credit: 0,
    remarks: `Sales Invoice #${newInv.billnumber}`
  });

  // ✅ Upsert Transaction (Journal)
  let invoiceTrx = await Transaction.findOne({
    "source.docmodel": "SalesInvoice",
    "source.docid": newInv._id
  });

  if (invoiceTrx) {
    invoiceTrx.entries = entries;
    invoiceTrx.transactiondate = newInv.billdate;
    invoiceTrx.totaldebit = newInv.totalamount;
    invoiceTrx.totalcredit = newInv.totalamount;
    invoiceTrx.status = true;
    await invoiceTrx.save();
  } else {
    invoiceTrx = await Transaction.create({
      adminid: newInv.adminid,
      branchid: newInv.branchid,
      entrytype: "auto",
      source: { docmodel: "SalesInvoice", docid: newInv._id },
      transactiondate: newInv.billdate,
      narration: `Sales Invoice #${newInv.billnumber}`,
      entries,
      totaldebit: newInv.totalamount,
      totalcredit: newInv.totalamount
    });
  }

  // ============================
  // 💰 PAYMENT LOGIC (same as purchase)
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
    "invoices.invoicemodel": "SalesInvoice"
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
    { ledgerid: payLedger?._id, debit: newInv.totalamount, credit: 0 },
    { ledgerid: customer.ledgerid, debit: 0, credit: newInv.totalamount }
  ];

  if (oldPayment) {
    oldPayment.mode = newInv.paymenttype;
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
          narration: `Receipt for Sales Invoice #${newInv.billnumber}`
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
    narration: `Receipt for Sales Invoice #${newInv.billnumber}`,
    entries: paymentEntries,
    totaldebit: newInv.totalamount,
    totalcredit: newInv.totalamount
  });

  await Payment.create({
    adminid: newInv.adminid,
    branchid: newInv.branchid,
    type: "receipt",
    mode: newInv.paymenttype,
    partyid: customer._id,
    invoices: [{ invoiceid: invId, invoicemodel: "SalesInvoice", settledamount: newInv.totalamount }],
    amount: newInv.totalamount,
    remarks: `Receipt for Sales Invoice #${newInv.billnumber}`,
    transactionid: payTrx._id
  });
};

// ✅ After Save Auto Trigger
salesInvoiceSchema.post("save", async function (doc: any, next) {
  try {
    await (SalesInvoice as any).adjustStockAndTransactions(null, doc);
    next();
  } catch (e: any) {
    console.error("Sales invoice auto error", e);
    next(e);
  }
});

interface SalesInvoiceModel extends mongoose.Model<any> {
  adjustStockAndTransactions(oldInvoice: any, newInvoice: any): Promise<void>;
}

export const SalesInvoice = mongoose.model<any, SalesInvoiceModel>("SalesInvoice", salesInvoiceSchema);
