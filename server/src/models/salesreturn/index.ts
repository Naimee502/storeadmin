// models/salesreturn.ts
//
// Sales Return (Credit Note) — mirrors SalesInvoice but with reversed stock
// and journal-entry signs. A return is always linked to a source SalesInvoice
// via `sourceInvoiceId`. The `refundMode` controls what happens to the money:
//   - "auto"     → create a refund Payment that credits Cash/Bank, debits party
//   - "advance"  → leave the customer ledger in credit (use as future advance)
//   - "skip"     → only post the journal entry; no Payment doc created
//
// Stock impact:  ADD returned qty back into ProductBranchStock.
// Accounting:    Debit "Sales Return" ledger + Output GST, Credit customer.

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

const salesReturnSchema = new mongoose.Schema(
  {
    // Link back to original Sales Invoice — required so quantities can be
    // validated against what was actually invoiced.
    sourceInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "SalesInvoice", required: true, index: true },
    sourceBillNumber: { type: String },

    salesmenid: { type: mongoose.Schema.Types.ObjectId, ref: "StaffAccount" },

    createdby_id: { type: mongoose.Schema.Types.ObjectId },
    createdby_name: { type: String },
    createdby_type: { type: String },

    paymenttype: { type: String, required: true },     // copied from source invoice
    partyacc: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },

    taxorsupplytype: { type: String, required: true },
    returndate: { type: String, required: true },      // YYYY-MM-DD
    billtype: { type: String, required: true },
    billnumber: { type: String },                       // CN-000001 auto-generated
    notes: { type: String },
    reason: { type: String },                           // why the return was made

    // "auto" | "advance" | "skip" — see file header
    refundMode: { type: String, default: "auto" },

    invoicetype: { type: String, default: "retail" },
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
        salesunitid: { type: mongoose.Schema.Types.ObjectId, ref: "Unit" },
        unitqty: { type: Number, default: 1 },
        gst: { type: Number, required: true },
        qty: { type: Number, required: true },        // ← returned qty
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
    status: { type: Boolean, default: true },          // soft-delete flag
  },
  { timestamps: true }
);

// 🔢 Auto-generate CN bill number when blank
salesReturnSchema.pre("save", async function (next) {
  if (!this.billnumber) {
    const last = await mongoose.model("SalesReturn")
      .findOne({ adminid: this.adminid })
      .sort({ createdAt: -1 });
    let nextNum = 1;
    if (last && (last as any).billnumber) {
      const num = parseInt(String((last as any).billnumber).replace(/\D/g, ""), 10);
      if (!isNaN(num)) nextNum = num + 1;
    }
    this.billnumber = `CN-${nextNum.toString().padStart(6, "0")}`;
  }
  next();
});

function ledgerId(x: any) {
  if (!x) return null;
  if (typeof x === "string") return x;
  return x._id || x.id || null;
}

