import mongoose, { Schema, Document, Types, HydratedDocument, model } from "mongoose";
import slugify from "slugify";

// 🔹 Unit Conversion
export interface IUnitConversion {
  unitid: Types.ObjectId;
  factor: number;
}

// 🔹 Serial
export interface ISerial {
  imei?: string;
  serialnumber?: string;
  lotnumber?: string;
  status?: "available" | "sold" | "returned" | "damaged" | "transferred";
  addedon?: Date;
  soldon?: Date;
  returnedon?: Date;
  remarks?: string;
}

// 🔹 Unit Price (for sales only)
export interface IUnitPrice {
  unitid: Types.ObjectId;
  quantity: number;
  mrp: number;
  salesrate: number;
  minsalesrate: number;
  discount: number;
  discounttype: "fixed" | "percentage";
  offerprice: number;
}

// 🔹 Pricing (per region & channel)
export interface IPricing {
  region: string; // e.g., "default" | "andhra_pradesh" ...
  channel: any; // e.g., "enduser" or ObjectId ref
  unitprices: IUnitPrice[];
}

// 🔹 Product Variant
export interface IProductVariant {
  _id?: Types.ObjectId;
  name?: string;
  sku?: string;
  productcode?: string;
  productbarcode?: string;
  batchnumber?: string;
  manufacturedate?: Date;
  expirydate?: Date;
  baseunitid?: Types.ObjectId;
  purchaseunitid?: Types.ObjectId; // unit in which product is purchased
  purchaserate?: number; // SINGLE purchase rate
  unitconversions?: IUnitConversion[];
  gst?: number;
  hsncode?: string;
  openingstock?: number;
  openingstockamount?: number;
  currentstock?: number;
  currentstockamount?: number;
  closingstock?: number;
  closingstockamount?: number;
  minimumstock?: number;
  reorderlevel?: number;
  racklocation?: string;
  serials?: ISerial[];
  pricing?: IPricing[]; // sales pricing only
  productlikecount?: number;
}

