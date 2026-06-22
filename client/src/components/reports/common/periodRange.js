// Computes a { from, to } date range (YYYY-MM-DD strings) for a named period.
// Used by report pages to wire the "This Month / Today / ..." period select
// to the date inputs that drive the report fetch.

const toISO = (d) => {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().split('T')[0];
};

export const PERIOD_OPTIONS = [
  { value: 'this-month', label: 'This Month' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this-week', label: 'This Week' },
  { value: 'this-quarter', label: 'This Quarter' },
  { value: 'this-year', label: 'This Year' },
  { value: 'custom', label: 'Custom' },
];

// Returns { from, to } for the given period key, or null for 'custom'
// (caller should leave the existing dates untouched for custom).
export const getPeriodRange = (period) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  switch (period) {
    case 'today':
      return { from: toISO(now), to: toISO(now) };
    case 'yesterday': {
      const yd = new Date(y, m, d - 1);
      return { from: toISO(yd), to: toISO(yd) };
    }
    case 'this-week': {
      const day = now.getDay(); // 0 = Sunday
      const diffToMonday = (day + 6) % 7;
      const start = new Date(y, m, d - diffToMonday);
      return { from: toISO(start), to: toISO(now) };
    }
    case 'this-month':
      return { from: toISO(new Date(y, m, 1)), to: toISO(new Date(y, m + 1, 0)) };
    case 'this-quarter': {
      const qStart = Math.floor(m / 3) * 3;
      return { from: toISO(new Date(y, qStart, 1)), to: toISO(new Date(y, qStart + 3, 0)) };
    }
    case 'this-year':
      return { from: toISO(new Date(y, 0, 1)), to: toISO(new Date(y, 11, 31)) };
    case 'custom':
    default:
      return null;
  }
};
