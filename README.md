# 📱 Monthly Caller Sheet Manager

A high-performance **Google Apps Script** automation tool that automatically copies and sets up monthly tracking sheets for callers into their designated destination Google Spreadsheets based on a Master Control Sheet.

Featuring a modern **Glassmorphism UI Sidebar** supporting **Dark & Light Mode** directly embedded into Google Sheets.

---

## ✨ Features

- **🚀 Automated Sheet Creation**: Copies template sheets to multiple external caller spreadsheets in one click.
- **⚡ Safe Fast Copy**: Preserves full formatting, merged cells, formulas, freeze panes, data validations, and column widths using server-side sheet copy.
- **🔍 Safe Preview Mode**: Dry-run preview of upcoming operations before making changes.
- **🔄 Smart Retry**: Automatically filters and retries only previously failed rows.
- **🧹 Header & Status Maintenance**: Easily wipe status output columns without altering master data.
- **🎨 Glassmorphism Control Panel UI**:
  - Switch between **Dark Mode** & **Native Google Sheets Light Mode**.
  - Interactive status dashboard with real-time execution statistics.
  - Quick dismissible notifications with a `✕` close button.

---

## 📁 Repository Structure

```text
Monthly Sheet Manager/
├── Code.gs             # Server-side Google Apps Script logic & sheet operations
├── Sidebar.html        # Modern Glassmorphism UI (CSS/JS + Light/Dark theme)
├── appsscript.json     # Google Apps Script project manifest
├── README.md           # Documentation & Setup guide
└── .gitignore          # Git ignore rules
```

---

## 📊 Master Sheet Column Requirements

The Control Sheet automatically detects any sheet containing the required headers in Row 1:

| Column Header | Description | Optional / Required |
| :--- | :--- | :--- |
| `Caller Sheet URL` | Full URL or Hyperlink formula pointing to destination spreadsheet | **Required** |
| `Month` | Target sheet tab name (e.g. `Jan 2026`, `Feb 2026`) | **Required** |
| `Caller Name` | Name of the caller/agent | Optional |
| `TL Name` | Name of Team Leader | Optional |

> **Note:** The workbook **must contain a template tab named `Template`** which will be duplicated for each caller.

---

## ⚙️ Generated Output Columns

The script automatically appends and updates the following status columns:

- `Status`: Execution state (`⏳ PROCESSING`, `✅ CREATED`, `⏭ ALREADY EXISTS`, `❌ ERROR`)
- `Last Run`: Timestamp of execution
- `Created Sheet`: Clickable `=HYPERLINK()` pointing directly to the newly created tab
- `Error`: Full error message traceback if an operation fails

---

## 🚀 Setup & Installation

### Option A: Using Google Apps Script Editor (Manual)

1. Open your Google Spreadsheet.
2. Go to **Extensions** → **Apps Script**.
3. Create two files:
   - `Code.gs` (paste contents of [`Code.gs`](./Code.gs))
   - `Sidebar.html` (paste contents of [`Sidebar.html`](./Sidebar.html))
4. Save the project and refresh your Google Spreadsheet.
5. Click **📱 Monthly Sheet Manager** → **✨ Open Control Center** in the Google Sheets top menu.

### Option B: Using Clasp (Command Line)

```bash
# Install clasp globally if you haven't already
npm install -g @google/clasp

# Login to Google Account
clasp login

# Clone your existing Apps Script project into directory
clasp clone <scriptId>

# Push local changes to Google Apps Script
clasp push
```

---

## 📄 License

MIT License. Free for internal business automation and customized distribution.
