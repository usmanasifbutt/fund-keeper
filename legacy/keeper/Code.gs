/**
 * Keeper: daily profit/loss for Pakistani mutual funds, priced from MUFAP's public NAV table.
 * Bound to a Google Sheet. Setup steps are in SETUP.md.
 */

const MUFAP_URL = 'https://www.mufap.com.pk/Industry/IndustryStatDaily?tab=3';
const TZ = 'Asia/Karachi';
const EVENING_HOUR = 21; // 9 pm PKT
const MORNING_HOUR = 9;  // 9 am PKT retry

const SHEETS = {
  funds:    { name: 'Funds',    header: ['FundID', 'Fund', 'AMC', 'Category', 'Sector', 'Offer', 'Repurchase', 'NAV', 'Validity Date', 'Refreshed At'], textCols: [1, 9] },
  holdings: { name: 'Holdings', header: ['FundID', 'Fund', 'AMC', 'Units', 'Invested (Rs)', 'Updated At'], textCols: [1] },
  history:  { name: 'History',  header: ['Saved At', 'FundID', 'Fund', 'Change', 'Units Before', 'Units After', 'Invested Before', 'Invested After'], textCols: [2] },
  navs:     { name: 'NAVs',     header: ['Validity Date', 'FundID', 'Fund', 'NAV', 'Repurchase', 'Recorded At'], textCols: [1, 2] },
  daily:    { name: 'Daily',    header: ['NAV Date', 'Value (Rs)', 'Invested (Rs)', 'Day Change (Rs)', 'Total P/L (Rs)'], textCols: [1] },
  settings: { name: 'Settings', header: ['Setting', 'Value', 'Notes'], textCols: [2] },
};

const DEFAULT_SETTINGS = [
  ['EMAIL_TO', '', 'Where the daily email goes. Leave blank to use your Google account email.'],
  ['WHATSAPP_PHONE', '', 'Your WhatsApp number with country code, e.g. +923001234567. Leave blank for no WhatsApp.'],
  ['CALLMEBOT_APIKEY', '', 'The API key CallMeBot sent you on WhatsApp.'],
  ['DROP_ALERT_PCT', '2', 'Flag a fund that falls by this many percent or more in one day.'],
];

// ---------- Menu and setup ----------

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Keeper')
    .addItem('1. Set up sheets', 'setup')
    .addItem('2. Turn on daily reports', 'installTriggers')
    .addSeparator()
    .addItem('Open holdings form', 'showFormLink')
    .addItem('Refresh fund list from MUFAP', 'refreshFundsMenu')
    .addItem('Send report now', 'sendReportNowMenu')
    .addItem('Turn off daily reports', 'removeTriggers')
    .addToUi();
}

function setup() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', book.getId());
  book.setSpreadsheetTimeZone(TZ);
  Object.keys(SHEETS).forEach(sheet_);
  const settings = sheet_('settings');
  if (settings.getLastRow() < 2) {
    settings.getRange(2, 1, DEFAULT_SETTINGS.length, 3).setValues(DEFAULT_SETTINGS);
    settings.autoResizeColumns(1, 3);
  }
  const blank = book.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0) book.deleteSheet(blank);
  const count = refreshFunds_().length;
  SpreadsheetApp.getUi().alert(`Set up done. Loaded ${count} funds from MUFAP.\n\nNext: fill in the Settings sheet, then deploy the web app (SETUP.md step 5).`);
}

function installTriggers() {
  removeTriggers_();
  ScriptApp.newTrigger('eveningRun').timeBased().everyDays(1).atHour(EVENING_HOUR).nearMinute(0).inTimezone(TZ).create();
  ScriptApp.newTrigger('morningRun').timeBased().everyDays(1).atHour(MORNING_HOUR).nearMinute(0).inTimezone(TZ).create();
  SpreadsheetApp.getUi().alert(`Daily reports are on: around ${EVENING_HOUR}:00, with a ${MORNING_HOUR}:00 retry if MUFAP was late.`);
}

function removeTriggers() {
  removeTriggers_();
  SpreadsheetApp.getUi().alert('Daily reports are off.');
}

function removeTriggers_() {
  ScriptApp.getProjectTriggers()
    .filter(t => ['eveningRun', 'morningRun'].includes(t.getHandlerFunction()))
    .forEach(t => ScriptApp.deleteTrigger(t));
}

