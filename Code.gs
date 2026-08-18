/************************************************************
 * MONTHLY CALLER SHEET MANAGER
 *
 * MAIN / CONTROL SHEET HEADERS:
 * A = Caller Sheet URL
 * B = Month
 * C = Caller Name
 * D = TL Name
 *
 * TEMPLATE SHEET:
 * Template
 *
 * STATUS COLUMNS CREATED AUTOMATICALLY:
 * E = Status
 * F = Last Run
 * G = Created Sheet
 * H = Error
 ************************************************************/

/* =========================================================
   CONFIGURATION
   ========================================================= */

const CONFIG = {
  TEMPLATE_SHEET_NAME: "Template",
  HEADER_ROW: 1,
  URL_HEADER: "Caller Sheet URL",
  MONTH_HEADER: "Month",
  CALLER_HEADER: "Caller Name",
  TL_HEADER: "TL Name",
  STATUS_HEADER: "Status",
  TIME_HEADER: "Last Run",
  CREATED_HEADER: "Created Sheet",
  ERROR_HEADER: "Error"
};

/* =========================================================
   ON OPEN MENU & SIDEBAR
   ========================================================= */

function onOpen() {
  removeLegacyExecutionLog_();

  SpreadsheetApp
    .getUi()
    .createMenu("📱 Monthly Sheet Manager")
    .addItem("✨ Open Control Center", "openManagerPanel")
    .addToUi();
}

function openManagerPanel() {
  var html = HtmlService
    .createHtmlOutput(getManagerPanelHtml_())
    .setTitle("Sheet Manager");

  SpreadsheetApp
    .getUi()
    .showSidebar(html);
}

/* =========================================================
   CONTROL SHEET DETECTOR & UTILITIES
   ========================================================= */

function findControlSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();

  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];

    if (sheet.getName() === CONFIG.TEMPLATE_SHEET_NAME) {
      continue;
    }

    if (sheet.getLastRow() < CONFIG.HEADER_ROW) {
      continue;
    }

    var lastColumn = Math.max(sheet.getLastColumn(), 4);
    var headers = sheet.getRange(CONFIG.HEADER_ROW, 1, 1, lastColumn).getDisplayValues()[0];

    var normalized = headers.map(function(h) {
      return String(h || "").trim().toLowerCase();
    });

    var hasURL = normalized.indexOf(CONFIG.URL_HEADER.toLowerCase()) !== -1;
    var hasMonth = normalized.indexOf(CONFIG.MONTH_HEADER.toLowerCase()) !== -1;

    if (hasURL && hasMonth) {
      return sheet;
    }
  }

  return null;
}

function findHeaderColumn_(sheet, headerName) {
  var lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) return -1;

  var headers = sheet.getRange(CONFIG.HEADER_ROW, 1, 1, lastColumn).getDisplayValues()[0];
  var target = String(headerName).trim().toLowerCase();

  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i] || "").trim().toLowerCase() === target) {
      return i + 1;
    }
  }

  return -1;
}

function ensureHeaderColumn_(sheet, headerName) {
  var existing = findHeaderColumn_(sheet, headerName);
  if (existing !== -1) return existing;

  var newColumn = sheet.getLastColumn() + 1;
  sheet.getRange(CONFIG.HEADER_ROW, newColumn).setValue(headerName);
  sheet.getRange(CONFIG.HEADER_ROW, newColumn).setFontWeight("bold");

  return newColumn;
}

/* =========================================================
   STATUS UPDATERS
   ========================================================= */

function setStatus_(sheet, row, statusColumn, timeColumn, status, time) {
  sheet.getRange(row, statusColumn).setValue(status);
  sheet.getRange(row, timeColumn).setValue(time);
}

function setError_(sheet, row, statusColumn, timeColumn, errorColumn, message, time) {
  setStatus_(sheet, row, statusColumn, timeColumn, "❌ ERROR", time);
  sheet.getRange(row, errorColumn).setValue(message);
}

function setCreatedLink_(sheet, row, column, url) {
  if (!url) return;
  sheet.getRange(row, column).setFormula('=HYPERLINK("' + url + '","🔗 Open Sheet")');
}

/* =========================================================
   CORE WORKFLOW: CREATE MONTHLY SHEETS
   ========================================================= */

function createMonthlySheetsSafe() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return {
      type: "warning",
      title: "Already Running",
      message: "Another process is already running. Please wait.",
      created: 0, existing: 0, skipped: 0, errors: 0
    };
  }

  try {
    return processRows_(null);
  } finally {
    lock.releaseLock();
  }
}

