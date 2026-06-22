const ServiceReminder = require('../models/ServiceReminder');
const { sendAutoMessage } = require('./messageService');

const CHECK_INTERVAL = 60 * 60 * 1000;

const checkReminders = async () => {
  try {
    const now = new Date();
    const dueReminders = await ServiceReminder.find({
      isActive: true,
      nextReminderAt: { $lte: now },
    }).populate('items.product', 'name price');

    for (const reminder of dueReminders) {
      const message = `Service reminder: ${reminder.name}\nItems: ${(reminder.items || []).map(i => i.product?.name || i.productName || 'Item').join(', ')}\nPlease schedule the service.`;

      console.log(`[Service Reminder] Sending reminder: ${reminder.name}`);

      const nextDate = new Date(now.getTime() + (reminder.servicePeriod || 30) * 24 * 60 * 60 * 1000);
      await ServiceReminder.findOneAndUpdate(
        { _id: reminder._id },
        { $set: { nextReminderAt: nextDate, lastSentAt: now } }
      );
    }
  } catch (err) {
    console.error('Service reminder check failed:', err.message);
  }
};

const startServiceReminderCheck = () => {
  console.log('Service reminder scheduler started');
  setInterval(checkReminders, CHECK_INTERVAL);
  setTimeout(checkReminders, 10000);
};

module.exports = { startServiceReminderCheck };
