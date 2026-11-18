'use client'

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Check, ChevronLeft, ChevronRight, FileSpreadsheet, Loader2, Plus, Trash2, Upload } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { ClientCompetitorInputsFields } from '@/components/client-portal/ClientCompetitorInputsFields'
import { FiscalYearEndPicker } from '@/components/client-portal/FiscalYearEndPicker'
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
import { FORM_FIELD_NA_VALUE, isFormFieldNa } from '@/lib/client-form-na'
import MarketingIntakeRows from '@/components/client-portal/MarketingIntakeRows'
import { isMarketingIntakeField } from '@/lib/marketing-intake'
import RequiredInfoMeetingCall from '@/components/admin/RequiredInfoMeetingCall'
import {
  REQUIRED_INFO_FORM_CATALOG,
  REQUIRED_INFO_FORM_LABELS,
  patchRequiredInfoVisibility,
  type RequiredInfoFormKey,
} from '@/lib/required-info-forms'

type ClientPortalFormQuestion = {
  id: string
  agentId: string
  fieldKey: string
  label: string
  description?: string | null
  inputType: 'text' | 'url' | 'textarea' | 'select' | 'number' | 'fiscal-year-end' | 'marketing-rows'
  placeholder?: string | null
  required: boolean
  options?: string[] | null
  groupKey?: string | null
  groupLabel?: string | null
  sortOrder?: number
}

