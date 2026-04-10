import {
  LeaseReport,
  SnapshotRow,
  RentScheduleRow,
  FindingSection,
  Flag,
  DocumentInventoryItem
} from "./types";

export function parseReport(markdown: string): LeaseReport {
  const sections = splitBySections(markdown);
  
  return {
    raw: markdown,
    snapshotTable: parseSnapshotTable(sections["PART 1"] ?? ""),
    rentSchedule: parseRentSchedule(sections["PART 2"] ?? ""),
    detailedFindings: parseDetailedFindings(sections["PART 2"] ?? ""),
    redFlags: parseFlags(sections["PART 3"] ?? "", "red"),
    orangeFlags: parseFlags(sections["PART 3"] ?? "", "orange"),
    greenFlags: parseFlags(sections["PART 3"] ?? "", "green"),
    documentInventory: parseDocumentInventory(sections["PART 4"] ?? ""),
    generatedAt: new Date().toISOString(),
  };
}

function splitBySections(markdown: string): Record<string, string> {
  const parts: Record<string, string> = {};
  
  const extract = (start: string, end: string) => {
    const s = markdown.indexOf(start);
    const e = markdown.indexOf(end);
    if (s === -1) return "";
    const content = e === -1 ? markdown.slice(s + start.length) : markdown.slice(s + start.length, e);
    return content.trim();
  };

  parts["PART 1"] = extract("---START_PART1---", "---END_PART1---");
  parts["PART 2"] = extract("---START_PART2---", "---END_PART2---");
  parts["PART 3"] = extract("---START_PART3---", "---END_PART3---");
  parts["PART 4"] = extract("---START_PART4---", "---END_PART4---");

  return parts;
}

function parseMarkdownTable(text: string): string[][] {
  const lines = text.split("\n").filter(l => l.includes("|"));
  const rows: string[][] = [];
  for (const line of lines) {
    if (line.match(/^\|?[-|\s]+\|?$/)) continue; // ignore table header separator
    const cells = line.split("|").map(c => c.trim());
    
    if (cells[0] === "") cells.shift();
    if (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
    
    // Skip header rows
    const isHeader = cells.some(c => 
      c.toLowerCase() === "field" || 
      c.toLowerCase() === "key item" ||
      c.toLowerCase() === "finding" || 
      c.toLowerCase() === "source" ||
      c.toLowerCase() === "source section" ||
      c.toLowerCase() === "document" ||
      c.toLowerCase() === "document type"
    );
    if (isHeader) continue;
    
    if (cells.length > 0 && !cells.every(c => c === "" || c.match(/^-+$/))) {
      rows.push(cells);
    }
  }
  return rows;
}

function parseSnapshotTable(text: string): SnapshotRow[] {
  const rows = parseMarkdownTable(text);
  return rows.map(r => ({
    field: r[0] ?? "",
    finding: r[1] ?? "",
    sourceSection: r[2] ?? "",
  }));
}

function parseRentSchedule(text: string): RentScheduleRow[] {
  // Extract section 2.3 RENT from Part 2
  const sectionMatch = text.match(/### 2\.3\s+RENT[\s\S]*?(?=### 2\.\d|$)/i);
  if (!sectionMatch) return [];

  const section = sectionMatch[0];

  // Find the rent schedule table — look for table with Lease Year / Per Annum / Per Month headers
  const tableRegion = section.match(
    /\|[^\n]*(?:Lease\s*Year|Period|Year)[^\n]*\|[\s\S]*?(?=\n\n|\n(?!\|)|$)/i
  );
  if (!tableRegion) return [];

  const lines = tableRegion[0].split("\n").filter(l => l.includes("|"));
  const rows: RentScheduleRow[] = [];

  for (const line of lines) {
    if (line.match(/^\|?[-|\s]+\|?$/)) continue; // separator
    const cells = line.split("|").map(c => c.trim()).filter(c => c !== "");

    // Skip header row
    const isHeader = cells.some(c =>
      /lease\s*year|period|per\s*annum|per\s*month|months/i.test(c)
    );
    if (isHeader) continue;

    if (cells.length >= 3) {
      rows.push({
        leaseYear: cells[0] ?? "",
        months: cells[1] ?? "",
        perAnnum: cells.length >= 4 ? cells[2] ?? "" : "",
        perMonth: cells.length >= 4 ? cells[3] ?? "" : cells[2] ?? "",
      });
    }
  }

  return rows;
}

function parseDetailedFindings(text: string): FindingSection[] {
  const sections = text.split(/\n(?=### \d+\.\d+)/g).filter(s => s.trim());
  
  return sections.map(s => {
    const titleMatch = s.match(/### (\d+\.\d+)\s+([^\n]+)/);
    if (!titleMatch) return null;
    
    const id = titleMatch[1];
    const title = titleMatch[2].trim().replace(/\*\*+/g, "").trim();
    const content = s.replace(/### \d+\.\d+ [^\n]+\n/, "").trim();
    
    return { id, title, content };
  }).filter((s): s is FindingSection => s !== null);
}

function parseFlags(text: string, type: "red" | "orange" | "green"): Flag[] {
  let region = "";
  if (type === "red") {
    region = text.match(/🔴 RED FLAGS[\s\S]*?(?=🟡 ORANGE FLAGS|$)/i)?.[0] ?? "";
  } else if (type === "orange") {
    region = text.match(/🟡 ORANGE FLAGS[\s\S]*?(?=🟢 GREEN FLAGS|$)/i)?.[0] ?? "";
  } else if (type === "green") {
    region = text.match(/🟢 GREEN FLAGS[\s\S]*?$/i)?.[0] ?? "";
  }

  if (!region) return [];
  region = region.replace(/^.*(RED|ORANGE|GREEN)\s*FLAGS.*$/im, "").trim();

  // Optimized split to perfectly isolate items
  const items: string[] = [];
  const startRegex = /(?:\n|^)\s*(?:\*\*)?\s*Issue\s*(?:\*\*)?\s*:?\s*/gi;
  let match;
  let startIndices: number[] = [];
  while ((match = startRegex.exec(region)) !== null) {
      startIndices.push(match.index);
  }
  for (let i = 0; i < startIndices.length; i++) {
      const nextIndex = startIndices[i + 1] || region.length;
      items.push(region.substring(startIndices[i], nextIndex).trim());
  }

  return items.map(item => {
    const get = (label: string) => {
      const escapedLabel = label.replace(/[ \s&]+/g, "\\s*(?:&|and)?\\s*");
      // Aggressive capture until next marker or end
      const re = new RegExp(`(?:\\*\\*)?${escapedLabel}(?:\\*\\*)?(?::|\\*+)?\\s*([\\s\\S]*?)(?=\\n\\s*(?:\\*\\*)?(?:Issue|Why|Source|Quote)[a-z\\s&]*\\b|$)`, "i");
      let val = (item.match(re)?.[1] ?? "").trim();
      
      // Intensive cleanup of markdown noise (stars, multiple dashes, trailing pound signs)
      return val
        .replace(/\*\*/g, "")
        .replace(/###+/g, "")
        .replace(/---+/g, "")
        .replace(/^\s*[—:;]+\s*/g, "") 
        .replace(/\s*[—:;–]+\s*$/g, "")
        .trim();
    };
    
    return {
      issue: get("Issue"),
      whyItMatters: get("Why It Matters"),
      sourceSection: get("Source & Quote") || get("Source")
    };
  }).filter(i => i.issue);
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