function processRows_(selectedRows) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var controlSheet = findControlSheet_();
  if (!controlSheet) {
    return {
      type: "error",
      title: "Control Sheet Not Found",
      message: "Required headers: Caller Sheet URL, Month, Caller Name and TL Name.",
      created: 0, existing: 0, skipped: 0, errors: 1
    };
  }

  var templateSheet = ss.getSheetByName(CONFIG.TEMPLATE_SHEET_NAME);
  if (!templateSheet) {
    return {
      type: "error",
      title: "Template Not Found",
      message: "Sheet named 'Template' not found.",
      created: 0, existing: 0, skipped: 0, errors: 1
    };
  }

  var urlColumn = findHeaderColumn_(controlSheet, CONFIG.URL_HEADER);
  var monthColumn = findHeaderColumn_(controlSheet, CONFIG.MONTH_HEADER);
  var callerColumn = findHeaderColumn_(controlSheet, CONFIG.CALLER_HEADER);
  var tlColumn = findHeaderColumn_(controlSheet, CONFIG.TL_HEADER);

  var statusColumn = ensureHeaderColumn_(controlSheet, CONFIG.STATUS_HEADER);
  var timeColumn = ensureHeaderColumn_(controlSheet, CONFIG.TIME_HEADER);
  var createdColumn = ensureHeaderColumn_(controlSheet, CONFIG.CREATED_HEADER);
  var errorColumn = ensureHeaderColumn_(controlSheet, CONFIG.ERROR_HEADER);

  var lastRow = controlSheet.getLastRow();
  if (lastRow <= CONFIG.HEADER_ROW) {
    return {
      type: "warning",
      title: "No Data",
      message: "Control sheet has no data rows to process.",
      created: 0, existing: 0, skipped: 0, errors: 0
    };
  }

  var lastColumn = controlSheet.getLastColumn();
  var data = controlSheet.getRange(CONFIG.HEADER_ROW + 1, 1, lastRow - CONFIG.HEADER_ROW, lastColumn).getDisplayValues();
  var formulas = controlSheet.getRange(CONFIG.HEADER_ROW + 1, urlColumn, lastRow - CONFIG.HEADER_ROW, 1).getFormulas();
  var richTexts = controlSheet.getRange(CONFIG.HEADER_ROW + 1, urlColumn, lastRow - CONFIG.HEADER_ROW, 1).getRichTextValues();

  var createdCount = 0;
  var existingCount = 0;
  var skippedCount = 0;
  var errorCount = 0;
  var startTime = new Date();

  var rows = [];
  if (selectedRows && selectedRows.length) {
    rows = selectedRows.slice();
  } else {
    for (var r = CONFIG.HEADER_ROW + 1; r <= lastRow; r++) {
      rows.push(r);
    }
  }

  for (var x = 0; x < rows.length; x++) {
    var row = rows[x];
    var index = row - CONFIG.HEADER_ROW - 1;

    if (index < 0 || index >= data.length) continue;

    var urlDisplay = data[index][urlColumn - 1];
    var month = String(data[index][monthColumn - 1] || "").trim();
    var callerName = callerColumn > 0 ? String(data[index][callerColumn - 1] || "").trim() : "";
    var tlName = tlColumn > 0 ? String(data[index][tlColumn - 1] || "").trim() : "";

    var url = getSheetUrl_(urlDisplay, formulas[index][0], richTexts[index][0]);
    var now = new Date();

    if (!month) {
      setStatus_(controlSheet, row, statusColumn, timeColumn, "⏭ SKIPPED - Month Blank", now);
      controlSheet.getRange(row, errorColumn).clearContent();
      skippedCount++;
      continue;
    }

    if (!url) {
      setStatus_(controlSheet, row, statusColumn, timeColumn, "⏭ SKIPPED - URL Blank", now);
      skippedCount++;
      continue;
    }

    if (!isValidSheetName_(month)) {
      setError_(controlSheet, row, statusColumn, timeColumn, errorColumn, "Invalid sheet name: " + month, now);
      errorCount++;
      continue;
    }

    var spreadsheetId = extractSpreadsheetId_(url);
    if (!spreadsheetId) {
      setError_(controlSheet, row, statusColumn, timeColumn, errorColumn, "Invalid Google Sheet URL", now);
      errorCount++;
      continue;
    }

    setStatus_(controlSheet, row, statusColumn, timeColumn, "⏳ PROCESSING", now);
    controlSheet.getRange(row, errorColumn).clearContent();

    try {
      var destSS = SpreadsheetApp.openById(spreadsheetId);
      var existing = destSS.getSheetByName(month);

      if (existing) {
        var existingUrl = buildSheetUrl_(destSS, existing);
        setStatus_(controlSheet, row, statusColumn, timeColumn, "⏭ ALREADY EXISTS", now);
        setCreatedLink_(controlSheet, row, createdColumn, existingUrl);
        existingCount++;
        continue;
      }

      var newSheet = null;
      try {
        newSheet = templateSheet.copyTo(destSS);
        newSheet.setName(month);
        SpreadsheetApp.flush();

        var verifiedSheet = destSS.getSheetByName(month);
        if (!verifiedSheet) {
          throw new Error("Monthly sheet was created but could not be verified: " + month);
        }
        newSheet = verifiedSheet;
      } catch (copyError) {
        if (newSheet) {
          try { destSS.deleteSheet(newSheet); } catch (delErr) {}
        }
        throw copyError;
      }

      var newUrl = buildSheetUrl_(destSS, newSheet);
      setCreatedLink_(controlSheet, row, createdColumn, newUrl);
      setStatus_(controlSheet, row, statusColumn, timeColumn, "✅ CREATED", now);
      createdCount++;

    } catch (e) {
      var message = e && e.message ? e.message : String(e);

      if (isDuplicateSheetError_(message)) {
        setStatus_(controlSheet, row, statusColumn, timeColumn, "⏭ ALREADY EXISTS", now);
        existingCount++;
        continue;
      }

      setError_(controlSheet, row, statusColumn, timeColumn, errorColumn, message, now);
      errorCount++;
    }
  }

  var seconds = (new Date().getTime() - startTime.getTime()) / 1000;

  return {
    type: errorCount > 0 ? "warning" : "success",
    title: errorCount > 0 ? "Completed with Errors" : "Process Complete",
    message: "Monthly sheet processing completed.",
    created: createdCount,
    existing: existingCount,
    skipped: skippedCount,
    errors: errorCount,
    seconds: Number(seconds.toFixed(1))
  };
}

