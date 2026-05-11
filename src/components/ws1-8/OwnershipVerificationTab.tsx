'use client'

import React, { useState, useEffect } from 'react'
import { Card, Button, cn } from '@/components/ui'
import { useWS18Analysis } from '@/hooks/useWS18Analysis'
import WS18Uploader from './WS18Uploader'
import ReportHeader from './ReportHeader'
import {
  SummaryTab,
  DocumentsTab,
  EntitiesTab,
  OwnershipTab,
  EncumbrancesTab,
  StateFilingsTab,
  AdminReviewTab,
} from './TabPanels'
import { WS18Persistence, WS18Report, WS18Flag } from '@/types/ws1-8-types'
import { parseWS18Markdown } from '@/lib/ws1-8/parser'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import { buildOwnershipVerificationReportHtml } from '@/lib/report-export/build-ownership-verification-report'

// ─────────────────────────────────────────────────────────────────────────────
// PREMIUM UI COMPONENTS: Modal & Toast
// ─────────────────────────────────────────────────────────────────────────────

function DeleteConfirmModal({ isOpen, onClose, onConfirm, isDeleting }: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void; isDeleting: boolean
}) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        <div className="p-8 text-center space-y-4">
          <div className="mx-auto w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center text-2xl font-serif">
            !
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-semibold text-stone-900 tracking-tight">Delete Analysis Report</h3>
            <p className="text-stone-500 text-[14px]">
              This will permanently remove the AI analysis for this client. You will need to re-upload documents to recreate it.
            </p>
          </div>
        </div>
        <div className="flex border-t border-stone-100 p-4 gap-3 bg-stone-50/50">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="danger" className="flex-1 rounded-xl bg-red-600 text-white border-none hover:bg-red-700" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Confirm Delete'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatusToast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={cn(
      "fixed bottom-8 right-8 z-[100] px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-right-10 duration-500",
      type === 'success' ? "bg-stone-900 text-white border-stone-800" : "bg-red-50 text-red-700 border-red-200"
    )}>
      <div className={cn("w-2 h-2 rounded-full", type === 'success' ? "bg-amber-400 animate-pulse" : "bg-red-500")} />
      <p className="text-[14px] font-medium tracking-tight">{message}</p>
      <button onClick={onClose} className="ml-4 opacity-50 hover:opacity-100 transition-opacity">x</button>
    </div>
  )
}

function FieldInput({ value, onChange, textarea = false }: { value: string; onChange: (value: string) => void; textarea?: boolean }) {
  const className = "w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-[12px] text-stone-800 outline-none focus:ring-2 focus:ring-amber-100"
  return textarea ? (
    <textarea value={value ?? ''} onChange={event => onChange(event.target.value)} className={`${className} min-h-[90px] leading-relaxed`} />
  ) : (
    <input value={value ?? ''} onChange={event => onChange(event.target.value)} className={className} />
  )
}

function EditableTable({
  columns,
  rows,
  onRowsChange,
  newRow,
}: {
  columns: Array<{ key: string; label: string; type?: 'text' | 'textarea' | 'boolean' | 'select'; options?: string[] }>
  rows: any[]
  onRowsChange: (rows: any[]) => void
  newRow: any
}) {
  const updateRow = (index: number, key: string, value: any) => {
    onRowsChange(rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)))
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
      <table className="w-full min-w-[900px] text-left">
        <thead className="bg-stone-50">
          <tr>
            {columns.map(column => <th key={column.key} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{column.label}</th>)}
            <th className="w-12 px-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-stone-100 align-top">
              {columns.map(column => (
                <td key={column.key} className="px-3 py-2">
                  {column.type === 'boolean' ? (
                    <select
                      value={row[column.key] === true ? 'yes' : row[column.key] === false ? 'no' : ''}
                      onChange={event => updateRow(index, column.key, event.target.value === 'yes' ? true : event.target.value === 'no' ? false : null)}
                      className="w-full rounded-lg border border-amber-300 bg-white px-2 py-2 text-[12px]"
                    >
                      <option value="">Unknown</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  ) : column.type === 'select' ? (
                    <select
                      value={row[column.key] ?? ''}
                      onChange={event => updateRow(index, column.key, event.target.value)}
                      className="w-full rounded-lg border border-amber-300 bg-white px-2 py-2 text-[12px]"
                    >
                      {(column.options ?? []).map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : (
                    <FieldInput
                      value={row[column.key] ?? ''}
                      textarea={column.type === 'textarea'}
                      onChange={value => updateRow(index, column.key, value)}
                    />
                  )}
                </td>
              ))}
              <td className="px-2 py-3 text-center">
                <button className="text-red-400 hover:text-red-600" onClick={() => onRowsChange(rows.filter((_, i) => i !== index))}>x</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-stone-100 bg-stone-50 px-4 py-3">
        <button
          className="text-[12px] font-semibold text-amber-700 hover:text-amber-800"
          onClick={() => onRowsChange([...rows, { ...newRow }])}
        >
          + Add row
        </button>
      </div>
    </div>
  )
}

