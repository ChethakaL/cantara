'use client'
import { agentTabReadOnlyGate } from '@/hooks/useAgentTabReadOnly'
import type { AgentTabReadOnlyProps } from '@/types/agent-tab'

import React, { useState, useEffect, useRef } from 'react'
import { Card, Button, cn } from '@/components/ui'
import { useWS16Analysis } from '@/hooks/useWS16Analysis'
import WS16Uploader from './WS16Uploader'
import ReportHeader from './ReportHeader'
import { 
  SummaryTab, 
  DocumentsTab, 
  AgreementsTab, 
  NonCompetesTab, 
  BenefitsTab, 
  ContractorsTab, 
  KeyPeopleTab, 
  CraigReviewTab 
} from './TabPanels'
import { WS16Persistence, WS16Report, Flag } from '@/types/ws1-6-types'
import { parseWS16Markdown } from '@/lib/ws1-6/parser'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import { AdvisorActions } from '@/components/client-portal/AgentClientPortalFrame'
import { buildEmployeeObligationsReportHtml } from '@/lib/report-export/build-employee-obligations-report'
import { useAgentAiProvider } from '@/hooks/useAgentAiProvider'
import { AgentProviderBar } from '@/components/admin/AgentProviderBar'
import { AgentReportHistoryBar } from '@/components/admin/AgentReportHistoryBar'
import { useAgentReportRuns } from '@/hooks/useAgentReportRuns'

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
      <button onClick={onClose} className="ml-4 opacity-50 hover:opacity-100 transition-opacity">✕</button>
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
                      value={Array.isArray(row[column.key]) ? row[column.key].join(', ') : row[column.key] ?? ''}
                      textarea={column.type === 'textarea'}
                      onChange={value => updateRow(index, column.key, Array.isArray(row[column.key]) ? value.split(',').map(item => item.trim()).filter(Boolean) : value)}
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