/* =========================================================
   PREVIEW WORKFLOW
   ========================================================= */

function previewMonthlySheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var controlSheet = findControlSheet_();

  if (!controlSheet) {
    return {
      type: "error",
      title: "Control Sheet Not Found",
      message: "Required headers: Caller Sheet URL, Month, Caller Name and TL Name.",
      created: 0, existing: 0, skipped: 0, errors: 1
    };
  }

  var urlColumn = findHeaderColumn_(controlSheet, CONFIG.URL_HEADER);
  var monthColumn = findHeaderColumn_(controlSheet, CONFIG.MONTH_HEADER);
  var callerColumn = findHeaderColumn_(controlSheet, CONFIG.CALLER_HEADER);

  var lastRow = controlSheet.getLastRow();
  var data = controlSheet.getRange(2, 1, lastRow - 1, controlSheet.getLastColumn()).getDisplayValues();

  var createCount = 0;
  var existingCount = 0;
  var blankCount = 0;
  var errorCount = 0;
  var preview = [];

  for (var i = 0; i < data.length; i++) {
    var row = i + 2;
    var url = String(data[i][urlColumn - 1] || "").trim();
    var month = String(data[i][monthColumn - 1] || "").trim();
    var caller = callerColumn > 0 ? String(data[i][callerColumn - 1] || "").trim() : "";

    if (!month) {
      blankCount++;
      continue;
    }

    if (!url) {
      blankCount++;
      preview.push("Row " + row + " → " + caller + " → URL BLANK");
      continue;
    }

    var id = extractSpreadsheetId_(url);
    if (!id) {
      errorCount++;
      preview.push("Row " + row + " → " + caller + " → INVALID URL");
      continue;
    }

    try {
      var destSS = SpreadsheetApp.openById(id);
      var existing = destSS.getSheetByName(month);

      if (existing) {
        existingCount++;
        preview.push("Row " + row + " → " + caller + " → " + month + " → EXISTS");
      } else {
        createCount++;
        preview.push("Row " + row + " → " + caller + " → " + month + " → CREATE");
      }
    } catch (e) {
      errorCount++;
      preview.push("Row " + row + " → " + caller + " → ACCESS ERROR");
    }
  }

  return {
    type: errorCount > 0 ? "warning" : "success",
    title: "Preview Only",
    message: "No changes were made. This is only a preview.",
    created: createCount,
    existing: existingCount,
    skipped: blankCount,
    errors: errorCount,
    details: preview.slice(0, 30),
    more: Math.max(0, preview.length - 30)
  };
}

/* =========================================================
   RETRY WORKFLOW
   ========================================================= */

function retryFailedRows() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var controlSheet = findControlSheet_();

  if (!controlSheet) {
    return {
      type: "error",
      title: "Control Sheet Not Found",
      message: "Control sheet not found.",
      created: 0, existing: 0, skipped: 0, errors: 1
    };
  }

  var statusColumn = findHeaderColumn_(controlSheet, CONFIG.STATUS_HEADER);
  if (statusColumn === -1) {
    return {
      type: "warning",
      title: "Nothing to Retry",
      message: "Status column not found.",
      created: 0, existing: 0, skipped: 0, errors: 0
    };
  }

  var lastRow = controlSheet.getLastRow();
  var statuses = controlSheet.getRange(2, statusColumn, lastRow - 1, 1).getDisplayValues();
  var failedRows = [];

  for (var i = 0; i < statuses.length; i++) {
    if (String(statuses[i][0] || "").indexOf("❌ ERROR") === 0) {
      failedRows.push(i + 2);
    }
  }

  if (failedRows.length === 0) {
    return {
      type: "success",
      title: "Nothing to Retry",
      message: "No failed rows found.",
      created: 0, existing: 0, skipped: 0, errors: 0
    };
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return {
      type: "warning",
      title: "Already Running",
      message: "Another process is already running.",
      created: 0, existing: 0, skipped: 0, errors: 0
    };
  }

  try {
    return processRows_(failedRows);
  } finally {
    lock.releaseLock();
  }
}

