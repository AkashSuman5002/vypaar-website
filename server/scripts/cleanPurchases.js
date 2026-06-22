const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Purchase = require('../models/Purchase');

(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const del = await Purchase.deleteMany({ billNumber: { $exists: false } });
  console.log('Deleted', del.deletedCount, 'garbage purchases');
  const left = await Purchase.countDocuments({});
  console.log('Clean purchases remaining:', left);
  const agg = await Purchase.aggregate([
    { $group: { _id: null, total: { $sum: '$totalAmount' } } },
  ]);
  console.log('Total purchases amount:', agg[0]?.total || 0);
  process.exit(0);
})();
