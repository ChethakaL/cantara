'use client'
import { useState } from 'react'
import { FileText, AlertTriangle, Folder } from 'lucide-react'
import { Card, Badge } from '@/components/ui'
import { LeaseReport as ILeaseReport } from '../../lib/lease-analysis/types'
import { SnapshotTable } from './report-sections/SnapshotTable'
import { DetailedFindings } from './report-sections/DetailedFindings'
import { FlagAnalysis } from './report-sections/FlagAnalysis'
import { DocumentInventoryReport } from './report-sections/DocumentInventoryReport'
import { ReportExportBar } from './ReportExportBar'
import { getVisibleFlags } from '@/lib/lease-analysis/report-utils'

interface Props {
  report: ILeaseReport
  fileName: string
  clientName: string
  onNewAnalysis: () => void
  onDelete?: () => void
  onReportUpdated?: (report: ILeaseReport) => Promise<void>
  adminMode?: boolean
}

const REPORT_TABS = [
  { key: 'summary', label: 'Summary', icon: FileText },
  { key: 'findings', label: 'Findings', icon: FileText },
  { key: 'flags', label: 'Flags', icon: AlertTriangle },
  { key: 'documents', label: 'Documents', icon: Folder },
]

export function LeaseReport({
  report,
  fileName,
  clientName,
  onNewAnalysis,
  onDelete,
  onReportUpdated,
  adminMode = false,
}: Props) {
  const [activeTab, setActiveTab] = useState('summary')

  const flagCounts = {
    red: getVisibleFlags(report.redFlags || []).length,
    orange: getVisibleFlags(report.orangeFlags || []).length,
    green: getVisibleFlags(report.greenFlags || []).length,
  }

  const getCount = (key: string) => {
    switch (key) {
      case 'flags': return flagCounts.red + flagCounts.orange + flagCounts.green
      case 'findings': return (report.detailedFindings || []).length
      case 'documents': return (report.documentInventory || []).length
      default: return 0
    }
  }

  return (
    <Card className="overflow-hidden border-slate-200/60 shadow-sm">
      {/* Report header */}
      <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4 flex-wrap bg-slate-50/30">
        <div>
          <h4 className="font-semibold text-slate-800">Lease Analysis Report</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            {fileName} · Generated {new Date(report.generatedAt).toLocaleString()}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Badge color="red">🔴 {flagCounts.red} Red</Badge>
            <Badge color="gold">🟡 {flagCounts.orange} Yellow</Badge>
            <Badge color="green">🟢 {flagCounts.green} Green</Badge>
          </div>
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <ReportExportBar 
            reportMarkdown={report.raw} 
            clientName={clientName} 
            onNewAnalysis={onNewAnalysis}
            onDelete={onDelete}
          />
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
      <div className="p-6 min-h-[400px]">
        {activeTab === 'summary' && <SnapshotTable rows={report.snapshotTable} rentSchedule={report.rentSchedule} />}
        {activeTab === 'findings' && <DetailedFindings findings={report.detailedFindings} raw={report.raw} />}
        {activeTab === 'flags' && (
          <FlagAnalysis
            red={report.redFlags}
            orange={report.orangeFlags}
            green={report.greenFlags}
            adminMode={adminMode}
            onReportUpdated={onReportUpdated}
            report={report}
          />
        )}
        {activeTab === 'documents' && <DocumentInventoryReport rows={report.documentInventory} />}
      </div>
    </Card>
  )
}