type VisibilityCatalogItem = {
  key: RequiredInfoFormKey
  label: string
  defaultVisible: boolean
  visible: boolean
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
        const marketingStructured = isMarketingIntakeField(question.fieldKey)
        const value = formResponses[question.fieldKey] ?? ''
        const isNa = !question.required && !structured && !marketingStructured && isFormFieldNa(value)
        const showNaToggle = !question.required && !structured && !marketingStructured
        const Shell = structured || marketingStructured || showNaToggle || question.inputType === 'fiscal-year-end' ? 'div' : 'label'
        const shellClass = question.inputType === 'textarea' || structured || marketingStructured ? 'md:col-span-2' : ''
        return (
          <Shell key={question.id} className={shellClass}>
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500">
                {question.label}
                {question.required && <span className="text-amber-600"> *</span>}
              </span>
              {showNaToggle && (
                <button
                  type="button"
                  onClick={() => onUpdate(question.fieldKey, isNa ? '' : FORM_FIELD_NA_VALUE)}
                  className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all ${
                    isNa
                      ? 'border-slate-400 bg-slate-100 text-slate-600'
                      : 'border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500'
                  }`}
                  aria-pressed={isNa}
                  title={isNa ? 'Clear N/A and enter a value' : 'Mark as not applicable'}
                >
                  N/A
                </button>
              )}
            </div>
            {question.description && (
              <span className="block text-[11px] text-slate-400 mt-0.5 whitespace-pre-line">{question.description}</span>
            )}
            {structured ? (
              <StructuredRowsInput
                question={question}
                value={value}
                onChange={value => onUpdate(question.fieldKey, value)}
                onError={onError}
              />
            ) : marketingStructured ? (
              <MarketingIntakeRows fieldKey={question.fieldKey} value={value} onChange={value => onUpdate(question.fieldKey, value)} />
            ) : isNa ? (
              <div className={`${commonClass} mt-1 bg-slate-50 text-slate-400 border-dashed`}>
                Not applicable
              </div>
            ) : question.inputType === 'fiscal-year-end' ? (
              <FiscalYearEndPicker value={value} onChange={next => onUpdate(question.fieldKey, next)} />
            ) : question.inputType === 'textarea' ? (
              <textarea
                value={value}
                onChange={e => onUpdate(question.fieldKey, e.target.value)}
                placeholder={question.placeholder ?? ''}
                className={`${commonClass} mt-1 min-h-[84px] resize-y`}
              />
            ) : question.inputType === 'select' ? (
              <select
                value={value}
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
                value={value}
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
  const NO_PROFESSIONAL_ADVISORS = '__NO_PROFESSIONAL_ADVISORS__'
  const fieldKey = question.fieldKey as StructuredFormFieldKey
  const columns = STRUCTURED_FORM_COLUMNS[fieldKey] ?? []
  const noProfessionalAdvisors = fieldKey === 'professionalAdvisorsList' && value === NO_PROFESSIONAL_ADVISORS
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
        {fieldKey === 'professionalAdvisorsList'
          ? 'Enter or edit professional advisor details in the table below.'
          : 'Download the Excel template, fill in rows, then upload or edit inline below.'}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {fieldKey === 'professionalAdvisorsList' && (
          <button
            type="button"
            onClick={() => onChange(noProfessionalAdvisors ? '' : NO_PROFESSIONAL_ADVISORS)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {noProfessionalAdvisors ? 'Add professional advisors' : 'No professional advisors'}
          </button>
        )}
        {/* Craig asked to remove the Excel download/upload options from Professional Advisors. */}
        {fieldKey !== 'professionalAdvisorsList' && <>
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
        </>}
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <Plus className="w-3.5 h-3.5" /> Add Row
        </button>
      </div>
      {!noProfessionalAdvisors && <div className="overflow-x-auto rounded-xl border border-slate-200">
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
      </div>}
    </div>
  )
}

function RequiredInfoQuestionnaireTab({
  client,
  setClient,
}: {
  client: Client
  setClient: Dispatch<SetStateAction<Client | null>>
}) {
  const [formQuestions, setFormQuestions] = useState<ClientPortalFormQuestion[]>([])
  const [formResponses, setFormResponses] = useState<Record<string, string>>({})
  const [visibilityCatalog, setVisibilityCatalog] = useState<VisibilityCatalogItem[]>(
    REQUIRED_INFO_FORM_CATALOG.map(item => ({
      key: item.key,
      label: item.label,
      defaultVisible: item.key === 'business_operations',
      visible: item.key === 'business_operations',
    })),
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingVisibility, setSavingVisibility] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const autoSaveSkipRef = useRef(true)

  useEffect(() => {
    let cancelled = false
    autoSaveSkipRef.current = true
    setLoading(true)
    async function loadFormQuestions() {
      try {
        const res = await fetch(`/api/client-form-questions?clientId=${encodeURIComponent(client.id)}&forAdvisor=1`)
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setFormQuestions(data.questions ?? [])
        setFormResponses(data.responses ?? {})
        if (Array.isArray(data.visibility?.catalog)) {
          setVisibilityCatalog(data.visibility.catalog)
        }
        setTimeout(() => { autoSaveSkipRef.current = false }, 0)
      } catch {
        if (!cancelled) setFormQuestions([])
      } finally {
        if (!cancelled) setLoading(false)
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

  async function saveFormResponses() {
    if (!formQuestions.length) return true
    // Advisors may save partial answers; required flags are enforced on the client portal only.
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
      setError(err instanceof Error ? err.message : 'Could not save information.')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function toggleFormVisibility(formKey: RequiredInfoFormKey) {
    const item = visibilityCatalog.find(entry => entry.key === formKey)
    if (!item || savingVisibility) return
    const nextVisible = !item.visible
    const nextClient = patchRequiredInfoVisibility(client, formKey, nextVisible, item.defaultVisible)
    setSavingVisibility(true)
    setError('')
    setVisibilityCatalog(prev => prev.map(entry => (
      entry.key === formKey ? { ...entry, visible: nextVisible } : entry
    )))
    setClient(nextClient)
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(client.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionSubmissions: nextClient.sectionSubmissions }),
      })
      if (!res.ok) throw new Error(await res.text())
    } catch (err) {
      setVisibilityCatalog(prev => prev.map(entry => (
        entry.key === formKey ? { ...entry, visible: item.visible } : entry
      )))
      setClient(client)
      setError(err instanceof Error ? err.message : 'Could not update Required Info visibility.')
    } finally {
      setSavingVisibility(false)
    }
  }

  useEffect(() => {
    if (autoSaveSkipRef.current || !formQuestions.length) return
    const timeout = setTimeout(() => {
      void saveFormResponses()
    }, 1200)
    return () => clearTimeout(timeout)
  }, [formResponses, formQuestions.length])

  const formLabelsMap = REQUIRED_INFO_FORM_LABELS as Record<string, string>
  // Visible (client-facing) sections first, then hidden — keeps the scroll row scannable.
  const sortedVisibilityCatalog = [...visibilityCatalog].sort((a, b) => {
    if (a.visible === b.visible) {
      return visibilityCatalog.findIndex(item => item.key === a.key) - visibilityCatalog.findIndex(item => item.key === b.key)
    }
    return a.visible ? -1 : 1
  })
  const allFormKeys = sortedVisibilityCatalog.map(item => item.key)
  const [activeFormTab, setActiveFormTab] = useState<string>('business_operations')

  useEffect(() => {
    if (allFormKeys.length && (!activeFormTab || !allFormKeys.includes(activeFormTab as RequiredInfoFormKey))) {
      setActiveFormTab(allFormKeys[0])
    }
  }, [allFormKeys.join('|'), activeFormTab])

  const currentIndex = allFormKeys.indexOf(activeFormTab as RequiredInfoFormKey)
  const hasNext = currentIndex !== -1 && currentIndex < allFormKeys.length - 1
  const activeVisibility = visibilityCatalog.find(item => item.key === activeFormTab)
  const tabScrollRef = useRef<HTMLDivElement | null>(null)
  const [tabScrollState, setTabScrollState] = useState({ canLeft: false, canRight: false })

  const updateTabScrollState = () => {
    const el = tabScrollRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    setTabScrollState({
      canLeft: el.scrollLeft > 4,
      canRight: maxScroll > 4 && el.scrollLeft < maxScroll - 4,
    })
  }

  useEffect(() => {
    updateTabScrollState()
    const el = tabScrollRef.current
    if (!el) return
    const onScroll = () => updateTabScrollState()
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', updateTabScrollState)
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', updateTabScrollState)
    }
  }, [sortedVisibilityCatalog.map(item => `${item.key}:${item.visible}`).join('|'), loading])

  const scrollTabs = (direction: 'left' | 'right') => {
    const el = tabScrollRef.current
    if (!el) return
    el.scrollBy({ left: direction === 'left' ? -220 : 220, behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div className="flex h-[350px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          <span className="text-xs text-slate-400 font-medium">Loading required info forms...</span>
        </div>
      </div>
    )
  }

  if (!formQuestions.length) {
    return (
      <Card className="p-6 text-sm text-slate-500">
        No required info forms are available yet.
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        Checked sections are visible in the client portal. Defaults follow this client&apos;s workstream/agents — toggle any section to show or hide it regardless of workstream.
      </div>

      <Card className="relative overflow-hidden">
        <div className="flex items-stretch gap-1 p-1">
          <button
            type="button"
            aria-label="Scroll sections left"
            disabled={!tabScrollState.canLeft}
            onClick={() => scrollTabs('left')}
            className={`shrink-0 self-center inline-flex h-8 w-8 items-center justify-center rounded-xl border transition-all ${
              tabScrollState.canLeft
                ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                : 'border-transparent text-slate-300 cursor-default'
            }`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div
            ref={tabScrollRef}
            className="min-w-0 flex-1 flex flex-nowrap gap-1 overflow-x-auto pb-1.5 [scrollbar-width:thin] [scrollbar-color:#c4b59a_#f1ebe3] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-cantara-beige/60 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#c4b59a]"
          >
            {sortedVisibilityCatalog.map(item => {
              const selected = activeFormTab === item.key
              return (
                <div
                  key={item.key}
                  className={`shrink-0 rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1.5 pl-2 pr-1 py-1 ${
                    selected ? 'text-white shadow-sm' : item.visible ? 'text-slate-700' : 'text-slate-400'
                  }`}
                  style={selected ? { background: '#0d1829' } : {}}
                >
                  <button
                    type="button"
                    aria-pressed={item.visible}
                    aria-label={`${item.visible ? 'Hide' : 'Show'} ${item.label} in client portal`}
                    disabled={savingVisibility}
                    onClick={() => void toggleFormVisibility(item.key)}
                    className={`inline-flex h-4 w-4 items-center justify-center rounded border transition-all disabled:opacity-60 ${
                      item.visible
                        ? selected
                          ? 'border-emerald-300 bg-emerald-400 text-white'
                          : 'border-emerald-500 bg-emerald-500 text-white'
                        : selected
                          ? 'border-white/40 bg-transparent text-transparent hover:border-white/70'
                          : 'border-slate-300 bg-white text-transparent hover:border-slate-400'
                    }`}
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFormTab(item.key)}
                    className={`whitespace-nowrap px-2 py-1 rounded-lg transition-all ${
                      selected ? 'text-white' : item.visible ? 'hover:bg-slate-50' : 'hover:text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </button>
                </div>
              )
            })}
          </div>

          <button
            type="button"
            aria-label="Scroll sections right"
            disabled={!tabScrollState.canRight}
            onClick={() => scrollTabs('right')}
            className={`shrink-0 self-center inline-flex h-8 w-8 items-center justify-center rounded-xl border transition-all ${
              tabScrollState.canRight
                ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                : 'border-transparent text-slate-300 cursor-default'
            }`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </Card>

      {activeFormTab !== '' && (
        <Card className="overflow-hidden">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-slate-800">{formLabelsMap[activeFormTab]}</h4>
              <p className="mt-1 text-xs text-slate-500">
                {activeVisibility && !activeVisibility.visible
                  ? 'Hidden from the client portal. Advisors can still fill it here, or check the box above to show it to the client.'
                  : activeFormTab === 'facility_review'
                    ? 'Fill the facility review answers here if the advisor team needs to enter them directly.'
                    : 'Fill or correct these client required-info answers directly from the advisor portal.'}
              </p>
            </div>
          </div>

          <div className="space-y-5 p-5">
            {buildOrderedFormQuestionGroups(
              formQuestions.filter(q => {
                if (activeFormTab === 'competitor_analysis') return q.agentId === 'competitor_analysis' || q.agentId === 'pricing_analysis'
                return q.agentId === activeFormTab
              }),
            ).map((group, index) => (
              <div key={group.groupLabel} className="space-y-3 border-t border-slate-100 pt-2 first:border-t-0 first:pt-0">
                {activeFormTab !== 'competitor_analysis' && (
                  <div>
                    <h5 className="text-sm font-bold text-slate-800">
                      {activeFormTab === 'facility_review' ? facilityReviewSubgroupLabel(group.groupLabel) : group.groupLabel}
                    </h5>
                    {group.groupLabel === 'Capacity Model' && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        Owner-stated total capacity is preferred. Daycare spots = Total – Boarding Runs if left blank.
                      </p>
                    )}
                  </div>
                )}
                {activeFormTab === 'competitor_analysis' ? (
                  <ClientCompetitorInputsFields
                    mode="competitor_analysis"
                    questions={group.questions}
                    formResponses={formResponses}
                    onUpdate={updateFormResponse}
                    onCompetitorsChange={replaceFormResponses}
                    FormQuestionFields={FormQuestionFields}
                    onError={setError}
                    showTopCompetitors={index === 0}
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
                    if (success) setActiveFormTab(allFormKeys[currentIndex + 1])
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

export default function AdminRequiredInfoTab({
  client,
  setClient,
}: {
  client: Client
  setClient: Dispatch<SetStateAction<Client | null>>
}) {
  // Per the onboarding discussion, replace the marketing questionnaire with
  // the Meeting Call while leaving other Required Info forms available.
  return (
    <div className="space-y-4">
      <RequiredInfoMeetingCall clientId={client.id} />
      <RequiredInfoQuestionnaireTab client={client} setClient={setClient} />
    </div>
  )
}
