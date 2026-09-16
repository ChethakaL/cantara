import { prisma } from '@/lib/prisma'

export type VendorDirectoryItem = {
  id: string
  name: string
  vendor: string
  category: string
  annualCost: number
  contractStatus: string
  transferable: 'yes' | 'no' | 'unknown' | string
  loginAccess: string
  notes: string
}

type ExtractedVendor = {
  name: string
  category: string
  annualCost: number
  contractStatus: string
  contractType: string
}

const REMOVED_KEY = 'vendorDirectoryRemoved'

function normalizeVendorName(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function vendorMatchKey(item: { name?: string; vendor?: string }): string {
  return normalizeVendorName(item.name) || normalizeVendorName(item.vendor)
}

/** Extract candidate vendor rows from a Material Contracts parsed report. */
export function extractVendorsFromContractReport(parsed: any): ExtractedVendor[] {
  const out: ExtractedVendor[] = []
  const seen = new Set<string>()

  for (const card of parsed?.contractRiskCards ?? []) {
    const nameParts = String(card.contractName ?? '').split(/\s*[—–-]\s*/)
    const counterparty =
      nameParts.length > 1 ? nameParts[nameParts.length - 1].trim() : nameParts[0]?.trim()
    const contractType = nameParts.length > 1 ? nameParts[0].trim() : ''
    const key = normalizeVendorName(counterparty)
    if (!counterparty || !key || seen.has(key)) continue
    seen.add(key)

    let annualCost = 0
    let contractStatus = 'Active'
    for (const row of parsed?.snapshotTable ?? []) {
      const finding = String(row.finding ?? '')
      if (!finding.toLowerCase().includes(counterparty.toLowerCase())) continue
      const valueMatch = finding.match(/Value:\s*\$?([\d,]+)/i)
      if (valueMatch) annualCost = Number(valueMatch[1].replace(/,/g, '')) || 0
      const statusMatch = String(row.sourceSection ?? '').match(/Status:\s*(\S+)/i)
      if (statusMatch) contractStatus = statusMatch[1]
      break
    }

    // Prefer annual value from finding key-terms when snapshot lacked it.
    if (!annualCost) {
      const finding = (parsed?.detailedFindings ?? []).find(
        (f: any) => String(f.title ?? '').toLowerCase().includes(counterparty.toLowerCase()),
      )
      const content = String(finding?.content ?? '')
      const m =
        content.match(/Annual Contract Value\s*\|\s*\$?([\d,]+)/i) ||
        content.match(/Annual (?:spend|value)[^\d$]*\$?([\d,]+)/i)
      if (m) annualCost = Number(m[1].replace(/,/g, '')) || 0
    }

    const typeLower = contractType.toLowerCase()
    let category = 'Service'
    if (typeLower.includes('software') || typeLower.includes('subscription') || typeLower.includes('saas')) {
      category = 'Software'
    } else if (typeLower.includes('supply') || typeLower.includes('supplier')) {
      category = 'Supplier'
    } else if (typeLower.includes('equipment') || typeLower.includes('lease')) {
      category = 'Equipment'
    } else if (typeLower.includes('marketing') || typeLower.includes('advertising')) {
      category = 'Marketing'
    } else if (typeLower.includes('maintenance')) {
      category = 'Maintenance'
    } else if (typeLower.includes('staffing')) {
      category = 'Staffing'
    }

    out.push({ name: counterparty, category, annualCost, contractStatus, contractType })
  }

  return out
}

/**
 * Merge Material Contracts vendors into Software & Vendors directory:
 * - skip names the advisor deleted (tombstoned)
 * - update existing rows when cost/status/category changed (no duplicates)
 * - add only genuinely new counterparties
 */
export async function syncContractVendorsToDirectory(
  clientId: string,
  parsed: any,
): Promise<{ added: number; updated: number; skippedRemoved: number }> {
  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true },
  })
  if (!client) return { added: 0, updated: 0, skippedRemoved: 0 }

  const existing = (client.sectionSubmissions as Record<string, unknown>) ?? {}
  const currentVendors: VendorDirectoryItem[] = Array.isArray(existing.vendorDirectory)
    ? (existing.vendorDirectory as VendorDirectoryItem[])
    : []
  const removedNames = new Set(
    (Array.isArray(existing[REMOVED_KEY]) ? (existing[REMOVED_KEY] as string[]) : []).map(normalizeVendorName),
  )

  const extracted = extractVendorsFromContractReport(parsed)
  let added = 0
  let updated = 0
  let skippedRemoved = 0

  const byKey = new Map<string, number>()
  currentVendors.forEach((v, index) => {
    const key = vendorMatchKey(v)
    if (key && !byKey.has(key)) byKey.set(key, index)
  })

  const nextVendors = [...currentVendors]

  for (const row of extracted) {
    const key = normalizeVendorName(row.name)
    if (!key) continue

    if (removedNames.has(key)) {
      skippedRemoved += 1
      continue
    }

    const existingIndex = byKey.get(key)
    if (existingIndex != null) {
      const prev = nextVendors[existingIndex]
      const next = { ...prev }
      let changed = false

      if (row.annualCost > 0 && Number(prev.annualCost) !== row.annualCost) {
        next.annualCost = row.annualCost
        changed = true
      }
      if (row.contractStatus && prev.contractStatus !== row.contractStatus) {
        next.contractStatus = row.contractStatus
        changed = true
      }
      // Only overwrite category when current is empty/generic or still the auto default.
      if (
        row.category &&
        (!prev.category || prev.category === 'Service' || prev.category === 'Other') &&
        prev.category !== row.category
      ) {
        next.category = row.category
        changed = true
      }
      if (!prev.vendor) {
        next.vendor = row.name
        changed = true
      }
      if (!prev.name) {
        next.name = row.name
        changed = true
      }

      if (changed) {
        nextVendors[existingIndex] = next
        updated += 1
      }
      continue
    }

    nextVendors.push({
      id: crypto.randomUUID(),
      name: row.name,
      vendor: row.name,
      category: row.category,
      annualCost: row.annualCost,
      contractStatus: row.contractStatus,
      transferable: 'unknown',
      loginAccess: '',
      notes: `Auto-extracted from contract analysis (${row.contractType || 'Material Contract'})`,
    })
    byKey.set(key, nextVendors.length - 1)
    added += 1
  }

  if (added === 0 && updated === 0) {
    return { added, updated, skippedRemoved }
  }

  await prisma.clientProfile.update({
    where: { id: clientId },
    data: {
      sectionSubmissions: {
        ...existing,
        vendorDirectory: nextVendors,
        [REMOVED_KEY]: Array.from(removedNames),
      },
    },
  })

  return { added, updated, skippedRemoved }
}

