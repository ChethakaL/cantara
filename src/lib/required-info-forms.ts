import type { Client } from './store'

/** Facility Review is completed on the onboarding call and cannot be marked N/A. */
export const REQUIRED_INFO_FORM_NA_EXCLUDED = new Set(['facility_review'])

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
    },
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
    },
  }
}
