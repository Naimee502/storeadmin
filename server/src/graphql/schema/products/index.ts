import { gql } from "apollo-server-express";

export const productServiceTypeDefs = gql`
  scalar Date

  enum VariantStatus {
    available
    sold
    returned
    damaged
    transferred
  }

  type UnitConversion {
    fromunitid: ID
    tounitid: ID
    factor: Float
  }

  type Serial {
    id: ID
    imei: String
    serialnumber: String
    lotnumber: String
    status: VariantStatus
    addedon: Date
    soldon: Date
    returnedon: Date
    remarks: String
  }

  type SalesRate {
    id: ID
    regionname: String
    currency: String
    enduser: Float
    retail: Float
    dealer: Float
    superstockist: Float
    distributor: Float
    exporter: Float
  }

  type OfferComboItem {
    productid: ID
    variantid: ID
    quantity: Float
  }

  type OfferChannel {
    enduser: Boolean
    retail: Boolean
    dealer: Boolean
    superstockist: Boolean
    distributor: Boolean
    exporter: Boolean
  }

  type Offer {
    isoffer: Boolean
    type: String
    title: String
    startdate: Date
    enddate: Date
    discounttype: String
    offerprice: Float
    comboitems: [OfferComboItem]
    channel: OfferChannel
  }

  type ProductVariant {
    id: ID
    name: String
    sku: String
    productcode: String
    productbarcode: String
    batchnumber: String
    manufacturedate: Date
    expirydate: Date
    baseunitid: ID
    salesunitid: ID
    purchaseunitid: ID
    unitConversions: [UnitConversion]
    mrp: Float
    purchaserate: Float
    gst: Float
    hsncode: String
    openingstock: Float
    openingstockamount: Float
    currentstock: Float
    currentstockamount: Float
    closingstock: Float
    closingstockamount: Float
    minimumstock: Float
    reorderlevel: Float
    racklocation: String
    isserialised: Boolean
    serials: [Serial]
    salesrate: [SalesRate]
    offer: Offer
    productlikecount: Int
  }

  type ServiceDuration {
    amount: Float
    unit: String
  }

  type AvailabilitySlot {
    day: String
    from: String
    to: String
  }

  type Recurrence {
    interval: String
    count: Int
  }

  type ServiceVariant {
    id: ID
    name: String
    servicecode: String
    servicebarcode: String
    servicerate: Float
    uom: String
    duration: ServiceDuration
    requiresappointment: Boolean
    availabilityslots: [AvailabilitySlot]
    locationType: String
    isRecurring: Boolean
    recurrence: Recurrence
    servicelikecount: Int
    remarks: String
  }

  type SEO {
    metatitle: String
    metadescription: String
    keywords: [String]
    slug: String
  }

  type ProductService {
    id: ID!
    adminid: ID!
    vendorid: ID
    branchid: ID!
    isservice: Boolean
    name: String!
    description: String
    imageurl: String
    imagename: String
    categoryid: ID
    subcategoryid: ID
    groupid: ID
    modelid: ID
    brandid: ID
    sizeid: ID
    seo: SEO
    servicevariants: [ServiceVariant]
    productvariants: [ProductVariant]
    isshowinpos: Boolean
    isfeatured: Boolean
    salesaccountid: ID
    purchaseaccountid: ID
    serviceaccountid: ID
    status: Boolean
    createdAt: Date
    updatedAt: Date
  }

  input ProductServiceFilterInput {
    id: ID
    adminid: ID
    vendorid: ID
    branchid: ID
    isservice: Boolean
    categoryid: ID
    subcategoryid: ID
    groupid: ID
    modelid: ID
    brandid: ID
    sizeid: ID
    status: Boolean
    isfeatured: Boolean
    isshowinpos: Boolean
    name_contains: String
    productcode: String
    productbarcode: String
    servicecode: String
    servicebarcode: String
    hasStockBelow: Float
    hasStockAbove: Float
    minimumstockBelow: Float
    reorderlevelBelow: Float
    priceMin: Float
    priceMax: Float
    mrpMin: Float
    mrpMax: Float
    hasOffers: Boolean
    isserialised: Boolean
    createdFrom: Date
    createdTo: Date
    updatedFrom: Date
    updatedTo: Date
  }

  input ProductServiceInput {
    adminid: ID!
    vendorid: ID
    branchid: ID!
    isservice: Boolean
    name: String!
    description: String
    imageurl: String
    imagename: String
    categoryid: ID
    subcategoryid: ID
    groupid: ID
    modelid: ID
    brandid: ID
    sizeid: ID
    seo: SEOInput
    servicevariants: [ServiceVariantInput]
    productvariants: [ProductVariantInput]
    isshowinpos: Boolean
    isfeatured: Boolean
    salesaccountid: ID
    purchaseaccountid: ID
    serviceaccountid: ID
    status: Boolean
  }

  input SEOInput {
    metatitle: String
    metadescription: String
    keywords: [String]
    slug: String
  }

  input ServiceVariantInput {
    name: String
    servicecode: String
    servicebarcode: String
    servicerate: Float
    uom: String
    duration: ServiceDurationInput
    requiresappointment: Boolean
    availabilityslots: [AvailabilitySlotInput]
    locationType: String
    isRecurring: Boolean
    recurrence: RecurrenceInput
    servicelikecount: Int
    remarks: String
  }

  input ServiceDurationInput {
    amount: Float
    unit: String
  }

  input AvailabilitySlotInput {
    day: String
    from: String
    to: String
  }

  input RecurrenceInput {
    interval: String
    count: Int
  }

  input ProductVariantInput {
    id: ID
    name: String
    sku: String
    productcode: String
    productbarcode: String
    batchnumber: String
    manufacturedate: Date
    expirydate: Date
    baseunitid: ID
    salesunitid: ID
    purchaseunitid: ID
    unitConversions: [UnitConversionInput]
    mrp: Float
    purchaserate: Float
    gst: Float
    hsncode: String
    openingstock: Float
    openingstockamount: Float
    currentstock: Float
    currentstockamount: Float
    closingstock: Float
    closingstockamount: Float
    minimumstock: Float
    reorderlevel: Float
    racklocation: String
    isserialised: Boolean
    serials: [SerialInput]
    salesrate: [SalesRateInput]
    offer: OfferInput
    productlikecount: Int
  }

  input UnitConversionInput {
    fromunitid: ID
    tounitid: ID
    factor: Float
  }

  input SerialInput {
    id: ID
    imei: String
    serialnumber: String
    lotnumber: String
    status: VariantStatus
    addedon: Date
    soldon: Date
    returnedon: Date
    remarks: String
  }

  input SalesRateInput {
    id: ID
    regionname: String
    currency: String
    enduser: Float
    retail: Float
    dealer: Float
    superstockist: Float
    distributor: Float
    exporter: Float
  }

  input OfferComboItemInput {
    productid: ID
    variantid: ID
    quantity: Float
  }

  input OfferChannelInput {
    enduser: Boolean
    retail: Boolean
    dealer: Boolean
    superstockist: Boolean
    distributor: Boolean
    exporter: Boolean
  }

  input OfferInput {
    isoffer: Boolean
    type: String
    title: String
    startdate: Date
    enddate: Date
    discounttype: String
    offerprice: Float
    comboitems: [OfferComboItemInput]
    channel: OfferChannelInput
  }

  type Query {
    getProductServices(filter: ProductServiceFilterInput, limit: Int, offset: Int): [ProductService]!
    getProductServiceById(id: ID!, adminId: ID, branchId: ID): ProductService
  }

  type Mutation {
    addProductService(input: ProductServiceInput!): ProductService
    updateProductService(id: ID!, input: ProductServiceInput!): ProductService
    deleteProductService(id: ID!): Boolean!
    resetProductService(id: ID!): Boolean!
  }
`;
