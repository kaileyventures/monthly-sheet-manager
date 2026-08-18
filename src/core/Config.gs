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
    .createHtmlOutputFromFile("src/ui/Sidebar")
    .setTitle("Sheet Manager");

  SpreadsheetApp
    .getUi()
    .showSidebar(html);
}
