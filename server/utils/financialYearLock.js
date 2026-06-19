// Shared helper for enforcing a closed (locked) financial-year period.
//
// When a user closes a financial year via the Utilities > Close Financial Year
// flow, we persist a lock on their Setting document:
//   setting.financialYearLock = { isLocked, lockedUntil, closedFY, closedAt }
//
// Any transaction-creation path can call assertDateNotLocked(setting, date) to
// block creating/editing records dated on or before `lockedUntil` (the close
// date of the most recently closed period).

// Returns null if the date is allowed, or an error message string if it falls
// inside a locked (closed) period.
const checkDateLocked = (setting, date) => {
  const lock = setting?.financialYearLock;
  if (!lock || !lock.isLocked || !lock.lockedUntil) return null;
  const txnDate = date ? new Date(date) : new Date();
  if (isNaN(txnDate.getTime())) return null;
  const lockedUntil = new Date(lock.lockedUntil);
  if (txnDate <= lockedUntil) {
    const until = lockedUntil.toISOString().split('T')[0];
    return `This transaction is dated within a closed financial year (${lock.closedFY || ''}). Transactions on or before ${until} are locked and cannot be created or edited.`;
  }
  return null;
};

// Express helper: returns true (and sends 403) if the date is locked.
// Usage:  if (isDateLocked(res, setting, date)) return;
const isDateLocked = (res, setting, date) => {
  const msg = checkDateLocked(setting, date);
  if (msg) {
    res.status(403).json({ message: msg });
    return true;
  }
  return false;
};

module.exports = { checkDateLocked, isDateLocked };
