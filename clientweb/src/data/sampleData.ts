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
  Pill,
  Car,
  Puzzle,
  Bike,
  Speaker,
  Tv,
  HeartPulse,
  ShieldPlus,
  Stethoscope,
  UtensilsCrossed,
  Lamp,
  WashingMachine,
  Microwave,
  Droplet,
  Activity,
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
  { id: "home", name: "Home & Kitchen", icon: Sofa, items: 640, discount: "Up to 30% off", from: "#ffedd5", to: "#fed7aa" },
  { id: "beauty", name: "Beauty & Personal Care", icon: Sparkles, items: 980, discount: "Buy 1 get 1", from: "#fae8ff", to: "#f5d0fe" },
  { id: "toys", name: "Toys & Baby Care", icon: Baby, items: 410, from: "#fef9c3", to: "#fef08a" },
  { id: "appliances", name: "Appliances", icon: Refrigerator, items: 305, discount: "20% off", from: "#e0f2fe", to: "#bae6fd" },
  { id: "sports", name: "Sports & Fitness", icon: Dumbbell, items: 275, from: "#dcfce7", to: "#a7f3d0" },
  { id: "books", name: "Books & Stationery", icon: BookOpen, items: 520, from: "#ede9fe", to: "#ddd6fe" },
  { id: "pet", name: "Pet Supplies", icon: PawPrint, items: 190, from: "#fee2e2", to: "#fecaca" },
  { id: "pharma", name: "Pharmacy & Healthcare", icon: Pill, items: 720, discount: "Free delivery on Rx orders", from: "#ccfbf1", to: "#99f6e4" },
];

export interface SampleProduct {
  id: string;
  name: string;
  category: string;
  categoryName?: string;
  brand: string;
  stock?: number;
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
  imageurl?: string; // real product photo (from server) — shown instead of the icon/gradient tile when present
  imageurls?: string[]; // full gallery — imageurl mirrors imageurls[0]; ProductDetail's thumbnails switch between these
  // Per-unit price breakdown (e.g. Piece vs Dozen) — when present, ProductCard
  // and ProductDetail let the buyer switch units and show/add-to-cart the
  // price for whichever one is selected, same as the mobile app's catalog.
  unitPrices?: { label: string; price: number; mrp: number; unitid?: string | null; unitQuantity?: number }[];
  createdAt?: string;
  // Needed to actually place a real order (SalesOrderProductServiceInput) —
  // both are variant-level on the server (single variant per product here),
  // so they're the same across every unit chip.
  variantid?: string;
  gst?: number;
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

  // Toys — extra range so the Toys & Games storefront home page has enough to show
  {
    id: "p13", name: "Remote Control Racing Car", category: "toys", brand: "PlayNest",
    unit: "1 unit", units: ["Red", "Blue"],
    price: 1299, mrp: 1799, rating: 4.5, ratingCount: 58, badge: "NEW",
    icon: Car, from: "#fef9c3", to: "#fef08a",
    description: "High-speed remote control car with rechargeable battery — built for indoor and outdoor play.",
    highlights: ["Rechargeable battery", "Full function remote", "Durable shock-resistant body", "Ages 6+"],
  },
  {
    id: "p14", name: "500-Piece Jigsaw Puzzle", category: "toys", brand: "BrainWorks",
    unit: "1 box", units: ["100 pcs", "300 pcs", "500 pcs"],
    price: 449, mrp: 599, rating: 4.6, ratingCount: 102,
    icon: Puzzle, from: "#fef9c3", to: "#fef08a",
    description: "Premium thick-board jigsaw puzzle that sharpens focus and problem-solving for the whole family.",
    highlights: ["Thick, sturdy pieces", "Boosts problem-solving", "Family activity", "Ages 8+"],
  },
  {
    id: "p15", name: "Kids Tricycle", category: "toys", brand: "PlayNest",
    unit: "1 unit", units: ["Pink", "Blue", "Green"],
    price: 2499, mrp: 3199, rating: 4.4, ratingCount: 39, badge: "BESTSELLER",
    icon: Bike, from: "#fef9c3", to: "#fef08a",
    description: "Sturdy 3-wheel tricycle with adjustable seat and safety guardrail for toddlers.",
    highlights: ["Adjustable seat", "Safety guardrail", "Easy-grip handlebar", "Ages 2-5"],
  },

