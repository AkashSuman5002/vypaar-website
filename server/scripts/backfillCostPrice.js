const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Product = require('../models/Product');
const Purchase = require('../models/Purchase');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    console.log('DB connected');

    const purchases = await Purchase.find({}).lean();
    const rateMap = {};

    for (const p of purchases) {
      for (const item of p.items || []) {
        const key = item.productName || item.product?.toString();
        if (!key) continue;
        if (!rateMap[key]) rateMap[key] = [];
        rateMap[key].push(item.rate || 0);
      }
    }

    let updated = 0;
    for (const [name, rates] of Object.entries(rateMap)) {
      const avg = rates.reduce((s, r) => s + r, 0) / rates.length;
      const product = await Product.findOne({ name });
      if (product && (!product.costPrice || product.costPrice === 0)) {
        await Product.findByIdAndUpdate(product._id, { costPrice: Math.round(avg * 100) / 100 });
        console.log(`  Updated ${name}: costPrice = ${Math.round(avg * 100) / 100}`);
        updated++;
      }
    }

    console.log(`Done. Updated ${updated} products.`);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

run();
