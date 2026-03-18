# LEASE ANALYSIS AGENT — NEXT.JS ARCHITECTURE
## Cantara Business Sale Readiness & M&A Advisory Portal

---

## OVERVIEW

The lease analysis feature is a self-contained module within the Cantara portal. It accepts one or more PDF uploads, streams the analysis from the Claude API, and renders a structured, flagged report. The architecture is designed for the Cantara portal's Next.js App Router setup.

---

## DIRECTORY STRUCTURE

```
app/
├── lease-analysis/
│   ├── page.tsx                        # Upload & analysis page (main route)
│   ├── loading.tsx                     # Route-level loading state
│   └── [reportId]/
│       └── page.tsx                    # Saved report view (optional, Phase 2)
│
api/
├── lease-analysis/
│   ├── analyze/
│   │   └── route.ts                    # POST — sends PDFs to Claude, streams response
│   └── reports/
│       └── route.ts                    # GET/POST — save & retrieve reports (Phase 2)
│
components/
├── lease-analysis/
│   ├── LeaseUploader.tsx               # Drag-and-drop / file picker, multi-PDF
│   ├── DocumentInventory.tsx           # Lists uploaded files with type labels
│   ├── AnalysisProgress.tsx            # Streaming progress indicator
│   ├── LeaseReport.tsx                 # Full report renderer (parent)
│   ├── report-sections/
│   │   ├── SnapshotTable.tsx           # Part 1 — summary table
│   │   ├── DetailedFindings.tsx        # Part 2 — section-by-section findings
│   │   ├── FlagAnalysis.tsx            # Part 3 — red/orange/green flags
│   │   ├── TransactionChecklist.tsx    # Part 4 — M&A checklist
│   │   └── DocumentInventoryReport.tsx # Part 5 — document inventory
│   └── ReportExportBar.tsx             # Export to PDF / copy buttons
│
lib/
├── lease-analysis/
│   ├── claude.ts                       # Claude API call, streaming handler
│   ├── pdf-to-base64.ts                # Client-side PDF → base64 conversion
│   ├── parse-report.ts                 # Parses streamed markdown into sections
│   └── types.ts                        # All TypeScript types for this module
│
hooks/
└── useLeaseAnalysis.ts                 # Orchestration hook (upload → stream → state)
```

---

## DATA FLOW

```
User uploads PDFs
        │
        ▼
LeaseUploader.tsx
  → validates file type (PDF only) and size (max 32MB per file, 5 files max)
  → converts each PDF to base64 using pdf-to-base64.ts (client-side, FileReader)
  → stores array of { name, base64, mediaType } in local state
        │
        ▼
useLeaseAnalysis.ts (hook)
  → on "Analyze" trigger, POSTs to /api/lease-analysis/analyze
  → opens ReadableStream from response
  → appends streamed text chunks to reportMarkdown state
  → tracks streaming status: idle | uploading | streaming | complete | error
        │
        ▼
/api/lease-analysis/analyze/route.ts
  → receives { documents: [{ name, base64, mediaType }] }
  → constructs Anthropic messages array (system prompt + user message with documents)
  → calls Anthropic SDK with stream: true, temperature: 0, model: claude-sonnet-4-20250514
  → pipes Anthropic stream → Next.js Response stream
        │
        ▼
useLeaseAnalysis.ts
  → as chunks arrive, updates reportMarkdown (useState)
  → parse-report.ts runs on complete markdown to extract structured sections
        │
        ▼
LeaseReport.tsx
  → receives parsed report object
  → renders each section component
  → ReportExportBar triggers PDF export or clipboard copy
```

---

## API ROUTE — `/api/lease-analysis/analyze/route.ts`