  // Electronics — extra range for the Electronics storefront home page
  {
    id: "p16", name: "Portable Bluetooth Speaker", category: "electronics", brand: "Sonique",
    unit: "1 unit", units: ["Black", "Red"],
    price: 1499, mrp: 2199, rating: 4.2, ratingCount: 210, badge: "SALE",
    icon: Speaker, from: "#dbeafe", to: "#bfdbfe",
    description: "Compact IPX7 waterproof speaker with 12-hour playback and deep bass.",
    highlights: ["IPX7 waterproof", "12 hr playback", "Deep bass", "Built-in mic for calls"],
  },
  {
    id: "p17", name: "43-inch Smart LED TV", category: "electronics", brand: "CoolTech",
    unit: "1 unit", units: ["32-inch", "43-inch", "55-inch"],
    price: 18999, mrp: 24999, rating: 4.5, ratingCount: 76, badge: "NEW",
    icon: Tv, from: "#dbeafe", to: "#bfdbfe",
    description: "Full-HD smart LED TV with built-in streaming apps and voice remote.",
    highlights: ["Full-HD display", "Built-in streaming apps", "Voice remote", "2 yr warranty"],
  },

  // Pharmacy & Healthcare — dedicated range for the Pharma storefront home page
  {
    id: "p18", name: "Paracetamol 500mg (Strip of 15)", category: "pharma", brand: "MediCare",
    unit: "1 strip", units: ["1 strip", "Box of 10 strips"],
    price: 25, mrp: 35, rating: 4.7, ratingCount: 340,
    icon: Pill, from: "#ccfbf1", to: "#99f6e4",
    description: "Fast-acting fever and pain relief tablets. Store below 25°C.",
    highlights: ["Fast-acting relief", "Trusted formulation", "Store below 25°C", "No prescription required"],
  },
  {
    id: "p19", name: "Digital Blood Pressure Monitor", category: "pharma", brand: "HealWell",
    unit: "1 unit", units: ["Standard", "With adapter"],
    price: 1799, mrp: 2499, rating: 4.5, ratingCount: 128, badge: "BESTSELLER",
    icon: HeartPulse, from: "#ccfbf1", to: "#99f6e4",
    description: "Clinically validated automatic BP monitor with irregular heartbeat detection.",
    highlights: ["Clinically validated", "Irregular heartbeat alert", "Stores last 60 readings", "2 yr warranty"],
  },
  {
    id: "p20", name: "Multivitamin Tablets (30s)", category: "pharma", brand: "MediCare",
    unit: "1 bottle", units: ["30 tablets", "60 tablets"],
    price: 349, mrp: 499, rating: 4.6, ratingCount: 210,
    icon: Pill, from: "#ccfbf1", to: "#99f6e4",
    description: "Daily multivitamin and mineral supplement to support everyday immunity and energy.",
    highlights: ["Supports immunity", "Once-daily dose", "No added sugar", "FSSAI approved"],
  },
  {
    id: "p21", name: "N95 Face Masks (Pack of 10)", category: "pharma", brand: "HealWell",
    unit: "Pack of 10", units: ["Pack of 10", "Pack of 50"],
    price: 199, mrp: 299, rating: 4.4, ratingCount: 90,
    icon: ShieldPlus, from: "#ccfbf1", to: "#99f6e4",
    description: "5-layer N95 protective masks with adjustable ear loops and nose clip.",
    highlights: ["5-layer protection", "Adjustable nose clip", "Individually sealed", "ISI compliant"],
  },
  {
    id: "p22", name: "Digital Glucometer Kit", category: "pharma", brand: "HealWell",
    unit: "1 kit", units: ["Kit only", "Kit + 25 strips"],
    price: 899, mrp: 1299, rating: 4.3, ratingCount: 66, badge: "NEW",
    icon: Stethoscope, from: "#ccfbf1", to: "#99f6e4",
    description: "Accurate blood glucose monitoring kit with painless lancing device.",
    highlights: ["Fast 5-second result", "Painless lancing device", "Large display", "Includes carry case"],
  },