function EmployeeObligationsStructuredEditor({
  activeTab,
  report,
  onChange,
  flags,
  onConfirm,
  onNA,
}: {
  activeTab: string
  report: WS16Report
  onChange: (report: WS16Report) => void
  flags: Flag[]
  onConfirm: (id: string) => void
  onNA: (id: string) => void
}) {
  const patch = (updates: Partial<WS16Report>) => onChange({ ...report, ...updates })
  const patchSummary = (key: keyof WS16Report['buyerSummary'], value: any) => {
    patch({ buyerSummary: { ...report.buyerSummary, [key]: value } })
  }

  if (activeTab === 'summary') {
    const summaryFields: Array<[keyof WS16Report['buyerSummary'], string]> = [
      ['workforceOverview', 'Workforce overview'],
      ['nonCompeteProtections', 'Non-compete protections'],
      ['assumedBenefitObligations', 'Assumed benefit obligations'],
      ['retirementAndPTO', 'Retirement and PTO'],
      ['independentContractorRisk', 'Independent contractor risk'],
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
            { key: 'partiesCovered', label: 'Parties covered' },
            { key: 'date', label: 'Date' },
            { key: 'status', label: 'Status', type: 'select', options: ['complete', 'incomplete', 'missing'] },
            { key: 'statusNote', label: 'Status note' },
          ]}
        />
      </div>
    )
  }

  if (activeTab === 'agreements') {
    return (
      <div className="p-6">
        <EditableTable
          rows={report.agreements}
          onRowsChange={agreements => patch({ agreements })}
          newRow={{ role: '', agreementType: '', term: '', hasNonCompete: null, hasNonSolicit: null, hasNDA: null, sourceRef: '', isKeyPerson: false }}
          columns={[
            { key: 'role', label: 'Role' },
            { key: 'agreementType', label: 'Agreement type' },
            { key: 'term', label: 'Term' },
            { key: 'hasNonCompete', label: 'Non-compete', type: 'boolean' },
            { key: 'hasNonSolicit', label: 'Non-solicit', type: 'boolean' },
            { key: 'hasNDA', label: 'NDA', type: 'boolean' },
            { key: 'sourceRef', label: 'Source' },
          ]}
        />
      </div>
    )
  }

  if (activeTab === 'noncompetes') {
    return (
      <div className="p-6">
        <EditableTable
          rows={report.nonCompetes}
          onRowsChange={nonCompetes => patch({ nonCompetes })}
          newRow={{ id: `nc-${Date.now()}`, party: '', isCritical: false, sourceDoc: '', sourceSection: '', geographicScope: '', duration: '', coveredActivities: [], considerationNote: '', stateEnforceabilityNote: '', flag: 'informational', flagExplanation: '' }}
          columns={[
            { key: 'party', label: 'Covered party' },
            { key: 'sourceDoc', label: 'Source' },
            { key: 'geographicScope', label: 'Geographic scope' },
            { key: 'duration', label: 'Duration' },
            { key: 'coveredActivities', label: 'Covered activities' },
            { key: 'considerationNote', label: 'Consideration' },
            { key: 'stateEnforceabilityNote', label: 'State note', type: 'textarea' },
            { key: 'flagExplanation', label: 'Flag note', type: 'textarea' },
          ]}
        />
      </div>
    )
  }

  if (activeTab === 'benefits') {
    return (
      <div className="p-6">
        <EditableTable
          rows={report.benefits}
          onRowsChange={benefits => patch({ benefits })}
          newRow={{ benefitType: '', employerContribution: '', contractuallyBound: null, assetSaleTransferable: 'Unknown', estimatedAnnualCost: '', transitionComplexity: 'Unknown' }}
          columns={[
            { key: 'benefitType', label: 'Benefit' },
            { key: 'employerContribution', label: 'Employer contribution' },
            { key: 'contractuallyBound', label: 'Contractually bound', type: 'boolean' },
            { key: 'assetSaleTransferable', label: 'Transferable', type: 'select', options: ['Yes', 'No', 'Unclear', 'Statutory', 'Unknown'] },
            { key: 'estimatedAnnualCost', label: 'Est. annual cost' },
            { key: 'transitionComplexity', label: 'Complexity', type: 'select', options: ['High', 'Medium', 'Low', 'Unknown'] },
          ]}
        />
      </div>
    )
  }

  if (activeTab === 'contractors') {
    return (
      <div className="p-6">
        <EditableTable
          rows={report.contractors}
          onRowsChange={contractors => patch({ contractors })}
          newRow={{ id: `ic-${Date.now()}`, role: '', agreementProvided: false, misclassRisk: 'None Identified', riskFactors: [], flag: 'informational' }}
          columns={[
            { key: 'role', label: 'Role' },
            { key: 'agreementProvided', label: 'Agreement provided', type: 'boolean' },
            { key: 'misclassRisk', label: 'Misclassification risk', type: 'select', options: ['High', 'Moderate', 'None Identified'] },
            { key: 'riskFactors', label: 'Risk factors' },
            { key: 'flag', label: 'Flag', type: 'select', options: ['deal-risk', 'negotiation', 'positive', 'informational'] },
          ]}
        />
      </div>
    )
  }

  if (activeTab === 'keypeople') {
    return (
      <div className="p-6 space-y-4">
        <EditableTable
          rows={report.keyPeople}
          onRowsChange={keyPeople => patch({ keyPeople })}
          newRow={{ role: '', employmentType: '', hasNonCompete: null, hasAgreement: null, riskLevel: 'Unknown', transitionNotes: '' }}
          columns={[
            { key: 'role', label: 'Role' },
            { key: 'employmentType', label: 'Employment type' },
            { key: 'hasNonCompete', label: 'Non-compete', type: 'boolean' },
            { key: 'hasAgreement', label: 'Agreement', type: 'boolean' },
            { key: 'riskLevel', label: 'Risk', type: 'select', options: ['High', 'Medium', 'Low', 'Unknown'] },
            { key: 'transitionNotes', label: 'Transition notes', type: 'textarea' },
          ]}
        />
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-stone-500">Key person narrative</p>
          <FieldInput textarea value={report.keyPersonNarrative ?? ''} onChange={value => patch({ keyPersonNarrative: value })} />
        </div>
      </div>
    )
  }

  return <CraigReviewTab flags={flags} onConfirm={onConfirm} onNA={onNA} report={report} onRelease={() => {}} isReleasing={false} />
}

function boolText(value: boolean | null | undefined) {
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  return 'Unknown'
}

function md(value: unknown) {
  return String(value ?? '').replace(/\|/g, '/').replace(/\n/g, ' ').trim()
}

