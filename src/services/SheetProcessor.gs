/* =========================================================
   CORE WORKFLOWS (CREATE, PREVIEW, RETRY, CLEAR)
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
