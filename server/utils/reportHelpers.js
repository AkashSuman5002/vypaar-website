// Pure, DB-free helpers for the report controllers.
//
// These exist so the calculation logic for the report fixes can be unit-tested
// without a database (same convention as utils/valuation.js). Each function is a
// plain transform over already-loaded plain objects.

// ── Fix 1 / Fix 2: GST classification & stored tax splits ──────────────────────

// A party is B2B for GST purposes ONLY if it has a (non-empty) GSTIN. A saved
// customer/supplier without a GSTIN is B2C. (Previously B2B was decided by
// "has a customer record / not Walk-in", which mis-bucketed unregistered parties.)
function isB2B(party) {
  return !!(party && typeof party.gstNumber === 'string' && party.gstNumber.trim().length > 0);
}

// Read the stored, document-level GST split. We never re-derive a 50/50
// central/state split from rate — that ignores inter-state IGST and disagrees
// with the figures stored at invoice time. The stored totals are the source of truth.
function docGstSplit(doc) {
  return {
    taxable: doc.taxableAmount || 0,
    cgst: doc.cgstTotal || 0,
    sgst: doc.sgstTotal || 0,
    igst: doc.igstTotal || 0,
    cess: doc.cessTotal || 0,
  };
}

// Per-line stored GST split (items already carry cgst/sgst/igst computed at save time).
function itemGstSplit(item) {
  return {
    taxable: item.taxableAmount || item.amount || 0,
    cgst: item.cgst || 0,
    sgst: item.sgst || 0,
    igst: item.igst || 0,
    cess: item.cess || 0,
  };
}

// ── Fix 4 / Fix 5: Day Book ────────────────────────────────────────────────────

// Build a chronological day book with a correct running balance.
//   cashRows:   [{ date, voucher, particular, moneyIn, moneyOut, type }]
//   creditRows: [{ date, voucher, particular, type, dueAmount }]  (no cash impact)
// Cash rows move the running balance; credit (unpaid) rows only make the voucher
// visible in the book without distorting the cash balance — so credit sales/purchases
// finally appear in the Day Book without any double counting of received cash.
function buildDayBookEntries(cashRows = [], creditRows = []) {
  const rows = [
    ...cashRows.map((r) => ({
      ...r,
      moneyIn: r.moneyIn || 0,
      moneyOut: r.moneyOut || 0,
    })),
    ...creditRows.map((r) => ({
      ...r,
      moneyIn: 0,
      moneyOut: 0,
      dueAmount: r.dueAmount || 0,
    })),
  ];
  // Oldest → newest so the running balance accumulates in real chronological order.
  rows.sort((a, b) => new Date(a.date) - new Date(b.date));
  let balance = 0;
  return rows.map((r) => {
    balance += (r.moneyIn || 0) - (r.moneyOut || 0);
    return { ...r, balance };
  });
}

// ── Fix 8: Bank statement running balance (single account or all) ──────────────

// Chronological running balance for bank transactions, starting from openingBalance.
function bankStatementRows(transactions = [], openingBalance = 0) {
  const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
  let balance = openingBalance || 0;
  return sorted.map((t) => {
    const isIn = t.type === 'bank_in';
    balance += isIn ? t.amount : -t.amount;
    return {
      date: t.date,
      voucherType: t.type,
      voucherNo: t.reference || '-',
      partyName: t.partyName || '-',
      description: t.description || '-',
      debit: isIn ? 0 : t.amount,
      credit: isIn ? t.amount : 0,
      balance,
    };
  });
}

// Identifying text for matching free-form transactions to a chosen bank account
// (Transactions carry no account id, so we match on name / bank name / account no.).
function bankAccountNeedles(account) {
  if (!account) return [];
  return [account.name, account.metadata?.bankName, account.metadata?.accountNumber]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());
}

function transactionMatchesAccount(txn, needles) {
  if (!needles || needles.length === 0) return true;
  const haystack = [txn.reference, txn.description, txn.partyName, txn.type]
    .map((v) => String(v ?? '').toLowerCase())
    .join(' ');
  return needles.some((n) => haystack.includes(n));
}