/* =========================================================
   CLEAR STATUS WORKFLOW
   ========================================================= */

function clearProcessingStatus() {
  var sheet = findControlSheet_();

  if (!sheet) {
    return {
      type: "error",
      title: "Control Sheet Not Found",
      message: "Control sheet not found.",
      created: 0, existing: 0, skipped: 0, errors: 1
    };
  }

  var statusColumn = findHeaderColumn_(sheet, CONFIG.STATUS_HEADER);
  var timeColumn = findHeaderColumn_(sheet, CONFIG.TIME_HEADER);
  var createdColumn = findHeaderColumn_(sheet, CONFIG.CREATED_HEADER);
  var errorColumn = findHeaderColumn_(sheet, CONFIG.ERROR_HEADER);

  var lastRow = sheet.getLastRow();
  if (lastRow < 1) {
    return {
      type: "success",
      title: "Nothing to Clear",
      message: "There is no status data to clear.",
      created: 0, existing: 0, skipped: 0, errors: 0
    };
  }

  [statusColumn, timeColumn, createdColumn, errorColumn].forEach(function(column) {
    if (column !== -1) {
      sheet.getRange(1, column, lastRow, 1).clearContent();
    }
  });

  return {
    type: "success",
    title: "Status Cleared",
    message: "Status, Last Run, Created Sheet and Error data + headers have been removed.",
    created: 0, existing: 0, skipped: 0, errors: 0
  };
}

/* =========================================================
   HELPERS & CLEANUP
   ========================================================= */

function getSheetUrl_(displayValue, formula, richText) {
  if (displayValue) {
    var text = String(displayValue).trim();
    if (/^https?:\/\//i.test(text)) return text;
  }

  if (formula) {
    var match = formula.match(/HYPERLINK\s*\(\s*"([^"]+)"/i);
    if (match && match[1]) return match[1];
  }

  if (richText) {
    try {
      var direct = richText.getLinkUrl();
      if (direct) return direct;

      var runs = richText.getRuns();
      if (runs) {
        for (var i = 0; i < runs.length; i++) {
          var runLink = runs[i].getLinkUrl();
          if (runLink) return runLink;
        }
      }
    } catch (e) {
      Logger.log("Rich text URL error: " + e.message);
    }
  }

  return null;
}

function extractSpreadsheetId_(url) {
  if (!url) return null;
  var match = String(url).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return (match && match[1]) ? match[1] : null;
}

function buildSheetUrl_(spreadsheet, sheet) {
  var sheetName = sheet.getName();
  var verifiedSheet = spreadsheet.getSheetByName(sheetName);
  if (!verifiedSheet) {
    throw new Error("Created sheet could not be found: " + sheetName);
  }
  var gid = verifiedSheet.getSheetId();
  return spreadsheet.getUrl() + "#gid=" + gid;
}

function isValidSheetName_(name) {
  if (!name || name.length > 100) return false;
  return !/[\\\/\?\*\[\]:]/.test(name);
}

function isDuplicateSheetError_(message) {
  return message && message.indexOf("A sheet with the name") !== -1;
}

function removeLegacyExecutionLog_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logSheet = ss.getSheetByName("Execution Log");
  if (!logSheet) return;
  if (ss.getSheets().length > 1) {
    ss.deleteSheet(logSheet);
  }
}

/* =========================================================
   EMBEDDED SINGLE-FILE HTML SIDEBAR PANEL
   ========================================================= */

