const {
  isB2B,
  docGstSplit,
  itemGstSplit,
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
  splitGstTotal,
} = require('../utils/reportHelpers');

// ── Fix 2: B2B requires a GSTIN ────────────────────────────────────────────────
describe('isB2B', () => {
  test('customer with a GSTIN is B2B', () => {
    expect(isB2B({ name: 'Acme', gstNumber: '27ABCDE1234F1Z5' })).toBe(true);
  });
  test('customer without a GSTIN is B2C', () => {
    expect(isB2B({ name: 'Retail Co' })).toBe(false);
    expect(isB2B({ name: 'Retail Co', gstNumber: '' })).toBe(false);
    expect(isB2B({ name: 'Retail Co', gstNumber: '   ' })).toBe(false);
  });
  test('null / undefined party is B2C', () => {
    expect(isB2B(null)).toBe(false);
    expect(isB2B(undefined)).toBe(false);
  });
});

// ── Fix 1: stored GST splits (no 50/50 re-derivation) ──────────────────────────
describe('docGstSplit / itemGstSplit', () => {
  test('reads stored document totals (inter-state IGST preserved)', () => {
    const sale = { taxableAmount: 1000, cgstTotal: 0, sgstTotal: 0, igstTotal: 180, cessTotal: 0 };
    expect(docGstSplit(sale)).toEqual({ taxable: 1000, cgst: 0, sgst: 0, igst: 180, cess: 0 });
  });
  test('reads stored intra-state split without halving anything itself', () => {
    const sale = { taxableAmount: 1000, cgstTotal: 90, sgstTotal: 90, igstTotal: 0, cessTotal: 0 };
    expect(docGstSplit(sale)).toEqual({ taxable: 1000, cgst: 90, sgst: 90, igst: 0, cess: 0 });
  });
  test('item split falls back to amount for taxable', () => {
    expect(itemGstSplit({ amount: 500, cgst: 45, sgst: 45 }))
      .toEqual({ taxable: 500, cgst: 45, sgst: 45, igst: 0, cess: 0 });
  });
});

