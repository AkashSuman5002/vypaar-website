// Preload runs in an isolated context. We expose a small, safe desktop API to the web app.
// `printPDF` hands PDF bytes to the main process, which prints them via Electron's native
// printer (reliable for PDFs, unlike iframe printing which the PDF plugin swallows).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isElectron: true,
  printPDF: (bytes) => ipcRenderer.invoke('print-pdf', bytes),
});
