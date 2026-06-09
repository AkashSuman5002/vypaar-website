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

export const printReport = () => {
  window.print();
};
