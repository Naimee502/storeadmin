import mongoose, { Schema, Document, Types, HydratedDocument, model } from "mongoose";
import slugify from "slugify";

/* ────────────────
   INTERFACES
──────────────── */
interface IUnitConversion {
  fromunitid: Types.ObjectId;
  tounitid: Types.ObjectId;
  factor: number;
}

interface ISerial {
  _id?: Types.ObjectId;
  imei?: string;
  serialnumber?: string;
  lotnumber?: string;
  status?: "available" | "sold" | "returned" | "damaged" | "transferred";
  addedon?: Date;
  soldon?: Date;
  returnedon?: Date;
  remarks?: string;
}

interface ISalesRate {
  _id?: Types.ObjectId;
  regionname?: string;
  currency?: string;
  enduser?: number;
  retail?: number;
  dealer?: number;
  superstockist?: number;
  distributor?: number;
  exporter?: number;
}

interface IOfferComboItem {
  productid: Types.ObjectId;
  variantid?: Types.ObjectId;
  quantity?: number;
}

interface IOffer {
  isoffer?: boolean;
  type?: "single" | "combo";
  title?: string;
  startdate?: Date;
  enddate?: Date;
  discounttype?: "fixed" | "percentage";
  offerprice?: number;
  comboitems?: IOfferComboItem[];
  channel?: {
    enduser?: boolean;
    retail?: boolean;
    dealer?: boolean;
    superstockist?: boolean;
    distributor?: boolean;
    exporter?: boolean;
  };
}

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
  salesunitid?: Types.ObjectId;
  purchaseunitid?: Types.ObjectId;
  unitConversions?: IUnitConversion[];
  mrp?: number;
  purchaserate?: number;
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
  isserialised?: boolean;
  serials?: ISerial[];
  salesrate?: ISalesRate[];
  offer?: IOffer;
  productlikecount?: number;
}

interface IServiceVariant {
  _id?: Types.ObjectId;
  name: string;
  servicecode?: string;
  servicebarcode?: string;
  servicerate?: number;
  uom?: string;
  duration?: {
    amount: number;
    unit: "minutes" | "hours";
  };
  requiresappointment?: boolean;
  availabilityslots?: {
    day: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
    from: string;
    to: string;
  }[];
  locationType?: "onsite" | "offsite" | "remote";
  isRecurring?: boolean;
  recurrence?: {
    interval: "daily" | "weekly" | "monthly";
    count: number;
  };
  servicelikecount?: number;
  remarks?: string;
}

export interface IProductService extends Document {
  adminid: Types.ObjectId;
  vendorid?: Types.ObjectId;
  branchid: Types.ObjectId;
  isservice?: boolean;
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
  seo?: {
    metatitle?: string;
    metadescription?: string;
    keywords?: string[];
    slug?: string;
  };
  servicevariants?: IServiceVariant[];
  productvariants?: IProductVariant[];
  isshowinpos?: boolean;
  isfeatured?: boolean;
  salesaccountid?: Types.ObjectId;
  purchaseaccountid?: Types.ObjectId;
  serviceaccountid?: Types.ObjectId;
  status?: boolean;
}

