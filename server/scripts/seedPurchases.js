const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Purchase = require('../models/Purchase');
const Product = require('../models/Product');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    console.log('DB connected');

    const userId = '6a1feb0c934f89f686d6d051';

    const products = await Product.find({ user: userId }).lean();
    const prodMap = {};
    products.forEach(p => { prodMap[p.name] = p; });

    const supplierMap = {
      'Ingram Micro India': '6a200bbee7723134d7335e5a',
      'Redington India Ltd': '6a200bbee7723134d7335e5b',
      'Tech Data India': '6a200bbee7723134d7335e5c',
      'Amazon Wholesale': '6a200bbee7723134d7335e5d',
      'Neodrafts Solutions': '6a200bbee7723134d7335e5e',
      'Sony India Distributor': '6a200bbee7723134d7335e5f',
      'Xiaomi India Distributor': '6a200bbee7723134d7335e60',
      'Philips India Wholesale': '6a200bbee7723134d7335e61',
      'Zorya Furniture Supply': '6a200bbee7723134d7335e62',
    };

    const purchases = [
      {
        supplier: supplierMap['Ingram Micro India'],
        supplierName: 'Ingram Micro India',
        billNumber: 'PUR-2025-001',
        date: new Date('2025-10-05'),
        dueDate: new Date('2025-11-04'),
        items: [
          { product: prodMap['Logitech Wireless Mouse M235']._id, productName: 'Logitech Wireless Mouse M235', quantity: 25, rate: 850, gstRate: 18, taxableAmount: 21250, cgst: 1912.5, sgst: 1912.5, igst: 0, amount: 25075 },
          { product: prodMap['Portronics 7-in-1 USB-C Hub']._id, productName: 'Portronics 7-in-1 USB-C Hub', quantity: 15, rate: 1100, gstRate: 18, taxableAmount: 16500, cgst: 1485, sgst: 1485, igst: 0, amount: 19470 },
        ],
        taxableAmount: 37750,
        cgstTotal: 3397.5,
        sgstTotal: 3397.5,
        igstTotal: 0,
        totalAmount: 44545,
        paidAmount: 44545,
        remainingBalance: 0,
        paymentStatus: 'paid',
        paymentMethod: 'bank',
        paymentDate: new Date('2025-10-05'),
        notes: 'Opening stock purchase',
        isInterState: false,
      },
      {
        supplier: supplierMap['Redington India Ltd'],
        supplierName: 'Redington India Ltd',
        billNumber: 'PUR-2025-002',
        date: new Date('2025-10-12'),
        dueDate: new Date('2025-11-11'),
        items: [
          { product: prodMap['boAt Stone 260 Bluetooth Speaker']._id, productName: 'boAt Stone 260 Bluetooth Speaker', quantity: 20, rate: 1600, gstRate: 18, taxableAmount: 32000, cgst: 2880, sgst: 2880, igst: 0, amount: 37760 },
          { product: prodMap['Redgear Invador Mechanical Keyboard']._id, productName: 'Redgear Invador Mechanical Keyboard', quantity: 10, rate: 2200, gstRate: 18, taxableAmount: 22000, cgst: 1980, sgst: 1980, igst: 0, amount: 25960 },
        ],
        taxableAmount: 54000,
        cgstTotal: 4860,
        sgstTotal: 4860,
        igstTotal: 0,
        totalAmount: 63720,
        paidAmount: 40000,
        remainingBalance: 23720,
        paymentStatus: 'partial',
        paymentMethod: 'bank',
        paymentDate: new Date('2025-10-12'),
        isInterState: false,
      },
      {
        supplier: supplierMap['Amazon Wholesale'],
        supplierName: 'Amazon Wholesale',
        billNumber: 'PUR-2025-003',
        date: new Date('2025-10-20'),
        dueDate: new Date('2025-11-19'),
        items: [
          { product: prodMap['Amazon Basics Laptop Stand Adjustable']._id, productName: 'Amazon Basics Laptop Stand Adjustable', quantity: 30, rate: 1050, gstRate: 12, taxableAmount: 31500, cgst: 1890, sgst: 1890, igst: 0, amount: 35280 },
        ],
        taxableAmount: 31500,
        cgstTotal: 1890,
        sgstTotal: 1890,
        igstTotal: 0,
        totalAmount: 35280,
        paidAmount: 0,
        remainingBalance: 35280,
        paymentStatus: 'unpaid',
        paymentMethod: 'cash',
        isInterState: false,
      },
      {
        supplier: supplierMap['Xiaomi India Distributor'],
        supplierName: 'Xiaomi India Distributor',
        billNumber: 'PUR-2025-004',
        date: new Date('2025-11-02'),
        dueDate: new Date('2025-12-01'),
        items: [
          { product: prodMap['Mi 20000mAh Power Bank']._id, productName: 'Mi 20000mAh Power Bank', quantity: 40, rate: 1700, gstRate: 18, taxableAmount: 68000, cgst: 6120, sgst: 6120, igst: 0, amount: 80240 },
        ],
        taxableAmount: 68000,
        cgstTotal: 6120,
        sgstTotal: 6120,
        igstTotal: 0,
        totalAmount: 80240,
        paidAmount: 80240,
        remainingBalance: 0,
        paymentStatus: 'paid',
        paymentMethod: 'bank',
        paymentDate: new Date('2025-11-02'),
        isInterState: false,
      },
      {
        supplier: supplierMap['Sony India Distributor'],
        supplierName: 'Sony India Distributor',
        billNumber: 'PUR-2025-005',
        date: new Date('2025-11-10'),
        dueDate: new Date('2025-12-09'),
        items: [
          { product: prodMap['Sony WH-CH510 Wireless Headphones']._id, productName: 'Sony WH-CH510 Wireless Headphones', quantity: 15, rate: 2800, gstRate: 18, taxableAmount: 42000, cgst: 3780, sgst: 3780, igst: 0, amount: 49560 },
          { product: prodMap['Logitech C270 HD Webcam']._id, productName: 'Logitech C270 HD Webcam', quantity: 12, rate: 2400, gstRate: 18, taxableAmount: 28800, cgst: 2592, sgst: 2592, igst: 0, amount: 33984 },
        ],
        taxableAmount: 70800,
        cgstTotal: 6372,
        sgstTotal: 6372,
        igstTotal: 0,
        totalAmount: 83544,
        paidAmount: 50000,
        remainingBalance: 33544,
        paymentStatus: 'partial',
        paymentMethod: 'bank',
        paymentDate: new Date('2025-11-10'),
        isInterState: false,
      },
      {
        supplier: supplierMap['Philips India Wholesale'],
        supplierName: 'Philips India Wholesale',
        billNumber: 'PUR-2025-006',
        date: new Date('2025-11-18'),
        dueDate: new Date('2025-12-17'),
        items: [
          { product: prodMap['Philips 6W LED Desk Lamp']._id, productName: 'Philips 6W LED Desk Lamp', quantity: 20, rate: 1100, gstRate: 12, taxableAmount: 22000, cgst: 1320, sgst: 1320, igst: 0, amount: 24640 },
        ],
        taxableAmount: 22000,
        cgstTotal: 1320,
        sgstTotal: 1320,
        igstTotal: 0,
        totalAmount: 24640,
        paidAmount: 0,
        remainingBalance: 24640,
        paymentStatus: 'unpaid',
        paymentMethod: 'cash',
        isInterState: false,
      },
      {
        supplier: supplierMap['Zorya Furniture Supply'],
        supplierName: 'Zorya Furniture Supply',
        billNumber: 'PUR-2025-007',
        date: new Date('2025-11-25'),
        dueDate: new Date('2025-12-24'),
        items: [
          { product: prodMap['Zorya Ergonomic Office Chair']._id, productName: 'Zorya Ergonomic Office Chair', quantity: 10, rate: 8500, gstRate: 18, taxableAmount: 85000, cgst: 7650, sgst: 7650, igst: 0, amount: 100300 },
        ],
        taxableAmount: 85000,
        cgstTotal: 7650,
        sgstTotal: 7650,
        igstTotal: 0,
        totalAmount: 100300,
        paidAmount: 100300,
        remainingBalance: 0,
        paymentStatus: 'paid',
        paymentMethod: 'bank',
        paymentDate: new Date('2025-11-25'),
        isInterState: false,
      },
      {
        supplier: supplierMap['Tech Data India'],
        supplierName: 'Tech Data India',
        billNumber: 'PUR-2025-008',
        date: new Date('2025-12-01'),
        dueDate: new Date('2025-12-31'),
        items: [
          { product: prodMap['Logitech Wireless Mouse M235']._id, productName: 'Logitech Wireless Mouse M235', quantity: 30, rate: 850, gstRate: 18, taxableAmount: 25500, cgst: 2295, sgst: 2295, igst: 0, amount: 30090 },
          { product: prodMap['boAt Stone 260 Bluetooth Speaker']._id, productName: 'boAt Stone 260 Bluetooth Speaker', quantity: 15, rate: 1600, gstRate: 18, taxableAmount: 24000, cgst: 2160, sgst: 2160, igst: 0, amount: 28320 },
        ],
        taxableAmount: 49500,
        cgstTotal: 4455,
        sgstTotal: 4455,
        igstTotal: 0,
        totalAmount: 58410,
        paidAmount: 58410,
        remainingBalance: 0,
        paymentStatus: 'paid',
        paymentMethod: 'bank',
        paymentDate: new Date('2025-12-01'),
        isInterState: false,
      },
    ];

    for (const p of purchases) {
      p.user = userId;
      const existing = await Purchase.findOne({ user: userId, billNumber: p.billNumber });
      if (!existing) {
        await Purchase.create(p);
        console.log(`  Created ${p.billNumber} — ${p.supplierName}, ₹${p.totalAmount}`);
      } else {
        console.log(`  Skipped ${p.billNumber} — already exists`);
      }
    }

    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

run();
