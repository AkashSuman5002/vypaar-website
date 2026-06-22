const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('./models/User');
const Customer = require('./models/Customer');
const Product = require('./models/Product');

const check = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ email: 'demo@vyapar.com' });
  if (!user) {
    console.log('No demo user found');
    process.exit();
  }
  console.log('User:', user.name, user.email);
  const customers = await Customer.find({ user: user._id });
  const products = await Product.find({ user: user._id });
  console.log('Customers:', customers.length);
  console.log('Products:', products.length);
  if (customers.length) console.log('First customer:', customers[0].name);
  if (products.length) console.log('First product:', products[0].name);
  process.exit();
};
check();
