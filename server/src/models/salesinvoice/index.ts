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
      ledger: { type: Boolean, default: true },
      stock: { type: Boolean, default: true }
    },
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

salesInvoiceSchema.statics.adjustStockAndTransactions = async function (oldInv: any, newInv: any, userContext?: any) {
  console.log("🔵 adjustStockAndTransactions called for invoice:", newInv.billnumber);
  console.log("   userContext:", userContext);
  console.log("   newInv.createdby_id:", newInv.createdby_id);
  console.log("   newInv.createdby_name:", newInv.createdby_name);
  console.log("   newInv.createdby_type:", newInv.createdby_type);
  console.log("   ⚠️  POST SAVE HOOK SHOULD BE DISABLED - if you see duplicate 'adjustStockAndTransactions' calls, the server needs restart!");

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

  // ========================= FETCH CUSTOMER & STATE =========================
  const customer = await Account.findById(newInv.partyacc).select("ledgerid state");
  if (!customer?.ledgerid) throw new Error("❌ Customer ledger missing!");

  const companyState = settings?.companyState || "gujarat";
  const partyState = customer?.state || "gujarat";
  const isIgst = companyState.toLowerCase() !== partyState.toLowerCase() && partyState !== "default";
  
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
      if (isIgst) {
        let igst = await AccountLedger.findOne({ ledgername: "Output IGST", admin: newInv.adminid });
        if (!igst) igst = await getOrCreateAccount("Output IGST", "liabilities", newInv.adminid, newInv.branchid) as any;
        if (igst) {
          entries.push({
            ledgerid: (igst as any).ledgerid || igst._id,
            debit: 0,
            credit: gstAmt,
            remarks: `IGST on ${productName}`,
          });
        }
      } else {
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

          if (gstAcc?._id || gstAcc?.ledgerid) {
            entries.push({
              ledgerid: gstAcc._id || gstAcc.ledgerid,
              debit: 0,
              credit: gstAmt,
              remarks: `GST on ${productName}`,
            });
          }
        }
      }
    }

    lineIndex++;
  }

  // ===================== OTHER CHARGES ==========================
  if (newInv.othercharges && newInv.othercharges.length > 0) {
    for (const charge of newInv.othercharges) {
      if (charge.amount > 0) {
        entries.push({
          ledgerid: charge.ledgerid,
          debit: 0,
          credit: charge.amount,
          remarks: charge.remarks || charge.ledgername || "Other Charge",
        });

        if (charge.gstamount > 0) {
          if (isIgst) {
            let igst = await AccountLedger.findOne({ ledgername: "Output IGST", admin: newInv.adminid });
            if (!igst) igst = await getOrCreateAccount("Output IGST", "liabilities", newInv.adminid, newInv.branchid) as any;
            if (igst) {
              entries.push({ ledgerid: (igst as any).ledgerid || igst._id, debit: 0, credit: charge.gstamount, remarks: `IGST on ${charge.ledgername || "Other Charge"}` });
            }
          } else {
            const cgst = await AccountLedger.findOne({ ledgername: "Output CGST", admin: newInv.adminid });
            const sgst = await AccountLedger.findOne({ ledgername: "Output SGST", admin: newInv.adminid });

            if (cgst && sgst) {
              const cgstAmt = parseFloat((charge.gstamount / 2).toFixed(2));
              const sgstAmt = parseFloat((charge.gstamount - cgstAmt).toFixed(2));

              entries.push({ ledgerid: cgst._id, debit: 0, credit: cgstAmt, remarks: `CGST on ${charge.ledgername || "Other Charge"}` });
              entries.push({ ledgerid: sgst._id, debit: 0, credit: sgstAmt, remarks: `SGST on ${charge.ledgername || "Other Charge"}` });
            } else {
              const gstAcc = await getOrCreateAccount("Output GST", "other", newInv.adminid, newInv.branchid);
              if (gstAcc?._id || gstAcc?.ledgerid) {
                entries.push({ ledgerid: gstAcc._id || gstAcc.ledgerid, debit: 0, credit: charge.gstamount, remarks: `GST on ${charge.ledgername || "Other Charge"}` });
              }
            }
          }
        }
      }
    }
  }

  // ===================== ROUND OFF ==========================
  if (newInv.roundoff && newInv.roundoff !== 0) {
    let roundOffLedger = await AccountLedger.findOne({ ledgername: "Round Off", admin: newInv.adminid });
    if (!roundOffLedger) {
      const created = await getOrCreateAccount("Round Off", "indirect_expenses", newInv.adminid, newInv.branchid);
      if (created) roundOffLedger = { _id: created.ledgerid } as any;
    }
    
    if (roundOffLedger) {
      if (newInv.roundoff > 0) {
        // Income (Credit)
        entries.push({ ledgerid: roundOffLedger._id, debit: 0, credit: newInv.roundoff, remarks: "Round Off" });
      } else {
        // Expense (Debit)
        entries.push({ ledgerid: roundOffLedger._id, debit: Math.abs(newInv.roundoff), credit: 0, remarks: "Round Off" });
      }
    }
  }

  // ===================== INVOICE DISCOUNT =======================
  if (newInv.invoicediscount && newInv.invoicediscount !== 0) {
    let discLedger = await AccountLedger.findOne({ ledgername: "Invoice Discount", admin: newInv.adminid });
    if (!discLedger) {
      const created = await getOrCreateAccount("Invoice Discount", "indirect_expenses", newInv.adminid, newInv.branchid);
      if (created) discLedger = { _id: created.ledgerid } as any;
    }
    
    // Calculate the actual discount amount in case it's a percentage
    let discountAmount = newInv.invoicediscount;
    if (newInv.invoicediscounttype === "percent") {
      const taxableSubtotal = newInv.productservice.reduce((sum:any, item:any) => {
        return sum + (Number(item.rate) - Number(item.discount)) * Number(item.qty);
      }, 0);
      discountAmount = (taxableSubtotal * newInv.invoicediscount) / 100;
    }
    
    if (discountAmount > 0 && discLedger) {
      entries.push({ ledgerid: discLedger._id, debit: parseFloat(discountAmount.toFixed(2)), credit: 0, remarks: "Invoice Discount" });
    }
  }

  // ===================== CUSTOMER LEDGER ==========================
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
    const txCreatedById = userContext?.createdby_id || newInv.createdby_id;
    const txCreatedByName = userContext?.createdby_name || newInv.createdby_name;
    const txCreatedByType = userContext?.createdby_type || newInv.createdby_type;

    invoiceTrx.entries = entries;
    invoiceTrx.transactiondate = newInv.billdate;
    invoiceTrx.totaldebit = totalDebitSum;
    invoiceTrx.totalcredit = totalCreditSum;
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
      source: { docmodel: "SalesInvoice", docid: newInv._id },
      transactiondate: newInv.billdate,
      narration: `Sales Invoice #${newInv.billnumber}`,
      entries,
      totaldebit: totalDebitSum,
      totalcredit: totalCreditSum,
      createdby_id: txCreatedById,
      createdby_name: txCreatedByName,
      createdby_type: txCreatedByType,
    });

    console.log("   Created Transaction ID:", invoiceTrx._id);
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
    const payCreatedById = userContext?.createdby_id || newInv.createdby_id;
    const payCreatedByName = userContext?.createdby_name || newInv.createdby_name;
    const payCreatedByType = userContext?.createdby_type || newInv.createdby_type;

    oldPayment.mode = newInv.paymenttype;
    oldPayment.ledgerid = customer.ledgerid;
    oldPayment.amount = payAmount;
    oldPayment.invoices[0].settledamount = payAmount;
    // ✅ Also update createdby if userContext is provided
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
        narration: `Receipt for Sales Invoice #${newInv.billnumber}`,
      },
    };
    // ✅ Also update createdby in transaction if userContext is provided
    if (userContext) {
      updateData.$set.createdby_id = payCreatedById;
      updateData.$set.createdby_name = payCreatedByName;
      updateData.$set.createdby_type = payCreatedByType;
    }

    await Transaction.updateOne(
      { _id: oldPayment.transactionid },
      updateData
    );
    return;
  }

  // ------------------------- CREATE NEW PAYMENT TRANSACTION -------------------------
  const payTxCreatedById = userContext?.createdby_id || newInv.createdby_id;
  const payTxCreatedByName = userContext?.createdby_name || newInv.createdby_name;
  const payTxCreatedByType = userContext?.createdby_type || newInv.createdby_type;

  console.log("✅ Creating Payment Transaction:");
  console.log("   createdby_id:", payTxCreatedById);
  console.log("   createdby_name:", payTxCreatedByName);
  console.log("   createdby_type:", payTxCreatedByType);

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
    createdby_id: payTxCreatedById,
    createdby_name: payTxCreatedByName,
    createdby_type: payTxCreatedByType,
  });

  console.log("   Created Payment Transaction ID:", payTrx._id);

  // ------------------------- CREATE PAYMENT RECORD -------------------------
  const payRecCreatedById = userContext?.createdby_id || newInv.createdby_id;
  const payRecCreatedByName = userContext?.createdby_name || newInv.createdby_name;
  const payRecCreatedByType = userContext?.createdby_type || newInv.createdby_type;

  console.log("✅ Creating Payment Record:");
  console.log("   createdby_id:", payRecCreatedById);
  console.log("   createdby_name:", payRecCreatedByName);
  console.log("   createdby_type:", payRecCreatedByType);

  const paymentRecord = await Payment.create({
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
    createdby_id: payRecCreatedById,
    createdby_name: payRecCreatedByName,
    createdby_type: payRecCreatedByType,
  });

  console.log("   Created Payment Record ID:", paymentRecord._id);

  };

// ❌ DISABLED: Post "save" hook - resolvers now call adjustStockAndTransactions explicitly WITH userContext
// This prevents duplicate Transaction/Payment creation and ensures Created By is never N/A
// salesInvoiceSchema.post("save", async function (doc: any, next) {
//   try {
//     await (SalesInvoice as any).adjustStockAndTransactions(null, doc);
//     next();
//   } catch (e: any) {
//     console.error("Sales invoice auto error", e);
//     next(e);
//   }
// });

interface SalesInvoiceModel extends mongoose.Model<any> {
  adjustStockAndTransactions(oldInvoice: any, newInvoice: any, userContext?: any): Promise<void>;
}

export const SalesInvoice = mongoose.model<any, SalesInvoiceModel>("SalesInvoice", salesInvoiceSchema);
