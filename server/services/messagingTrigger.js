const Setting = require('../models/Setting');
const { sendAutoMessage, sendPaymentMessage } = require('./messageService');

const triggerTransactionMessage = async (userId, businessId, eventType, transactionData) => {
  try {
    const setting = await Setting.findOne({ user: userId, ...(businessId ? { business: businessId } : {}) });
    if (!setting) return;

    const msgPrefs = setting.preferences?.transactionMessage;
    if (!msgPrefs) return;

    if (!msgPrefs.sendViaWhatsApp && !msgPrefs.sendViaVyapar) return;
    if (!msgPrefs.sendTransactionUpdates) return;

    const eventMap = {
      'sale_created': msgPrefs.autoMsgSales,
      'purchase_created': msgPrefs.autoMsgPurchase,
      'sale_order_created': msgPrefs.autoMsgSaleOrder,
      'purchase_order_created': msgPrefs.autoMsgPurchaseOrder,
      'sale_return_created': msgPrefs.autoMsgSalesReturn,
      'purchase_return_created': msgPrefs.autoMsgPurchaseReturn,
      'payment_received': msgPrefs.autoMsgPaymentIn,
      'payment_sent': msgPrefs.autoMsgPaymentOut,
      'estimate_created': msgPrefs.autoMsgEstimate,
      'proforma_created': msgPrefs.autoMsgProforma,
      'challan_created': msgPrefs.autoMsgDeliveryChallan,
      'cancelled': msgPrefs.autoMsgCancelledInvoice,
    };

    if (eventMap[eventType] === false) return;

    const messageTypeMap = {
      'sale_created': 'invoice',
      'purchase_created': 'purchase',
      'sale_order_created': 'order',
      'purchase_order_created': 'purchase_order',
      'sale_return_created': 'credit_note',
      'purchase_return_created': 'purchase_return',
      'estimate_created': 'estimate',
      'proforma_created': 'proforma',
      'challan_created': 'challan',
      'cancelled': 'cancelled',
    };

    const transactionType = messageTypeMap[eventType] || 'invoice';

    if (eventType === 'payment_received') {
      await sendPaymentMessage(userId, businessId, transactionData);
    } else if (eventType === 'payment_sent') {
      await sendPaymentMessage(userId, businessId, { ...transactionData, isPaymentOut: true });
    } else {
      await sendAutoMessage(userId, businessId, transactionType, transactionData);
    }
  } catch (error) {
    console.error('[MessagingTrigger] Error:', error.message);
  }
};

module.exports = { triggerTransactionMessage };
