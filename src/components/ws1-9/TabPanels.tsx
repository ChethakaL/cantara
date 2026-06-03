'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type {
  WS19Report,
  WS19Flag,
  FlagSeverity,
  PermitStatus,
  ZoningCompliance,
  GrandfatherRisk,
} from '@/types/ws1-9-types'
import {
  FlagPill,
  FlagCard,
  DocStatusBadge,
  SectionLabel,
  TableCard,
  Th,
  Td,
} from '@/components/ws1-6/Primitives'
import { cn } from '@/components/ui'

// ─────────────────────────────────────────────────────────────────────────────
// Props shared by all tab panels
// ─────────────────────────────────────────────────────────────────────────────
interface TabProps {
  report: WS19Report
  flags: WS19Flag[]
  onConfirm: (id: string) => void
  onNA: (id: string) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Permit Status Badge (color-coded: Current=green, Expired=red, Expiring Soon=gold)
// ─────────────────────────────────────────────────────────────────────────────
const PERMIT_STATUS_CLASS: Record<PermitStatus, string> = {
  Current: 'bg-green-50 text-green-800 border-green-200',
  Expired: 'bg-red-50 text-red-800 border-red-200',
  'Expiring Soon': 'bg-amber-50 text-amber-800 border-amber-200',
  Pending: 'bg-blue-50 text-blue-800 border-blue-200',
  Unknown: 'bg-stone-100 text-stone-600 border-stone-200',
}

function PermitStatusBadge({ status }: { status: PermitStatus }) {
  return (
    <span className={cn(
      'inline-flex items-center text-[11px] font-medium px-2.5 py-0.5 rounded-full border',
      PERMIT_STATUS_CLASS[status] ?? PERMIT_STATUS_CLASS.Unknown
    )}>
      {status}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Zoning Compliance Badge
// ─────────────────────────────────────────────────────────────────────────────
const ZONING_CLASS: Record<ZoningCompliance, string> = {
  Compliant: 'text-green-700 font-medium',
  'Non-Compliant': 'text-red-700 font-medium',
  Conditional: 'text-amber-700 font-medium',
  Unknown: 'text-stone-400',
}

function ZoningBadge({ status }: { status: ZoningCompliance }) {
  return <span className={cn('text-[12px]', ZONING_CLASS[status])}>{status}</span>
}

// ─────────────────────────────────────────────────────────────────────────────
// Grandfather Risk Badge
// ─────────────────────────────────────────────────────────────────────────────
const GF_RISK_CLASS: Record<GrandfatherRisk, string> = {
  High: 'text-red-700 font-medium',
  Medium: 'text-amber-800 font-medium',
  Low: 'text-green-700 font-medium',
  Unknown: 'text-stone-400',
}

function GrandfatherRiskBadge({ level }: { level: GrandfatherRisk }) {
  return <span className={cn('text-[12px]', GF_RISK_CLASS[level])}>{level}</span>
}

// ─────────────────────────────────────────────────────────────────────────────
// Transfer Badge
// ─────────────────────────────────────────────────────────────────────────────
const TRANSFER_CLASS: Record<string, string> = {
  Transferable: 'text-green-700',
  'Non-Transferable': 'text-red-700',
  'Requires Approval': 'text-amber-700',
  Unknown: 'text-stone-400',
}

function TransferBadge({ status }: { status: string }) {
  return <span className={cn('text-[12px] font-medium', TRANSFER_CLASS[status] ?? 'text-stone-500')}>{status}</span>
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Summary Tab
// ─────────────────────────────────────────────────────────────────────────────
export function SummaryTab({ report, flags, onConfirm, onNA }: TabProps) {
  return (
    <div className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Left — Buyer-facing summary */}
        <div>
          <SectionLabel>Buyer-facing permits & zoning summary</SectionLabel>
          <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-5 shadow-sm">
            <SummaryParagraph heading="Permits overview" text={report.buyerSummary.permitsOverview} />

            <SummaryParagraph heading="Zoning compliance" text={report.buyerSummary.zoningCompliance} />

            <SummaryParagraph
              heading="Conditional use permit status"
              text={report.buyerSummary.conditionalUseStatus || 'No specific CUP status summarized by agent.'}
            />

            <SummaryParagraph
              heading="Grandfathering risk"
              text={report.buyerSummary.grandfatheringRisk || 'No grandfathering risks summarized by agent.'}
            />

            <SummaryParagraph heading="Transfer considerations" text={report.buyerSummary.transferConsiderations} />

            <div>
              <p className="text-[13px] font-semibold text-stone-800 mb-3 border-b border-stone-100 pb-2">
                Items requiring buyer's land use counsel review
              </p>
              <ul className="space-y-2 text-[13px] text-stone-600 list-disc pl-4">
                {(report.buyerSummary.counselItems || []).map((item, i) => (
                  <li key={i} className="leading-relaxed">{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Right — All flags */}
        <div className="flex flex-col min-h-0">
          <SectionLabel>All identified flags (Section 7)</SectionLabel>
          <div className="space-y-3 bg-stone-50/50 p-6 rounded-lg border border-stone-100 min-h-[640px] max-h-[72vh] overflow-y-auto">
            {flags.length === 0 ? (
              <p className="text-sm text-stone-500 italic">No flags found in this analysis.</p>
            ) : (
              flags.map(flag => (
                <FlagCard
                  key={flag.id}
                  severity={flag.severity}
                  title={flag.title}
                  description={flag.description}
                  status={flag.status}
                  onConfirm={() => onConfirm(flag.id)}
                  onNA={() => onNA(flag.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryParagraph({ heading, text }: { heading: string; text: string }) {
  const body = text?.trim() || '—'
  return (
    <div className="border-b border-stone-100 pb-4 last:border-0 last:pb-0">
      <p className="text-[13px] font-semibold text-stone-800 mb-2">{heading}</p>
      <div className="text-[13px] text-stone-600 leading-relaxed prose prose-sm max-w-none prose-p:my-1 prose-strong:text-stone-800 prose-ul:my-2 prose-li:my-0.5">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Documents Tab
// ─────────────────────────────────────────────────────────────────────────────
export function DocumentsTab({ report }: TabProps) {
  return (
    <div className="p-6">
      <SectionLabel>{report.documents.length} files processed</SectionLabel>
      <TableCard>
        <thead>
          <tr>
            <Th>Document</Th>
            <Th>Type</Th>
            <Th>Issuing authority</Th>
            <Th>Date</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {report.documents.map(doc => (
            <tr key={doc.id} className="hover:bg-stone-50 transition-colors">
              <Td className="font-medium text-stone-800">{doc.filename}</Td>
              <Td>{doc.docType}</Td>
              <Td>{doc.issuingAuthority}</Td>
              <Td className="whitespace-nowrap">{doc.date}</Td>
              <Td><DocStatusBadge status={doc.status} note={doc.statusNote} /></Td>
            </tr>
          ))}
        </tbody>
      </TableCard>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Permits Tab
// ─────────────────────────────────────────────────────────────────────────────
export function PermitsTab({ report, flags, onConfirm, onNA }: TabProps) {
  const relatedFlags = flags.filter(f => f.domain === 'Permits')

  return (
    <div className="p-6">
      <SectionLabel>Permit inventory — {report.permits.length} permits</SectionLabel>
      <TableCard>
        <thead>
          <tr>
            <Th>Permit type</Th>
            <Th>Permit number</Th>
            <Th>Issuing authority</Th>
            <Th>Issue date</Th>
            <Th>Expiration</Th>
            <Th>Status</Th>
            <Th>Renewal</Th>
            <Th>Conditions</Th>
          </tr>
        </thead>
        <tbody>
          {report.permits.map((permit) => (
            <tr key={permit.id} className="hover:bg-stone-50 transition-colors">
              <Td className="font-medium text-stone-800">{permit.permitType}</Td>
              <Td>{permit.permitNumber}</Td>
              <Td>{permit.issuingAuthority}</Td>
              <Td className="whitespace-nowrap">{permit.issueDate}</Td>
              <Td className="whitespace-nowrap">{permit.expirationDate}</Td>
              <Td><PermitStatusBadge status={permit.status} /></Td>
              <Td className="text-stone-500 text-[11px] max-w-[150px]">{permit.renewalProcess}</Td>
              <Td className="text-stone-500 text-[11px] max-w-[150px]">{permit.conditions}</Td>
            </tr>
          ))}
        </tbody>
      </TableCard>

      {relatedFlags.length > 0 && (
        <>
          <SectionLabel>Related flags</SectionLabel>
          <div className="space-y-2.5">
            {relatedFlags.map(flag => (
              <FlagCard
                key={flag.id}
                severity={flag.severity}
                id={flag.id}
                title={flag.title}
                description={flag.description}
                sourceRef={flag.sourceRef}
                status={flag.status}
                onConfirm={() => onConfirm(flag.id)}
                onNA={() => onNA(flag.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Zoning Tab
// ─────────────────────────────────────────────────────────────────────────────
export function ZoningTab({ report, flags, onConfirm, onNA }: TabProps) {
  const relatedFlags = flags.filter(f => f.domain === 'Zoning')

  return (
    <div className="p-6">
      <SectionLabel>Zoning analysis</SectionLabel>

      {report.zoning.map(zone => (
        <div key={zone.id} className="bg-white border border-stone-200 rounded-lg p-4 mb-3">
          <div className="flex items-start justify-between gap-3 mb-3">
            <p className="text-[13px] font-medium text-stone-900">{zone.propertyAddress}</p>
            <ZoningBadge status={zone.complianceStatus} />
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 mb-3">
            <ZoneField label="Zoning designation" value={zone.zoningDesignation} />
            <ZoneField label="Current use" value={zone.currentUse} />
            <div className="col-span-2">
              <p className="text-[11px] text-stone-400 mb-0.5">Permitted uses</p>
              <div className="flex flex-wrap gap-1">
                {zone.permittedUses.map((use, i) => (
                  <span key={i} className="text-[11px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">
                    {use}
                  </span>
                ))}
              </div>
            </div>
            <ZoneField label="Setback requirements" value={zone.setbacks} />
            <ZoneField label="Parking requirements" value={zone.parkingRequirements} />
            <ZoneField label="Noise ordinance" value={zone.noiseOrdinance} />
          </div>
          {zone.restrictions.length > 0 && (
            <div className="mb-2">
              <p className="text-[11px] text-stone-400 mb-1">Restrictions</p>
              <ul className="text-[12px] text-stone-600 space-y-0.5">
                {zone.restrictions.map((r, i) => <li key={i}>- {r}</li>)}
              </ul>
            </div>
          )}
        </div>
      ))}

      {relatedFlags.length > 0 && (
        <>
          <SectionLabel className="mt-4">Flags</SectionLabel>
          <div className="space-y-2.5">
            {relatedFlags.map(flag => (
              <FlagCard
                key={flag.id}
                severity={flag.severity}
                id={flag.id}
                title={flag.title}
                description={flag.description}
                sourceRef={flag.sourceRef}
                status={flag.status}
                onConfirm={() => onConfirm(flag.id)}
                onNA={() => onNA(flag.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ZoneField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-stone-400 mb-0.5">{label}</p>
      <p className="text-[12px] text-stone-700 leading-snug">{value}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Conditional Use Tab
// ─────────────────────────────────────────────────────────────────────────────
export function ConditionalUseTab({ report, flags, onConfirm, onNA }: TabProps) {
  const relatedFlags = flags.filter(f => f.domain === 'CUP')
  const hasCUPs = report.conditionalUsePermits.length > 0

  return (
    <div className="p-6">
      <SectionLabel>Conditional use permits</SectionLabel>

      {!hasCUPs ? (
        <div className="bg-white border border-stone-200 rounded-lg p-4 flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-stone-50 flex items-center justify-center text-stone-500 text-[16px] flex-shrink-0">
            --
          </div>
          <div>
            <p className="text-[13px] font-medium text-stone-800 mb-0.5">
              No conditional use permits identified
            </p>
            <p className="text-[12px] text-stone-500">
              No CUPs were found in the uploaded documents. If the pet resort operates under a conditional use permit, upload the permit documentation.
            </p>
          </div>
        </div>
      ) : (
        report.conditionalUsePermits.map(cup => (
          <div key={cup.id} className="bg-white border border-stone-200 rounded-lg p-4 mb-3">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-[13px] font-medium text-stone-900">CUP #{cup.cupNumber}</p>
                <p className="text-[11px] text-stone-400">{cup.issuingAuthority} -- {cup.issueDate}</p>
              </div>
              <div className="flex items-center gap-2">
                <ZoningBadge status={cup.complianceStatus} />
                <TransferBadge status={cup.transferability} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 mb-3">
              <ZoneField label="Approved use" value={cup.approvedUse} />
              <ZoneField label="Renewal date" value={cup.renewalRequired ? cup.renewalDate || 'Date not specified' : 'No renewal required'} />
            </div>
            {cup.conditions.length > 0 && (
              <div className="mb-2">
                <p className="text-[11px] text-stone-400 mb-1">Conditions of approval</p>
                <ol className="text-[12px] text-stone-600 space-y-0.5 list-decimal pl-4">
                  {cup.conditions.map((c, i) => <li key={i}>{c}</li>)}
                </ol>
              </div>
            )}
          </div>
        ))
      )}

      {relatedFlags.length > 0 && (
        <>
          <SectionLabel>Related flags</SectionLabel>
          <div className="space-y-2.5">
            {relatedFlags.map(flag => (
              <FlagCard
                key={flag.id}
                severity={flag.severity}
                id={flag.id}
                title={flag.title}
                description={flag.description}
                sourceRef={flag.sourceRef}
                status={flag.status}
                onConfirm={() => onConfirm(flag.id)}
                onNA={() => onNA(flag.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Grandfathering Tab
// ─────────────────────────────────────────────────────────────────────────────
export function GrandfatheringTab({ report, flags, onConfirm, onNA }: TabProps) {
  const relatedFlags = flags.filter(f => f.domain === 'Grandfathering')
  const hasItems = report.grandfathering.length > 0

  return (
    <div className="p-6">
      <SectionLabel>Grandfathering & non-conforming use analysis</SectionLabel>

      {!hasItems ? (
        <div className="bg-white border border-stone-200 rounded-lg p-4 flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center text-green-700 text-[16px] flex-shrink-0">
            OK
          </div>
          <div>
            <p className="text-[13px] font-medium text-stone-800 mb-0.5">
              No non-conforming use or grandfathering issues identified
            </p>
            <p className="text-[12px] text-stone-500">
              The current use appears to be a conforming use under the applicable zoning designation. Buyer should confirm with municipal zoning office.
            </p>
          </div>
        </div>
      ) : (
        report.grandfathering.map(gf => (
          <div
            key={gf.id}
            className={`bg-white border border-stone-200 rounded-lg p-4 mb-3 ${
              gf.riskLevel === 'High' ? 'border-l-[3px] border-l-red-400' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <p className="text-[13px] font-medium text-stone-900">{gf.nonConformingUse}</p>
              <GrandfatherRiskBadge level={gf.riskLevel} />
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 mb-3">
              <ZoneField label="Original approval date" value={gf.originalApprovalDate} />
              <ZoneField label="Current legal basis" value={gf.currentBasis} />
              <div className="col-span-2">
                <p className="text-[11px] text-stone-400 mb-1">Trigger events that could cause loss</p>
                <ul className="text-[12px] text-stone-600 space-y-0.5 list-disc pl-4">
                  {gf.triggerEvents.map((event, i) => (
                    <li key={i}>{event}</li>
                  ))}
                </ul>
              </div>
              <div className="col-span-2">
                <ZoneField label="Mitigation options" value={gf.mitigationOptions} />
              </div>
            </div>
          </div>
        ))
      )}

      {relatedFlags.length > 0 && (
        <>
          <SectionLabel>Related flags</SectionLabel>
          <div className="space-y-2.5">
            {relatedFlags.map(flag => (
              <FlagCard
                key={flag.id}
                severity={flag.severity}
                id={flag.id}
                title={flag.title}
                description={flag.description}
                sourceRef={flag.sourceRef}
                status={flag.status}
                onConfirm={() => onConfirm(flag.id)}
                onNA={() => onNA(flag.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Admin Review Tab (HITL)
// ─────────────────────────────────────────────────────────────────────────────
export function AdminReviewTab({
  flags,
  onConfirm,
  onNA,
  onRelease,
  isReleasing,
}: TabProps & { onRelease: () => void; isReleasing: boolean }) {
  const severityOrder: FlagSeverity[] = ['deal-risk', 'negotiation', 'positive', 'informational']
  const sorted = [...flags].sort(
    (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
  )
  const reviewed = flags.filter(f => f.status !== 'pending').length
  const total = flags.length
  const allDone = reviewed === total

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <SectionLabel>All flags -- review each before releasing for downstream use</SectionLabel>
        <div className="flex gap-2">
          <span className="text-[12px] text-stone-500">{reviewed} of {total} reviewed</span>
        </div>
      </div>

      <div className="space-y-2.5 mb-5">
        {sorted.map(flag => (
          <FlagCard
            key={flag.id}
            severity={flag.severity}
            id={flag.id}
            domain={flag.domain}
            title={flag.title}
            description={flag.description}
            sourceRef={flag.sourceRef}
            status={flag.status}
            onConfirm={() => onConfirm(flag.id)}
            onNA={() => onNA(flag.id)}
          />
        ))}
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
        <button
          onClick={onRelease}
          className={`text-[12px] px-4 py-2 rounded-lg border transition-all ${
            allDone
              ? 'border-stone-800 bg-stone-900 text-white hover:bg-stone-800'
              : 'border-stone-200 text-stone-400 cursor-not-allowed'
          }`}
          disabled={!allDone || isReleasing}
        >
          {isReleasing ? 'Releasing...' : 'Release reviewed output ->'}
        </button>
      </div>
    </div>
  )
}
