import {
  Apple,
  Smartphone,
  Shirt,
  Sofa,
  Sparkles,
  Baby,
  Refrigerator,
  Dumbbell,
  BookOpen,
  PawPrint,
  type LucideIcon,
} from "lucide-react";

// Sample / placeholder catalog data only — shaped to line up with the
// Category, Brand and ProductService(+productvariants/unitprices) models
// on the server so it's a straight swap for real GraphQL data later.
// Prices are illustrative INR amounts (system is built for Indian clients).

export interface CategoryTile {
  id: string;
  name: string;
  icon: LucideIcon;
  items: number;
  discount?: string;
  from: string;
  to: string;
}

export const categoryTiles: CategoryTile[] = [
  { id: "grocery", name: "Grocery & Staples", icon: Apple, items: 1240, discount: "Up to 25% off", from: "#dcfce7", to: "#bbf7d0" },
  { id: "electronics", name: "Mobiles & Electronics", icon: Smartphone, items: 860, discount: "New arrivals", from: "#dbeafe", to: "#bfdbfe" },
  { id: "fashion", name: "Fashion", icon: Shirt, items: 2150, discount: "Up to 40% off", from: "#fce7f3", to: "#fbcfe8" },
  { id: "home", name: "Home & Furniture", icon: Sofa, items: 640, from: "#ffedd5", to: "#fed7aa" },
  { id: "beauty", name: "Beauty & Personal Care", icon: Sparkles, items: 980, discount: "Buy 1 get 1", from: "#fae8ff", to: "#f5d0fe" },
  { id: "toys", name: "Toys & Baby Care", icon: Baby, items: 410, from: "#fef9c3", to: "#fef08a" },
  { id: "appliances", name: "Appliances", icon: Refrigerator, items: 305, discount: "20% off", from: "#e0f2fe", to: "#bae6fd" },
  { id: "sports", name: "Sports & Fitness", icon: Dumbbell, items: 275, from: "#dcfce7", to: "#a7f3d0" },
  { id: "books", name: "Books & Stationery", icon: BookOpen, items: 520, from: "#ede9fe", to: "#ddd6fe" },
  { id: "pet", name: "Pet Supplies", icon: PawPrint, items: 190, from: "#fee2e2", to: "#fecaca" },
];

export interface SampleProduct {
  id: string;
  name: string;
  category: string;
  brand: string;
  unit: string;
  units: string[]; // selectable variants — weight/size/storage etc. (maps to productvariants/unitprices)
  price: number;
  mrp: number;
  rating: number;
  ratingCount: number;
  badge?: "NEW" | "SALE" | "BESTSELLER";
  icon: LucideIcon;
  from: string;
  to: string;
  description: string;
  highlights: string[];
}

