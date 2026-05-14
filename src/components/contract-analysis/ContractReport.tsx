'use client'
import { useMemo, useState } from 'react'
import { FileText, AlertTriangle, Folder, Pencil, Save, X } from 'lucide-react'
import { Card, Badge, Button } from '@/components/ui'
import { ContractReport as IContractReport } from '../../lib/contract-analysis/types'
import { SnapshotTable } from './report-sections/SnapshotTable'
import { DetailedFindings } from './report-sections/DetailedFindings'
import { FlagAnalysis, getVisibleFlags } from './report-sections/FlagAnalysis'
import { DocumentInventoryReport } from './report-sections/DocumentInventoryReport'
import { ReportExportBar } from './ReportExportBar'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import { buildContractSummaryHtml, buildContractAddendumHtml } from '@/lib/report-export/build-contract-report'

interface Props {
  report: IContractReport
  fileName: string
  clientName: string
  onNewAnalysis: () => void
  onDelete?: () => void
  onReportUpdated?: (report: IContractReport) => Promise<void>
  adminMode?: boolean
}

const REPORT_TABS = [
  { key: 'snapshot', label: 'Snapshot', icon: FileText },
  { key: 'findings', label: 'Findings', icon: FileText },
  { key: 'flags', label: 'Flags', icon: AlertTriangle },
  { key: 'documents', label: 'Documents', icon: Folder },
]

export function ContractReport({ report, fileName, clientName, onNewAnalysis, onDelete, onReportUpdated, adminMode = false }: Props) {
  const [activeTab, setActiveTab] = useState('snapshot')
  const [editMode, setEditMode] = useState(false)
  const [draftReport, setDraftReport] = useState<IContractReport | null>(null)
  const [savingEdits, setSavingEdits] = useState(false)
  const visibleReport = editMode && draftReport ? draftReport : report
  const summaryHtml = useMemo(() => buildContractSummaryHtml(visibleReport, clientName), [visibleReport, clientName])
  const addendumHtml = useMemo(() => buildContractAddendumHtml(visibleReport, clientName), [visibleReport, clientName])

  const flagCounts = {
    red: getVisibleFlags(visibleReport.redFlags || []).length,
    orange: getVisibleFlags(visibleReport.orangeFlags || []).length,
    green: getVisibleFlags(visibleReport.greenFlags || []).length,
  }
  const perContractFlagCount = (visibleReport.contractRiskCards || []).reduce(
    (sum, card) => sum + card.redFlags.length + card.orangeFlags.length + card.greenFlags.length,
    0,
  )

  const getCount = (key: string) => {
    switch (key) {
      case 'flags': return perContractFlagCount || flagCounts.red + flagCounts.orange + flagCounts.green
      case 'findings': return (visibleReport.detailedFindings || []).length
      case 'documents': return (visibleReport.documentInventory || []).length
      default: return 0
    }
  }

  const canEdit = adminMode && Boolean(onReportUpdated)
  const startEdit = () => {
    setActiveTab('findings')
    setDraftReport(structuredClone(report))
    setEditMode(true)
  }
  const cancelEdit = () => {
    setDraftReport(null)
    setEditMode(false)
  }
  const saveEdits = async () => {
    if (!draftReport || !onReportUpdated) return
    setSavingEdits(true)
    try {
      await onReportUpdated(draftReport)
      setDraftReport(null)
      setEditMode(false)
    } finally {
      setSavingEdits(false)
    }
  }

  return (
    <Card className="overflow-hidden border-slate-200/60 shadow-sm">
      {/* Report header */}
      <div className="p-5 border-b border-slate-100 flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 bg-slate-50/30">
        <div className="min-w-0">
          <h4 className="font-semibold text-slate-800">Material Contracts Report</h4>
          <p className="text-xs text-slate-400 mt-0.5 break-words">
            {fileName} · Generated {new Date(report.generatedAt).toLocaleString()}
          </p>
        </div>

        <div className="flex w-full xl:w-auto flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5 justify-start xl:justify-end">
            <Badge color="red">🔴 {flagCounts.red} Red</Badge>
            <Badge color="gold">🟡 {flagCounts.orange} Orange</Badge>
            <Badge color="green">🟢 {flagCounts.green} Green</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-start xl:justify-end">
          {canEdit && (
            editMode ? (
              <>
                <Button size="sm" variant="outline" onClick={cancelEdit} disabled={savingEdits}>
                  <X className="w-3.5 h-3.5" /> Cancel
                </Button>
                <Button size="sm" onClick={saveEdits} disabled={savingEdits}>
                  <Save className="w-3.5 h-3.5" /> {savingEdits ? 'Saving...' : 'Save Output'}
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={startEdit}>
                <Pencil className="w-3.5 h-3.5" /> Edit Output
              </Button>
            )
          )}
          <ExportReportButton
            html={summaryHtml}
            fileName={`contract-summary-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
            label="Summary PDF"
          />
          <ExportReportButton
            html={addendumHtml}
            fileName={`contract-addendum-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
            label="Risk Cards Addendum"
          />
          <ReportExportBar
            reportMarkdown={report.raw}
            clientName={clientName}
            onNewAnalysis={onNewAnalysis}
            onDelete={onDelete}
          />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 overflow-x-auto bg-white">
        {REPORT_TABS.map(tab => {
          const Icon = tab.icon
          const count = getCount(tab.key)
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-5 py-3.5 text-xs font-medium tracking-wide border-b-2 -mb-px whitespace-nowrap transition-all ${
                activeTab === tab.key ? 'text-slate-900 border-amber-500 bg-amber-50/30' : 'text-slate-400 border-transparent hover:text-slate-600 hover:bg-slate-50/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {count > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: 'rgba(184,146,42,0.1)', color: '#b8922a' }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Section content */}
      <div className="p-4 sm:p-6 min-h-[400px]">
        {activeTab === 'snapshot' && <SnapshotTable rows={visibleReport.snapshotTable} />}
        {activeTab === 'findings' && (
          <DetailedFindings
            findings={visibleReport.detailedFindings}
            raw={visibleReport.raw}
            report={visibleReport}
            adminMode={adminMode}
            onReportUpdated={editMode ? undefined : onReportUpdated}
            editMode={editMode}
            onReportDraftChange={setDraftReport}
          />
        )}
        {activeTab === 'flags' && (
          <FlagAnalysis
            riskCards={visibleReport.contractRiskCards || []}
            red={visibleReport.redFlags}
            orange={visibleReport.orangeFlags}
            green={visibleReport.greenFlags}
            report={visibleReport}
            adminMode={adminMode}
            onReportUpdated={onReportUpdated}
          />
        )}
        {activeTab === 'documents' && <DocumentInventoryReport rows={visibleReport.documentInventory} />}
      </div>
    </Card>
  )
}
