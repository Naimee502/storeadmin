// One-time script: permanently deletes the product whose code is "ASDFF"
// (plus its branch stock rows). Run from the server folder:  node delete-asdff-product.js
require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const products = db.collection("productservices");
  const stock = db.collection("productbranchstocks");

  const found = await products
    .find({ "productvariants.productcode": "ASDFF" })
    .project({ name: 1, status: 1, "productvariants.productcode": 1 })
    .toArray();

  if (!found.length) {
    console.log('No product with code "ASDFF" found. Nothing deleted.');
    return process.exit(0);
  }

  console.log("Deleting:", found.map((p) => `${p.name} (${p._id})`).join(", "));
  const ids = found.map((p) => p._id);
  const s = await stock.deleteMany({ productid: { $in: ids } });
  const p = await products.deleteMany({ _id: { $in: ids } });
  console.log(`Deleted ${p.deletedCount} product(s) and ${s.deletedCount} stock row(s).`);
  process.exit(0);
})().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});
