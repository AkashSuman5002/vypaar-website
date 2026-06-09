const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const User = require('./models/User');
const Customer = require('./models/Customer');
const Product = require('./models/Product');
const Supplier = require('./models/Supplier');
const Setting = require('./models/Setting');
const Purchase = require('./models/Purchase');
const Sale = require('./models/Sale');
const Transaction = require('./models/Transaction');
const Account = require('./models/Account');

const customersData = [
  { name: 'Aarav Sharma', phone: '9876543210', email: 'aarav.sharma@email.com', address: '42, Lake View Apartments, Andheri West, Mumbai - 400053' },
  { name: 'Priya Patel', phone: '9876543211', email: 'priya.patel@email.com', address: '15, Sunrise Colony, SG Highway, Ahmedabad - 380054' },
  { name: 'Rahul Verma', phone: '9876543212', email: 'rahul.verma@email.com', address: '7/28, Model Town, Delhi - 110009' },
  { name: 'Sneha Reddy', phone: '9876543213', email: 'sneha.reddy@email.com', address: '204, Green Hills Enclave, Jubilee Hills, Hyderabad - 500033' },
  { name: 'Arjun Nair', phone: '9876543214', email: 'arjun.nair@email.com', address: 'Flat 3B, Sea Breeze Apartments, Marine Drive, Kochi - 682031' },
  { name: 'Kavita Singh', phone: '9876543215', email: 'kavita.singh@email.com', address: '56, Shanti Nagar, Bhopal - 462001' },
  { name: 'Vikram Joshi', phone: '9876543216', email: 'vikram.joshi@email.com', address: '88, Erandwane, Pune - 411004' },
  { name: 'Ananya Gupta', phone: '9876543217', email: 'ananya.gupta@email.com', address: '12A, Salt Lake City, Sector 1, Kolkata - 700064' },
  { name: 'Rohit Kumar', phone: '9876543218', email: 'rohit.kumar@email.com', address: '33, Gandhi Nagar, Jaipur - 302015' },
  { name: 'Isha Mehta', phone: '9876543219', email: 'isha.mehta@email.com', address: '9, Race Course Road, Coimbatore - 641018' },
];

const productsData = [
  { name: 'Logitech Wireless Mouse M235', category: 'Computer Accessories', price: 1295, costPrice: 850, gstRate: 18 },
  { name: 'boAt Stone 260 Bluetooth Speaker', category: 'Audio', price: 2499, costPrice: 1600, gstRate: 18 },
  { name: 'Portronics 7-in-1 USB-C Hub', category: 'Computer Accessories', price: 1899, costPrice: 1100, gstRate: 18 },
  { name: 'Amazon Basics Laptop Stand Adjustable', category: 'Computer Accessories', price: 1799, costPrice: 1050, gstRate: 12 },
  { name: 'Redgear Invador Mechanical Keyboard', category: 'Computer Accessories', price: 3499, costPrice: 2200, gstRate: 18 },
  { name: 'Logitech C270 HD Webcam', category: 'Electronics', price: 3495, costPrice: 2400, gstRate: 18 },
  { name: 'Sony WH-CH510 Wireless Headphones', category: 'Audio', price: 3990, costPrice: 2800, gstRate: 18 },
  { name: 'Mi 20000mAh Power Bank', category: 'Mobile Accessories', price: 2499, costPrice: 1700, gstRate: 18 },
  { name: 'Philips 6W LED Desk Lamp', category: 'Electronics', price: 1799, costPrice: 1100, gstRate: 12 },
  { name: 'Zorya Ergonomic Office Chair', category: 'Furniture', price: 12499, costPrice: 8500, gstRate: 18 },
];

