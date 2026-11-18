import type { Client } from './store'

/** Facility Review is completed on the onboarding call and cannot be marked N/A. */
export const REQUIRED_INFO_FORM_NA_EXCLUDED = new Set(['facility_review', 'business_operations'])

/** All Required Info sections advisors can show/hide for a client. */
export const REQUIRED_INFO_FORM_CATALOG = [
  { key: 'business_operations', label: 'Business Operations', agentIds: ['business_operations'] },
  { key: 'facility_review', label: 'Facility Review', agentIds: ['facility_review'] },
  { key: 'digital_presence', label: 'Marketing Performance and Digital Presence', agentIds: ['digital_presence'] },
  { key: 'competitor_analysis', label: 'Competitor & Pricing Inputs', agentIds: ['competitor_analysis', 'pricing_analysis'] },
  { key: 'occupancy_review', label: 'Occupancy Review', agentIds: ['occupancy_review'] },
  { key: 'professional_advisors', label: 'Professional Advisors', agentIds: ['professional_advisors'] },
] as const

export type RequiredInfoFormKey = (typeof REQUIRED_INFO_FORM_CATALOG)[number]['key']

export const REQUIRED_INFO_FORM_LABELS: Record<RequiredInfoFormKey, string> = Object.fromEntries(
  REQUIRED_INFO_FORM_CATALOG.map(item => [item.key, item.label]),
) as Record<RequiredInfoFormKey, string>

export function canMarkRequiredInfoFormNotApplicable(formKey: string): boolean {
  return !REQUIRED_INFO_FORM_NA_EXCLUDED.has(formKey)
}

export function readFormNotApplicable(
  sectionSubmissions: Record<string, unknown> | null | undefined,
): Record<string, boolean> {
  const raw = sectionSubmissions?.formNotApplicable
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(([, value]) => Boolean(value)),
  ) as Record<string, boolean>
}

export function isRequiredInfoFormNotApplicable(
  sectionSubmissions: Record<string, unknown> | null | undefined,
  formKey: string,
): boolean {
  return Boolean(readFormNotApplicable(sectionSubmissions)[formKey])
}

export function patchRequiredInfoFormNotApplicable(
  client: Client,
  formKey: string,
  notApplicable: boolean,
): Client {
  const sectionSubmissions = { ...(client.sectionSubmissions ?? {}) } as Record<string, unknown>
  const formNotApplicable = { ...readFormNotApplicable(sectionSubmissions) }
  if (notApplicable) {
    formNotApplicable[formKey] = true
  } else {
    delete formNotApplicable[formKey]
  }

  const formAssignments = { ...((sectionSubmissions.formAssignments as Record<string, string | null>) ?? {}) }
  if (notApplicable) {
    delete formAssignments[formKey]
    if (formKey === 'competitor_analysis') delete formAssignments.pricing_analysis
  }

  return {
    ...client,
    sectionSubmissions: {
      ...sectionSubmissions,
      formNotApplicable,
      formAssignments,
    } as unknown as Client['sectionSubmissions'],
  }
}

export function patchRequiredInfoFormAssignment(
  client: Client,
  formKey: string,
  assignedTo: string | null,
): Client {
  const sectionSubmissions = { ...(client.sectionSubmissions ?? {}) } as Record<string, unknown>
  const formAssignments = {
    ...((sectionSubmissions.formAssignments as Record<string, string | null>) ?? {}),
    [formKey]: assignedTo,
  }
  if (!assignedTo) delete formAssignments[formKey]

  const formNotApplicable = { ...readFormNotApplicable(sectionSubmissions) }
  if (assignedTo) delete formNotApplicable[formKey]

  return {
    ...client,
    sectionSubmissions: {
      ...sectionSubmissions,
      formAssignments,
      formNotApplicable,
    } as unknown as Client['sectionSubmissions'],
  }
}

/** Advisor overrides: true = force show, false = force hide. Missing key = use workstream default. */
export function readRequiredInfoVisibilityOverrides(
  sectionSubmissions: Record<string, unknown> | null | undefined,
): Partial<Record<RequiredInfoFormKey, boolean>> {
  const raw = sectionSubmissions?.requiredInfoVisibility
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Partial<Record<RequiredInfoFormKey, boolean>> = {}
  for (const item of REQUIRED_INFO_FORM_CATALOG) {
    if (Object.prototype.hasOwnProperty.call(raw, item.key) && typeof (raw as any)[item.key] === 'boolean') {
      out[item.key] = (raw as any)[item.key]
    }
  }
  return out
}

