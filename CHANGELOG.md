# Changelog

All notable changes to this project will be documented in this file.

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

