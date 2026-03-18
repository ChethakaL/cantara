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
  transactionChecklist?: ChecklistItem[];
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
