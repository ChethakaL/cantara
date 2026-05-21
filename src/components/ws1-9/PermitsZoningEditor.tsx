'use client'

import type { WS19Report, WS19Flag } from '@/types/ws1-9-types'
import { AdminReviewTab } from './TabPanels'

function FieldInput({
  value,
  onChange,
  textarea = false,
}: {
  value: string
  onChange: (value: string) => void
  textarea?: boolean
}) {
  const className =
    'w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-[12px] text-stone-800 outline-none focus:ring-2 focus:ring-amber-100'
  return textarea ? (
    <textarea
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      className={`${className} min-h-[90px] leading-relaxed`}
    />
  ) : (
    <input
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      className={className}
    />
  )
}

function EditableTable({
  columns,
  rows,
  onRowsChange,
  newRow,
}: {
  columns: Array<{
    key: string
    label: string
    type?: 'text' | 'textarea' | 'boolean' | 'select'
    options?: string[]
  }>
  rows: Record<string, unknown>[]
  onRowsChange: (rows: Record<string, unknown>[]) => void
  newRow: Record<string, unknown>
}) {
  const updateRow = (index: number, key: string, value: unknown) => {
    onRowsChange(rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)))
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
      <table className="w-full min-w-[900px] text-left">
        <thead className="bg-stone-50">
          <tr>
            {columns.map(column => (
              <th
                key={column.key}
                className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-stone-500"
              >
                {column.label}
              </th>
            ))}
            <th className="w-12 px-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-stone-100 align-top">
              {columns.map(column => (
                <td key={column.key} className="px-3 py-2">
                  {column.type === 'boolean' ? (
                    <select
                      value={row[column.key] === true ? 'yes' : row[column.key] === false ? 'no' : ''}
                      onChange={e =>
                        updateRow(
                          index,
                          column.key,
                          e.target.value === 'yes' ? true : e.target.value === 'no' ? false : null
                        )
                      }
                      className="w-full rounded-lg border border-amber-300 bg-white px-2 py-2 text-[12px]"
                    >
                      <option value="">Unknown</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  ) : column.type === 'select' ? (
                    <select
                      value={String(row[column.key] ?? '')}
                      onChange={e => updateRow(index, column.key, e.target.value)}
                      className="w-full rounded-lg border border-amber-300 bg-white px-2 py-2 text-[12px]"
                    >
                      {(column.options ?? []).map(option => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <FieldInput
                      value={String(row[column.key] ?? '')}
                      textarea={column.type === 'textarea'}
                      onChange={value => updateRow(index, column.key, value)}
                    />
                  )}
                </td>
              ))}
              <td className="px-2 py-3 text-center">
                <button
                  className="text-red-400 hover:text-red-600"
                  onClick={() => onRowsChange(rows.filter((_, i) => i !== index))}
                >
                  x
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-stone-100 bg-stone-50 px-4 py-3">
        <button
          className="text-[12px] font-semibold text-amber-700 hover:text-amber-800"
          onClick={() => onRowsChange([...rows, { ...newRow }])}
        >
          + Add row
        </button>
      </div>
    </div>
  )
}

interface EditorProps {
  activeTab: string
  report: WS19Report
  onChange: (report: WS19Report) => void
  flags: WS19Flag[]
  onConfirm: (id: string) => void
  onNA: (id: string) => void
  onRelease: () => void
  isReleasing: boolean
}

