'use client'

import React, { useState, useRef, useCallback, useMemo } from 'react'
import { Card, Badge, Button, cn } from '@/components/ui'
import {
  Search, Upload, FileText, AlertTriangle, Shield, ShieldAlert, ShieldCheck,
  ChevronDown, ChevronUp, ExternalLink, Calendar, Loader2, X, FileUp,
} from 'lucide-react'
import type { LitigationSearchResult } from '@/lib/litigation-search/search'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import { buildLitigationReportHtml } from '@/lib/report-export/build-litigation-report'

// ── US States ────────────────────────────────────────────────────────────────

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
  'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio',
  'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
  'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
  'Wisconsin','Wyoming',
]

// ── Helpers ──────────────────────────────────────────────────────────────────

const RISK_CONFIG = {
  high:   { color: 'red'   as const, icon: ShieldAlert, label: 'High Risk',  bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700' },
  medium: { color: 'gold'  as const, icon: AlertTriangle, label: 'Medium Risk', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  low:    { color: 'blue'  as const, icon: Shield, label: 'Low Risk',    bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700' },
  clear:  { color: 'green' as const, icon: ShieldCheck, label: 'Clear',       bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
}

const TYPE_LABELS: Record<string, { label: string; color: 'red' | 'gold' | 'blue' | 'slate' }> = {
  litigation: { label: 'Litigation', color: 'red' },
  lien:       { label: 'Lien',       color: 'gold' },
  judgment:   { label: 'Judgment',   color: 'red' },
  ucc_filing: { label: 'UCC Filing', color: 'blue' },
  bankruptcy: { label: 'Bankruptcy', color: 'red' },
  other:      { label: 'Other',      color: 'slate' },
}

// ── Finding card ─────────────────────────────────────────────────────────────

function FindingCard({ finding }: { finding: LitigationSearchResult['findings'][number] }) {
  const typeInfo = TYPE_LABELS[finding.type] || TYPE_LABELS.other
  const sevInfo = RISK_CONFIG[finding.severity] || RISK_CONFIG.low

  return (
    <div className="border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge color={typeInfo.color}>{typeInfo.label}</Badge>
          <Badge color={sevInfo.color}>{sevInfo.label}</Badge>
        </div>
        {finding.date && (
          <span className="flex items-center gap-1 text-xs text-slate-400 whitespace-nowrap">
            <Calendar className="w-3 h-3" />
            {finding.date}
          </span>
        )}
      </div>
      <h4 className="text-sm font-semibold text-slate-800 mb-1">{finding.title}</h4>
      <p className="text-xs text-slate-500 leading-relaxed mb-2">{finding.description}</p>
      {finding.source && (
        <div className="flex items-center gap-1 text-xs text-blue-600">
          <ExternalLink className="w-3 h-3" />
          {finding.source.startsWith('http') ? (
            <a href={finding.source} target="_blank" rel="noopener noreferrer" className="hover:underline truncate max-w-[300px]">
              {finding.source}
            </a>
          ) : (
            <span className="text-slate-400">{finding.source}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Results section ──────────────────────────────────────────────────────────

function ResultsSection({ title, result }: { title: string; result: LitigationSearchResult }) {
  const [showSearches, setShowSearches] = useState(false)
  const risk = RISK_CONFIG[result.riskLevel] || RISK_CONFIG.low
  const RiskIcon = risk.icon

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 tracking-tight">{title}</h3>
        <span className="text-[10px] text-slate-400">
          {new Date(result.generatedAt).toLocaleString()}
        </span>
      </div>

      {/* Risk badge */}
      <div className={cn('flex items-center gap-3 p-4 rounded-xl border', risk.bg, risk.border)}>
        <RiskIcon className={cn('w-5 h-5', risk.text)} />
        <div>
          <p className={cn('text-sm font-bold', risk.text)}>{risk.label}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {result.findings.length === 0 ? 'No public records found' : `${result.findings.length} finding${result.findings.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
        <p className="text-xs text-slate-600 leading-relaxed">{result.summary}</p>
      </div>

      {/* Findings */}
      {result.findings.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Findings</h4>
          {result.findings.map((f, i) => (
            <FindingCard key={i} finding={f} />
          ))}
        </div>
      )}

      {/* Searches performed */}
      {result.searchesPerformed.length > 0 && (
        <div>
          <button
            onClick={() => setShowSearches(!showSearches)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showSearches ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {result.searchesPerformed.length} searches performed
          </button>
          {showSearches && (
            <ul className="mt-2 space-y-1 pl-4">
              {result.searchesPerformed.map((s, i) => (
                <li key={i} className="text-xs text-slate-400 list-disc">{s}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function LitigationResultsEditor({
  title,
  result,
  onChange,
}: {
  title: string
  result: LitigationSearchResult
  onChange: (result: LitigationSearchResult) => void
}) {
  const patch = (updates: Partial<LitigationSearchResult>) => onChange({ ...result, ...updates })
  const updateFinding = (index: number, updates: Partial<LitigationSearchResult['findings'][number]>) => {
    patch({ findings: result.findings.map((finding, i) => (i === index ? { ...finding, ...updates } : finding)) })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-800 tracking-tight">{title}</h3>
        <select
          value={result.riskLevel}
          onChange={event => patch({ riskLevel: event.target.value as LitigationSearchResult['riskLevel'] })}
          className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-amber-100"
        >
          <option value="clear">Clear</option>
          <option value="low">Low Risk</option>
          <option value="medium">Medium Risk</option>
          <option value="high">High Risk</option>
        </select>
      </div>

      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Summary</p>
        <textarea
          value={result.summary}
          onChange={event => patch({ summary: event.target.value })}
          className="min-h-[110px] w-full rounded-xl border border-amber-300 bg-white p-3 text-xs leading-relaxed text-slate-700 outline-none focus:ring-2 focus:ring-amber-100"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Findings</p>
          <button
            className="text-xs font-semibold text-amber-700 hover:text-amber-800"
            onClick={() => patch({
              findings: [
                ...result.findings,
                { type: 'other', title: '', description: '', severity: 'low', source: '', date: '' },
              ],
            })}
          >
            + Add finding
          </button>
        </div>

        {result.findings.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
            No findings listed. Use Add finding if counsel identifies one manually.
          </div>
        ) : (
          result.findings.map((finding, index) => (
            <div key={index} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                <select
                  value={finding.type}
                  onChange={event => updateFinding(index, { type: event.target.value as any })}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs"
                >
                  {Object.keys(TYPE_LABELS).map(type => <option key={type} value={type}>{TYPE_LABELS[type].label}</option>)}
                </select>
                <select
                  value={finding.severity}
                  onChange={event => updateFinding(index, { severity: event.target.value as any })}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="clear">Clear</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <input
                  value={finding.date ?? ''}
                  onChange={event => updateFinding(index, { date: event.target.value })}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs"
                  placeholder="Date"
                />
                <button
                  className="justify-self-start text-xs text-red-500 hover:text-red-700 md:justify-self-end"
                  onClick={() => patch({ findings: result.findings.filter((_, i) => i !== index) })}
                >
                  Remove
                </button>
              </div>
              <input
                value={finding.title}
                onChange={event => updateFinding(index, { title: event.target.value })}
                className="mb-2 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold"
                placeholder="Finding title"
              />
              <textarea
                value={finding.description}
                onChange={event => updateFinding(index, { description: event.target.value })}
                className="mb-2 min-h-[80px] w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs leading-relaxed"
                placeholder="Description"
              />
              <input
                value={finding.source}
                onChange={event => updateFinding(index, { source: event.target.value })}
                className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs"
                placeholder="Source or URL"
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

interface LitigationSearchTabProps {
  clientId: string
  clientName: string
  businessAddress?: string
}

export default function LitigationSearchTab({ clientId, clientName, businessAddress }: LitigationSearchTabProps) {
  // Search form state
  const [businessName, setBusinessName] = useState(clientName)
  const [ownerName, setOwnerName] = useState('')
  const [state, setState] = useState('')
  const [county, setCounty] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<LitigationSearchResult | null>(null)
  const [searchError, setSearchError] = useState('')
  const [editMode, setEditMode] = useState(false)

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [docResult, setDocResult] = useState<LitigationSearchResult | null>(null)
  const [docError, setDocError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const reportHtml = useMemo(() => {
    const result = searchResult || docResult
    return result ? buildLitigationReportHtml(result, clientName) : ''
  }, [clientName, searchResult, docResult])

  // ── Search handler ─────────────────────────────────────────────────────────

  const handleSearch = useCallback(async () => {
    if (!businessName.trim() || !state) return
    setSearching(true)
    setSearchError('')
    setSearchResult(null)

    try {
      const res = await fetch('/api/litigation-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName: businessName.trim(), ownerName: ownerName.trim(), state, county: county.trim() }),
      })
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || `Error ${res.status}`)
      }
      const data: LitigationSearchResult = await res.json()
      setSearchResult(data)
      setEditMode(false)
    } catch (err: any) {
      setSearchError(err.message || 'Search failed')
    } finally {
      setSearching(false)
    }
  }, [businessName, ownerName, state, county])

  // ── Upload handler ─────────────────────────────────────────────────────────

  const handleAnalyze = useCallback(async () => {
    if (!uploadFile) return
    setAnalyzing(true)
    setDocError('')
    setDocResult(null)

    try {
      const formData = new FormData()
      formData.append('file', uploadFile)

      const res = await fetch('/api/litigation-search', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || `Error ${res.status}`)
      }
      const data: LitigationSearchResult = await res.json()
      setDocResult(data)
      setEditMode(false)
    } catch (err: any) {
      setDocError(err.message || 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }, [uploadFile])

  // ── Drag & drop ────────────────────────────────────────────────────────────

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && (file.type === 'application/pdf' || file.type.startsWith('image/'))) {
      setUploadFile(file)
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setUploadFile(file)
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 tracking-tight">Litigation & Lien Search</h2>
        <p className="text-xs text-slate-400 mt-1">
          Search public records and analyze uploaded documents for litigation, liens, judgments, UCC filings, and bankruptcy.
        </p>
        <p className="text-xs text-slate-400 mt-1">Lien search and court record documents can also be uploaded in the Documents tab.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Web Search Section ──────────────────────────────────────────────── */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Search className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-800">Public Records Search</h3>
          </div>

          {/* Legal Business Name */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Legal Business Name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400"
              placeholder="e.g. Downtown Dog Lounge LLC"
            />
          </div>

          {/* Owner Name */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Owner Name(s)</label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400"
              placeholder="e.g. John Smith"
            />
          </div>

          {/* State */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">State</label>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 bg-white"
            >
              <option value="">Select state...</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* County */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">County <span className="text-slate-300">(optional)</span></label>
            <input
              type="text"
              value={county}
              onChange={(e) => setCounty(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400"
              placeholder="e.g. Los Angeles"
            />
          </div>

          {/* Search button */}
          <Button
            onClick={handleSearch}
            disabled={searching || !businessName.trim() || !state}
            className="w-full justify-center"
          >
            {searching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching public records...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Search Public Records
              </>
            )}
          </Button>

          {searchError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-600">
              {searchError}
            </div>
          )}
        </Card>

        {/* ── Document Upload Section ─────────────────────────────────────────── */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-800">Document Analysis</h3>
          </div>

          <p className="text-xs text-slate-400">
            Upload court records, lien reports, or UCC search results for AI analysis.
          </p>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
              dragOver
                ? 'border-amber-400 bg-amber-50/50'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
            )}
          >
            <FileUp className={cn('w-8 h-8 mx-auto mb-2', dragOver ? 'text-amber-500' : 'text-slate-300')} />
            <p className="text-xs text-slate-500 font-medium">
              {dragOver ? 'Drop file here' : 'Drag & drop or click to upload'}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">PDF or image files</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Selected file */}
          {uploadFile && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="text-xs text-slate-600 truncate flex-1">{uploadFile.name}</span>
              <button
                onClick={() => { setUploadFile(null); setDocResult(null) }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Analyze button */}
          <Button
            onClick={handleAnalyze}
            disabled={analyzing || !uploadFile}
            variant="outline"
            className="w-full justify-center"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing document...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Analyze Document
              </>
            )}
          </Button>

          {docError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-600">
              {docError}
            </div>
          )}
        </Card>
      </div>

      {/* ── Results ─────────────────────────────────────────────────────────── */}
      {(searchResult || docResult) && (
        <Card className="p-6 space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Results</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setEditMode(!editMode)}
              >
                {editMode ? 'Preview Output' : 'Edit Output'}
              </Button>
              <ExportReportButton
                html={reportHtml}
                fileName={`litigation-report-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
                label="Export Litigation Report"
              />
            </div>
          </div>
          {editMode ? (
            <div className="space-y-8">
              {searchResult && (
                <LitigationResultsEditor title="Web Search Results" result={searchResult} onChange={setSearchResult} />
              )}
              {searchResult && docResult && <hr className="border-slate-100" />}
              {docResult && (
                <LitigationResultsEditor title="Document Analysis Results" result={docResult} onChange={setDocResult} />
              )}
            </div>
          ) : (
            <>
              {searchResult && (
                <ResultsSection title="Web Search Results" result={searchResult} />
              )}
              {searchResult && docResult && (
                <hr className="border-slate-100" />
              )}
              {docResult && (
                <ResultsSection title="Document Analysis Results" result={docResult} />
              )}
            </>
          )}
        </Card>
      )}
    </div>
  )
}
