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

// printReport(title, columns, data)
// - title: report heading
// - columns: [{ key, label, render? }] (same shape used by the exporters)
// - data: array of row objects
// Callers that invoke printReport() with no arguments fall back to printing the
// current page as before, so existing call sites keep working.
export const printReport = (title, columns, data) => {
  if (!title || !Array.isArray(columns) || !Array.isArray(data)) {
    window.print();
    return;
  }

  const headerRow = columns.map((c) => `<th>${escapeHtml(c.label || c.key)}</th>`).join('');
  const bodyRows = data
    .map((row) => {
      const cells = columns.map((col) => `<td>${escapeHtml(cellToText(row, col))}</td>`).join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 24px; }
  h1 { font-size: 18px; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; }
  thead th { background: #f0f0f0; }
  tr:nth-child(even) td { background: #fafafa; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <table>
    <thead><tr>${headerRow}</tr></thead>
    <tbody>${bodyRows}</tbody>
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