function serializeWS16Report(report: WS16Report, flags: Flag[]) {
  const rows = (items: string[][]) => items.map(row => `| ${row.map(md).join(' | ')} |`).join('\n')
  const summary = report.buyerSummary
  return `# EMPLOYEE OBLIGATIONS REPORT
**${report.clientName}**

---

## SECTION 1 — DOCUMENT INVENTORY

${rows([
  ['Document Name', 'Document Type', 'Employees or Parties Covered', 'Date', 'Completeness Flag'],
  ['---', '---', '---', '---', '---'],
  ...report.documents.map(doc => [doc.filename, doc.docType, doc.partiesCovered, doc.date, doc.statusNote ? `${doc.status} - ${doc.statusNote}` : doc.status]),
])}

## SECTION 2 — EMPLOYMENT AGREEMENT COVERAGE

${rows([
  ['Role / Title', 'Agreement Type', 'Fixed Term or At-Will', 'Non-Compete Attached Y/N', 'Non-Solicitation Attached Y/N', 'NDA/Confidentiality Attached Y/N', 'Source Document'],
  ['---', '---', '---', '---', '---', '---', '---'],
  ...report.agreements.map(row => [row.role, row.agreementType, row.term, boolText(row.hasNonCompete), boolText(row.hasNonSolicit), boolText(row.hasNDA), row.sourceRef]),
])}

## SECTION 3 — NON-COMPETE AND NON-SOLICITATION REVIEW

${report.nonCompetes.map(nc => `**Covered Party:** ${md(nc.party)}
**Agreement Source:** ${md(nc.sourceDoc)}
**Geographic Scope:** ${md(nc.geographicScope)}
**Duration:** ${md(nc.duration)}
**Covered Activities:** ${md((nc.coveredActivities ?? []).join(', '))}
**Consideration Adequacy:** ${md(nc.considerationNote)}
**State Enforceability Note:** ${md(nc.stateEnforceabilityNote)}
**Flag:** ${md(nc.flagExplanation || nc.flag)}
`).join('\n')}

## SECTION 4 — BENEFIT PLAN OBLIGATIONS

${rows([
  ['Benefit Type', 'Employer Contribution', 'Contractually Bound Y/N', 'Transferable on Asset Sale', 'Estimated Annual Cost', 'Transition Complexity'],
  ['---', '---', '---', '---', '---', '---'],
  ...report.benefits.map(row => [row.benefitType, row.employerContribution, boolText(row.contractuallyBound), row.assetSaleTransferable, row.estimatedAnnualCost, row.transitionComplexity]),
])}

## SECTION 5 — INDEPENDENT CONTRACTOR REVIEW

${report.contractors.length
  ? report.contractors.map(row => `**Contractor Role:** ${md(row.role)}
**Agreement Provided:** ${boolText(row.agreementProvided)}
**Misclassification Risk:** ${md(row.misclassRisk)}
**Risk Factors Present:** ${md((row.riskFactors ?? []).join(', '))}
**Flag:** ${md(row.flag)}
`).join('\n')
  : 'No independent contractor relationships identified.'}

## SECTION 6 — KEY PERSON RISK

${rows([
  ['Role', 'Employment Type', 'Non-Compete', 'Emp. Agreement', 'Risk Level', 'Transition Notes'],
  ['---', '---', '---', '---', '---', '---'],
  ...report.keyPeople.map(row => [row.role, row.employmentType, boolText(row.hasNonCompete), boolText(row.hasAgreement), row.riskLevel, row.transitionNotes]),
])}

**Key Person Narrative:** ${md(report.keyPersonNarrative)}

## SECTION 7 — BUYER-FACING SUMMARY

**Workforce Overview:** ${md(summary.workforceOverview)}

**Non-Compete Protections:** ${md(summary.nonCompeteProtections)}

**Assumed Benefit Obligations:** ${md(summary.assumedBenefitObligations)}

**Retirement Plan & PTO Obligations:** ${md(summary.retirementAndPTO)}

**Independent Contractor Risk:** ${md(summary.independentContractorRisk)}

**Transition Considerations:** ${md(summary.transitionConsiderations)}

**Items Requiring Buyer's Employment Counsel Review:**
${(summary.counselItems ?? []).map(item => `- ${md(item)}`).join('\n')}

## SECTION 8 — FLAG SUMMARY

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

interface EmployeeObligationsTabProps extends AgentTabReadOnlyProps {
  clientId: string
  clientName: string
  state?: string
  dba?: string
  totalEmployeesSelfReported?: number | string | null
  employmentTypeBreakdown?: string | null
}

type ReviewMetadata = {
  flags?: Array<{ id: string; status: Flag['status'] }>
  releasedAt?: string | null
  downstream?: Record<string, unknown>
}

export default function EmployeeObligationsTab({
  clientId,
  clientName,
  state,
  dba,
  totalEmployeesSelfReported,
  employmentTypeBreakdown,
  readOnly = false,
}: EmployeeObligationsTabProps) {
  const [savedReport, setSavedReport] = useState<WS16Persistence | null>(null)
  const [flags, setFlags] = useState<Flag[]>([])
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState('summary')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [releasing, setReleasing] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [draftReport, setDraftReport] = useState<WS16Report | null>(null)
  const [savingMarkdown, setSavingMarkdown] = useState(false)
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastAutoSavedMarkdownRef = useRef('')
  const { historyItems, activeRun, activeId, setActiveId, reload, loading: loadingReport } = useAgentReportRuns(
    '/api/employee-obligations/reports',
    clientId,
  )

  useEffect(() => {
    if (!readOnly) return
    setEditMode(false)
    setDraftReport(null)
  }, [readOnly])

  const { documents, setDocuments, clearAll, analyze, status, rawMarkdown, error } =
    useWS16Analysis({ clientId, clientName, state, dba, totalEmployeesSelfReported: totalEmployeesSelfReported ?? undefined, employmentTypeBreakdown: employmentTypeBreakdown ?? undefined })
  const { provider, setProvider } = useAgentAiProvider()

  const mergeFlagStatuses = (parsedFlags: Flag[], metadata?: ReviewMetadata) => {
    const savedStatuses = new Map((metadata?.flags ?? []).map(flag => [flag.id, flag.status]))
    return parsedFlags.map(flag => ({
      ...flag,
      status: savedStatuses.get(flag.id) ?? 'pending',
    }))
  }

  const buildDownstreamPayload = (markdown: string, parsedFlags: Flag[]) => {
    const { report: parsed } = parseWS16Markdown(markdown, clientName)
    return {
      ws1MasterRiskReport: parsedFlags.filter(flag => flag.status === 'confirmed' && (flag.severity === 'deal-risk' || flag.severity === 'negotiation')),
      ws25LaborExpenseAnalysis: {
        keyPeople: parsed.keyPeople ?? [],
        benefits: parsed.benefits ?? [],
        coverageGaps: parsed.coverageGaps ?? [],
        buyerSummary: parsed.buyerSummary?.retirementAndPTO ?? '',
      },
      ma7TransitionPlan: {
        keyPeople: parsed.keyPeople ?? [],
        keyPersonNarrative: parsed.keyPersonNarrative ?? '',
        buyerSummary: parsed.buyerSummary ?? null,
      },
      ma3Cim: {
        workforceOverview: parsed.buyerSummary?.workforceOverview ?? '',
        nonCompeteProtections: parsed.buyerSummary?.nonCompeteProtections ?? '',
      },
    }
  }

  const isRunning = status === 'uploading' || status === 'streaming'

  const showToast = (message: string, type: 'success' | 'error' = 'success') => setToast({ message, type })

  useEffect(() => {
    if (!activeRun?.markdown) {
      if (!loadingReport) setSavedReport(null)
      return
    }
    setSavedReport(activeRun as WS16Persistence)
    const { flags: pFlags } = parseWS16Markdown(activeRun.markdown, clientName)
    setFlags(mergeFlagStatuses(pFlags || [], activeRun.metadata as ReviewMetadata | undefined))
  }, [activeRun, clientName, loadingReport])

  useEffect(() => {
    if (status === 'complete' && rawMarkdown) {
      void reload({ selectNewest: true }).then(() => {
        showToast('Analysis completed successfully')
      })
      clearAll()
    }
  }, [status, rawMarkdown, clearAll, reload])

  const { report: extractedReport } = parseWS16Markdown(
    savedReport?.markdown || '',
    clientName
  )

  const report: WS16Report = {
    clientName,
    generatedAt: savedReport?.createdAt ?? new Date().toISOString(),
    hitlStatus: (flags.filter(f => f.status !== 'pending').length === flags.length ? 'complete' : 'in-progress') as any,
    coverageGaps: extractedReport.coverageGaps || [],
    buyerSummary: extractedReport.buyerSummary || {
      workforceOverview: 'No summary available.',
      nonCompeteProtections: '',
      assumedBenefitObligations: '',
      retirementAndPTO: '',
      independentContractorRisk: '',
      transitionConsiderations: '',
      counselItems: []
    },
    documents: extractedReport.documents || [],
    agreements: extractedReport.agreements || [],
    nonCompetes: extractedReport.nonCompetes || [],
    benefits: extractedReport.benefits || [],
    contractors: extractedReport.contractors || [],
    keyPeople: extractedReport.keyPeople || [],
    keyPersonNarrative: extractedReport.keyPersonNarrative || '',
  }

  const updateFlag = (id: string, action: 'confirmed' | 'na') => {
    setFlags(prev => prev.map(f => (f.id === id ? { ...f, status: action } : f)))
  }

  const startEditing = () => {
    setDraftReport(structuredClone(report))
    lastAutoSavedMarkdownRef.current = savedReport?.markdown ?? ''
    setEditMode(true)
  }

  const saveEditedMarkdown = async (options: { closeAfterSave?: boolean; silent?: boolean } = {}) => {
    if (!savedReport || !draftReport) return
    const { closeAfterSave = true, silent = false } = options
    if (!silent) setSavingMarkdown(true)
    try {
      const editedMarkdown = serializeWS16Report(draftReport, flags)
      if (editedMarkdown === lastAutoSavedMarkdownRef.current) {
        if (closeAfterSave) {
          setEditMode(false)
          setDraftReport(null)
        }
        return
      }
      const response = await fetch(`/api/employee-obligations/reports?clientId=${clientId}`, {
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
        const { flags: pFlags } = parseWS16Markdown(data.report.markdown, clientName)
        setFlags(mergeFlagStatuses(pFlags || [], data.report.metadata))
        lastAutoSavedMarkdownRef.current = data.report.markdown
      }
      if (closeAfterSave) {
        setEditMode(false)
        setDraftReport(null)
        showToast('Final report saved')
      }
    } catch (err) {
      console.error('Failed to save edited report:', err)
      if (!silent) showToast('Failed to save final report.', 'error')
    } finally {
      if (!silent) setSavingMarkdown(false)
    }
  }

  useEffect(() => {
    if (!editMode || !savedReport || !draftReport) return
    const editedMarkdown = serializeWS16Report(draftReport, flags)
    if (editedMarkdown === lastAutoSavedMarkdownRef.current) return
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
    autoSaveTimeoutRef.current = setTimeout(() => {
      void saveEditedMarkdown({ closeAfterSave: false, silent: true })
    }, 900)
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
    }
  }, [editMode, savedReport, draftReport, flags])

  const persistReviewState = async (nextFlags: Flag[], releasedAt?: string | null) => {
    const markdown = savedReport?.markdown
    if (!markdown) return

    const metadata: ReviewMetadata = {
      flags: nextFlags.map(flag => ({ id: flag.id, status: flag.status })),
      releasedAt: releasedAt ?? null,
      downstream: buildDownstreamPayload(markdown, nextFlags),
    }

    const response = await fetch(`/api/employee-obligations/reports?clientId=${clientId}`, {
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
      const resp = await fetch(`/api/employee-obligations/reports?clientId=${clientId}`, {
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


  const readOnlyGate = agentTabReadOnlyGate(readOnly, loadingReport, Boolean(savedReport?.markdown), 'Employee Obligations')
  if (readOnlyGate) return readOnlyGate

  if (!savedReport && !isRunning) {
    return (
      <div className="-m-6 bg-stone-50 min-h-[500px] p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="p-10 border-stone-200 shadow-sm">
            {!readOnly && (
              <AgentProviderBar provider={provider} onProviderChange={setProvider} disabled={isRunning} className="mb-6" />
            )}
            <WS16Uploader clientId={clientId} onDocumentsReady={setDocuments} onAnalyze={() => analyze(provider)} isLoading={isRunning} />
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
                <h3 className="text-xl font-semibold text-stone-900 tracking-tight">Analyzing employee obligations...</h3>
                <p className="text-stone-500 max-w-sm mx-auto">
                  Feeding documents to engine. This takes 1–2 minutes for large sets.
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
    { id: 'agreements', label: 'Agreements' },
    { id: 'noncompetes', label: 'Non-competes' },
    { id: 'benefits', label: 'Benefits' },
    { id: 'contractors', label: 'Contractors' },
    { id: 'keypeople', label: 'Key people' },
    ...(readOnly ? [] : [{ id: 'review', label: 'Admin review' }]),
  ]

  return (
    <div className="space-y-4">
      <ReportHeader report={report} flags={flags} onDelete={() => setDeleteOpen(true)} onNewAnalysis={handleNewAnalysis} readOnly={readOnly} />

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <AgentReportHistoryBar
          runs={historyItems}
          activeId={activeId}
          onSelect={(run) => setActiveId(run.id)}
          activeProvider={savedReport?.aiProvider}
          activeModel={savedReport?.aiModel}
        />
        <AdvisorActions className="flex flex-wrap items-center gap-2">
          {!readOnly && (editMode ? (
            <>
              <Button size="sm" variant="outline" onClick={() => { setEditMode(false); setDraftReport(null) }} disabled={savingMarkdown}>Cancel</Button>
              <Button size="sm" onClick={() => void saveEditedMarkdown()} disabled={savingMarkdown}>{savingMarkdown ? 'Saving...' : 'Save Final Version'}</Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={startEditing}>Edit Output</Button>
          ))}
          <ExportReportButton
            html={buildEmployeeObligationsReportHtml(report, flags, clientName)}
            fileName={`employee-obligations-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
            label="Export PDF"
          />
        </AdvisorActions>
      </div>

      {/* Workflow guidance banner */}
      {!readOnly && (() => {
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
            <EmployeeObligationsStructuredEditor
              activeTab={activeTab}
              report={draftReport}
              onChange={setDraftReport}
              flags={flags}
              onConfirm={id => handleFlagUpdate(id, 'confirmed')}
              onNA={id => handleFlagUpdate(id, 'na')}
            />
          )}
          {!editMode && activeTab === 'summary' && <SummaryTab report={report} flags={flags} onConfirm={id => handleFlagUpdate(id, 'confirmed')} onNA={id => handleFlagUpdate(id, 'na')} readOnly={readOnly} />}
          {!editMode && activeTab === 'documents' && <DocumentsTab report={report} flags={flags} onConfirm={id => handleFlagUpdate(id, 'confirmed')} onNA={id => handleFlagUpdate(id, 'na')} readOnly={readOnly} />}
          {!editMode && activeTab === 'agreements' && <AgreementsTab report={report} flags={flags} onConfirm={id => handleFlagUpdate(id, 'confirmed')} onNA={id => handleFlagUpdate(id, 'na')} readOnly={readOnly} />}
          {!editMode && activeTab === 'noncompetes' && <NonCompetesTab report={report} flags={flags} onConfirm={id => handleFlagUpdate(id, 'confirmed')} onNA={id => handleFlagUpdate(id, 'na')} readOnly={readOnly} />}
          {!editMode && activeTab === 'benefits' && <BenefitsTab report={report} flags={flags} onConfirm={id => handleFlagUpdate(id, 'confirmed')} onNA={id => handleFlagUpdate(id, 'na')} readOnly={readOnly} />}
          {!editMode && activeTab === 'contractors' && <ContractorsTab report={report} flags={flags} onConfirm={id => handleFlagUpdate(id, 'confirmed')} onNA={id => handleFlagUpdate(id, 'na')} readOnly={readOnly} />}
          {!editMode && activeTab === 'keypeople' && <KeyPeopleTab report={report} flags={flags} onConfirm={id => handleFlagUpdate(id, 'confirmed')} onNA={id => handleFlagUpdate(id, 'na')} readOnly={readOnly} />}
          {!editMode && activeTab === 'review' && <CraigReviewTab flags={flags} onConfirm={id => handleFlagUpdate(id, 'confirmed')} onNA={id => handleFlagUpdate(id, 'na')} report={report} onRelease={handleRelease} isReleasing={releasing} />}
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