function showFormLink() {
  const url = ScriptApp.getService().getUrl();
  const ui = SpreadsheetApp.getUi();
  if (!url) { ui.alert('The form is not deployed yet. Follow SETUP.md step 5 (Deploy → New deployment → Web app).'); return; }
  const html = HtmlService.createHtmlOutput(
    `<p style="font:14px sans-serif">Open your holdings form:<br><a href="${url}" target="_blank">${url}</a></p>` +
    '<p style="font:13px sans-serif;color:#555">Bookmark it on your phone. Only your Google account can open it.</p>'
  ).setWidth(460).setHeight(150);
  ui.showModalDialog(html, 'Holdings form');
}

function refreshFundsMenu() {
  const count = refreshFunds_().length;
  SpreadsheetApp.getUi().alert(`Loaded ${count} funds from MUFAP.`);
}

function sendReportNowMenu() {
  SpreadsheetApp.getUi().alert(sendReportNow());
}

// ---------- Web app (holdings form) ----------

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Form')
    .setTitle('Keeper · Holdings')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Called by the form on load. */
function getFormData() {
  let funds = readFunds_();
  if (!funds.length) funds = refreshFunds_();
  const refreshed = sheet_('funds').getRange(2, 10).getValue();
  return {
    funds: funds.map(f => [f.id, f.name, f.amc, f.category, f.nav, f.repurchase, f.date]),
    holdings: readHoldings_().map(h => ({ fundId: h.id, units: h.units, invested: h.invested })),
    refreshedAt: refreshed instanceof Date ? Utilities.formatDate(refreshed, TZ, 'd MMM, h:mm a') : String(refreshed || ''),
  };
}

/** Called by the form's Save button. rows: [{fundId, units, invested}] */
function saveHoldings(rows) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const funds = fundMap_();
    const seen = new Set();
    const clean = [];
    (rows || []).forEach((r, i) => {
      const id = String(r.fundId || '').trim();
      if (!id) {
        if (r.units || r.invested) throw new Error(`Row ${i + 1}: pick a fund from the list.`);
        return;
      }
      const f = funds[id];
      if (!f) throw new Error(`Row ${i + 1}: that fund is no longer on MUFAP's list. Pick it again.`);
      if (seen.has(id)) throw new Error(`${f.name} is listed twice. Combine it into one row.`);
      seen.add(id);
      const units = Number(r.units);
      const invested = Number(r.invested || 0);
      if (!(units > 0)) throw new Error(`${f.name}: units must be more than 0. Use Remove to drop a fund.`);
      if (!(invested >= 0)) throw new Error(`${f.name}: amount invested can't be negative.`);
      clean.push({ id, name: f.name, amc: f.amc, units, invested });
    });

    const now = new Date();
    const before = readHoldings_();
    const beforeMap = Object.fromEntries(before.map(h => [h.id, h]));
    const afterMap = Object.fromEntries(clean.map(h => [h.id, h]));
    const changes = [];
    clean.forEach(h => {
      const b = beforeMap[h.id];
      if (!b) changes.push([now, h.id, h.name, 'Added', 0, h.units, 0, h.invested]);
      else if (b.units !== h.units || b.invested !== h.invested) changes.push([now, h.id, h.name, 'Changed', b.units, h.units, b.invested, h.invested]);
    });
    before.forEach(b => {
      if (!afterMap[b.id]) changes.push([now, b.id, b.name, 'Removed', b.units, 0, b.invested, 0]);
    });

    const sh = sheet_('holdings');
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 6).clearContent();
    if (clean.length) sh.getRange(2, 1, clean.length, 6).setValues(clean.map(h => [h.id, h.name, h.amc, h.units, h.invested, now]));
    if (changes.length) appendRows_(sheet_('history'), changes);

    // Store today's NAV for newly added funds so tomorrow has a previous NAV to compare against.
    recordNavs_(clean.map(h => h.id), funds);
    return { saved: clean.length, changes: changes.length };
  } finally {
    lock.releaseLock();
  }
}

// ---------- Daily jobs ----------

function eveningRun() { dailyRun_(false); }
function morningRun() { dailyRun_(true); }