function OwnershipVerificationStructuredEditor({
  activeTab,
  report,
  onChange,
  flags,
  onConfirm,
  onNA,
}: {
  activeTab: string
  report: WS18Report
  onChange: (report: WS18Report) => void
  flags: WS18Flag[]
  onConfirm: (id: string) => void
  onNA: (id: string) => void
}) {
  const patch = (updates: Partial<WS18Report>) => onChange({ ...report, ...updates })
  const patchSummary = (key: keyof WS18Report['buyerSummary'], value: any) => {
    patch({ buyerSummary: { ...report.buyerSummary, [key]: value } })
  }

  if (activeTab === 'summary') {
    const summaryFields: Array<[keyof WS18Report['buyerSummary'], string]> = [
      ['entityStructureOverview', 'Entity structure overview'],
      ['ownershipClarity', 'Ownership clarity'],
      ['encumbranceExposure', 'Encumbrance exposure'],
      ['stateComplianceStatus', 'State compliance status'],
      ['transitionConsiderations', 'Transition considerations'],
    ]
    return (
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-1 gap-4">
          {summaryFields.map(([key, label]) => (
            <div key={String(key)}>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{label}</p>
              <FieldInput textarea value={String(report.buyerSummary[key] ?? '')} onChange={value => patchSummary(key, value)} />
            </div>
          ))}
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-stone-500">Counsel review items</p>
            <FieldInput
              textarea
              value={(report.buyerSummary.counselItems ?? []).join('\n')}
              onChange={value => patchSummary('counselItems', value.split('\n').map(item => item.trim()).filter(Boolean))}
            />
          </div>
        </div>
      </div>
    )
  }

  if (activeTab === 'documents') {
    return (
      <div className="p-6">
        <EditableTable
          rows={report.documents}
          onRowsChange={documents => patch({ documents })}
          newRow={{ id: `doc-${Date.now()}`, filename: '', docType: 'Other', partiesCovered: '', date: '', status: 'incomplete', statusNote: '' }}
          columns={[
            { key: 'filename', label: 'Document' },
            { key: 'docType', label: 'Type' },
            { key: 'partiesCovered', label: 'Entities/parties covered' },
            { key: 'date', label: 'Date' },
            { key: 'status', label: 'Status', type: 'select', options: ['complete', 'incomplete', 'missing'] },
            { key: 'statusNote', label: 'Status note' },
          ]}
        />
      </div>
    )
  }

  if (activeTab === 'entities') {
    return (
      <div className="p-6">
        <EditableTable
          rows={report.entities}
          onRowsChange={entities => patch({ entities })}
          newRow={{ id: `entity-${Date.now()}`, entityName: '', entityType: '', stateOfFormation: '', dateOfFormation: '', ein: '', registeredAgent: '', status: 'unknown', sourceRef: '' }}
          columns={[
            { key: 'entityName', label: 'Entity name' },
            { key: 'entityType', label: 'Type' },
            { key: 'stateOfFormation', label: 'State' },
            { key: 'dateOfFormation', label: 'Formation date' },
            { key: 'ein', label: 'EIN' },
            { key: 'registeredAgent', label: 'Registered agent' },
            { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive', 'dissolved', 'unknown'] },
            { key: 'sourceRef', label: 'Source' },
          ]}
        />
      </div>
    )
  }

  if (activeTab === 'ownership') {
    return (
      <div className="p-6">
        <EditableTable
          rows={report.ownershipStakes}
          onRowsChange={ownershipStakes => patch({ ownershipStakes })}
          newRow={{ id: `stake-${Date.now()}`, ownerName: '', ownerType: 'Individual', entityOwned: '', ownershipPercentage: '', classOfInterest: '', votingRights: '', transferRestrictions: '', sourceRef: '' }}
          columns={[
            { key: 'ownerName', label: 'Owner' },
            { key: 'ownerType', label: 'Owner type', type: 'select', options: ['Individual', 'Entity', 'Trust', 'Estate'] },
            { key: 'entityOwned', label: 'Entity owned' },
            { key: 'ownershipPercentage', label: 'Ownership %' },
            { key: 'classOfInterest', label: 'Class' },
            { key: 'votingRights', label: 'Voting rights' },
            { key: 'transferRestrictions', label: 'Transfer restrictions' },
            { key: 'sourceRef', label: 'Source' },
          ]}
        />
      </div>
    )
  }

  if (activeTab === 'encumbrances') {
    return (
      <div className="p-6">
        <EditableTable
          rows={report.encumbrances}
          onRowsChange={encumbrances => patch({ encumbrances })}
          newRow={{ id: `enc-${Date.now()}`, type: '', filedAgainst: '', securedParty: '', filingDate: '', expirationDate: '', collateralDescription: '', status: 'unknown', amount: '', sourceRef: '' }}
          columns={[
            { key: 'type', label: 'Type' },
            { key: 'filedAgainst', label: 'Filed against' },
            { key: 'securedParty', label: 'Secured party' },
            { key: 'filingDate', label: 'Filing date' },
            { key: 'expirationDate', label: 'Expiration' },
            { key: 'collateralDescription', label: 'Collateral', type: 'textarea' },
            { key: 'status', label: 'Status', type: 'select', options: ['active', 'released', 'expired', 'unknown'] },
            { key: 'amount', label: 'Amount' },
            { key: 'sourceRef', label: 'Source' },
          ]}
        />
      </div>
    )
  }

  if (activeTab === 'statefilings') {
    return (
      <div className="p-6">
        <EditableTable
          rows={report.stateFilings}
          onRowsChange={stateFilings => patch({ stateFilings })}
          newRow={{ id: `filing-${Date.now()}`, state: '', filingType: '', filingDate: '', expirationDate: '', status: 'unknown', complianceStatus: 'unknown', notes: '', sourceRef: '' }}
          columns={[
            { key: 'state', label: 'State' },
            { key: 'filingType', label: 'Filing type' },
            { key: 'filingDate', label: 'Filing date' },
            { key: 'expirationDate', label: 'Expiration/due date' },
            { key: 'status', label: 'Status', type: 'select', options: ['active', 'expired', 'pending', 'unknown'] },
            { key: 'complianceStatus', label: 'Compliance', type: 'select', options: ['compliant', 'non-compliant', 'unclear', 'unknown'] },
            { key: 'notes', label: 'Notes', type: 'textarea' },
            { key: 'sourceRef', label: 'Source' },
          ]}
        />
      </div>
    )
  }

  return <AdminReviewTab flags={flags} onConfirm={onConfirm} onNA={onNA} report={report} onRelease={() => {}} isReleasing={false} />
}

function md(value: unknown) {
  return String(value ?? '').replace(/\|/g, '/').replace(/\n/g, ' ').trim()
}

function serializeWS18Report(report: WS18Report, flags: WS18Flag[]) {
  const rows = (items: string[][]) => items.map(row => `| ${row.map(md).join(' | ')} |`).join('\n')
  const summary = report.buyerSummary
  return `# CORPORATE OWNERSHIP VERIFICATION REPORT
**${report.clientName}**

---

## SECTION 1 — DOCUMENT INVENTORY

${rows([
  ['Document Name', 'Document Type', 'Entities or Parties Covered', 'Date', 'Completeness Flag'],
  ['---', '---', '---', '---', '---'],
  ...report.documents.map(doc => [doc.filename, doc.docType, doc.partiesCovered, doc.date, doc.statusNote ? `${doc.status} - ${doc.statusNote}` : doc.status]),
])}

## SECTION 2 — ENTITY STRUCTURE

${rows([
  ['Entity Name', 'Entity Type', 'State of Formation', 'Date of Formation', 'EIN', 'Registered Agent', 'Status', 'Source Document'],
  ['---', '---', '---', '---', '---', '---', '---', '---'],
  ...report.entities.map(e => [e.entityName, e.entityType, e.stateOfFormation, e.dateOfFormation, e.ein || 'Not Provided', e.registeredAgent, e.status, e.sourceRef]),
])}

## SECTION 3 — OWNERSHIP BREAKDOWN

${rows([
  ['Owner Name', 'Owner Type', 'Entity Owned', 'Ownership Percentage', 'Class of Interest', 'Voting Rights', 'Transfer Restrictions', 'Source Document'],
  ['---', '---', '---', '---', '---', '---', '---', '---'],
  ...report.ownershipStakes.map(s => [s.ownerName, s.ownerType, s.entityOwned, s.ownershipPercentage, s.classOfInterest, s.votingRights, s.transferRestrictions, s.sourceRef]),
])}

## SECTION 4 — ENCUMBRANCES & LIENS

${report.encumbrances.length
  ? report.encumbrances.map(enc => `**Type:** ${md(enc.type)}
**Filed Against:** ${md(enc.filedAgainst)}
**Secured Party / Lienholder:** ${md(enc.securedParty)}
**Filing Date:** ${md(enc.filingDate)}
**Expiration Date:** ${md(enc.expirationDate)}
**Collateral Description:** ${md(enc.collateralDescription)}
**Status:** ${md(enc.status)}
**Amount:** ${md(enc.amount || 'Not Specified')}
**Source Document:** ${md(enc.sourceRef)}
`).join('\n')
  : 'No encumbrances or liens identified in uploaded documents.'}

## SECTION 5 — STATE FILING COMPLIANCE

${rows([
  ['State', 'Filing Type', 'Filing Date', 'Expiration/Due Date', 'Status', 'Compliance Assessment', 'Notes', 'Source Document'],
  ['---', '---', '---', '---', '---', '---', '---', '---'],
  ...report.stateFilings.map(f => [f.state, f.filingType, f.filingDate, f.expirationDate, f.status, f.complianceStatus, f.notes, f.sourceRef]),
])}

## SECTION 6 — BUYER-FACING OWNERSHIP SUMMARY

**Entity Structure Overview:** ${md(summary.entityStructureOverview)}

**Ownership Clarity:** ${md(summary.ownershipClarity)}

**Encumbrance Exposure:** ${md(summary.encumbranceExposure)}

**State Compliance Status:** ${md(summary.stateComplianceStatus)}

**Transition Considerations:** ${md(summary.transitionConsiderations)}

**Items Requiring Buyer's Corporate Counsel Review:**
${(summary.counselItems ?? []).map(item => `- ${md(item)}`).join('\n')}

## SECTION 7 — FLAG SUMMARY

${rows([
  ['Domain', 'Flag Severity', 'Flag Description', 'Source Reference'],
  ['---', '---', '---', '---'],
  ...flags.map(flag => [flag.domain, flag.severity, flag.description || flag.title, flag.sourceRef]),
])}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface OwnershipVerificationTabProps {
  clientId: string
  clientName: string
  state?: string
  dba?: string
  entityType?: string
}

type ReviewMetadata = {
  flags?: Array<{ id: string; status: WS18Flag['status'] }>
  releasedAt?: string | null
  downstream?: Record<string, unknown>
}

export default function OwnershipVerificationTab({
  clientId,
  clientName,
  state,
  dba,
  entityType,
}: OwnershipVerificationTabProps) {
  const [savedReport, setSavedReport] = useState<WS18Persistence | null>(null)
  const [flags, setFlags] = useState<WS18Flag[]>([])
  const [loadingReport, setLoadingReport] = useState(true)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState('summary')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [releasing, setReleasing] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [draftReport, setDraftReport] = useState<WS18Report | null>(null)
  const [savingMarkdown, setSavingMarkdown] = useState(false)

  const { documents, setDocuments, clearAll, analyze, status, rawMarkdown, error } =
    useWS18Analysis({ clientId, clientName, state, dba, entityType })

  const mergeFlagStatuses = (parsedFlags: WS18Flag[], metadata?: ReviewMetadata) => {
    const savedStatuses = new Map((metadata?.flags ?? []).map(flag => [flag.id, flag.status]))
    return parsedFlags.map(flag => ({
      ...flag,
      status: savedStatuses.get(flag.id) ?? 'pending' as const,
    }))
  }

  const buildDownstreamPayload = (markdown: string, parsedFlags: WS18Flag[]) => {
    const { report: parsed } = parseWS18Markdown(markdown, clientName)
    return {
      ws1MasterRiskReport: parsedFlags.filter(flag => flag.status === 'confirmed' && (flag.severity === 'deal-risk' || flag.severity === 'negotiation')),
      corporateStructure: {
        entities: parsed.entities ?? [],
        ownershipStakes: parsed.ownershipStakes ?? [],
        encumbrances: parsed.encumbrances ?? [],
        stateFilings: parsed.stateFilings ?? [],
      },
    }
  }

  const isRunning = status === 'uploading' || status === 'streaming'

  const showToast = (message: string, type: 'success' | 'error' = 'success') => setToast({ message, type })

  useEffect(() => {
    setLoadingReport(true)
    fetch(`/api/ownership-verification/reports?clientId=${clientId}`)
      .then(r => r.json())
      .then(data => {
        if (data.report) {
          setSavedReport(data.report)
          const { flags: pFlags } = parseWS18Markdown(data.report.markdown, clientName)
          setFlags(mergeFlagStatuses(pFlags || [], data.report.metadata))
        }
      })
      .catch(console.error)
      .finally(() => setLoadingReport(false))
  }, [clientId, clientName])

  useEffect(() => {
    if (status === 'complete' && rawMarkdown) {
      setSavedReport({ markdown: rawMarkdown, createdAt: new Date().toISOString() })
      const { flags: pFlags } = parseWS18Markdown(rawMarkdown, clientName)
      setFlags(mergeFlagStatuses(pFlags || []))
      clearAll()
      showToast('Analysis completed successfully')
    }
  }, [status, rawMarkdown, clearAll, clientName])

  const { report: extractedReport } = parseWS18Markdown(
    savedReport?.markdown || '',
    clientName
  )

  const report: WS18Report = {
    clientName,
    generatedAt: savedReport?.createdAt ?? new Date().toISOString(),
    hitlStatus: (flags.filter(f => f.status !== 'pending').length === flags.length && flags.length > 0 ? 'complete' : 'in-progress') as any,
    documents: extractedReport.documents || [],
    entities: extractedReport.entities || [],
    ownershipStakes: extractedReport.ownershipStakes || [],
    encumbrances: extractedReport.encumbrances || [],
    stateFilings: extractedReport.stateFilings || [],
    buyerSummary: extractedReport.buyerSummary || {
      entityStructureOverview: 'No summary available.',
      ownershipClarity: '',
      encumbranceExposure: '',
      stateComplianceStatus: '',
      transitionConsiderations: '',
      counselItems: [],
    },
  }

  const updateFlag = (id: string, action: 'confirmed' | 'na') => {
    setFlags(prev => prev.map(f => (f.id === id ? { ...f, status: action } : f)))
  }

  const startEditing = () => {
    setDraftReport(structuredClone(report))
    setEditMode(true)
  }

  const saveEditedMarkdown = async () => {
    if (!savedReport || !draftReport) return
    setSavingMarkdown(true)
    try {
      const editedMarkdown = serializeWS18Report(draftReport, flags)
      const response = await fetch(`/api/ownership-verification/reports?clientId=${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markdown: editedMarkdown,
          metadata: (savedReport as any).metadata ?? undefined,
        }),
      })
      if (!response.ok) throw new Error(await response.text().catch(() => 'Failed to save final report'))
      const data = await response.json()
      if (data.report) {
        setSavedReport(data.report)
        const { flags: pFlags } = parseWS18Markdown(data.report.markdown, clientName)
        setFlags(mergeFlagStatuses(pFlags || [], data.report.metadata))
      }
      setEditMode(false)
      setDraftReport(null)
      showToast('Final report saved')
    } catch (err) {
      console.error('Failed to save edited report:', err)
      showToast('Failed to save final report.', 'error')
    } finally {
      setSavingMarkdown(false)
    }
  }

  const persistReviewState = async (nextFlags: WS18Flag[], releasedAt?: string | null) => {
    const markdown = savedReport?.markdown
    if (!markdown) return

    const metadata: ReviewMetadata = {
      flags: nextFlags.map(flag => ({ id: flag.id, status: flag.status })),
      releasedAt: releasedAt ?? null,
      downstream: buildDownstreamPayload(markdown, nextFlags),
    }

    const response = await fetch(`/api/ownership-verification/reports?clientId=${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata }),
    })

    if (!response.ok) {
      throw new Error(await response.text().catch(() => 'Failed to save review state'))
    }

    const data = await response.json()
    if (data.report) setSavedReport(data.report)
  }

  const handleFlagUpdate = async (id: string, action: 'confirmed' | 'na') => {
    const nextFlags = flags.map(flag => (flag.id === id ? { ...flag, status: action } : flag))
    setFlags(nextFlags)
    try {
      await persistReviewState(nextFlags, (savedReport as any)?.metadata?.releasedAt ?? null)
    } catch (err) {
      console.error('Failed to persist review state:', err)
      showToast('Failed to save review status.', 'error')
    }
  }

  const handleRelease = async () => {
    setReleasing(true)
    try {
      const releasedAt = new Date().toISOString()
      await persistReviewState(flags, releasedAt)
      showToast('Review state released for downstream use')
    } catch (err) {
      console.error('Release failed:', err)
      showToast('Failed to release review state.', 'error')
    } finally {
      setReleasing(false)
    }
  }

  const handleNewAnalysis = () => {
    setSavedReport(null)
    setFlags([])
    clearAll()
    showToast('Starting new analysis session')
  }

  const handleDeleteConfirmed = async () => {
    setDeleting(true)
    try {
      const resp = await fetch(`/api/ownership-verification/reports?clientId=${clientId}`, {
        method: 'DELETE',
      })
      if (!resp.ok) throw new Error('Delete failed')

      setSavedReport(null)
      setFlags([])
      clearAll()
      setDeleteOpen(false)
      showToast('Report deleted successfully')
    } catch (err) {
      console.error('Delete failed:', err)
      showToast('Failed to delete report. Please try again.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (!savedReport && !isRunning) {
    return (
      <div className="-m-6 bg-stone-50 min-h-[500px] p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="p-10 border-stone-200 shadow-sm">
            <WS18Uploader clientId={clientId} onDocumentsReady={setDocuments} onAnalyze={analyze} isLoading={isRunning} />
            {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
          </Card>
        </div>
        {toast && <StatusToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    )
  }

  if (isRunning && !savedReport) {
    return (
      <div className="-m-6 bg-stone-50 min-h-[500px] p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="p-12 border-stone-200 shadow-sm bg-white">
            <div className="flex flex-col items-center gap-8 text-center">
              <div className="w-12 h-12 border-4 border-stone-100 border-t-stone-800 rounded-full animate-spin" />
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-stone-900 tracking-tight">Analyzing corporate ownership...</h3>
                <p className="text-stone-500 max-w-sm mx-auto">
                  Feeding documents to engine. This takes 1-2 minutes for large sets.
                </p>
              </div>
              {rawMarkdown.length > 0 && (
                <div className="w-full bg-stone-50 border border-stone-200 rounded-xl p-8 text-left max-h-[450px] overflow-auto shadow-inner">
                  <div className="prose prose-stone prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{rawMarkdown}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
        {toast && <StatusToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    )
  }

  const tabs = [
    { id: 'summary', label: 'Summary' },
    { id: 'documents', label: 'Documents' },
    { id: 'entities', label: 'Entities' },
    { id: 'ownership', label: 'Ownership' },
    { id: 'encumbrances', label: 'Encumbrances' },
    { id: 'statefilings', label: 'State Filings' },
    { id: 'review', label: 'Admin Review' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1">
          <ReportHeader report={report} flags={flags} onDelete={() => setDeleteOpen(true)} onNewAnalysis={handleNewAnalysis} />
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          {editMode ? (
            <>
              <Button variant="outline" onClick={() => { setEditMode(false); setDraftReport(null) }} disabled={savingMarkdown}>Cancel</Button>
              <Button onClick={saveEditedMarkdown} disabled={savingMarkdown}>{savingMarkdown ? 'Saving...' : 'Save Final Version'}</Button>
            </>
          ) : (
            <Button variant="outline" onClick={startEditing}>Edit Output</Button>
          )}
          <ExportReportButton
            html={buildOwnershipVerificationReportHtml(report, flags, clientName)}
            fileName={`ownership-verification-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
            label="Export Ownership Report"
          />
        </div>
      </div>

      {/* Workflow guidance banner */}
      {(() => {
        const pendingCount = flags.filter(f => f.status === 'pending').length
        const totalCount = flags.length
        const allDone = totalCount > 0 && pendingCount === 0
        return allDone ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <span className="text-emerald-600 text-sm">&#10003;</span>
            <p className="text-sm text-emerald-800">
              All {totalCount} flags reviewed &mdash; report is ready for export. Use <strong>&ldquo;+ New Analysis&rdquo;</strong> to re-run with updated documents.
            </p>
          </div>
        ) : totalCount > 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <span className="text-amber-600 text-sm">&#9888;</span>
            <p className="text-sm text-amber-800">
              Review in progress &mdash; {pendingCount} of {totalCount} flags remaining. Use <strong>&ldquo;+ New Analysis&rdquo;</strong> to re-run with updated documents.
            </p>
          </div>
        ) : null
      })()}

      <Card className="overflow-hidden border-stone-200 shadow-sm bg-white ring-1 ring-stone-950/5">
        <div className="flex border-b border-stone-100 bg-stone-50/50 px-4 overflow-x-auto whitespace-nowrap scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-5 py-4 text-[12px] font-medium tracking-tight transition-all relative',
                activeTab === tab.id ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600'
              )}
            >
              {tab.label}
              {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-stone-800" />}
            </button>
          ))}
        </div>

        <div className="min-h-[500px]">
          {editMode && draftReport && (
            <OwnershipVerificationStructuredEditor
              activeTab={activeTab}
              report={draftReport}
              onChange={setDraftReport}
              flags={flags}
              onConfirm={id => handleFlagUpdate(id, 'confirmed')}
              onNA={id => handleFlagUpdate(id, 'na')}
            />
          )}
          {!editMode && activeTab === 'summary' && <SummaryTab report={report} flags={flags} onConfirm={id => handleFlagUpdate(id, 'confirmed')} onNA={id => handleFlagUpdate(id, 'na')} />}
          {!editMode && activeTab === 'documents' && <DocumentsTab report={report} flags={flags} onConfirm={id => handleFlagUpdate(id, 'confirmed')} onNA={id => handleFlagUpdate(id, 'na')} />}
          {!editMode && activeTab === 'entities' && <EntitiesTab report={report} flags={flags} onConfirm={id => handleFlagUpdate(id, 'confirmed')} onNA={id => handleFlagUpdate(id, 'na')} />}
          {!editMode && activeTab === 'ownership' && <OwnershipTab report={report} flags={flags} onConfirm={id => handleFlagUpdate(id, 'confirmed')} onNA={id => handleFlagUpdate(id, 'na')} />}
          {!editMode && activeTab === 'encumbrances' && <EncumbrancesTab report={report} flags={flags} onConfirm={id => handleFlagUpdate(id, 'confirmed')} onNA={id => handleFlagUpdate(id, 'na')} />}
          {!editMode && activeTab === 'statefilings' && <StateFilingsTab report={report} flags={flags} onConfirm={id => handleFlagUpdate(id, 'confirmed')} onNA={id => handleFlagUpdate(id, 'na')} />}
          {!editMode && activeTab === 'review' && <AdminReviewTab flags={flags} onConfirm={id => handleFlagUpdate(id, 'confirmed')} onNA={id => handleFlagUpdate(id, 'na')} report={report} onRelease={handleRelease} isReleasing={releasing} />}
        </div>
      </Card>

      <DeleteConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteConfirmed}
        isDeleting={deleting}
      />
      {toast && <StatusToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