// ── Fix 6 / Fix 7: Vyapar-style P&L whose line items reconcile to the totals ───

// Builds the flat Vyapar P&L line items AND derives Gross/Net Profit FROM those
// same line items, so the displayed breakdown always sums to the displayed totals.
// Each expandable section carries ONLY its own children (direct vs indirect).
function buildProfitLossLineItems(f = {}) {
  const n = (v) => v || 0;
  const taxPayable = n(f.totalGST) + n(f.tcsPayable);
  const taxReceivable = n(f.purchaseGST) + n(f.taxReceivableExtra);

  const grossProfit =
    n(f.totalSales) - n(f.totalCreditNotes) + n(f.saleFA) -
    n(f.totalPurchases) + n(f.totalDebitNotes) - n(f.purchaseFA) -
    n(f.directExpenses) -
    taxPayable + taxReceivable -
    n(f.openingStock) + n(f.closingStock) -
    n(f.openingStockFA) + n(f.closingStockFA);

  const netProfit = grossProfit + n(f.otherIncome) - n(f.indirectExpenses);

  const lineItems = [
    { label: 'Sale (+)', amount: n(f.totalSales), type: 'income' },
    { label: 'Credit Note (-)', amount: n(f.totalCreditNotes), type: 'expense' },
    { label: 'Sale FA (+)', amount: n(f.saleFA), type: 'income' },
    { label: 'Purchase (-)', amount: n(f.totalPurchases), type: 'expense' },
    { label: 'Debit Note (+)', amount: n(f.totalDebitNotes), type: 'income' },
    { label: 'Purchase FA (-)', amount: n(f.purchaseFA), type: 'expense' },
    {
      label: 'Direct Expenses(-)',
      amount: n(f.directExpenses),
      type: 'section',
      children: (f.directItems || []).filter((e) => e.amount > 0),
    },
    {
      label: 'Tax Payable (-)',
      amount: taxPayable,
      type: 'section',
      children: [
        { label: 'GST Payable (-)', amount: n(f.totalGST), type: 'expense' },
        { label: 'TCS Payable (-)', amount: n(f.tcsPayable), type: 'expense' },
      ],
    },
    {
      label: 'Tax Receivable (+)',
      amount: taxReceivable,
      type: 'section',
      children: [
        { label: 'GST Receivable (+)', amount: n(f.purchaseGST), type: 'income' },
      ],
    },
    { label: 'Opening Stock (-)', amount: n(f.openingStock), type: 'expense' },
    { label: 'Closing Stock (+)', amount: n(f.closingStock), type: 'income' },
    { label: 'Opening Stock FA (-)', amount: n(f.openingStockFA), type: 'expense' },
    { label: 'Closing Stock FA (+)', amount: n(f.closingStockFA), type: 'income' },
    { label: 'Gross Profit', amount: grossProfit, type: 'total' },
    { label: 'Other Income (+)', amount: n(f.otherIncome), type: 'income' },
    {
      label: 'Indirect Expenses(-)',
      amount: n(f.indirectExpenses),
      type: 'section',
      children: (f.indirectItems || []).filter((e) => e.amount > 0),
    },
    { label: 'Net Profit', amount: netProfit, type: 'total' },
  ];

  return { lineItems, grossProfit, netProfit };
}

// ── Fix 9: opening/closing stock value "as of" a date ──────────────────────────

// Stock value as of a date = sum over stockable products of (qtyAsOf * unitCost),
// where qtyAsOf = currentStock - (net signed movements AFTER that date). Passing an
// empty movedAfterMap therefore yields the current inventory value. movedAfterMap is
// keyed by product id -> net signed quantity moved after the cut-off date.
function stockValueAsOf(products = [], movedAfterMap = {}) {
  return products.reduce((sum, p) => {
    if (p.type === 'service') return sum;
    const moved = movedAfterMap[p._id ? p._id.toString() : ''] || 0;
    const qty = (p.stock || 0) - moved;
    const unitCost = p.costPrice || p.purchasePrice || p.price || 0;
    return sum + qty * unitCost;
  }, 0);
}