function dailyRun_(isRetry) {
  let funds;
  try {
    funds = refreshFunds_();
  } catch (e) {
    console.error(e);
    if (isRetry) notifyError_(e);
    return;
  }
  const holdings = readHoldings_();
  if (!holdings.length) return;
  recordNavs_(holdings.map(h => h.id), Object.fromEntries(funds.map(f => [f.id, f])));
  const report = computeReport(holdings, readNavs_(), Number(setting_('DROP_ALERT_PCT')) || 2);
  const last = lastReported_();
  const hasNew = report.rows.some(r => r.date && r.date > (last[r.id] || ''));
  if (!hasNew) return; // MUFAP hasn't published new NAVs for your funds yet (or it's a holiday)
  deliver_(report);
}

/** Refreshes NAVs and sends the report even if it was already sent. Used by the menu and the form. */
function sendReportNow() {
  try { refreshFunds_(); } catch (e) { console.warn('MUFAP refresh failed, using last saved NAVs: ' + e); }
  const holdings = readHoldings_();
  if (!holdings.length) return 'Add your holdings in the form first.';
  recordNavs_(holdings.map(h => h.id), fundMap_());
  const report = computeReport(holdings, readNavs_(), Number(setting_('DROP_ALERT_PCT')) || 2);
  const sent = deliver_(report);
  return `Report sent by ${sent.join(' and ')}.`;
}

function deliver_(report) {
  const sent = [];
  upsertDaily_(report);
  const chart = chartBlob_();
  const to = setting_('EMAIL_TO') || Session.getEffectiveUser().getEmail();
  const options = { to, subject: subject_(report), htmlBody: emailHtml_(report, ScriptApp.getService().getUrl(), !!chart), name: 'Keeper' };
  if (chart) options.inlineImages = { chart };
  MailApp.sendEmail(options);
  sent.push('email');
  if (sendWhatsApp_(whatsAppText_(report))) sent.push('WhatsApp');
  const last = lastReported_();
  report.rows.forEach(r => { if (r.date) last[r.id] = r.date; });
  PropertiesService.getScriptProperties().setProperty('LAST_REPORTED', JSON.stringify(last));
  return sent;
}

function notifyError_(e) {
  const to = setting_('EMAIL_TO') || Session.getEffectiveUser().getEmail();
  MailApp.sendEmail(to, 'Keeper: could not read MUFAP',
    `Both last night's run and this morning's retry could not read MUFAP's NAV page.\n\nError: ${e && e.message ? e.message : e}\n\nIf this keeps happening, check ${MUFAP_URL} in a browser.`);
}

// ---------- MUFAP ----------

