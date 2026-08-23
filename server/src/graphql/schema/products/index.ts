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
    unitprices: [UnitPrice]
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
    isserialised: Boolean
    name: String!
    description: String
    imageurl: String
    imagename: String
    # Full gallery — imageurl mirrors imageurls[0] for older consumers.
    imageurls: [String]

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
    # adminid / branchid are resolved from the caller's token server-side and
    # whatever arrives here is discarded. Kept on the input (nullable) so the
    # existing web panel and mobile app keep compiling unchanged.
    adminid: ID
    vendorid: ID
    branchid: ID
    isservice: Boolean
    isserialised: Boolean
    name: String!
    description: String
    imageurl: String
    imagename: String
    imageurls: [String]
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
    unitprices: [UnitPriceInput]
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

  # ---------------- Import / Export ----------------

  type ImportMasterOption {
    id: ID!
    name: String!
    parentid: ID
  }

  """Every dropdown list the spreadsheet template needs, in one round trip."""
  type ProductImportMasters {
    adminid: ID!
    branchid: ID
    categories: [ImportMasterOption!]!
    subcategories: [ImportMasterOption!]!
    brands: [ImportMasterOption!]!
    models: [ImportMasterOption!]!
    sizes: [ImportMasterOption!]!
    groups: [ImportMasterOption!]!
    units: [ImportMasterOption!]!
    ledgers: [ImportMasterOption!]!
  }

  type ProductImportIssue {
    ref: String
    sheet: String
    row: Int
    field: String
    message: String!
  }

  type ProductImportResult {
    total: Int!
    created: Int!
    updated: Int!
    skipped: Int!
    dryRun: Boolean!
    errors: [ProductImportIssue!]!
  }

  input ProductImportInput {
    """CREATE (default) refuses rows whose product code already exists; UPSERT overwrites them."""
    mode: String
    """Validate and report without writing anything. Powers the review screen."""
    dryRun: Boolean
    """Write nothing at all if any row fails, instead of importing the good ones."""
    abortOnError: Boolean
    products: [ProductServiceInput!]!
    """Row labels, parallel to products, used in the error report."""
    refs: [String!]
  }

  type Query {
    getProductServices(filter: ProductServiceFilterInput, limit: Int, offset: Int): [ProductService]!
    getProductServiceById(id: ID!, adminId: ID, branchId: ID): ProductService
    getProductImportMasters: ProductImportMasters!
  }

  type Mutation {
    addProductService(input: ProductServiceInput!): ProductService
    updateProductService(id: ID!, input: ProductServiceInput!): ProductService
    deleteProductService(id: ID!): Boolean!
    resetProductService(id: ID!): Boolean!
    importProductServices(input: ProductImportInput!): ProductImportResult!
  }
`;
