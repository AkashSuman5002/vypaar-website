const PartyRate = require('../models/PartyRate');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');

const getPartyRates = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { party, partyType, product } = req.query;
    const filter = { ...baseFilter, isActive: true };
    if (party) filter.party = party;
    if (partyType) filter.partyType = partyType;
    if (product) filter.product = product;
    const rates = await PartyRate.find(filter)
      .populate('party', 'name')
      .populate('product', 'name')
      .sort({ partyName: 1, productName: 1 });
    res.json(rates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getRatesForParty = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const rates = await PartyRate.find({
      ...baseFilter,
      party: req.params.partyId,
      isActive: true,
    }).populate('product', 'name sellingPrice');
    res.json(rates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getRateForProduct = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { partyId, productId } = req.params;
    const rate = await PartyRate.findOne({
      ...baseFilter,
      party: partyId,
      product: productId,
      isActive: true,
    });
    res.json(rate || null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createPartyRate = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { party, partyType, partyName, product, productName, rate, discountPercent, minQuantity } = req.body;
    if (!party || !product || rate === undefined) {
      return res.status(400).json({ message: 'Party, product, and rate are required' });
    }
    const existing = await PartyRate.findOne({ ...baseFilter, party, product });
    if (existing) {
      existing.rate = rate;
      if (discountPercent !== undefined) existing.discountPercent = discountPercent;
      if (minQuantity !== undefined) existing.minQuantity = minQuantity;
      if (partyName) existing.partyName = partyName;
      if (productName) existing.productName = productName;
      await existing.save();
      return res.json(existing);
    }
    const partyRate = await PartyRate.create({
      ...getCreateData(req, { party, partyType, partyName, product, productName,
      rate, discountPercent: discountPercent || 0, minQuantity: minQuantity || 1 }),
    });
    res.status(201).json(partyRate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updatePartyRate = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const rate = await PartyRate.findOne({ _id: req.params.id, ...baseFilter });
    if (!rate) return res.status(404).json({ message: 'Party rate not found' });
    const fields = ['rate', 'discountPercent', 'minQuantity', 'isActive'];
    for (const field of fields) {
      if (req.body[field] !== undefined) rate[field] = req.body[field];
    }
    await rate.save();
    res.json(rate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deletePartyRate = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const rate = await PartyRate.findOneAndDelete({ _id: req.params.id, ...baseFilter });
    if (!rate) return res.status(404).json({ message: 'Party rate not found' });
    res.json({ message: 'Party rate deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const bulkCreatePartyRates = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { rates } = req.body;
    if (!rates || !Array.isArray(rates)) {
      return res.status(400).json({ message: 'Rates array is required' });
    }
    const results = [];
    for (const r of rates) {
      const existing = await PartyRate.findOne({ ...baseFilter, party: r.party, product: r.product });
      if (existing) {
        existing.rate = r.rate;
        if (r.discountPercent !== undefined) existing.discountPercent = r.discountPercent;
        await existing.save();
        results.push(existing);
      } else {
        const created = await PartyRate.create({
          ...getCreateData(req, { party: r.party, partyType: r.partyType || 'customer',
          partyName: r.partyName || '', product: r.product, productName: r.productName || '',
          rate: r.rate, discountPercent: r.discountPercent || 0, minQuantity: r.minQuantity || 1 }),
        });
        results.push(created);
      }
    }
    res.json({ created: results.length, rates: results });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getPartyRates, getRatesForParty, getRateForProduct, createPartyRate, updatePartyRate, deletePartyRate, bulkCreatePartyRates };