```typescript
// Method: POST
// Content-Type: application/json
// Body: { documents: LeaseDocument[] }
// Response: text/event-stream (streamed markdown)

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { LEASE_ANALYSIS_SYSTEM_PROMPT } from "@/lib/lease-analysis/prompt";

export const maxDuration = 300; // 5 min — large PDFs need time

export async function POST(req: NextRequest) {
  const { documents } = await req.json();

  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

  // Build the content array: one document block per PDF + instruction text
  const userContent = [
    ...documents.map((doc) => ({
      type: "document",
      source: {
        type: "base64",
        media_type: doc.mediaType, // "application/pdf"
        data: doc.base64,
      },
    })),
    {
      type: "text",
      text: `Please analyze the ${documents.length} lease document(s) provided above. 
             Produce the full analysis report as specified in your instructions. 
             Document names for reference: ${documents.map((d) => d.name).join(", ")}`,
    },
  ];

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
    temperature: 0,
    system: LEASE_ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  // Pipe Anthropic stream to Next.js Response
  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          controller.enqueue(new TextEncoder().encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Accel-Buffering": "no", // disables nginx buffering for true streaming
    },
  });
}
```

---

## TYPES — `/lib/lease-analysis/types.ts`

```typescript
export type AnalysisStatus = "idle" | "uploading" | "streaming" | "complete" | "error";

export interface LeaseDocument {
  name: string;
  base64: string;
  mediaType: "application/pdf";
  sizeBytes: number;
}

export interface LeaseReport {
  raw: string;                          // full streamed markdown
  snapshotTable: SnapshotRow[];
  detailedFindings: FindingSection[];
  redFlags: Flag[];
  orangeFlags: Flag[];
  greenFlags: Flag[];
  transactionChecklist: ChecklistItem[];
  documentInventory: DocumentInventoryItem[];
  generatedAt: string;                  // ISO timestamp
}

export interface SnapshotRow {
  field: string;
  finding: string;
  sourceSection: string;
}

export interface FindingSection {
  id: string;                           // e.g. "2.1", "2.5"
  title: string;
  content: string;                      // markdown string for this section
}

export interface Flag {
  issue: string;
  whyItMatters: string;
  sourceSection: string;
  recommendedAction?: string;           // red & orange only
}

export interface ChecklistItem {
  number: number;
  actionItem: string;
  priority: string;
  notes: string;
}

export interface DocumentInventoryItem {
  document: string;
  documentType: string;
  date: string;
  status: string;
}
```

---

## ORCHESTRATION HOOK — `/hooks/useLeaseAnalysis.ts`

```typescript
// Manages the full lifecycle: file state → API call → streaming → parsed report

export function useLeaseAnalysis() {
  const [documents, setDocuments] = useState<LeaseDocument[]>([]);
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [rawMarkdown, setRawMarkdown] = useState("");
  const [report, setReport] = useState<LeaseReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addDocuments = (files: File[]) => { /* validate + convert to base64 */ };
  const removeDocument = (index: number) => { /* splice from array */ };
  const clearAll = () => { /* reset all state */ };

  const analyze = async () => {
    setStatus("uploading");
    setRawMarkdown("");
    setReport(null);

    try {
      const res = await fetch("/api/lease-analysis/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents }),
      });

      if (!res.ok) throw new Error(await res.text());
      if (!res.body) throw new Error("No response body");

      setStatus("streaming");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setRawMarkdown(accumulated);
      }

      const parsed = parseReport(accumulated);
      setReport(parsed);
      setStatus("complete");

    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
      setStatus("error");
    }
  };

  return { documents, addDocuments, removeDocument, clearAll, analyze, status, rawMarkdown, report, error };
}
```

---

## REPORT PARSER — `/lib/lease-analysis/parse-report.ts`

```typescript
// Parses the streamed markdown into structured sections
// Uses heading markers (## PART 1, ## PART 2, etc.) as split points
// Falls back to rendering raw markdown if structure is not detected

export function parseReport(markdown: string): LeaseReport {
  const sections = splitBySections(markdown);
  return {
    raw: markdown,
    snapshotTable: parseSnapshotTable(sections["PART 1"] ?? ""),
    detailedFindings: parseDetailedFindings(sections["PART 2"] ?? ""),
    redFlags: parseFlags(sections["PART 3"] ?? "", "red"),
    orangeFlags: parseFlags(sections["PART 3"] ?? "", "orange"),
    greenFlags: parseFlags(sections["PART 3"] ?? "", "green"),
    transactionChecklist: parseChecklist(sections["PART 4"] ?? ""),
    documentInventory: parseDocumentInventory(sections["PART 5"] ?? ""),
    generatedAt: new Date().toISOString(),
  };
}
```

