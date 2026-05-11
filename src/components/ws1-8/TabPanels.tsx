'use client'

import type {
  WS18Report,
  WS18Flag,
  FlagSeverity,
} from '@/types/ws1-8-types'
import {
  FlagPill,
  FlagCard,
  DocStatusBadge,
  SectionLabel,
  TableCard,
  Th,
  Td,
} from '@/components/ws1-6/Primitives'

// ─────────────────────────────────────────────────────────────────────────────
// Props shared by all tab panels
// ─────────────────────────────────────────────────────────────────────────────
interface TabProps {
  report: WS18Report
  flags: WS18Flag[]
  onConfirm: (id: string) => void
  onNA: (id: string) => void
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
          <SectionLabel>Buyer-facing ownership summary</SectionLabel>
          <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-5 shadow-sm">

            <SummaryParagraph heading="Entity structure overview">
              {report.buyerSummary.entityStructureOverview}
            </SummaryParagraph>

            <SummaryParagraph heading="Ownership clarity">
              {report.buyerSummary.ownershipClarity}
            </SummaryParagraph>

            <SummaryParagraph heading="Encumbrance exposure">
              {report.buyerSummary.encumbranceExposure}
            </SummaryParagraph>

            <SummaryParagraph heading="State compliance status">
              {report.buyerSummary.stateComplianceStatus}
            </SummaryParagraph>

            <SummaryParagraph heading="Transition considerations">
              {report.buyerSummary.transitionConsiderations}
            </SummaryParagraph>