// ── Fix 16: receivables aging bucket (by days overdue) ─────────────────────────
function agingBucket(daysOverdue) {
  if (daysOverdue <= 30) return '0-30';
  if (daysOverdue <= 60) return '31-60';
  if (daysOverdue <= 90) return '61-90';
  return '90+';
}

// ── Fix 15: HSN summary grouped by HSN + rate + UQC (unit) ─────────────────────
// The GST portal requires the HSN summary keyed by HSN + tax rate + unit of measure,
// with the rate shown. Tax comes from the stored per-line cgst/sgst/igst.
function buildHsnSummary(sales = []) {
  const map = {};
  for (const sale of sales) {
    for (const item of (sale.items || [])) {
      const split = itemGstSplit(item);
      const hsn = item.hsn || 'GENERAL';
      const rate = item.gstRate || 0;
      const uqc = item.unit || 'NOS';
      const key = `${hsn}|${rate}|${uqc}`;
      if (!map[key]) {
        map[key] = { hsn, rate, uqc, quantity: 0, taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, gstAmount: 0 };
      }
      map[key].quantity += item.quantity || 0;
      map[key].taxableAmount += split.taxable;
      map[key].cgst += split.cgst;
      map[key].sgst += split.sgst;
      map[key].igst += split.igst;
      map[key].gstAmount += split.cgst + split.sgst + split.igst;
    }
  }
  return Object.values(map);
}

// ── Fix 17: stock reconciliation (Product.stock vs StockMovement ledger) ───────
// Compares the snapshot quantity stored on each product against the running balance
// implied by the StockMovement ledger (latest balanceAfter), flagging drift.
function reconcileStock(products = [], ledgerQtyById = {}) {
  const rows = [];
  let mismatchCount = 0;
  for (const p of products) {
    if (p.type === 'service') continue;
    const id = p._id ? p._id.toString() : '';
    const systemStock = p.stock || 0;
    const hasLedger = Object.prototype.hasOwnProperty.call(ledgerQtyById, id);
    const ledgerStock = hasLedger ? ledgerQtyById[id] : null;
    const difference = ledgerStock == null ? 0 : Math.round((systemStock - ledgerStock) * 1000) / 1000;
    let status = 'no_ledger';
    if (ledgerStock != null) status = Math.abs(difference) < 0.001 ? 'ok' : 'mismatch';
    if (status === 'mismatch') mismatchCount += 1;
    rows.push({ productId: p._id, name: p.name, systemStock, ledgerStock, difference, status });
  }
  return { rows, summary: { total: rows.length, mismatchCount } };
}

// ── Fix 14: configurable, section-aware TDS/TCS computation ────────────────────
// Prefers the real stored deduction; otherwise estimates at the configured rate but
// only above the configured threshold. Returns null when nothing should be deducted.
function computeTdsTcs(taxableAmount, storedAmount, opts = {}) {
  const taxable = taxableAmount || 0;
  const stored = Number(storedAmount) || 0;
  const rate = opts.rate || 0;
  const threshold = opts.threshold || 0;
  if (stored > 0) {
    const amount = Math.round(stored * 100) / 100;
    return { amount, estimated: false, pct: taxable ? Math.round((amount / taxable) * 10000) / 100 : null };
  }
  if (taxable <= threshold) return null;
  const amount = Math.round((taxable * rate) / 100 * 100) / 100;
  return { amount, estimated: true, pct: rate };
}

