export type FormFieldConfig = {
  id: string;
  label: string;
};

export type FormSectionConfig = {
  id: string;
  label: string;
  fields: FormFieldConfig[];
};

export type FormConfig = {
  moduleId: string;
  label: string;
  sections: FormSectionConfig[];
};

export const FORM_PERMISSIONS_CONFIG: FormConfig[] = [
  {
    moduleId: "accounts", // Party Accounts
    label: "Party Account Fields",
    sections: [
      {
        id: "account_info",
        label: "Account Info",
        fields: [
          { id: "name", label: "Name" },
          { id: "mobile", label: "Mobile Number" },
          { id: "email", label: "Email Address" },
          { id: "type", label: "Party Type" },
          { id: "accountgroupid", label: "Account Group" },
          { id: "channel", label: "Sales Channel" },
          { id: "region", label: "Region / Price Zone" },
          { id: "salesmanid", label: "Assigned Salesman" },
          { id: "assignaccountid", label: "Assign Parent Party" },
        ],
      },
      {
        id: "address_info",
        label: "Address Info",
        fields: [
          { id: "address", label: "Address" },
          { id: "city", label: "City" },
          { id: "state", label: "State" },
          { id: "country", label: "Country" },
          { id: "pincode", label: "Pincode" },
          { id: "latitude", label: "Latitude" },
          { id: "longitude", label: "Longitude" },
        ],
      },
      {
        id: "financial_info",
        label: "Financial Info",
        fields: [
          { id: "openingbalance", label: "Opening Balance" },
          { id: "openingbalancetype", label: "Balance Type" },
          { id: "creditlimit", label: "Credit Limit" },
          { id: "gstnumber", label: "GST Number" },
          { id: "pan", label: "PAN Card" },
        ],
      },
      {
        id: "bank_info",
        label: "Bank Info",
        fields: [
          { id: "bankname", label: "Bank Name" },
          { id: "bankaccountnumber", label: "Account No." },
          { id: "ifsc", label: "IFSC" },
          { id: "upiid", label: "UPI ID" },
        ],
      },
      {
        id: "preferences",
        label: "Preferences",
        fields: [
          { id: "billingcycle", label: "Billing Cycle" },
          { id: "duedays", label: "Due Days" },
          { id: "status", label: "Status" },
        ],
      }
    ],
  },
  {
    moduleId: "staffaccounts", // Staff Accounts
    label: "Staff Account Fields",
    sections: [
      {
        id: "account_info",
        label: "Account Info",
        fields: [
          { id: "name", label: "Name" },
          { id: "mobile", label: "Mobile" },
          { id: "email", label: "Email" },
          { id: "password", label: "Password" },
          { id: "role", label: "Role" },
          { id: "accountgroupid", label: "Account Group" },
          { id: "salary", label: "Salary" },
          { id: "commission", label: "Commission" },
          { id: "target", label: "Target Amount" },
          { id: "address", label: "Address" },
          { id: "assignedChannels", label: "Assigned Channels" },
          { id: "profilepicture", label: "Profile Picture" },
          { id: "status", label: "Status" },
        ],
      }
    ],
  },
  {
    moduleId: "salesinvoice", // Sales Invoice
    label: "Sales Invoice Fields",
    sections: [
      {
        id: "main_details",
        label: "Main Details",
        fields: [
          { id: "paymenttype", label: "Payment Type" },
          { id: "partyacc", label: "Party Account" },
          { id: "placeofsupply", label: "Tax/Supply Type" },
          { id: "billdate", label: "Bill Date" },
          { id: "billnumber", label: "Bill Number" },
          { id: "billtype", label: "Bill Type" },
          { id: "notes", label: "Notes" },
          { id: "status", label: "Status" },
        ],
      },
      {
        id: "add_products",
        label: "Add Products",
        fields: [
          { id: "product", label: "Product" },
          { id: "unit", label: "Unit" },
          { id: "quantity", label: "Quantity" },
          { id: "rate", label: "Rate" },
          { id: "discount", label: "Discount" },
          { id: "gst", label: "GST %" },
          { id: "add_product_button", label: "Add Button" },
        ]
      },
      {
        id: "transport_delivery",
        label: "Transport & Delivery",
        fields: [
          { id: "deliverydate", label: "Delivery Date" },
          { id: "duedate", label: "Due Date" },
          { id: "transportname", label: "Transport Name" },
          { id: "vehiclenumber", label: "Vehicle Number" },
          { id: "ewaybill", label: "E-Way Bill No." },
          { id: "distance", label: "Distance (km)" },
        ],
      },
      {
        id: "other_charges",
        label: "Other Charges",
        fields: [
          { id: "ledgeraccount", label: "Ledger Account" },
          { id: "amount", label: "Amount" },
          { id: "other_gst", label: "GST %" },
          { id: "remarks", label: "Remarks" },
          { id: "add_charge_button", label: "Add Button" },
        ]
      },
      {
        id: "summary",
        label: "Summary",
        fields: [
          { id: "productstotal", label: "Products Total" },
          { id: "totaldiscount", label: "Total Discount" },
          { id: "taxamount", label: "Tax Amount" },
          { id: "summary_othercharges", label: "Other Charges" },
          { id: "invoicediscount", label: "Invoice Discount" },
          { id: "roundoff", label: "Round Off" },
          { id: "grandtotal", label: "Grand Total" },
        ],
      }
    ],
  },
  {
    moduleId: "purchaseinvoice", // Purchase Invoice
    label: "Purchase Invoice Fields",
    sections: [
      {
        id: "main_details",
        label: "Main Details",
        fields: [
          { id: "paymenttype", label: "Payment Type" },
          { id: "partyacc", label: "Vendor Account" },
          { id: "placeofsupply", label: "Tax/Supply Type" },
          { id: "billdate", label: "Bill Date" },
          { id: "billnumber", label: "Bill Number" },
          { id: "billtype", label: "Bill Type" },
          { id: "notes", label: "Notes" },
          { id: "status", label: "Status" },
        ],
      },
      {
        id: "add_products",
        label: "Add Products",
        fields: [
          { id: "product", label: "Product" },
          { id: "quantity", label: "Quantity" },
          { id: "rate", label: "Rate" },
          { id: "discount", label: "Discount" },
          { id: "gst", label: "GST %" },
          { id: "add_product_button", label: "Add Button" },
        ]
      },
      {
        id: "transport_delivery",
        label: "Transport & Delivery",
        fields: [
          { id: "deliverydate", label: "Delivery Date" },
          { id: "duedate", label: "Due Date" },
          { id: "transportname", label: "Transport Name" },
          { id: "vehiclenumber", label: "Vehicle Number" },
          { id: "ewaybill", label: "E-Way Bill No." },
          { id: "distance", label: "Distance (km)" },
        ],
      },
      {
        id: "other_charges",
        label: "Other Charges",
        fields: [
          { id: "ledgeraccount", label: "Ledger Account" },
          { id: "amount", label: "Amount" },
          { id: "other_gst", label: "GST %" },
          { id: "remarks", label: "Remarks" },
          { id: "add_charge_button", label: "Add Button" },
        ]
      },
      {
        id: "summary",
        label: "Summary",
        fields: [
          { id: "productstotal", label: "Products Total" },
          { id: "totaldiscount", label: "Total Discount" },
          { id: "taxamount", label: "Tax Amount" },
          { id: "summary_othercharges", label: "Other Charges" },
          { id: "invoicediscount", label: "Invoice Discount" },
          { id: "roundoff", label: "Round Off" },
          { id: "grandtotal", label: "Grand Total" },
        ],
      }
    ],
  },
  {
    moduleId: "salesreturn", // Sales Return
    label: "Sales Return Fields",
    sections: [
      {
        id: "main_details",
        label: "Main Details",
        fields: [
          { id: "sourceinvoice", label: "Source Invoice" },
          { id: "returndate", label: "Return Date" },
          { id: "billnumber", label: "Return Number" },
          { id: "paymenttype", label: "Payment Type" },
          { id: "refundmode", label: "Refund Mode" },
          { id: "placeofsupply", label: "Tax/Supply Type" },
          { id: "reason", label: "Reason" },
          { id: "notes", label: "Notes" },
        ],
      },
      {
        id: "other_charges",
        label: "Other Charges",
        fields: [
          { id: "ledgeraccount", label: "Ledger Account" },
          { id: "amount", label: "Amount" },
          { id: "other_gst", label: "GST %" },
          { id: "remarks", label: "Remarks" },
          { id: "add_charge_button", label: "Add Button" },
        ]
      },
      {
        id: "transport_delivery",
        label: "Transport & Delivery",
        fields: [
          { id: "deliverydate", label: "Delivery Date" },
          { id: "duedate", label: "Due Date" },
          { id: "transportname", label: "Transport Name" },
          { id: "vehiclenumber", label: "Vehicle Number" },
          { id: "ewaybill", label: "E-Way Bill No." },
          { id: "distance", label: "Distance (km)" },
        ],
      },
      {
        id: "summary",
        label: "Summary",
        fields: [
          { id: "subtotal", label: "Subtotal" },
          { id: "totaldiscount", label: "Total Discount" },
          { id: "taxamount", label: "Tax Amount" },
          { id: "summary_othercharges", label: "Other Charges" },
          { id: "invoicediscount", label: "Invoice Discount" },
          { id: "roundoff", label: "Round Off" },
          { id: "totalamount", label: "Refund Amount" },
        ],
      }
    ],
  },
  {
    moduleId: "purchasereturn", // Purchase Return
    label: "Purchase Return Fields",
    sections: [
      {
        id: "main_details",
        label: "Main Details",
        fields: [
          { id: "sourceinvoice", label: "Source Invoice" },
          { id: "returndate", label: "Return Date" },
          { id: "billnumber", label: "Return Number" },
          { id: "paymenttype", label: "Payment Type" },
          { id: "refundmode", label: "Refund Mode" },
          { id: "placeofsupply", label: "Tax/Supply Type" },
          { id: "reason", label: "Reason" },
          { id: "notes", label: "Notes" },
        ],
      },
      {
        id: "other_charges",
        label: "Other Charges",
        fields: [
          { id: "ledgeraccount", label: "Ledger Account" },
          { id: "amount", label: "Amount" },
          { id: "other_gst", label: "GST %" },
          { id: "remarks", label: "Remarks" },
          { id: "add_charge_button", label: "Add Button" },
        ]
      },
      {
        id: "transport_delivery",
        label: "Transport & Delivery",
        fields: [
          { id: "deliverydate", label: "Delivery Date" },
          { id: "duedate", label: "Due Date" },
          { id: "transportname", label: "Transport Name" },
          { id: "vehiclenumber", label: "Vehicle Number" },
          { id: "ewaybill", label: "E-Way Bill No." },
          { id: "distance", label: "Distance (km)" },
        ],
      },
      {
        id: "summary",
        label: "Summary",
        fields: [
          { id: "subtotal", label: "Subtotal" },
          { id: "totaldiscount", label: "Total Discount" },
          { id: "taxamount", label: "Tax Amount" },
          { id: "summary_othercharges", label: "Other Charges" },
          { id: "invoicediscount", label: "Invoice Discount" },
          { id: "roundoff", label: "Round Off" },
          { id: "totalamount", label: "Refund Amount" },
        ],
      }
    ],
  },
  {
    moduleId: "products", // Products
    label: "Products Form",
    sections: [
      {
        id: "general_details",
        label: "General Details",
        fields: [
          { id: "name", label: "Name" },
          { id: "imageurl", label: "Images" },
          { id: "categoryid", label: "Category" },
          { id: "subcategoryid", label: "Sub Category" },
          { id: "brandid", label: "Brand" },
          { id: "groupid", label: "Product Group" },
          { id: "modelid", label: "Model" },
          { id: "sizeid", label: "Size" },
          { id: "description", label: "Description" },
        ],
      },
      {
        id: "seo",
        label: "SEO",
        fields: [
          { id: "metatitle", label: "Meta Title" },
          { id: "metadescription", label: "Meta Description" },
          { id: "keywords", label: "Keywords" },
          { id: "slug", label: "Slug" },
        ],
      },
      {
        id: "options",
        label: "Options",
        fields: [
          { id: "status", label: "Status" },
          { id: "isserialised", label: "Is Product Serialised" },
        ],
      },
      {
        id: "accounts",
        label: "Accounts",
        fields: [
          { id: "salesaccount", label: "Sales Account" },
          { id: "purchaseaccount", label: "Purchase Account" },
        ],
      },
      {
        id: "product_variant",
        label: "Product Variant",
        fields: [
          { id: "variant_name", label: "Name" },
          { id: "productcode", label: "Product Code" },
          { id: "sku", label: "SKU" },
          { id: "batchnumber", label: "Batch Number" },
          { id: "manufacturedate", label: "Manufacture Date" },
          { id: "expirydate", label: "Expiry Date" },
          { id: "gst", label: "GST" },
          { id: "hsncode", label: "HSN Code" },
          { id: "openingstock", label: "Opening Stock" },
          { id: "openingstockamount", label: "Opening Stock Amount" },
          { id: "currentstock", label: "Current Stock" },
          { id: "currentstockamount", label: "Current Stock Amount" },
          { id: "closingstock", label: "Closing Stock" },
          { id: "closingstockamount", label: "Closing Stock Amount" },
          { id: "minimumstock", label: "Minimum Stock" },
          { id: "reorderlevel", label: "Reorder Level" },
          { id: "racklocation", label: "Rack Location" },
          { id: "baseunitid", label: "Base Unit" },
          { id: "purchaseunitid", label: "Purchase Unit" },
          { id: "purchaserate", label: "Purchase Rate" },
        ],
      },
      {
        id: "unit_conversions",
        label: "Unit Conversions",
        fields: [
          { id: "unitconversions_unitid", label: "Unit" },
          { id: "factor", label: "Factor" },
        ],
      },
      {
        id: "unit_prices",
        label: "Unit Prices",
        fields: [
          { id: "quantity", label: "Quantity" },
          { id: "unitprices_unitid", label: "Unit" },
          { id: "mrp", label: "MRP" },
          { id: "salesrate", label: "Sales Rate" },
          { id: "discount", label: "Discount" },
          { id: "discounttype", label: "Discount Type" },
          { id: "offerprice", label: "Offer Price" },
        ],
      },
      {
        id: "buttons",
        label: "Action Buttons",
        fields: [
          { id: "add_product_variant", label: "Add Product Variant" },
          { id: "add_unit_conversion", label: "Add Unit Conversion" },
          { id: "add_unit_price", label: "Add Unit Price" },
        ],
      }
    ]
  }
];
