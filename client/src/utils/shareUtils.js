import { whatsappAPI } from '../services/api';
import { formatCurrency } from './format';

export const generateShareMessage = (type, data) => {
  switch (type) {
    case 'invoice':
      return `*Invoice ${data.invoiceNumber || ''}*\nAmount: ${formatCurrency(data.totalAmount)}\nStatus: ${data.paymentStatus || 'Pending'}`;
    case 'purchase':
      return `*Purchase Bill ${data.billNumber || ''}*\nAmount: ${formatCurrency(data.totalAmount)}\nStatus: ${data.paymentStatus || 'Pending'}`;
    case 'purchaseOrder':
      return `*Purchase Order ${data.orderNo || ''}*\nAmount: ${formatCurrency(data.grandTotal || data.totalAmount || 0)}\nStatus: ${data.status || 'Draft'}`;
    case 'expense':
      return `*Expense Summary*\nCategory: ${data.category || ''}\nAmount: ${formatCurrency(data.totalAmount || data.total || 0)}`;
    case 'expenseSummary':
      return `*Expense Summary*\nTotal: ${formatCurrency(data.total)}\nEntries: ${data.count}`;
    default:
      return data.message || '';
  }
};

export const shareToWhatsApp = async (message, phone) => {
  try {
    await whatsappAPI.send({ phone, message });
    return true;
  } catch {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    return false;
  }
};

/**
 * Share a document (invoice/receipt/etc.) to WhatsApp as a real PDF attachment.
 * The PDF is generated server-side (same template as download/print) and sent via the
 * connected WhatsApp session — wa.me links cannot attach files, so this needs WhatsApp
 * to be connected (Settings → WhatsApp). Throws if not connected so callers can prompt.
 *
 * type ∈ invoice | estimate | quotation | order | challan | proforma | credit_note | return | purchase | receipt
 */
export const shareDocumentToWhatsApp = async ({ type, id, phone, caption = '', fileName }) => {
  const res = await whatsappAPI.sendDocument({ type, id, phone, caption, fileName });
  return res?.data;
};

export const shareViaEmail = (subject, body) => {
  window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_self');
};

export const shareToSMS = (message) => {
  window.open(`sms:?body=${encodeURIComponent(message)}`, '_self');
};

export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  }
};

export const shareToSocial = (platform, url, text) => {
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);
  const urls = {
    twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
  };
  if (urls[platform]) window.open(urls[platform], '_blank', 'width=600,height=400');
};

export const generateShareContent = (type, data) => {
  const message = generateShareMessage(type, data);
  const subject = type === 'invoice' ? `Invoice ${data.invoiceNumber || ''}`
    : type === 'purchase' ? `Purchase Bill ${data.billNumber || ''}`
    : type === 'purchaseOrder' ? `Purchase Order ${data.orderNo || ''}`
    : 'Expense Details';
  return { message, subject };
};
