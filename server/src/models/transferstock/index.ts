import mongoose from 'mongoose';
import { ProductBranchStock } from '../productbranchstock';

const transferStockSchema = new mongoose.Schema({
  frombranchid: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  tobranchid: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  productid: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  transferqty: { type: Number, required: true },
  transferdate: { type: String, required: true },
  status: Boolean,
}, { timestamps: true });

transferStockSchema.post('save', async function (doc, next) {
  try {
    const { frombranchid, tobranchid, productid, transferqty } = doc;

    const bulkOps = [
      {
        updateOne: {
          filter: { productid, branchid: frombranchid },
          update: { $inc: { currentstock: -transferqty } },
          upsert: true,
        }
      },
      {
        updateOne: {
          filter: { productid, branchid: tobranchid },
          update: { $inc: { currentstock: transferqty } },
          upsert: true,
        }
      }
    ];

    await ProductBranchStock.bulkWrite(bulkOps);
    next();
  } catch (error:any) {
    console.error('Error updating ProductBranchStock for transfer stock:', error);
    next(error);
  }
});

export const TransferStock = mongoose.model('TransferStock', transferStockSchema);