/* ────────────────
   SCHEMA
──────────────── */
const productServiceSchema = new Schema<IProductService>(
  {
    adminid: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    vendorid: { type: Schema.Types.ObjectId, ref: "Vendor" },
    branchid: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    isservice: { type: Boolean, default: false },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    imageurl: String,
    imagename: String,
    categoryid: { type: Schema.Types.ObjectId, ref: "Category" },
    subcategoryid: { type: Schema.Types.ObjectId, ref: "SubCategory" },
    groupid: { type: Schema.Types.ObjectId, ref: "ProductGroupName" },
    modelid: { type: Schema.Types.ObjectId, ref: "Model" },
    brandid: { type: Schema.Types.ObjectId, ref: "Brand" },
    sizeid: { type: Schema.Types.ObjectId, ref: "Size" },
    seo: {
      metatitle: String,
      metadescription: String,
      keywords: [String],
      slug: { type: String, unique: true, sparse: true },
    },
    servicevariants: [
      {
        _id: { type: Schema.Types.ObjectId, auto: true },
        name: { type: String, required: true },
        servicecode: { type: String, unique: true, sparse: true },
        servicebarcode: { type: String, unique: true, sparse: true },
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
        _id: { type: Schema.Types.ObjectId, auto: true },
        name: String,
        sku: { type: String, unique: true, sparse: true },
        productcode: { type: String, unique: true, sparse: true },
        productbarcode: { type: String, unique: true, sparse: true },
        batchnumber: String,
        manufacturedate: Date,
        expirydate: Date,
        baseunitid: { type: Schema.Types.ObjectId, ref: "Unit" },
        salesunitid: { type: Schema.Types.ObjectId, ref: "Unit" },
        purchaseunitid: { type: Schema.Types.ObjectId, ref: "Unit" },
        unitConversions: [
          {
            fromunitid: { type: Schema.Types.ObjectId, ref: "Unit" },
            tounitid: { type: Schema.Types.ObjectId, ref: "Unit" },
            factor: { type: Number, default: 1 },
          },
        ],
        mrp: { type: Number, default: 0 },
        purchaserate: { type: Number, default: 0 },
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
        isserialised: { type: Boolean, default: false },
        serials: [
          {
            _id: { type: Schema.Types.ObjectId, auto: true },
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
        salesrate: [{
          _id: { type: Schema.Types.ObjectId, auto: true },
          regionname: { type: String, default: "Default" },
          currency: { type: String, default: "INR" },
          enduser: { type: Number, default: 0 },
          retail: { type: Number, default: 0 },
          dealer: { type: Number, default: 0 },
          superstockist: { type: Number, default: 0 },
          distributor: { type: Number, default: 0 },
          exporter: { type: Number, default: 0 },
        }],
        offer: {
          isoffer: { type: Boolean, default: false },
          type: { type: String, enum: ["single", "combo"], default: "single" },
          title: String,
          startdate: Date,
          enddate: Date,
          discounttype: { type: String, enum: ["fixed", "percentage"], default: "fixed" },
          offerprice: Number,
          comboitems: [
            {
              productid: { type: Schema.Types.ObjectId, ref: "ProductService" },
              variantid: { type: Schema.Types.ObjectId },
              quantity: { type: Number, default: 0 },
            },
          ],
          channel: {
            enduser: { type: Boolean, default: false },
            retail: { type: Boolean, default: false },
            dealer: { type: Boolean, default: false },
            superstockist: { type: Boolean, default: false },
            distributor: { type: Boolean, default: false },
            exporter: { type: Boolean, default: false },
          },
        },
        productlikecount: { type: Number, default: 0 },
      },
    ],
    isshowinpos: { type: Boolean, default: false },
    isfeatured: { type: Boolean, default: false },
    salesaccountid: { type: Schema.Types.ObjectId, ref: "Account" },
    purchaseaccountid: { type: Schema.Types.ObjectId, ref: "Account" },
    serviceaccountid: { type: Schema.Types.ObjectId, ref: "Account" },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productServiceSchema.index({ admin: 1, branchid: 1 });
productServiceSchema.index({ name: 1 });
productServiceSchema.index({ "seo.slug": 1 });
productServiceSchema.index({ "productvariants.productbarcode": 1 });
productServiceSchema.index({ "servicevariants.servicebarcode": 1 });

productServiceSchema.pre("save", async function (next) {
  const doc = this as HydratedDocument<IProductService>;
  const Product = model<IProductService>("ProductService");

  if (!doc.seo?.slug && doc.name) {
    doc.seo = doc.seo || {};
    doc.seo.slug = slugify(doc.name, { lower: true, strict: true });
  }

  if (Array.isArray(doc.productvariants)) {
    for (let variant of doc.productvariants) {
      if (!variant.productcode) {
        const last = await Product.findOne({
          "productvariants.productcode": /^#PRD\d{4}$/
        }).sort({ "productvariants.productcode": -1 });

        const nextNum =
          last?.productvariants?.[0]?.productcode
            ? parseInt(last.productvariants[0].productcode.slice(4)) + 1
            : 1;

        variant.productcode = `#PRD${nextNum.toString().padStart(4, "0")}`;
      }

      if (!variant.productbarcode && Array.isArray(variant.salesrate) && variant.salesrate.length > 0) {
        const primaryRate = variant.salesrate.find((r) => r.enduser && r.enduser > 0) || variant.salesrate[0];
        const date = String(new Date().getDate()).padStart(2, "0");
        const price = String(Math.round(primaryRate.enduser || 0)).padStart(3, "0");
        const prefix = `${date}${price}`;

        const last = await Product.findOne({
          "productvariants.productbarcode": new RegExp(`^${prefix}`)
        }).sort({ "productvariants.productbarcode": -1 });

        const lastNum =
          last?.productvariants?.[0]?.productbarcode
            ? parseInt(last.productvariants[0].productbarcode.slice(5)) + 1
            : 1;

        variant.productbarcode = `${prefix}${String(lastNum).padStart(6, "0")}`;
      }
    }
  }

  if (Array.isArray(doc.servicevariants)) {
    for (let variant of doc.servicevariants) {
      if (!variant.servicecode) {
        const last = await Product.findOne({
          "servicevariants.servicecode": /^#SVC\d{4}$/
        }).sort({ "servicevariants.servicecode": -1 });

        const nextNum =
          last?.servicevariants?.[0]?.servicecode
            ? parseInt(last.servicevariants[0].servicecode.slice(4)) + 1
            : 1;

        variant.servicecode = `#SVC${nextNum.toString().padStart(4, "0")}`;
      }

      if (!variant.servicebarcode && variant.servicerate !== undefined && variant.servicerate > 0) {
        const date = String(new Date().getDate()).padStart(2, "0");
        const rate = String(Math.round(variant.servicerate)).padStart(3, "0");
        const prefix = `${date}${rate}`;

        const last = await Product.findOne({
          "servicevariants.servicebarcode": new RegExp(`^${prefix}`)
        }).sort({ "servicevariants.servicebarcode": -1 });

        const lastNum =
          last?.servicevariants?.[0]?.servicebarcode
            ? parseInt(last.servicevariants[0].servicebarcode.slice(5)) + 1
            : 1;

        variant.servicebarcode = `${prefix}${String(lastNum).padStart(6, "0")}`;
      }
    }
  }

  next();
});

export const ProductService = mongoose.model<IProductService>("ProductService", productServiceSchema);
