export const regionOptions = [
  { value: "andhra_pradesh", label: "Andhra Pradesh" },
  { value: "arunachal_pradesh", label: "Arunachal Pradesh" },
  { value: "assam", label: "Assam" },
  { value: "bihar", label: "Bihar" },
  { value: "chhattisgarh", label: "Chhattisgarh" },
  { value: "goa", label: "Goa" },
  { value: "gujarat", label: "Gujarat" },
  { value: "haryana", label: "Haryana" },
  { value: "himachal_pradesh", label: "Himachal Pradesh" },
  { value: "jharkhand", label: "Jharkhand" },
  { value: "karnataka", label: "Karnataka" },
  { value: "kerala", label: "Kerala" },
  { value: "madhya_pradesh", label: "Madhya Pradesh" },
  { value: "maharashtra", label: "Maharashtra" },
  { value: "manipur", label: "Manipur" },
  { value: "meghalaya", label: "Meghalaya" },
  { value: "mizoram", label: "Mizoram" },
  { value: "nagaland", label: "Nagaland" },
  { value: "odisha", label: "Odisha" },
  { value: "punjab", label: "Punjab" },
  { value: "rajasthan", label: "Rajasthan" },
  { value: "sikkim", label: "Sikkim" },
  { value: "tamil_nadu", label: "Tamil Nadu" },
  { value: "telangana", label: "Telangana" },
  { value: "tripura", label: "Tripura" },
  { value: "uttar_pradesh", label: "Uttar Pradesh" },
  { value: "uttarakhand", label: "Uttarakhand" },
  { value: "west_bengal", label: "West Bengal" },

  // Union Territories
  { value: "andaman_nicobar", label: "Andaman and Nicobar Islands" },
  { value: "chandigarh", label: "Chandigarh" },
  { value: "dadra_nagar_haveli_daman_diu", label: "Dadra and Nagar Haveli and Daman and Diu" },
  { value: "delhi", label: "Delhi" },
  { value: "jammu_kashmir", label: "Jammu and Kashmir" },
  { value: "ladakh", label: "Ladakh" },
  { value: "lakshadweep", label: "Lakshadweep" },
  { value: "puducherry", label: "Puducherry" },

  // Extra options
  { value: "international", label: "International" },
];

// GST State options, kept separate from pricing Region.
export const stateOptions = regionOptions;

// GST unit codes (UQC) accepted by the e-Invoice and e-Way Bill portals.
export const UQC_OPTIONS = [
  ["PCS", "Pieces"], ["NOS", "Numbers"], ["KGS", "Kilograms"], ["GMS", "Grams"], ["QTL", "Quintal"], ["TON", "Tonnes"],
  ["LTR", "Litres"], ["MLT", "Millilitre"], ["KLR", "Kilolitre"], ["MTR", "Metres"], ["CMS", "Centimetres"], ["KME", "Kilometre"],
  ["SQM", "Square Metres"], ["SQF", "Square Feet"], ["SQY", "Square Yards"], ["CBM", "Cubic Metres"], ["CCM", "Cubic Centimetres"],
  ["YDS", "Yards"], ["BOX", "Box"], ["CTN", "Cartons"], ["DOZ", "Dozens"], ["PAC", "Packs"], ["BAG", "Bags"], ["BAL", "Bale"],
  ["BDL", "Bundles"], ["BKL", "Buckles"], ["BOU", "Billion of Units"], ["BTL", "Bottles"], ["BUN", "Bunches"], ["CAN", "Cans"],
  ["DRM", "Drums"], ["GGK", "Great Gross"], ["GRS", "Gross"], ["GYD", "Gross Yards"], ["PRS", "Pairs"], ["ROL", "Rolls"],
  ["SET", "Sets"], ["TBS", "Tablets"], ["TGM", "Ten Gross"], ["THD", "Thousands"], ["TUB", "Tubes"], ["UGS", "US Gallons"],
  ["UNT", "Units"], ["OTH", "Others"],
].map(([value, label]) => ({ value, label: `${value} - ${label}` }));
