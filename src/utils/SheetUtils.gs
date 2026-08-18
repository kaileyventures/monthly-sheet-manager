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
   STATUS UPDATERS & HELPERS
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