// ── Fix 4 + Fix 5: Day Book order, running balance, credit vouchers ────────────
describe('buildDayBookEntries', () => {
  test('running balance accumulates oldest -> newest regardless of input order', () => {
    const cash = [
      { date: '2026-01-03', moneyIn: 0, moneyOut: 200 },
      { date: '2026-01-01', moneyIn: 1000, moneyOut: 0 },
      { date: '2026-01-02', moneyIn: 0, moneyOut: 300 },
    ];
    const entries = buildDayBookEntries(cash, []);
    expect(entries.map((e) => e.balance)).toEqual([1000, 700, 500]);
    // chronological order
    expect(entries.map((e) => e.date)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
  });

  test('credit (unpaid) vouchers appear but never move the cash balance', () => {
    const cash = [{ date: '2026-01-01', moneyIn: 500, moneyOut: 0 }];
    const credit = [{ date: '2026-01-02', voucher: 'INV-9', particular: 'Credit Sale', type: 'credit_sale', dueAmount: 800 }];
    const entries = buildDayBookEntries(cash, credit);
    const creditRow = entries.find((e) => e.type === 'credit_sale');
    expect(creditRow).toBeTruthy();
    expect(creditRow.moneyIn).toBe(0);
    expect(creditRow.moneyOut).toBe(0);
    expect(creditRow.dueAmount).toBe(800);
    // final balance still only reflects the cash row
    expect(entries[entries.length - 1].balance).toBe(500);
  });
});

// ── Fix 8: per-account bank statement running balance ──────────────────────────
describe('bankStatementRows', () => {
  test('runs balance chronologically from the opening balance', () => {
    const txns = [
      { date: '2026-02-02', type: 'bank_out', amount: 400, reference: 'P1' },
      { date: '2026-02-01', type: 'bank_in', amount: 1000, reference: 'R1' },
    ];
    const rows = bankStatementRows(txns, 5000);
    expect(rows.map((r) => r.balance)).toEqual([6000, 5600]);
    expect(rows[0].credit).toBe(1000);
    expect(rows[1].debit).toBe(400);
  });
  test('defaults opening balance to 0', () => {
    const rows = bankStatementRows([{ date: '2026-02-01', type: 'bank_in', amount: 100 }]);
    expect(rows[0].balance).toBe(100);
  });
});

describe('account matching', () => {
  const account = { name: 'HDFC Current', metadata: { bankName: 'HDFC Bank', accountNumber: 'HDFC00123456789' } };
  test('builds lowercase needles from name/bank/number', () => {
    expect(bankAccountNeedles(account)).toEqual(['hdfc current', 'hdfc bank', 'hdfc00123456789']);
  });
  test('matches a transaction whose text mentions the account', () => {
    expect(transactionMatchesAccount({ description: 'Transfer to HDFC Bank' }, bankAccountNeedles(account))).toBe(true);
    expect(transactionMatchesAccount({ description: 'ICICI payment' }, bankAccountNeedles(account))).toBe(false);
  });
  test('empty needles match everything (no account selected)', () => {
    expect(transactionMatchesAccount({ description: 'anything' }, [])).toBe(true);
  });
});

// ── Fix 6 + Fix 7: P&L line items reconcile, children are separated ────────────
describe('buildProfitLossLineItems', () => {
  const figures = {
    totalSales: 100000,
    totalCreditNotes: 2000,
    totalPurchases: 60000,
    totalDebitNotes: 1000,
    directExpenses: 5000,
    indirectExpenses: 8000,
    directItems: [{ name: 'Freight Inward', amount: 5000 }],
    indirectItems: [{ name: 'Office Rent', amount: 8000 }],
    totalGST: 18000,
    purchaseGST: 10800,
    openingStock: 0,
    closingStock: 15000,
  };

  test('Gross Profit equals the sum of the components above it', () => {
    const { lineItems, grossProfit } = buildProfitLossLineItems(figures);
    // sale - creditNote - purchase + debitNote - directExp - taxPayable + taxRecv - opening + closing
    const expected = 100000 - 2000 - 60000 + 1000 - 5000 - 18000 + 10800 - 0 + 15000;
    expect(grossProfit).toBe(expected); // 41800
    const gpRow = lineItems.find((l) => l.label === 'Gross Profit');
    expect(gpRow.amount).toBe(expected);
  });

  test('Net Profit = Gross Profit + Other Income - Indirect Expenses', () => {
    const { grossProfit, netProfit } = buildProfitLossLineItems(figures);
    expect(netProfit).toBe(grossProfit - 8000);
  });

  test('Direct and Indirect sections each carry only their own children', () => {
    const { lineItems } = buildProfitLossLineItems(figures);
    const direct = lineItems.find((l) => l.label === 'Direct Expenses(-)');
    const indirect = lineItems.find((l) => l.label === 'Indirect Expenses(-)');
    expect(direct.children).toEqual([{ name: 'Freight Inward', amount: 5000 }]);
    expect(indirect.children).toEqual([{ name: 'Office Rent', amount: 8000 }]);
  });

  test('reconciliation holds: summing signed rows up to Gross Profit equals Gross Profit', () => {
    const { lineItems, grossProfit } = buildProfitLossLineItems(figures);
    const signFor = (label) => {
      if (label.includes('(+)')) return 1;
      if (label.includes('(-)')) return -1;
      return 0;
    };
    const gpIndex = lineItems.findIndex((l) => l.label === 'Gross Profit');
    const sum = lineItems
      .slice(0, gpIndex)
      .reduce((s, l) => s + signFor(l.label) * (l.amount || 0), 0);
    expect(Math.round(sum)).toBe(Math.round(grossProfit));
  });
});

// ── Fix 9: opening/closing stock value as of a date ────────────────────────────
describe('stockValueAsOf', () => {
  const products = [
    { _id: 'p1', stock: 10, costPrice: 100, type: 'product' },
    { _id: 'p2', stock: 5, costPrice: 200, type: 'product' },
    { _id: 'svc', stock: 0, costPrice: 0, type: 'service' },
  ];

  test('empty movement map => current inventory value', () => {
    expect(stockValueAsOf(products, {})).toBe(10 * 100 + 5 * 200); // 2000
  });

  test('reverses net movements after the cut-off (e.g. a later +4 purchase of p1)', () => {
    // If 4 units of p1 moved IN after the cut-off, stock at the cut-off was 10 - 4 = 6.
    expect(stockValueAsOf(products, { p1: 4 })).toBe(6 * 100 + 5 * 200); // 1600
  });

  test('handles outward (negative) later movements', () => {
    // p2 sold 3 units (-3) after the cut-off => stock then was 5 - (-3) = 8.
    expect(stockValueAsOf(products, { p2: -3 })).toBe(10 * 100 + 8 * 200); // 2600
  });

  test('services are excluded from valuation', () => {
    expect(stockValueAsOf([{ _id: 'svc', stock: 99, costPrice: 50, type: 'service' }], {})).toBe(0);
  });
});

// ── Fix 16: aging buckets ──────────────────────────────────────────────────────
describe('agingBucket', () => {
  test('buckets by days overdue', () => {
    expect(agingBucket(0)).toBe('0-30');
    expect(agingBucket(30)).toBe('0-30');
    expect(agingBucket(31)).toBe('31-60');
    expect(agingBucket(60)).toBe('31-60');
    expect(agingBucket(90)).toBe('61-90');
    expect(agingBucket(91)).toBe('90+');
    expect(agingBucket(400)).toBe('90+');
  });
});

// ── Fix 15: HSN summary grouped by HSN + rate + UQC ────────────────────────────
describe('buildHsnSummary', () => {
  test('groups by hsn + rate + unit and sums stored tax', () => {
    const sales = [
      { items: [
        { hsn: '1001', gstRate: 18, unit: 'Kg', quantity: 2, taxableAmount: 1000, cgst: 90, sgst: 90, igst: 0 },
        { hsn: '1001', gstRate: 18, unit: 'Kg', quantity: 3, taxableAmount: 1500, cgst: 135, sgst: 135, igst: 0 },
      ] },
      { items: [
        { hsn: '1001', gstRate: 5, unit: 'Kg', quantity: 1, taxableAmount: 500, cgst: 0, sgst: 0, igst: 25 },
      ] },
    ];
    const summary = buildHsnSummary(sales);
    // two groups: 1001/18/Kg and 1001/5/Kg (different rate => separate rows)
    expect(summary).toHaveLength(2);
    const r18 = summary.find((r) => r.rate === 18);
    expect(r18).toMatchObject({ hsn: '1001', rate: 18, uqc: 'Kg', quantity: 5, taxableAmount: 2500, cgst: 225, sgst: 225, igst: 0, gstAmount: 450 });
    const r5 = summary.find((r) => r.rate === 5);
    expect(r5).toMatchObject({ hsn: '1001', rate: 5, quantity: 1, taxableAmount: 500, igst: 25, gstAmount: 25 });
  });

  test('defaults missing hsn/unit', () => {
    const [row] = buildHsnSummary([{ items: [{ quantity: 1, amount: 100 }] }]);
    expect(row.hsn).toBe('GENERAL');
    expect(row.uqc).toBe('NOS');
  });
});

// ── Fix 17: stock reconciliation ───────────────────────────────────────────────
describe('reconcileStock', () => {
  const products = [
    { _id: 'p1', name: 'A', stock: 10, type: 'product' },
    { _id: 'p2', name: 'B', stock: 7, type: 'product' },
    { _id: 'p3', name: 'C', stock: 3, type: 'product' },
    { _id: 'svc', name: 'Svc', stock: 0, type: 'service' },
  ];

  test('flags drift between Product.stock and the ledger', () => {
    const { rows, summary } = reconcileStock(products, { p1: 10, p2: 5, /* p3 has no ledger */ });
    const byId = Object.fromEntries(rows.map((r) => [r.productId, r]));
    expect(byId.p1.status).toBe('ok');
    expect(byId.p2).toMatchObject({ status: 'mismatch', difference: 2 }); // 7 vs 5
    expect(byId.p3.status).toBe('no_ledger');
    expect(summary).toEqual({ total: 3, mismatchCount: 1 }); // services excluded
  });
});

// ── Fix 14: TDS/TCS computation ────────────────────────────────────────────────
describe('computeTdsTcs', () => {
  test('prefers the stored amount (not estimated)', () => {
    expect(computeTdsTcs(100000, 1000, { rate: 10, threshold: 30000 }))
      .toEqual({ amount: 1000, estimated: false, pct: 1 });
  });
  test('estimates at the configured rate above threshold', () => {
    expect(computeTdsTcs(100000, 0, { rate: 10, threshold: 30000 }))
      .toEqual({ amount: 10000, estimated: true, pct: 10 });
  });
  test('returns null at/below threshold with no stored amount', () => {
    expect(computeTdsTcs(30000, 0, { rate: 10, threshold: 30000 })).toBeNull();
    expect(computeTdsTcs(25000, 0, { rate: 10, threshold: 30000 })).toBeNull();
  });
  test('honours a custom (configured) rate/threshold', () => {
    expect(computeTdsTcs(60000, 0, { rate: 2, threshold: 50000 }))
      .toEqual({ amount: 1200, estimated: true, pct: 2 });
  });
});

// ── Fix 13: GSTR-2B portal JSON parsing ────────────────────────────────────────
describe('parsePortalDate', () => {
  test('parses dd-mm-yyyy', () => {
    const d = parsePortalDate('05-04-2026');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3); // April
    expect(d.getDate()).toBe(5);
  });
  test('returns null for empty/invalid', () => {
    expect(parsePortalDate('')).toBeNull();
    expect(parsePortalDate('not-a-date')).toBeNull();
  });
});

