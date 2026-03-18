import { 
  LeaseReport, 
  SnapshotRow, 
  FindingSection, 
  Flag, 
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
    documentInventory: parseDocumentInventory(sections["PART 5"] ?? ""),
    generatedAt: new Date().toISOString(),
  };
}

function splitBySections(markdown: string): Record<string, string> {
  const parts: Record<string, string> = {};
  
  const getSection = (startMarker: RegExp, endMarker?: RegExp) => {
    const startMatch = markdown.match(startMarker);
    if (!startMatch) return "";
    
    const startIndex = startMatch.index!;
    if (!endMarker) return markdown.substring(startIndex).trim();
    
    const remainder = markdown.substring(startIndex + startMatch[0].length);
    const endMatch = remainder.match(endMarker);
    
    if (endMatch) {
      return markdown.substring(startIndex, startIndex + startMatch[0].length + endMatch.index!).trim();
    }
    return markdown.substring(startIndex).trim();
  };

  parts["PART 1"] = getSection(/PART 1[^\n]*\n/i, /PART 2[^\n]*\n/i);
  parts["PART 2"] = getSection(/PART 2[^\n]*\n/i, /PART 3[^\n]*\n/i);
  parts["PART 3"] = getSection(/PART 3[^\n]*\n/i, /PART 5[^\n]*\n/i);
  parts["PART 5"] = getSection(/PART 5[^\n]*\n/i);

  return parts;
}

function parseMarkdownTable(text: string): string[][] {
  const lines = text.split("\n").filter(l => l.includes("|"));
  const rows: string[][] = [];
  for (const line of lines) {
    if (line.match(/^\|?[-|\s]+\|?$/)) continue; // separator row
    const cells = line.split("|").map(c => c.trim());
    
    if (cells[0] === "") cells.shift();
    if (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
    
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
  const sections = text.split(/(?=(?:### )?\d+\.\d+ )/g).filter(s => s.trim());
  
  return sections.map(s => {
    const titleMatch = s.match(/(?:### )?(\d+\.\d+) (.+?)(?:\n|$)/);
    if (!titleMatch) return null;
    
    return {
      id: titleMatch[1] ?? "",
      title: titleMatch[2]?.trim() ?? "",
      content: s.replace(/(?:### )?\d+\.\d+ .+\n/, "").trim(),
    };
  }).filter(Boolean) as FindingSection[];
}

function parseFlags(text: string, type: "red" | "orange" | "green"): Flag[] {
  const parseSection = (sectionText: string) => {
    // Split by variations of "Issue:" or "**Issue:**"
    const items = sectionText.split(/(?=\*\*?Issue\*\*?:?|\*\*?ISSUE\*\*?:?|Issue:?)/i).filter(s => s.trim().length > 15);
    
    return items.map(item => {
      const get = (label: string) => {
        const escapedLabel = label.replace(/ /g, "\\s*");
        // Look for "**Label:** Value" or "Label: Value"
        const re = new RegExp(`(?:\\*\\*)?${escapedLabel}(?:\\*\\*)?(?::)?\\s*([^\\n]+(?:\\n(?!\\s*(?:\\*\\*)?(?:Issue|Why|Source)[a-z\\s]*\\b(?:\\*\\*)?(?::)?)[^\\n]*)*)`, "i");
        return (item.match(re)?.[1] ?? "").trim();
      };
      
      const issue = get("ISSUE").replace(/^\*\*(.*?)\*\*$/, '$1').trim();
      const whyItMatters = get("WHY IT MATTERS").replace(/^\*\*(.*?)\*\*$/, '$1').trim();
      const sourceSection = get("SOURCE").replace(/^\*\*(.*?)\*\*$/, '$1').trim();
      
      return { issue, whyItMatters, sourceSection };
    }).filter(i => i.issue);
  };

  let section = "";
  if (type === "red") {
    section = text.match(/(?:### )?🔴 RED FLAGS[\s\S]*?(?=(?:### )?🟡|$)/i)?.[0] ?? "";
  } else if (type === "orange") {
    section = text.match(/(?:### )?🟡 ORANGE FLAGS[\s\S]*?(?=(?:### )?🟢|$)/i)?.[0] ?? "";
  } else if (type === "green") {
    section = text.match(/(?:### )?🟢 GREEN FLAGS[\s\S]*?(?=(?:PART 5|$))/i)?.[0] ?? "";
  }

  return parseSection(section);
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
