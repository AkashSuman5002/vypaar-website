const cron = require('node-cron');
const Sale = require('../models/Sale');

const startRecurringService = () => {
  // Run every hour to check for due recurring invoices
  cron.schedule('0 * * * *', async () => {
    try {
      const now = new Date();
      const templates = await Sale.find({
        isRecurringTemplate: true,
        recurringNextDate: { $lte: now },
        $or: [
          { recurringEndDate: { $exists: false } },
          { recurringEndDate: null },
          { recurringEndDate: { $gte: now } },
        ],
      }).lean();

      const eligible = templates.filter(t => {
        const maxCount = t.recurringMaxCount || 0;
        return maxCount === 0 || (t.recurringCount || 0) < maxCount;
      });

      for (const tmpl of eligible) {

        // Clone the template into a new invoice
        const newInvoice = new Sale({
          user: tmpl.user,
          business: tmpl.business,
          branch: tmpl.branch,
          warehouse: tmpl.warehouse,
          type: 'invoice',
          status: 'confirmed',
          invoiceNumber: `${tmpl.invoiceNumber}-R${(tmpl.recurringCount || 0) + 1}`,
          date: new Date(),
          dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          customer: tmpl.customer,
          customerName: tmpl.customerName,
          customerPhone: tmpl.customerPhone,
          customerGst: tmpl.customerGst,
          customerState: tmpl.customerState,
          billingAddress: tmpl.billingAddress,
          shippingAddress: tmpl.shippingAddress,
          isInterState: tmpl.isInterState,
          items: tmpl.items.map(item => ({ ...item })),
          taxableAmount: tmpl.taxableAmount,
          cgstTotal: tmpl.cgstTotal,
          sgstTotal: tmpl.sgstTotal,
          igstTotal: tmpl.igstTotal,
          cessTotal: tmpl.cessTotal,
          taxTotal: tmpl.taxTotal,
          discountTotal: tmpl.discountTotal,
          shippingCharge: tmpl.shippingCharge,
          packingCharge: tmpl.packingCharge,
          additionalChargesTotal: tmpl.additionalChargesTotal,
          totalAmount: tmpl.totalAmount,
          paymentStatus: 'unpaid',
          paidAmount: 0,
          remainingBalance: tmpl.totalAmount,
          deliveryStatus: 'pending',
        });
        await newInvoice.save();

        // Update next date
        const nextDate = new Date(tmpl.recurringNextDate);
        switch (tmpl.recurringFrequency) {
          case 'daily': nextDate.setDate(nextDate.getDate() + 1); break;
          case 'weekly': nextDate.setDate(nextDate.getDate() + 7); break;
          case 'monthly': nextDate.setMonth(nextDate.getMonth() + 1); break;
          case 'yearly': nextDate.setFullYear(nextDate.getFullYear() + 1); break;
        }
        await Sale.findByIdAndUpdate(tmpl._id, {
          recurringNextDate: nextDate,
          $inc: { recurringCount: 1 },
        });

        console.log(`[Recurring] Generated invoice ${newInvoice.invoiceNumber} from template ${tmpl.invoiceNumber}`);
      }
    } catch (err) {
      console.error('[Recurring] Error:', err.message);
    }
  });

  console.log('[Recurring] Service started — checking every hour');
};

module.exports = { startRecurringService };
