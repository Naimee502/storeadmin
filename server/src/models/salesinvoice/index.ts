import mongoose from 'mongoose';
import { ProductBranchStock } from '../productbranchstock';
import { ProductService } from '../products';
import { convertToBaseUnit } from '../../utils/unitconversation';
import { Transaction } from '../transactions';
import { Payment } from '../payments';

const salesInvoiceSchema = new mongoose.Schema({
  salesmenid: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesmenAccount', required: true },
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
  branchid: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  productservice: [
    {
      productserviceid: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductService', required: true },
      variantid: { type: mongoose.Schema.Types.ObjectId },
      salesunitid: { type: mongoose.Schema.Types.ObjectId },
      gst: { type: Number, required: true },
      qty: { type: Number, required: true },
      rate: { type: Number, required: true },
      amount: { type: Number, required: true },
      discount: { type: Number, default: 0 },
      salesaccountid: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
      purchaseaccountid: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
      serviceaccountid: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    }
  ],
  isservice: { type: Boolean, default: false },
  status: { type: Boolean, default: true },
}, { timestamps: true });

salesInvoiceSchema.statics.adjustStockAndTransactions = async function(oldInvoice: any, newInvoice: any) {
  const branchid = typeof newInvoice.branchid === 'string' ? new mongoose.Types.ObjectId(newInvoice.branchid) : newInvoice.branchid;
  if (!branchid) return;

  // 1️⃣ Stock Adjustment (skip for service invoices)
  if (!newInvoice.isservice) {
    // Revert old invoice stock
    if (oldInvoice) {
      for (const item of oldInvoice.productservice) {
        const product = await ProductService.findById(item.productserviceid);
        if (!product) continue;
        const variant = product.productvariants?.find(v => String(v._id) === String(item.variantid));
        const qtyInBaseUnit = convertToBaseUnit(item.qty, item.salesunitid, variant);
        await ProductBranchStock.updateOne(
          { productid: item.productserviceid, variantid: item.variantid, branchid },
          { $inc: { currentstock: qtyInBaseUnit } },
          { upsert: true }
        );
      }
    }

    // Apply new invoice stock
    for (const item of newInvoice.productservice) {
      const product = await ProductService.findById(item.productserviceid);
      if (!product) continue;
      const variant = product.productvariants?.find(v => String(v._id) === String(item.variantid));
      const qtyInBaseUnit = convertToBaseUnit(item.qty, item.salesunitid, variant);
      await ProductBranchStock.updateOne(
        { productid: item.productserviceid, variantid: item.variantid, branchid },
        { $inc: { currentstock: -qtyInBaseUnit } },
        { upsert: true }
      );
    }
  }

  // 2️⃣ Transactions
  const transactionEntries: any[] = [];
  transactionEntries.push({
    accountid: newInvoice.partyacc,
    debit: newInvoice.totalamount,
    credit: 0,
    remarks: `Sales Invoice #${newInvoice.billnumber}`,
  });

  newInvoice.productservice.forEach((item: any) => {
    const salesAcc = item.salesaccountid || item.serviceaccountid;
    if (salesAcc && item.amount) {
      transactionEntries.push({
        accountid: salesAcc,
        debit: 0,
        credit: item.amount,
        productserviceid: item.productserviceid,
        variantid: item.variantid,
      });
    }
    if (item.gst && item.gst > 0) {
      const gstAccountId = "GST_ACCOUNT_ID"; // replace with actual GST account id
      transactionEntries.push({ accountid: gstAccountId, debit: 0, credit: item.gst });
    }
  });

  let transaction = await Transaction.findOne({
    'source.docmodel': 'SalesInvoice',
    'source.docid': newInvoice._id
  });

  if (transaction) {
    // Update existing transaction
    transaction.adminid = newInvoice.adminid;
    transaction.branchid = newInvoice.branchid;
    transaction.transactiondate = newInvoice.billdate;
    transaction.narration = `Sales Invoice #${newInvoice.billnumber}`;
    transaction.entries = transactionEntries;
    transaction.status = true;
    await transaction.save();
  } else {
    // Create new transaction if none exists
    transaction = await Transaction.create({
      adminid: newInvoice.adminid,
      branchid: newInvoice.branchid,
      entrytype: "auto",
      source: { docmodel: "SalesInvoice", docid: newInvoice._id },
      transactiondate: newInvoice.billdate,
      narration: `Sales Invoice #${newInvoice.billnumber}`,
      entries: transactionEntries,
    });
  }

  // 3️⃣ Payment Handling
  const payment = await Payment.findOne({ 'invoices.invoiceid': newInvoice._id });
  if (payment) {
    payment.amount = newInvoice.totalamount;
    payment.invoices[0].settledamount = newInvoice.totalamount;
    payment.transactionid = transaction._id;
    await payment.save();
  } else if (newInvoice.paymenttype !== "credit") {
    await Payment.create({
      adminid: newInvoice.adminid,
      branchid: newInvoice.branchid,
      type: "receipt",
      mode: newInvoice.paymenttype,
      partyid: newInvoice.partyacc,
      invoices: [{ invoiceid: newInvoice._id, invoicemodel: "SalesInvoice", settledamount: newInvoice.totalamount }],
      amount: newInvoice.totalamount,
      remarks: `Payment against Sales Invoice #${newInvoice.billnumber}`,
      transactionid: transaction._id,
    });
  }
};

// POST-SAVE hook: always adjust stock and transactions
salesInvoiceSchema.post('save', async function(doc: any, next) {
  try {
    await (SalesInvoice as any).adjustStockAndTransactions(null, doc);
    next();
  } catch (err: any) {
    console.error('Error in SalesInvoice post-save hook:', err);
    next(err);
  }
});

interface SalesInvoiceModel extends mongoose.Model<any> {
  adjustStockAndTransactions: (oldInvoice: any, newInvoice: any) => Promise<void>;
}

export const SalesInvoice = mongoose.model<any, SalesInvoiceModel>('SalesInvoice', salesInvoiceSchema);