  // Fashion — extra range so a fashion-only storefront has enough to show
  {
    id: "p23", name: "Women's Floral Kurti", category: "fashion", brand: "StyleHouse",
    unit: "1 pc", units: ["S", "M", "L", "XL"],
    price: 899, mrp: 1499, rating: 4.3, ratingCount: 140, badge: "SALE",
    icon: Shirt, from: "#fce7f3", to: "#fbcfe8",
    description: "Rayon floral-print kurti with a relaxed fit — everyday wear that dresses up easily.",
    highlights: ["Soft rayon fabric", "Relaxed fit", "Machine washable", "Available in 4 sizes"],
  },
  {
    id: "p24", name: "Kids Denim Jacket", category: "fashion", brand: "StyleHouse",
    unit: "1 pc", units: ["2-3 yrs", "4-5 yrs", "6-7 yrs"],
    price: 1099, mrp: 1599, rating: 4.5, ratingCount: 62, badge: "NEW",
    icon: Shirt, from: "#fce7f3", to: "#fbcfe8",
    description: "Sturdy denim jacket for kids with front snap buttons and side pockets.",
    highlights: ["Durable denim", "Front snap buttons", "Machine washable", "3 age sizes"],
  },

  // Home & Kitchen — extra range for a home & kitchen-only storefront
  {
    id: "p25", name: "Non-stick Cookware Set (5 pcs)", category: "home", brand: "HomeCraft",
    unit: "1 set", units: ["5 pcs", "8 pcs"],
    price: 1899, mrp: 2599, rating: 4.5, ratingCount: 184, badge: "BESTSELLER",
    icon: UtensilsCrossed, from: "#ffedd5", to: "#fed7aa",
    description: "Induction-friendly non-stick cookware set with heat-resistant handles.",
    highlights: ["Induction friendly", "Heat-resistant handles", "PFOA free", "2 yr warranty"],
  },
  {
    id: "p26", name: "LED Study Table Lamp", category: "home", brand: "HomeCraft",
    unit: "1 unit", units: ["White", "Black"],
    price: 599, mrp: 899, rating: 4.4, ratingCount: 97,
    icon: Lamp, from: "#ffedd5", to: "#fed7aa",
    description: "Adjustable LED table lamp with 3 brightness modes and USB charging port.",
    highlights: ["3 brightness modes", "USB charging port", "Flicker-free light", "Foldable design"],
  },

  // Beauty & Personal Care — extra range
  {
    id: "p27", name: "Herbal Anti-Hairfall Shampoo 200ml", category: "beauty", brand: "Glowbee",
    unit: "200 ml", units: ["200 ml", "400 ml"],
    price: 249, mrp: 349, rating: 4.3, ratingCount: 176,
    icon: Droplet, from: "#fae8ff", to: "#f5d0fe",
    description: "Sulphate-free herbal shampoo that strengthens roots and reduces hair fall.",
    highlights: ["Sulphate free", "Herbal formulation", "Reduces hairfall", "Suitable for daily use"],
  },
  {
    id: "p28", name: "Matte Lipstick Combo (3 pcs)", category: "beauty", brand: "Glowbee",
    unit: "Pack of 3", units: ["Pack of 3", "Pack of 5"],
    price: 399, mrp: 599, rating: 4.5, ratingCount: 132, badge: "SALE",
    icon: Sparkles, from: "#fae8ff", to: "#f5d0fe",
    description: "Long-lasting matte lipstick combo in everyday wearable shades.",
    highlights: ["Long-lasting matte finish", "Non-drying formula", "3 everyday shades", "Cruelty free"],
  },

  // Appliances — extra range so an appliances-only storefront has enough to show
  {
    id: "p29", name: "Automatic Washing Machine 7kg", category: "appliances", brand: "CoolTech",
    unit: "1 unit", units: ["7 kg", "8 kg", "10 kg"],
    price: 15999, mrp: 19999, rating: 4.4, ratingCount: 88, badge: "SALE",
    icon: WashingMachine, from: "#e0f2fe", to: "#bae6fd",
    description: "Fully-automatic front-load washing machine with 6 wash programs and inverter motor.",
    highlights: ["Inverter motor", "6 wash programs", "5-star energy rating", "2 yr warranty"],
  },
  {
    id: "p30", name: "Microwave Oven 20L", category: "appliances", brand: "CoolTech",
    unit: "1 unit", units: ["20 L", "28 L"],
    price: 6999, mrp: 8999, rating: 4.3, ratingCount: 54, badge: "NEW",
    icon: Microwave, from: "#e0f2fe", to: "#bae6fd",
    description: "Solo microwave oven with 5 power levels — ideal for reheating and basic cooking.",
    highlights: ["5 power levels", "Child safety lock", "Easy-clean interior", "1 yr warranty"],
  },