describe('parseGSTR2B', () => {
  const portal = {
    b2b: [
      {
        ctin: '27ABCDE1234F1Z5',
        trdnm: 'Supplier One',
        inv: [
          {
            inum: 'B-101', idt: '10-04-2026', val: 11800, pos: '27', rev: 'N',
            itms: [{ itm_det: { txval: 10000, camt: 900, samt: 900, iamt: 0, csamt: 0 } }],
          },
        ],
      },
    ],
  };

  test('maps portal b2b invoices to GstRecord-shaped rows', () => {
    const [row] = parseGSTR2B(portal);
    expect(row).toMatchObject({
      partyGstin: '27ABCDE1234F1Z5',
      partyName: 'Supplier One',
      invoiceNumber: 'B-101',
      taxableValue: 10000,
      cgst: 900,
      sgst: 900,
      igst: 0,
      totalTax: 1800,
      totalAmount: 11800,
      placeOfSupply: '27',
      reverseCharge: false,
      invoiceType: '2B',
    });
    expect(row.invoiceDate.getFullYear()).toBe(2026);
  });

  test('reads docdata.b2b root and computes total when val absent', () => {
    const nested = { docdata: { b2b: [{ ctin: 'X', inv: [{ inum: 'I1', itms: [{ itm_det: { txval: 100, iamt: 18 } }] }] }] } };
    const [row] = parseGSTR2B(nested);
    expect(row.igst).toBe(18);
    expect(row.totalAmount).toBe(118);
  });

  test('returns [] when no b2b data', () => {
    expect(parseGSTR2B({})).toEqual([]);
    expect(parseGSTR2B(null)).toEqual([]);
  });
});