export function getDefaultRequiredInfoVisibility(input: {
  agentIds: string[]
  facilityReviewMode?: string | null
}): Record<RequiredInfoFormKey, boolean> {
  const agentSet = new Set(input.agentIds)
  const facilityHiddenForClient = input.facilityReviewMode === 'advisor'
  return {
    business_operations: true,
    facility_review: agentSet.has('facility_review') && !facilityHiddenForClient,
    digital_presence: agentSet.has('digital_presence'),
    competitor_analysis: agentSet.has('competitor_analysis') || agentSet.has('pricing_analysis'),
    occupancy_review: agentSet.has('occupancy_review'),
    professional_advisors: agentSet.has('professional_advisors'),
  }
}

export function resolveRequiredInfoVisibility(input: {
  agentIds: string[]
  sectionSubmissions?: Record<string, unknown> | null
}): Record<RequiredInfoFormKey, boolean> {
  const submissions = input.sectionSubmissions ?? {}
  const defaults = getDefaultRequiredInfoVisibility({
    agentIds: input.agentIds,
    facilityReviewMode: typeof submissions.facilityReviewMode === 'string' ? submissions.facilityReviewMode : null,
  })
  const overrides = readRequiredInfoVisibilityOverrides(submissions)
  const resolved = { ...defaults }
  for (const key of Object.keys(overrides) as RequiredInfoFormKey[]) {
    const value = overrides[key]
    if (typeof value === 'boolean') resolved[key] = value
  }
  return resolved
}

export function getVisibleRequiredInfoFormKeys(visibility: Record<RequiredInfoFormKey, boolean>): RequiredInfoFormKey[] {
  return REQUIRED_INFO_FORM_CATALOG.map(item => item.key).filter(key => visibility[key])
}

export function agentIdsForRequiredInfoVisibility(
  visibility: Record<RequiredInfoFormKey, boolean>,
): string[] {
  const ids = new Set<string>()
  for (const item of REQUIRED_INFO_FORM_CATALOG) {
    if (!visibility[item.key]) continue
    for (const agentId of item.agentIds) {
      if (agentId !== 'business_operations') ids.add(agentId)
    }
  }
  return Array.from(ids)
}

export function patchRequiredInfoVisibility(
  client: Client,
  formKey: RequiredInfoFormKey,
  visible: boolean,
  defaultVisible: boolean,
): Client {
  const sectionSubmissions = { ...(client.sectionSubmissions ?? {}) } as Record<string, unknown>
  const overrides = { ...readRequiredInfoVisibilityOverrides(sectionSubmissions) }

  // Store only real overrides; matching the workstream default clears the override.
  if (visible === defaultVisible) {
    delete overrides[formKey]
  } else {
    overrides[formKey] = visible
  }

  return {
    ...client,
    sectionSubmissions: {
      ...sectionSubmissions,
      requiredInfoVisibility: overrides,
    } as unknown as Client['sectionSubmissions'],
  }
}

export function buildRequiredInfoFormTabsFromVisibility(
  visibility: Record<RequiredInfoFormKey, boolean>,
): { activeFormKeys: RequiredInfoFormKey[]; formLabels: Record<string, string> } {
  return {
    activeFormKeys: getVisibleRequiredInfoFormKeys(visibility),
    formLabels: { ...REQUIRED_INFO_FORM_LABELS, vendor_directory: 'Software & Vendors' },
  }
}

/** Fallback when only loaded questions are available (client portal). */
export function buildRequiredInfoFormTabsFromQuestions(
  formQuestions: Array<{ agentId: string }>,
  sectionSubmissions?: Record<string, unknown> | null,
): { activeFormKeys: string[]; formLabels: Record<string, string> } {
  const agentIds = Array.from(new Set(formQuestions.map(q => q.agentId).filter(Boolean)))
  const visibility = resolveRequiredInfoVisibility({ agentIds, sectionSubmissions })
  // Questions already filtered by API for client; keep intersection so empty tabs don't appear.
  const questionAgents = new Set(agentIds)
  const activeFormKeys = getVisibleRequiredInfoFormKeys(visibility).filter(key => {
    if (key === 'business_operations') return true
    const item = REQUIRED_INFO_FORM_CATALOG.find(entry => entry.key === key)
    return item ? item.agentIds.some(id => questionAgents.has(id)) : false
  })
  return {
    activeFormKeys,
    formLabels: { ...REQUIRED_INFO_FORM_LABELS, vendor_directory: 'Software & Vendors' },
  }
}
