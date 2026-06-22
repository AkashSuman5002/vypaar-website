const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const Setting = require('../models/Setting');
const GstFiling = require('../models/GstFiling');
const { getBaseFilter } = require('../utils/queryHelper');

const getPeriod = (month, year) => `${year}-${String(month).padStart(2, '0')}`;

const getGSTR1Data = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { month, year } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59);

    const sales = await Sale.find({
      ...baseFilter, type: 'invoice',
      date: { $gte: startDate, $lte: endDate },
    }).populate('customer', 'name gstNumber state');

    let totalTaxable = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0, totalInvoiceValue = 0;

    const b2bInvoices = [];
    const b2cLarge = [];
    const hsnSummary = {};

    for (const sale of sales) {
      const isInterState = sale.placeOfSupply && sale.placeOfSupply !== sale.customer?.state;
      totalInvoiceValue += sale.totalAmount || 0;

      for (const item of (sale.items || [])) {
        const taxable = item.taxableAmount || item.amount || 0;
        const gstAmt = taxable * ((item.gstRate || 0) / 100);
        totalTaxable += taxable;
        if (isInterState) totalIGST += gstAmt;
        else { totalCGST += gstAmt / 2; totalSGST += gstAmt / 2; }

        const hsn = item.hsn || 'NA';
        if (!hsnSummary[hsn]) hsnSummary[hsn] = { hsn, qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, rate: item.gstRate || 0 };
        hsnSummary[hsn].qty += item.quantity || 0;
        hsnSummary[hsn].taxable += taxable;
        if (isInterState) hsnSummary[hsn].igst += gstAmt;
        else { hsnSummary[hsn].cgst += gstAmt / 2; hsnSummary[hsn].sgst += gstAmt / 2; }
      }

      if (sale.customer?.gstNumber) {
        b2bInvoices.push({
          gstin: sale.customer.gstNumber,
          invoiceNumber: sale.invoiceNumber,
          invoiceDate: sale.date,
          invoiceValue: sale.totalAmount,
          placeOfSupply: sale.placeOfSupply || '',
          reverseCharge: sale.reverseCharge ? 'Y' : 'N',
          items: sale.items.map(i => ({
            hsn: i.hsn || 'NA',
            taxableValue: i.taxableAmount || i.amount || 0,
            rate: i.gstRate || 0,
            cgst: isInterState ? 0 : (i.taxableAmount || 0) * ((i.gstRate || 0) / 200),
            sgst: isInterState ? 0 : (i.taxableAmount || 0) * ((i.gstRate || 0) / 200),
            igst: isInterState ? (i.taxableAmount || 0) * ((i.gstRate || 0) / 100) : 0,
          })),
        });
      } else {
        b2cLarge.push({
          invoiceNumber: sale.invoiceNumber,
          invoiceDate: sale.date,
          invoiceValue: sale.totalAmount,
          placeOfSupply: sale.placeOfSupply || '',
          taxableValue: sale.items.reduce((s, i) => s + (i.taxableAmount || i.amount || 0), 0),
          rate: sale.items[0]?.gstRate || 0,
        });
      }
    }

    res.json({
      period: `${getPeriod(m, y)}`,
      summary: { totalInvoices: sales.length, totalTaxable, totalCGST, totalSGST, totalIGST, totalInvoiceValue },
      b2b: b2bInvoices,
      b2cLarge,
      hsnSummary: Object.values(hsnSummary),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getGSTR2Data = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { month, year } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59);

    const purchases = await Purchase.find({
      ...baseFilter, date: { $gte: startDate, $lte: endDate },
    }).populate('supplier', 'name gstNumber state');

    let totalTaxable = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0, totalInvoiceValue = 0;

    for (const purchase of purchases) {
      totalInvoiceValue += purchase.totalAmount || 0;
      for (const item of (purchase.items || [])) {
        const taxable = item.taxableAmount || item.amount || 0;
        const gstAmt = taxable * ((item.gstRate || 0) / 100);
        totalTaxable += taxable;
        totalCGST += gstAmt / 2;
        totalSGST += gstAmt / 2;
      }
    }

    res.json({
      period: `${getPeriod(m, y)}`,
      summary: { totalInvoices: purchases.length, totalTaxable, totalCGST, totalSGST, totalIGST, totalInvoiceValue },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getGSTR3BData = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { month, year } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59);

    const [sales, purchases] = await Promise.all([
      Sale.find({ ...baseFilter, type: 'invoice', date: { $gte: startDate, $lte: endDate } }),
      Purchase.find({ ...baseFilter, date: { $gte: startDate, $lte: endDate } }),
    ]);

    let outwardTaxable = 0, outwardCGST = 0, outwardSGST = 0, outwardIGST = 0;
    let inwardTaxable = 0, inwardCGST = 0, inwardSGST = 0, inwardIGST = 0;

    for (const s of sales) {
      for (const item of (s.items || [])) {
        const taxable = item.taxableAmount || item.amount || 0;
        outwardTaxable += taxable;
        outwardCGST += taxable * ((item.gstRate || 0) / 200);
        outwardSGST += taxable * ((item.gstRate || 0) / 200);
      }
    }
    for (const p of purchases) {
      for (const item of (p.items || [])) {
        const taxable = item.taxableAmount || item.amount || 0;
        inwardTaxable += taxable;
        inwardCGST += taxable * ((item.gstRate || 0) / 200);
        inwardSGST += taxable * ((item.gstRate || 0) / 200);
      }
    }

    const netCGST = outwardCGST - inwardCGST;
    const netSGST = outwardSGST - inwardSGST;
    const netIGST = outwardIGST - inwardIGST;

    res.json({
      period: `${getPeriod(m, y)}`,
      outward: { taxable: outwardTaxable, cgst: outwardCGST, sgst: outwardSGST, igst: outwardIGST },
      inward: { taxable: inwardTaxable, cgst: inwardCGST, sgst: inwardSGST, igst: inwardIGST },
      net: { cgst: Math.max(0, netCGST), sgst: Math.max(0, netSGST), igst: Math.max(0, netIGST) },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const prepareGSTR1JSON = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { month, year } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();

    const settings = await Setting.findOne({ user: req.user._id });
    const gstin = settings?.gstNumber || '';

    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59);

    const sales = await Sale.find({
      ...baseFilter, type: 'invoice',
      date: { $gte: startDate, $lte: endDate },
    }).populate('customer', 'name gstNumber state');

    const gstr1 = {
      gstin,
      fp: `${String(m).padStart(2, '0')}${y}`,
      gt: 0, cur_gt: 0,
      b2b: [], b2cl: [], hsn: {},
    };

    let totalInvoiceValue = 0;

    for (const sale of sales) {
      totalInvoiceValue += sale.totalAmount || 0;
      const invoiceVal = sale.totalAmount || 0;

      if (sale.customer?.gstNumber) {
        const inv = {
          gstin: sale.customer.gstNumber,
          inv: [{
            inum: sale.invoiceNumber,
            idt: new Date(sale.date).toISOString().split('T')[0],
            val: invoiceVal,
            pos: sale.placeOfSupply || '',
            rev: sale.reverseCharge ? 'Y' : 'N',
            itms: (sale.items || []).map(i => ({
              num: 1,
              itm_det: {
                rt: i.gstRate || 0,
                txval: i.taxableAmount || i.amount || 0,
                iamt: 0, camt: (i.taxableAmount || 0) * ((i.gstRate || 0) / 200),
                samt: (i.taxableAmount || 0) * ((i.gstRate || 0) / 200),
                csamt: 0,
              },
            })),
          }],
        };
        gstr1.b2b.push(inv);
      }

      for (const item of (sale.items || [])) {
        const hsn = item.hsn || 'NA';
        if (!gstr1.hsn[hsn]) gstr1.hsn[hsn] = { hsn, uqc: 'NOS', qty: 0, val: 0, camt: 0, samt: 0, iamt: 0 };
        gstr1.hsn[hsn].qty += item.quantity || 0;
        gstr1.hsn[hsn].val += item.taxableAmount || item.amount || 0;
        gstr1.hsn[hsn].camt += (item.taxableAmount || 0) * ((item.gstRate || 0) / 200);
        gstr1.hsn[hsn].samt += (item.taxableAmount || 0) * ((item.gstRate || 0) / 200);
      }
    }

    gstr1.gt = totalInvoiceValue;
    gstr1.hsn = Object.values(gstr1.hsn);

    const period = getPeriod(m, y);
    let filing = await GstFiling.findOne({ ...baseFilter, period, returnType: 'GSTR1' });
    if (!filing) {
      filing = await GstFiling.create({
        ...getCreateDataForFiling(req, {
          period, returnType: 'GSTR1', status: 'prepared',
          totalInvoices: sales.length, totalTaxable: gstr1.b2b.reduce((s, b) => s + b.inv[0].val, 0),
          totalAmount: totalInvoiceValue, totalTax: gstr1.b2b.reduce((s, b) => s + b.inv[0].val, 0) - gstr1.b2b.reduce((s, b) => s + b.inv.reduce((s2, i) => s2 + i.itms.reduce((s3, it) => s3 + it.itm_det.txval, 0), 0), 0),
          dueDate: new Date(y, m, 11),
        }),
      });
    }

    res.json({ gstr1, filingId: filing._id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCreateDataForFiling = (req, extra = {}) => {
  const data = { user: req.user._id, ...extra };
  if (req.businessId) data.business = req.businessId;
  return data;
};

const getFilings = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const filings = await GstFiling.find(baseFilter).sort({ createdAt: -1 });
    res.json({ filings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const markFiled = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const filing = await GstFiling.findOne({ _id: req.params.id, ...baseFilter });
    if (!filing) return res.status(404).json({ message: 'Filing not found' });
    filing.status = 'filed';
    filing.filingDate = new Date();
    filing.referenceNumber = req.body.referenceNumber || '';
    await filing.save();
    res.json(filing);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getGSTR1Data, getGSTR2Data, getGSTR3BData, prepareGSTR1JSON, getFilings, markFiled };