// ── Fix 20: godown-wise stock ──────────────────────────────────────────────────
describe('buildGodownStock', () => {
  const products = [
    {
      _id: 'p1', name: 'Widget', costPrice: 50, type: 'product',
      godownStock: [{ godown: 'g1', quantity: 4 }, { godown: 'g2', quantity: 6 }],
    },
    { _id: 'p2', name: 'Gadget', costPrice: 100, type: 'product', godownStock: [{ godown: 'g1', quantity: 2 }] },
    { _id: 'svc', name: 'Install', costPrice: 0, type: 'service', godownStock: [{ godown: 'g1', quantity: 99 }] },
  ];
  const names = { g1: 'Main Store', g2: 'Warehouse B' };

  test('flattens per-godown distribution and values each row at unit cost', () => {
    const rows = buildGodownStock(products, names);
    expect(rows).toHaveLength(3); // service excluded
    expect(rows).toContainEqual({ godown: 'Main Store', item: 'Widget', quantity: 4, value: 200 });
    expect(rows).toContainEqual({ godown: 'Warehouse B', item: 'Widget', quantity: 6, value: 300 });
    expect(rows).toContainEqual({ godown: 'Main Store', item: 'Gadget', quantity: 2, value: 200 });
  });

  test('falls back to "Unassigned" for unknown godown ids', () => {
    const rows = buildGodownStock([{ _id: 'p', name: 'X', costPrice: 10, type: 'product', godownStock: [{ godown: 'gX', quantity: 3 }] }], {});
    expect(rows[0].godown).toBe('Unassigned');
  });
});

