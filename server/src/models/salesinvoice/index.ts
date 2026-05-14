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
import { StaffAccount } from "../staffaccounts";
import { AdminSettings } from "../adminsettings";

const salesInvoiceSchema = new mongoose.Schema(
  {
    salesmenid: { type: mongoose.Schema.Types.ObjectId, ref: "StaffAccount" },
    
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

salesInvoiceSchema.pre("save", async function (next) {
  if (!this.billnumber) {
    const lastInvoice = await mongoose.model("SalesInvoice").findOne({ adminid: this.adminid }).sort({ createdAt: -1 });
    let nextNum = 1;
    if (lastInvoice && lastInvoice.billnumber) {
      const lastNum = parseInt(lastInvoice.billnumber, 10);
      if (!isNaN(lastNum)) nextNum = lastNum + 1;
    }
    this.billnumber = nextNum.toString().padStart(6, "0");
  }
  next();
});

function ledgerId(x: any) {
  if (!x) return null;
  if (typeof x === "string") return x;
  return x._id || x.id || null;
}

salesInvoiceSchema.statics.adjustStockAndTransactions = async function (oldInv: any, newInv: any) {
  const branchid = typeof newInv.branchid === "string"
    ? new mongoose.Types.ObjectId(newInv.branchid)
    : newInv.branchid;

  if (!branchid) return console.log("Branch ID missing");

  // Resolve auto-posting flags. Per-invoice `autocreate` still wins (legacy
  // override), but when omitted we fall back to org-wide AdminSettings so
  // users don't toggle two checkboxes on every save. Defaults to TRUE so
  // first-time users get accounting wired without setup steps.
  const settings: any = await AdminSettings.getOrCreateForAdmin(newInv.adminid);
  const wantsLedger =
    newInv.autocreate ??
    settings?.autoCreateLedgerOnSalesInvoice ?? true;
  const wantsStock =
    newInv.autocreate ??
    settings?.autoCreateStockOnSalesInvoice ?? true;

  if (!wantsLedger && !wantsStock) {
    console.log("Auto-create disabled (per-invoice or AdminSettings). Skipping.");
    return;
  }
  
  // ========================= STOCK ADJUSTMENT =========================
  if (!newInv.isservice) {
    // Restore old stock if invoice updated
    if (oldInv) {
      for (const item of oldInv.productservice) {
        const product = await ProductService.findById(item.productserviceid);
        if (!product) {
          console.log("Old product not found:", item.productserviceid);
          continue;
        }

        const variant = product.productvariants?.find(v => String(v._id) === String(item.variantid));
        const qtyBase = convertToBaseUnit(Number(item.qty) * Number(item.unitqty), item.salesunitid, variant);

        const stock = await ProductBranchStock.findOne({
          productid: item.productserviceid,
          variantid: item.variantid,
          branchid
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

    // Deduct new stock
    for (const item of newInv.productservice) {
      const product = await ProductService.findById(item.productserviceid);
      if (!product) {
        console.log("New product not found:", item.productserviceid);
        continue;
      }

      const variant = product.productvariants?.find(v => String(v._id) === String(item.variantid));
      const qtyBase = convertToBaseUnit(Number(item.qty) * Number(item.unitqty), item.salesunitid, variant);

      const stock = await ProductBranchStock.findOne({
        productid: item.productserviceid,
        variantid: item.variantid,
        branchid
      });

      let newStock, newAmt;
      if (!stock) {
        newStock = 0 - qtyBase;
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

  console.log("===== PROCESSING JOURNAL ENTRIES START =====");
  const entries: any[] = [];
  let lineIndex = 1;

  for (const item of newInv.productservice) {
    const qty = Number(item.qty);
    const rate = Number(item.rate);
    const discount = Number(item.discount);
    const taxable = parseFloat(((rate - discount) * qty).toFixed(2));
    const gstRate = Number(item.gst);
    const gstAmt = parseFloat(((taxable * gstRate) / 100).toFixed(2));

    // ===================== SALES LEDGER =======================
    const salesLedger =
      ledgerId(item.salesaccountid) || ledgerId(item.serviceaccountid);

    const product = await ProductService.findById(item.productserviceid);
    const productName = product?.name || "Unknown Product";
    let variantName = null;
    if (item.variantid && product?.productvariants?.length) {
      const variant = product.productvariants.find(
        (v:any) => v?._id.toString() === item.variantid.toString()
      );
      variantName = variant?.name || null;
    }

    const saleRemark = variantName
      ? `Sale of ${productName} (${variantName})`
      : `Sale of ${productName}`;

    if (salesLedger && taxable > 0) {
      const creditValue = taxable;
      entries.push({
        ledgerid: salesLedger,
        debit: 0,
        credit: creditValue,
        remarks: saleRemark,
      });
    }

    // ===================== GST LEDGERS =========================
    if (gstAmt > 0) {
      const cgst = await AccountLedger.findOne({
        ledgername: "Output CGST",
        admin: newInv.adminid,
      });

      const sgst = await AccountLedger.findOne({
        ledgername: "Output SGST",
        admin: newInv.adminid,
      });

      if (cgst && sgst) {
        const cgstAmt = parseFloat((gstAmt / 2).toFixed(2));
        const sgstAmt = parseFloat((gstAmt - cgstAmt).toFixed(2));

        entries.push({
          ledgerid: cgst._id,
          debit: 0,
          credit: cgstAmt,
          remarks: `CGST on ${productName}`,
        });

        entries.push({
          ledgerid: sgst._id,
          debit: 0,
          credit: sgstAmt,
          remarks: `SGST on ${productName}`
        });
      } else {
        const gstAcc = await getOrCreateAccount(
          "Output GST",
          "other",
          newInv.adminid,
          newInv.branchid
        );

        if (gstAcc?._id) {
          entries.push({
            ledgerid: gstAcc._id,
            debit: 0,
            credit: gstAmt,
            remarks: `GST on ${productName}`,
          });
        }
      }
    }

    lineIndex++;
  }

  // ===================== CUSTOMER LEDGER ==========================
  const customer = await Account.findById(newInv.partyacc).select("ledgerid");
  if (!customer?.ledgerid) throw new Error("❌ Customer ledger missing!");

  entries.push({
    ledgerid: customer.ledgerid,
    debit: parseFloat(newInv.totalamount.toFixed(2)),
    credit: 0,
    remarks: `Sales Invoice #${newInv.billnumber}`,
  });

  // ===================== SALESMAN COMMISSION ======================
  if (newInv.salesmenid) {
    const salesman = await StaffAccount.findById(newInv.salesmenid).select(
      "ledgerid commission name"
    );

    if (!salesman?.ledgerid) throw new Error("❌ Salesman ledger missing");

    const taxableSubtotal = newInv.productservice.reduce((sum:any, item:any) => {
      return sum + (Number(item.rate) - Number(item.discount)) * Number(item.qty);
    }, 0);

    const commissionAmount = parseFloat(
      ((taxableSubtotal * Number(salesman.commission)) / 100).toFixed(2)
    );

    if (commissionAmount > 0) {
      let commissionExpenseLedger = await AccountLedger.findOne({
        ledgername: "Salesman Commission Expense",
        admin: newInv.adminid,
      });

      if (!commissionExpenseLedger) {
        const AccountGroup = mongoose.model("AccountGroup");

        let expenseGroup = await AccountGroup.findOne({
          accountgroupname: "Commission Expense",
          admin: newInv.adminid,
        });

        if (!expenseGroup) {
          expenseGroup = await AccountGroup.create({
            admin: newInv.adminid,
            accountgroupname: "Commission Expense",
            category: "expenses",
            status: true,
          });
        }

        commissionExpenseLedger = await AccountLedger.create({
          admin: newInv.adminid,
          accountgroupid: expenseGroup._id,
          ledgername: "Salesman Commission Expense",
          openingbalance: 0,
          openingbalancetype: "debit",
          status: true,
        });
      }

      // Debit Expense
      entries.push({
        ledgerid: commissionExpenseLedger._id,
        debit: commissionAmount,
        credit: 0,
        remarks: `Commission for ${salesman.name}`,
      });

      // Credit Salesman
      entries.push({
        ledgerid: salesman.ledgerid,
        debit: 0,
        credit: commissionAmount,
        remarks: `Sales Commission`,
      });
    }
  }

  // ===================== BALANCE CHECK ======================
  // ===================== FINAL BALANCE ADJUSTMENT ======================
  const tempDebit = parseFloat(entries.reduce((t, e) => t + (e.debit || 0), 0).toFixed(2));
  const tempCredit = parseFloat(entries.reduce((t, e) => t + (e.credit || 0), 0).toFixed(2));

  if (tempDebit !== tempCredit) {
    const diff = parseFloat((tempDebit - tempCredit).toFixed(2));
    // Adjust the last entry's credit to balance
    const lastEntry = entries[entries.length - 1];
    if (lastEntry.credit !== undefined) {
      lastEntry.credit = parseFloat((lastEntry.credit + diff).toFixed(2));
    } else if (lastEntry.debit !== undefined) {
      lastEntry.debit = parseFloat((lastEntry.debit - diff).toFixed(2));
    }
  }

  const totalDebitSum = parseFloat(entries.reduce((t, e) => t + (e.debit || 0), 0).toFixed(2));
  const totalCreditSum = parseFloat(entries.reduce((t, e) => t + (e.credit || 0), 0).toFixed(2));

  console.log("🔵 Total Debit :", totalDebitSum);
  console.log("🔴 Total Credit:", totalCreditSum);

  if (Math.abs(totalDebitSum - totalCreditSum) > 0.01) {
    console.error("❌ Transaction not balanced even after adjustment!");
    throw new Error(`Transaction not balanced (Debit ${totalDebitSum} ≠ Credit ${totalCreditSum})`);
  }

  // ===================== SAVE / UPDATE TRANSACTION ======================
  let invoiceTrx = await Transaction.findOne({
    "source.docmodel": "SalesInvoice",
    "source.docid": newInv._id,
  });

  if (invoiceTrx) {
    console.log("🔄 Updating existing transaction...");
    invoiceTrx.entries = entries;
    invoiceTrx.transactiondate = newInv.billdate;
    invoiceTrx.totaldebit = totalDebitSum;
    invoiceTrx.totalcredit = totalCreditSum;
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
      totaldebit: totalDebitSum,
      totalcredit: totalCreditSum,
    });
  }

  // ====================== PAYMENT HANDLING ======================
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
    "invoices.invoicemodel": "SalesInvoice",
  });

  // ------------------------- CREDIT CASE -------------------------
  if (isCredit) {
    if (oldPayment) {
      console.log("➡ Removing old payment and its transaction...");
      await Transaction.deleteOne({ _id: oldPayment.transactionid });
      await Payment.deleteOne({ _id: oldPayment._id });
      console.log("✔ Old payment removed.");
    }

    return;
  }

  // ------------------------- PAYMENT LEDGER -------------------------
  const payLedgerName = isCash ? "Cash" : "Bank Account";
  let payLedger = await AccountLedger.findOne({
    ledgername: payLedgerName,
    admin: newInv.adminid,
  });

  if (!payLedger) {
    const created = await getOrCreateAccount(
      payLedgerName,
      "other",
      newInv.adminid,
      newInv.branchid
    );

    payLedger = { _id: created.ledgerid } as any;
  }

  // ------------------------- PAYMENT ENTRY GENERATION -------------------------
  const payAmount = parseFloat(newInv.totalamount.toFixed(2));
  const paymentEntries = [
    {
      ledgerid: payLedger?._id,
      debit: payAmount,
      credit: 0,
      remarks: `Payment received (Invoice ${newInv.billnumber})`,
    },
    {
      ledgerid: customer.ledgerid,
      debit: 0,
      credit: payAmount,
      remarks: `Customer payment (Invoice ${newInv.billnumber})`,
    },
  ];

  // ------------------------- BALANCE CHECK -------------------------
  const totalDebit = paymentEntries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = paymentEntries.reduce((s, e) => s + e.credit, 0);

  console.log("🔵 Payment Debit Sum:", totalDebit);
  console.log("🔴 Payment Credit Sum:", totalCredit);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    console.error("❌ PAYMENT ENTRY NOT BALANCED!");
    throw new Error(
      `Payment not balanced (Debit ${totalDebit} ≠ Credit ${totalCredit})`
    );
  }

  // ------------------------- UPDATE EXISTING PAYMENT -------------------------
  if (oldPayment) {
    oldPayment.mode = newInv.paymenttype;
    oldPayment.ledgerid = customer.ledgerid;
    oldPayment.amount = payAmount;
    oldPayment.invoices[0].settledamount = payAmount;
    await oldPayment.save();

    await Transaction.updateOne(
      { _id: oldPayment.transactionid },
      {
        $set: {
          entries: paymentEntries,
          totaldebit: payAmount,
          totalcredit: payAmount,
          transactiondate: newInv.billdate,
          narration: `Receipt for Sales Invoice #${newInv.billnumber}`,
        },
      }
    );
    return;
  }

  // ------------------------- CREATE NEW PAYMENT TRANSACTION -------------------------
  const payTrx = await Transaction.create({
    adminid: newInv.adminid,
    branchid: newInv.branchid,
    entrytype: "auto",
    source: { docmodel: "Payment", docid: invId },
    transactiondate: newInv.billdate,
    narration: `Receipt for Sales Invoice #${newInv.billnumber}`,
    entries: paymentEntries,
    totaldebit: payAmount,
    totalcredit: payAmount,
  });

  // ------------------------- CREATE PAYMENT RECORD -------------------------
  await Payment.create({
    adminid: newInv.adminid,
    branchid: newInv.branchid,
    type: "receipt",
    mode: newInv.paymenttype,
    partyid: customer._id,
    ledgerid: customer.ledgerid,
    invoices: [
      {
        invoiceid: invId,
        invoicemodel: "SalesInvoice",
        settledamount: payAmount,
      },
    ],
    amount: payAmount,
    remarks: `Receipt for Sales Invoice #${newInv.billnumber}`,
    transactionid: payTrx._id,
  });

  };

// ✅ Trigger on save
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
