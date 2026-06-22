const Currency = require('../models/Currency');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');

const getCurrencies = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const currencies = await Currency.find({ ...baseFilter }).sort({ isBase: -1, code: 1 });
    res.json(currencies);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createCurrency = async (req, res) => {
  try {
    const { code, name, symbol, exchangeRate, isBase } = req.body;
    if (!code || !name || !symbol) {
      return res.status(400).json({ message: 'Code, name, and symbol are required' });
    }
    const baseFilter = getBaseFilter(req);
    const existing = await Currency.findOne({ ...baseFilter, code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ message: 'Currency with this code already exists' });
    }
    if (isBase) {
      await Currency.updateMany({ ...baseFilter, isBase: true }, { isBase: false });
    }
    const currency = await Currency.create({
      ...getCreateData(req, {
        code: code.toUpperCase(),
        name,
        symbol,
        exchangeRate: exchangeRate || 1,
        isBase: isBase || false,
      }),
    });
    res.status(201).json(currency);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const updateCurrency = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const currency = await Currency.findOne({ _id: req.params.id, ...baseFilter });
    if (!currency) return res.status(404).json({ message: 'Currency not found' });
    const fields = ['code', 'name', 'symbol', 'exchangeRate', 'isActive', 'isBase'];
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        currency[field] = field === 'code' ? req.body[field].toUpperCase() : req.body[field];
      }
    }
    if (req.body.isBase) {
      await Currency.updateMany({ ...baseFilter, _id: { $ne: currency._id } }, { isBase: false });
    }
    await currency.save();
    res.json(currency);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const deleteCurrency = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const currency = await Currency.findOne({ _id: req.params.id, ...baseFilter });
    if (!currency) return res.status(404).json({ message: 'Currency not found' });
    if (currency.isBase) return res.status(400).json({ message: 'Cannot delete base currency' });
    currency.isActive = false;
    await currency.save();
    res.json({ message: 'Currency deactivated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getExchangeRate = async (req, res) => {
  try {
    const { from, to } = req.params;
    const baseFilter = getBaseFilter(req);
    const fromCurrency = await Currency.findOne({ ...baseFilter, code: from.toUpperCase() });
    const toCurrency = await Currency.findOne({ ...baseFilter, code: to.toUpperCase() });
    if (!fromCurrency || !toCurrency) {
      return res.status(404).json({ message: 'Currency not found' });
    }
    const rate = toCurrency.exchangeRate / fromCurrency.exchangeRate;
    res.json({ from: from.toUpperCase(), to: to.toUpperCase(), rate: parseFloat(rate.toFixed(6)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getCurrencies, createCurrency, updateCurrency, deleteCurrency, getExchangeRate };
