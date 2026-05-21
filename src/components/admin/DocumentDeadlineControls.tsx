'use client'

import { useEffect, useState } from 'react'
import { DatePicker } from '@/components/ui'
import {
  fromDateInputValue,
  getEffectiveDocumentDeadline,
  toDateInputValue,
} from '@/lib/document-deadlines'
import { saveClient } from '@/lib/store'
import type { Client, DocumentStatus } from '@/lib/store'

function emptyStatus(documentId: string): DocumentStatus {
  return {
    id: documentId,
    hasDoc: null,
    assignedTo: null,
    uploadedAt: null,
    fileName: null,
    notApplicable: false,
    targetDeadline: null,
  }
}

export function SectionDeadlineField({
  client,
  sectionId,
  sectionLabel,
  documentIds,
  onSaved,
}: {
  client: Client
  sectionId: string
  sectionLabel: string
  documentIds: string[]
  onSaved: (client: Client) => void
}) {
  const [value, setValue] = useState(toDateInputValue(client.sectionDeadlines?.[sectionId]))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValue(toDateInputValue(client.sectionDeadlines?.[sectionId]))
  }, [client.sectionDeadlines, sectionId])

  async function applySectionDeadline() {
    setSaving(true)
    try {
      const iso = fromDateInputValue(value)
      const nextSectionDeadlines = { ...(client.sectionDeadlines ?? {}) }
      if (iso) nextSectionDeadlines[sectionId] = iso
      else delete nextSectionDeadlines[sectionId]

      const saved = await saveClient({
        id: client.id,
        sectionDeadlines: nextSectionDeadlines,
      })
      if (saved) onSaved(saved as Client)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-3 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200/80 bg-gradient-to-r from-slate-50 to-white px-4 py-3 shadow-sm">
      <div className="min-w-[200px] flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Section target deadline</p>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          {sectionLabel} — applies to {documentIds.length} document{documentIds.length === 1 ? '' : 's'} unless overridden below.
        </p>
      </div>
      <DatePicker value={value} onChange={setValue} placeholder="Choose section deadline" size="md" className="w-[220px]" />
      <button
        type="button"
        onClick={() => void applySectionDeadline()}
        disabled={saving}
        className="h-[42px] rounded-lg px-4 text-xs font-medium text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
        style={{ background: '#21263C' }}
      >
        {saving ? 'Saving...' : 'Save section deadline'}
      </button>
    </div>
  )
}

export function DocumentDeadlineField({
  client,
  documentId,
  sectionId,
  onSaved,
}: {
  client: Client
  documentId: string
  sectionId: string
  onSaved: (client: Client) => void
}) {
  const effective = getEffectiveDocumentDeadline(
    documentId,
    sectionId,
    client.documentStatuses,
    client.sectionDeadlines ?? {},
  )
  const docOverride = client.documentStatuses[documentId]?.targetDeadline ?? null
  const [value, setValue] = useState(toDateInputValue(docOverride ?? effective))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const nextEffective = getEffectiveDocumentDeadline(
      documentId,
      sectionId,
      client.documentStatuses,
      client.sectionDeadlines ?? {},
    )
    const nextOverride = client.documentStatuses[documentId]?.targetDeadline ?? null
    setValue(toDateInputValue(nextOverride ?? nextEffective))
  }, [client.documentStatuses, client.sectionDeadlines, documentId, sectionId])

  async function saveDocumentDeadline() {
    setSaving(true)
    try {
      const iso = fromDateInputValue(value)
      const current = client.documentStatuses[documentId] ?? emptyStatus(documentId)
      const nextStatuses = {
        ...client.documentStatuses,
        [documentId]: {
          ...current,
          targetDeadline: iso,
        },
      }
      const saved = await saveClient({
        id: client.id,
        documentStatuses: nextStatuses,
      })
      if (saved) onSaved(saved as Client)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <DatePicker
        value={value}
        onChange={setValue}
        placeholder="Set deadline"
        size="sm"
        className="w-[156px]"
      />
      <button
        type="button"
        onClick={() => void saveDocumentDeadline()}
        disabled={saving}
        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
      >
        {saving ? '...' : 'Save'}
      </button>
    </div>
  )
}
