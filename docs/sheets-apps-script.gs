/**
 * Provenance — Google Apps Script (Code.gs)
 *
 * Deployed as a Web App. Receives POSTs from /api/log-tour (and
 * /api/ask) and appends one row per event to the bound Google Sheet.
 *
 * The row layout is dictated by the HEADERS array below — the
 * incoming JSON keys are mapped to columns by header name, so admins
 * can reorder / add columns in the sheet without breaking the script
 * (as long as the header text matches one in HEADERS).
 *
 * SETUP (run ONCE after pasting this file in):
 *   1. Paste this whole file into the Apps Script editor for the
 *      target sheet (Extensions → Apps Script).
 *   2. From the function dropdown choose `addHeaders`, click Run,
 *      and accept the auth prompt the first time.
 *   3. Deploy → Manage deployments → edit the existing Web app
 *      deployment → Version: New version → Deploy. The deployment
 *      URL stays the same (no change needed to SHEETS_WEBHOOK_URL).
 */

const HEADERS = [
  // ── Original 24 columns ──
  'Logged At',
  'Timestamp',
  'Session ID',
  'Source',
  'Event/Type',
  'Tour Title',
  'Stop Title',
  'Stop #',
  'Reflection Score',
  'Follow-Up Response',
  'Question',
  'Question Routing',
  'Stops Completed',
  'Duration (min)',
  'EQ Initial Theory',
  'EQ Initial Reasoning',
  'EQ Final Reflection',
  'EQ Final Reasoning',
  'EQ Cognitive Slider',
  'EQ Perceptual Slider',
  'EQ What Changed',
  'EQ Why Changed',
  'Observation',
  'Answer',
  // ── 12 new columns (May 2026) ──
  'Room Code',
  'Is Host',
  'Member Count',
  'Question Key',
  'Opinion Left Label',
  'Opinion Right Label',
  'Opinion My Position',
  'Opinion Other Positions',
  'Opinion Similarity',
  'Opinion Avg Distance',
  'User Choice Question',
  'User Choice Is Custom',
];

/**
 * Run this ONCE from the Apps Script editor. It checks the sheet's
 * header row and appends any headers from HEADERS that aren't already
 * present (in HEADERS order). Safe to re-run — it only adds missing
 * headers, never reorders or deletes existing ones.
 */
function addHeaders() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastCol = sheet.getLastColumn();

  if (lastCol === 0) {
    // Empty sheet — write all headers in one shot.
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    Logger.log('Wrote ' + HEADERS.length + ' headers to an empty sheet.');
    return;
  }

  const existing = sheet
    .getRange(1, 1, 1, lastCol)
    .getValues()[0]
    .map(function (h) { return String(h); });

  let nextCol = lastCol + 1;
  let added = 0;
  HEADERS.forEach(function (name) {
    if (existing.indexOf(name) === -1) {
      sheet.getRange(1, nextCol).setValue(name);
      nextCol += 1;
      added += 1;
    }
  });
  sheet.setFrozenRows(1);
  Logger.log('Added ' + added + ' new headers (existing kept in place).');
}

/**
 * Receives POSTed JSON from /api/log-tour and /api/ask. Maps incoming
 * keys to columns by header name, so the order of columns in the
 * sheet can change without breaking anything.
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const headerRow = sheet
      .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), HEADERS.length))
      .getValues()[0]
      .map(function (h) { return String(h); });

    const fieldMap = buildFieldMap(data);
    const row = headerRow.map(function (h) {
      return fieldMap[h] !== undefined ? fieldMap[h] : '';
    });

    sheet.appendRow(row);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log('doPost error: ' + err);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/** Returns OK for browser pings. Apps Script Web Apps require
 *  doGet to be defined or hitting the URL returns 404. */
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, name: 'Provenance Logger' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ─── Internal mapping ────────────────────────────────────────── */

function buildFieldMap(data) {
  return {
    'Logged At': new Date(),
    'Timestamp': data.timestamp || '',
    'Session ID': data.sessionId || '',
    'Source': data.source || '',
    'Event/Type': data.event || '',
    'Tour Title': data.tourTitle || '',
    'Stop Title': data.stopTitle || '',
    'Stop #': numberOrEmpty(data.stopIndex),
    'Reflection Score': numberOrEmpty(data.reflectionScore),
    'Follow-Up Response': data.followUpResponse || '',
    'Question': data.questionText || '',
    'Question Routing': data.questionRouting || '',
    'Stops Completed': numberOrEmpty(data.stopsCompleted),
    'Duration (min)': numberOrEmpty(data.durationMinutes),
    'EQ Initial Theory': data.eqTheory || '',
    'EQ Initial Reasoning': data.eqReasoning || '',
    'EQ Final Reflection': data.eqFinalReflection || '',
    'EQ Final Reasoning': data.eqFinalReasoning || '',
    'EQ Cognitive Slider': numberOrEmpty(data.eqCognitiveSlider),
    'EQ Perceptual Slider': numberOrEmpty(data.eqPerceptualSlider),
    'EQ What Changed': data.eqWhatChanged || '',
    'EQ Why Changed': data.eqWhyChanged || '',
    'Observation': data.observation || '',
    'Answer': data.answer || '',
    // ── New columns ──
    'Room Code': data.roomCode || '',
    'Is Host': boolOrEmpty(data.isHost),
    'Member Count': numberOrEmpty(data.memberCount),
    'Question Key': data.questionKey || '',
    'Opinion Left Label': data.opinionLeftLabel || '',
    'Opinion Right Label': data.opinionRightLabel || '',
    'Opinion My Position': numberOrEmpty(data.opinionMyPosition),
    'Opinion Other Positions': data.opinionOtherPositions || '',
    'Opinion Similarity': data.opinionSimilarity || '',
    'Opinion Avg Distance': numberOrEmpty(data.opinionAvgDistance),
    'User Choice Question': data.userChoiceQuestion || '',
    'User Choice Is Custom': boolOrEmpty(data.userChoiceIsCustom),
  };
}

function numberOrEmpty(v) {
  if (v === undefined || v === null || v === '') return '';
  return v;
}

function boolOrEmpty(v) {
  if (v === undefined || v === null || v === '') return '';
  return v === true ? 'TRUE' : v === false ? 'FALSE' : v;
}
