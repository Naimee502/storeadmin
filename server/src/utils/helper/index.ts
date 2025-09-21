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
