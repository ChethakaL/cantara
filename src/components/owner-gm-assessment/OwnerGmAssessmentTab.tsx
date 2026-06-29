'use client'
import { ClientApprovedEmptyState } from '@/components/client-portal/AgentClientPortalFrame'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bot, CheckCircle, FileText, Loader2, RefreshCw, Trash2, Upload,
  AlertTriangle, ShieldCheck, Info, Users2,
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
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
      if (mountedRef.current) setAssessment(data.assessment)
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
              { label: 'Owner Dependency', value: assessment.ownerDependencyRating },
              { label: 'GM Retention Risk', value: assessment.gmRetentionRisk },
              { label: 'Bench Strength', value: assessment.benchStrength },
              { label: 'Transition Readiness', value: assessment.overallTransitionReadiness },
            ].map(item => (
              <div
                key={item.label}
                className={cn('rounded-xl border p-4 text-center', ratingBgClass(item.value))}
              >
                <p className="text-[11px] uppercase tracking-wide opacity-70 font-medium">{item.label}</p>
                <p className="text-lg font-bold mt-1">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Export button */}
          <AdvisorActions className="flex justify-end">
            <ExportReportButton
              html={buildOwnerGmReportHtml(assessment, clientName)}
              fileName={`owner-gm-assessment-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
            />
          </AdvisorActions>

          {/* Executive Summary */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium">
              <CheckCircle className="w-4 h-4" />
              Executive Summary
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{assessment.executiveSummary}</p>
          </div>

          {/* Owner Profiles */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <h4 className="text-sm font-semibold text-slate-800">Owner Profiles</h4>
            {assessment.owners.map((owner, idx) => (
              <OwnerCard key={idx} owner={owner} />
            ))}
          </div>

          {/* GM Profile */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <h4 className="text-sm font-semibold text-slate-800">General Manager Profile</h4>
            <GmCard gm={assessment.gm} />
          </div>

          {/* Senior Team */}
          {assessment.seniorTeam.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <h4 className="text-sm font-semibold text-slate-800">Senior Management Bench</h4>
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
                    </tr>
                  </thead>
                  <tbody>
                    {assessment.seniorTeam.map((member, idx) => (
                      <tr key={idx} className="border-b border-slate-100">
                        <td className="py-2 px-3 font-medium text-slate-700">{member.name || '—'}</td>
                        <td className="py-2 px-3 text-slate-600">{member.title || '—'}</td>
                        <td className="py-2 px-3 text-slate-600">{member.tenure || '—'}</td>
                        <td className="py-2 px-3 text-slate-600">{member.responsibilities || '—'}</td>
                        <td className="py-2 px-3 text-slate-600">{member.hourlyOrSalaried || '—'}</td>
                        <td className="py-2 px-3">
                          {member.couldStepUp === true ? (
                            <Badge color="green">Yes</Badge>
                          ) : member.couldStepUp === false ? (
                            <Badge color="red">No</Badge>
                          ) : (
                            <Badge color="slate">Unknown</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Flags */}
          {assessment.flags.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <h4 className="text-sm font-semibold text-slate-800">Assessment Flags</h4>
              <div className="space-y-2">
                {assessment.flags.map((flag) => (
                  <FlagItem key={flag.id} flag={flag} />
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {assessment.recommendations.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <h4 className="text-sm font-semibold text-slate-800">Recommendations</h4>
              <ol className="list-decimal list-inside space-y-2">
                {assessment.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-sm text-slate-700 leading-relaxed">{rec}</li>
                ))}
              </ol>
            </div>
          )}

          {/* Counsel Items */}
          {assessment.counselItems.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <h4 className="text-sm font-semibold text-slate-800">Counsel Items</h4>
              <ul className="list-disc list-inside space-y-1">
                {assessment.counselItems.map((item, idx) => (
                  <li key={idx} className="text-sm text-slate-600">{item}</li>
                ))}
              </ul>
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

function OwnerCard({ owner }: { owner: OwnerProfile }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">{owner.name || 'Owner'}</p>
          <p className="text-xs text-slate-500">{owner.title}{owner.role ? ` — ${owner.role}` : ''}</p>
        </div>
        <Badge color={ratingColor(owner.dependencyRating)}>{owner.dependencyRating} Dependency</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <InfoCell label="Hours/Week" value={owner.hoursPerWeek != null ? `${owner.hoursPerWeek}` : '—'} />
        <InfoCell label="Critical Hours" value={owner.criticalHoursPerWeek != null ? `${owner.criticalHoursPerWeek}` : '—'} />
        <InfoCell label="Post-Close" value={owner.postCloseIntention || '—'} />
        <InfoCell label="Stay Required" value={owner.stayRequired === true ? 'Yes' : owner.stayRequired === false ? 'No' : '—'} />
      </div>

      {owner.postCloseRole && (
        <div className="grid grid-cols-2 gap-2">
          <InfoCell label="Post-Close Role" value={owner.postCloseRole} />
          <InfoCell label="Post-Close Duration" value={owner.postCloseDuration || '—'} />
        </div>
      )}

      {owner.criticalRelationships.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Critical Relationships</p>
          <div className="flex flex-wrap gap-1">
            {owner.criticalRelationships.map((rel, i) => (
              <span key={i} className="text-xs bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-600">{rel}</span>
            ))}
          </div>
        </div>
      )}

      {owner.replacementRoles.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <InfoCell label="Replacement Roles" value={owner.replacementRoles.join(', ')} />
          <InfoCell label="Experience Needed" value={owner.replacementExperience || '—'} />
          <InfoCell label="External Hire Cost" value={owner.externalHireCost || '—'} />
        </div>
      )}

      {owner.internalSuccessor && (
        <InfoCell label="Internal Successor" value={owner.internalSuccessor} />
      )}

      {owner.dependencyNotes && (
        <p className="text-xs text-slate-500 italic">{owner.dependencyNotes}</p>
      )}
    </div>
  )
}

function GmCard({ gm }: { gm: GmProfile }) {
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

      {/* Independence score gauge */}
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

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">{label}</p>
      <p className="text-xs text-slate-700 font-medium mt-0.5">{value}</p>
    </div>
  )
}