// ── Fix 13: parse a GST portal GSTR-2B/2A JSON into GstRecord-shaped rows ───────
function parsePortalDate(s) {
  if (!s) return null;
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(s)); // portal uses dd-mm-yyyy
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseGSTR2B(json) {
  const root = json || {};
  const b2b = root.b2b || root.docdata?.b2b || root.data?.docdata?.b2b || [];
  const round = (n) => Math.round((n || 0) * 100) / 100;
  const records = [];
  for (const supplier of (b2b || [])) {
    const ctin = supplier.ctin || supplier.gstin || '';
    const partyName = supplier.trdnm || supplier.cpname || supplier.name || '';
    const invoices = supplier.inv || supplier.invoices || [];
    for (const inv of invoices) {
      let taxable = 0, cgst = 0, sgst = 0, igst = 0, cess = 0;
      const items = inv.itms || inv.items || [];
      for (const it of items) {
        const d = it.itm_det || it;
        taxable += d.txval || 0;
        cgst += d.camt || 0;
        sgst += d.samt || 0;
        igst += d.iamt || 0;
        cess += d.csamt || 0;
      }
      const totalTax = cgst + sgst + igst + cess;
      records.push({
        partyGstin: ctin,
        partyName,
        invoiceNumber: inv.inum || '',
        invoiceDate: parsePortalDate(inv.idt),
        invoiceType: '2B',
        taxableValue: round(taxable),
        cgst: round(cgst),
        sgst: round(sgst),
        igst: round(igst),
        cess: round(cess),
        totalTax: round(totalTax),
        totalAmount: inv.val != null ? round(inv.val) : round(taxable + totalTax),
        placeOfSupply: inv.pos || '',
        reverseCharge: inv.rev === 'Y',
      });
    }
  }
  return records;
}

// ── Fix 20: godown-wise stock rows from Product.godownStock[] ──────────────────
// Flattens each product's per-godown distribution into one row per (godown, item),
// valued at the product's unit cost. godownNameById maps a godown id -> display name.
function buildGodownStock(products = [], godownNameById = {}) {
  const rows = [];
  for (const p of products) {
    if (p.type === 'service') continue;
    const unitCost = p.costPrice || p.purchasePrice || p.price || 0;
    for (const gs of (p.godownStock || [])) {
      const gid = gs.godown ? gs.godown.toString() : '';
      const quantity = gs.quantity || 0;
      rows.push({
        godown: godownNameById[gid] || 'Unassigned',
        item: p.name,
        quantity,
        value: Math.round(quantity * unitCost * 100) / 100,
      });
    }
  }
  return rows;
}

// ── Fix 34: single-pass ledger aggregation ─────────────────────────────────────
// Folds every posted journal line into a per-account {debit, credit} map in ONE
// pass (O(entries × lines)). Report builders then look each account up in O(1),
// instead of rescanning all entries for every account (was O(accounts × entries ×
// lines)). Pure transform — identical totals, far less work.
function aggregateLedgerByAccount(entries = []) {
  const map = new Map();
  for (const je of entries) {
    for (const line of (je.lines || [])) {
      const id = line.account ? line.account.toString() : '';
      if (!id) continue;
      const cur = map.get(id) || { debit: 0, credit: 0 };
      cur.debit += line.debit || 0;
      cur.credit += line.credit || 0;
      map.set(id, cur);
    }
  }
  return map;
}

// ── Fix 32: split a single GST amount into CGST/SGST (intra) or IGST (inter) ────
// Penny-safe: cgst + sgst == tax exactly (sgst absorbs any rounding remainder).
function splitGstTotal(tax, isInterState) {
  const t = tax || 0;
  if (isInterState) return { cgstTotal: 0, sgstTotal: 0, igstTotal: Math.round(t * 100) / 100 };
  const cgst = Math.round((t / 2) * 100) / 100;
  const sgst = Math.round((t - cgst) * 100) / 100;
  return { cgstTotal: cgst, sgstTotal: sgst, igstTotal: 0 };
}

module.exports = {
  isB2B,
  docGstSplit,
  itemGstSplit,
  splitGstTotal,
  buildDayBookEntries,
  bankStatementRows,
  bankAccountNeedles,
  transactionMatchesAccount,
  buildProfitLossLineItems,
  stockValueAsOf,
  agingBucket,
  buildHsnSummary,
  reconcileStock,
  computeTdsTcs,
  parseGSTR2B,
  parsePortalDate,
  buildGodownStock,
  aggregateLedgerByAccount,
};
