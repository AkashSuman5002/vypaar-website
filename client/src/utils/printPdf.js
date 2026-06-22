// Print a PDF (Blob or ArrayBuffer).
//  - In the Electron desktop app, route through the native printer via the preload bridge
//    (reliable for PDFs; iframe printing is swallowed by Electron's PDF plugin).
//  - In a normal browser, fall back to the classic hidden-iframe print.
export async function printPdf(data) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/pdf' });

  if (typeof window !== 'undefined' && window.desktop && window.desktop.printPDF) {
    const buf = await blob.arrayBuffer();
    try { await window.desktop.printPDF(new Uint8Array(buf)); } catch (_) { /* ignore */ }
    return;
  }

  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  iframe.src = url;
  iframe.onload = () => {
    try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (_) { /* ignore */ }
  };
  document.body.appendChild(iframe);
  setTimeout(() => { URL.revokeObjectURL(url); iframe.remove(); }, 60000);
}
