const LedgerNote = require('../models/LedgerNote');
const { getBaseFilter } = require('../utils/queryHelper');

const getNote = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { partyId, partyType } = req.params;
    const note = await LedgerNote.findOne({ ...baseFilter, partyId, partyType });
    res.json({ note: note ? note.note : '' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const saveNote = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { partyId, partyType } = req.params;
    const { note } = req.body;
    const updated = await LedgerNote.findOneAndUpdate(
      { ...baseFilter, partyId, partyType },
      { note, partyId, partyType },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ note: updated.note });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getNote, saveNote };