salesReturnSchema.statics.adjustStockAndTransactions = async function (oldRet: any, newRet: any, userContext?: any) {
  const branchid = typeof newRet.branchid === "string"
    ? new mongoose.Types.ObjectId(newRet.branchid)
    : newRet.branchid;

  if (!branchid) return console.log("Branch ID missing on Sales Return");

  if (!newRet.autocreate) {
    console.log("Auto-create is disabled. Skipping stock and transactions for Sales Return.");
    return;
  }

  // ========================= STOCK ADJUSTMENT =========================
  // Sales Return ADDS stock back. If editing an existing return, first
  // remove the previously-restored qty, then add the new qty.
  if (!newRet.isservice) {
    if (oldRet) {
      for (const item of oldRet.productservice) {
        const product = await ProductService.findById(item.productserviceid);
        if (!product) continue;

        const variant = product.productvariants?.find(v => String(v._id) === String(item.variantid));
        const qtyBase = convertToBaseUnit(Number(item.qty) * Number(item.unitqty), item.salesunitid, variant);

        const stock = await ProductBranchStock.findOne({
          productid: item.productserviceid,
          variantid: item.variantid,
          branchid
        });
        if (!stock) continue;

        // Reverse the previous restoration → subtract.
        const newStock = stock.currentstock - qtyBase;
        const newAmt = newStock * stock.averagecost;

        await ProductBranchStock.updateOne(
          { productid: item.productserviceid, variantid: item.variantid, branchid },
          { $set: { currentstock: newStock, currentstockamount: newAmt, closingstock: newStock, closingstockamount: newAmt } }
        );
      }
    }

    // Add returned stock back
    for (const item of newRet.productservice) {
      const product = await ProductService.findById(item.productserviceid);
      if (!product) continue;

      const variant = product.productvariants?.find(v => String(v._id) === String(item.variantid));
      const qtyBase = convertToBaseUnit(Number(item.qty) * Number(item.unitqty), item.salesunitid, variant);

      const stock = await ProductBranchStock.findOne({
        productid: item.productserviceid,
        variantid: item.variantid,
        branchid
      });

      let newStock, newAmt;
      if (!stock) {
        newStock = qtyBase;
        newAmt = qtyBase * Number(item.rate);
      } else {
        newStock = stock.currentstock + qtyBase;
        newAmt = stock.currentstockamount + qtyBase * stock.averagecost;
      }

      await ProductBranchStock.updateOne(
        { productid: item.productserviceid, variantid: item.variantid, branchid },
        { $set: { currentstock: newStock, currentstockamount: newAmt, closingstock: newStock, closingstockamount: newAmt } },
        { upsert: true }
      );
    }
  }

  // ========================= JOURNAL ENTRIES =========================
  // Mirror sales invoice but flip debit/credit:
  //   Original: Cr Sales / Cr Output GST / Dr Customer
  //   Return:   Dr Sales Return / Dr Output GST / Cr Customer
  console.log("===== PROCESSING SALES RETURN JOURNAL ENTRIES =====");
  const entries: any[] = [];

  const customer = await Account.findById(newRet.partyacc).select("ledgerid state");
  if (!customer?.ledgerid) throw new Error("❌ Customer ledger missing!");

  const settings: any = await AdminSettings.getOrCreateForAdmin(newRet.adminid);
  const companyState = settings?.companyState || "gujarat";
  const partyState = customer?.state || "gujarat";
  const isIgst = companyState.toLowerCase() !== partyState.toLowerCase() && partyState !== "default";

  // Find or create a "Sales Return" ledger to debit. Mirror the pattern used
  // for "Output CGST" creation in salesInvoice.
  let salesReturnLedger = await AccountLedger.findOne({
    ledgername: "Sales Return",
    admin: newRet.adminid,
  });
  if (!salesReturnLedger) {
    const created = await getOrCreateAccount(
      "Sales Return",
      "other",
      newRet.adminid,
      newRet.branchid
    );
    salesReturnLedger = { _id: created.ledgerid } as any;
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
      const variant = product.productvariants.find(
        (v: any) => v?._id.toString() === item.variantid.toString()
      );
      variantName = variant?.name || null;
    }
    const remark = variantName
      ? `Sales Return of ${productName} (${variantName})`
      : `Sales Return of ${productName}`;

    if (taxable > 0 && salesReturnLedger?._id) {
      entries.push({
        ledgerid: salesReturnLedger._id,
        debit: taxable,
        credit: 0,
        remarks: remark,
      });
    }

    if (gstAmt > 0) {
      if (isIgst) {
        let igst = await AccountLedger.findOne({ ledgername: "Output IGST", admin: newRet.adminid });
        if (!igst) igst = await getOrCreateAccount("Output IGST", "liabilities", newRet.adminid, newRet.branchid) as any;
        if (igst) {
          entries.push({ ledgerid: (igst as any).ledgerid || igst._id, debit: gstAmt, credit: 0, remarks: `Reversal of IGST on ${productName}` });
        }
      } else {
        const cgst = await AccountLedger.findOne({ ledgername: "Output CGST", admin: newRet.adminid });
        const sgst = await AccountLedger.findOne({ ledgername: "Output SGST", admin: newRet.adminid });
        if (cgst && sgst) {
          const cgstAmt = parseFloat((gstAmt / 2).toFixed(2));
          const sgstAmt = parseFloat((gstAmt - cgstAmt).toFixed(2));
          entries.push({ ledgerid: cgst._id, debit: cgstAmt, credit: 0, remarks: `Reversal of CGST on ${productName}` });
          entries.push({ ledgerid: sgst._id, debit: sgstAmt, credit: 0, remarks: `Reversal of SGST on ${productName}` });
        } else {
          const gstAcc = await getOrCreateAccount("Output GST", "other", newRet.adminid, newRet.branchid);
          if (gstAcc?.ledgerid) {
            entries.push({ ledgerid: gstAcc.ledgerid, debit: gstAmt, credit: 0, remarks: `Reversal of GST on ${productName}` });
          }
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
          debit: charge.amount,
          credit: 0,
          remarks: charge.remarks || charge.ledgername || "Reversal of Other Charge",
        });

        if (charge.gstamount > 0) {
          if (isIgst) {
            let igst = await AccountLedger.findOne({ ledgername: "Output IGST", admin: newRet.adminid });
            if (!igst) igst = await getOrCreateAccount("Output IGST", "liabilities", newRet.adminid, newRet.branchid) as any;
            if (igst) {
              entries.push({ ledgerid: (igst as any).ledgerid || igst._id, debit: charge.gstamount, credit: 0, remarks: `Reversal of IGST on ${charge.ledgername || "Other Charge"}` });
            }
          } else {
            const cgst = await AccountLedger.findOne({ ledgername: "Output CGST", admin: newRet.adminid });
            const sgst = await AccountLedger.findOne({ ledgername: "Output SGST", admin: newRet.adminid });

            if (cgst && sgst) {
              const cgstAmt = parseFloat((charge.gstamount / 2).toFixed(2));
              const sgstAmt = parseFloat((charge.gstamount - cgstAmt).toFixed(2));

              entries.push({ ledgerid: cgst._id, debit: cgstAmt, credit: 0, remarks: `Reversal of CGST on ${charge.ledgername || "Other Charge"}` });
              entries.push({ ledgerid: sgst._id, debit: sgstAmt, credit: 0, remarks: `Reversal of SGST on ${charge.ledgername || "Other Charge"}` });
            } else {
              const gstAcc = await getOrCreateAccount("Output GST", "other", newRet.adminid, newRet.branchid);
              if (gstAcc?._id || gstAcc?.ledgerid) {
                entries.push({ ledgerid: gstAcc._id || gstAcc.ledgerid, debit: charge.gstamount, credit: 0, remarks: `Reversal of GST on ${charge.ledgername || "Other Charge"}` });
              }
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
        // Income reversal (Debit)
        entries.push({ ledgerid: roundOffLedger._id, debit: newRet.roundoff, credit: 0, remarks: "Reversal of Round Off" });
      } else {
        // Expense reversal (Credit)
        entries.push({ ledgerid: roundOffLedger._id, debit: 0, credit: Math.abs(newRet.roundoff), remarks: "Reversal of Round Off" });
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
      // Reversal of discount given -> Credit
      entries.push({ ledgerid: discLedger._id, debit: 0, credit: parseFloat(discountAmount.toFixed(2)), remarks: "Reversal of Invoice Discount" });
    }
  }

  // Credit customer ledger for the total return amount
  if (!customer?.ledgerid) throw new Error("❌ Customer ledger missing on Sales Return");

  entries.push({
    ledgerid: customer.ledgerid,
    debit: 0,
    credit: parseFloat(newRet.totalamount.toFixed(2)),
    remarks: `Sales Return ${newRet.billnumber} (against ${newRet.sourceBillNumber || "Invoice"})`,
  });

  // Balance check + nudge last entry if rounding leaves a 1-paisa gap
  const tempDebit = parseFloat(entries.reduce((t, e) => t + (e.debit || 0), 0).toFixed(2));
  const tempCredit = parseFloat(entries.reduce((t, e) => t + (e.credit || 0), 0).toFixed(2));
  if (tempDebit !== tempCredit) {
    const diff = parseFloat((tempDebit - tempCredit).toFixed(2));
    const last = entries[entries.length - 1];
    if (last.credit !== undefined) last.credit = parseFloat((last.credit + diff).toFixed(2));
  }

  const totalDebit = parseFloat(entries.reduce((t, e) => t + (e.debit || 0), 0).toFixed(2));
  const totalCredit = parseFloat(entries.reduce((t, e) => t + (e.credit || 0), 0).toFixed(2));
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Sales Return not balanced (Debit ${totalDebit} ≠ Credit ${totalCredit})`);
  }

  // ========================= SAVE/UPDATE TRANSACTION =========================
  let returnTrx = await Transaction.findOne({
    "source.docmodel": "SalesReturn",
    "source.docid": newRet._id,
  });

  if (returnTrx) {
    returnTrx.entries = entries;
    returnTrx.transactiondate = newRet.returndate;
    returnTrx.totaldebit = totalDebit;
    returnTrx.totalcredit = totalCredit;
    returnTrx.status = true;
    await returnTrx.save();
  } else {
    returnTrx = await Transaction.create({
      adminid: newRet.adminid,
      branchid: newRet.branchid,
      entrytype: "auto",
      source: { docmodel: "SalesReturn", docid: newRet._id },
      transactiondate: newRet.returndate,
      narration: `Sales Return ${newRet.billnumber}`,
      entries,
      totaldebit: totalDebit,
      totalcredit: totalCredit,
      createdby_id: userContext?.createdby_id,
      createdby_name: userContext?.createdby_name,
      createdby_type: userContext?.createdby_type,
    });
  }

  // ========================= REFUND PAYMENT =========================
  // Only run when refundMode is "auto" AND original payment was cash/bank.
  const payType = String(newRet.paymenttype).toLowerCase();
  const isCash = payType === "cash";
  const isBank = payType === "bank";
  const refundMode = String(newRet.refundMode || "auto").toLowerCase();

  // Always remove an old refund payment first if we're updating
  const existingRefund = await Payment.findOne({
    "invoices.invoiceid": newRet._id,
    "invoices.invoicemodel": "SalesReturn",
  });
  if (existingRefund) {
    await Transaction.deleteOne({ _id: existingRefund.transactionid });
    await Payment.deleteOne({ _id: existingRefund._id });
  }

  if (refundMode !== "auto") return;
  if (!isCash && !isBank) return;

  // Refund: Cash/Bank Cr, Customer Dr (reverses original receipt)
  const payLedgerName = isCash ? "Cash" : "Bank Account";
  let payLedger = await AccountLedger.findOne({ ledgername: payLedgerName, admin: newRet.adminid });
  if (!payLedger) {
    const created = await getOrCreateAccount(payLedgerName, "other", newRet.adminid, newRet.branchid);
    payLedger = { _id: created.ledgerid } as any;
  }

  const refundAmount = parseFloat(newRet.totalamount.toFixed(2));
  const refundEntries = [
    { ledgerid: payLedger?._id, debit: 0, credit: refundAmount, remarks: `Refund for ${newRet.billnumber}` },
    { ledgerid: customer.ledgerid, debit: refundAmount, credit: 0, remarks: `Customer refund (${newRet.billnumber})` },
  ];

  const refundTrx = await Transaction.create({
    adminid: newRet.adminid,
    branchid: newRet.branchid,
    entrytype: "auto",
    source: { docmodel: "Payment", docid: newRet._id },
    transactiondate: newRet.returndate,
    narration: `Refund for Sales Return ${newRet.billnumber}`,
    entries: refundEntries,
    totaldebit: refundAmount,
    totalcredit: refundAmount,
    createdby_id: userContext?.createdby_id,
    createdby_name: userContext?.createdby_name,
    createdby_type: userContext?.createdby_type,
  });

  await Payment.create({
    adminid: newRet.adminid,
    branchid: newRet.branchid,
    type: "refund",
    mode: newRet.paymenttype,
    partyid: customer._id,
    ledgerid: customer.ledgerid,
    invoices: [
      { invoiceid: newRet._id, invoicemodel: "SalesReturn", settledamount: refundAmount },
    ],
    amount: refundAmount,
    remarks: `Refund for Sales Return ${newRet.billnumber}`,
    transactionid: refundTrx._id,
    createdby_id: userContext?.createdby_id,
    createdby_name: userContext?.createdby_name,
    createdby_type: userContext?.createdby_type,
  });
};

// ❌ DISABLED: Post "save" hook - resolvers now call adjustStockAndTransactions explicitly WITH userContext
// This prevents duplicate Transaction/Payment creation and ensures Created By is never N/A
// salesReturnSchema.post("save", async function (doc: any, next) {
//   try {
//     await (SalesReturn as any).adjustStockAndTransactions(null, doc);
//     next();
//   } catch (e: any) {
//     console.error("Sales return auto error", e);
//     next(e);
//   }
// });

interface SalesReturnModel extends mongoose.Model<any> {
  adjustStockAndTransactions(oldDoc: any, newDoc: any, userContext?: any): Promise<void>;
}

export const SalesReturn = mongoose.model<any, SalesReturnModel>("SalesReturn", salesReturnSchema);
