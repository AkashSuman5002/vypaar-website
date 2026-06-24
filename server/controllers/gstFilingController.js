const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const Setting = require('../models/Setting');
const GstFiling = require('../models/GstFiling');
const GstRecord = require('../models/GstRecord');
const { getBaseFilter } = require('../utils/queryHelper');
const { isB2B, docGstSplit, itemGstSplit, parseGSTR2B } = require('../utils/reportHelpers');

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
      totalInvoiceValue += sale.totalAmount || 0;

      // Use the GST split stored on each line at invoice time (cgst/sgst vs igst
      // already encodes intra- vs inter-state). This keeps GST Filing identical to
      // the GST Reports section instead of re-deriving a 50/50 split from rate.
      for (const item of (sale.items || [])) {
        const split = itemGstSplit(item);
        totalTaxable += split.taxable;
        totalCGST += split.cgst;
        totalSGST += split.sgst;
        totalIGST += split.igst;

        const hsn = item.hsn || 'NA';
        if (!hsnSummary[hsn]) hsnSummary[hsn] = { hsn, qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, rate: item.gstRate || 0 };
        hsnSummary[hsn].qty += item.quantity || 0;
        hsnSummary[hsn].taxable += split.taxable;
        hsnSummary[hsn].cgst += split.cgst;
        hsnSummary[hsn].sgst += split.sgst;
        hsnSummary[hsn].igst += split.igst;
      }

      if (isB2B(sale.customer)) {
        b2bInvoices.push({
          gstin: sale.customer.gstNumber,
          invoiceNumber: sale.invoiceNumber,
          invoiceDate: sale.date,
          invoiceValue: sale.totalAmount,
          placeOfSupply: sale.placeOfSupply || '',
          reverseCharge: sale.reverseCharge ? 'Y' : 'N',
          items: sale.items.map((i) => {
            const split = itemGstSplit(i);
            return {
              hsn: i.hsn || 'NA',
              taxableValue: split.taxable,
              rate: i.gstRate || 0,
              cgst: split.cgst,
              sgst: split.sgst,
              igst: split.igst,
            };
          }),
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
      // Use the stored document-level GST split (handles inter-state IGST correctly).
      const split = docGstSplit(purchase);
      totalTaxable += split.taxable;
      totalCGST += split.cgst;
      totalSGST += split.sgst;
      totalIGST += split.igst;
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

    // Use stored document-level GST totals (correct inter-state IGST handling).
    for (const s of sales) {
      const split = docGstSplit(s);
      outwardTaxable += split.taxable;
      outwardCGST += split.cgst;
      outwardSGST += split.sgst;
      outwardIGST += split.igst;
    }
    for (const p of purchases) {
      const split = docGstSplit(p);
      inwardTaxable += split.taxable;
      inwardCGST += split.cgst;
      inwardSGST += split.sgst;
      inwardIGST += split.igst;
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

      if (isB2B(sale.customer)) {
        const inv = {
          gstin: sale.customer.gstNumber,
          inv: [{
            inum: sale.invoiceNumber,
            idt: new Date(sale.date).toISOString().split('T')[0],
            val: invoiceVal,
            pos: sale.placeOfSupply || '',
            rev: sale.reverseCharge ? 'Y' : 'N',
            itms: (sale.items || []).map((i) => {
              const split = itemGstSplit(i);
              return {
                num: 1,
                itm_det: {
                  rt: i.gstRate || 0,
                  txval: split.taxable,
                  iamt: split.igst, camt: split.cgst,
                  samt: split.sgst,
                  csamt: split.cess,
                },
              };
            }),
          }],
        };
        gstr1.b2b.push(inv);
      }

      for (const item of (sale.items || [])) {
        const split = itemGstSplit(item);
        const hsn = item.hsn || 'NA';
        if (!gstr1.hsn[hsn]) gstr1.hsn[hsn] = { hsn, uqc: 'NOS', qty: 0, val: 0, camt: 0, samt: 0, iamt: 0 };
        gstr1.hsn[hsn].qty += item.quantity || 0;
        gstr1.hsn[hsn].val += split.taxable;
        gstr1.hsn[hsn].camt += split.cgst;
        gstr1.hsn[hsn].samt += split.sgst;
        gstr1.hsn[hsn].iamt += split.igst;
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

// Fix 13: import a GST-portal GSTR-2B (or 2A) JSON into GstRecord, which the
// GSTR-2A reconciliation report then matches against the book purchases. Re-importing
// the same invoices replaces them (idempotent), so a fresh download just refreshes.
const importGSTR2B = async (req, res) => {
  try {
    const json = req.body?.data || req.body;
    const rows = parseGSTR2B(json);
    if (!rows.length) {
      return res.status(400).json({ message: 'No B2B invoices found in the provided GSTR-2B/2A JSON.' });
    }
    const base = { user: req.user._id };
    if (req.businessId) base.business = req.businessId;

    const invNos = rows.map((r) => r.invoiceNumber).filter(Boolean);
    if (invNos.length) {
      await GstRecord.deleteMany({ ...base, invoiceType: '2B', invoiceNumber: { $in: invNos } });
    }
    const inserted = await GstRecord.insertMany(rows.map((r) => ({ ...base, ...r })));
    res.json({ imported: inserted.length, message: `Imported ${inserted.length} GSTR-2B invoice(s).` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getGSTR1Data, getGSTR2Data, getGSTR3BData, prepareGSTR1JSON, getFilings, markFiled, importGSTR2B };
