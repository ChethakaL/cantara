import { type SaleReadinessChecklistItem } from '@/lib/sale-readiness-checklist'

export function normalizeTitleKey(title: string): string {
  return String(title || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s*(?:🔴|🟡|🟢)\s*(?:RED|YELLOW|GREEN)?/gi, '')
    .replace(/^\*\*|\*\*$/g, '')
    .replace(/^#+\s*/, '')
    .replace(/^[-*]\s*/, '')
    .trim()
    .toLowerCase()
}

export function isItemApprovedInMarkdown(lineText: string): boolean {
  return /<!--\s*portal:\s*approved\s*-->/i.test(lineText)
}

export function isFlagTitleLine(lineText: string): boolean {
  const trimmed = String(lineText || '').trim()
  if (!trimmed) return false
  if (trimmed.length > 300) return false

  // Reject detail field lines
  const lower = trimmed.toLowerCase()
  if (
    lower.startsWith('what:') ||
    lower.startsWith('why:') ||
    lower.startsWith('impact:') ||
    lower.startsWith('impact on deal:') ||
    lower.startsWith('how:') ||
    lower.startsWith('owner:') ||
    lower.startsWith('- what:') ||
    lower.startsWith('- why:') ||
    lower.startsWith('- impact:') ||
    lower.startsWith('- impact on deal:') ||
    lower.startsWith('- how:') ||
    lower.startsWith('- owner:') ||
    lower.startsWith('* what:') ||
    lower.startsWith('* why:') ||
    lower.startsWith('* impact:') ||
    lower.startsWith('* impact on deal:') ||
    lower.startsWith('* how:') ||
    lower.startsWith('* owner:') ||
    lower.startsWith('- **what') ||
    lower.startsWith('**what') ||
    lower.startsWith('- **why') ||
    lower.startsWith('**why') ||
    lower.startsWith('- **impact') ||
    lower.startsWith('**impact') ||
    lower.startsWith('- **how') ||
    lower.startsWith('**how') ||
    lower.startsWith('- **owner') ||
    lower.startsWith('**owner')
  ) {
    return false
  }

  // Reject tables or numbered step items
  if (trimmed.startsWith('|') || /^\d+\.\s+/.test(trimmed)) {
    return false
  }

  // Must contain a flag indicator (🔴, 🟡, 🟢 or RED, YELLOW, GREEN)
  const hasFlag =
    trimmed.includes('🔴') ||
    trimmed.includes('🟡') ||
    trimmed.includes('🟢') ||
    /\bRED\b/i.test(trimmed) ||
    /\bYELLOW\b/i.test(trimmed) ||
    /\bGREEN\b/i.test(trimmed)

  return hasFlag
}

export function toggleItemApprovalInMarkdown(fullMarkdown: string, targetTitleKey: string): string {
  const lines = fullMarkdown.split('\n')
  let inFlagSection = false
  let changed = false

  const newLines = lines.map(line => {
    const trimmed = line.trim()
    if (trimmed.startsWith('## ')) {
      const lower = trimmed.toLowerCase()
      inFlagSection = lower.includes('red flag') || lower.includes('yellow flag') || lower.includes('green flag')
    }

    if (inFlagSection && isFlagTitleLine(line)) {
      const key = normalizeTitleKey(line)
      if (key && key === targetTitleKey && !changed) {
        changed = true
        const hasApproved = isItemApprovedInMarkdown(line)
        const cleanLine = line
          .replace(/<!--\s*portal:\s*(?:approved|excluded)\s*-->/gi, '')
          .trimEnd()
        if (hasApproved) {
          return `${cleanLine} <!-- portal: excluded -->`
        } else {
          return `${cleanLine} <!-- portal: approved -->`
        }
      }
    }
    return line
  })

  return newLines.join('\n')
}

function parseMarkdownSections(markdown: string): Array<{ title: string; content: string }> {
  const result: Array<{ title: string; content: string }> = []
  const lines = (markdown || '').replace(/\r\n/g, '\n').split('\n')
  let currentTitle = 'Overview'
  let currentContent: string[] = []

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+)/)
    if (h2Match) {
      if (currentContent.length > 0 || result.length > 0) {
        result.push({ title: currentTitle, content: currentContent.join('\n') })
      }
      currentTitle = h2Match[1].trim()
      currentContent = []
      continue
    }
    if (/^#\s+/.test(line)) continue
    currentContent.push(line)
  }
  if (currentContent.length > 0) {
    result.push({ title: currentTitle, content: currentContent.join('\n') })
  }

  return result
}

function filterFlagSectionToApprovedOnly(sectionContent: string): string {
  const lines = sectionContent.split('\n')
  const keptItems: string[][] = []
  let currentItemLines: string[] = []
  let currentItemApproved = false

  const flush = () => {
    if (currentItemLines.length > 0 && currentItemApproved) {
      keptItems.push(currentItemLines)
    }
    currentItemLines = []
    currentItemApproved = false
  }

  for (const line of lines) {
    if (isFlagTitleLine(line)) {
      flush()
      currentItemApproved = isItemApprovedInMarkdown(line)
      // Clean comment from the line for client viewing
      const cleanLine = line.replace(/<!--\s*portal:\s*(?:approved|excluded)\s*-->/gi, '').trimEnd()
      currentItemLines.push(cleanLine)
      continue
    }

    if (currentItemLines.length > 0) {
      currentItemLines.push(line)
    }
  }
  flush()

  if (!keptItems.length) return ''

  return keptItems.map(itemLines => itemLines.join('\n')).join('\n\n')
}

/**
 * Builds the client portal released roadmap markdown.
 * Strictly includes ONLY:
 * 1. Sale-Readiness Overview table
 * 2. Sale-Readiness Checklist table (with advisor-approved checklist items)
 * 3. Red Flag Action Items (advisor approved only)
 * 4. Yellow Flag Action Items (advisor approved only)
 * 5. Green Flag Action Items (advisor approved only, if any)
 */
export function buildClientReleasedRoadmapMarkdown(
  fullMarkdown: string,
  approvedChecklistItems: SaleReadinessChecklistItem[],
): string {
  const sections = parseMarkdownSections(fullMarkdown)
  const clientSections: Array<{ title: string; content: string }> = []

  for (const s of sections) {
    const title = s.title.toLowerCase().trim()

    if (title.includes('overview')) {
      clientSections.push(s)
      continue
    }

    if (title.includes('checklist')) {
      // Build checklist table with approved items only
      const checklistTable = [
        '| ✅ | Category | Item | Status | Action Needed |',
        '|----|----------|------|--------|---------------|',
        ...approvedChecklistItems.map(item =>
          `| ${item.clientCompleted ? '☑' : '☐'} | ${item.category} | ${item.item} | ${item.status || 'Open'} | ${item.actionNeeded} |`
        ),
      ].join('\n')
      clientSections.push({ title: 'Sale-Readiness Checklist', content: checklistTable })
      continue
    }

    if (title.includes('red flag') || title.includes('yellow flag') || title.includes('green flag')) {
      const approvedContent = filterFlagSectionToApprovedOnly(s.content)
      if (approvedContent.trim()) {
        clientSections.push({ title: s.title, content: approvedContent })
      }
      continue
    }
  }

  if (!clientSections.length) return fullMarkdown

  return clientSections.map(s => `## ${s.title}\n\n${s.content.trim()}`).join('\n\n')
}
