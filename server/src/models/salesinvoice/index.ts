// models/salesinvoice.ts
import mongoose from 'mongoose';
import { ProductBranchStock } from '../productbranchstock';
import { ProductService } from '../products';
import { convertToBaseUnit } from '../../utils/unitconversation';
import { Transaction } from '../transactions';
import { Payment } from '../payments';
import { getOrCreateAccount } from '../../utils/helper';
import { AccountLedger } from '../accountledgers'; 

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
      unitqty: { type: Number, required: true },
      gst: { type: Number, required: true },
      qty: { type: Number, required: true },
      rate: { type: Number, required: true },
      amount: { type: Number, required: true },
      discount: { type: Number, default: 0 },
      salesaccountid: { type: mongoose.Schema.Types.Mixed }, // accept ObjectId or populated object
      purchaseaccountid: { type: mongoose.Schema.Types.Mixed },
      serviceaccountid: { type: mongoose.Schema.Types.Mixed },
    }
  ],
  isservice: { type: Boolean, default: false },
  status: { type: Boolean, default: true },
}, { timestamps: true });

/**
 * Helper - normalize ledger id from possibly populated object or string
 */
function ledgerIdFromField(field: any) {
  if (!field) return null;
  // if GraphQL returned AccountLedger object { __typename, id, ledgername }
  if (typeof field === 'object') {
    if (field.id) return String(field.id);
    if (field._id) return String(field._id);
  }
  // string id
  if (typeof field === 'string') return field;
  return null;
}

/**
 * Main static: adjust stock and create/update transactions & payments
 */
