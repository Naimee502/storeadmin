import mongoose from 'mongoose';
import { ProductBranchStock } from '../productbranchstock';

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
  branchid: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  products: [
    {
      productid: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      gst: { type: Number, required: true },
      qty: { type: Number, required: true },
      rate: { type: Number, required: true },
      amount: { type: Number, required: true },
      discount: { type: Number, default: 0 },
    }
  ],
  status: { type: Boolean, default: true },
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true,
  },
}, { timestamps: true });

// 🔻 POST-SAVE STOCK DECREMENT
salesInvoiceSchema.post('save', async function (doc, next) {
  try {
    const branchid = doc.branchid;

    if (!branchid) {
      console.warn('No branchid specified on SalesInvoice, skipping stock update');
      return next();
    }

    const bulkOps = doc.products.map(product => ({
      updateOne: {
        filter: {
          productid: new mongoose.Types.ObjectId(product.productid),
          branchid: new mongoose.Types.ObjectId(branchid),
        },
        update: { $inc: { currentstock: -product.qty } },
        upsert: false,
      }
    }));

    if (bulkOps.length > 0) {
      await ProductBranchStock.bulkWrite(bulkOps);
    }

    next();
  } catch (error: any) {
    console.error('Error decrementing stock in ProductBranchStock:', error);
    next(error);
  }
});

// 🔻 STATIC: ADJUST STOCK ON EDIT
salesInvoiceSchema.statics.adjustStock = async function (oldInvoice: any, newInvoice: any) {
  const branchid = newInvoice.branchid;
  if (!branchid) return;

  const stockAdjustments: Record<string, number> = {};

  for (const p of oldInvoice.products) {
    const key = p.productid.toString();
    stockAdjustments[key] = (stockAdjustments[key] || 0) + p.qty;
  }

  for (const p of newInvoice.products) {
    const key = p.productid.toString();
    stockAdjustments[key] = (stockAdjustments[key] || 0) - p.qty;
  }

  const bulkOps = Object.entries(stockAdjustments).map(([productid, qtyChange]) => ({
    updateOne: {
      filter: {
        productid: new mongoose.Types.ObjectId(productid),
        branchid: new mongoose.Types.ObjectId(branchid),
      },
      update: { $inc: { currentstock: qtyChange } },
      upsert: false // ❌ Only update existing stock
    }
  }));

  if (bulkOps.length > 0) {
    const result = await ProductBranchStock.bulkWrite(bulkOps);
    console.log('Adjust stock bulkWrite result:', result);
  }
};

interface SalesInvoiceModel extends mongoose.Model<any> {
  adjustStock: (oldInvoice: any, newInvoice: any) => Promise<void>;
}

export const SalesInvoice = mongoose.model<any, SalesInvoiceModel>('SalesInvoice', salesInvoiceSchema);
