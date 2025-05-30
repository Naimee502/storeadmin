import mongoose from 'mongoose';
import { ProductBranchStock } from '../productbranchstock';

const purchaseInvoiceSchema = new mongoose.Schema({
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
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      gst: { type: Number, required: true },
      qty: { type: Number, required: true },
      rate: { type: Number, required: true },
      amount: { type: Number, required: true },
    }
  ],

  status: { type: Boolean, default: true },
}, { timestamps: true });

/**
 * After saving an invoice, increase stock quantities in ProductBranchStock collection
 */
purchaseInvoiceSchema.post('save', async function(doc, next) {
  try {
    const branchid = doc.branchid;

    if (!branchid) {
      console.warn('No branchid specified on PurchaseInvoice, skipping stock update');
      return next();
    }

    const bulkOps = doc.products.map(product => ({
      updateOne: {
        filter: { productid: product.id, branchid },
        update: { $inc: { currentstock: product.qty } }  // +qty instead of -qty
      }
    }));

    if (bulkOps.length > 0) {
      await ProductBranchStock.bulkWrite(bulkOps);
    }

    next();
  } catch (error: any) {
    console.error('Error incrementing stock in ProductBranchStock:', error);
    next(error);
  }
});

export const PurchaseInvoice = mongoose.model('PurchaseInvoice', purchaseInvoiceSchema);
