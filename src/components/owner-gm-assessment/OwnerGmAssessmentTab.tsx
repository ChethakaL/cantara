'use client'
import { ClientApprovedEmptyState } from '@/components/client-portal/AgentClientPortalFrame'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bot, CheckCircle, FileText, Loader2, RefreshCw, Trash2, Upload,
  AlertTriangle, ShieldCheck, Info, Users2, Pencil, Save,
} from 'lucide-react'
import { Badge, Button, cn } from '@/components/ui'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import { AdvisorActions } from '@/components/client-portal/AgentClientPortalFrame'
import { buildOwnerGmReportHtml } from '@/lib/report-export/build-owner-gm-report'
import type {
  OwnerGmAssessment,
  OwnerProfile,
  GmProfile,
  SeniorTeamMember,
  AssessmentFlag,
  FlagSeverity,
} from '@/lib/owner-gm-assessment/types'

// ── Helpers ─────────────────────────────────────────────────────────────────

function ratingColor(rating: string): 'red' | 'gold' | 'green' | 'blue' | 'slate' {
  switch (rating) {
    case 'High': return 'red'
    case 'Medium': return 'gold'
    case 'Low': return 'green'
    case 'Strong': return 'green'
    case 'Moderate': return 'gold'
    case 'Thin': return 'red'
    default: return 'slate'
  }
}

function ratingBgClass(rating: string): string {
  switch (rating) {
    case 'High': return 'bg-red-50 border-red-200 text-red-700'
    case 'Medium': return 'bg-amber-50 border-amber-200 text-amber-700'
    case 'Low': return 'bg-emerald-50 border-emerald-200 text-emerald-700'
    case 'Strong': return 'bg-emerald-50 border-emerald-200 text-emerald-700'
    case 'Moderate': return 'bg-amber-50 border-amber-200 text-amber-700'
    case 'Thin': return 'bg-red-50 border-red-200 text-red-700'
    default: return 'bg-slate-50 border-slate-200 text-slate-700'
  }
}

