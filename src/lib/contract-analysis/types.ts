export type AnalysisStatus = "idle" | "uploading" | "streaming" | "complete" | "error";

export interface ContractDocument {
  name: string;
  base64: string;
  mediaType: "application/pdf";
  sizeBytes: number;
}

export interface ContractReport {
  raw: string;
  snapshotTable: SnapshotRow[];
  detailedFindings: FindingSection[];
  redFlags: Flag[];
  orangeFlags: Flag[];
  greenFlags: Flag[];
  documentInventory: DocumentInventoryItem[];
  transactionChecklist: ChecklistItem[];
  generatedAt: string;
}

export interface SnapshotRow {
  field: string;
  finding: string;
  sourceSection: string;
}

export interface FindingSection {
  id: string;
  title: string;
  content: string;
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
