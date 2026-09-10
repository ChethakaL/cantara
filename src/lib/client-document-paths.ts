import { DOCUMENT_CATEGORIES, VALUATION_DOCS } from '@/lib/documentData'

export type DocPathMeta = { categoryTitle: string; documentName: string }

/** Same Category / Checklist Item layout used by Download-all ZIP and Drive sync. */
export function buildDocumentLookup(): Map<string, DocPathMeta> {
  const map = new Map<string, DocPathMeta>()
  for (const doc of VALUATION_DOCS) {
    map.set(doc.id, { categoryTitle: 'Business Valuation Documents', documentName: doc.name })
  }
  for (const category of DOCUMENT_CATEGORIES) {
    for (const doc of category.documents) {
      map.set(doc.id, { categoryTitle: category.title, documentName: doc.name })
    }
  }
  return map
}

export function sanitizePathPart(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 120) || 'untitled'
}

export function resolveClientUploadDrivePath(args: {
  documentId?: string | null
  fileName?: string | null
  lookup?: Map<string, DocPathMeta>
}): { category: string; checklistItem: string; fileName: string; relativePath: string } {
  const lookup = args.lookup ?? buildDocumentLookup()
  const meta = args.documentId ? lookup.get(args.documentId) : undefined
  const category = sanitizePathPart(meta?.categoryTitle || 'Other')
  const checklistItem = sanitizePathPart(meta?.documentName || args.documentId || 'Uncategorized')
  const fileName = sanitizePathPart(args.fileName || 'file')
  return {
    category,
    checklistItem,
    fileName,
    relativePath: `${category}/${checklistItem}/${fileName}`,
  }
}

/** All category + checklist folders that should exist for a full data-room scaffold. */
export function listDataRoomFolderPairs(): Array<{ category: string; checklistItem: string }> {
  const pairs: Array<{ category: string; checklistItem: string }> = []
  for (const doc of VALUATION_DOCS) {
    pairs.push({
      category: sanitizePathPart('Business Valuation Documents'),
      checklistItem: sanitizePathPart(doc.name),
    })
  }
  for (const category of DOCUMENT_CATEGORIES) {
    for (const doc of category.documents) {
      pairs.push({
        category: sanitizePathPart(category.title),
        checklistItem: sanitizePathPart(doc.name),
      })
    }
  }
  return pairs
}
