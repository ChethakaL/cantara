'use client'

import type {
  WS16Report,
  Flag,
  FlagSeverity,
} from '@/types/ws1-6-types'
import {
  FlagPill,
  FlagCard,
  BoolChip,
  RiskBadge,
  ComplexityBadge,
  DocStatusBadge,
  SectionLabel,
  CoverageGapAlert,
  TableCard,
  Th,
  Td,
} from './Primitives'

// ─────────────────────────────────────────────────────────────────────────────
// Props shared by all tab panels
// ─────────────────────────────────────────────────────────────────────────────
interface TabProps {
  report: WS16Report
  flags: Flag[]
  onConfirm: (id: string) => void
  onNA: (id: string) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Summary Tab
// ─────────────────────────────────────────────────────────────────────────────
export function SummaryTab({ report, flags, onConfirm, onNA }: TabProps) {
  return (
    <div className="p-6">
      <CoverageGapAlert gaps={report.coverageGaps} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Left — Buyer-facing summary */}
        <div>
          <SectionLabel>Buyer-facing obligations summary</SectionLabel>
          <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-5 shadow-sm">

            <SummaryParagraph heading="Workforce overview">
              {report.buyerSummary.workforceOverview}
            </SummaryParagraph>

            <SummaryParagraph heading="Non-compete protections">
              {report.buyerSummary.nonCompeteProtections}
            </SummaryParagraph>

            <SummaryParagraph heading="Assumed benefit obligations">
              {report.buyerSummary.assumedBenefitObligations}
            </SummaryParagraph>

            <SummaryParagraph heading="Retirement & PTO">
              {report.buyerSummary.retirementAndPTO}
            </SummaryParagraph>

            <SummaryParagraph heading="Independent contractor risk">
              {report.buyerSummary.independentContractorRisk || 'No specific independent contractor risks summarized by agent.'}
            </SummaryParagraph>

            <SummaryParagraph heading="Transition considerations">
              {report.buyerSummary.transitionConsiderations}
            </SummaryParagraph>

            <div>
              <p className="text-[13px] font-semibold text-stone-800 mb-3 border-b border-stone-100 pb-2">
                Items requiring buyer's employment counsel review
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
          <SectionLabel>All identified flags (Section 8)</SectionLabel>
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

function SummaryParagraph({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-stone-100 pb-3 last:border-0 last:pb-0">
      <span className="text-[12px] font-medium text-stone-800">{heading}. </span>
      <span className="text-[12px] text-stone-500 leading-relaxed">{children}</span>
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
      <CoverageGapAlert gaps={report.coverageGaps} />
      <TableCard>
        <thead>
          <tr>
            <Th>Document</Th>
            <Th>Type</Th>
            <Th>Parties covered</Th>
            <Th>Date</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {report.documents.map(doc => (
            <tr key={doc.id} className="hover:bg-stone-50 transition-colors">
              <Td className="font-medium text-stone-800">{doc.filename}</Td>
              <Td>{doc.docType}</Td>
              <Td>{doc.partiesCovered}</Td>
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
// 3. Agreements Tab
// ─────────────────────────────────────────────────────────────────────────────
export function AgreementsTab({ report, flags, onConfirm, onNA }: TabProps) {
  const relatedFlags = flags.filter(f => f.domain === 'Agreements')

  return (
    <div className="p-6">
      <SectionLabel>Employment agreement coverage — {report.agreements.length} roles</SectionLabel>
      <TableCard>
        <thead>
          <tr>
            <Th>Role</Th>
            <Th>Agreement type</Th>
            <Th>Term</Th>
            <Th>Non-compete</Th>
            <Th>Non-solicit</Th>
            <Th>NDA</Th>
            <Th>Source</Th>
          </tr>
        </thead>
        <tbody>
          {report.agreements.map((row, i) => (
            <tr key={i} className="hover:bg-stone-50 transition-colors">
              <Td>
                <span className={row.isKeyPerson ? 'font-medium text-stone-900' : ''}>
                  {row.role}
                </span>
                {row.isKeyPerson && (
                  <span className="ml-1.5 text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded">
                    key
                  </span>
                )}
              </Td>
              <Td>{row.agreementType}</Td>
              <Td className="whitespace-nowrap">{row.term}</Td>
              <Td><BoolChip value={row.hasNonCompete} /></Td>
              <Td><BoolChip value={row.hasNonSolicit} /></Td>
              <Td><BoolChip value={row.hasNDA} /></Td>
              <Td className="text-stone-400 text-[11px]">{row.sourceRef}</Td>
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
// 4. Non-Competes Tab
// ─────────────────────────────────────────────────────────────────────────────
export function NonCompetesTab({ report, flags, onConfirm, onNA }: TabProps) {
  const relatedFlags = flags.filter(f => f.domain === 'Non-competes')

  return (
    <div className="p-6">
      <SectionLabel>Non-compete &amp; non-solicitation analysis</SectionLabel>

      {report.nonCompetes.map(nc => (
        <div
          key={nc.id}
          className={`bg-white border border-stone-200 rounded-lg p-4 mb-3 ${nc.isCritical ? 'border-l-[3px] border-l-red-400' : ''}`}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <p className="text-[13px] font-medium text-stone-900">{nc.party}</p>
            {nc.isCritical && (
              <span className="text-[10px] font-medium bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                Critical buyer protection
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 mb-3">
            <NCField label="Source" value={`${nc.sourceDoc} ${nc.sourceSection}`} />
            <NCField label="Geographic scope" value={nc.geographicScope} />
            <NCField label="Duration" value={nc.duration} />
            <NCField label="Consideration" value={nc.considerationNote} />
            <div className="col-span-2">
              <p className="text-[11px] text-stone-400 mb-0.5">Covered activities</p>
              <div className="flex flex-wrap gap-1">
                {nc.coveredActivities.map((a, i) => (
                  <span key={i} className="text-[11px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">
                    {a}
                  </span>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <NCField label="State enforceability note" value={nc.stateEnforceabilityNote} />
            </div>
          </div>
          <FlagPill severity={nc.flag} />
          <p className="text-[12px] text-stone-500 mt-1">{nc.flagExplanation}</p>
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

function NCField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-stone-400 mb-0.5">{label}</p>
      <p className="text-[12px] text-stone-700 leading-snug">{value}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Benefits Tab
// ─────────────────────────────────────────────────────────────────────────────
const TRANSFERABLE_CLASS: Record<string, string> = {
  Yes:        'text-green-700',
  No:         'text-red-700',
  Unclear:    'text-amber-700',
  Statutory:  'text-blue-700',
  Unknown:    'text-stone-400',
}

export function BenefitsTab({ report, flags, onConfirm, onNA }: TabProps) {
  const relatedFlags = flags.filter(f => f.domain === 'Benefits')

  return (
    <div className="p-6">
      <SectionLabel>Benefit plan obligations</SectionLabel>
      <TableCard>
        <thead>
          <tr>
            <Th>Benefit</Th>
            <Th>Employer contribution</Th>
            <Th>Contractually bound</Th>
            <Th>Asset sale transferable</Th>
            <Th>Est. annual cost</Th>
            <Th>Transition complexity</Th>
          </tr>
        </thead>
        <tbody>
          {report.benefits.map((b, i) => (
            <tr key={i} className="hover:bg-stone-50 transition-colors">
              <Td className="font-medium text-stone-800">{b.benefitType}</Td>
              <Td>{b.employerContribution}</Td>
              <Td><BoolChip value={b.contractuallyBound} /></Td>
              <Td>
                <span className={`text-[12px] ${TRANSFERABLE_CLASS[b.assetSaleTransferable] ?? 'text-stone-500'}`}>
                  {b.assetSaleTransferable === 'Unclear' ? '⚠ Unclear — flag' : b.assetSaleTransferable}
                </span>
              </Td>
              <Td>{b.estimatedAnnualCost}</Td>
              <Td><ComplexityBadge level={b.transitionComplexity} /></Td>
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
// 6. Contractors Tab
// ─────────────────────────────────────────────────────────────────────────────
export function ContractorsTab({ report, flags, onConfirm, onNA }: TabProps) {
  const relatedFlags = flags.filter(f => f.domain === 'Contractors')
  const hasContractors = report.contractors.some(c => c.misclassRisk !== 'None Identified')

  return (
    <div className="p-6">
      <SectionLabel>Independent contractor analysis</SectionLabel>

      {!hasContractors ? (
        <div className="bg-white border border-stone-200 rounded-lg p-4 flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center text-green-700 text-[16px] flex-shrink-0">
            ✓
          </div>
          <div>
            <p className="text-[13px] font-medium text-stone-800 mb-0.5">
              No independent contractor relationships identified
            </p>
            <p className="text-[12px] text-stone-500">
              All workers in the payroll register are classified as W-2 employees. No 1099 contractor agreements were uploaded.
            </p>
          </div>
        </div>
      ) : (
        report.contractors.map(c => (
          <div key={c.id} className="bg-white border border-stone-200 rounded-lg p-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[13px] font-medium text-stone-800">{c.role}</p>
              <FlagPill severity={c.flag} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-[11px] text-stone-400 mb-0.5">Agreement provided</p>
                <BoolChip value={c.agreementProvided} />
              </div>
              <div>
                <p className="text-[11px] text-stone-400 mb-0.5">Misclassification risk</p>
                <p className={`text-[12px] font-medium ${
                  c.misclassRisk === 'High' ? 'text-red-700' :
                  c.misclassRisk === 'Moderate' ? 'text-amber-700' :
                  'text-green-700'
                }`}>{c.misclassRisk}</p>
              </div>
              {c.riskFactors.length > 0 && (
                <div>
                  <p className="text-[11px] text-stone-400 mb-0.5">Risk factors present</p>
                  <ul className="text-[12px] text-stone-600 space-y-0.5">
                    {c.riskFactors.map((f, i) => <li key={i}>· {f}</li>)}
                  </ul>
                </div>
              )}
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
// 7. Key People Tab
// ─────────────────────────────────────────────────────────────────────────────
export function KeyPeopleTab({ report }: TabProps) {
  return (
    <div className="p-6">
      <SectionLabel>Key person risk assessment</SectionLabel>
      <TableCard>
        <thead>
          <tr>
            <Th>Role</Th>
            <Th>Employment type</Th>
            <Th>Non-compete</Th>
            <Th>Agreement</Th>
            <Th>Risk level</Th>
            <Th>Transition notes</Th>
          </tr>
        </thead>
        <tbody>
          {report.keyPeople.map((kp, i) => (
            <tr key={i} className="hover:bg-stone-50 transition-colors">
              <Td className="font-medium text-stone-800 whitespace-nowrap">{kp.role}</Td>
              <Td className="whitespace-nowrap">{kp.employmentType}</Td>
              <Td><BoolChip value={kp.hasNonCompete} /></Td>
              <Td><BoolChip value={kp.hasAgreement} /></Td>
              <Td><RiskBadge level={kp.riskLevel} /></Td>
              <Td className="text-stone-500 max-w-xs">{kp.transitionNotes}</Td>
            </tr>
          ))}
        </tbody>
      </TableCard>

      <div className="bg-stone-50 rounded-lg px-4 py-3.5 mt-1">
        <p className="text-[11px] font-medium text-stone-400 uppercase tracking-widest mb-2">
          Key person narrative
        </p>
        <p className="text-[13px] text-stone-600 leading-relaxed">
          {report.keyPersonNarrative}
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Admin Review Tab (HITL)
// ─────────────────────────────────────────────────────────────────────────────
export function CraigReviewTab({
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
        <SectionLabel>All flags — review each before releasing for downstream use</SectionLabel>
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
          {isReleasing ? 'Releasing…' : 'Release reviewed output →'}
        </button>
      </div>
    </div>
  )
}
