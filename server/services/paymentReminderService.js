const cron = require('node-cron');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const Notification = require('../models/Notification');
const Setting = require('../models/Setting');
const ServiceReminder = require('../models/ServiceReminder');

const checkPaymentReminders = async () => {
  try {
    const users = await Setting.find({
      $or: [
        { 'preferences.party.paymentReminder': true },
        { 'preferences.serviceReminders.enableReminders': true },
      ],
    }).select('user preferences.party.reminderDays preferences.serviceReminders');

    for (const userSetting of users) {
      const userId = userSetting.user;
      const partyReminder = userSetting.preferences?.party?.paymentReminder;
      const serviceRemindersEnabled = userSetting.preferences?.serviceReminders?.enableReminders;
      if (!partyReminder && !serviceRemindersEnabled) continue;

      const reminderDays = parseInt(userSetting.preferences?.party?.reminderDays) ||
        parseInt(userSetting.preferences?.serviceReminders?.reminderInterval) || 7;

      const dueDateThreshold = new Date();
      dueDateThreshold.setDate(dueDateThreshold.getDate() + reminderDays);

      // Check overdue sales
      const overdueSales = await Sale.find({
        user: userId,
        paymentStatus: { $in: ['unpaid', 'partial'] },
        dueDate: { $lte: dueDateThreshold, $gte: new Date() },
      }).populate('customer', 'name phone');

      for (const sale of overdueSales) {
        const existing = await Notification.findOne({
          user: userId,
          referenceModel: 'payment-reminder',
          referenceId: sale._id,
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        });
        if (existing) continue;

        const balance = (sale.totalAmount || 0) - (sale.paidAmount || 0);
        await Notification.create({
          user: userId,
          type: 'payment_due',
          title: 'Payment Reminder',
          message: `${sale.customer?.name || sale.customerName || 'Customer'} has pending payment of ₹${balance.toFixed(2)} for invoice ${sale.invoiceNumber || ''}. Due: ${sale.dueDate ? new Date(sale.dueDate).toLocaleDateString() : 'N/A'}`,
          referenceModel: 'payment-reminder',
          referenceId: sale._id,
          read: false,
        });
      }

      // Check overdue purchases
      const overduePurchases = await Purchase.find({
        user: userId,
        paymentStatus: { $in: ['unpaid', 'partial'] },
        dueDate: { $lte: dueDateThreshold, $gte: new Date() },
      }).populate('supplier', 'name phone');

      for (const purchase of overduePurchases) {
        const existing = await Notification.findOne({
          user: userId,
          referenceModel: 'payment-reminder',
          referenceId: purchase._id,
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        });
        if (existing) continue;

        const balance = (purchase.totalAmount || 0) - (purchase.paidAmount || 0);
        await Notification.create({
          user: userId,
          type: 'payment_due',
          title: 'Payment Reminder',
          message: `Pending payment of ₹${balance.toFixed(2)} to ${purchase.supplier?.name || purchase.supplierName || 'Supplier'} for bill ${purchase.billNumber || ''}. Due: ${purchase.dueDate ? new Date(purchase.dueDate).toLocaleDateString() : 'N/A'}`,
          referenceModel: 'payment-reminder',
          referenceId: purchase._id,
          read: false,
        });
      }

      // Auto follow-up via WhatsApp (if serviceReminders.autoFollowUp enabled)
      if (userSetting.preferences?.serviceReminders?.autoFollowUp && serviceRemindersEnabled) {
        const { sendManualMessage } = require('./whatsappService');
        const overdueForFollowUp = [...overdueSales, ...overduePurchases];
        for (const txn of overdueForFollowUp) {
          const phone = txn.customerPhone || txn.supplierPhone || txn.customer?.phone || txn.supplier?.phone;
          if (!phone) continue;
          const balance = (txn.totalAmount || 0) - (txn.paidAmount || 0);
          try {
            await sendManualMessage(userId, null, phone,
              `Reminder: Pending payment of ₹${balance.toFixed(2)} for ${txn.invoiceNumber || txn.billNumber || 'invoice'}. Please clear at your earliest.`
            );
          } catch (e) {}
        }
      }
    }

    // Check service reminders
    const now = new Date();
    const dueReminders = await ServiceReminder.find({
      isActive: true,
      nextReminderAt: { $lte: now },
    }).populate('items.product', 'name');

    for (const reminder of dueReminders) {
      const existing = await Notification.findOne({
        user: reminder.user,
        referenceModel: 'service-reminder',
        referenceId: reminder._id,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });
      if (existing) continue;

      const itemNames = reminder.items.map(i => i.product?.name || i.productName || 'Item').join(', ');

      await Notification.create({
        user: reminder.user,
        type: 'service_reminder',
        title: 'Service Reminder',
        message: `Service period for ${itemNames} (${reminder.servicePeriod} days) is due. Please follow up with your customer.`,
        referenceModel: 'service-reminder',
        referenceId: reminder._id,
        read: false,
      });

      const nextDate = new Date(now.getTime() + reminder.servicePeriod * 24 * 60 * 60 * 1000);
      await ServiceReminder.findByIdAndUpdate(reminder._id, {
        lastSentAt: now,
        nextReminderAt: nextDate,
      });
    }
  } catch (error) {
    console.error('[PaymentReminder] Error:', error.message);
  }
};

const startPaymentReminder = () => {
  cron.schedule('0 9 * * *', async () => {
    console.log('[PaymentReminder] Running daily check...');
    await checkPaymentReminders();
    console.log('[PaymentReminder] Completed');
  }, { timezone: 'Asia/Kolkata' });
  console.log('[PaymentReminder] Scheduled daily at 9:00 AM IST');
};

module.exports = { startPaymentReminder, checkPaymentReminders };