const purchasesData = [
  { supplierName: 'Ingram Micro India', product: 'Logitech Wireless Mouse M235', quantity: 100, amount: 85000, dateOffset: 50 },
  { supplierName: 'Redington India Ltd', product: 'boAt Stone 260 Bluetooth Speaker', quantity: 60, amount: 96000, dateOffset: 48 },
  { supplierName: 'Tech Data India', product: 'Portronics 7-in-1 USB-C Hub', quantity: 80, amount: 88000, dateOffset: 45 },
  { supplierName: 'Amazon Wholesale', product: 'Amazon Basics Laptop Stand Adjustable', quantity: 50, amount: 52500, dateOffset: 42 },
  { supplierName: 'Neodrafts Solutions', product: 'Redgear Invador Mechanical Keyboard', quantity: 40, amount: 88000, dateOffset: 40 },
  { supplierName: 'Ingram Micro India', product: 'Logitech C270 HD Webcam', quantity: 45, amount: 108000, dateOffset: 38 },
  { supplierName: 'Sony India Distributor', product: 'Sony WH-CH510 Wireless Headphones', quantity: 30, amount: 84000, dateOffset: 35 },
  { supplierName: 'Xiaomi India Distributor', product: 'Mi 20000mAh Power Bank', quantity: 75, amount: 127500, dateOffset: 32 },
  { supplierName: 'Philips India Wholesale', product: 'Philips 6W LED Desk Lamp', quantity: 60, amount: 66000, dateOffset: 30 },
  { supplierName: 'Zorya Furniture Supply', product: 'Zorya Ergonomic Office Chair', quantity: 20, amount: 170000, dateOffset: 28 },
];

const suppliersData = [
  { name: 'Ingram Micro India', phone: '1800-102-8080', email: 'info@ingrammicro.co.in', address: '101, Zenith House, TTC Industrial Area, Navi Mumbai - 400701' },
  { name: 'Redington India Ltd', phone: '1800-121-2424', email: 'sales@redingtonindia.com', address: 'SDF 3-4, SEEPZ SEZ, Andheri East, Mumbai - 400096' },
  { name: 'Tech Data India', phone: '1800-200-1234', email: 'info@techdata.in', address: 'Embassy 247, Vikhroli West, Mumbai - 400079' },
  { name: 'Amazon Wholesale', phone: '1800-300-9090', email: 'b2b@amazon.in', address: 'World Trade Centre, Brigade Gateway, Bengaluru - 560055' },
  { name: 'Neodrafts Solutions', phone: '98765-43220', email: 'contact@neodrafts.com', address: 'Plot 42, Electronic City Phase 1, Bengaluru - 560100' },
  { name: 'Sony India Distributor', phone: '1800-103-7799', email: 'distributor@sony.co.in', address: 'A-31, Mohan Cooperative Industrial Estate, New Delhi - 110044' },
  { name: 'Xiaomi India Distributor', phone: '1800-104-6282', email: 'india@xiaomi.com', address: '24, Shalimar Bagh, Delhi - 110088' },
  { name: 'Philips India Wholesale', phone: '1800-102-2929', email: 'wholesale@philips.co.in', address: 'Philips House, Salt Lake City, Kolkata - 700091' },
  { name: 'Zorya Furniture Supply', phone: '98765-43221', email: 'orders@zoryafurniture.com', address: 'Industrial Area Phase 2, Chandigarh - 160002' },
];