function getManagerPanelHtml_() {
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <base target="_top">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
      
      --bg-gradient: radial-gradient(180px 180px at 105% 2%, rgba(10,132,255,0.26), transparent 70%),
                     radial-gradient(210px 210px at -10% 18%, rgba(90,200,250,0.20), transparent 70%),
                     radial-gradient(190px 190px at 85% 74%, rgba(52,199,89,0.13), transparent 72%),
                     linear-gradient(135deg, #090d16 0%, #0f172a 45%, #111c35 100%);
      --bg-solid: #090d16;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      
      --accent-blue: #38bdf8;
      --accent-indigo: #6366f1;
      --accent-emerald: #10b981;
      --accent-amber: #f59e0b;
      --accent-rose: #f43f5e;

      --glass-bg: rgba(30, 41, 59, 0.48);
      --glass-border: rgba(255, 255, 255, 0.08);
      --glass-shadow: 0 16px 38px rgba(0, 0, 0, 0.35);
      
      --btn-bg: rgba(255, 255, 255, 0.04);
      --btn-border: rgba(255, 255, 255, 0.09);
      --btn-hover: rgba(255, 255, 255, 0.09);
      --btn-hover-border: rgba(255, 255, 255, 0.22);
      
      --results-bg: rgba(15, 23, 42, 0.85);
      --pill-bg: rgba(255, 255, 255, 0.03);
      --pill-border: rgba(255, 255, 255, 0.06);

      --radius-xl: 20px;
      --radius-lg: 14px;
      --radius-md: 10px;

      --glow-a: rgba(99, 102, 241, 0.25);
      --glow-b: rgba(56, 189, 248, 0.2);
    }

    [data-theme="light"] {
      --bg-gradient: radial-gradient(180px 180px at 105% 2%, rgba(10,132,255,0.22), transparent 70%),
                     radial-gradient(210px 210px at -10% 18%, rgba(90,200,250,0.18), transparent 70%),
                     radial-gradient(190px 190px at 85% 74%, rgba(52,199,89,0.12), transparent 72%),
                     linear-gradient(145deg, #edf4ff 0%, #f6f7fb 42%, #eef8f4 100%);
      --bg-solid: #f4f7fc;
      --text-main: #0b1220;
      --text-muted: #667085;
      --text-dim: #7a8494;
      
      --accent-blue: #0284c7;
      --accent-indigo: #4338ca;
      --accent-emerald: #059669;
      --accent-amber: #d97706;
      --accent-rose: #dc2626;

      --glass-bg: linear-gradient(145deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.42));
      --glass-border: rgba(255, 255, 255, 0.85);
      --glass-shadow: 0 18px 45px rgba(31, 41, 55, 0.12);
      
      --btn-bg: rgba(255, 255, 255, 0.52);
      --btn-border: rgba(255, 255, 255, 0.75);
      --btn-hover: rgba(255, 255, 255, 0.85);
      --btn-hover-border: rgba(255, 255, 255, 0.95);
      
      --results-bg: linear-gradient(145deg, rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0.65));
      --pill-bg: rgba(245, 247, 250, 0.65);
      --pill-border: rgba(255, 255, 255, 0.8);

      --glow-a: rgba(10, 132, 255, 0.15);
      --glow-b: rgba(52, 199, 89, 0.12);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--font-family);
      background: var(--bg-solid);
      background-image: var(--bg-gradient);
      color: var(--text-main);
      min-height: 100vh;
      padding: 16px 14px 24px;
      overflow-x: hidden;
      position: relative;
      -webkit-font-smoothing: antialiased;
      transition: background 0.4s ease, color 0.4s ease;
    }

    body::before {
      content: "";
      position: fixed;
      width: 180px;
      height: 180px;
      top: -50px;
      right: -60px;
      border-radius: 50%;
      background: var(--glow-a);
      filter: blur(36px);
      pointer-events: none;
      animation: floatGlowA 8s ease-in-out infinite alternate;
    }

    body::after {
      content: "";
      position: fixed;
      width: 160px;
      height: 160px;
      bottom: 40px;
      left: -70px;
      border-radius: 50%;
      background: var(--glow-b);
      filter: blur(34px);
      pointer-events: none;
      animation: floatGlowB 10s ease-in-out infinite alternate;
    }

    .app-container {
      position: relative;
      z-index: 1;
      animation: fadeIn .45s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 18px;
      padding: 2px 0;
    }

    .brand-group {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .brand-icon-wrapper {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: linear-gradient(145deg, rgba(255,255,255,0.7), rgba(255,255,255,0.3));
      border: 1px solid var(--glass-border);
      display: grid;
      place-items: center;
      font-size: 18px;
      flex-shrink: 0;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 8px 20px rgba(10,132,255,0.15);
      backdrop-filter: blur(12px);
    }

    [data-theme="dark"] .brand-icon-wrapper {
      background: linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(56,189,248,0.15) 100%);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
    }

    .brand-titles h1 {
      font-size: 15px;
      font-weight: 800;
      letter-spacing: -0.35px;
      color: var(--text-main);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.2;
    }

    .brand-titles p {
      font-size: 10.5px;
      color: var(--text-muted);
      font-weight: 500;
      white-space: nowrap;
    }

    .header-controls {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }

    .theme-toggle-btn {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      border: 1px solid var(--btn-border);
      background: var(--btn-bg);
      color: var(--text-main);
      display: grid;
      place-items: center;
      cursor: pointer;
      font-size: 15px;
      backdrop-filter: blur(16px);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 12px rgba(0,0,0,0.06);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      outline: none;
    }

    .theme-toggle-btn:hover {
      background: var(--btn-hover);
      border-color: var(--btn-hover-border);
      transform: scale(1.08) translateY(-1px);
    }

    .glass-card {
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-xl);
      padding: 15px;
      margin-bottom: 14px;
      backdrop-filter: blur(25px) saturate(145%);
      -webkit-backdrop-filter: blur(25px) saturate(145%);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8), var(--glass-shadow);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .card-label {
      font-size: 9.5px;
      font-weight: 800;
      letter-spacing: 1.1px;
      text-transform: uppercase;
      color: var(--text-dim);
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 7px;
    }

    .card-label::after {
      content: "";
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, var(--text-dim), transparent);
      opacity: 0.2;
    }

    .button-stack {
      display: flex;
      flex-direction: column;
      gap: 9px;
    }

    .btn {
      position: relative;
      width: 100%;
      border: 1px solid var(--btn-border);
      border-radius: var(--radius-lg);
      padding: 11px 13px;
      display: flex;
      align-items: center;
      gap: 11px;
      font-family: inherit;
      font-size: 12.5px;
      font-weight: 750;
      color: var(--text-main);
      background: var(--btn-bg);
      backdrop-filter: blur(14px);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 5px 15px rgba(31, 41, 55, 0.05);
      cursor: pointer;
      outline: none;
      white-space: nowrap;
      overflow: hidden;
      transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .btn::before {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 20%, rgba(255, 255, 255, 0.45) 50%, transparent 80%);
      transform: translateX(-130%);
      transition: transform 0.55s ease;
      pointer-events: none;
    }

    .btn:hover:not(:disabled)::before {
      transform: translateX(130%);
    }

    .btn:hover:not(:disabled) {
      background: var(--btn-hover);
      border-color: var(--btn-hover-border);
      transform: translateY(-2px) scale(1.008);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 9px 22px rgba(31, 41, 55, 0.1);
    }

    .btn:active:not(:disabled) {
      transform: scale(0.975);
    }

    .btn:disabled {
      opacity: 0.48;
      cursor: not-allowed;
    }

    .btn-icon {
      width: 30px;
      height: 30px;
      border-radius: var(--radius-md);
      display: grid;
      place-items: center;
      font-size: 14px;
      background: rgba(255, 255, 255, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.7);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.8);
      flex-shrink: 0;
      transition: transform 0.25s ease;
    }

    [data-theme="dark"] .btn-icon {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.1);
    }

    .btn:hover:not(:disabled) .btn-icon {
      transform: scale(1.1);
    }

    .btn-primary {
      color: #ffffff;
      border-color: rgba(255, 255, 255, 0.34);
      background: linear-gradient(135deg, #087cf1 0%, #168cff 52%, #0a84ff 100%);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28), 0 10px 24px rgba(10, 132, 255, 0.25);
    }

    .btn-primary:hover:not(:disabled) {
      background: linear-gradient(135deg, #066ecb 0%, #0d7ee6 52%, #0875e1 100%);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 12px 28px rgba(10, 132, 255, 0.38);
    }

    .btn-primary .btn-icon {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.3);
    }

    .btn-amber {
      color: #ffffff;
      background: linear-gradient(135deg, #ff9500 0%, #ffab18 100%);
      border-color: rgba(255, 255, 255, 0.3);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28), 0 10px 24px rgba(255, 149, 0, 0.22);
    }

    .btn-amber:hover:not(:disabled) {
      background: linear-gradient(135deg, #e08300 0%, #f09e0a 100%);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 12px 28px rgba(255, 149, 0, 0.32);
    }

    .btn-amber .btn-icon {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.3);
    }

    .btn-danger {
      color: #ffffff;
      background: linear-gradient(135deg, #ff3b30 0%, #ff5e55 100%);
      border-color: rgba(255, 255, 255, 0.3);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28), 0 10px 24px rgba(255, 59, 48, 0.22);
    }

    .btn-danger:hover:not(:disabled) {
      background: linear-gradient(135deg, #e02d23 0%, #ed4d44 100%);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 12px 28px rgba(255, 59, 48, 0.32);
    }

    .btn-danger .btn-icon {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.3);
    }

    .working-box {
      display: none;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-radius: var(--radius-lg);
      color: #086bc9;
      background: rgba(235, 246, 255, 0.68);
      border: 1px solid var(--glass-border);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), var(--glass-shadow);
      backdrop-filter: blur(22px);
      margin-bottom: 14px;
      animation: slideDown 0.35s cubic-bezier(0.22, 1, 0.36, 1);
    }

    [data-theme="dark"] .working-box {
      color: var(--accent-blue);
      background: rgba(30, 58, 138, 0.35);
      border-color: rgba(59, 130, 246, 0.35);
    }

    .working-box.show { display: flex; }

    .spinner-ring {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      border: 2.5px solid rgba(10, 132, 255, 0.2);
      border-top-color: var(--accent-blue);
      border-right-color: var(--accent-indigo);
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
    }

    .working-text b {
      display: block;
      font-size: 12px;
      font-weight: 750;
    }

    .working-text span {
      display: block;
      font-size: 9.5px;
      color: var(--text-muted);
      margin-top: 1px;
    }

    .results-card {
      display: none;
      position: relative;
      border-radius: var(--radius-xl);
      padding: 15px;
      margin-bottom: 14px;
      background: var(--results-bg);
      border: 1px solid var(--glass-border);
      backdrop-filter: blur(30px) saturate(155%);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), var(--glass-shadow);
      animation: resultIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .results-card.show { display: block; }

    .close-btn {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: 1px solid var(--btn-border);
      background: var(--btn-bg);
      color: var(--text-muted);
      display: grid;
      place-items: center;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
      outline: none;
      z-index: 2;
    }

    .close-btn:hover {
      background: rgba(244, 63, 94, 0.2);
      color: var(--accent-rose);
      border-color: rgba(244, 63, 94, 0.4);
      transform: scale(1.1);
    }

    .results-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
      padding-right: 24px;
    }

    .status-badge-icon {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      font-size: 18px;
      font-weight: 800;
      flex-shrink: 0;
      box-shadow: inset 0 1px 0 #fff;
    }

    .status-badge-icon.success {
      color: #178b48;
      background: linear-gradient(145deg, rgba(232,250,239,0.92), rgba(210,244,222,0.62));
      border: 1px solid rgba(52,199,89,0.3);
    }

    .status-badge-icon.warning {
      color: #bd6b00;
      background: linear-gradient(145deg, rgba(255,245,224,0.94), rgba(255,231,193,0.65));
      border: 1px solid rgba(255,149,0,0.3);
    }

    .status-badge-icon.error {
      color: #d62f27;
      background: linear-gradient(145deg, rgba(255,237,235,0.94), rgba(255,215,211,0.66));
      border: 1px solid rgba(255,59,48,0.3);
    }

    .results-title-group h2 {
      font-size: 13.5px;
      font-weight: 780;
      letter-spacing: -0.25px;
      color: var(--text-main);
    }

    .results-title-group p {
      font-size: 9.5px;
      color: var(--text-muted);
      margin-top: 1px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 7px;
      margin-bottom: 10px;
    }

    .stat-pill {
      background: var(--pill-bg);
      border: 1px solid var(--pill-border);
      border-radius: var(--radius-md);
      padding: 8px 10px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.8);
      transition: transform 0.2s ease;
    }

    .stat-pill:hover { transform: translateY(-1px); }

    .stat-value {
      font-size: 16px;
      font-weight: 800;
      color: var(--text-main);
      line-height: 1.1;
    }

    .stat-label {
      font-size: 8.5px;
      font-weight: 700;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 3px;
    }

    .message-box {
      background: var(--pill-bg);
      border: 1px solid var(--pill-border);
      border-radius: var(--radius-md);
      padding: 9px 11px;
      font-size: 10.5px;
      color: var(--text-muted);
      line-height: 1.45;
    }

    .details-box {
      margin-top: 8px;
      max-height: 130px;
      overflow-y: auto;
      background: var(--pill-bg);
      border: 1px solid var(--pill-border);
      border-radius: var(--radius-md);
      padding: 8px 10px;
      font-size: 9px;
      font-family: monospace;
      color: var(--text-main);
      white-space: pre-wrap;
      line-height: 1.45;
    }

    .footer {
      text-align: center;
      font-size: 9px;
      color: var(--text-dim);
      padding: 6px 0;
      letter-spacing: 0.2px;
    }

    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(6px) scale(0.985); } to { opacity: 1; transform: none; } }
    @keyframes slideDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
    @keyframes resultIn { from { opacity: 0; transform: translateY(10px) scale(0.97); filter: blur(3px); } to { opacity: 1; transform: none; filter: none; } }
    @keyframes floatGlowA { 0%, 100% { transform: translate3d(0,0,0); } 50% { transform: translate3d(-8px,10px,0); } }
    @keyframes floatGlowB { 0%, 100% { transform: translate3d(0,0,0); } 50% { transform: translate3d(10px,-7px,0); } }
  </style>
