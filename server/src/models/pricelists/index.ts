import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPriceListItem {
  productid: Types.ObjectId;
  variantid: Types.ObjectId;
  unitid: Types.ObjectId;
  quantity: number;
  rate: number;
  discount: number;
  discounttype: "fixed" | "percentage";
}

export interface IPriceList extends Document {
  clientRequestId?: string;
  adminid: Types.ObjectId;
  name: string;
  description?: string;
  items: IPriceListItem[];
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const priceListSchema = new Schema<IPriceList>(
  {
    adminid: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    name: { type: String, required: true },
    description: { type: String },
    items: [
      {
        productid: { type: Schema.Types.ObjectId, ref: "ProductService", required: true },
        variantid: { type: Schema.Types.ObjectId, required: true },
        unitid: { type: Schema.Types.ObjectId, ref: "Unit", required: true },
        quantity: { type: Number, default: 1 },
        rate: { type: Number, required: true },
        discount: { type: Number, default: 0 },
        discounttype: { type: String, enum: ["fixed", "percentage"], default: "fixed" },
      },
    ],
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

priceListSchema.index({ adminid: 1, name: 1 });

// Offline sync: one document per request id; only rows that carry one are indexed.
priceListSchema.add({ clientRequestId: { type: String } });
priceListSchema.index({ adminid: 1, clientRequestId: 1 }, { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } });

export const PriceList = mongoose.model<IPriceList>("PriceList", priceListSchema);