            <div>
              <p className="text-[13px] font-semibold text-stone-800 mb-3 border-b border-stone-100 pb-2">
                Items requiring buyer's corporate counsel review
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
      <TableCard>
        <thead>
          <tr>
            <Th>Document</Th>
            <Th>Type</Th>
            <Th>Entities/parties covered</Th>
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
// 3. Entities Tab
// ─────────────────────────────────────────────────────────────────────────────
const ENTITY_STATUS_CLASS: Record<string, string> = {
  active: 'text-green-700 font-medium',
  inactive: 'text-amber-700 font-medium',
  dissolved: 'text-red-700 font-medium',
  unknown: 'text-stone-400',
}

export function EntitiesTab({ report, flags, onConfirm, onNA }: TabProps) {
  const relatedFlags = flags.filter(f => f.domain === 'Entity-Structure')

  return (
    <div className="p-6">
      <SectionLabel>Entity structure — {report.entities.length} entities identified</SectionLabel>
      <TableCard>
        <thead>
          <tr>
            <Th>Entity name</Th>
            <Th>Type</Th>
            <Th>State</Th>
            <Th>Formation date</Th>
            <Th>EIN</Th>
            <Th>Registered agent</Th>
            <Th>Status</Th>
            <Th>Source</Th>
          </tr>
        </thead>
        <tbody>
          {report.entities.map((entity) => (
            <tr key={entity.id} className="hover:bg-stone-50 transition-colors">
              <Td className="font-medium text-stone-800">{entity.entityName}</Td>
              <Td>{entity.entityType}</Td>
              <Td>{entity.stateOfFormation}</Td>
              <Td className="whitespace-nowrap">{entity.dateOfFormation}</Td>
              <Td className="text-stone-500 text-[11px]">{entity.ein || '--'}</Td>
              <Td>{entity.registeredAgent}</Td>
              <Td>
                <span className={`text-[12px] ${ENTITY_STATUS_CLASS[entity.status] ?? 'text-stone-500'}`}>
                  {entity.status.charAt(0).toUpperCase() + entity.status.slice(1)}
                </span>
              </Td>
              <Td className="text-stone-400 text-[11px]">{entity.sourceRef}</Td>
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
// 4. Ownership Tab
// ─────────────────────────────────────────────────────────────────────────────
export function OwnershipTab({ report, flags, onConfirm, onNA }: TabProps) {
  const relatedFlags = flags.filter(f => f.domain === 'Ownership')

  return (
    <div className="p-6">
      <SectionLabel>Ownership breakdown — {report.ownershipStakes.length} stakes identified</SectionLabel>
      <TableCard>
        <thead>
          <tr>
            <Th>Owner</Th>
            <Th>Owner type</Th>
            <Th>Entity owned</Th>
            <Th>Ownership %</Th>
            <Th>Class of interest</Th>
            <Th>Voting rights</Th>
            <Th>Transfer restrictions</Th>
            <Th>Source</Th>
          </tr>
        </thead>
        <tbody>
          {report.ownershipStakes.map((stake) => (
            <tr key={stake.id} className="hover:bg-stone-50 transition-colors">
              <Td className="font-medium text-stone-800">{stake.ownerName}</Td>
              <Td>{stake.ownerType}</Td>
              <Td>{stake.entityOwned}</Td>
              <Td className="font-medium">{stake.ownershipPercentage}</Td>
              <Td>{stake.classOfInterest}</Td>
              <Td>{stake.votingRights}</Td>
              <Td>
                <span className={`text-[12px] ${
                  stake.transferRestrictions.toLowerCase().includes('none') ? 'text-green-700' :
                  stake.transferRestrictions.toLowerCase().includes('not specified') ? 'text-stone-400' :
                  'text-amber-700'
                }`}>
                  {stake.transferRestrictions}
                </span>
              </Td>
              <Td className="text-stone-400 text-[11px]">{stake.sourceRef}</Td>
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
// 5. Encumbrances Tab
// ─────────────────────────────────────────────────────────────────────────────
const ENCUMBRANCE_STATUS_CLASS: Record<string, string> = {
  active: 'text-red-700 font-medium',
  released: 'text-green-700 font-medium',
  expired: 'text-stone-400',
  unknown: 'text-amber-700',
}

export function EncumbrancesTab({ report, flags, onConfirm, onNA }: TabProps) {
  const relatedFlags = flags.filter(f => f.domain === 'Encumbrances')
  const hasEncumbrances = report.encumbrances.length > 0

  return (
    <div className="p-6">
      <SectionLabel>Encumbrances &amp; liens analysis</SectionLabel>

      {!hasEncumbrances ? (
        <div className="bg-white border border-stone-200 rounded-lg p-4 flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center text-green-700 text-[16px] flex-shrink-0">
            &#10003;
          </div>
          <div>
            <p className="text-[13px] font-medium text-stone-800 mb-0.5">
              No encumbrances or liens identified
            </p>
            <p className="text-[12px] text-stone-500">
              No UCC filings, tax liens, judgment liens, or other encumbrances were found in the uploaded documents.
            </p>
          </div>
        </div>
      ) : (
        report.encumbrances.map(enc => (
          <div key={enc.id} className={`bg-white border border-stone-200 rounded-lg p-4 mb-3 ${
            enc.status === 'active' ? 'border-l-[3px] border-l-red-400' : ''
          }`}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <p className="text-[13px] font-medium text-stone-900">{enc.type}</p>
              <span className={`text-[12px] ${ENCUMBRANCE_STATUS_CLASS[enc.status] ?? 'text-stone-500'}`}>
                {enc.status.charAt(0).toUpperCase() + enc.status.slice(1)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 mb-3">
              <FieldDisplay label="Filed against" value={enc.filedAgainst} />
              <FieldDisplay label="Secured party" value={enc.securedParty} />
              <FieldDisplay label="Filing date" value={enc.filingDate} />
              <FieldDisplay label="Expiration date" value={enc.expirationDate} />
              {enc.amount && <FieldDisplay label="Amount" value={enc.amount} />}
              <div className="col-span-2">
                <FieldDisplay label="Collateral description" value={enc.collateralDescription} />
              </div>
              <div className="col-span-2">
                <FieldDisplay label="Source" value={enc.sourceRef} />
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

function FieldDisplay({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-stone-400 mb-0.5">{label}</p>
      <p className="text-[12px] text-stone-700 leading-snug">{value || '--'}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. State Filings Tab
// ─────────────────────────────────────────────────────────────────────────────
const COMPLIANCE_CLASS: Record<string, string> = {
  compliant: 'text-green-700 font-medium',
  'non-compliant': 'text-red-700 font-medium',
  unclear: 'text-amber-700 font-medium',
  unknown: 'text-stone-400',
}

export function StateFilingsTab({ report, flags, onConfirm, onNA }: TabProps) {
  const relatedFlags = flags.filter(f => f.domain === 'State-Filings')

  return (
    <div className="p-6">
      <SectionLabel>State filing compliance — {report.stateFilings.length} filings reviewed</SectionLabel>
      <TableCard>
        <thead>
          <tr>
            <Th>State</Th>
            <Th>Filing type</Th>
            <Th>Filing date</Th>
            <Th>Expiration/due date</Th>
            <Th>Status</Th>
            <Th>Compliance</Th>
            <Th>Notes</Th>
            <Th>Source</Th>
          </tr>
        </thead>
        <tbody>
          {report.stateFilings.map((filing) => (
            <tr key={filing.id} className="hover:bg-stone-50 transition-colors">
              <Td className="font-medium text-stone-800">{filing.state}</Td>
              <Td>{filing.filingType}</Td>
              <Td className="whitespace-nowrap">{filing.filingDate}</Td>
              <Td className="whitespace-nowrap">{filing.expirationDate}</Td>
              <Td>
                <span className={`text-[12px] ${
                  filing.status === 'active' ? 'text-green-700 font-medium' :
                  filing.status === 'expired' ? 'text-red-700 font-medium' :
                  'text-stone-500'
                }`}>
                  {filing.status.charAt(0).toUpperCase() + filing.status.slice(1)}
                </span>
              </Td>
              <Td>
                <span className={`text-[12px] ${COMPLIANCE_CLASS[filing.complianceStatus] ?? 'text-stone-500'}`}>
                  {filing.complianceStatus === 'non-compliant' ? 'Non-Compliant' :
                   filing.complianceStatus.charAt(0).toUpperCase() + filing.complianceStatus.slice(1)}
                </span>
              </Td>
              <Td className="text-stone-500 max-w-xs">{filing.notes}</Td>
              <Td className="text-stone-400 text-[11px]">{filing.sourceRef}</Td>
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
          {isReleasing ? 'Releasing...' : 'Release reviewed output ->'}
        </button>
      </div>
    </div>
  )
}
