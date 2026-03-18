import { 
  LeaseReport, 
  SnapshotRow, 
  FindingSection, 
  Flag, 
  ChecklistItem, 
  DocumentInventoryItem 
} from "./types";

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

function splitBySections(markdown: string): Record<string, string> {
  const parts: Record<string, string> = {};
  
  const extract = (start: string, end: string) => {
    const s = markdown.indexOf(start);
    const e = markdown.indexOf(end);
    if (s === -1 || e === -1) return "";
    return markdown.slice(s + start.length, e).trim();
  };

  parts["PART 1"] = extract("---START_PART1---", "---END_PART1---");
  parts["PART 2"] = extract("---START_PART2---", "---END_PART2---");
  parts["PART 3"] = extract("---START_PART3---", "---END_PART3---");
  parts["PART 4"] = extract("---START_PART4---", "---END_PART4---");
  parts["PART 5"] = extract("---START_PART5---", "---END_PART5---");

  return parts;
}

function parseMarkdownTable(text: string): string[][] {
  const lines = text.split("\n").filter(l => l.includes("|"));
  const rows: string[][] = [];
  for (const line of lines) {
    if (line.match(/^\|[-|\s]+\|$/)) continue; // separator row
    const cells = line.split("|").map(c => c.trim()).filter((_, i, a) => i > 0 && i < a.length - 1);
    if (cells.length > 0 && !cells.every(c => c === "" || c.match(/^-+$/))) {
      rows.push(cells);
    }
  }
  return rows.slice(1); // skip header
}

function parseSnapshotTable(text: string): SnapshotRow[] {
  const rows = parseMarkdownTable(text);
  return rows.map(r => ({
    field: r[0] ?? "",
    finding: r[1] ?? "",
    sourceSection: r[2] ?? "",
  }));
}

function parseDetailedFindings(text: string): FindingSection[] {
  const sections = text.split(/(?=### \d+\.\d+)/g).filter(s => s.trim());
  return sections.map(s => {
    const titleMatch = s.match(/### (\d+\.\d+) (.+)/);
    return {
      id: titleMatch?.[1] ?? "",
      title: titleMatch?.[2] ?? "",
      content: s.replace(/### \d+\.\d+ .+\n/, "").trim(),
    };
  });
}

function parseFlags(text: string, type: "red" | "orange" | "green"): Flag[] {
  const parseSection = (sectionText: string) => {
    const items = sectionText.split(/(?=\*\*ISSUE:\*\*)/g).filter(s => s.trim());
    return items.map(item => {
      const get = (label: string) => {
        const re = new RegExp(`\\*\\*${label}:\\*\\*\\s*([^\\*\\n]+(?:\\n(?!\\*\\*)[^\\n]*)*)`, "i");
        return (item.match(re)?.[1] ?? "").trim();
      };
      return {
        issue: get("ISSUE"),
        whyItMatters: get("WHY IT MATTERS"),
        sourceSection: get("SOURCE"),
        recommendedAction: get("ACTION"),
      };
    }).filter(i => i.issue);
  };

  let section = "";
  if (type === "red") {
    section = text.match(/### 🔴 RED FLAGS([\s\S]*?)(?=### 🟡|$)/)?.[1] ?? "";
  } else if (type === "orange") {
    section = text.match(/### 🟡 ORANGE FLAGS([\s\S]*?)(?=### 🟢|$)/)?.[1] ?? "";
  } else if (type === "green") {
    section = text.match(/### 🟢 GREEN FLAGS([\s\S]*?)$/)?.[1] ?? "";
  }

  return parseSection(section);
}

function parseChecklist(text: string): ChecklistItem[] {
  const rows = parseMarkdownTable(text);
  return rows.map((r, i) => ({
    number: i + 1,
    actionItem: r[1] ?? "",
    priority: r[2] ?? "",
    notes: r[3] ?? "",
  }));
}

function parseDocumentInventory(text: string): DocumentInventoryItem[] {
  const rows = parseMarkdownTable(text);
  return rows.map(r => ({
    document: r[0] ?? "",
    documentType: r[1] ?? "",
    date: r[2] ?? "",
    status: r[3] ?? "",
  }));
}
