import { Types } from "mongoose";
import { Account } from "../../../models/accounts";
import { Admin } from "../../../models/admin";
import { PurchaseOrder } from "../../../models/purchaseorder";
import { Payment } from "../../../models/payments";
import { generateTokens } from "../../../utils/auth";
import { enforceLoginOtp } from "../../../utils/loginotp";
import { getPartyBillPositions, getPartyRunningBalance } from "../../../utils/allocation";
import { isVendorParty } from "../../../utils/partytype";
import { TenantError } from "../../../utils/tenant";
import { docShape, editSupplierOrder, loadSupplierDoc, printToken } from "../../../utils/supplierdocs";

const NOT_ALLOWED = "Supplier login is not turned on for this number. Please ask the business.";

const portalAccount = async (adminId: any, filter: any) => {
  if (!Types.ObjectId.isValid(String(adminId))) throw new TenantError(NOT_ALLOWED, "BAD_USER_INPUT");
  const acc: any = await Account.findOne({ admin: adminId, status: true, supplierlogin: true, type: { $in: ["vendor", "both"] }, ...filter }).lean();
  if (!acc || !isVendorParty(acc.type) || acc.supplierlogin !== true) throw new TenantError(NOT_ALLOWED, "FORBIDDEN");
  return acc;
};

/** The signed-in supplier's account; supplier login switched off ends the session. */
const me = async (context: any) => {
  const user = context?.user;
  if (user?.type !== "supplier" || !user.id || !user.adminid) throw new TenantError("Please sign in again.", "UNAUTHENTICATED");
  return portalAccount(user.adminid, { _id: user.id });
};

export const supplierPortalResolvers = {
  Query: {
    getSupplierDocument: async (_: any, { kind, id }: any, context: any) => {
      const acc = await me(context);
      return docShape(kind, await loadSupplierDoc(kind, id, acc._id, acc.admin));
    },
    getSupplierPortal: async (_: any, __: any, context: any) => {
      const acc = await me(context);
      const adminid = acc.admin;
      const [company, orders, bills, payments, balance]: any[] = await Promise.all([
        Admin.findById(adminid).select("companyName").lean(),
        PurchaseOrder.find({ adminid, partyacc: acc._id, status: true }).sort({ billdate: -1, createdAt: -1 }).limit(100)
          .select("billnumber billdate totalamount productservice orderStatus cancelStatus").lean(),
        getPartyBillPositions({ partyid: acc._id, invoicemodel: "PurchaseInvoice", adminid }),
        Payment.find({ adminid, partyid: acc._id, status: true }).sort({ paymentdate: -1 }).limit(100)
          .select("paymentcode paymentdate type mode amount reference").lean(),
        getPartyRunningBalance({ partyid: acc._id, adminid }),
      ]);
      return {
        name: acc.name,
        company: company?.companyName || null,
        mobile: acc.mobile || null,
        payable: -Number(balance || 0),
        orders: orders.map((o: any) => ({
          id: String(o._id), billnumber: o.billnumber || null, billdate: o.billdate || null,
          totalamount: Number(o.totalamount) || 0, items: (o.productservice || []).length,
          orderStatus: o.cancelStatus === "cancelled" ? "cancelled" : o.orderStatus || "pending",
        })),
        bills: [...bills].sort((a: any, b: any) => String(b.billdate || "").localeCompare(String(a.billdate || ""))).slice(0, 100)
          .map((b: any) => ({ id: String(b.id), billnumber: b.billnumber || null, billdate: b.billdate || null, totalamount: Number(b.totalamount) || 0, outstanding: Number(b.outstanding) || 0 })),
        payments: payments.map((p: any) => ({
          id: String(p._id), paymentcode: p.paymentcode || null,
          paymentdate: p.paymentdate ? new Date(p.paymentdate).toISOString().slice(0, 10) : null,
          type: p.type, mode: p.mode || null, amount: Number(p.amount) || 0, reference: p.reference || null,
        })),
      };
    },
  },
  Mutation: {
    updateSupplierOrder: async (_: any, { id, lines, note }: any, context: any) => {
      const acc = await me(context);
      return editSupplierOrder(id, acc._id, acc.admin, lines || [], note);
    },
    supplierPrintLink: async (_: any, { kind, id }: any, context: any) => {
      const acc = await me(context);
      await loadSupplierDoc(kind, id, acc._id, acc.admin);
      return `/print/supplier/${printToken(kind, id, acc._id, acc.admin)}`;
    },
    loginSupplier: async (_: any, { adminId, mobile, otp }: any) => {
      const acc = await portalAccount(adminId, { mobile: String(mobile || "").trim() });
      const company: any = await Admin.findById(adminId).select("companyName").lean();
      await enforceLoginOtp({ kind: "supplier", userId: acc._id, email: acc.email, adminId, businessName: company?.companyName, otp, always: true });
      const { accessToken } = generateTokens({ id: String(acc._id), email: acc.email || acc.mobile, type: "supplier", adminid: acc.admin, branchid: acc.branchid });
      return { id: String(acc._id), accessToken, name: acc.name };
    },
  },
};
