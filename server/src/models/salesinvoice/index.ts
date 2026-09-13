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

    // Original order creator (when this invoice was converted from a sales order).
    // createdby_* = who made the invoice (e.g. branch); orderedby_* = who placed the order (e.g. party).
    sourceorderid: { type: mongoose.Schema.Types.ObjectId, ref: "SalesOrder" },
    orderedby_id: { type: mongoose.Schema.Types.ObjectId },
    orderedby_name: { type: String },
    orderedby_type: { type: String },

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

    // Money collected AT THE COUNTER, on this bill, at the moment it was made.
    // 0 = pure credit, totalamount = fully paid, anything between = part paid
    // and the rest stays outstanding for a later Payment-In. This replaces the
    // old all-or-nothing "paymenttype = cash means the whole bill is settled":
    // paymenttype now only says HOW the money came, this says HOW MUCH.
    received: { type: Number, default: 0 },

    isservice: { type: Boolean, default: false },
    autocreate: {
      // Stock is the only thing still worth a switch: a service line moves none,
      // and some businesses bill first and enter their purchases later. Journals
      // are not optional -- a document IS an accounting event.
      stock: { type: Boolean, default: true }
    },

    // Fulfilment / delivery lifecycle (invoice = the document that is dispatched).
    deliveryStatus: { type: String, enum: ["pending", "dispatched", "delivered"], default: "pending" },
    deliveredAt: { type: Date },
    deliveredById: { type: mongoose.Schema.Types.ObjectId },
    deliveredByName: { type: String },
    deliveredByType: { type: String },
    deliveryboyid: { type: mongoose.Schema.Types.ObjectId, ref: "StaffAccount" },

    // Cancellation. A bill entered by mistake is cancelled rather than deleted:
    // the document stays on record with its number intact (a gap in a bill
    // series is itself a question an auditor asks), while its stock, journal and
    // counter receipt are all reversed. Cancelling is refused once anything else
    // has been built on the bill -- a return, or a payment collected against it.
    cancelStatus: { type: String, enum: ["open", "cancelled"], default: "open" },
    cancelReason: { type: String },
    cancelledAt: { type: Date },
    cancelledByName: { type: String },

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

/**
 * Build the Sales Invoice accounting journal — Dr Debtor / Cr Sales / Cr Output
 * GST (CGST+SGST or IGST) / Cr Other Charges (+GST) / Dr Invoice Discount /
 * Round Off / salesman commission — and balance it, WITHOUT saving anything.
 *
 * Shared by adjustStockAndTransactions (auto-posting) and the manual
 * "Full Journal" preview resolver, so a manual journal created when
 * auto-posting is OFF is byte-for-byte identical to what auto would post.
 */