// ── Fix 34: single-pass ledger aggregation ─────────────────────────────────────
describe('aggregateLedgerByAccount', () => {
  test('folds all journal lines into per-account debit/credit totals in one pass', () => {
    const entries = [
      { lines: [{ account: 'a1', debit: 100, credit: 0 }, { account: 'a2', debit: 0, credit: 100 }] },
      { lines: [{ account: 'a1', debit: 50, credit: 0 }, { account: 'a2', debit: 0, credit: 50 }] },
    ];
    const m = aggregateLedgerByAccount(entries);
    expect(m.get('a1')).toEqual({ debit: 150, credit: 0 });
    expect(m.get('a2')).toEqual({ debit: 0, credit: 150 });
  });
  test('matches the old per-account scan result', () => {
    const entries = [{ lines: [{ account: 'x', debit: 30, credit: 0 }, { account: 'x', debit: 0, credit: 12 }] }];
    // old logic: scan every line for the account
    let d = 0, c = 0;
    entries.forEach((je) => je.lines.forEach((l) => { if (l.account === 'x') { d += l.debit; c += l.credit; } }));
    const t = aggregateLedgerByAccount(entries).get('x');
    expect(t).toEqual({ debit: d, credit: c });
  });
  test('handles empty input', () => {
    expect(aggregateLedgerByAccount([]).size).toBe(0);
  });
});

// ── Fix 32: expense GST split ──────────────────────────────────────────────────
describe('splitGstTotal', () => {
  test('intra-state splits into equal CGST/SGST that sum back to tax', () => {
    const r = splitGstTotal(180, false);
    expect(r).toEqual({ cgstTotal: 90, sgstTotal: 90, igstTotal: 0 });
    expect(r.cgstTotal + r.sgstTotal).toBe(180);
  });
  test('penny-safe: cgst + sgst == tax even when odd', () => {
    const r = splitGstTotal(15.01, false);
    expect(r.cgstTotal + r.sgstTotal).toBeCloseTo(15.01, 2);
    expect(r.igstTotal).toBe(0);
  });
  test('inter-state puts everything in IGST', () => {
    expect(splitGstTotal(180, true)).toEqual({ cgstTotal: 0, sgstTotal: 0, igstTotal: 180 });
  });
  test('zero tax yields zeros', () => {
    expect(splitGstTotal(0, false)).toEqual({ cgstTotal: 0, sgstTotal: 0, igstTotal: 0 });
  });
});
