// Placeholder brand config — swap the name, tagline and colors any time.
// Kept in one place so re-theming doesn't require touching component files.
export const siteConfig = {
  name: "Rudra",
  tagline: "One store. Every business.",
  supportPhone: "+91 98765 43210",
  supportEmail: "hello@rudra.example",
  currency: "₹",
};

export interface NavCategory {
  id: string;
  label: string;
  children?: string[];
}

// Mirrors the shape of the Category/SubCategory collections on the server —
// deliberately industry-agnostic so a grocery admin and an electronics admin
// both feel at home.
export const navCategories: NavCategory[] = [
  { id: "grocery", label: "Grocery & Staples", children: ["Fruits & Vegetables", "Dairy & Bakery", "Snacks", "Beverages"] },
  { id: "mobiles", label: "Mobiles & Electronics", children: ["Smartphones", "Laptops", "Audio", "Accessories"] },
  { id: "fashion", label: "Fashion", children: ["Men", "Women", "Kids", "Footwear"] },
  { id: "home", label: "Home & Kitchen", children: ["Furniture", "Kitchenware", "Decor", "Storage"] },
  { id: "beauty", label: "Beauty & Personal Care", children: ["Skincare", "Haircare", "Makeup", "Fragrance"] },
  { id: "toys", label: "Toys & Baby", children: ["Toys & Games", "Baby Care", "School Supplies"] },
  { id: "appliances", label: "Appliances", children: ["Refrigerators", "ACs", "Small Appliances"] },
  { id: "sports", label: "Sports & Fitness", children: ["Fitness Gear", "Outdoor", "Cycling"] },
  { id: "books", label: "Books & Stationery", children: ["Fiction", "Academic", "Office Supplies"] },
  { id: "pet", label: "Pet Supplies", children: ["Pet Food", "Toys & Accessories", "Grooming"] },
  { id: "pharma", label: "Pharmacy & Healthcare", children: ["Medicines", "Health Devices", "Wellness"] },
];
