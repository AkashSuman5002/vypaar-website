const { Writable } = require('stream');

/**
 * Run an existing Express PDF handler (one that does `res.setHeader(...)` then
 * `doc.pipe(res)` / `doc.end()`) and capture its output as a Buffer instead of
 * streaming it to a real HTTP response. This lets us reuse the exact same PDF
 * generation for WhatsApp/email attachments without duplicating the layout code.
 *
 * @param {(req:any, res:any)=>any} handler  e.g. pdfController.generateInvoicePDF
 * @param {object} pdfReq  a minimal req: { user, businessId, params:{id}, query:{} }
 * @returns {Promise<Buffer>}
 */
function renderPdfToBuffer(handler, pdfReq) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let settled = false;
    const done = (fn, val) => { if (!settled) { settled = true; fn(val); } };

    const res = new Writable({
      write(chunk, enc, cb) { chunks.push(Buffer.from(chunk)); cb(); },
    });
    // The PDF handlers call these on the response object — make them harmless here.
    res.setHeader = () => res;
    res.status = () => res;
    res.json = (obj) => done(reject, new Error(obj && obj.message ? obj.message : 'PDF generation failed'));

    res.on('finish', () => done(resolve, Buffer.concat(chunks)));
    res.on('error', (err) => done(reject, err));

    Promise.resolve(handler(pdfReq, res)).catch((err) => done(reject, err));
  });
}

module.exports = { renderPdfToBuffer };