salesInvoiceSchema.statics.adjustStockAndTransactions = async function (oldInvoice: any, newInvoice: any) {
  const branchid = typeof newInvoice.branchid === 'string' ? new mongoose.Types.ObjectId(newInvoice.branchid) : newInvoice.branchid;
  if (!branchid) {
    console.warn('No branchid present on invoice; skipping stock/transaction adjustment.');
    return;
  }

  // 1) Stock adjustments (skip for services)
  if (!newInvoice.isservice) {
    // Revert old invoice stock (if exists)
    if (oldInvoice && oldInvoice.productservice?.length) {
      for (const item of oldInvoice.productservice) {
        try {
          const product = await ProductService.findById(item.productserviceid);
          if (!product) continue;

          const variant = product.productvariants?.find(v => String(v._id) === String(item.variantid));
          // qty * unitqty -> convert to base unit
          const qtyInBaseUnit = convertToBaseUnit(
            (Number(item.qty) || 0) * (Number(item.unitqty) || 0),
            item.salesunitid,
            variant
          );

          const stockDoc = await ProductBranchStock.findOne({
            productid: item.productserviceid,
            variantid: item.variantid,
            branchid
          });

          const averageCost = stockDoc?.averagecost || 0;

          await ProductBranchStock.updateOne(
            { productid: item.productserviceid, variantid: item.variantid, branchid },
            {
              $inc: {
                currentstock: qtyInBaseUnit,
                currentstockamount: qtyInBaseUnit * averageCost
              }
            },
            { upsert: true }
          );
        } catch (err: any) {
          console.error('Error reverting stock for old invoice item', err);
        }
      }
    }

    // Apply new invoice stock (deduct)
    if (newInvoice.productservice?.length) {
      for (const item of newInvoice.productservice) {
        try {
          const product = await ProductService.findById(item.productserviceid);
          if (!product) continue;

          const variant = product.productvariants?.find(v => String(v._id) === String(item.variantid));

          const qtyInBaseUnit = convertToBaseUnit(
            (Number(item.qty) || 0) * (Number(item.unitqty) || 0),
            item.salesunitid,
            variant
          );

          const stockDoc = await ProductBranchStock.findOne({
            productid: item.productserviceid,
            variantid: item.variantid,
            branchid
          });

          const averageCost = stockDoc?.averagecost || 0;

          await ProductBranchStock.updateOne(
            { productid: item.productserviceid, variantid: item.variantid, branchid },
            {
              $inc: {
                currentstock: -qtyInBaseUnit,
                currentstockamount: -(qtyInBaseUnit * averageCost)
              }
            },
            { upsert: true }
          );
        } catch (err: any) {
          console.error('Error applying stock for new invoice item', err);
        }
      }
    }
  }

  // 2) Build Transaction entries for the invoice
  const transactionEntries: any[] = [];

  // For balanced check
  let totalCredits = 0;
  let totalDebits = 0;

  // For each product line: credit Sales ledger with taxable amount; credit GST ledger(s) with GST amount
  for (const item of newInvoice.productservice || []) {
    try {
      // Resolve sales ledger id (could be populated object or id string)
      const salesLedgerId = ledgerIdFromField(item.salesaccountid) || ledgerIdFromField(item.serviceaccountid);
      // taxable amount = (rate - discount) * qty
      const rate = Number(item.rate || 0);
      const discount = Number(item.discount || 0);
      const qty = Number(item.qty || 0);
      const taxableAmount = (rate - discount) * qty;

      if (salesLedgerId && taxableAmount && taxableAmount !== 0) {
        transactionEntries.push({
          accountid: new mongoose.Types.ObjectId(salesLedgerId),
          debit: 0,
          credit: taxableAmount,
          productserviceid: item.productserviceid,
          variantid: item.variantid,
        });
        totalCredits += taxableAmount;
      } else {
        console.warn('Sales ledger or taxable amount missing for item', item);
      }

      // GST handling: compute gst amount and post to GST ledger(s)
      const gstPercent = Number(item.gst || 0);
      if (gstPercent > 0) {
        const gstAmount = (taxableAmount * gstPercent) / 100;

        // Attempt to post to Output CGST / Output SGST (split) for intrastate
        // Here we assume intrastate (split equally). If you need interstate (IGST), modify accordingly.
        const half = gstAmount / 2;

        // Try to find CGST and SGST ledgers
        const cgstLedger = await AccountLedger.findOne({ ledgername: 'Output CGST', admin: newInvoice.adminid });
        const sgstLedger = await AccountLedger.findOne({ ledgername: 'Output SGST', admin: newInvoice.adminid });

        if (cgstLedger && sgstLedger) {
          // credit half to CGST, half to SGST
          transactionEntries.push({
            accountid: cgstLedger._id,
            debit: 0,
            credit: half,
            productserviceid: item.productserviceid,
            variantid: item.variantid,
          });
          transactionEntries.push({
            accountid: sgstLedger._id,
            debit: 0,
            credit: half,
            productserviceid: item.productserviceid,
            variantid: item.variantid,
          });
          totalCredits += gstAmount;
        } else {
          // Fallback: use getOrCreateAccount (legacy) or a generic GST account
          const fallbackGst = await getOrCreateAccount('GST Account', 'other', newInvoice.adminid, newInvoice.branchid);
          if (fallbackGst && fallbackGst._id) {
            transactionEntries.push({
              accountid: fallbackGst._id,
              debit: 0,
              credit: gstAmount,
              productserviceid: item.productserviceid,
              variantid: item.variantid,
            });
            totalCredits += gstAmount;
          } else {
            console.warn('Unable to find/create GST ledger. GST amount skipped in transactions for item:', item);
          }
        }
      }
    } catch (err: any) {
      console.error('Error processing transaction entries for item', item, err);
    }
  }

  // Party (customer) debit = total invoice amount (newInvoice.totalamount)
  try {
    const partyId = ledgerIdFromField(newInvoice.partyacc) || newInvoice.partyacc;
    const totalAmountNum = Number(newInvoice.totalamount || 0);

    if (!partyId) {
      console.warn('No party account id found on invoice; unable to add party debit entry.');
    } else {
      transactionEntries.push({
        accountid: new mongoose.Types.ObjectId(partyId),
        debit: totalAmountNum,
        credit: 0,
        remarks: `Sales Invoice #${newInvoice.billnumber}`,
      });
      totalDebits += totalAmountNum;
    }
  } catch (err: any) {
    console.error('Error adding party debit entry', err);
  }

  // Now create/update Transaction document representing this invoice
  let transaction = await Transaction.findOne({
    'source.docmodel': 'SalesInvoice',
    'source.docid': newInvoice._id
  });

  if (transaction) {
    transaction.adminid = newInvoice.adminid;
    transaction.branchid = newInvoice.branchid;
    transaction.transactiondate = newInvoice.billdate;
    transaction.narration = `Sales Invoice #${newInvoice.billnumber}`;
    transaction.entries = transactionEntries;
    transaction.status = true;
    await transaction.save();
  } else {
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

  // 3) Payment handling
  // If a payment record exists for this invoice, update it; else if paymenttype !== credit, create a payment and a separate receipt transaction (cash/bank)
  try {
    const payment = await Payment.findOne({ 'invoices.invoiceid': newInvoice._id });
    if (payment) {
      payment.amount = newInvoice.totalamount;
      if (payment.invoices && payment.invoices[0]) {
        payment.invoices[0].settledamount = newInvoice.totalamount;
      }
      payment.transactionid = transaction._id;
      await payment.save();
    } else if (newInvoice.paymenttype && String(newInvoice.paymenttype).toLowerCase() !== 'credit') {
      // create payment (receipt)
      const createdPayment = await Payment.create({
        adminid: newInvoice.adminid,
        branchid: newInvoice.branchid,
        type: "receipt",
        mode: newInvoice.paymenttype,
        partyid: ledgerIdFromField(newInvoice.partyacc) || newInvoice.partyacc,
        invoices: [{ invoiceid: newInvoice._id, invoicemodel: "SalesInvoice", settledamount: newInvoice.totalamount }],
        amount: newInvoice.totalamount,
        remarks: `Payment against Sales Invoice #${newInvoice.billnumber}`,
        transactionid: transaction._id,
      });

      // Also create a separate transaction for the payment: debit Cash/Bank, credit Customer
      try {
        const paymentLedgerName = (String(newInvoice.paymenttype).toLowerCase() === 'cash') ? 'Cash' : 'Bank Account';
        let paymentLedger = await AccountLedger.findOne({ ledgername: paymentLedgerName, admin: newInvoice.adminid });

        // Fallback: try generic Cash ledger through getOrCreateAccount
        if (!paymentLedger) {
          const fallback = await getOrCreateAccount(paymentLedgerName, 'other', newInvoice.adminid, newInvoice.branchid);
          if (fallback && fallback._id) {
            paymentLedger = { _id: fallback._id } as any;
          }
        }

        const paymentTxnEntries: any[] = [];
        const payAmount = Number(newInvoice.totalamount || 0);

        if (paymentLedger && paymentLedger._id) {
          paymentTxnEntries.push({
            accountid: new mongoose.Types.ObjectId(paymentLedger._id),
            debit: payAmount,
            credit: 0,
            remarks: `Payment received for Sales Invoice #${newInvoice.billnumber}`
          });
        } else {
          console.warn('No Cash/Bank ledger found for payment transaction. Skipping creation of payment transaction entry for Cash/Bank.');
        }

        const partyLedgerId = ledgerIdFromField(newInvoice.partyacc) || newInvoice.partyacc;
        if (partyLedgerId) {
          paymentTxnEntries.push({
            accountid: new mongoose.Types.ObjectId(partyLedgerId),
            debit: 0,
            credit: payAmount,
            remarks: `Payment received for Sales Invoice #${newInvoice.billnumber}`
          });
        } else {
          console.warn('No party ledger found to credit payment transaction.');
        }

        if (paymentTxnEntries.length > 0) {
          await Transaction.create({
            adminid: newInvoice.adminid,
            branchid: newInvoice.branchid,
            entrytype: 'auto',
            source: { docmodel: 'Payment', docid: createdPayment._id },
            transactiondate: newInvoice.billdate,
            narration: `Payment against Sales Invoice #${newInvoice.billnumber}`,
            entries: paymentTxnEntries,
          });
        }
      } catch (err: any) {
        console.error('Error creating payment transaction', err);
      }
    }
  } catch (err: any) {
    console.error('Error handling payment for invoice', err);
  }

};

salesInvoiceSchema.post('save', async function (doc: any, next) {
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
