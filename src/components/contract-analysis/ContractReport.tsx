'use client'
import { useState } from 'react'
import { FileText, AlertTriangle, Folder } from 'lucide-react'
import { Card, Badge } from '@/components/ui'
import { ContractReport as IContractReport } from '../../lib/contract-analysis/types'
import { SnapshotTable } from './report-sections/SnapshotTable'
import { DetailedFindings } from './report-sections/DetailedFindings'
import { FlagAnalysis } from './report-sections/FlagAnalysis'
import { DocumentInventoryReport } from './report-sections/DocumentInventoryReport'
import { ReportExportBar } from './ReportExportBar'

interface Props {
  report: IContractReport
  fileName: string
  clientName: string
  onNewAnalysis: () => void
  onDelete?: () => void
}

const REPORT_TABS = [
  { key: 'snapshot', label: 'Snapshot', icon: FileText },
  { key: 'findings', label: 'Findings', icon: FileText },
  { key: 'flags', label: 'Flags', icon: AlertTriangle },
  { key: 'documents', label: 'Documents', icon: Folder },
]

export function ContractReport({ report, fileName, clientName, onNewAnalysis, onDelete }: Props) {
  const [activeTab, setActiveTab] = useState('snapshot')

  const flagCounts = {
    red: (report.redFlags || []).length,
    orange: (report.orangeFlags || []).length,
    green: (report.greenFlags || []).length,
  }
  const perContractFlagCount = (report.contractRiskCards || []).reduce(
    (sum, card) => sum + card.redFlags.length + card.orangeFlags.length + card.greenFlags.length,
    0,
  )

  const getCount = (key: string) => {
    switch (key) {
      case 'flags': return perContractFlagCount || flagCounts.red + flagCounts.orange + flagCounts.green
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
          <h4 className="font-semibold text-slate-800">Material Contracts Report</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            {fileName} · Generated {new Date(report.generatedAt).toLocaleString()}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Badge color="red">🔴 {flagCounts.red} Red</Badge>
            <Badge color="gold">🟡 {flagCounts.orange} Orange</Badge>
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
        {activeTab === 'snapshot' && <SnapshotTable rows={report.snapshotTable} />}
        {activeTab === 'findings' && <DetailedFindings findings={report.detailedFindings} raw={report.raw} />}
        {activeTab === 'flags' && (
          <FlagAnalysis
            riskCards={report.contractRiskCards || []}
            red={report.redFlags}
            orange={report.orangeFlags}
            green={report.greenFlags}
          />
        )}
        {activeTab === 'documents' && <DocumentInventoryReport rows={report.documentInventory} />}
      </div>
    </Card>
  )
}
