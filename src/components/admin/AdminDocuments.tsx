'use client'
import { CheckCircle, XCircle, Clock, AlertTriangle, FileText } from 'lucide-react'
import { Badge } from '@/components/ui'
import { VALUATION_DOCS, DOCUMENT_CATEGORIES, getDocsForWorkstream } from '@/lib/documentData'
import type { Client } from '@/lib/store'

export default function AdminDocumentsView({ client }: { client: Client }) {
  const { workstream, businessType, documentStatuses } = client
  const categories = getDocsForWorkstream(workstream, businessType)

  const getStatus = (docId: string) => documentStatuses[docId]

  const renderStatus = (docId: string) => {
    const s = getStatus(docId)
    if (!s) return <span className="inline-flex items-center gap-1 text-xs text-slate-300"><Clock className="w-3 h-3" /> Awaiting</span>
    if (s.notApplicable) return <Badge color="slate">N/A</Badge>
    if (s.hasDoc === false) return <Badge color="red">Client said: No</Badge>
    if (s.hasDoc === true && s.fileName) return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
        <CheckCircle className="w-3 h-3" />
        {s.fileName}
      </span>
    )
    if (s.hasDoc === true && !s.fileName) return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
        <Clock className="w-3 h-3" /> Confirmed, awaiting upload
      </span>
    )
    if (s.assignedTo) return <Badge color="gold">Assigned to {s.assignedTo}</Badge>
    return <Badge color="slate">Unanswered</Badge>
  }

  if (!workstream) {
    return (
      <div className="py-12 text-center text-sm text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
        <AlertTriangle className="w-8 h-8 text-slate-200 mx-auto mb-3" />
        No workstream assigned. Provision a workstream in Client Management to see document requirements.
      </div>
    )
  }

  const submitted = Object.values(documentStatuses).filter(s => s.fileName || s.notApplicable).length
  const total = VALUATION_DOCS.length + categories.flatMap(c => c.documents).length

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Submitted', value: submitted, color: 'text-emerald-600' },
          { label: 'Pending', value: total - submitted, color: 'text-amber-600' },
          { label: 'Total Required', value: total, color: 'text-slate-700' },
        ].map(s => (
          <div key={s.label} className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Business Valuation */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h4 className="text-sm font-semibold text-slate-700">Business Valuation Documents</h4>
          <Badge color="gold">First Priority</Badge>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-50">
          {VALUATION_DOCS.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
              <FileText className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-800">{doc.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{doc.description}</p>
              </div>
              <div className="shrink-0">{renderStatus(doc.id)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Other categories */}
      {categories.map(cat => (
        <section key={cat.id}>
          <h4 className="text-sm font-semibold text-slate-700 mb-3">{cat.title}</h4>
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-50">
            {cat.documents.map(doc => {
              const s = getStatus(doc.id)
              return (
                <div key={doc.id} className={`flex items-center gap-3 px-4 py-3 ${doc.flagged ? 'bg-amber-50' : ''}`}>
                  {doc.flagged ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" /> : <FileText className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800">{doc.name}</p>
                    {doc.flagged && <p className="text-xs text-amber-600 mt-0.5">{doc.flagNote}</p>}
                  </div>
                  <div className="shrink-0">{renderStatus(doc.id)}</div>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