---

## KEY UI COMPONENTS

### `LeaseUploader.tsx`
- Drag-and-drop zone + file input (PDF only, max 5 files, max 32MB each)
- Shows file name, size, and a remove button per file
- Shows total document count and aggregate size
- Disabled while streaming

### `AnalysisProgress.tsx`
- Displays during streaming status
- Shows a pulsing indicator + character count of streamed content
- Section progress: parses incoming markdown for `## PART` headings to show which section is being generated ("Analyzing rent schedule...", "Checking assignment provisions...", etc.)

### `LeaseReport.tsx` (parent renderer)
- Tab navigation across the 5 parts: Snapshot | Findings | Flags | Checklist | Documents
- On mobile: accordion-style sections
- While still streaming: renders completed sections, shows skeleton for in-progress section
- "Jump to flags" shortcut button always visible

### `FlagAnalysis.tsx`
- Three columns (desktop) / three stacked cards (mobile): 🔴 Red | 🟡 Orange | 🟢 Green
- Each flag rendered as a card with Issue, Why It Matters, Source (clickable to jump to Findings section), Recommended Action
- Count badge on each column header (e.g., "🔴 4 Red Flags")

### `SnapshotTable.tsx`
- Clean two-column table with field labels in left column
- Source section cited in muted text below each finding
- "Not found" values shown in amber

### `ReportExportBar.tsx`
- "Export PDF" button → uses `window.print()` with print-specific CSS, or calls a `/api/lease-analysis/export` route that generates a PDF server-side (Phase 2)
- "Copy Markdown" button → copies raw markdown to clipboard
- "New Analysis" button → clears state and returns to uploader

---

## ENVIRONMENT VARIABLES

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
```

No other environment variables are required for the core analysis feature.

---

## VALIDATION RULES (CLIENT-SIDE)

| Rule | Value | Error Message |
|---|---|---|
| Accepted file types | PDF only | "Only PDF files are accepted" |
| Max file size | 32 MB per file | "File exceeds 32MB limit" |
| Max files | 5 per analysis | "Maximum 5 documents per analysis" |
| Min files | 1 | "Please upload at least one lease document" |
| Duplicate file name | Warn, allow | "A file with this name is already added" |

---

## STREAMING BEHAVIOR

- The API route streams Claude's response as plain text chunks
- The hook accumulates chunks into `rawMarkdown` state
- React re-renders on each chunk update — use `useDeferredValue` or throttle updates to every 500ms if performance is a concern on large analyses
- The report parser runs once on `status === "complete"`, not on every chunk
- During streaming, render the raw markdown in a `<ReactMarkdown>` component as a live preview below the progress indicator

---

## PERFORMANCE CONSIDERATIONS

| Concern | Approach |
|---|---|
| Large PDFs (10MB+) | Base64 conversion is synchronous on main thread — offload to Web Worker if UX is affected |
| Long streaming response (8000 tokens) | Throttle state updates to 500ms intervals during streaming |
| Multiple PDFs | Send all in a single API call (as multiple document blocks) — do not make sequential calls |
| Re-analysis | Always create a new stream — do not attempt to resume |
| Report caching | Store `rawMarkdown` in `sessionStorage` keyed by file hash so a page refresh doesn't lose the report (Phase 2) |

---

## PHASE 2 ADDITIONS (OUT OF SCOPE FOR INITIAL BUILD)

- Save reports to database (Supabase / Postgres) with `reportId`, associated to a client record in the portal
- `/lease-analysis/[reportId]` route to retrieve and display saved reports
- Side-by-side comparison view for multiple lease locations
- Section-level "Ask a follow-up question" input that sends a follow-up to Claude with the full report as context
- PDF export via server-side rendering (Puppeteer or React-PDF)
- Audit log of when report was generated and by whom

---

*Lease Analysis Agent — Next.js Architecture v1.0*
*Cantara Business Sale Readiness & M&A Advisory Portal*
*Developed by Babalilm AI FZ-LLC*
