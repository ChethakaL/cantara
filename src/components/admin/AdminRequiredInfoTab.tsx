'use client'

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { ChevronRight, FileSpreadsheet, Plus, Trash2, Upload } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { ClientCompetitorInputsFields } from '@/components/client-portal/ClientCompetitorInputsFields'
import type { Client } from '@/lib/store'
import {
  STRUCTURED_FORM_COLUMNS,
  downloadStructuredFormTemplate,
  isStructuredFormFieldKey,
  parsePipeRows,
  parseStructuredFormExcel,
  serializePipeRows,
  type StructuredFormFieldKey,
} from '@/lib/structured-form-excel'

type ClientPortalFormQuestion = {
  id: string
  agentId: string
  fieldKey: string
  label: string
  description?: string | null
  inputType: 'text' | 'url' | 'textarea' | 'select' | 'number'
  placeholder?: string | null
  required: boolean
  options?: string[] | null
  groupKey?: string | null
  groupLabel?: string | null
  sortOrder?: number
}

const DEDICATED_REQUIRED_INFO_AGENTS = [
  'facility_review',
  'digital_presence',
  'occupancy_review',
  'vendor_directory',
  'professional_advisors',
  'competitor_analysis',
  'pricing_analysis',
] as const

function isDedicatedRequiredInfoAgent(agentId: string) {
  return (DEDICATED_REQUIRED_INFO_AGENTS as readonly string[]).includes(agentId)
}

function buildRequiredInfoFormTabs(formQuestions: ClientPortalFormQuestion[]) {
  const hasAgentForm = (agentId: string) => formQuestions.some(q => q.agentId === agentId)
  return {
    activeFormKeys: [
      ...(hasAgentForm('facility_review') ? ['facility_review'] : []),
      ...(hasAgentForm('digital_presence') ? ['digital_presence'] : []),
      ...(hasAgentForm('competitor_analysis') ? ['competitor_analysis'] : []),
      ...(hasAgentForm('pricing_analysis') ? ['pricing_analysis'] : []),
      ...(hasAgentForm('occupancy_review') ? ['occupancy_review'] : []),
      ...(hasAgentForm('vendor_directory') ? ['vendor_directory'] : []),
      ...(hasAgentForm('professional_advisors') ? ['professional_advisors'] : []),
      ...(formQuestions.some(q => !isDedicatedRequiredInfoAgent(q.agentId)) ? ['other_info'] : []),
    ],
    formLabels: {
      facility_review: 'Facility Review',
      digital_presence: 'Digital Presence',
      competitor_analysis: 'Competitor Inputs',
      pricing_analysis: 'Competitor Pricing Inputs',
      occupancy_review: 'Occupancy Review',
      vendor_directory: 'Software & Vendors',
      professional_advisors: 'Professional Advisors',
      other_info: 'Other Required Info',
    } as Record<string, string>,
  }
}

function buildOrderedFormQuestionGroups(
  questions: ClientPortalFormQuestion[],
): Array<{ groupLabel: string; questions: ClientPortalFormQuestion[] }> {
  const order: string[] = []
  const byLabel = new Map<string, ClientPortalFormQuestion[]>()
  for (const question of questions) {
    const label = question.groupLabel || 'Business Information'
    if (!byLabel.has(label)) {
      order.push(label)
      byLabel.set(label, [])
    }
    byLabel.get(label)!.push(question)
  }
  return order.map(groupLabel => ({ groupLabel, questions: byLabel.get(groupLabel)! }))
}

function facilityReviewSubgroupLabel(groupLabel: string): string {
  return groupLabel.replace(/^Facility Review\s*[-–]\s*/i, '').trim() || groupLabel
}