export async function buildSalesInvoiceJournal(newInv: any) {
  const settings: any = await AdminSettings.getOrCreateForAdmin(newInv.adminid);

  const customer = await Account.findById(newInv.partyacc).select("ledgerid state");
  if (!customer?.ledgerid) throw new Error("❌ Customer ledger missing!");

  const companyState = settings?.companyState || "gujarat";
  const partyState = customer?.state || "gujarat";
  const isIgst = companyState.toLowerCase() !== partyState.toLowerCase() && partyState !== "default";

  const getDefaultSalesLedgerId = async () => {
    let sales = await AccountLedger.findOne({ ledgername: "Sales", admin: newInv.adminid });
    if (!sales) {
      const AccountGroup = mongoose.model("AccountGroup");
      let group = await AccountGroup.findOne({ accountgroupname: "Sales Account", admin: newInv.adminid });
      if (!group) {
        group = await AccountGroup.create({
          admin: newInv.adminid,
          accountgroupname: "Sales Account",
          category: "income",
          status: true,
        });
      }
      sales = await AccountLedger.create({
        admin: newInv.adminid,
        accountgroupid: group._id,
        ledgername: "Sales",
        openingbalance: 0,
        openingbalancetype: "credit",
        status: true,
      });
    }
    return sales._id;
  };
  const defaultSalesLedgerId = await getDefaultSalesLedgerId();

  const entries: any[] = [];

  for (const item of newInv.productservice) {
    const qty = Number(item.qty);
    const rate = Number(item.rate);
    const discount = Number(item.discount);
    const taxable = parseFloat(((rate - discount) * qty).toFixed(2));
    const gstRate = Number(item.gst);
    const gstAmt = parseFloat(((taxable * gstRate) / 100).toFixed(2));

    const salesLedger =
      ledgerId(item.salesaccountid) || ledgerId(item.serviceaccountid) || defaultSalesLedgerId;

    const product = await ProductService.findById(item.productserviceid);
    const productName = product?.name || "Unknown Product";
    let variantName = null;
    if (item.variantid && product?.productvariants?.length) {
      const variant = product.productvariants.find(
        (v: any) => v?._id.toString() === item.variantid.toString()
      );
      variantName = variant?.name || null;
    }
    const saleRemark = variantName
      ? `Sale of ${productName} (${variantName})`
      : `Sale of ${productName}`;

    if (salesLedger && taxable > 0) {
      entries.push({ ledgerid: salesLedger, debit: 0, credit: taxable, remarks: saleRemark });
    }

    if (gstAmt > 0) {
      if (isIgst) {
        let igst = await AccountLedger.findOne({ ledgername: "Output IGST", admin: newInv.adminid });
        if (!igst) igst = await getOrCreateAccount("Output IGST", "liabilities", newInv.adminid, newInv.branchid) as any;
        if (igst) {
          entries.push({ ledgerid: (igst as any).ledgerid || igst._id, debit: 0, credit: gstAmt, remarks: `IGST on ${productName}` });
        }
      } else {
        const cgst = await AccountLedger.findOne({ ledgername: "Output CGST", admin: newInv.adminid });
        const sgst = await AccountLedger.findOne({ ledgername: "Output SGST", admin: newInv.adminid });
        if (cgst && sgst) {
          const cgstAmt = parseFloat((gstAmt / 2).toFixed(2));
          const sgstAmt = parseFloat((gstAmt - cgstAmt).toFixed(2));
          entries.push({ ledgerid: cgst._id, debit: 0, credit: cgstAmt, remarks: `CGST on ${productName}` });
          entries.push({ ledgerid: sgst._id, debit: 0, credit: sgstAmt, remarks: `SGST on ${productName}` });
        } else {
          const gstAcc = await getOrCreateAccount("Output GST", "other", newInv.adminid, newInv.branchid);
          if (gstAcc?._id || gstAcc?.ledgerid) {
            entries.push({ ledgerid: gstAcc.ledgerid || gstAcc._id, debit: 0, credit: gstAmt, remarks: `GST on ${productName}` });
          }
        }
      }
    }
  }

  // With the concession feature on for this admin, an "other charge" and an
  // invoice discount fold into Sales instead of standing as their own P&L
  // lines -- the same treatment payments give discount and commission, so the
  // party's balance carries them rather than a side ledger. Off (the default)
  // keeps ledger-wise posting. Either way the party leg is the grand total and
  // the journal balances; only WHICH ledger takes the other side changes.
  //
  // GST never folds: it is a statutory liability, not a concession. Round Off
  // stays on its own ledger too -- it is rounding, not a charge.
  const foldSettings: any = await AdminSettings.getOrCreateForAdmin(newInv.adminid);
  const foldIntoSales = !!foldSettings?.enablePaymentDiscountCommission;

  if (newInv.othercharges && newInv.othercharges.length > 0) {
    for (const charge of newInv.othercharges) {
      if (charge.amount > 0) {
        entries.push({ ledgerid: foldIntoSales ? defaultSalesLedgerId : charge.ledgerid, debit: 0, credit: charge.amount, remarks: charge.remarks || charge.ledgername || "Other Charge" });
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
                entries.push({ ledgerid: gstAcc.ledgerid || gstAcc._id, debit: 0, credit: charge.gstamount, remarks: `GST on ${charge.ledgername || "Other Charge"}` });
              }
            }
          }
        }
      }
    }
  }

  if (newInv.roundoff && newInv.roundoff !== 0) {
    let roundOffLedger = await AccountLedger.findOne({ ledgername: "Round Off", admin: newInv.adminid });
    if (!roundOffLedger) {
      const created = await getOrCreateAccount("Round Off", "indirect_expenses", newInv.adminid, newInv.branchid);
      if (created) roundOffLedger = { _id: created.ledgerid } as any;
    }
    if (roundOffLedger) {
      if (newInv.roundoff > 0) {
        entries.push({ ledgerid: roundOffLedger._id, debit: 0, credit: newInv.roundoff, remarks: "Round Off" });
      } else {
        entries.push({ ledgerid: roundOffLedger._id, debit: Math.abs(newInv.roundoff), credit: 0, remarks: "Round Off" });
      }
    }
  }

  if (newInv.invoicediscount && newInv.invoicediscount !== 0) {
    let discountAmount = newInv.invoicediscount;
    if (newInv.invoicediscounttype === "percent") {
      const taxableSubtotal = newInv.productservice.reduce((sum: any, item: any) => {
        return sum + (Number(item.rate) - Number(item.discount)) * Number(item.qty);
      }, 0);
      discountAmount = (taxableSubtotal * newInv.invoicediscount) / 100;
    }
    if (discountAmount > 0) {
      // Folded: debit Sales, which nets the concession straight out of revenue
      // and leaves the party carrying it. Unfolded: its own expense ledger.
      let discLedgerId: any = defaultSalesLedgerId;
      if (!foldIntoSales) {
        let discLedger = await AccountLedger.findOne({ ledgername: "Invoice Discount", admin: newInv.adminid });
        if (!discLedger) {
          const created = await getOrCreateAccount("Invoice Discount", "indirect_expenses", newInv.adminid, newInv.branchid);
          if (created) discLedger = { _id: created.ledgerid } as any;
        }
        discLedgerId = discLedger?._id;
      }
      if (discLedgerId) {
        entries.push({
          ledgerid: discLedgerId,
          debit: parseFloat(discountAmount.toFixed(2)),
          credit: 0,
          remarks: foldIntoSales ? "Invoice Discount (netted into Sales)" : "Invoice Discount",
        });
      }
    }
  }

  entries.push({
    ledgerid: customer.ledgerid,
    debit: parseFloat(newInv.totalamount.toFixed(2)),
    credit: 0,
    remarks: `Sales Invoice #${newInv.billnumber}`,
  });

  if (newInv.salesmenid) {
    const salesman = await StaffAccount.findById(newInv.salesmenid).select("ledgerid commission name");
    if (!salesman?.ledgerid) throw new Error("❌ Salesman ledger missing");
    const taxableSubtotal = newInv.productservice.reduce((sum: any, item: any) => {
      return sum + (Number(item.rate) - Number(item.discount)) * Number(item.qty);
    }, 0);
    const commissionAmount = parseFloat(((taxableSubtotal * Number(salesman.commission)) / 100).toFixed(2));
    if (commissionAmount > 0) {
      let commissionExpenseLedger = await AccountLedger.findOne({ ledgername: "Salesman Commission Expense", admin: newInv.adminid });
      if (!commissionExpenseLedger) {
        const AccountGroup = mongoose.model("AccountGroup");
        let expenseGroup = await AccountGroup.findOne({ accountgroupname: "Commission Expense", admin: newInv.adminid });
        if (!expenseGroup) {
          expenseGroup = await AccountGroup.create({ admin: newInv.adminid, accountgroupname: "Commission Expense", category: "expenses", status: true });
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
      entries.push({ ledgerid: commissionExpenseLedger._id, debit: commissionAmount, credit: 0, remarks: `Commission for ${salesman.name}` });
      entries.push({ ledgerid: salesman.ledgerid, debit: 0, credit: commissionAmount, remarks: `Sales Commission` });
    }
  }

  // Balance: post any residual to Sales (never mutate the debtor line).
  const tempDebit = parseFloat(entries.reduce((t, e) => t + (e.debit || 0), 0).toFixed(2));
  const tempCredit = parseFloat(entries.reduce((t, e) => t + (e.credit || 0), 0).toFixed(2));
  if (tempDebit !== tempCredit) {
    const diff = parseFloat((tempDebit - tempCredit).toFixed(2));
    if (diff > 0) {
      entries.push({ ledgerid: defaultSalesLedgerId, debit: 0, credit: diff, remarks: "Sales (auto-balanced)" });
    } else {
      entries.push({ ledgerid: defaultSalesLedgerId, debit: Math.abs(diff), credit: 0, remarks: "Sales (auto-balanced)" });
    }
  }

  const totalDebitSum = parseFloat(entries.reduce((t, e) => t + (e.debit || 0), 0).toFixed(2));
  const totalCreditSum = parseFloat(entries.reduce((t, e) => t + (e.credit || 0), 0).toFixed(2));
  if (Math.abs(totalDebitSum - totalCreditSum) > 0.01) {
    throw new Error(`Transaction not balanced (Debit ${totalDebitSum} ≠ Credit ${totalCreditSum})`);
  }

  return { entries, totalDebitSum, totalCreditSum, customerLedgerId: customer.ledgerid };
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

  // An invoice IS an accounting event, so its journal always posts -- there is
  // no longer a switch for that. What the customer handed over is carried by
  // `received` instead, and how much of it is a number rather than a yes/no.
  //
  // Stock stays a choice: a service bill moves none, and some businesses bill
  // first and enter their purchases later.
  const settings: any = await AdminSettings.getOrCreateForAdmin(newInv.adminid);
  const wantsStock =
    newInv.autocreate?.stock ??
    settings?.autoCreateStockOnSalesInvoice ?? true;

  // Cancelling and re-opening run through this same function, so that one place
  // decides what a bill does to the books and the two directions can never
  // drift apart. What changes is only which halves run:
  //
  //   cancel  (open -> cancelled): put the stock back, then drop the journal and
  //           the counter receipt. Nothing is re-posted.
  //   reopen  (cancelled -> open): take the stock out again and post everything
  //           afresh -- but do NOT "restore old stock" first, because the cancel
  //           already gave it back; doing it twice would invent inventory.
  const isCancelled = String(newInv.cancelStatus || "") === "cancelled";
  const wasCancelled = String(oldInv?.cancelStatus || "") === "cancelled";

  // A note typed on the bill is what the user expects to see against it — in the
  // Transactions list and on the receipt it raises. The generated line is only a
  // fallback for when they left the box empty.
  const billNote = String(newInv.notes || "").trim();

  // The Account Ledger statement prints each LEG's remark, never the voucher's
  // narration — so a note typed on the bill has to land on the legs to be seen
  // there at all. This is the same treatment a hand-entered payment already
  // gets (applyUserRemark in the payments resolver), so an auto entry and a
  // manual one read identically in the statement.
  const withBillNote = (legs: any[]) =>
    billNote ? legs.map((e: any) => ({ ...e, remarks: billNote })) : legs;

  // ========================= FETCH CUSTOMER & STATE =========================
  const customer = await Account.findById(newInv.partyacc).select("ledgerid state");
  if (!customer?.ledgerid) throw new Error("❌ Customer ledger missing!");

  const companyState = settings?.companyState || "gujarat";
  const partyState = customer?.state || "gujarat";
  const isIgst = companyState.toLowerCase() !== partyState.toLowerCase() && partyState !== "default";
  
  // ========================= STOCK ADJUSTMENT =========================
  if (wantsStock && !newInv.isservice) {
    // Restore old stock if invoice updated. Skipped when the previous state was
    // already cancelled — that stock came back at cancel time.
    if (oldInv && !wasCancelled) {
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
          { $set: { currentstock: newStock, currentstockamount: newAmt, closingstock: newStock, closingstockamount: newAmt, adminid: newInv.adminid } }
        );
      }
    }

    // Deduct new stock. A cancelled bill sells nothing, so it takes nothing out.
    for (const item of isCancelled ? [] : newInv.productservice) {
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

      // adminid is written too — a row created by an upsert without it is
      // invisible to getStockDetails, which matches on adminid.
      await ProductBranchStock.updateOne(
        { productid: item.productserviceid, variantid: item.variantid, branchid },
        { $set: { currentstock: newStock, currentstockamount: newAmt, closingstock: newStock, closingstockamount: newAmt, adminid: newInv.adminid } },
        { upsert: true }
      );
    }
  }

  // A cancelled bill must leave nothing behind in the books: no journal, so it
  // drops out of the P&L and the party's balance, and no receipt, so the cash
  // it never took stops showing in the Cash Book. Both are removed rather than
  // contra-posted — the document itself carries the cancellation, and a pair of
  // equal-and-opposite entries would only make the statement harder to read.
  if (isCancelled) {
    await Transaction.deleteOne({
      "source.docmodel": "SalesInvoice",
      "source.docid": newInv._id,
    });
    const autoReceipt = await Payment.findOne({
      "autosource.docmodel": "SalesInvoice",
      "autosource.docid": newInv._id,
    });
    if (autoReceipt) {
      await Transaction.deleteOne({ _id: autoReceipt.transactionid });
      await Payment.deleteOne({ _id: autoReceipt._id });
    }
    console.log(`Invoice ${newInv.billnumber} cancelled — journal and counter receipt removed.`);
    return;
  }

  console.log("===== PROCESSING JOURNAL ENTRIES START =====");

  // Default "Sales" income ledger. Used when a product line has no sales
  // account configured, so its revenue is credited to Sales instead of being
  // dumped onto the customer ledger by the balance adjustment (which previously
  // left the party with a phantom credit and a wrong outstanding balance).
  const getDefaultSalesLedgerId = async () => {
    let sales = await AccountLedger.findOne({ ledgername: "Sales", admin: newInv.adminid });
    if (!sales) {
      const AccountGroup = mongoose.model("AccountGroup");
      let group = await AccountGroup.findOne({ accountgroupname: "Sales Account", admin: newInv.adminid });
      if (!group) {
        group = await AccountGroup.create({
          admin: newInv.adminid,
          accountgroupname: "Sales Account",
          category: "income",
          status: true,
        });
      }
      sales = await AccountLedger.create({
        admin: newInv.adminid,
        accountgroupid: group._id,
        ledgername: "Sales",
        openingbalance: 0,
        openingbalancetype: "credit",
        status: true,
      });
    }
    return sales._id;
  };
  const defaultSalesLedgerId = await getDefaultSalesLedgerId();

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
      ledgerId(item.salesaccountid) || ledgerId(item.serviceaccountid) || defaultSalesLedgerId;

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
              ledgerid: gstAcc.ledgerid || gstAcc._id,
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
  // With the concession feature on for this admin, an "other charge" and an
  // invoice discount fold into Sales instead of standing as their own P&L
  // lines -- the same treatment payments give discount and commission, so the
  // party's balance carries them rather than a side ledger. Off (the default)
  // keeps ledger-wise posting. Either way the party leg is the grand total and
  // the journal balances; only WHICH ledger takes the other side changes.
  //
  // GST never folds: it is a statutory liability, not a concession. Round Off
  // stays on its own ledger too -- it is rounding, not a charge.
  const foldSettings: any = await AdminSettings.getOrCreateForAdmin(newInv.adminid);
  const foldIntoSales = !!foldSettings?.enablePaymentDiscountCommission;

  if (newInv.othercharges && newInv.othercharges.length > 0) {
    for (const charge of newInv.othercharges) {
      if (charge.amount > 0) {
        entries.push({
          ledgerid: foldIntoSales ? defaultSalesLedgerId : charge.ledgerid,
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
                entries.push({ ledgerid: gstAcc.ledgerid || gstAcc._id, debit: 0, credit: charge.gstamount, remarks: `GST on ${charge.ledgername || "Other Charge"}` });
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
    // Calculate the actual discount amount in case it's a percentage
    let discountAmount = newInv.invoicediscount;
    if (newInv.invoicediscounttype === "percent") {
      const taxableSubtotal = newInv.productservice.reduce((sum:any, item:any) => {
        return sum + (Number(item.rate) - Number(item.discount)) * Number(item.qty);
      }, 0);
      discountAmount = (taxableSubtotal * newInv.invoicediscount) / 100;
    }

    if (discountAmount > 0) {
      // Folded: debit Sales, netting the concession out of revenue so the party
      // carries it. Unfolded: its own expense ledger.
      let discLedgerId: any = defaultSalesLedgerId;
      if (!foldIntoSales) {
        let discLedger = await AccountLedger.findOne({ ledgername: "Invoice Discount", admin: newInv.adminid });
        if (!discLedger) {
          const created = await getOrCreateAccount("Invoice Discount", "indirect_expenses", newInv.adminid, newInv.branchid);
          if (created) discLedger = { _id: created.ledgerid } as any;
        }
        discLedgerId = discLedger?._id;
      }
      if (discLedgerId) {
        entries.push({
          ledgerid: discLedgerId,
          debit: parseFloat(discountAmount.toFixed(2)),
          credit: 0,
          remarks: foldIntoSales ? "Invoice Discount (netted into Sales)" : "Invoice Discount",
        });
      }
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
    // Post any residual difference to the Sales ledger as its own balancing
    // line. NEVER mutate the customer entry (the last pushed entry) — doing so
    // corrupts the party's outstanding balance.
    if (diff > 0) {
      entries.push({
        ledgerid: defaultSalesLedgerId,
        debit: 0,
        credit: diff,
        remarks: "Sales (auto-balanced)",
      });
    } else {
      entries.push({
        ledgerid: defaultSalesLedgerId,
        debit: Math.abs(diff),
        credit: 0,
        remarks: "Sales (auto-balanced)",
      });
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
      entries: withBillNote(entries),
      totaldebit: totalDebitSum,
      totalcredit: totalCreditSum,
      createdby_id: txCreatedById,
      createdby_name: txCreatedByName,
      createdby_type: txCreatedByType,
    });

    console.log("   Created Transaction ID:", invoiceTrx._id);
  }

  // ====================== PAYMENT HANDLING ======================
  // `received` is the whole story: 0 is a pure credit sale, the full total is a
  // cash sale, and anything between leaves the remainder outstanding for a later
  // Payment-In. `paymenttype` only says HOW the money came, never how much --
  // except "credit", which is just received = 0 said in words.
  const invId =
    typeof newInv._id === "string"
      ? new mongoose.Types.ObjectId(newInv._id)
      : newInv._id;

  // Only ever touch the receipt THIS invoice created. Matching on "any payment
  // against this bill" would pick up a manual Payment-In entered later and
  // overwrite it.
  const oldPayment = await Payment.findOne({
    "autosource.docmodel": "SalesInvoice",
    "autosource.docid": invId,
  });

  const grandTotal = parseFloat(Number(newInv.totalamount || 0).toFixed(2));
  const payType = String(newInv.paymenttype || "").toLowerCase();

  let payAmount =
    payType === "credit" ? 0 : parseFloat(Number(newInv.received || 0).toFixed(2));
  if (!(payAmount > 0)) payAmount = 0;
  if (payAmount > grandTotal) payAmount = grandTotal;

  // ...and cap again at what is actually still OPEN on this bill. If a separate
  // Payment-In already collected part of it, "Received" must not claim that amount a
  // second time -- the bill would end up over-settled and the party would show
  // a phantom credit that never existed.
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

  // Nothing collected at the counter -- and if a previous save had collected
  // something, that receipt has to go with it.
  if (payAmount <= 0) {
    if (oldPayment) {
      await Transaction.deleteOne({ _id: oldPayment.transactionid });
      await Payment.deleteOne({ _id: oldPayment._id });
      console.log("Received is 0 — removed the receipt a previous save created.");
    }
    return;
  }

  // ------------------------- PAYMENT LEDGER -------------------------
  // Every mode is mapped explicitly. It used to be `isCash ? "Cash" : "Bank
  // Account"`, so UPI, Card, Cheque AND Other all silently became Bank Account
  // -- fine for the first three, plainly wrong for the last.
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

  // Fail loudly rather than writing undefined here: the wrong ledger on this leg
  // silently corrupts the Cash Book.
  const cashBankLedgerId: any = payLedger?._id;
  if (!cashBankLedgerId) {
    throw new Error(`Cash/Bank ledger "${payLedgerName}" could not be resolved for admin ${newInv.adminid}`);
  }

  // Dr Cash / Cr Customer, both at what was actually received. Two legs, so it
  // balances by construction.
  const paymentEntries = withBillNote([
    {
      ledgerid: cashBankLedgerId,
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
  ]);

  const payCreatedById = userContext?.createdby_id || newInv.createdby_id;
  const payCreatedByName = userContext?.createdby_name || newInv.createdby_name;
  const payCreatedByType = userContext?.createdby_type || newInv.createdby_type;

  // ------------------------- UPDATE EXISTING -------------------------
  if (oldPayment) {
    oldPayment.mode = newInv.paymenttype;
    // The receipt belongs to the bill's date, not to whenever the row happens to
    // be re-saved. Only the Transaction was being moved, so changing a bill's
    // date left its receipt sitting on the old one.
    oldPayment.paymentdate = newInv.billdate;
    // ...and its remarks follow the bill's note. The create branch already did
    // this; the update branch only ever touched the money fields, so a note
    // typed (or changed) on an existing bill reached the Transaction's narration
    // but never the receipt sitting beside it.
    oldPayment.remarks = billNote || `Receipt for Sales Invoice #${newInv.billnumber}`;
    // Payment.ledgerid is the CASH/BANK ledger (that's how the UI labels it and
    // how buildPaymentEntries reads it) -- never the customer's own ledger.
    oldPayment.ledgerid = cashBankLedgerId;
    oldPayment.amount = payAmount;
    if (oldPayment.invoices?.length) {
      oldPayment.invoices[0].settledamount = payAmount;
    } else {
      oldPayment.invoices = [
        { invoiceid: invId, invoicemodel: "SalesInvoice", settledamount: payAmount } as any,
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
        narration: `Receipt for Sales Invoice #${newInv.billnumber}`,
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

  // ------------------------- CREATE NEW -------------------------
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
    createdby_id: payCreatedById,
    createdby_name: payCreatedByName,
    createdby_type: payCreatedByType,
  });

  await Payment.create({
    adminid: newInv.adminid,
    branchid: newInv.branchid,
    type: "receipt",
    mode: newInv.paymenttype,
    // Without this the schema default (Date.now) stamped every auto receipt with
    // the day it was saved rather than the day of the bill.
    paymentdate: newInv.billdate,
    partyid: customer._id,
    ledgerid: cashBankLedgerId,
    invoices: [
      {
        invoiceid: invId,
        invoicemodel: "SalesInvoice",
        settledamount: payAmount,
      },
    ],
    amount: payAmount,
    remarks: billNote || `Receipt for Sales Invoice #${newInv.billnumber}`,
    transactionid: payTrx._id,
    // Marks this as the invoice's own receipt so a later re-save finds THIS
    // record and not a manual collection against the same bill.
    autosource: { docmodel: "SalesInvoice", docid: invId },
    createdby_id: payCreatedById,
    createdby_name: payCreatedByName,
    createdby_type: payCreatedByType,
    // The salesman who booked the source order in the field, so salesman
    // reports credit the collection to them even when an admin formalised it.
    orderedby_id: newInv.orderedby_id || null,
    orderedby_name: newInv.orderedby_name || null,
    orderedby_type: newInv.orderedby_type || null,
  });

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
