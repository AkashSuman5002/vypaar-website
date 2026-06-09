const { z } = require('zod');

const validate = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      });
    }
    next(err);
  }
};

const schemas = {
  login: z.object({
    email: z.string().email('Valid email required'),
    password: z.string().min(1, 'Password required'),
  }),
  register: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().email('Valid email required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    phone: z.string().optional(),
  }),
  customer: z.object({
    name: z.string().min(1, 'Name required').max(200),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    address: z.string().optional(),
    gstNumber: z.string().optional(),
    openingBalance: z.number().optional().default(0),
    creditLimit: z.number().optional().default(0),
  }),
  product: z.object({
    name: z.string().min(1, 'Name required').max(200),
    category: z.string().optional(),
    price: z.number().min(0, 'Price must be >= 0'),
    costPrice: z.number().min(0).optional().default(0),
    stock: z.number().min(0).optional().default(0),
    unit: z.string().optional().default('pcs'),
    gstRate: z.number().min(0).max(100).optional().default(0),
    minStock: z.number().min(0).optional().default(5),
    hsn: z.string().optional(),
  }),
  saleItem: z.object({
    product: z.string().optional(),
    productName: z.string().optional(),
    quantity: z.number().min(1, 'Quantity must be >= 1'),
    rate: z.number().min(0, 'Rate must be >= 0'),
    gstRate: z.number().min(0).max(100).optional().default(0),
    discount: z.number().min(0).optional().default(0),
  }),
  sale: z.object({
    invoiceNumber: z.string().min(1),
    customer: z.string().optional(),
    customerName: z.string().optional().default('Walk-in'),
    date: z.string().optional(),
    dueDate: z.string().optional(),
    items: z.array(z.any()).min(1, 'At least one item required'),
    paidAmount: z.number().min(0).optional().default(0),
    paymentStatus: z.enum(['paid', 'partial', 'unpaid']).optional(),
    paymentMethod: z.enum(['cash', 'bank', 'upi', 'cheque']).optional().default('cash'),
    notes: z.string().optional(),
    isInterState: z.boolean().optional().default(false),
  }),
  purchase: z.object({
    supplier: z.string().optional(),
    supplierName: z.string().min(1, 'Supplier name required'),
    billNumber: z.string().optional(),
    date: z.string().optional(),
    dueDate: z.string().optional(),
    items: z.array(z.any()).min(1, 'At least one item required'),
    totalAmount: z.number().min(0),
    paidAmount: z.number().min(0).optional().default(0),
    paymentStatus: z.enum(['paid', 'partial', 'unpaid']).optional(),
    notes: z.string().optional(),
  }),
  transaction: z.object({
    type: z.enum(['cash_in', 'cash_out', 'bank_in', 'bank_out']),
    amount: z.number().min(0, 'Amount must be >= 0'),
    description: z.string().optional(),
    date: z.string().optional(),
    reference: z.string().optional(),
  }),
  supplier: z.object({
    name: z.string().min(1, 'Name required').max(200),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    address: z.string().optional(),
    gstNumber: z.string().optional(),
    openingBalance: z.number().optional().default(0),
  }),
};

module.exports = { validate, schemas };
