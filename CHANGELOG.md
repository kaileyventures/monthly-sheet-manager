# Changelog

All notable changes to this project will be documented in this file.

## [1.5.0] - 2026-08-18

### Fixed
- **Uninterrupted Batch Execution**: Added `refreshSafetyTimer()` which auto-resets the idle safety timeout (90s) on every batch chunk completion, preventing premature execution cutoff mid-run (e.g. at row 6-7).

### Added
- **Formatted ETA (Minutes & Seconds)**: Updated progress remaining time display (`formatEta`) to convert times >60 seconds into formatted minutes and seconds (`⏱️ ~10m 57s remaining` / `⏱️ ~2m remaining`).
- **Adaptive Batch Chunking**: Optimized execution speed by processing 5 rows per batch chunk for Safe Preview and 2 rows per chunk for Sheet Creation, reducing RPC network overhead by 80%.

## [1.4.0] - 2026-08-18

### Added
- **Interactive Stat Pill Filters**: Stat summary pills (`CREATED`, `ALREADY EXISTS`, `SKIPPED`, `ERRORS`) now act as interactive filter controls with active glowing selection feedback (`.stat-pill.active-filter`).
- **Modern TSV Copy-to-Clipboard**: Compact SVG clipboard button that formats log output into Tab-Separated Values (TSV) for direct paste into Microsoft Excel or Google Sheets, with animated checkmark feedback.
- **Custom Modern Slim Scrollbars**: Custom 5px ultra-slim glassmorphic scrollbars (`::-webkit-scrollbar`) with theme-adaptive hover glows.
- **Graphify Codebase Knowledge Graph**: Added full AST extraction and visualization for `.gs` and `.html` files in [`graphify-out/graphify.html`](./graphify-out/graphify.html).

### Fixed
- **Skipped Rows Log Generation**: Updated `previewMonthlySheetsBatch_`, `previewMonthlySheets`, and `processRows_` to push log detail entries (`Row X → MONTH BLANK → SKIPPED` / `Row X → URL BLANK → SKIPPED`) so filtering by `SKIPPED` displays accurate log lines.

## [1.3.0] - 2026-08-18

### Added
- **Realtime 0-100% Progress Bar with ETA**: Replaced generic circular loader in the sidebar UI with a glassmorphism real-time progress bar that displays percentage (0-100%), current row status, and dynamic remaining time (ETA).

## [1.2.0] - 2026-08-18

### Added
- **Auto-Open Sidebar on Sheet Load**: Updated `onOpen()` in `Code.gs` to automatically launch the Control Center sidebar panel when the Google Sheet is opened or refreshed, removing extra menu clicks.

## [1.1.0] - 2026-08-18

### Changed
- **Branding Update**: Updated control center sidebar title and footer to **MIS Control Center • K41L3Y**.

## [1.0.0] - 2026-08-18

### Added
- **Glassmorphism UI**: MIS Control Center sidebar with ultra-modern frosted glass cards and glowing accents.
- **Adaptive Light & Dark Mode**: Added native Google Sheets Light theme and Midnight Dark theme toggle.
- **Core Automation**:
  - Safe monthly sheet creation across external spreadsheets.
  - Dry-run Safe Preview mode.
  - Smart Retry mechanism for failed rows.
  - Status & header clear maintenance workflow.
- **Single-File & Multi-File Architecture**: Single-file bundled `Code.gs` for instant copy-paste along with modular `src/` directory.