export function PermitsZoningStructuredEditor({
  activeTab,
  report,
  onChange,
  flags,
  onConfirm,
  onNA,
  onRelease,
  isReleasing,
}: EditorProps) {
  const patch = (updates: Partial<WS19Report>) => onChange({ ...report, ...updates })
  const patchSummary = (key: keyof WS19Report['buyerSummary'], value: unknown) => {
    patch({ buyerSummary: { ...report.buyerSummary, [key]: value } })
  }

  if (activeTab === 'summary') {
    const fields: Array<[keyof WS19Report['buyerSummary'], string]> = [
      ['permitsOverview', 'Permits overview'],
      ['zoningCompliance', 'Zoning compliance'],
      ['conditionalUseStatus', 'Conditional use permit status'],
      ['grandfatheringRisk', 'Grandfathering risk'],
      ['transferConsiderations', 'Transfer considerations'],
    ]
    return (
      <div className="p-6 space-y-4">
        {fields.map(([key, label]) => (
          <div key={String(key)}>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{label}</p>
            <FieldInput
              textarea
              value={String(report.buyerSummary[key] ?? '')}
              onChange={value => patchSummary(key, value)}
            />
          </div>
        ))}
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
            Counsel review items (one per line)
          </p>
          <FieldInput
            textarea
            value={(report.buyerSummary.counselItems ?? []).join('\n')}
            onChange={value =>
              patchSummary(
                'counselItems',
                value.split('\n').map(s => s.trim()).filter(Boolean)
              )
            }
          />
        </div>
      </div>
    )
  }

  if (activeTab === 'documents') {
    return (
      <div className="p-6">
        <EditableTable
          rows={report.documents as unknown as Record<string, unknown>[]}
          onRowsChange={documents =>
            patch({ documents: documents as unknown as WS19Report['documents'] })
          }
          newRow={{
            id: `doc-${Date.now()}`,
            filename: '',
            docType: 'Other',
            issuingAuthority: '',
            date: '',
            status: 'incomplete',
          }}
          columns={[
            { key: 'filename', label: 'Document' },
            { key: 'docType', label: 'Type' },
            { key: 'issuingAuthority', label: 'Issuing authority' },
            { key: 'date', label: 'Date' },
            {
              key: 'status',
              label: 'Status',
              type: 'select',
              options: ['complete', 'incomplete', 'missing'],
            },
          ]}
        />
      </div>
    )
  }

  if (activeTab === 'permits') {
    return (
      <div className="p-6">
        <EditableTable
          rows={report.permits as unknown as Record<string, unknown>[]}
          onRowsChange={permits => patch({ permits: permits as unknown as WS19Report['permits'] })}
          newRow={{
            id: `permit-${Date.now()}`,
            permitType: '',
            permitNumber: '',
            issuingAuthority: '',
            issueDate: '',
            expirationDate: '',
            status: 'Unknown',
            renewalProcess: '',
            conditions: '',
            sourceRef: '',
          }}
          columns={[
            { key: 'permitType', label: 'Permit type' },
            { key: 'permitNumber', label: 'Permit #' },
            { key: 'issuingAuthority', label: 'Authority' },
            { key: 'issueDate', label: 'Issue date' },
            { key: 'expirationDate', label: 'Expiration' },
            {
              key: 'status',
              label: 'Status',
              type: 'select',
              options: ['Current', 'Expired', 'Expiring Soon', 'Pending', 'Unknown'],
            },
            { key: 'renewalProcess', label: 'Renewal', type: 'textarea' },
            { key: 'conditions', label: 'Conditions', type: 'textarea' },
          ]}
        />
      </div>
    )
  }

  if (activeTab === 'zoning') {
    return (
      <div className="p-6 space-y-4">
        {report.zoning.map((zone, index) => (
          <div key={zone.id} className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-[12px] font-semibold text-stone-700">Zoning record {index + 1}</p>
              <button
                className="text-red-400 text-[11px]"
                onClick={() => patch({ zoning: report.zoning.filter((_, i) => i !== index) })}
              >
                Remove
              </button>
            </div>
            {(
              [
                ['propertyAddress', 'Property address'],
                ['zoningDesignation', 'Zoning designation'],
                ['currentUse', 'Current use'],
                ['setbacks', 'Setbacks'],
                ['parkingRequirements', 'Parking'],
                ['noiseOrdinance', 'Noise ordinance'],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <p className="mb-1 text-[11px] text-stone-500">{label}</p>
                <FieldInput
                  value={zone[key]}
                  onChange={value => {
                    const zoning = [...report.zoning]
                    zoning[index] = { ...zone, [key]: value }
                    patch({ zoning })
                  }}
                />
              </div>
            ))}
            <div>
              <p className="mb-1 text-[11px] text-stone-500">Compliance status</p>
              <select
                value={zone.complianceStatus}
                onChange={e => {
                  const zoning = [...report.zoning]
                  zoning[index] = { ...zone, complianceStatus: e.target.value as typeof zone.complianceStatus }
                  patch({ zoning })
                }}
                className="w-full rounded-lg border border-amber-300 bg-white px-2 py-2 text-[12px]"
              >
                {['Compliant', 'Non-Compliant', 'Conditional', 'Unknown'].map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="mb-1 text-[11px] text-stone-500">Permitted uses (comma-separated)</p>
              <FieldInput
                value={zone.permittedUses.join(', ')}
                onChange={value => {
                  const zoning = [...report.zoning]
                  zoning[index] = {
                    ...zone,
                    permittedUses: value.split(',').map(s => s.trim()).filter(Boolean),
                  }
                  patch({ zoning })
                }}
              />
            </div>
            <div>
              <p className="mb-1 text-[11px] text-stone-500">Restrictions (one per line)</p>
              <FieldInput
                textarea
                value={zone.restrictions.join('\n')}
                onChange={value => {
                  const zoning = [...report.zoning]
                  zoning[index] = {
                    ...zone,
                    restrictions: value.split('\n').map(s => s.trim()).filter(Boolean),
                  }
                  patch({ zoning })
                }}
              />
            </div>
          </div>
        ))}
        <button
          className="text-[12px] font-semibold text-amber-700"
          onClick={() =>
            patch({
              zoning: [
                ...report.zoning,
                {
                  id: `zone-${Date.now()}`,
                  propertyAddress: '',
                  zoningDesignation: '',
                  permittedUses: [],
                  currentUse: '',
                  complianceStatus: 'Unknown',
                  restrictions: [],
                  setbacks: '',
                  parkingRequirements: '',
                  noiseOrdinance: '',
                  sourceRef: '',
                },
              ],
            })
          }
        >
          + Add zoning record
        </button>
      </div>
    )
  }

  if (activeTab === 'conditionaluse') {
    return (
      <div className="p-6 space-y-4">
        {report.conditionalUsePermits.map((cup, index) => (
          <div key={cup.id} className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
            <div className="flex justify-between">
              <p className="text-[12px] font-semibold text-stone-700">CUP {index + 1}</p>
              <button
                className="text-red-400 text-[11px]"
                onClick={() =>
                  patch({
                    conditionalUsePermits: report.conditionalUsePermits.filter((_, i) => i !== index),
                  })
                }
              >
                Remove
              </button>
            </div>
            {(
              [
                ['cupNumber', 'CUP number'],
                ['issuingAuthority', 'Issuing authority'],
                ['issueDate', 'Issue date'],
                ['approvedUse', 'Approved use'],
                ['renewalDate', 'Renewal date'],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <p className="mb-1 text-[11px] text-stone-500">{label}</p>
                <FieldInput
                  value={cup[key]}
                  onChange={value => {
                    const cups = [...report.conditionalUsePermits]
                    cups[index] = { ...cup, [key]: value }
                    patch({ conditionalUsePermits: cups })
                  }}
                />
              </div>
            ))}
            <div>
              <p className="mb-1 text-[11px] text-stone-500">Conditions (one per line)</p>
              <FieldInput
                textarea
                value={cup.conditions.join('\n')}
                onChange={value => {
                  const cups = [...report.conditionalUsePermits]
                  cups[index] = {
                    ...cup,
                    conditions: value.split('\n').map(s => s.trim()).filter(Boolean),
                  }
                  patch({ conditionalUsePermits: cups })
                }}
              />
            </div>
          </div>
        ))}
        <button
          className="text-[12px] font-semibold text-amber-700"
          onClick={() =>
            patch({
              conditionalUsePermits: [
                ...report.conditionalUsePermits,
                {
                  id: `cup-${Date.now()}`,
                  cupNumber: '',
                  issuingAuthority: '',
                  issueDate: '',
                  approvedUse: '',
                  conditions: [],
                  complianceStatus: 'Unknown',
                  renewalRequired: false,
                  renewalDate: '',
                  transferability: 'Unknown',
                  sourceRef: '',
                },
              ],
            })
          }
        >
          + Add CUP
        </button>
      </div>
    )
  }

  if (activeTab === 'grandfathering') {
    return (
      <div className="p-6 space-y-4">
        {report.grandfathering.map((gf, index) => (
          <div key={gf.id} className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
            <div className="flex justify-between">
              <p className="text-[12px] font-semibold text-stone-700">Grandfathering {index + 1}</p>
              <button
                className="text-red-400 text-[11px]"
                onClick={() => patch({ grandfathering: report.grandfathering.filter((_, i) => i !== index) })}
              >
                Remove
              </button>
            </div>
            {(
              [
                ['nonConformingUse', 'Non-conforming use'],
                ['originalApprovalDate', 'Original approval date'],
                ['currentBasis', 'Current legal basis'],
                ['mitigationOptions', 'Mitigation options'],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <p className="mb-1 text-[11px] text-stone-500">{label}</p>
                <FieldInput
                  value={gf[key]}
                  onChange={value => {
                    const items = [...report.grandfathering]
                    items[index] = { ...gf, [key]: value }
                    patch({ grandfathering: items })
                  }}
                />
              </div>
            ))}
            <div>
              <p className="mb-1 text-[11px] text-stone-500">Trigger events (one per line)</p>
              <FieldInput
                textarea
                value={gf.triggerEvents.join('\n')}
                onChange={value => {
                  const items = [...report.grandfathering]
                  items[index] = {
                    ...gf,
                    triggerEvents: value.split('\n').map(s => s.trim()).filter(Boolean),
                  }
                  patch({ grandfathering: items })
                }}
              />
            </div>
          </div>
        ))}
        <button
          className="text-[12px] font-semibold text-amber-700"
          onClick={() =>
            patch({
              grandfathering: [
                ...report.grandfathering,
                {
                  id: `gf-${Date.now()}`,
                  nonConformingUse: '',
                  originalApprovalDate: '',
                  currentBasis: '',
                  triggerEvents: [],
                  riskLevel: 'Unknown',
                  mitigationOptions: '',
                  sourceRef: '',
                },
              ],
            })
          }
        >
          + Add grandfathering item
        </button>
      </div>
    )
  }

  return (
    <AdminReviewTab
      report={report}
      flags={flags}
      onConfirm={onConfirm}
      onNA={onNA}
      onRelease={onRelease}
      isReleasing={isReleasing}
    />
  )
}