function severityConfig(severity: FlagSeverity): { icon: typeof AlertTriangle; color: string; badgeColor: 'red' | 'gold' | 'green' | 'blue' | 'slate'; label: string } {
  switch (severity) {
    case 'deal-risk':
      return { icon: AlertTriangle, color: 'text-red-600 bg-red-50 border-red-200', badgeColor: 'red', label: 'Deal Risk' }
    case 'negotiation':
      return { icon: Info, color: 'text-amber-600 bg-amber-50 border-amber-200', badgeColor: 'gold', label: 'Negotiation' }
    case 'positive':
      return { icon: ShieldCheck, color: 'text-emerald-600 bg-emerald-50 border-emerald-200', badgeColor: 'green', label: 'Positive' }
    case 'informational':
      return { icon: Info, color: 'text-blue-600 bg-blue-50 border-blue-200', badgeColor: 'blue', label: 'Info' }
    default:
      return { icon: Info, color: 'text-slate-600 bg-slate-50 border-slate-200', badgeColor: 'slate', label: severity }
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1] || result
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function detectMediaType(file: File): string {
  if (file.type) return file.type
  const ext = file.name.toLowerCase().split('.').pop()
  switch (ext) {
    case 'pdf': return 'application/pdf'
    case 'txt': return 'text/plain'
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    case 'png': return 'image/png'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    default: return 'text/plain'
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export default function OwnerGmAssessmentTab({
  clientId,
  clientName = 'Client',
  readOnly = false,
}: {
  clientId: string
  clientName?: string
  readOnly?: boolean
}) {
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [assessment, setAssessment] = useState<OwnerGmAssessment | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedSnapshotRef = useRef('')

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // ── Load cached ──
  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent)
    if (!silent) setLoading(true)
    if (!silent) setError(null)
    try {
      const res = await fetch(`/api/owner-gm-assessment?clientId=${encodeURIComponent(clientId)}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load assessment')
      const data = await res.json()
      if (!mountedRef.current) return
      setAssessment(data.assessment ?? null)
    } catch (err: any) {
      if (!mountedRef.current) return
      setError(err?.message ?? 'Failed to load assessment')
    } finally {
      if (!silent && mountedRef.current) setLoading(false)
    }
  }, [clientId])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (assessment) lastSavedSnapshotRef.current = JSON.stringify(assessment)
  }, [assessment?.generatedAt])

  const persistAssessment = useCallback(async (nextAssessment: OwnerGmAssessment, options: { silent?: boolean } = {}) => {
    if (!options.silent) setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/owner-gm-assessment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, assessment: nextAssessment }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setAssessment(data.assessment)
      lastSavedSnapshotRef.current = JSON.stringify(data.assessment)
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } catch (err: any) {
      setError(err?.message || 'Failed to save assessment')
    } finally {
      if (!options.silent) setSaving(false)
    }
  }, [clientId])

  useEffect(() => {
    if (!editMode || !assessment) return
    const snapshot = JSON.stringify(assessment)
    if (snapshot === lastSavedSnapshotRef.current) return
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
    autoSaveTimeoutRef.current = setTimeout(() => {
      void persistAssessment(assessment, { silent: true })
    }, 800)
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
    }
  }, [assessment, editMode, persistAssessment])

  const updateAssessment = (updates: Partial<OwnerGmAssessment>) => {
    setAssessment(current => current ? { ...current, ...updates } : current)
  }

  // ── Upload & analyze ──
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setRunning(true)
    setError(null)
    setFileName(file.name)
    try {
      const base64 = await fileToBase64(file)
      const mediaType = detectMediaType(file)
      const res = await fetch('/api/owner-gm-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, fileName: file.name, base64, mediaType }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || 'Analysis failed')
      }
      const data = await res.json()
      if (mountedRef.current) {
        setAssessment(data.assessment)
        lastSavedSnapshotRef.current = JSON.stringify(data.assessment)
      }
    } catch (err: any) {
      if (mountedRef.current) setError(err?.message ?? 'Analysis failed')
    } finally {
      if (mountedRef.current) setRunning(false)
    }
  }

  // ── Reset ──
  const resetAssessment = async () => {
    setDeleting(true)
    setError(null)
    setAssessment(null)
    setFileName(null)
    try {
      const res = await fetch(`/api/owner-gm-assessment?clientId=${encodeURIComponent(clientId)}`, {
        method: 'DELETE',
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Failed to reset assessment')
      await load({ silent: true })
    } catch (err: any) {
      await load({ silent: true })
      if (mountedRef.current) setError(err?.message ?? 'Failed to reset assessment')
    } finally {
      if (mountedRef.current) setDeleting(false)
    }
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    )
  }

  if (readOnly && !assessment) {
    return <ClientApprovedEmptyState agentName="Owner & GM Assessment" />
  }

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-200">
                <Users2 className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Owner & GM Involvement Assessment</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Upload a call transcript to analyze owner dependency, GM retention risk, and management bench strength against the 40-question framework.
                </p>
              </div>
            </div>
          </div>
          <AdvisorActions className="flex items-center gap-2">
            {assessment && (
              <Button
                size="sm"
                variant="danger"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); void resetAssessment() }}
                disabled={running || deleting}
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {deleting ? 'Deleting...' : 'Reset'}
              </Button>
            )}
          </AdvisorActions>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Upload area (no assessment yet) */}
      {!readOnly && !assessment && !running && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center space-y-3">
          <FileText className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-medium text-slate-600">No transcript uploaded yet</p>
          <p className="text-xs text-slate-400">Upload a call transcript (PDF, TXT, or DOCX) to run the Owner & GM Involvement Assessment.</p>
          <div className="mt-4 text-center">
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-medium cursor-pointer hover:bg-indigo-100 transition-colors">
              <Upload className="w-3.5 h-3.5" />
              Upload Transcript
              <input
                type="file"
                accept=".pdf,.txt,.docx,.doc,.png,.jpg,.jpeg"
                className="hidden"
                onChange={handleFileUpload}
                disabled={running}
              />
            </label>
          </div>
        </div>
      )}

      {/* Running state */}
      {running && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-10 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-indigo-400 mx-auto animate-spin" />
          <p className="text-sm font-medium text-indigo-700">Analyzing transcript...</p>
          <p className="text-xs text-indigo-500">
            {fileName ? `Processing ${fileName}` : 'Running the 40-question assessment framework'}. This may take 30-60 seconds.
          </p>
        </div>
      )}

      {/* Results */}
      {assessment && (
        <>
          {/* Ratings strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Owner Dependency', value: assessment.ownerDependencyRating, key: 'ownerDependencyRating', options: ['High', 'Medium', 'Low'] },
              { label: 'GM Retention Risk', value: assessment.gmRetentionRisk, key: 'gmRetentionRisk', options: ['High', 'Medium', 'Low'] },
              { label: 'Bench Strength', value: assessment.benchStrength, key: 'benchStrength', options: ['Strong', 'Moderate', 'Thin'] },
              { label: 'Transition Readiness', value: assessment.overallTransitionReadiness, key: 'overallTransitionReadiness', options: ['High', 'Medium', 'Low'] },
            ].map(item => (
              <div
                key={item.label}
                className={cn('rounded-xl border p-4 text-center flex flex-col justify-between items-center min-h-[90px]', ratingBgClass(item.value))}
              >
                <p className="text-[11px] uppercase tracking-wide opacity-70 font-medium">{item.label}</p>
                {editMode ? (
                  <select
                    value={item.value}
                    onChange={e => updateAssessment({ [item.key]: e.target.value })}
                    className="mt-1 text-xs rounded border border-slate-200 bg-white px-2 py-1 outline-none font-semibold text-slate-700"
                  >
                    {item.options.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-lg font-bold mt-1">{item.value}</p>
                )}
              </div>
            ))}
          </div>

          {/* Export button */}
          <AdvisorActions className="flex justify-end">
            {!readOnly && (
              <Button
                size="sm"
                variant={editMode ? 'primary' : 'outline'}
                onClick={() => {
                  if (editMode && assessment) void persistAssessment(assessment)
                  setEditMode(!editMode)
                }}
                disabled={saving}
              >
                {editMode ? <Save className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                {saving ? 'Saving...' : editMode ? 'Done Editing' : 'Edit Output'}
              </Button>
            )}
            <ExportReportButton
              html={buildOwnerGmReportHtml(assessment, clientName)}
              fileName={`owner-gm-assessment-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
            />
            {saved && <span className="text-xs font-semibold text-emerald-600">Saved</span>}
          </AdvisorActions>

          {/* Executive Summary */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium">
              <CheckCircle className="w-4 h-4" />
              Executive Summary
            </div>
            {editMode ? (
              <textarea
                value={assessment.executiveSummary}
                onChange={e => updateAssessment({ executiveSummary: e.target.value })}
                rows={5}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 text-slate-700 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
              />
            ) : (
              <p className="text-sm text-slate-700 leading-relaxed">{assessment.executiveSummary}</p>
            )}
          </div>

          {/* Owner Profiles */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-800">Owner Profiles</h4>
              {editMode && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newOwner: OwnerProfile = {
                      name: 'New Owner',
                      title: 'Owner',
                      role: '',
                      hoursPerWeek: null,
                      criticalHoursPerWeek: null,
                      postCloseIntention: null,
                      postCloseRole: '',
                      postCloseDuration: '',
                      stayRequired: null,
                      criticalRelationships: [],
                      replacementRoles: [],
                      replacementExperience: '',
                      replacementHours: null,
                      internalSuccessor: '',
                      externalHireCost: '',
                      dependencyRating: 'Medium',
                      dependencyNotes: '',
                    }
                    updateAssessment({ owners: [...assessment.owners, newOwner] })
                  }}
                >
                  + Add Owner Profile
                </Button>
              )}
            </div>
            {assessment.owners.map((owner, idx) => (
              <OwnerCard
                key={idx}
                owner={owner}
                editMode={editMode}
                onChange={nextOwner => {
                  const owners = [...assessment.owners]
                  owners[idx] = nextOwner
                  updateAssessment({ owners })
                }}
                onDelete={() => {
                  const owners = assessment.owners.filter((_, i) => i !== idx)
                  updateAssessment({ owners })
                }}
              />
            ))}
          </div>

          {/* GM Profile */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <h4 className="text-sm font-semibold text-slate-800">General Manager Profile</h4>
            <GmCard gm={assessment.gm} editMode={editMode} onChange={gm => updateAssessment({ gm })} />
          </div>

          {/* Senior Team */}
          {(assessment.seniorTeam.length > 0 || editMode) && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-800">Senior Management Bench</h4>
                {editMode && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const newMember: SeniorTeamMember = {
                        name: 'New Member',
                        title: '',
                        tenure: '',
                        responsibilities: '',
                        hourlyOrSalaried: null,
                        couldStepUp: null,
                      }
                      updateAssessment({ seniorTeam: [...assessment.seniorTeam, newMember] })
                    }}
                  >
                    + Add Member
                  </Button>
                )}
              </div>
              {assessment.seniorTeam.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Name</th>
                        <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Title</th>
                        <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Tenure</th>
                        <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Responsibilities</th>
                        <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Type</th>
                        <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Could Step Up</th>
                        {editMode && <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {assessment.seniorTeam.map((member, idx) => (
                        <tr key={idx} className="border-b border-slate-100">
                          <td className="py-2 px-3 font-medium text-slate-700">
                            {editMode ? (
                              <InlineInput
                                value={member.name}
                                onChange={value => {
                                  const seniorTeam = [...assessment.seniorTeam]
                                  seniorTeam[idx] = { ...member, name: value }
                                  updateAssessment({ seniorTeam })
                                }}
                              />
                            ) : member.name || '—'}
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {editMode ? (
                              <InlineInput
                                value={member.title}
                                onChange={value => {
                                  const seniorTeam = [...assessment.seniorTeam]
                                  seniorTeam[idx] = { ...member, title: value }
                                  updateAssessment({ seniorTeam })
                                }}
                              />
                            ) : member.title || '—'}
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {editMode ? (
                              <InlineInput
                                value={member.tenure}
                                onChange={value => {
                                  const seniorTeam = [...assessment.seniorTeam]
                                  seniorTeam[idx] = { ...member, tenure: value }
                                  updateAssessment({ seniorTeam })
                                }}
                              />
                            ) : member.tenure || '—'}
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {editMode ? (
                              <InlineInput
                                value={member.responsibilities}
                                onChange={value => {
                                  const seniorTeam = [...assessment.seniorTeam]
                                  seniorTeam[idx] = { ...member, responsibilities: value }
                                  updateAssessment({ seniorTeam })
                                }}
                              />
                            ) : member.responsibilities || '—'}
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {editMode ? (
                              <select
                                value={member.hourlyOrSalaried || ''}
                                onChange={e => {
                                  const seniorTeam = [...assessment.seniorTeam]
                                  seniorTeam[idx] = { ...member, hourlyOrSalaried: (e.target.value || null) as any }
                                  updateAssessment({ seniorTeam })
                                }}
                                className="text-xs rounded border border-slate-200 bg-white px-1 py-0.5 outline-none font-medium text-slate-700"
                              >
                                <option value="">—</option>
                                <option value="Hourly">Hourly</option>
                                <option value="Salaried">Salaried</option>
                              </select>
                            ) : member.hourlyOrSalaried || '—'}
                          </td>
                          <td className="py-2 px-3">
                            {editMode ? (
                              <select
                                value={member.couldStepUp === true ? 'true' : member.couldStepUp === false ? 'false' : ''}
                                onChange={e => {
                                  const seniorTeam = [...assessment.seniorTeam]
                                  seniorTeam[idx] = { ...member, couldStepUp: e.target.value === 'true' ? true : e.target.value === 'false' ? false : null }
                                  updateAssessment({ seniorTeam })
                                }}
                                className="text-xs rounded border border-slate-200 bg-white px-1 py-0.5 outline-none font-medium text-slate-700"
                              >
                                <option value="">—</option>
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                              </select>
                            ) : member.couldStepUp === true ? (
                              <Badge color="green">Yes</Badge>
                            ) : member.couldStepUp === false ? (
                              <Badge color="red">No</Badge>
                            ) : (
                              <Badge color="slate">Unknown</Badge>
                            )}
                          </td>
                          {editMode && (
                            <td className="py-2 px-3">
                              <button
                                type="button"
                                className="text-rose-500 hover:text-rose-700"
                                onClick={() => {
                                  const seniorTeam = assessment.seniorTeam.filter((_, i) => i !== idx)
                                  updateAssessment({ seniorTeam })
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-400">No senior team members defined. Click "+ Add Member" to add one.</p>
              )}
            </div>
          )}

          {/* Flags */}
          {(assessment.flags.length > 0 || editMode) && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-800">Assessment Flags</h4>
                {editMode && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const newFlag: AssessmentFlag = {
                        id: `flag-${Date.now()}`,
                        section: 'General',
                        severity: 'informational',
                        title: 'New Flag',
                        description: 'Flag description',
                      }
                      updateAssessment({ flags: [...assessment.flags, newFlag] })
                    }}
                  >
                    + Add Flag
                  </Button>
                )}
              </div>
              {assessment.flags.length > 0 ? (
                <div className="space-y-2">
                  {assessment.flags.map((flag, idx) => (
                    <div key={flag.id} className="relative">
                      {editMode ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 grid grid-cols-2 gap-2">
                              <select
                                value={flag.section}
                                onChange={e => {
                                  const flags = [...assessment.flags]
                                  flags[idx] = { ...flag, section: e.target.value as any }
                                  updateAssessment({ flags })
                                }}
                                className="text-xs rounded border border-slate-200 bg-white px-2 py-1 outline-none font-medium text-slate-700"
                              >
                                <option value="Owner">Owner</option>
                                <option value="GM">GM</option>
                                <option value="Bench">Bench</option>
                                <option value="General">General</option>
                              </select>
                              <select
                                value={flag.severity}
                                onChange={e => {
                                  const flags = [...assessment.flags]
                                  flags[idx] = { ...flag, severity: e.target.value as any }
                                  updateAssessment({ flags })
                                }}
                                className="text-xs rounded border border-slate-200 bg-white px-2 py-1 outline-none font-medium text-slate-700"
                              >
                                <option value="deal-risk">Deal Risk</option>
                                <option value="negotiation">Negotiation</option>
                                <option value="positive">Positive</option>
                                <option value="informational">Info</option>
                              </select>
                            </div>
                            <button
                              type="button"
                              className="text-rose-500 hover:text-rose-700"
                              onClick={() => {
                                const flags = assessment.flags.filter((_, i) => i !== idx)
                                updateAssessment({ flags })
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <InlineInput
                            value={flag.title}
                            onChange={value => {
                              const flags = [...assessment.flags]
                              flags[idx] = { ...flag, title: value }
                              updateAssessment({ flags })
                            }}
                          />
                          <InlineTextarea
                            value={flag.description}
                            onChange={value => {
                              const flags = [...assessment.flags]
                              flags[idx] = { ...flag, description: value }
                              updateAssessment({ flags })
                            }}
                          />
                        </div>
                      ) : (
                        <FlagItem flag={flag} />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No assessment flags. Click "+ Add Flag" to add one.</p>
              )}
            </div>
          )}

          {/* Recommendations */}
          {(assessment.recommendations.length > 0 || editMode) && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-800">Recommendations</h4>
                {editMode && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      updateAssessment({ recommendations: [...assessment.recommendations, 'New Recommendation'] })
                    }}
                  >
                    + Add Recommendation
                  </Button>
                )}
              </div>
              {assessment.recommendations.length > 0 ? (
                <ol className="list-decimal list-inside space-y-2">
                  {assessment.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-sm text-slate-700 leading-relaxed">
                      {editMode ? (
                        <div className="inline-flex items-center gap-2 w-[90%]">
                          <InlineInput
                            value={rec}
                            onChange={value => {
                              const recommendations = [...assessment.recommendations]
                              recommendations[idx] = value
                              updateAssessment({ recommendations })
                            }}
                          />
                          <button
                            type="button"
                            className="text-rose-500 hover:text-rose-700 flex-shrink-0"
                            onClick={() => {
                              const recommendations = assessment.recommendations.filter((_, i) => i !== idx)
                              updateAssessment({ recommendations })
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : rec}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-xs text-slate-400">No recommendations. Click "+ Add Recommendation" to add one.</p>
              )}
            </div>
          )}

          {/* Counsel Items */}
          {(assessment.counselItems.length > 0 || editMode) && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-800">Counsel Items</h4>
                {editMode && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      updateAssessment({ counselItems: [...assessment.counselItems, 'New Counsel Item'] })
                    }}
                  >
                    + Add Counsel Item
                  </Button>
                )}
              </div>
              {assessment.counselItems.length > 0 ? (
                <ul className="list-disc list-inside space-y-1">
                  {assessment.counselItems.map((item, idx) => (
                    <li key={idx} className="text-sm text-slate-600">
                      {editMode ? (
                        <div className="inline-flex items-center gap-2 w-[90%]">
                          <InlineInput
                            value={item}
                            onChange={value => {
                              const counselItems = [...assessment.counselItems]
                              counselItems[idx] = value
                              updateAssessment({ counselItems })
                            }}
                          />
                          <button
                            type="button"
                            className="text-rose-500 hover:text-rose-700 flex-shrink-0"
                            onClick={() => {
                              const counselItems = assessment.counselItems.filter((_, i) => i !== idx)
                              updateAssessment({ counselItems })
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">No counsel items. Click "+ Add Counsel Item" to add one.</p>
              )}
            </div>
          )}

          {/* Re-upload option */}
          <div className="flex justify-center">
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-medium cursor-pointer hover:bg-slate-50 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
              Upload New Transcript
              <input
                type="file"
                accept=".pdf,.txt,.docx,.doc,.png,.jpg,.jpeg"
                className="hidden"
                onChange={handleFileUpload}
                disabled={running}
              />
            </label>
          </div>
        </>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function InlineInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
    />
  )
}

function InlineTextarea({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <textarea
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      rows={3}
      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs leading-5 text-slate-700 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
    />
  )
}

function OwnerCard({
  owner,
  editMode = false,
  onChange,
  onDelete,
}: {
  owner: OwnerProfile
  editMode?: boolean
  onChange?: (owner: OwnerProfile) => void
  onDelete?: () => void
}) {
  const patch = (updates: Partial<OwnerProfile>) => onChange?.({ ...owner, ...updates })
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3 relative">
      {editMode && onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="absolute top-2 right-2 text-rose-500 hover:text-rose-700"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
      <div className="flex items-center justify-between">
        <div className="w-[70%]">
          {editMode ? (
            <div className="space-y-1">
              <InlineInput value={owner.name} onChange={value => patch({ name: value })} />
              <InlineInput value={owner.title} onChange={value => patch({ title: value })} />
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-800">{owner.name || 'Owner'}</p>
              <p className="text-xs text-slate-500">{owner.title}{owner.role ? ` — ${owner.role}` : ''}</p>
            </>
          )}
        </div>
        <div className="flex-shrink-0">
          {editMode ? (
            <select
              value={owner.dependencyRating}
              onChange={e => patch({ dependencyRating: e.target.value as any })}
              className="text-xs rounded border border-slate-200 bg-white px-2 py-1 outline-none font-medium text-slate-700"
            >
              <option value="High">High Dependency</option>
              <option value="Medium">Medium Dependency</option>
              <option value="Low">Low Dependency</option>
            </select>
          ) : (
            <Badge color={ratingColor(owner.dependencyRating)}>{owner.dependencyRating} Dependency</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <InfoCell
          label="Hours/Week"
          value={owner.hoursPerWeek != null ? `${owner.hoursPerWeek}` : '—'}
          editMode={editMode}
          onChange={value => patch({ hoursPerWeek: value ? parseInt(value) || 0 : null })}
        />
        <InfoCell
          label="Critical Hours"
          value={owner.criticalHoursPerWeek != null ? `${owner.criticalHoursPerWeek}` : '—'}
          editMode={editMode}
          onChange={value => patch({ criticalHoursPerWeek: value ? parseInt(value) || 0 : null })}
        />
        <InfoCell
          label="Post-Close"
          value={owner.postCloseIntention || '—'}
          editMode={editMode}
        >
          <select
            value={owner.postCloseIntention || ''}
            onChange={e => patch({ postCloseIntention: (e.target.value || null) as any })}
            className="w-full text-xs rounded border border-slate-200 bg-white px-1.5 py-0.5 outline-none mt-0.5"
          >
            <option value="">—</option>
            <option value="stay">Stay</option>
            <option value="exit">Exit</option>
            <option value="undecided">Undecided</option>
          </select>
        </InfoCell>
        <InfoCell
          label="Stay Required"
          value={owner.stayRequired === true ? 'Yes' : owner.stayRequired === false ? 'No' : '—'}
          editMode={editMode}
        >
          <select
            value={owner.stayRequired === true ? 'true' : owner.stayRequired === false ? 'false' : ''}
            onChange={e => patch({ stayRequired: e.target.value === 'true' ? true : e.target.value === 'false' ? false : null })}
            className="w-full text-xs rounded border border-slate-200 bg-white px-1.5 py-0.5 outline-none mt-0.5"
          >
            <option value="">—</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </InfoCell>
      </div>

      {(owner.postCloseRole || editMode) && (
        <div className="grid grid-cols-2 gap-2">
          <InfoCell label="Post-Close Role" value={owner.postCloseRole} editMode={editMode} onChange={value => patch({ postCloseRole: value })} />
          <InfoCell label="Post-Close Duration" value={owner.postCloseDuration || '—'} editMode={editMode} onChange={value => patch({ postCloseDuration: value })} />
        </div>
      )}

      {(owner.criticalRelationships.length > 0 || editMode) && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Critical Relationships</p>
          {editMode ? (
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-1">
                {owner.criticalRelationships.map((rel, i) => (
                  <span key={i} className="text-xs bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-600 flex items-center gap-1">
                    {rel}
                    <button
                      type="button"
                      className="text-red-500 hover:text-red-700 font-bold"
                      onClick={() => {
                        const criticalRelationships = owner.criticalRelationships.filter((_, idx) => idx !== i)
                        patch({ criticalRelationships })
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                placeholder="Add critical relationship (Press Enter)..."
                className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none bg-white text-slate-700"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const val = e.currentTarget.value.trim()
                    if (val && !owner.criticalRelationships.includes(val)) {
                      patch({ criticalRelationships: [...owner.criticalRelationships, val] })
                      e.currentTarget.value = ''
                    }
                  }
                }}
              />
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {owner.criticalRelationships.map((rel, i) => (
                <span key={i} className="text-xs bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-600">{rel}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {(owner.replacementRoles.length > 0 || editMode) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <InfoCell
            label="Replacement Roles (comma separated)"
            value={owner.replacementRoles.join(', ')}
            editMode={editMode}
            onChange={value => patch({ replacementRoles: value.split(',').map(item => item.trim()).filter(Boolean) })}
          />
          <InfoCell
            label="Experience Needed"
            value={owner.replacementExperience || '—'}
            editMode={editMode}
            onChange={value => patch({ replacementExperience: value })}
          />
          <InfoCell
            label="External Hire Cost"
            value={owner.externalHireCost || '—'}
            editMode={editMode}
            onChange={value => patch({ externalHireCost: value })}
          />
        </div>
      )}

      {(owner.internalSuccessor || editMode) && (
        <InfoCell
          label="Internal Successor"
          value={owner.internalSuccessor || '—'}
          editMode={editMode}
          onChange={value => patch({ internalSuccessor: value })}
        />
      )}

      {(owner.dependencyNotes || editMode) && (
        editMode
          ? <InlineTextarea value={owner.dependencyNotes} onChange={value => patch({ dependencyNotes: value })} />
          : <p className="text-xs text-slate-500 italic">{owner.dependencyNotes}</p>
      )}
    </div>
  )
}

function GmCard({ gm, editMode = false, onChange }: { gm: GmProfile; editMode?: boolean; onChange?: (gm: GmProfile) => void }) {
  const patch = (updates: Partial<GmProfile>) => onChange?.({ ...gm, ...updates })

  if (editMode) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <label className="text-xs font-semibold text-slate-700">General Manager in Place?</label>
          <select
            value={gm.inPlace ? 'true' : 'false'}
            onChange={e => patch({ inPlace: e.target.value === 'true' })}
            className="text-xs rounded border border-slate-200 bg-white px-2 py-1 outline-none font-semibold text-slate-700"
          >
            <option value="true">Yes</option>
            <option value="false">No (Vacant/Risk)</option>
          </select>
        </div>

        {gm.inPlace && (
          <>
            <div className="flex items-center justify-between">
              <div className="w-[70%]">
                <InlineInput value={gm.name} onChange={value => patch({ name: value })} />
              </div>
              <select
                value={gm.retentionRiskRating}
                onChange={e => patch({ retentionRiskRating: e.target.value as any })}
                className="text-xs rounded border border-slate-200 bg-white px-2 py-1 outline-none font-medium text-slate-700"
              >
                <option value="High">High Retention Risk</option>
                <option value="Medium">Medium Retention Risk</option>
                <option value="Low">Low Retention Risk</option>
              </select>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <InfoCell label="Total Tenure" value={gm.totalTenure || '—'} editMode={editMode} onChange={value => patch({ totalTenure: value })} />
              <InfoCell label="GM Tenure" value={gm.gmTenure || '—'} editMode={editMode} onChange={value => patch({ gmTenure: value })} />
              <InfoCell label="Compensation" value={gm.compensation || '—'} editMode={editMode} onChange={value => patch({ compensation: value })} />
              <InfoCell label="Market Aligned" value={gm.marketAligned || '—'} editMode={editMode}>
                <select
                  value={gm.marketAligned || 'Unknown'}
                  onChange={e => patch({ marketAligned: e.target.value as any })}
                  className="w-full text-xs rounded border border-slate-200 bg-white px-1.5 py-0.5 outline-none mt-0.5"
                >
                  <option value="Unknown">Unknown</option>
                  <option value="Above">Above</option>
                  <option value="At Market">At Market</option>
                  <option value="Below">Below</option>
                </select>
              </InfoCell>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <InfoCell label="Employment Type" value={gm.fullOrPartTime || '—'} editMode={editMode}>
                <select
                  value={gm.fullOrPartTime || ''}
                  onChange={e => patch({ fullOrPartTime: (e.target.value || null) as any })}
                  className="w-full text-xs rounded border border-slate-200 bg-white px-1.5 py-0.5 outline-none mt-0.5"
                >
                  <option value="">—</option>
                  <option value="Full-Time">Full-Time</option>
                  <option value="Part-Time">Part-Time</option>
                </select>
              </InfoCell>
              <InfoCell label="Pay Type" value={gm.hourlyOrSalaried || '—'} editMode={editMode}>
                <select
                  value={gm.hourlyOrSalaried || ''}
                  onChange={e => patch({ hourlyOrSalaried: (e.target.value || null) as any })}
                  className="w-full text-xs rounded border border-slate-200 bg-white px-1.5 py-0.5 outline-none mt-0.5"
                >
                  <option value="">—</option>
                  <option value="Hourly">Hourly</option>
                  <option value="Salaried">Salaried</option>
                </select>
              </InfoCell>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Independence Score (1-10)</p>
              <input
                type="number"
                min={1}
                max={10}
                value={gm.independenceScore ?? ''}
                onChange={e => patch({ independenceScore: e.target.value ? parseInt(e.target.value) : null })}
                className="w-20 rounded border border-slate-200 px-2 py-1 text-xs outline-none bg-white text-slate-700"
              />
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Day-to-Day Ownership</p>
              <InlineTextarea value={gm.dayToDayOwnership} onChange={value => patch({ dayToDayOwnership: value })} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-emerald-500 font-semibold mb-1">Strengths</p>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap gap-1">
                    {gm.strengths.map((s, i) => (
                      <span key={i} className="text-xs bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-600 flex items-center gap-1">
                        {s}
                        <button
                          type="button"
                          className="text-red-500 hover:text-red-700 font-bold"
                          onClick={() => {
                            const strengths = gm.strengths.filter((_, idx) => idx !== i)
                            patch({ strengths })
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Add strength (Press Enter)..."
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none bg-white text-slate-700"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const val = e.currentTarget.value.trim()
                        if (val && !gm.strengths.includes(val)) {
                          patch({ strengths: [...gm.strengths, val] })
                          e.currentTarget.value = ''
                        }
                      }
                    }}
                  />
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-amber-500 font-semibold mb-1">Development Areas</p>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap gap-1">
                    {gm.gaps.map((g, i) => (
                      <span key={i} className="text-xs bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-600 flex items-center gap-1">
                        {g}
                        <button
                          type="button"
                          className="text-red-500 hover:text-red-700 font-bold"
                          onClick={() => {
                            const gaps = gm.gaps.filter((_, idx) => idx !== i)
                            patch({ gaps })
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Add development area (Press Enter)..."
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none bg-white text-slate-700"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const val = e.currentTarget.value.trim()
                        if (val && !gm.gaps.includes(val)) {
                          patch({ gaps: [...gm.gaps, val] })
                          e.currentTarget.value = ''
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Solo Operation Experience</p>
              <div className="space-y-1.5">
                <InlineInput value={gm.soloExperience} onChange={value => patch({ soloExperience: value })} />
                <InlineInput value={gm.soloOutcome} onChange={value => patch({ soloOutcome: value })} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Sale Awareness & Retention</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <InfoCell label="Aware of Sale" value={gm.awareOfSale === true ? 'Yes' : gm.awareOfSale === false ? 'No' : '—'} editMode={editMode}>
                  <select
                    value={gm.awareOfSale === true ? 'true' : gm.awareOfSale === false ? 'false' : ''}
                    onChange={e => patch({ awareOfSale: e.target.value === 'true' ? true : e.target.value === 'false' ? false : null })}
                    className="w-full text-xs rounded border border-slate-200 bg-white px-1.5 py-0.5 outline-none mt-0.5"
                  >
                    <option value="">—</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </InfoCell>
                <InfoCell label="Retention Conv." value={gm.retentionConversation === true ? 'Yes' : gm.retentionConversation === false ? 'No' : '—'} editMode={editMode}>
                  <select
                    value={gm.retentionConversation === true ? 'true' : gm.retentionConversation === false ? 'false' : ''}
                    onChange={e => patch({ retentionConversation: e.target.value === 'true' ? true : e.target.value === 'false' ? false : null })}
                    className="w-full text-xs rounded border border-slate-200 bg-white px-1.5 py-0.5 outline-none mt-0.5"
                  >
                    <option value="">—</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </InfoCell>
                <InfoCell label="Supportive" value={gm.supportive === true ? 'Yes' : gm.supportive === false ? 'No' : '—'} editMode={editMode}>
                  <select
                    value={gm.supportive === true ? 'true' : gm.supportive === false ? 'false' : ''}
                    onChange={e => patch({ supportive: e.target.value === 'true' ? true : e.target.value === 'false' ? false : null })}
                    className="w-full text-xs rounded border border-slate-200 bg-white px-1.5 py-0.5 outline-none mt-0.5"
                  >
                    <option value="">—</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </InfoCell>
                <InfoCell label="Commitment" value={gm.retentionCommitment || '—'} editMode={editMode}>
                  <select
                    value={gm.retentionCommitment || ''}
                    onChange={e => patch({ retentionCommitment: (e.target.value || 'Unknown') as any })}
                    className="w-full text-xs rounded border border-slate-200 bg-white px-1.5 py-0.5 outline-none mt-0.5"
                  >
                    <option value="Unknown">Unknown</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </InfoCell>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wider text-amber-500 font-semibold mb-1">Hesitations</p>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap gap-1">
                    {gm.hesitations.map((h, i) => (
                      <span key={i} className="text-xs bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-600 flex items-center gap-1">
                        {h}
                        <button
                          type="button"
                          className="text-red-500 hover:text-red-700 font-bold"
                          onClick={() => {
                            const hesitations = gm.hesitations.filter((_, idx) => idx !== i)
                            patch({ hesitations })
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Add hesitation (Press Enter)..."
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none bg-white text-slate-700"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const val = e.currentTarget.value.trim()
                        if (val && !gm.hesitations.includes(val)) {
                          patch({ hesitations: [...gm.hesitations, val] })
                          e.currentTarget.value = ''
                        }
                      }
                    }}
                  />
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Retention Notes</p>
                <InlineTextarea value={gm.retentionNotes} onChange={value => patch({ retentionNotes: value })} />
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  if (!gm.inPlace) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
        <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-2" />
        <p className="text-sm font-semibold text-red-700">No General Manager in Place</p>
        <p className="text-xs text-red-600 mt-1">This is a significant transition risk flag.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">{gm.name || 'General Manager'}</p>
          <p className="text-xs text-slate-500">{gm.fullOrPartTime || ''} {gm.hourlyOrSalaried ? `/ ${gm.hourlyOrSalaried}` : ''}</p>
        </div>
        <Badge color={ratingColor(gm.retentionRiskRating)}>{gm.retentionRiskRating} Retention Risk</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <InfoCell label="Total Tenure" value={gm.totalTenure || '—'} />
        <InfoCell label="GM Tenure" value={gm.gmTenure || '—'} />
        <InfoCell label="Compensation" value={gm.compensation || '—'} />
        <InfoCell label="Market Aligned" value={gm.marketAligned || '—'} />
      </div>

      {gm.independenceScore != null && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Independence Score</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  gm.independenceScore >= 7 ? 'bg-emerald-500' :
                  gm.independenceScore >= 5 ? 'bg-amber-500' : 'bg-red-500'
                )}
                style={{ width: `${(gm.independenceScore / 10) * 100}%` }}
              />
            </div>
            <span className={cn(
              'text-lg font-bold',
              gm.independenceScore >= 7 ? 'text-emerald-700' :
              gm.independenceScore >= 5 ? 'text-amber-700' : 'text-red-700'
            )}>
              {gm.independenceScore}/10
            </span>
          </div>
          {gm.independenceScore < 7 && (
            <p className="text-xs text-red-600 mt-1">Below 7 indicates significant operational dependency risk.</p>
          )}
        </div>
      )}

      {gm.dayToDayOwnership && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Day-to-Day Ownership</p>
          <p className="text-xs text-slate-600">{gm.dayToDayOwnership}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {gm.strengths.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-emerald-500 font-semibold mb-1">Strengths</p>
            <ul className="space-y-0.5">
              {gm.strengths.map((s, i) => (
                <li key={i} className="text-xs text-slate-600 flex items-start gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {gm.gaps.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-amber-500 font-semibold mb-1">Development Areas</p>
            <ul className="space-y-0.5">
              {gm.gaps.map((g, i) => (
                <li key={i} className="text-xs text-slate-600 flex items-start gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                  {g}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {(gm.soloExperience || gm.soloOutcome) && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Solo Operation Experience</p>
          {gm.soloExperience && <p className="text-xs text-slate-600">{gm.soloExperience}</p>}
          {gm.soloOutcome && <p className="text-xs text-slate-500 italic mt-0.5">Outcome: {gm.soloOutcome}</p>}
        </div>
      )}

      {/* Retention section */}
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Sale Awareness & Retention</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <InfoCell label="Aware of Sale" value={gm.awareOfSale === true ? 'Yes' : gm.awareOfSale === false ? 'No' : '—'} />
          <InfoCell label="Retention Conv." value={gm.retentionConversation === true ? 'Yes' : gm.retentionConversation === false ? 'No' : '—'} />
          <InfoCell label="Supportive" value={gm.supportive === true ? 'Yes' : gm.supportive === false ? 'No' : '—'} />
          <InfoCell label="Commitment" value={gm.retentionCommitment || '—'} />
        </div>
        {gm.hesitations.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-amber-500 font-semibold mb-1">Hesitations</p>
            <ul className="space-y-0.5">
              {gm.hesitations.map((h, i) => (
                <li key={i} className="text-xs text-slate-600">- {h}</li>
              ))}
            </ul>
          </div>
        )}
        {gm.retentionNotes && (
          <p className="text-xs text-slate-500 italic">{gm.retentionNotes}</p>
        )}
      </div>
    </div>
  )
}

function FlagItem({ flag }: { flag: AssessmentFlag }) {
  const config = severityConfig(flag.severity)
  const Icon = config.icon
  return (
    <div className={cn('rounded-xl border px-4 py-3 flex items-start gap-3', config.color)}>
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold">{flag.title}</p>
          <Badge color={config.badgeColor}>{flag.section}</Badge>
        </div>
        <p className="text-xs mt-0.5 opacity-80">{flag.description}</p>
      </div>
    </div>
  )
}

function InfoCell({
  label,
  value,
  editMode = false,
  onChange,
  children
}: {
  label: string
  value: string
  editMode?: boolean
  onChange?: (value: string) => void
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 w-full">
      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">{label}</p>
      {editMode ? (
        children ? children : (onChange ? <InlineInput value={value === '—' ? '' : value} onChange={onChange} /> : null)
      ) : (
        <p className="text-xs text-slate-700 font-medium mt-0.5">{value}</p>
      )}
    </div>
  )
}