const salesData = [
  { custIdx: 0, items: [
    { productName: 'Logitech Wireless Mouse M235', quantity: 5, rate: 1295, gstRate: 18 },
    { productName: 'Portronics 7-in-1 USB-C Hub', quantity: 3, rate: 1899, gstRate: 18 },
  ], paidPortion: 1, dateOffset: 5 },
  { custIdx: 1, items: [
    { productName: 'boAt Stone 260 Bluetooth Speaker', quantity: 2, rate: 2499, gstRate: 18 },
    { productName: 'Sony WH-CH510 Wireless Headphones', quantity: 1, rate: 3990, gstRate: 18 },
  ], paidPortion: 0.5, dateOffset: 10 },
  { custIdx: 2, items: [
    { productName: 'Redgear Invador Mechanical Keyboard', quantity: 3, rate: 3499, gstRate: 18 },
  ], paidPortion: 0, dateOffset: 15 },
  { custIdx: 3, items: [
    { productName: 'Amazon Basics Laptop Stand Adjustable', quantity: 4, rate: 1799, gstRate: 12 },
    { productName: 'Logitech C270 HD Webcam', quantity: 2, rate: 3495, gstRate: 18 },
  ], paidPortion: 0.7, dateOffset: 20 },
  { custIdx: null, items: [
    { productName: 'Zorya Ergonomic Office Chair', quantity: 1, rate: 12499, gstRate: 18 },
  ], paidPortion: 0, dateOffset: 25 },
  { custIdx: 4, items: [
    { productName: 'Mi 20000mAh Power Bank', quantity: 5, rate: 2499, gstRate: 18 },
    { productName: 'Philips 6W LED Desk Lamp', quantity: 2, rate: 1799, gstRate: 12 },
  ], paidPortion: 1, dateOffset: 30 },
  { custIdx: 5, items: [
    { productName: 'Logitech Wireless Mouse M235', quantity: 10, rate: 1295, gstRate: 18 },
  ], paidPortion: 0.3, dateOffset: 35 },
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');

    const users = await User.find();
    if (users.length === 0) {
      console.log('No users found. Register an account first.');
      process.exit(1);
    }

    for (const user of users) {
      await Promise.all([
        Customer.deleteMany({ user: user._id }),
        Product.deleteMany({ user: user._id }),
        Supplier.deleteMany({ user: user._id }),
        Setting.deleteMany({ user: user._id }),
        Purchase.deleteMany({ user: user._id }),
        Sale.deleteMany({ user: user._id }),
        Transaction.deleteMany({ user: user._id }),
        Account.deleteMany({ user: user._id }),
      ]);

      const today = new Date();

      // ── Bank Accounts ──
      const bankAccounts = [
        { name: 'HDFC Current Account', code: '1002', bankName: 'HDFC Bank', accountNumber: 'HDFC00123456789', ifscCode: 'HDFC0001234', balance: 250000 },
        { name: 'ICICI Business Account', code: '1003', bankName: 'ICICI Bank', accountNumber: 'ICICI00987654321', ifscCode: 'ICIC0005678', balance: 150000 },
        { name: 'SBI Savings Account', code: '1004', bankName: 'State Bank of India', accountNumber: 'SBI00001111222', ifscCode: 'SBIN0009012', balance: 50000 },
        { name: 'Axis Current Account', code: '1005', bankName: 'Axis Bank', accountNumber: 'AXIS0055554444', ifscCode: 'UTIB0003456', balance: 100000 },
        { name: 'Kotak Salary Account', code: '1006', bankName: 'Kotak Mahindra', accountNumber: 'KKBK0077778888', ifscCode: 'KKBK0007890', balance: 75000 },
      ];
      for (const ba of bankAccounts) {
        await Account.create({
          user: user._id, name: ba.name, code: ba.code,
          type: 'asset', category: 'bank', balance: ba.balance, isActive: true,
          metadata: { bankName: ba.bankName, accountNumber: ba.accountNumber, ifscCode: ba.ifscCode },
          description: `${ba.bankName} - ${ba.accountNumber}`,
        });
        await Transaction.create({
          user: user._id, type: 'bank_in', amount: ba.balance, description: `Opening balance - ${ba.name}`,
          date: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000),
        });
      }
      console.log(`  ✓ ${bankAccounts.length} bank accounts`);

      // ── Customers ──
      const customers = customersData.map((c) => ({
        user: user._id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        openingBalance: Math.round(Math.random() * 2000),
      }));
      await Customer.insertMany(customers);
      console.log(`  ✓ ${customers.length} customers`);

      // ── Products ──
      const products = productsData.map((p) => ({
        user: user._id,
        name: p.name,
        category: p.category,
        price: p.price,
        costPrice: p.costPrice,
        stock: 0,
        unit: 'pcs',
        gstRate: p.gstRate,
      }));
      await Product.insertMany(products);
      console.log(`  ✓ ${products.length} products`);

      // ── Suppliers ──
      const supplierDocs = suppliersData.map((s) => ({
        user: user._id,
        name: s.name,
        phone: s.phone,
        email: s.email,
        address: s.address,
        openingBalance: Math.round(Math.random() * 5000),
      }));
      const createdSuppliers = await Supplier.insertMany(supplierDocs);
      const supplierMap = {};
      createdSuppliers.forEach((s) => { supplierMap[s.name] = s._id; });
      console.log(`  ✓ ${createdSuppliers.length} suppliers`);

      // ── Purchases (add stock) ──
      const purchases = purchasesData.map((p, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - p.dateOffset);
        const prod = products.find((pr) => pr.name === p.product);
        if (prod) prod.stock += p.quantity;
        return {
          user: user._id,
          supplier: supplierMap[p.supplierName],
          supplierName: p.supplierName,
          date: d,
          product: p.product,
          productId: prod ? prod._id : null,
          quantity: p.quantity,
          amount: p.amount,
        };
      });
      await Purchase.insertMany(purchases);
      // Update product stock in DB
      for (const p of products) {
        await Product.updateOne({ user: user._id, name: p.name }, { $set: { stock: p.stock } });
      }
      console.log(`  ✓ ${purchases.length} purchases`);

      // ── Sales ──
      let saleCounter = 0;
      const allTransactions = [];

      for (const sd of salesData) {
        saleCounter++;
        const cust = sd.custIdx !== null ? customers[sd.custIdx] : null;
        const invNum = `INV-${user.email.charAt(0).toUpperCase()}${String(saleCounter).padStart(4, '0')}`;
        const d = new Date(today);
        d.setDate(d.getDate() - sd.dateOffset);

        // Reduce stock
        sd.items.forEach((item) => {
          const prod = products.find((p) => p.name === item.productName);
          if (prod) prod.stock -= item.quantity;
        });

        const items = sd.items.map((item) => {
          const taxable = item.quantity * item.rate;
          const gstHalf = taxable * (item.gstRate / 100) / 2;
          const prod = products.find((p) => p.name === item.productName);
          return {
            product: prod ? prod._id : null,
            productName: item.productName,
            quantity: item.quantity,
            rate: item.rate,
            gstRate: item.gstRate,
            taxableAmount: taxable,
            cgst: gstHalf,
            sgst: gstHalf,
            amount: taxable + gstHalf + gstHalf,
          };
        });

        const totalAmount = items.reduce((s, it) => s + it.amount, 0);
        const paidAmount = Math.round(totalAmount * sd.paidPortion * 100) / 100;

        await Sale.create({
          user: user._id,
          invoiceNumber: invNum,
          customer: cust ? cust._id : null,
          customerName: cust ? cust.name : 'Walk-in',
          date: d,
          items,
          taxableAmount: items.reduce((s, it) => s + it.taxableAmount, 0),
          cgstTotal: items.reduce((s, it) => s + it.cgst, 0),
          sgstTotal: items.reduce((s, it) => s + it.sgst, 0),
          totalAmount,
          paidAmount,
          remainingBalance: totalAmount - paidAmount,
          paymentStatus: paidAmount >= totalAmount ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
        });

        // Cash/Bank entry for paid amount
        if (paidAmount > 0) {
          allTransactions.push({
            user: user._id,
            type: 'bank_in',
            amount: paidAmount,
            description: `Payment received - ${invNum}${cust ? ' from ' + cust.name : ''}`,
            date: d,
            reference: invNum,
          });
        }
      }

      // Update stock in DB
      for (const p of products) {
        await Product.updateOne({ user: user._id, name: p.name }, { $set: { stock: Math.max(0, p.stock) } });
      }

      // ── Cash & Bank Transactions ──
      // Money out for purchases
      purchasesData.forEach((p, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - p.dateOffset);
        allTransactions.push({
          user: user._id,
          type: 'bank_out',
          amount: p.amount,
          description: `Purchase from ${p.supplierName} - ${p.product}`,
          date: d,
          reference: `PUR-${String(i + 1).padStart(4, '0')}`,
        });
      });

      // Some cash in entries
      allTransactions.push({
        user: user._id,
        type: 'cash_in',
        amount: 100000,
        description: 'Owner capital investment',
        date: new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000),
      });

      await Transaction.insertMany(allTransactions);
      console.log(`  ✓ ${allTransactions.length} cash/bank transactions`);

      // ── Settings ──
      await Setting.create({
        user: user._id,
        businessName: 'Vyapar Business Solutions',
        phone: user.phone || '9876543200',
        email: user.email,
        address: '123, Business Hub, Market Road, Mumbai - 400001',
        gstNumber: '27AABCU9603R1ZM',
        invoicePrefix: 'INV-',
      });
      console.log('  ✓ 1 setting');

      console.log(`  ✓ ${salesData.length} invoices`);
      console.log(`✅ Seeded complete for: ${user.email}\n`);
    }

    console.log('All data seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
};

seed();