export const sampleProducts: SampleProduct[] = [
  {
    id: "p1", name: "Fresh Alphonso Mango", category: "grocery", brand: "FarmFresh",
    unit: "1 kg", units: ["500 g", "1 kg", "2 kg", "5 kg"],
    price: 349, mrp: 449, rating: 4.5, ratingCount: 312, badge: "BESTSELLER",
    icon: Apple, from: "#dcfce7", to: "#bbf7d0",
    description: "Hand-picked, farm-fresh Alphonso mangoes delivered same-day. Naturally ripened, no added chemicals.",
    highlights: ["Farm sourced", "Naturally ripened", "Same-day delivery in select cities", "No preservatives"],
  },
  {
    id: "p2", name: "Wireless ANC Headphones", category: "electronics", brand: "Sonique",
    unit: "1 unit", units: ["Black", "Midnight Blue", "White"],
    price: 2499, mrp: 3999, rating: 4.3, ratingCount: 128, badge: "SALE",
    icon: Smartphone, from: "#dbeafe", to: "#bfdbfe",
    description: "Active noise cancelling over-ear headphones with 40-hour battery life and fast USB-C charging.",
    highlights: ["Active noise cancellation", "40 hr battery", "Bluetooth 5.3", "1 year warranty"],
  },
  {
    id: "p3", name: "Men's Cotton Casual Shirt", category: "fashion", brand: "Urban Thread",
    unit: "1 pc", units: ["S", "M", "L", "XL", "XXL"],
    price: 799, mrp: 1299, rating: 4.1, ratingCount: 96,
    icon: Shirt, from: "#fce7f3", to: "#fbcfe8",
    description: "100% breathable cotton casual shirt, tailored regular fit, machine washable.",
    highlights: ["100% cotton", "Regular fit", "Machine washable", "Available in 5 sizes"],
  },
  {
    id: "p4", name: "3-Seater Fabric Sofa", category: "home", brand: "Nestwood",
    unit: "1 unit", units: ["Grey", "Beige", "Charcoal"],
    price: 24999, mrp: 32999, rating: 4.6, ratingCount: 54, badge: "NEW",
    icon: Sofa, from: "#ffedd5", to: "#fed7aa",
    description: "Solid wood frame 3-seater sofa with high-density foam cushioning and stain-resistant fabric.",
    highlights: ["Solid wood frame", "High-density foam", "Stain-resistant fabric", "Free assembly"],
  },
  {
    id: "p5", name: "Vitamin C Face Serum", category: "beauty", brand: "Glowbee",
    unit: "30 ml", units: ["15 ml", "30 ml", "50 ml"],
    price: 449, mrp: 650, rating: 4.4, ratingCount: 220,
    icon: Sparkles, from: "#fae8ff", to: "#f5d0fe",
    description: "Brightening vitamin C serum with hyaluronic acid — dermatologically tested for all skin types.",
    highlights: ["Dermatologically tested", "With hyaluronic acid", "Paraben free", "Cruelty free"],
  },
  {
    id: "p6", name: "Building Blocks Set", category: "toys", brand: "PlayNest",
    unit: "1 box", units: ["120 pcs", "250 pcs", "500 pcs"],
    price: 899, mrp: 1199, rating: 4.7, ratingCount: 71, badge: "BESTSELLER",
    icon: Baby, from: "#fef9c3", to: "#fef08a",
    description: "Non-toxic, BPA-free building blocks that boost creativity and fine motor skills. Ages 3+.",
    highlights: ["Non-toxic & BPA-free", "Boosts creativity", "Ages 3+", "Storage box included"],
  },
  {
    id: "p7", name: "Double Door Refrigerator 260L", category: "appliances", brand: "CoolTech",
    unit: "1 unit", units: ["260 L", "340 L", "420 L"],
    price: 21999, mrp: 27999, rating: 4.2, ratingCount: 40, badge: "SALE",
    icon: Refrigerator, from: "#e0f2fe", to: "#bae6fd",
    description: "5-star energy rated frost-free double door refrigerator with inverter compressor.",
    highlights: ["5-star energy rating", "Frost free", "Inverter compressor", "10 yr compressor warranty"],
  },
  {
    id: "p8", name: "Adjustable Dumbbell Set", category: "sports", brand: "FitCore",
    unit: "10 kg", units: ["10 kg", "20 kg", "30 kg"],
    price: 1899, mrp: 2499, rating: 4.5, ratingCount: 88,
    icon: Dumbbell, from: "#dcfce7", to: "#a7f3d0",
    description: "Space-saving adjustable dumbbell set with anti-slip grip, ideal for home workouts.",
    highlights: ["Anti-slip grip", "Space saving", "Quick weight adjustment", "Rust-resistant coating"],
  },
  {
    id: "p9", name: "Organic Basmati Rice", category: "grocery", brand: "FarmFresh",
    unit: "5 kg", units: ["1 kg", "5 kg", "10 kg", "25 kg"],
    price: 599, mrp: 749, rating: 4.6, ratingCount: 410,
    icon: Apple, from: "#dcfce7", to: "#bbf7d0",
    description: "Aged, extra-long grain organic basmati rice — aromatic and non-sticky when cooked.",
    highlights: ["Certified organic", "Aged for aroma", "Extra-long grain", "Bulk pack available"],
  },
  {
    id: "p10", name: "Smartwatch Series X", category: "electronics", brand: "Sonique",
    unit: "1 unit", units: ["41 mm", "45 mm"],
    price: 3499, mrp: 5499, rating: 4.3, ratingCount: 150, badge: "NEW",
    icon: Smartphone, from: "#dbeafe", to: "#bfdbfe",
    description: "AMOLED display smartwatch with SpO2, heart-rate tracking and 7-day battery life.",
    highlights: ["AMOLED display", "SpO2 & HR tracking", "7-day battery", "5 ATM water resistant"],
  },
  {
    id: "p11", name: "Kids Storybook Bundle", category: "books", brand: "PageTurn",
    unit: "Pack of 5", units: ["Pack of 5", "Pack of 10"],
    price: 599, mrp: 799, rating: 4.8, ratingCount: 63,
    icon: BookOpen, from: "#ede9fe", to: "#ddd6fe",
    description: "A curated bundle of illustrated bedtime stories for early readers, ages 4-9.",
    highlights: ["Illustrated stories", "Ages 4-9", "Encourages reading habit", "Gift-ready packaging"],
  },
  {
    id: "p12", name: "Pet Grooming Kit", category: "pet", brand: "PawCare",
    unit: "1 kit", units: ["Small breed", "Large breed"],
    price: 799, mrp: 999, rating: 4.4, ratingCount: 45,
    icon: PawPrint, from: "#fee2e2", to: "#fecaca",
    description: "7-in-1 grooming kit with trimmer, nail clipper and brush — safe for cats & dogs.",
    highlights: ["7-in-1 kit", "Safe for cats & dogs", "Low-noise trimmer", "Rechargeable battery"],
  },
];