function FormQuestionFields({
  questions,
  formResponses,
  onUpdate,
  onError,
}: {
  questions: ClientPortalFormQuestion[]
  formResponses: Record<string, string>
  onUpdate: (fieldKey: string, value: string) => void
  onError: (message: string) => void
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {questions.map(question => {
        const commonClass =
          'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400'
        const structured = Boolean(STRUCTURED_FORM_COLUMNS[question.fieldKey])
        const Shell = structured ? 'div' : 'label'
        const shellClass = question.inputType === 'textarea' || structured ? 'md:col-span-2' : ''
        return (
          <Shell key={question.id} className={shellClass}>
            <span className="text-xs font-semibold text-slate-500">
              {question.label}
              {question.required && <span className="text-amber-600"> *</span>}
            </span>
            {question.description && (
              <span className="block text-[11px] text-slate-400 mt-0.5">{question.description}</span>
            )}
            {structured ? (
              <StructuredRowsInput
                question={question}
                value={formResponses[question.fieldKey] ?? ''}
                onChange={value => onUpdate(question.fieldKey, value)}
                onError={onError}
              />
            ) : question.inputType === 'textarea' ? (
              <textarea
                value={formResponses[question.fieldKey] ?? ''}
                onChange={e => onUpdate(question.fieldKey, e.target.value)}
                placeholder={question.placeholder ?? ''}
                className={`${commonClass} mt-1 min-h-[84px] resize-y`}
              />
            ) : question.inputType === 'select' ? (
              <select
                value={formResponses[question.fieldKey] ?? ''}
                onChange={e => onUpdate(question.fieldKey, e.target.value)}
                className={`${commonClass} mt-1 bg-white`}
              >
                <option value="">Select...</option>
                {(question.options ?? []).map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={question.inputType === 'number' ? 'number' : question.inputType === 'url' ? 'url' : 'text'}
                value={formResponses[question.fieldKey] ?? ''}
                onChange={e => onUpdate(question.fieldKey, e.target.value)}
                placeholder={question.placeholder ?? ''}
                className={`${commonClass} mt-1`}
              />
            )}
          </Shell>
        )
      })}
    </div>
  )
}

function StructuredRowsInput({
  question,
  value,
  onChange,
  onError,
}: {
  question: ClientPortalFormQuestion
  value: string
  onChange: (value: string) => void
  onError: (message: string) => void
}) {
  const fieldKey = question.fieldKey as StructuredFormFieldKey
  const columns = STRUCTURED_FORM_COLUMNS[fieldKey] ?? []
  const rows = parsePipeRows(value, fieldKey)
  const visibleRows = rows.length ? rows : [columns.reduce<Record<string, string>>((row, column) => ({ ...row, [column.key]: '' }), {})]
  const [importing, setImporting] = useState(false)

  function updateCell(rowIndex: number, key: string, nextValue: string) {
    const next = [...visibleRows]
    next[rowIndex] = { ...next[rowIndex], [key]: nextValue }
    onChange(serializePipeRows(next, fieldKey))
  }

  function addRow() {
    onChange(serializePipeRows([...visibleRows, columns.reduce<Record<string, string>>((row, column) => ({ ...row, [column.key]: '' }), {})], fieldKey))
  }

  function removeRow(index: number) {
    onChange(serializePipeRows(visibleRows.filter((_, rowIndex) => rowIndex !== index), fieldKey))
  }

  async function handleExcelUpload(file: File | null) {
    if (!file || !isStructuredFormFieldKey(question.fieldKey)) return
    setImporting(true)
    onError('')
    try {
      const buffer = await file.arrayBuffer()
      onChange(parseStructuredFormExcel(buffer, question.fieldKey))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not read the uploaded spreadsheet.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="mt-2 space-y-3">
      <p className="text-[11px] text-slate-400">
        Download the Excel template, fill in rows, then upload or edit inline below.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (!isStructuredFormFieldKey(question.fieldKey)) return
            downloadStructuredFormTemplate(question.fieldKey)
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          Download Excel template
        </button>
        <input
          id={`admin-upload-${question.fieldKey}`}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={e => {
            void handleExcelUpload(e.target.files?.[0] ?? null)
            e.target.value = ''
          }}
        />
        <label
          htmlFor={`admin-upload-${question.fieldKey}`}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100"
        >
          <Upload className="w-3.5 h-3.5" />
          {importing ? 'Importing...' : 'Upload completed Excel'}
        </label>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <Plus className="w-3.5 h-3.5" /> Add Row
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[980px] text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {columns.map(column => <th key={column.key} className="px-3 py-2 text-left font-semibold">{column.label}</th>)}
              <th className="w-12 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map(column => (
                  <td key={column.key} className="px-2 py-2">
                    <input
                      value={row[column.key] ?? ''}
                      onChange={e => updateCell(rowIndex, column.key, e.target.value)}
                      placeholder={column.placeholder}
                      className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </td>
                ))}
                <td className="px-2 py-2 text-right">
                  <button type="button" onClick={() => removeRow(rowIndex)} className="rounded-md p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function AdminRequiredInfoTab({
  client,
  setClient,
}: {
  client: Client
  setClient: Dispatch<SetStateAction<Client | null>>
}) {
  const [formQuestions, setFormQuestions] = useState<ClientPortalFormQuestion[]>([])
  const [formResponses, setFormResponses] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const autoSaveSkipRef = useRef(true)

  useEffect(() => {
    let cancelled = false
    autoSaveSkipRef.current = true
    async function loadFormQuestions() {
      try {
        const res = await fetch(`/api/client-form-questions?clientId=${encodeURIComponent(client.id)}`)
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setFormQuestions(data.questions ?? [])
        setFormResponses(data.responses ?? {})
        setTimeout(() => { autoSaveSkipRef.current = false }, 0)
      } catch {
        if (!cancelled) setFormQuestions([])
      }
    }
    void loadFormQuestions()
    return () => { cancelled = true }
  }, [client.id])

  function updateFormResponse(fieldKey: string, value: string) {
    setFormResponses(prev => ({ ...prev, [fieldKey]: value }))
    setError('')
  }

  function replaceFormResponses(nextResponses: Record<string, string>) {
    setFormResponses(nextResponses)
    setError('')
  }

  async function saveFormResponses(options?: { silent?: boolean }) {
    if (!formQuestions.length) return true
    const missing = formQuestions.filter(q => q.required && !String(formResponses[q.fieldKey] ?? '').trim())
    if (missing.length && !options?.silent) {
      setError(`Please complete required fields: ${missing.slice(0, 3).map(q => q.label).join(', ')}${missing.length > 3 ? '...' : ''}`)
      return false
    }
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const res = await fetch('/api/client-form-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, responses: formResponses }),
      })
      if (!res.ok) throw new Error(await res.text())
      const refreshed = await fetch(`/api/clients/${encodeURIComponent(client.id)}`, { cache: 'no-store' })
      if (refreshed.ok) setClient(await refreshed.json())
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      return true
    } catch (err) {
      if (!options?.silent) setError(err instanceof Error ? err.message : 'Could not save information.')
      return false
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (autoSaveSkipRef.current || !formQuestions.length) return
    const timeout = setTimeout(() => {
      void saveFormResponses({ silent: true })
    }, 1200)
    return () => clearTimeout(timeout)
  }, [formResponses, formQuestions.length])

  const { activeFormKeys, formLabels: formLabelsMap } = buildRequiredInfoFormTabs(formQuestions)
  const [activeFormTab, setActiveFormTab] = useState<string>('')

  useEffect(() => {
    if (activeFormKeys.length && (!activeFormTab || !activeFormKeys.includes(activeFormTab))) {
      setActiveFormTab(activeFormKeys[0])
    }
  }, [activeFormKeys, activeFormTab])

  const currentIndex = activeFormKeys.indexOf(activeFormTab)
  const hasNext = currentIndex !== -1 && currentIndex < activeFormKeys.length - 1

  if (!formQuestions.length) {
    return (
      <Card className="p-6 text-sm text-slate-500">
        No required info forms are active for this client’s current workstream.
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        Advisors can fill or correct the same required-info forms shown in the client portal. Changes save back to the shared client form responses.
      </div>

      <Card className="p-1 flex flex-wrap gap-1">
        {activeFormKeys.map(key => (
          <button
            key={key}
            onClick={() => setActiveFormTab(key)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeFormTab === key ? 'text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
            style={activeFormTab === key ? { background: '#0d1829' } : {}}
          >
            {formLabelsMap[key]}
          </button>
        ))}
      </Card>

      {activeFormTab !== '' && (
        <Card className="overflow-hidden">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-slate-800">{formLabelsMap[activeFormTab]}</h4>
              <p className="mt-1 text-xs text-slate-500">
                {activeFormTab === 'facility_review'
                  ? 'Fill the facility review answers here if the advisor team needs to enter them directly.'
                  : 'Fill or correct these client required-info answers directly from the advisor portal.'}
              </p>
            </div>
          </div>

          <div className="space-y-5 p-5">
            {buildOrderedFormQuestionGroups(
              formQuestions.filter(q => activeFormTab === 'other_info' ? !isDedicatedRequiredInfoAgent(q.agentId) : q.agentId === activeFormTab),
            ).map(group => (
              <div key={group.groupLabel} className="space-y-3 border-t border-slate-100 pt-2 first:border-t-0 first:pt-0">
                <h5 className="text-sm font-bold text-slate-800">
                  {activeFormTab === 'facility_review' ? facilityReviewSubgroupLabel(group.groupLabel) : group.groupLabel}
                </h5>
                {activeFormTab === 'competitor_analysis' || activeFormTab === 'pricing_analysis' ? (
                  <ClientCompetitorInputsFields
                    mode={activeFormTab}
                    questions={group.questions}
                    formResponses={formResponses}
                    onUpdate={updateFormResponse}
                    onCompetitorsChange={replaceFormResponses}
                    FormQuestionFields={FormQuestionFields}
                    onError={setError}
                  />
                ) : (
                  <FormQuestionFields
                    questions={group.questions}
                    formResponses={formResponses}
                    onUpdate={updateFormResponse}
                    onError={setError}
                  />
                )}
              </div>
            ))}

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <div className="flex items-center gap-3">
                <Button size="sm" onClick={() => void saveFormResponses()} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Information'}
                </Button>
                {saved && <span className="text-xs font-medium text-emerald-600">Saved</span>}
              </div>
              {hasNext && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-1.5 border-slate-200 hover:bg-slate-50 transition-all font-semibold text-xs text-slate-700"
                  onClick={async () => {
                    const success = await saveFormResponses()
                    if (success) setActiveFormTab(activeFormKeys[currentIndex + 1])
                  }}
                  disabled={saving}
                >
                  Next Section
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
