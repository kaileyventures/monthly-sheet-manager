# Monthly Sheet Manager 📊

A high-performance Google Apps Script automation tool and control center sidebar designed to streamline monthly caller sheet generation across distributed spreadsheets.

---

## 🌟 Key Features

- **🚀 Automated Monthly Sheet Duplication**: Automatically clones a predefined `Template` sheet to target spreadsheets listed in the control sheet.
- **💎 Ultra-Modern Glassmorphism UI**: High-end glass-styled control panel sidebar with smooth backdrop blurs and glowing accents.
- **☀️ Light & 🌙 Dark Mode Support**: Dynamic theme toggle supporting a native Google Sheets light mode and midnight dark mode.
- **🔍 Safe Execution Preview**: Dry-run mode to inspect expected sheet creations and validate URLs before modifying target spreadsheets.
- **🔄 Smart Error Handling & Retry**: Built-in lock mechanism, status tracking per row, and 1-click retry for failed rows.
- **🧹 Status Cleanup**: 1-click feature to reset execution logs, status headers, and status values.

---

## 📂 Project Architecture & Modules

```
Monthly Sheet Manager/
├── Code.gs                   # Single-file bundled Google Apps Script (Editor Ready)
├── appsscript.json           # Apps Script Manifest file
├── README.md                 # Project Overview & Quickstart Guide
├── CONTRIBUTING.md           # Guidelines for contributing
├── CHANGELOG.md              # Revision history & updates
├── LICENSE                   # MIT License
└── src/                      # Modular Architecture (Source Files)
    ├── core/
    │   └── Config.gs         # Constants, Header mapping, Menu & Sidebar triggers
    ├── services/
    │   └── SheetProcessor.gs # Core business logic (Create, Preview, Retry, Clear)
    ├── utils/
    │   └── SheetUtils.gs     # Sheet locators, URL parsers & row status updaters
    └── ui/
        └── Sidebar.html      # Glassmorphic HTML5/CSS3/JS UI Sidebar
```

---

## 🚀 Quickstart & Setup Guide

### 1. Copying Code to Google Sheets (Single-File)
If you prefer pasting everything into a single Apps Script file:
1. Open your Master Google Sheet.
2. Go to **Extensions** → **Apps Script**.
3. Clear the default code and copy-paste the entire contents of [`Code.gs`](./Code.gs).
4. Save the project and refresh your Google Sheet.

### 2. Multi-File / Clasp Setup
If you deploy via `clasp` or multi-file setup:
- Use the modular source files inside the `src/` directory.

---

## 📄 License
This project is licensed under the [MIT License](./LICENSE).
