import mongoose from 'mongoose';
import { Branch } from '../branches';
import { ProductBranchStock } from '../productbranchstock';

const productSchema = new mongoose.Schema({
   branchid: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  productcode: { type: String, unique: true },
  name: { type: String, required: true },
  barcode: { type: String, unique: true, sparse: true },
  productimage: String,
  productimageurl: String,
  categoryid: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  productgroupnameid: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductGroupName', required: true },
  modelid: { type: mongoose.Schema.Types.ObjectId, ref: 'Model', required: true },
  brandid: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true },
  sizeid: { type: mongoose.Schema.Types.ObjectId, ref: 'Size', required: true },
  purchaseunitid: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
  purchaserate: { type: Number, required: true },
  salesunitid: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
  salesrate: { type: Number, required: true },
  gst: { type: Number, default: 0 },
  openingstock: { type: Number, default: 0 },
  openingstockamount: { type: Number, default: 0 },
  currentstock: { type: Number, default: 0 },
  currentstockamount: { type: Number, default: 0 },
  minimumstock: { type: Number, default: 0 },
  description: { type: String, default: '' },
  productlikecount: { type: Number, default: 0 },
  status: { type: Boolean, default: true }
}, { timestamps: true });

/**
 * Generate product code and barcode before save
 */
productSchema.pre('save', async function (next) {
  const Product = mongoose.model('Product');

  if (!this.productcode) {
    const lastProduct = await Product.findOne({ productcode: { $regex: /^#PRD\d{4}$/ } }).sort({ productcode: -1 });
    let nextNumber = 1;
    if (lastProduct?.productcode) {
      const last = parseInt(lastProduct.productcode.replace('#PRD', ''), 10);
      if (!isNaN(last)) nextNumber = last + 1;
    }
    this.productcode = `#PRD${nextNumber.toString().padStart(4, '0')}`;
  }

  if (!this.barcode && this.salesrate) {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const price = String(Math.round(this.salesrate)).padStart(3, '0');
    const prefix = `${day}${price}`;

    const lastProduct = await Product.findOne({ barcode: { $regex: new RegExp(`^${prefix}`) } }).sort({ barcode: -1 });

    let uniqueNum = 1;
    if (lastProduct?.barcode) {
      const lastUnique = parseInt(lastProduct.barcode.slice(5), 10);
      if (!isNaN(lastUnique)) uniqueNum = lastUnique + 1;
    }

    const uniquePart = String(uniqueNum).padStart(6, '0');
    this.barcode = `${prefix}${uniquePart}`;
  }

  next();
});

/**
 * After saving the product, create stock entries for all active branches
 */
productSchema.post('save', async function (doc, next) {
  try {
    const branches = await Branch.find({ status: true });

    const stockEntries = branches.map(branch => {
      const isCurrentBranch = branch._id.toString() === doc.branchid?.toString();

      return {
        productid: doc._id,
        branchid: branch._id,
        openingstock: isCurrentBranch ? doc.openingstock : 0,
        openingstockamount: isCurrentBranch ? doc.openingstockamount : 0,
        currentstock: isCurrentBranch ? doc.currentstock : 0,
        currentstockamount: isCurrentBranch ? doc.currentstockamount : 0,
        minimumstock: doc.minimumstock ?? 0
      };
    });

    await ProductBranchStock.insertMany(stockEntries);
  } catch (err) {
    console.error('Error creating ProductBranchStock entries:', err);
  }

  next();
});

/**
 * On product update, if stock-related fields are present and branchid is provided,
 * update stock only for that specific branch.
 */
productSchema.post('findOneAndUpdate', async function (doc) {
  if (!doc) return;

  const update = this.getUpdate() as any; // 👈 Cast to any or custom type

  const updatedFields = ('$set' in update ? update.$set : update) || {};
  const branchid = updatedFields.branchid;

  if (!branchid) return;

  const stockFieldsToUpdate: Record<string, any> = {};

  if ('openingstock' in updatedFields) stockFieldsToUpdate.openingstock = updatedFields.openingstock;
  if ('openingstockamount' in updatedFields) stockFieldsToUpdate.openingstockamount = updatedFields.openingstockamount;
  if ('currentstock' in updatedFields) stockFieldsToUpdate.currentstock = updatedFields.currentstock;
  if ('currentstockamount' in updatedFields) stockFieldsToUpdate.currentstockamount = updatedFields.currentstockamount;
  if ('minimumstock' in updatedFields) stockFieldsToUpdate.minimumstock = updatedFields.minimumstock;

  if (Object.keys(stockFieldsToUpdate).length > 0) {
    try {
      await ProductBranchStock.updateOne(
        { productid: doc._id, branchid },
        { $set: stockFieldsToUpdate }
      );
    } catch (err) {
      console.error('Error updating ProductBranchStock entry for specific branch:', err);
    }
  }
});


export const Product = mongoose.model('Product', productSchema);
