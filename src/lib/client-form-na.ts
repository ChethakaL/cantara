/** Sentinel stored when a client marks an optional required-info field as not applicable. */
export const FORM_FIELD_NA_VALUE = 'N/A'

export function isFormFieldNa(value?: string | null): boolean {
  return (value ?? '').trim().toLowerCase() === 'n/a'
}

/** True when the field has a real answer or an explicit N/A mark. */
export function isFormFieldAnswered(value?: string | null): boolean {
  return (value ?? '').trim().length > 0
}

/** Strip N/A so downstream agents treat the field as absent. */
export function normalizeOptionalFormValue(value?: string | null): string {
  if (isFormFieldNa(value)) return ''
  return value ?? ''
}
