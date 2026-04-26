import mongoose, { Document, Schema } from "mongoose";

export interface IProductPrice extends Document {
  product: mongoose.Types.ObjectId;
  channel: mongoose.Types.ObjectId;
  admin: mongoose.Types.ObjectId;
  mrp: number;
  salesPrice: number;
  minSalesPrice: number;
  status: boolean;
}

const ProductPriceSchema: Schema<IProductPrice> = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    channel: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", required: true },
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    mrp: { type: Number, default: 0 },
    salesPrice: { type: Number, default: 0 },
    minSalesPrice: { type: Number, default: 0 },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Unique price per product per channel for a given admin
ProductPriceSchema.index({ admin: 1, product: 1, channel: 1 }, { unique: true });

export const ProductPrice = mongoose.model<IProductPrice>("ProductPrice", ProductPriceSchema);
