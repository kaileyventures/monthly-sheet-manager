# Graph Report - .  (2026-08-18)

## Corpus Check
- 67 files · ~8,000 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 67 nodes · 94 edges · 8 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 1
- Community 2
- Community 3
- Community 4

## God Nodes (most connected - your core abstractions)
1. `onOpen()` - 2 edges
2. `openManagerPanel()` - 2 edges
3. `findControlSheet_()` - 2 edges
4. `findHeaderColumn_()` - 2 edges
5. `ensureHeaderColumn_()` - 2 edges
6. `setStatus_()` - 2 edges
7. `setError_()` - 2 edges
8. `setCreatedLink_()` - 2 edges
9. `createMonthlySheetsSafe()` - 2 edges
10. `processRows_()` - 2 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (8 total, 0 thin omitted)

### Community 1 - "Community 1"
Cohesion: 0.23
Nodes (14): closeResults(), copyDetailsToClipboard(), escapeHtml(), fallbackCopyText(), filterDetails(), onCopySuccess(), processNextBatch(), resetBusyState() (+6 more)

### Community 2 - "Community 2"
Cohesion: 0.15
Nodes (12): buildSheetUrl_(), ensureHeaderColumn_(), extractSpreadsheetId_(), findControlSheet_(), findHeaderColumn_(), getSheetUrl_(), isDuplicateSheetError_(), isValidSheetName_() (+4 more)

### Community 3 - "Community 3"
Cohesion: 0.19
Nodes (7): clearProcessingStatus(), createMonthlySheetsSafe(), onOpen(), openManagerPanel(), previewMonthlySheets(), processRows_(), retryFailedRows()

### Community 4 - "Community 4"
Cohesion: 0.48
Nodes (5): esc(), focusNode(), showInfo(), toggleAllCommunities(), updateSelectAllState()

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `onOpen()` connect `Community 3` to `Community 0`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `openManagerPanel()` connect `Community 3` to `Community 0`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `createMonthlySheetsSafe()` connect `Community 3` to `Community 0`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._