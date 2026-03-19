import {
  ChecklistItem,
  ContractReport,
  DocumentInventoryItem,
  FindingSection,
  Flag,
  SnapshotRow,
} from "./types";

export function parseReport(markdown: string): ContractReport {
  const sections = splitBySections(markdown);

  return {
    raw: markdown,
    snapshotTable: parseSnapshotTable(sections["PART 1"] ?? ""),
    detailedFindings: parseDetailedFindings(sections["PART 2"] ?? ""),
    redFlags: parseFlags(sections["PART 3"] ?? "", "red"),
    orangeFlags: parseFlags(sections["PART 3"] ?? "", "orange"),
    greenFlags: parseFlags(sections["PART 3"] ?? "", "green"),
    documentInventory: parseDocumentInventory(sections["PART 4"] ?? ""),
    transactionChecklist: parseChecklist(sections["PART 5"] ?? ""),
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
  parts["PART 5"] = extract("---START_PART5---", "---END_PART5---");

  return parts;
}

function parseMarkdownTable(text: string): string[][] {
  const lines = text.split("\n").filter((line) => line.includes("|"));
  const rows: string[][] = [];

  for (const line of lines) {
    if (line.match(/^\|?[-|\s]+\|?$/)) continue;
    const cells = line.split("|").map((cell) => cell.trim());

    if (cells[0] === "") cells.shift();
    if (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();

    const isHeader = cells.some((cell) => {
      const lower = cell.toLowerCase();
      return (
        lower === "field" ||
        lower === "finding" ||
        lower === "source section" ||
        lower === "#" ||
        lower === "contract" ||
        lower === "contract type" ||
        lower === "counterparty" ||
        lower === "effective date" ||
        lower === "expiration date" ||
        lower === "auto-renewal?" ||
        lower === "current status" ||
        lower === "type" ||
        lower === "execution status" ||
        lower === "document" ||
        lower === "document type" ||
        lower === "number" ||
        lower === "action item" ||
        lower === "priority" ||
        lower === "notes"
      );
    });

    if (isHeader) continue;

    if (cells.length > 0 && !cells.every((cell) => cell === "" || cell.match(/^-+$/))) {
      rows.push(cells);
    }
  }

  return rows;
}

function parseSnapshotTable(text: string): SnapshotRow[] {
  const rows = parseMarkdownTable(text);

  return rows.map((row, index) => {
    if (row.length >= 7) {
      const contractNumber = row[0] || `#${index + 1}`;
      const contractType = row[1] || "Unknown contract";
      const counterparty = row[2] || "Unknown counterparty";
      const effectiveDate = row[3] || "Not found";
      const expirationDate = row[4] || "Not found";
      const autoRenewal = row[5] || "Unknown";
      const currentStatus = row[6] || "Unknown";

      return {
        field: `${contractNumber} ${contractType}`.trim(),
        finding: `${counterparty} | Effective: ${effectiveDate} | Expiration: ${expirationDate} | Auto-Renewal: ${autoRenewal}`,
        sourceSection: `Status: ${currentStatus}`,
      };
    }

    return {
      field: row[0] ?? "",
      finding: row[1] ?? "",
      sourceSection: row[2] ?? "",
    };
  });
}

function parseDetailedFindings(text: string): FindingSection[] {
  const sections = text
    .split(/\n(?=###\s+(?:\d+\.\d+|CONTRACT\s+\[\d+\]:))/g)
    .filter((section) => section.trim());

  return sections
    .map((section) => {
      const numberedMatch = section.match(/### (\d+\.\d+)\s+([^\n]+)/);
      if (numberedMatch) {
        return {
          id: numberedMatch[1],
          title: numberedMatch[2].trim().replace(/\*\*+/g, "").trim(),
          content: section.replace(/### \d+\.\d+ [^\n]+\n/, "").trim(),
        };
      }

      const contractMatch = section.match(/###\s+CONTRACT\s+\[(\d+)\]:\s+([^\n]+)/i);
      if (!contractMatch) return null;

      return {
        id: `C${contractMatch[1]}`,
        title: contractMatch[2].trim().replace(/\*\*+/g, "").trim(),
        content: section.replace(/###\s+CONTRACT\s+\[\d+\]:\s+[^\n]+\n/i, "").trim(),
      };
    })
    .filter((section): section is FindingSection => section !== null);
}

function parseFlags(text: string, type: "red" | "orange" | "green"): Flag[] {
  let region = "";
  if (type === "red") {
    region = text.match(/🔴 RED FLAGS[\s\S]*?(?=🟡 ORANGE FLAGS|$)/i)?.[0] ?? "";
  } else if (type === "orange") {
    region = text.match(/🟡 ORANGE FLAGS[\s\S]*?(?=🟢 GREEN FLAGS|$)/i)?.[0] ?? "";
  } else {
    region = text.match(/🟢 GREEN FLAGS[\s\S]*?$/i)?.[0] ?? "";
  }

  if (!region) return [];
  region = region.replace(/^.*(RED|ORANGE|GREEN)\s*FLAGS.*$/im, "").trim();

  const items: string[] = [];
  const startRegex = /(?:\n|^)\s*(?:\*\*)?\s*Issue\s*(?:\*\*)?\s*:?\s*/gi;
  let match: RegExpExecArray | null;
  const startIndices: number[] = [];

  while ((match = startRegex.exec(region)) !== null) {
    startIndices.push(match.index);
  }

  for (let i = 0; i < startIndices.length; i += 1) {
    const nextIndex = startIndices[i + 1] || region.length;
    items.push(region.substring(startIndices[i], nextIndex).trim());
  }

  return items
    .map((item) => {
      const get = (label: string) => {
        const escapedLabel = label.replace(/[ \s&]+/g, "\\s*(?:&|and)?\\s*");
        const re = new RegExp(
          `(?:\\*\\*)?${escapedLabel}(?:\\*\\*)?(?::|\\*+)?\\s*([\\s\\S]*?)(?=\\n\\s*(?:\\*\\*)?(?:Issue|Why|Source|Quote)[a-z\\s&]*\\b|$)`,
          "i",
        );

        return ((item.match(re)?.[1] ?? "") as string)
          .trim()
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
        sourceSection: get("Contract & Source") || get("Source & Quote") || get("Source"),
      };
    })
    .filter((item) => item.issue);
}

function parseDocumentInventory(text: string): DocumentInventoryItem[] {
  return parseMarkdownTable(text).map((row) => {
    if (row.length >= 5) {
      return {
        document: row[1] ? `${row[0]} (${row[1]})` : row[0] ?? "",
        documentType: row[2] ?? "",
        date: row[3] ?? "",
        status: row[4] ?? "",
      };
    }

    return {
      document: row[0] ?? "",
      documentType: row[1] ?? "",
      date: row[2] ?? "",
      status: row[3] ?? "",
    };
  });
}

function parseChecklist(text: string): ChecklistItem[] {
  return parseMarkdownTable(text).map((row) => ({
    number: Number.parseInt(row[0] ?? "", 10) || 0,
    actionItem: row[1] ?? "",
    priority: row[2] ?? "",
    notes: row[3] ?? "",
  }));
}
