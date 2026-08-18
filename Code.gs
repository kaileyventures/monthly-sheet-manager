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
      
      /* Dark Mode Variables */
      --bg-solid: #090d16;
      --bg-gradient: linear-gradient(135deg, #090d16 0%, #0f172a 45%, #111c35 100%);
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
      
      --btn-bg: rgba(255, 255, 255, 0.04);
      --btn-border: rgba(255, 255, 255, 0.09);
      --btn-hover: rgba(255, 255, 255, 0.08);
      
      --results-bg: rgba(15, 23, 42, 0.85);
      --pill-bg: rgba(255, 255, 255, 0.03);
      --pill-border: rgba(255, 255, 255, 0.06);

      --radius-xl: 18px;
      --radius-lg: 12px;
      --radius-md: 8px;

      --glow-a: rgba(99, 102, 241, 0.25);
      --glow-b: rgba(56, 189, 248, 0.2);
    }

    /* Clean Light Theme Overrides (Default) */
    [data-theme="light"] {
      --bg-solid: #f8f9fa;
      --bg-gradient: none;
      --text-main: #1f2937;
      --text-muted: #4b5563;
      --text-dim: #6b7280;
      
      --accent-blue: #0284c7;
      --accent-indigo: #4338ca;
      --accent-emerald: #059669;
      --accent-amber: #d97706;
      --accent-rose: #dc2626;

      --glass-bg: #ffffff;
      --glass-border: #e5e7eb;
      
      --btn-bg: #f3f4f6;
      --btn-border: #d1d5db;
      --btn-hover: #e5e7eb;
      
      --results-bg: #ffffff;
      --pill-bg: #f9fafb;
      --pill-border: #e5e7eb;

      --glow-a: transparent;
      --glow-b: transparent;
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
      padding: 14px 12px 20px;
      overflow-x: hidden;
      position: relative;
      -webkit-font-smoothing: antialiased;
      transition: background 0.3s ease, color 0.3s ease;
    }

    body::before {
      content: "";
      position: fixed;
      width: 200px;
      height: 200px;
      top: -50px;
      right: -60px;
      border-radius: 50%;
      background: radial-gradient(circle, var(--glow-a) 0%, transparent 70%);
      filter: blur(40px);
      pointer-events: none;
    }

    .app-container {
      position: relative;
      z-index: 1;
      animation: fadeIn .4s ease;
    }

    /* Header Section */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      padding: 2px 0;
    }

    .brand-group {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .brand-icon-wrapper {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(56,189,248,0.12) 100%);
      border: 1px solid var(--glass-border);
      display: grid;
      place-items: center;
      font-size: 17px;
      flex-shrink: 0;
    }

    [data-theme="light"] .brand-icon-wrapper {
      background: #eff6ff;
      border-color: #bfdbfe;
    }

    .brand-titles h1 {
      font-size: 14px;
      font-weight: 800;
      letter-spacing: -0.3px;
      color: var(--text-main);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.2;
    }

    .brand-titles p {
      font-size: 10px;
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
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: 1px solid var(--btn-border);
      background: var(--btn-bg);
      color: var(--text-main);
      display: grid;
      place-items: center;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s ease;
      outline: none;
    }

    .theme-toggle-btn:hover {
      background: var(--btn-hover);
      transform: scale(1.05);
    }

    /* Cards */
    .glass-card {
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-xl);
      padding: 14px;
      margin-bottom: 12px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
      transition: all 0.25s ease;
    }

    .card-label {
      font-size: 9.5px;
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--text-dim);
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .card-label::after {
      content: "";
      flex: 1;
      height: 1px;
      background: var(--glass-border);
    }

    /* Buttons */
    .button-stack {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .btn {
      position: relative;
      width: 100%;
      border: 1px solid var(--btn-border);
      border-radius: var(--radius-lg);
      padding: 10px 12px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: inherit;
      font-size: 12.5px;
      font-weight: 700;
      color: var(--text-main);
      background: var(--btn-bg);
      cursor: pointer;
      outline: none;
      white-space: nowrap;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .btn:hover:not(:disabled) {
      background: var(--btn-hover);
      border-color: rgba(0, 0, 0, 0.2);
      transform: translateY(-1px);
    }

    .btn:active:not(:disabled) {
      transform: translateY(0) scale(0.98);
    }

    .btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .btn-icon {
      width: 28px;
      height: 28px;
      border-radius: var(--radius-md);
      display: grid;
      place-items: center;
      font-size: 14px;
      background: rgba(0, 0, 0, 0.04);
      border: 1px solid var(--btn-border);
      flex-shrink: 0;
    }

    /* Button Variants */
    .btn-primary {
      background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #0284c7 100%);
      border-color: rgba(255, 255, 255, 0.2);
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25);
    }

    [data-theme="light"] .btn-primary {
      background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
      border-color: #2563eb;
    }

    .btn-primary .btn-icon {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.25);
    }

    .btn-amber {
      background: rgba(245, 158, 11, 0.12);
      border-color: rgba(245, 158, 11, 0.3);
      color: var(--accent-amber);
    }

    [data-theme="light"] .btn-amber {
      background: #fffbeb;
      border-color: #fde68a;
      color: #b45309;
    }

    .btn-amber .btn-icon {
      background: rgba(245, 158, 11, 0.15);
      border-color: rgba(245, 158, 11, 0.2);
    }

    .btn-danger {
      background: rgba(244, 63, 94, 0.1);
      border-color: rgba(244, 63, 94, 0.25);
      color: var(--accent-rose);
    }

    [data-theme="light"] .btn-danger {
      background: #fef2f2;
      border-color: #fecaca;
      color: #dc2626;
    }

    .btn-danger .btn-icon {
      background: rgba(244, 63, 94, 0.15);
      border-color: rgba(244, 63, 94, 0.2);
    }

    /* Working Banner */
    .working-box {
      display: none;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-radius: var(--radius-lg);
      background: rgba(30, 58, 138, 0.2);
      border: 1px solid rgba(59, 130, 246, 0.3);
      margin-bottom: 12px;
      animation: slideDown 0.3s ease;
    }

    [data-theme="light"] .working-box {
      background: #eff6ff;
      border-color: #bfdbfe;
    }

    .working-box.show { display: flex; }

    .spinner-ring {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      border: 2px solid rgba(56, 189, 248, 0.2);
      border-top-color: var(--accent-blue);
      border-right-color: var(--accent-indigo);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .working-text b {
      display: block;
      font-size: 12px;
      font-weight: 700;
      color: var(--accent-blue);
    }

    .working-text span {
      display: block;
      font-size: 10px;
      color: var(--text-muted);
      margin-top: 1px;
    }

    /* Results Dashboard */
    .results-card {
      display: none;
      position: relative;
      border-radius: var(--radius-xl);
      padding: 14px;
      margin-bottom: 12px;
      background: var(--results-bg);
      border: 1px solid var(--glass-border);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
      animation: resultIn 0.35s ease;
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
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      font-size: 16px;
      font-weight: 800;
      flex-shrink: 0;
    }

    .status-badge-icon.success {
      background: rgba(16, 185, 129, 0.14);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: var(--accent-emerald);
    }

    .status-badge-icon.warning {
      background: rgba(245, 158, 11, 0.14);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: var(--accent-amber);
    }

    .status-badge-icon.error {
      background: rgba(244, 63, 94, 0.14);
      border: 1px solid rgba(244, 63, 94, 0.3);
      color: var(--accent-rose);
    }

    .results-title-group h2 {
      font-size: 13px;
      font-weight: 800;
      color: var(--text-main);
    }

    .results-title-group p {
      font-size: 10.5px;
      color: var(--text-muted);
      margin-top: 1px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px;
      margin-bottom: 10px;
    }

    .stat-pill {
      background: var(--pill-bg);
      border: 1px solid var(--pill-border);
      border-radius: var(--radius-md);
      padding: 8px 10px;
    }

    .stat-value {
      font-size: 16px;
      font-weight: 800;
      color: var(--text-main);
      line-height: 1.1;
    }

    .stat-label {
      font-size: 9px;
      font-weight: 600;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-top: 3px;
    }

    .message-box {
      background: var(--pill-bg);
      border: 1px solid var(--pill-border);
      border-radius: var(--radius-md);
      padding: 8px 10px;
      font-size: 11px;
      color: var(--text-muted);
      line-height: 1.4;
    }

    .details-box {
      margin-top: 8px;
      max-height: 120px;
      overflow-y: auto;
      background: var(--pill-bg);
      border: 1px solid var(--pill-border);
      border-radius: var(--radius-md);
      padding: 8px;
      font-size: 9.5px;
      font-family: monospace;
      color: var(--text-main);
      white-space: pre-wrap;
      line-height: 1.4;
    }

    .footer {
      text-align: center;
      font-size: 9.5px;
      color: var(--text-dim);
      padding: 6px 0;
    }

    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes resultIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  </style>
</head>
<body>

  <div class="app-container">
    <!-- Top Header -->
    <div class="header">
      <div class="brand-group">
        <div class="brand-icon-wrapper">📋</div>
        <div class="brand-titles">
          <h1>Sheet Manager</h1>
          <p>Control Panel</p>
        </div>
      </div>
      
      <div class="header-controls">
        <button id="themeToggle" class="theme-toggle-btn" onclick="toggleTheme()" title="Toggle Dark/Light Theme">
          🌙
        </button>
      </div>
    </div>

    <!-- Core Actions Card -->
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

    <!-- Maintenance Card -->
    <div class="glass-card">
      <div class="card-label">Maintenance</div>
      <div class="button-stack">
        <button class="btn btn-danger" onclick="run('clearProcessingStatus', this)">
          <span class="btn-icon">🧹</span>
          <span>Clear Status & Headers</span>
        </button>
      </div>
    </div>

    <!-- Working Progress Indicator -->
    <div id="working" class="working-box">
      <div class="spinner-ring"></div>
      <div class="working-text">
        <b id="workingText">Processing Request…</b>
        <span>Please keep sidebar open during execution.</span>
      </div>
    </div>

    <!-- Execution Results Dashboard -->
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

    <!-- Footer Note -->
    <div class="footer">
      Sheet Manager • Light & Dark Mode
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
