import mongoose from 'mongoose';
import { Account } from '../../models/accounts';
import { AccountGroup } from '../../models/accountgroups';

export const getOrCreateAccount = async (
  accountName: string,
  accountType: string,
  adminId: string | mongoose.Types.ObjectId,
  branchId: string | mongoose.Types.ObjectId,
  groupName: string = "GST Account"
) => {
  // Ensure IDs are ObjectId
  const adminObjId = typeof adminId === 'string' ? new mongoose.Types.ObjectId(adminId) : adminId;
  const branchObjId = typeof branchId === 'string' ? new mongoose.Types.ObjectId(branchId) : branchId;

  // 1️⃣ Check if account already exists
  let account = await Account.findOne({ name: accountName, admin: adminObjId, branchid: branchObjId }).exec();
  if (account) return account;

  // 2️⃣ Get or create AccountGroup
  let group = await AccountGroup.findOne({ accountgroupname: groupName, admin: adminObjId }).exec();
  if (!group) {
    group = await AccountGroup.create({
      accountgroupname: groupName,
      category: 'liabilities', // default category; adjust as needed
      admin: adminObjId,
    });
    console.log(`Created default account group: ${groupName} with id ${group._id}`);
  }

  // 3️⃣ Create the account
  account = await Account.create({
    name: accountName,
    type: accountType,
    admin: adminObjId,
    branchid: branchObjId,
    accountgroupid: group._id,
  });

  console.log(`Created default account: ${accountName} with id ${account._id}`);
  return account;
};


export const defaultAccountGroups = [
  // CAPITAL & LIABILITIES
  { name: "Capital Account", category: "liabilities" },
  { name: "Reserves & Surplus", category: "liabilities" },
  { name: "Loans (Liability)", category: "liabilities" },
  { name: "Bank OD A/c", category: "liabilities" },
  { name: "Sundry Creditors", category: "liabilities" },
  { name: "Duties & Taxes", category: "liabilities" },
  { name: "GST Output", category: "liabilities" }, // Main header
  { name: "Output CGST", category: "liabilities" },
  { name: "Output SGST", category: "liabilities" },
  { name: "Output IGST", category: "liabilities" },
  { name: "Provisions", category: "liabilities" },
  { name: "Salary Payable", category: "liabilities" },
  { name: "Outstanding Liabilities", category: "liabilities" },

  // ASSETS
  { name: "Fixed Assets", category: "assets" },
  { name: "Investments", category: "assets" },
  { name: "Loans & Advances (Assets)", category: "assets" },
  { name: "Bank Accounts", category: "assets" },
  { name: "Cash-in-Hand", category: "assets" },
  { name: "Sundry Debtors", category: "assets" },
  { name: "Current Assets", category: "assets" },
  { name: "Stock-in-Hand", category: "assets" },
  { name: "Prepaid Expenses", category: "assets" },
  { name: "Deposits (Assets)", category: "assets" },
    { name: "Salesman Account", category: "expenses" },

  // GST INPUT (RECEIVABLE)
  { name: "GST Input", category: "assets" }, // Main header
  { name: "Input CGST", category: "assets" },
  { name: "Input SGST", category: "assets" },
  { name: "Input IGST", category: "assets" },

  // INCOME
  { name: "Sales Account", category: "income" },
  { name: "Direct Income", category: "income" },
  { name: "Indirect Income", category: "income" },
  { name: "Other Income", category: "income" },
  { name: "Service Income", category: "income" },

  // EXPENSES
  { name: "Purchase Account", category: "expenses" },
  { name: "Direct Expenses", category: "expenses" },
  { name: "Indirect Expenses", category: "expenses" },
  { name: "Administrative Expenses", category: "expenses" },
  { name: "Selling & Distribution Expenses", category: "expenses" },
  { name: "Depreciation", category: "expenses" },
  { name: "Finance Charges", category: "expenses" },
  { name: "Commission Expense", category: "expenses" },
];


export const defaultLedgers = [
  // Capital & Drawings
  { name: "Capital", group: "Capital Account" },
  { name: "Drawings", group: "Capital Account" },

  // Cash & Bank
  { name: "Cash", group: "Cash-in-Hand" },
  { name: "Bank Account", group: "Bank Accounts" },
  { name: "Bank OD", group: "Bank OD A/c" },

  // Debtors & Creditors
  { name: "Sundry Debtors", group: "Sundry Debtors" },
  { name: "Sundry Creditors", group: "Sundry Creditors" },

  // Advances
  { name: "Advance to Suppliers", group: "Loans & Advances (Assets)" },
  { name: "Advance from Customers", group: "Current Liabilities" },

  // Sales / Purchase
  { name: "Sales Account", group: "Sales Account" },
  { name: "Sales Return", group: "Sales Account" },     
  { name: "Purchase Account", group: "Purchase Account" },
  { name: "Purchase Return", group: "Purchase Account" }, 

  // GST Ledgers
  { name: "Input CGST", group: "Input CGST" },
  { name: "Input SGST", group: "Input SGST" },
  { name: "Input IGST", group: "Input IGST" },
  { name: "Output CGST", group: "Output CGST" },
  { name: "Output SGST", group: "Output SGST" },
  { name: "Output IGST", group: "Output IGST" },

  // GST Adjustment
  { name: "GST Payable", group: "Duties & Taxes" },
  { name: "GST Receivable", group: "Duties & Taxes" },

  // Expenses
  { name: "Office Expense", group: "Administrative Expenses" },
  { name: "Travel Expense", group: "Selling & Distribution Expenses" },
  { name: "Staff Salary", group: "Direct Expenses" },
  { name: "Freight / Transport Charges", group: "Direct Expenses" },
  { name: "Packing Charges", group: "Direct Expenses" },
  { name: "Electricity Charges", group: "Administrative Expenses" },
  { name: "Telephone Expense", group: "Administrative Expenses" },
  { name: "Bank Charges", group: "Finance Charges" },
  { name: "Interest Paid", group: "Finance Charges" },
  { name: "Salesman Commission Expense", group: "Commission Expense" },
  { name: "Staff Expenses", group: "Direct Expenses" },

  // Income
  { name: "Interest Received", group: "Indirect Income" },
  { name: "Other Income", group: "Indirect Income" },
  { name: "Discount Received", group: "Indirect Income" },
  { name: "Discount Allowed", group: "Indirect Expenses" },

  // Rounding
  { name: "Round Off", group: "Indirect Expenses" }
];