function refreshFunds_() {
  const res = UrlFetchApp.fetch(MUFAP_URL, { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (res.getResponseCode() !== 200) throw new Error(`MUFAP returned HTTP ${res.getResponseCode()}`);
  const funds = parseMufap(res.getContentText());
  const now = new Date();
  const sh = sheet_('funds');
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 10).clearContent();
  sh.getRange(2, 1, funds.length, 10).setValues(funds.map(f =>
    [f.id, f.name, f.amc, f.category, f.sector, f.offer, f.repurchase, f.nav, f.date, now]));
  return funds;
}

/** Parses MUFAP's "NAV / Daily Prices" table. Pure function so it can be tested outside Apps Script. */
function parseMufap(html) {
  const start = html.indexOf('id="table_id"');
  if (start < 0) throw new Error('MUFAP page layout changed: the NAV table was not found.');
  const end = html.indexOf('</table>', start);
  const rows = html.slice(start, end < 0 ? undefined : end).split(/<tr\b/i).slice(1);
  const seen = new Set();
  const funds = [];
  rows.forEach(row => {
    const idMatch = row.match(/FundID=(\d+)/i);
    if (!idMatch || seen.has(idMatch[1])) return;
    const cells = [];
    const re = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
    let m;
    while ((m = re.exec(row))) cells.push(cleanText_(m[1]));
    if (cells.length < 9) return;
    const nav = num_(cells[7]);
    if (nav === null) return;
    seen.add(idMatch[1]);
    funds.push({
      id: idMatch[1], sector: cells[0], amc: cells[1], name: cells[2], category: cells[3],
      offer: num_(cells[5]), repurchase: num_(cells[6]), nav, date: isoFromMufap_(cells[8]),
    });
  });
  if (!funds.length) throw new Error('MUFAP page layout changed: no fund rows were found.');
  // Pension schemes list each sub-fund under the same name; add the sub-fund type so names are unique.
  const count = {};
  funds.forEach(f => { count[f.name] = (count[f.name] || 0) + 1; });
  funds.forEach(f => { if (count[f.name] > 1) f.name += ' (' + f.category.replace(/^VPS-/, '') + ')'; });
  return funds.sort((a, b) => a.name.localeCompare(b.name));
}

function cleanText_(s) {
  return s.replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim();
}

function num_(s) {
  const n = parseFloat(String(s).replace(/,/g, ''));
  return isFinite(n) ? n : null;
}

function isoFromMufap_(s) {
  const m = String(s).match(/([A-Za-z]{3})\w*\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return '';
  const mon = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m[1].toLowerCase()) + 1;
  if (!mon) return '';
  return `${m[3]}-${String(mon).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

// ---------- Report maths (pure) ----------

/**
 * holdings: [{id, name, units, invested}]
 * navsById: {id: [{date, nav, repurchase}] sorted oldest → newest}
 */
function computeReport(holdings, navsById, dropPct) {
  const rows = holdings.map(h => {
    const hist = navsById[h.id] || [];
    const last = hist[hist.length - 1] || null;
    const prev = hist.length > 1 ? hist[hist.length - 2] : null;
    const price = last ? (last.repurchase || last.nav) : 0;
    const value = h.units * price;
    const day = last && prev ? h.units * (last.nav - prev.nav) : null;
    const dayPct = last && prev && prev.nav ? (last.nav / prev.nav - 1) * 100 : null;
    return {
      id: h.id, name: h.name, units: h.units, invested: h.invested,
      nav: last ? last.nav : null, date: last ? last.date : '', prevDate: prev ? prev.date : '',
      value, day, dayPct,
      total: value - h.invested, totalPct: h.invested ? (value / h.invested - 1) * 100 : null,
      alert: dayPct !== null && dayPct <= -Math.abs(dropPct),
    };
  });
  const value = rows.reduce((s, r) => s + r.value, 0);
  const invested = rows.reduce((s, r) => s + r.invested, 0);
  const day = rows.reduce((s, r) => s + (r.day || 0), 0);
  const prevValue = value - day;
  const date = rows.reduce((d, r) => (r.date > d ? r.date : d), '');
  return {
    date, rows, value, invested, day,
    dayPct: prevValue ? (day / prevValue) * 100 : 0,
    total: value - invested, totalPct: invested ? (value / invested - 1) * 100 : 0,
    alerts: rows.filter(r => r.alert),
  };
}

// ---------- Messages ----------

function subject_(r) {
  const warn = r.alerts.length ? '⚠ ' : '';
  return `${warn}Keeper ${dateLabel_(r.date)}: ${fmtRs_(r.day, true)} (${fmtPct_(r.dayPct)})`;
}

function whatsAppText_(r) {
  const lines = [`*Keeper · ${dateLabel_(r.date)}*`, `Today: ${fmtRs_(r.day, true)} (${fmtPct_(r.dayPct)})`];
  r.rows.forEach(x => {
    const day = x.day === null ? 'new, no previous NAV' : `${fmtRs_(x.day, true)} (${fmtPct_(x.dayPct)})`;
    lines.push(`• ${x.name}: ${day}`);
  });
  lines.push(`Value: ${fmtRs_(r.value)}`, `Total P/L: ${fmtRs_(r.total, true)} (${fmtPct_(r.totalPct)})`);
  r.alerts.forEach(a => lines.push(`⚠ ${a.name} fell ${fmtPct_(a.dayPct)} today`));
  return lines.join('\n');
}

function emailHtml_(r, formUrl, hasChart) {
  const col = n => (n === null || n === undefined) ? '#5b6578' : n >= 0 ? '#0f7a52' : '#b3261e';
  const td = 'padding:7px 8px;border-bottom:1px solid #dde1e8;text-align:right;white-space:nowrap;font-family:Consolas,monospace;font-size:13px';
  const th = 'padding:7px 8px;border-bottom:1px solid #dde1e8;text-align:right;font-size:11px;color:#5b6578;text-transform:uppercase;letter-spacing:.05em';
  const rows = r.rows.map(x => `<tr>
      <td style="${td};text-align:left;font-family:Arial,sans-serif;font-size:14px;white-space:normal">${esc_(x.name)}${x.alert ? ' ⚠' : ''}</td>
      <td style="${td}">${fmtNum_(x.units, 4)}</td>
      <td style="${td}">${x.nav === null ? '–' : fmtNum_(x.nav, 4)}</td>
      <td style="${td};color:${col(x.day)}">${x.day === null ? 'new' : fmtRs_(x.day, true) + '<br><span style="font-size:11px">' + fmtPct_(x.dayPct) + '</span>'}</td>
      <td style="${td}">${fmtRs_(x.value)}</td>
      <td style="${td};color:${col(x.total)}">${fmtRs_(x.total, true)}<br><span style="font-size:11px">${x.totalPct === null ? '' : fmtPct_(x.totalPct)}</span></td>
    </tr>`).join('');
  const alerts = r.alerts.map(a => `<p style="margin:0 0 12px;padding:8px 12px;background:#fbf1dc;color:#8a5a00;border-radius:6px">⚠ ${esc_(a.name)} fell ${fmtPct_(a.dayPct)} today.</p>`).join('');
  return `<div style="font-family:Arial,sans-serif;color:#17202e;max-width:640px">
    ${alerts}
    <div style="font-size:13px;color:#5b6578">Today's change · NAV date ${dateLabel_(r.date, true)}</div>
    <div style="font-size:30px;font-weight:bold;color:${col(r.day)};margin:2px 0 14px">${fmtRs_(r.day, true)} <span style="font-size:20px">${fmtPct_(r.dayPct)}</span></div>
    <table style="border-collapse:collapse;margin-bottom:14px"><tr>
      <td style="padding-right:28px"><div style="font-size:11px;color:#5b6578;text-transform:uppercase">Value</div><b style="font-size:16px">${fmtRs_(r.value)}</b></td>
      <td style="padding-right:28px"><div style="font-size:11px;color:#5b6578;text-transform:uppercase">Invested</div><b style="font-size:16px">${fmtRs_(r.invested)}</b></td>
      <td><div style="font-size:11px;color:#5b6578;text-transform:uppercase">Total P/L</div><b style="font-size:16px;color:${col(r.total)}">${fmtRs_(r.total, true)} (${fmtPct_(r.totalPct)})</b></td>
    </tr></table>
    <table style="border-collapse:collapse;width:100%">
      <tr><th style="${th};text-align:left">Fund</th><th style="${th}">Units</th><th style="${th}">NAV</th><th style="${th}">Day</th><th style="${th}">Value</th><th style="${th}">Total P/L</th></tr>
      ${rows}
    </table>
    ${hasChart ? '<p style="margin:18px 0 4px;font-size:12px;color:#5b6578">Portfolio value by NAV date</p><img src="cid:chart" width="600" style="max-width:100%">' : ''}
    <p style="margin-top:18px;font-size:12px;color:#5b6578">Prices from MUFAP's daily NAV table. Value uses the repurchase price.${formUrl ? ` <a href="${formUrl}">Edit holdings</a>` : ''}</p>
  </div>`;
}

function sendWhatsApp_(text) {
  const phone = setting_('WHATSAPP_PHONE');
  const key = setting_('CALLMEBOT_APIKEY');
  if (!phone || !key) return false;
  const url = 'https://api.callmebot.com/whatsapp.php?phone=' + encodeURIComponent(phone) +
    '&text=' + encodeURIComponent(text) + '&apikey=' + encodeURIComponent(key);
  try {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) { console.warn('CallMeBot HTTP ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300)); return false; }
    return true;
  } catch (e) {
    console.warn('CallMeBot failed: ' + e);
    return false;
  }
}

// ---------- Sheet helpers ----------

function book_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Open the spreadsheet and run Keeper → Set up sheets first.');
  return SpreadsheetApp.openById(id);
}

function sheet_(key) {
  const def = SHEETS[key];
  const book = book_();
  let sh = book.getSheetByName(def.name);
  if (!sh) {
    sh = book.insertSheet(def.name);
    sh.getRange(1, 1, 1, def.header.length).setValues([def.header]).setFontWeight('bold');
    sh.setFrozenRows(1);
    def.textCols.forEach(c => sh.getRange(1, c, sh.getMaxRows(), 1).setNumberFormat('@'));
  }
  return sh;
}

function rows_(key, width) {
  const sh = sheet_(key);
  const n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, width).getValues() : [];
}

function appendRows_(sh, rows) {
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function readFunds_() {
  return rows_('funds', 9).filter(r => r[0] !== '').map(r => ({
    id: String(r[0]), name: r[1], amc: r[2], category: r[3], sector: r[4],
    offer: r[5], repurchase: r[6], nav: r[7], date: iso_(r[8]),
  }));
}

function fundMap_() {
  return Object.fromEntries(readFunds_().map(f => [f.id, f]));
}

function readHoldings_() {
  return rows_('holdings', 5).filter(r => r[0] !== '').map(r => ({
    id: String(r[0]), name: r[1], amc: r[2], units: Number(r[3]) || 0, invested: Number(r[4]) || 0,
  }));
}

function readNavs_() {
  const byId = {};
  rows_('navs', 5).forEach(r => {
    const id = String(r[1]);
    (byId[id] = byId[id] || []).push({ date: iso_(r[0]), nav: Number(r[3]), repurchase: Number(r[4]) || null });
  });
  Object.values(byId).forEach(list => list.sort((a, b) => a.date.localeCompare(b.date)));
  return byId;
}

function recordNavs_(ids, fundsById) {
  const sh = sheet_('navs');
  const have = new Set(rows_('navs', 2).map(r => iso_(r[0]) + '|' + String(r[1])));
  const now = new Date();
  const add = [];
  ids.forEach(id => {
    const f = fundsById[id];
    if (!f || !f.date || f.nav === null || f.nav === '') return;
    if (have.has(f.date + '|' + id)) return;
    add.push([f.date, id, f.name, f.nav, f.repurchase, now]);
  });
  if (add.length) appendRows_(sh, add);
}

function upsertDaily_(r) {
  const sh = sheet_('daily');
  const row = [r.date, round2_(r.value), round2_(r.invested), round2_(r.day), round2_(r.total)];
  const dates = rows_('daily', 1).map(x => iso_(x[0]));
  const i = dates.indexOf(r.date);
  if (i >= 0) sh.getRange(i + 2, 1, 1, 5).setValues([row]);
  else appendRows_(sh, [row]);
}

function chartBlob_() {
  try {
    const sh = sheet_('daily');
    const n = sh.getLastRow() - 1;
    if (n < 2) return null;
    const range = sh.getRange(1, 1, n + 1, 2);
    let chart = sh.getCharts()[0];
    if (!chart) {
      chart = sh.newChart().asLineChart().addRange(range).setNumHeaders(1)
        .setPosition(2, 7, 0, 0).setOption('legend', { position: 'none' })
        .setOption('width', 600).setOption('height', 240).build();
      sh.insertChart(chart);
    } else {
      chart = chart.modify().clearRanges().addRange(range).build();
      sh.updateChart(chart);
    }
    return chart.getAs('image/png').setName('chart.png');
  } catch (e) {
    console.warn('Chart skipped: ' + e);
    return null;
  }
}

function setting_(name) {
  const row = rows_('settings', 2).find(r => r[0] === name);
  return row ? String(row[1]).trim() : '';
}

function lastReported_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('LAST_REPORTED') || '{}'); }
  catch (e) { return {}; }
}

// ---------- Formatting ----------

function iso_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return String(v || '').trim();
}

function dateLabel_(iso, withYear) {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso || '';
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m[2]) - 1];
  return `${Number(m[3])} ${mon}${withYear ? ' ' + m[1] : ''}`;
}

function fmtRs_(n, signed) {
  const r = Math.round(Math.abs(n || 0));
  const digits = String(r).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = n < 0 && r !== 0 ? '-' : (signed && r !== 0 ? '+' : '');
  return `${sign}Rs ${digits}`;
}

function fmtPct_(n) {
  if (n === null || n === undefined || !isFinite(n)) return '';
  return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
}

function fmtNum_(n, dp) {
  const [i, f] = Number(n).toFixed(dp).split('.');
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f ? '.' + f : '');
}

function round2_(n) { return Math.round(n * 100) / 100; }

function esc_(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
