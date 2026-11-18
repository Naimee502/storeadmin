import { Account } from "../models/accounts";
import { AccountLedger } from "../models/accountledgers";
import { SalesInvoice } from "../models/salesinvoice";
import { SalesReturn } from "../models/salesreturn";
import { PurchaseInvoice } from "../models/purchaseinvoice";
import { PurchaseReturn } from "../models/purchasereturn";
import { Payment } from "../models/payments";
import { isCustomerParty, isVendorParty } from "./partytype";

const r2 = (n: any) => Math.round((Number(n) || 0) * 100) / 100;
const dayOf = (d: any) => {
  const t = new Date(typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00Z` : d).getTime();
  return isNaN(t) ? 0 : Math.floor(t / 86400000);
};

/**
 * Party balance on the Party Statement's basis (+ = party owes us, Dr).
 * With `beforeInvoiceId`, only what came before that bill (by date, then entry time).
 */
export async function partyLedgerBalance(partyid: any, adminid: any, beforeInvoiceId?: any, beforeModel: "SalesInvoice" | "PurchaseInvoice" = "SalesInvoice", excludePaymentId?: any): Promise<number | null> {
  const acc: any = await Account.findOne({ _id: partyid, admin: adminid }).select("type ledgerid openingbalance openingbalancetype").lean();
  if (!acc) return null;
  const led: any = acc.ledgerid ? await AccountLedger.findById(acc.ledgerid).select("openingbalance openingbalancetype").lean() : null;
  const src = led || acc;
  let balance = src.openingbalancetype === "debit" ? Number(src.openingbalance) || 0 : -(Number(src.openingbalance) || 0);

  const BillModel: any = beforeModel === "PurchaseInvoice" ? PurchaseInvoice : SalesInvoice;
  const cut: any = beforeInvoiceId ? await BillModel.findById(beforeInvoiceId).select("billdate createdAt").lean() : null;
  const notCut = (model: string) => (beforeInvoiceId && model === beforeModel ? { _id: { $ne: beforeInvoiceId } } : {});
  const isBefore = (date: any, createdAt: any) => {
    if (!cut) return true;
    const a = dayOf(date), b = dayOf(cut.billdate);
    return a < b || (a === b && new Date(createdAt).getTime() < new Date(cut.createdAt).getTime());
  };

  const showPurchase = isVendorParty(acc.type);
  const showSales = isCustomerParty(acc.type) || !showPurchase;
  const live = { partyacc: partyid, status: true, cancelStatus: { $ne: "cancelled" } };
  const [sales, sret, pur, pret, pays]: any[][] = await Promise.all([
    showSales ? SalesInvoice.find({ ...live, ...notCut("SalesInvoice") }).select("billdate createdAt totalamount").lean() : [],
    showSales ? SalesReturn.find({ partyacc: partyid, status: true }).select("returndate createdAt totalamount").lean() : [],
    showPurchase ? PurchaseInvoice.find({ ...live, ...notCut("PurchaseInvoice") }).select("billdate createdAt totalamount").lean() : [],
    showPurchase ? PurchaseReturn.find({ partyacc: partyid, status: true }).select("returndate createdAt totalamount").lean() : [],
    Payment.find({ partyid, status: true, ...(excludePaymentId ? { _id: { $ne: excludePaymentId } } : {}) }).select("type amount discount commission invoices paymentdate createdAt").lean(),
  ]);

  sales.filter((x) => isBefore(x.billdate, x.createdAt)).forEach((x) => { balance += Number(x.totalamount) || 0; });
  sret.filter((x) => isBefore(x.returndate, x.createdAt)).forEach((x) => { balance -= Number(x.totalamount) || 0; });
  pur.filter((x) => isBefore(x.billdate, x.createdAt)).forEach((x) => { balance -= Number(x.totalamount) || 0; });
  pret.filter((x) => isBefore(x.returndate, x.createdAt)).forEach((x) => { balance += Number(x.totalamount) || 0; });
  // Same steps as the statement: settled amount, then discount + commission in the payment's direction.
  pays.filter((p) => isBefore(p.paymentdate, p.createdAt)).forEach((p) => {
    const lines = Array.isArray(p.invoices) ? p.invoices : [];
    const discount = Math.max(r2(lines.reduce((s: number, l: any) => s + (Number(l.discount) || 0), 0)), r2(p.discount));
    const commission = Math.max(r2(lines.reduce((s: number, l: any) => s + (Number(l.commission) || 0), 0)), r2(p.commission));
    const settled = r2(r2(p.amount) + discount - commission);
    const conc = r2(commission + discount);
    balance += p.type === "receipt" ? -(settled + conc) : settled + conc;
  });
  return r2(balance);
}