  // Sports & Fitness — extra range
  {
    id: "p31", name: "Yoga Mat with Carry Bag", category: "sports", brand: "FitCore",
    unit: "1 unit", units: ["4 mm", "6 mm", "8 mm"],
    price: 599, mrp: 899, rating: 4.6, ratingCount: 143, badge: "BESTSELLER",
    icon: Activity, from: "#dcfce7", to: "#a7f3d0",
    description: "Non-slip, high-density yoga mat with a free carry bag.",
    highlights: ["Non-slip surface", "High-density cushioning", "Free carry bag", "Lightweight"],
  },
  {
    id: "p32", name: "Cricket Bat - Kashmir Willow", category: "sports", brand: "FitCore",
    unit: "1 unit", units: ["Short handle", "Full size"],
    price: 1299, mrp: 1799, rating: 4.2, ratingCount: 47,
    icon: Dumbbell, from: "#dcfce7", to: "#a7f3d0",
    description: "Kashmir willow cricket bat, lightweight and balanced for all-round play.",
    highlights: ["Kashmir willow", "Lightweight & balanced", "Anti-scuff sheet", "Ready to play"],
  },

  // Books & Stationery — extra range
  {
    id: "p33", name: "Competitive Exam Guide Set", category: "books", brand: "PageTurn",
    unit: "Set of 4", units: ["Set of 4", "Set of 8"],
    price: 799, mrp: 999, rating: 4.6, ratingCount: 118,
    icon: BookOpen, from: "#ede9fe", to: "#ddd6fe",
    description: "Updated guide set covering reasoning, quant, English and general awareness.",
    highlights: ["Latest syllabus", "Practice question sets", "Solved past papers", "4-book set"],
  },
  {
    id: "p34", name: "Notebook Combo Pack (6 pcs)", category: "books", brand: "PageTurn",
    unit: "Pack of 6", units: ["Pack of 6", "Pack of 12"],
    price: 249, mrp: 349, rating: 4.5, ratingCount: 205, badge: "BESTSELLER",
    icon: BookOpen, from: "#ede9fe", to: "#ddd6fe",
    description: "Ruled 100-page notebooks, sturdy binding — ideal for school and office use.",
    highlights: ["100 pages each", "Sturdy binding", "Smooth ruled pages", "Pack of 6"],
  },

  // Pet Supplies — extra range
  {
    id: "p35", name: "Dry Dog Food 3kg", category: "pet", brand: "PawCare",
    unit: "3 kg", units: ["3 kg", "10 kg"],
    price: 899, mrp: 1199, rating: 4.5, ratingCount: 156, badge: "BESTSELLER",
    icon: PawPrint, from: "#fee2e2", to: "#fecaca",
    description: "Balanced nutrition dry dog food with real chicken as the first ingredient.",
    highlights: ["Real chicken first", "Balanced nutrition", "For adult dogs", "Resealable pack"],
  },
  {
    id: "p36", name: "Cat Scratching Post", category: "pet", brand: "PawCare",
    unit: "1 unit", units: ["Standard", "Tall"],
    price: 799, mrp: 1099, rating: 4.3, ratingCount: 68,
    icon: PawPrint, from: "#fee2e2", to: "#fecaca",
    description: "Sisal-wrapped scratching post with a stable base to protect your furniture.",
    highlights: ["Sisal rope wrapped", "Stable weighted base", "Protects furniture", "Easy to assemble"],
  },

  // Grocery — one more for variety
  {
    id: "p37", name: "Cold-Pressed Sunflower Oil 1L", category: "grocery", brand: "FarmFresh",
    unit: "1 L", units: ["1 L", "5 L"],
    price: 199, mrp: 249, rating: 4.5, ratingCount: 231,
    icon: Apple, from: "#dcfce7", to: "#bbf7d0",
    description: "Cold-pressed sunflower oil retaining natural nutrients and a light taste.",
    highlights: ["Cold-pressed", "Retains natural nutrients", "Light taste", "Bulk pack available"],
  },
];

export const brandStrip: string[] = [
  "FarmFresh", "Sonique", "Urban Thread", "Nestwood", "Glowbee", "PlayNest", "CoolTech", "FitCore", "PageTurn", "PawCare",
  "BrainWorks", "MediCare", "HealWell", "StyleHouse", "HomeCraft",
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
