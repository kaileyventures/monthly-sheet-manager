<h1 align="center">Monthly Sheet Manager 📊</h1>

<p align="center">
  <img src="https://img.shields.io/badge/Google%20Apps%20Script-4285F4?style=flat&logo=google-apps-script&logoColor=white" alt="Google Apps Script" />
  <img src="https://img.shields.io/badge/Google%20Sheets-34A853?style=flat&logo=google-sheets&logoColor=white" alt="Google Sheets" />
  <img src="https://img.shields.io/badge/UI-Glassmorphism-38bdf8?style=flat" alt="Glassmorphism UI" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg?style=flat" alt="License" />
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat" alt="PRs Welcome" />
</p>

<p align="center">
  A high-performance Google Apps Script automation tool and control center sidebar designed to streamline monthly caller sheet generation across distributed spreadsheets.
</p>

---

## ⚡ Workflow Architecture

```mermaid
flowchart TD
    classDef startNode fill:#2563eb,stroke:#1d4ed8,color:#ffffff,stroke-width:2px;
    classDef actionNode fill:#0284c7,stroke:#0369a1,color:#ffffff,stroke-width:2px;
    classDef decisionNode fill:#f59e0b,stroke:#d97706,color:#ffffff,stroke-width:2px;
    classDef successNode fill:#10b981,stroke:#059669,color:#ffffff,stroke-width:2px;
    classDef errorNode fill:#f43f5e,stroke:#e11d48,color:#ffffff,stroke-width:2px;

    Start(["📱 User Opens Google Sheet Control Center"]) :::startNode
    Start --> Trigger{"Choose Workflow Action"} :::decisionNode

    Trigger -->|"🚀 Create Monthly Sheets"| FetchData["Read Control Sheet Rows & URLs"] :::actionNode
    Trigger -->|"🔍 Safe Preview"| DryRun["Dry Run Validation & Sheet Check"] :::actionNode
    Trigger -->|"🔄 Retry Failed Rows"| FilterError["Filter Rows with ❌ ERROR Status"] :::actionNode
    Trigger -->|"🧹 Clear Status"| ClearLogs["Reset Status Columns & Headers"] :::actionNode

    FetchData --> LockCheck{"Script Lock Acquired?"} :::decisionNode
    FilterError --> LockCheck

    LockCheck -->|"No"| BusyWarn["⚠️ Return Already Running Warning"] :::errorNode
    LockCheck -->|"Yes"| LoopRows["Iterate Rows (Month & URL)"] :::actionNode

    LoopRows --> ValCheck{"Valid URL & Sheet Name?"} :::decisionNode
    ValCheck -->|"No"| MarkErr["❌ Update Status: ERROR"] :::errorNode
    ValCheck -->|"Yes"| TargetCheck{"Target Month Sheet Exists?"} :::decisionNode

    TargetCheck -->|"Yes"| ExistLink["⏭ Mark ALREADY EXISTS & Set Link"] :::successNode
    TargetCheck -->|"No"| CopySheet["Copy Template Sheet to Target Spreadsheet"] :::actionNode

    CopySheet --> VerifySheet{"Sheet Created & Verified?"} :::decisionNode
    VerifySheet -->|"Success"| MarkCreated["✅ Mark CREATED & Add Hyperlink"] :::successNode
    VerifySheet -->|"Failure"| MarkErr

    DryRun --> DisplayPreview["📊 Display Summary & Detailed Card"] :::successNode
    ClearLogs --> StatusReset["✨ Status & Header Cleared"] :::successNode
```

---

## 🌟 Key Features

- **🚀 Automated Monthly Sheet Duplication**: Automatically clones a predefined `Template` sheet to target spreadsheets listed in the control sheet.
- **💎 Ultra-Modern Glassmorphism UI**: High-end glass-styled control panel sidebar with smooth backdrop blurs and glowing accents.
- **☀️ Light & 🌙 Dark Mode Support**: Dynamic theme toggle supporting a native Google Sheets light mode and midnight dark mode.
- **🔍 Safe Execution Preview**: Dry-run mode to inspect expected sheet creations and validate URLs before modifying target spreadsheets.
- **🔄 Smart Error Handling & Retry**: Built-in lock mechanism, status tracking per row, and 1-click retry for failed rows.
- **🧹 Status Cleanup**: 1-click feature to reset execution logs, status headers, and status values.

---

## 📂 Project Architecture & File Structure

```
monthly-sheet-manager/
├── Code.gs                   # Single-file bundled Google Apps Script (Ready to paste in Editor)
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

### Option A: Single-File Setup (⚡ Recommended & Quickest)
If you prefer pasting everything into a single file without managing HTML files:
1. Open your Master Google Sheet.
2. Go to **Extensions** → **Apps Script**.
3. Clear the default code in `Code.gs` and copy-paste the entire contents of [`Code.gs`](./Code.gs).
4. Save (💾) and refresh your Google Sheet.

### Option B: Multi-File Setup
If you prefer keeping separate files in Apps Script:
1. Copy [`src/core/Config.gs`](./src/core/Config.gs) content to `Config.gs`.
2. Copy [`src/services/SheetProcessor.gs`](./src/services/SheetProcessor.gs) content to `SheetProcessor.gs`.
3. Copy [`src/utils/SheetUtils.gs`](./src/utils/SheetUtils.gs) content to `SheetUtils.gs`.
4. Create an HTML file named `Sidebar` in the Apps Script editor and copy [`src/ui/Sidebar.html`](./src/ui/Sidebar.html) content.

---

## 📄 License
This project is licensed under the [MIT License](./LICENSE).