</head>
<body>

  <div class="app-container">
    <div class="header">
      <div class="brand-group">
        <div class="brand-icon-wrapper">📋</div>
        <div class="brand-titles">
          <h1>Sheet Manager</h1>
          <p>Glass Control Center</p>
        </div>
      </div>
      
      <div class="header-controls">
        <button id="themeToggle" class="theme-toggle-btn" onclick="toggleTheme()" title="Toggle Dark/Light Theme">
          🌙
        </button>
      </div>
    </div>

    <div class="glass-card">
      <div class="card-label">Workflows</div>
      <div class="button-stack">
        <button class="btn btn-primary" onclick="run('createMonthlySheetsSafe', this)">
          <span class="btn-icon">🚀</span>
          <span>Create Monthly Sheets</span>
        </button>

        <button class="btn" onclick="run('previewMonthlySheets', this)">
          <span class="btn-icon">🔍</span>
          <span>Run Safe Preview</span>
        </button>

        <button class="btn btn-amber" onclick="run('retryFailedRows', this)">
          <span class="btn-icon">🔄</span>
          <span>Retry Failed Rows</span>
        </button>
      </div>
    </div>

    <div class="glass-card">
      <div class="card-label">Maintenance</div>
      <div class="button-stack">
        <button class="btn btn-danger" onclick="run('clearProcessingStatus', this)">
          <span class="btn-icon">🧹</span>
          <span>Clear Status & Headers</span>
        </button>
      </div>
    </div>

    <div id="working" class="working-box">
      <div class="spinner-ring"></div>
      <div class="working-text">
        <b id="workingText">Processing Request…</b>
        <span>Please keep sidebar open during execution.</span>
      </div>
    </div>

    <div id="result" class="results-card">
      <button class="close-btn" onclick="closeResults()" title="Close Notification">✕</button>

      <div class="results-header">
        <div id="resultIcon" class="status-badge-icon success">✓</div>
        <div class="results-title-group">
          <h2 id="resultTitle">Process Complete</h2>
          <p id="resultSub">Finished successfully</p>
        </div>
      </div>

      <div id="stats" class="stats-grid"></div>
      <div id="message" class="message-box"></div>
      <div id="details" class="details-box" style="display:none"></div>
    </div>

    <div class="footer">
      Glass Control Center • Adaptive Themes
    </div>
  </div>

  <script>
    var busy = false;

    function toggleTheme() {
      var currentTheme = document.documentElement.getAttribute('data-theme');
      var newTheme = currentTheme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      document.getElementById('themeToggle').textContent = newTheme === 'light' ? '☀️' : '🌙';
    }

    function closeResults() {
      var card = document.getElementById('result');
      card.classList.remove('show');
      card.style.display = 'none';
    }

    function setWorking(on, text) {
      var box = document.getElementById('working');
      var label = document.getElementById('workingText');
      box.classList.toggle('show', on);
      label.textContent = text || 'Processing Request…';
    }

    function showResult(result) {
      result = result || {};

      var card = document.getElementById('result');
      var icon = document.getElementById('resultIcon');
      var title = document.getElementById('resultTitle');
      var sub = document.getElementById('resultSub');
      var stats = document.getElementById('stats');
      var message = document.getElementById('message');
      var details = document.getElementById('details');

      var type = result.type || 'success';

      icon.className = 'status-badge-icon ' + type;
      icon.textContent = (type === 'error') ? '✕' : (type === 'warning') ? '!' : '✓';

      title.textContent = result.title || 'Process Complete';
      sub.textContent = (result.seconds != null) ? ('Finished in ' + result.seconds + ' seconds') : 'Execution complete';

      stats.innerHTML = '';
      var items = [
        ['Created', result.created],
        ['Already Exists', result.existing],
        ['Skipped', result.skipped],
        ['Errors', result.errors]
      ];

      items.forEach(function(item) {
        if (item[1] != null) {
          stats.innerHTML += 
            '<div class="stat-pill">' +
              '<div class="stat-value">' + escapeHtml(item[1]) + '</div>' +
              '<div class="stat-label">' + escapeHtml(item[0]) + '</div>' +
            '</div>';
        }
      });

      message.textContent = result.message || '';

      if (result.details && result.details.length) {
        details.style.display = 'block';
        details.textContent = result.details.join('\\n') + (result.more ? ('\\n\\n… and ' + result.more + ' more.') : '');
      } else {
        details.style.display = 'none';
        details.textContent = '';
      }

      card.style.display = 'block';
      card.classList.remove('show');
      void card.offsetWidth;
      card.classList.add('show');

      setTimeout(function() {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function run(fn, button) {
      if (busy) return;
      busy = true;

      document.querySelectorAll('button').forEach(function(b) {
        b.disabled = true;
      });

      var workingText =
        fn === 'createMonthlySheetsSafe' ? 'Creating monthly sheets…' :
        fn === 'previewMonthlySheets' ? 'Building safe preview…' :
        fn === 'retryFailedRows' ? 'Retrying failed rows…' : 'Clearing status and headers…';

      setWorking(true, workingText);

      var runner = google.script.run
        .withSuccessHandler(function(result) {
          busy = false;
          document.querySelectorAll('button').forEach(function(b) {
            b.disabled = false;
          });
          setWorking(false);
          showResult(result);
        })
        .withFailureHandler(function(err) {
          busy = false;
          document.querySelectorAll('button').forEach(function(b) {
            b.disabled = false;
          });
          setWorking(false);
          showResult({
            type: 'error',
            title: 'Execution Error',
            message: err && err.message ? err.message : String(err),
            created: 0, existing: 0, skipped: 0, errors: 1
          });
        });

      if (fn === 'createMonthlySheetsSafe') {
        runner.createMonthlySheetsSafe();
      } else if (fn === 'previewMonthlySheets') {
        runner.previewMonthlySheets();
      } else if (fn === 'retryFailedRows') {
        runner.retryFailedRows();
      } else if (fn === 'clearProcessingStatus') {
        runner.clearProcessingStatus();
      }
    }
  </script>
</body>
</html>`;
}
