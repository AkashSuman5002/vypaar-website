import * as XLSX from 'xlsx';

export const exportToExcel = (data, columns, filename = 'report') => {
  if (!data || data.length === 0) return;

  const headers = columns.map((c) => c.label || c.key);
  const rows = data.map((row) =>
    columns.map((col) => {
      const val = row[col.key];
      if (col.render) {
        const result = col.render(val, row);
        if (result == null) return '';
        if (typeof result === 'string') return result.replace(/<[^>]*>/g, '').replace(/₹/g, '').trim();
        if (typeof result === 'number') return result;
        if (result.props && result.props.children != null) return String(result.props.children);
        return String(result);
      }
      return val ?? '';
    })
  );

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

  const colWidths = columns.map((c) => ({ wch: Math.max((c.label || c.key).length * 2, 12) }));
  ws['!cols'] = colWidths;

  XLSX.writeFile(wb, `${filename.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
};

export const exportToCSV = (data, columns, filename = 'report') => {
  if (!data || data.length === 0) return;

  const headers = columns.map((c) => c.label || c.key);
  const rows = data.map((row) =>
    columns.map((col) => {
      const val = row[col.key];
      if (col.render) {
        const result = col.render(val, row);
        if (result == null) return '';
        if (typeof result === 'string') return result.replace(/<[^>]*>/g, '').replace(/₹/g, '').trim();
        if (typeof result === 'number') return result;
        if (result.props && result.props.children != null) return String(result.props.children);
        return String(result);
      }
      return val ?? '';
    })
  );

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

// Resolve a cell value the same way the Excel/CSV exporters do, stripping any
// HTML/markup so the printed table shows clean text.
const cellToText = (row, col) => {
  const val = row[col.key];
  if (col.render) {
    const result = col.render(val, row);
    if (result == null) return '';
    if (typeof result === 'string') return result.replace(/<[^>]*>/g, '').trim();
    if (typeof result === 'number') return String(result);
    if (result.props && result.props.children != null) return String(result.props.children);
    return String(result);
  }
  return val == null ? '' : String(val);
};

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Resolve the business name for the print/PDF header (passed in, else cached locally).
const resolveBusinessName = (meta) => {
  if (meta && meta.businessName) return meta.businessName;
  try {
    const raw = window.localStorage.getItem('businessName')
      || window.localStorage.getItem('settings');
    if (!raw) return '';
    if (raw[0] === '{') { const s = JSON.parse(raw); return s.businessName || s.name || ''; }
    return raw;
  } catch (e) { return ''; }
};

// printReport(title, columns, data, meta?)
// - title: report heading
// - columns: [{ key, label, align?, render? }] (same shape used by the exporters)
// - data: array of row objects
// - meta: optional { businessName, gstin, period } for the document header
// Produces a clean, print/PDF-ready document with a branded header, generated-on
// timestamp and an automatic totals row for numeric columns. Callers that invoke
// printReport() with no arguments still fall back to printing the current page.
export const printReport = (title, columns, data, meta = {}) => {
  if (!title || !Array.isArray(columns) || !Array.isArray(data)) {
    window.print();
    return;
  }

  const isRightAligned = (c) => c.align === 'right';
  const headerRow = columns
    .map((c) => `<th${isRightAligned(c) ? ' class="num"' : ''}>${escapeHtml(c.label || c.key)}</th>`)
    .join('');
  const bodyRows = data
    .map((row) => {
      const cells = columns
        .map((col) => `<td${isRightAligned(col) ? ' class="num"' : ''}>${escapeHtml(cellToText(row, col))}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  // Totals row: sum any right-aligned column whose raw values are numeric.
  const numericTotals = columns.map((col) => {
    if (!isRightAligned(col)) return null;
    let sum = 0;
    let any = false;
    for (const row of data) {
      const v = row[col.key];
      if (typeof v === 'number' && Number.isFinite(v)) { sum += v; any = true; }
    }
    return any ? sum : null;
  });
  const hasTotals = numericTotals.some((t) => t !== null);
  const totalsRow = hasTotals
    ? `<tr class="totals">${columns
        .map((col, i) => {
          if (i === 0) return '<td><strong>Total</strong></td>';
          const t = numericTotals[i];
          return `<td class="num">${t === null ? '' : `<strong>${t.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>`}</td>`;
        })
        .join('')}</tr>`
    : '';

  const businessName = resolveBusinessName(meta);
  const generatedOn = new Date().toLocaleString('en-IN');
  const subParts = [];
  if (meta.gstin) subParts.push(`GSTIN: ${escapeHtml(meta.gstin)}`);
  if (meta.period) subParts.push(`Period: ${escapeHtml(meta.period)}`);
  subParts.push(`Generated: ${escapeHtml(generatedOn)}`);

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 24px; }
  .doc-head { border-bottom: 2px solid #1e293b; padding-bottom: 10px; margin-bottom: 16px; }
  .biz { font-size: 18px; font-weight: 700; color: #1e293b; }
  h1 { font-size: 15px; font-weight: 600; margin: 4px 0 2px; }
  .sub { font-size: 11px; color: #555; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; }
  th.num, td.num { text-align: right; }
  thead th { background: #1e293b; color: #fff; }
  tbody tr:nth-child(even) td { background: #f5f7fa; }
  tr.totals td { background: #eef2f7; border-top: 2px solid #1e293b; }
  @media print { body { margin: 0; } thead { display: table-header-group; } }
</style>
</head>
<body>
  <div class="doc-head">
    ${businessName ? `<div class="biz">${escapeHtml(businessName)}</div>` : ''}
    <h1>${escapeHtml(title)}</h1>
    <div class="sub">${subParts.join(' &nbsp;•&nbsp; ')}</div>
  </div>
  <table>
    <thead><tr>${headerRow}</tr></thead>
    <tbody>${bodyRows}${totalsRow}</tbody>
  </table>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    // Pop-up blocked — fall back to printing the current page.
    window.print();
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  // Give the new document a tick to render before invoking print.
  win.onload = () => {
    win.print();
  };
  // Fallback in case onload doesn't fire (document already loaded).
  setTimeout(() => {
    try { win.print(); } catch (e) { /* window may already be closed */ }
  }, 300);
};