export const brandStrip: string[] = [
  "FarmFresh", "Sonique", "Urban Thread", "Nestwood", "Glowbee", "PlayNest", "CoolTech", "FitCore", "PageTurn", "PawCare",
];

export const businessStats = [
  { label: "Active retail partners", value: "12,400+" },
  { label: "Products across categories", value: "3.2M+" },
  { label: "Cities served", value: "180+" },
  { label: "Orders delivered on time", value: "98.6%" },
];

// Placeholder order history — shaped like the SalesOrder model (billnumber,
// orderStatus, productservice[]) so it's easy to swap for a real query.
export interface SampleOrder {
  id: string;
  billnumber: string;
  date: string;
  orderStatus: "pending" | "confirmed" | "dispatched" | "delivered" | "cancelled" | "returned";
  items: { name: string; qty: number; icon: LucideIcon; from: string; to: string }[];
  total: number;
}

export const sampleOrders: SampleOrder[] = [
  {
    id: "o1", billnumber: "#SO0148", date: "22 Jul 2026", orderStatus: "delivered", total: 3248,
    items: [
      { name: "Wireless ANC Headphones", qty: 1, icon: Smartphone, from: "#dbeafe", to: "#bfdbfe" },
      { name: "Fresh Alphonso Mango", qty: 2, icon: Apple, from: "#dcfce7", to: "#bbf7d0" },
    ],
  },
  {
    id: "o2", billnumber: "#SO0152", date: "23 Jul 2026", orderStatus: "dispatched", total: 899,
    items: [{ name: "Building Blocks Set", qty: 1, icon: Baby, from: "#fef9c3", to: "#fef08a" }],
  },
  {
    id: "o3", billnumber: "#SO0159", date: "24 Jul 2026", orderStatus: "confirmed", total: 1898,
    items: [{ name: "Vitamin C Face Serum", qty: 2, icon: Sparkles, from: "#fae8ff", to: "#f5d0fe" }],
  },
  {
    id: "o4", billnumber: "#SO0163", date: "25 Jul 2026", orderStatus: "pending", total: 21999,
    items: [{ name: "Double Door Refrigerator 260L", qty: 1, icon: Refrigerator, from: "#e0f2fe", to: "#bae6fd" }],
  },
];
