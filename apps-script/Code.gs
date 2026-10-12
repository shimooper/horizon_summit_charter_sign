/**
 * Federal Charter signing backend (Google Apps Script web app).
 * Bind this project to the signers Google Sheet (Extensions > Apps Script),
 * deploy as a web app: Execute as "Me", access "Anyone".
 */

var CONFIG = {
  // Public URL of the charter PDF on GitHub Pages (spaces encoded as %20).
  CHARTER_URL: 'https://<github-username>.github.io/<repo>/assets/Federal%20Charter%20Eng.pdf',
  SITE_URL: 'https://<github-username>.github.io/<repo>/',
  SHEET_NAME: 'Signers',
  MIN_SUBMIT_MS: 2000,
  MAX_SIGNS_PER_MINUTE: 30,
  MAP_CACHE_SECONDS: 30,
  MAIL_SENDER_NAME: 'Federal Charter'
};

var HEADERS = ['timestamp', 'name', 'email', 'city', 'country', 'lat', 'lng', 'emailStatus'];
var COL = { TIMESTAMP: 1, NAME: 2, EMAIL: 3, CITY: 4, COUNTRY: 5, LAT: 6, LNG: 7, STATUS: 8 };

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
}

// ---- Public map data ------------------------------------------------------

function doGet() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('map');
  if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);

  var sh = sheet_();
  var n = sh.getLastRow() - 1;
  var byCity = {};
  if (n > 0) {
    var rows = sh.getRange(2, 1, n, HEADERS.length).getValues();
    rows.forEach(function (r) {
      var lat = Number(r[COL.LAT - 1]), lng = Number(r[COL.LNG - 1]);
      if (!isFinite(lat) || !isFinite(lng)) return;
      var key = r[COL.CITY - 1] + '|' + lat.toFixed(2) + '|' + lng.toFixed(2);
      if (!byCity[key]) byCity[key] = { city: r[COL.CITY - 1], lat: lat, lng: lng, count: 0 };
      byCity[key].count++;
    });
  }
  var out = JSON.stringify(Object.keys(byCity).map(function (k) { return byCity[k]; }));
  cache.put('map', out, CONFIG.MAP_CACHE_SECONDS);
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}

// ---- Signing ----------------------------------------------------------------

function clean_(s, max) {
  return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function validate_(d) {
  var v = {
    name: clean_(d.name, 100),
    email: clean_(d.email, 200).toLowerCase(),
    city: clean_(d.city, 200),
    country: clean_(d.country, 100),
    lat: Number(d.lat),
    lng: Number(d.lng)
  };
  if (v.name.length < 2) return { error: 'Please enter your full name.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return { error: 'Please enter a valid email address.' };
  if (!v.city) return { error: 'Please pick your city from the suggestions.' };
  if (!isFinite(v.lat) || !isFinite(v.lng) || Math.abs(v.lat) > 90 || Math.abs(v.lng) > 180) {
    return { error: 'Invalid city location.' };
  }
  return { value: v };
}

function rateLimited_() {
  var cache = CacheService.getScriptCache();
  var key = 'rate:' + Math.floor(Date.now() / 60000);
  var n = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(n), 120);
  return n > CONFIG.MAX_SIGNS_PER_MINUTE;
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var data;
    try { data = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'Bad request.' }); }

    // Honeypot / too-fast submissions: pretend success, do nothing.
    if (data.website || Number(data.elapsed) < CONFIG.MIN_SUBMIT_MS) return json_({ ok: true });

    var res = validate_(data);
    if (res.error) return json_({ ok: false, error: res.error });
    var v = res.value;

    if (rateLimited_()) return json_({ ok: false, error: 'Too many signatures right now.' });

    lock.waitLock(20000);
    var sh = sheet_();
    var n = sh.getLastRow() - 1;
    var rowIdx = -1;
    if (n > 0) {
      var emails = sh.getRange(2, COL.EMAIL, n, 1).getValues();
      for (var i = 0; i < emails.length; i++) {
        if (String(emails[i][0]).toLowerCase() === v.email) { rowIdx = i + 2; break; }
      }
    }

    var signer = v;
    if (rowIdx === -1) {
      sh.appendRow([new Date(), v.name, v.email, v.city, v.country, v.lat, v.lng, 'pending']);
      rowIdx = sh.getLastRow();
      CacheService.getScriptCache().remove('map');
    } else {
      // Repeat signer: re-send using the details already on file; no new row.
      var r = sh.getRange(rowIdx, 1, 1, HEADERS.length).getValues()[0];
      signer = { name: r[COL.NAME - 1], email: v.email, city: r[COL.CITY - 1] };
    }
    SpreadsheetApp.flush();
    lock.releaseLock();

    // PDF stamping is async (pdf-lib); it records sent/failed in the Sheet when done.
    // A row left as "pending" or "failed" can be retried with retryFailed().
    sendAndRecord_(signer, rowIdx);
    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'Server error.' });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

async function sendAndRecord_(signer, rowIdx) {
  var status = 'sent';
  try {
    await sendSigned_(signer);
  } catch (err) {
    console.error(err);
    status = 'failed';
  }
  sheet_().getRange(rowIdx, COL.STATUS).setValue(status);
}

async function sendSigned_(signer) {
  var dateStr = Utilities.formatDate(new Date(), 'UTC', 'd MMMM yyyy');
  var attachments = await buildAttachments_(signer.name, signer.city, dateStr);
  var subject = 'Your signed Federal Charter';
  var body = 'Dear ' + signer.name + ',\n\n' +
    'Thank you for signing the Federal Charter. Your signed copy is attached.\n\n' +
    'See everyone who has signed: ' + CONFIG.SITE_URL + 'map.html\n';
  MailApp.sendEmail({
    to: signer.email,
    subject: subject,
    body: body,
    name: CONFIG.MAIL_SENDER_NAME,
    attachments: attachments
  });
}

/** Retry all rows whose emailStatus is not "sent". Run manually from the editor. */
async function retryFailed() {
  var sh = sheet_();
  var n = sh.getLastRow() - 1;
  if (n < 1) return;
  var rows = sh.getRange(2, 1, n, HEADERS.length).getValues();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r[COL.STATUS - 1] === 'sent') continue;
    await sendAndRecord_({ name: r[COL.NAME - 1], email: r[COL.EMAIL - 1], city: r[COL.CITY - 1] }, i + 2);
  }
}
