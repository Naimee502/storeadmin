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

  # Sub Types
  type UnitConversion {
    unitid: Unit
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

  type UnitPrice {
    quantity: Float! 
    unitid: Unit
    mrp: Float
    salesrate: Float
    minsalesrate: Float
    discount: Float
    discounttype: String
    offerprice: Float
    productbarcode: String
  }

  type Pricing {
    region: ID
    channel: Channel
    unitprices: [UnitPrice]
  }

  type ProductVariant {
    id: ID
    name: String
    sku: String
    productcode: String
    batchnumber: String
    manufacturedate: Date
    expirydate: Date
    baseunitid: Unit
    purchaseunitid: Unit
    purchaserate: Float       
    unitconversions: [UnitConversion]
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
    serials: [Serial]
    pricing: [Pricing]
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
    isshowinpos: Boolean
    isfeatured: Boolean
    isserialised: Boolean
    name: String!
    description: String
    imageurl: String
    imagename: String

    categoryid: Category
    subcategoryid: SubCategory
    groupid: ProductGroup
    modelid: Model
    brandid: Brand
    sizeid: Size

    seo: SEO
    servicevariants: [ServiceVariant]
    productvariants: [ProductVariant]

    salesaccountid: AccountLedger
    purchaseaccountid: AccountLedger
    serviceaccountid: AccountLedger

    status: Boolean
    createdAt: Date
    updatedAt: Date
  }

  # Filter Input
  input ProductServiceFilterInput {
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
    createdFrom: Date
    createdTo: Date
    updatedFrom: Date
    updatedTo: Date
  }

  # Input Types
  input ProductServiceInput {
    id: ID
    adminid: ID!
    vendorid: ID
    branchid: ID!
    isservice: Boolean
    isshowinpos: Boolean
    isfeatured: Boolean
    isserialised: Boolean
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
    batchnumber: String
    manufacturedate: Date
    expirydate: Date
    baseunitid: ID
    purchaseunitid: ID       
    purchaserate: Float
    unitconversions: [UnitConversionInput]
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
    serials: [SerialInput]
    pricing: [PricingInput]
    productlikecount: Int
  }

  input UnitConversionInput {
    unitid: ID
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

  input PricingInput {
    region: String
    channel: String
    unitprices: [UnitPriceInput]
  }

  input UnitPriceInput {
    quantity: Float!
    unitid: ID
    mrp: Float
    salesrate: Float
    minsalesrate: Float
    purchaserate: Float
    discount: Float
    discounttype: String
    offerprice: Float
    productbarcode: String
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
