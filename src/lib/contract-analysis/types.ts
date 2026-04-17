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
  contractRiskCards: ContractRiskCard[];
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
  contractName?: string;
  riskLevel?: "red" | "orange" | "green";
  issue: string;
  whyItMatters: string;
  sourceSection: string;
  suggestedAction?: string;
}

export interface ContractRiskCard {
  contractId: string;
  contractName: string;
  riskTier: string;
  recommendedAction: string;
  redFlags: Flag[];
  orangeFlags: Flag[];
  greenFlags: Flag[];
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
