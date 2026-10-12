/**
 * Signature-page logic.
 * The page itself is rendered from HTML (so any script/language works), then
 * appended to the charter with pdf-lib (pdf-lib.min.gs, global `PDFLib`).
 * pdf-lib is promise based; Apps Script's V8 runtime drains the microtask
 * queue before the execution ends, so async functions complete even though
 * their result can't be returned to the caller. Callers therefore write their
 * outcome to the Sheet instead of returning it.
 * If pdf-lib fails, the original charter and the certificate are attached separately.
 */

function escapeHtml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function certificateBlob_(name, city, dateStr) {
  var html =
    '<html><head><meta charset="utf-8"></head>' +
    '<body style="font-family:Arial,sans-serif;text-align:center;padding:90px 50px;">' +
    '<h1 style="font-size:30px;margin-bottom:6px;">The Federal Charter</h1>' +
    '<h2 style="font-weight:normal;color:#555;margin-top:0;">Signature page</h2>' +
    '<hr style="margin:40px 0;">' +
    '<p style="font-size:16px;">Signed by</p>' +
    '<p style="font-size:30px;font-weight:bold;margin:8px 0;">' + escapeHtml_(name) + '</p>' +
    '<p style="font-size:20px;margin:8px 0;">' + escapeHtml_(city) + '</p>' +
    '<p style="font-size:16px;color:#555;margin-top:30px;">' + escapeHtml_(dateStr) + '</p>' +
    '<hr style="margin:40px 0;">' +
    '<p style="font-size:12px;color:#777;">Signed electronically via ' + escapeHtml_(CONFIG.SITE_URL) + '</p>' +
    '</body></html>';
  return Utilities.newBlob(html, 'text/html', 'signature.html')
    .getAs('application/pdf').setName('Signature page.pdf');
}

function charterBytes_() {
  var resp = UrlFetchApp.fetch(CONFIG.CHARTER_URL, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) throw new Error('Could not fetch charter: HTTP ' + resp.getResponseCode());
  return resp.getContent();
}

/** Appends the signature page to the charter. Returns a Blob. */
async function stampCharter_(charterBytes, certBlob) {
  var doc = await PDFLib.PDFDocument.load(charterBytes);
  var sig = await PDFLib.PDFDocument.load(certBlob.getBytes());
  var pages = await doc.copyPages(sig, sig.getPageIndices());
  pages.forEach(function (p) { doc.addPage(p); });
  var bytes = await doc.save();
  return Utilities.newBlob(Array.from(bytes), 'application/pdf', 'Federal Charter - signed.pdf');
}

/** Returns an array of blobs to attach (stamped charter, or charter + certificate as fallback). */
async function buildAttachments_(name, city, dateStr) {
  var cert = certificateBlob_(name, city, dateStr);
  var charter = charterBytes_();
  try {
    return [await stampCharter_(charter, cert)];
  } catch (err) {
    console.error('pdf-lib failed, using fallback: ' + err);
    return [Utilities.newBlob(charter, 'application/pdf', 'Federal Charter.pdf'), cert];
  }
}

/** Run from the editor to verify pdf-lib stamping works; check the logs and your Drive. */
async function testStamp() {
  var atts = await buildAttachments_('Test Signer', 'Haifa, Israel', 'today');
  console.log('attachments: ' + atts.map(function (a) { return a.getName() + ' ' + a.getBytes().length; }).join(', '));
  DriveApp.createFile(atts[0]);
}