// 🔹 Service Variant
export interface IServiceVariant {
  name: string;
  servicecode?: string;
  servicebarcode?: string;
  servicerate?: number;
  uom?: string;
  duration?: { amount: number; unit: "minutes" | "hours" };
  requiresappointment?: boolean;
  availabilityslots?: { day: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"; from: string; to: string }[];
  locationType?: "onsite" | "offsite" | "remote";
  isRecurring?: boolean;
  recurrence?: { interval: "daily" | "weekly" | "monthly"; count: number };
  servicelikecount?: number;
  remarks?: string;
}

// 🔹 SEO
export interface ISEO {
  metatitle?: string;
  metadescription?: string;
  keywords?: string[];
  slug?: string;
}

// 🔹 Main ProductService
export interface IProductService extends Document {
  adminid: Types.ObjectId;
  vendorid?: Types.ObjectId;
  branchid: Types.ObjectId;
  isservice: boolean;
  isserialised: boolean;
  isshowinpos?: boolean;
  isfeatured?: boolean;
  name: string;
  description?: string;
  imageurl?: string;
  imagename?: string;
  categoryid?: Types.ObjectId;
  subcategoryid?: Types.ObjectId;
  groupid?: Types.ObjectId;
  modelid?: Types.ObjectId;
  brandid?: Types.ObjectId;
  sizeid?: Types.ObjectId;
  seo?: ISEO;
  servicevariants?: IServiceVariant[];
  productvariants?: IProductVariant[];
  salesaccountid?: Types.ObjectId;
  purchaseaccountid?: Types.ObjectId;
  serviceaccountid?: Types.ObjectId;
  status?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// 🔹 Schema Definition
const productServiceSchema = new Schema<IProductService>(
  {
    adminid: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    vendorid: { type: Schema.Types.ObjectId, ref: "Vendor" },
    branchid: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    isservice: { type: Boolean, default: false },
    isshowinpos: { type: Boolean, default: false },
    isfeatured: { type: Boolean, default: false },
    isserialised: { type: Boolean, default: false },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    imageurl: String,
    imagename: String,
    categoryid: { type: Schema.Types.ObjectId, ref: "Category" },
    subcategoryid: { type: Schema.Types.ObjectId, ref: "SubCategory" },
    groupid: { type: Schema.Types.ObjectId, ref: "ProductGroup" },
    modelid: { type: Schema.Types.ObjectId, ref: "Model" },
    brandid: { type: Schema.Types.ObjectId, ref: "Brand" },
    sizeid: { type: Schema.Types.ObjectId, ref: "Size" },
    seo: {
      metatitle: String,
      metadescription: String,
      keywords: [String],
      slug: { type: String },
    },
    servicevariants: [
      {
        name: { type: String, required: true },
        servicecode: { type: String },
        servicebarcode: { type: String },
        servicerate: Number,
        uom: { type: String, default: "hour" },
        duration: {
          amount: { type: Number, default: 1 },
          unit: { type: String, enum: ["minutes", "hours"], default: "hours" },
        },
        requiresappointment: { type: Boolean, default: true },
        availabilityslots: [
          {
            day: { type: String, enum: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] },
            from: String,
            to: String,
          },
        ],
        locationType: { type: String, enum: ["onsite", "offsite", "remote"], default: "onsite" },
        isRecurring: { type: Boolean, default: false },
        recurrence: {
          interval: { type: String, enum: ["daily", "weekly", "monthly"], default: "monthly" },
          count: { type: Number, default: 1 },
        },
        servicelikecount: { type: Number, default: 0 },
        remarks: String,
      },
    ],
    productvariants: [
      {
        name: String,
        sku: { type: String },
        productcode: { type: String },
        productbarcode: { type: String },
        batchnumber: String,
        manufacturedate: Date,
        expirydate: Date,
        baseunitid: { type: Schema.Types.ObjectId, ref: "Unit" },
        purchaseunitid: { type: Schema.Types.ObjectId, ref: "Unit" },
        purchaserate: { type: Number, default: 0 },
        unitconversions: [
          {
            unitid: { type: Schema.Types.ObjectId, ref: "Unit" },
            factor: { type: Number, default: 1 },
          },
        ],
        gst: { type: Number, default: 0 },
        hsncode: String,
        openingstock: { type: Number, default: 0 },
        openingstockamount: { type: Number, default: 0 },
        currentstock: { type: Number, default: 0 },
        currentstockamount: { type: Number, default: 0 },
        closingstock: { type: Number, default: 0 },
        closingstockamount: { type: Number, default: 0 },
        minimumstock: Number,
        reorderlevel: Number,
        racklocation: String,
        serials: [
          {
            imei: String,
            serialnumber: String,
            lotnumber: String,
            status: {
              type: String,
              enum: ["available", "sold", "returned", "damaged", "transferred"],
              default: "available",
            },
            addedon: { type: Date, default: Date.now },
            soldon: Date,
            returnedon: Date,
            remarks: String,
          },
        ],
        pricing: [
          {
            region: {
              type: String,
              enum: [
                "default",
                "andhra_pradesh", "arunachal_pradesh", "assam", "bihar", "chhattisgarh",
                "goa", "gujarat", "haryana", "himachal_pradesh", "jharkhand", "karnataka",
                "kerala", "madhya_pradesh", "maharashtra", "manipur", "meghalaya", "mizoram",
                "nagaland", "odisha", "punjab", "rajasthan", "sikkim", "tamil_nadu",
                "telangana", "tripura", "uttar_pradesh", "uttarakhand", "west_bengal",
                "andaman_nicobar", "chandigarh", "dadra_nagar_haveli_daman_diu", "delhi",
                "jammu_kashmir", "ladakh", "lakshadweep", "puducherry",
                "international"
              ],
              default: "default"
            },
            channel: {
              type: Schema.Types.Mixed, // Can be legacy string ("enduser") or ObjectId ref
              ref: "Channel",
              default: "enduser",
            },
            unitprices: [
              {
                quantity: { type: Number, default: 1 },
                unitid: { type: Schema.Types.ObjectId, ref: "Unit", required: true },
                mrp: { type: Number, default: 0 },
                salesrate: { type: Number, default: 0 },
                minsalesrate: { type: Number, default: 0 },
                discount: { type: Number, default: 0 },
                discounttype: { type: String, enum: ["fixed", "percentage"], default: "fixed" },
                offerprice: { type: Number, default: 0 },
              },
            ],
          },
        ],
        productlikecount: { type: Number, default: 0 },
      },
    ],
    salesaccountid: { type: Schema.Types.ObjectId, ref: "AccountLedger" },
    purchaseaccountid: { type: Schema.Types.ObjectId, ref: "AccountLedger" },
    serviceaccountid: { type: Schema.Types.ObjectId, ref: "AccountLedger" },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// 🔹 Indexes
productServiceSchema.index({ adminid: 1, branchid: 1 });
productServiceSchema.index({ name: 1 });
productServiceSchema.index({ "seo.slug": 1 });
productServiceSchema.index(
  { adminid: 1, branchid: 1, "productvariants.productcode": 1 },
  { 
    unique: true, 
    partialFilterExpression: { "productvariants.productcode": { $type: "string" } } 
  }
);
productServiceSchema.index(
  { adminid: 1, branchid: 1, "productvariants.productbarcode": 1 },
  { 
    unique: true, 
    partialFilterExpression: { "productvariants.productbarcode": { $type: "string" } } 
  }
);

productServiceSchema.index(
  { adminid: 1, branchid: 1, "servicevariants.servicecode": 1 },
  { 
    unique: true, 
    partialFilterExpression: { "servicevariants.servicecode": { $type: "string" } } 
  }
);
productServiceSchema.index(
  { adminid: 1, branchid: 1, "servicevariants.servicebarcode": 1 },
  { 
    unique: true, 
    partialFilterExpression: { "servicevariants.servicebarcode": { $type: "string" } } 
  }
);

// 🔹 Pre-save hook
productServiceSchema.pre("save", async function (next) {
  const doc = this as HydratedDocument<IProductService>;
  const Product = model<IProductService>("ProductService");

  if (!doc.seo?.slug && doc.name) {
    doc.seo = doc.seo || {};
    doc.seo.slug = slugify(doc.name, { lower: true, strict: true });
  }

  // 🔹 Auto-generate product codes & barcodes
  if (Array.isArray(doc.productvariants)) {
    for (let variant of doc.productvariants) {
      // Auto-generate productcode (#PRD0001, #PRD0002, ...)
      if (!variant.productcode) {
        const last = await Product.findOne({
          adminid: doc.adminid,
          branchid: doc.branchid,
          "productvariants.productcode": /^#PRD\d{4,}$/
        }).sort({ "productvariants.productcode": -1 });

        const nextNum =
          last?.productvariants?.[0]?.productcode
            ? parseInt(last.productvariants[0].productcode.replace("#PRD", "")) + 1
            : 1;

        variant.productcode = `#PRD${String(nextNum).padStart(4, "0")}`;
      }

      // Auto-generate productbarcode
      if (!variant.productbarcode && Array.isArray(variant.pricing) && variant.pricing.length > 0) {
        // Pick first salesrate from unitprices
        const primaryPrice =
          variant.pricing[0]?.unitprices?.[0]?.salesrate ?? 0;

        if (primaryPrice > 0) {
          const date = String(new Date().getDate()).padStart(2, "0");
          const price = String(Math.round(primaryPrice)).padStart(3, "0");
          const prefix = `${date}${price}`;

          const last = await Product.findOne({
             adminid: doc.adminid,
             branchid: doc.branchid,
            "productvariants.productbarcode": new RegExp(`^${prefix}`)
          }).sort({ "productvariants.productbarcode": -1 });

          const lastNum =
            last?.productvariants?.[0]?.productbarcode
              ? parseInt(last.productvariants[0].productbarcode.slice(prefix.length)) + 1
              : 1;

          variant.productbarcode = `${prefix}${String(lastNum).padStart(6, "0")}`;
        }
      }
    }
  }

  // 🔹 Auto-generate service codes & barcodes
  if (Array.isArray(doc.servicevariants)) {
    for (let variant of doc.servicevariants) {
      // Auto-generate servicecode (#SVC0001, #SVC0002, ...)
      if (!variant.servicecode) {
        const last = await Product.findOne({
          adminid: doc.adminid,
          branchid: doc.branchid,
          "servicevariants.servicecode": /^#SVC\d{4,}$/
        }).sort({ "servicevariants.servicecode": -1 });

        const nextNum =
          last?.servicevariants?.[0]?.servicecode
            ? parseInt(last.servicevariants[0].servicecode.replace("#SVC", "")) + 1
            : 1;

        variant.servicecode = `#SVC${String(nextNum).padStart(4, "0")}`;
      }

      // Auto-generate servicebarcode
      if (!variant.servicebarcode && variant.servicerate !== undefined && variant.servicerate > 0) {
        const date = String(new Date().getDate()).padStart(2, "0");
        const rate = String(Math.round(variant.servicerate)).padStart(3, "0");
        const prefix = `${date}${rate}`;

        const last = await Product.findOne({
          adminid: doc.adminid,
          branchid: doc.branchid,
          "servicevariants.servicebarcode": new RegExp(`^${prefix}`)
        }).sort({ "servicevariants.servicebarcode": -1 });

        const lastNum =
          last?.servicevariants?.[0]?.servicebarcode
            ? parseInt(last.servicevariants[0].servicebarcode.slice(prefix.length)) + 1
            : 1;

        variant.servicebarcode = `${prefix}${String(lastNum).padStart(6, "0")}`;
      }
    }
  }

  next();
});

export const ProductService = mongoose.model<IProductService>(
  "ProductService",
  productServiceSchema
);