/** Record a vendor name so Material Contracts sync will not re-add it. */
export async function tombstoneVendorDirectoryName(
  clientId: string,
  nameOrVendor: string,
): Promise<void> {
  const key = normalizeVendorName(nameOrVendor)
  if (!key) return

  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true },
  })
  if (!client) return

  const existing = (client.sectionSubmissions as Record<string, unknown>) ?? {}
  const removed = new Set(
    (Array.isArray(existing[REMOVED_KEY]) ? (existing[REMOVED_KEY] as string[]) : []).map(normalizeVendorName),
  )
  removed.add(key)

  await prisma.clientProfile.update({
    where: { id: clientId },
    data: {
      sectionSubmissions: {
        ...existing,
        [REMOVED_KEY]: Array.from(removed),
      },
    },
  })
}

/** Clear tombstone when advisor manually re-adds the same vendor. */
export async function clearVendorDirectoryTombstone(
  clientId: string,
  nameOrVendor: string,
): Promise<void> {
  const key = normalizeVendorName(nameOrVendor)
  if (!key) return

  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true },
  })
  if (!client) return

  const existing = (client.sectionSubmissions as Record<string, unknown>) ?? {}
  const removed = (Array.isArray(existing[REMOVED_KEY]) ? (existing[REMOVED_KEY] as string[]) : [])
    .map(normalizeVendorName)
    .filter((n) => n && n !== key)

  await prisma.clientProfile.update({
    where: { id: clientId },
    data: {
      sectionSubmissions: {
        ...existing,
        [REMOVED_KEY]: removed,
      },
    },
  })
}
