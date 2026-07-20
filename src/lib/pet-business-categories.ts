export type PetBusinessCategoryValue =
  | 'boarding'
  | 'daycare'
  | 'grooming'
  | 'bathing'
  | 'training'
  | 'retail'
  | 'other'

export const PET_BUSINESS_CATEGORY_OPTIONS: Array<{
  value: PetBusinessCategoryValue
  label: string
}> = [
  { value: 'boarding', label: 'Boarding' },
  { value: 'daycare', label: 'Daycare' },
  { value: 'grooming', label: 'Grooming' },
  { value: 'bathing', label: 'Bathing' },
  { value: 'training', label: 'Training' },
  { value: 'retail', label: 'Retail' },
  { value: 'other', label: 'Other' },
]

export function parsePetBusinessCategories(raw: string | null | undefined): PetBusinessCategoryValue[] {
  if (!raw?.trim()) return []
  const allowed = new Set(PET_BUSINESS_CATEGORY_OPTIONS.map(option => option.value))
  return raw
    .split(',')
    .map(part => part.trim().toLowerCase())
    .filter((part): part is PetBusinessCategoryValue => allowed.has(part as PetBusinessCategoryValue))
}

export function getPetBusinessOtherDescription(raw: string | null | undefined): string {
  const match = raw?.match(/(?:^|,)\s*other\s*:\s*([^,]*?)(?=\s*,\s*(?:boarding|daycare|grooming|bathing|training|retail|other)\s*$|$)/i)
  return match?.[1] ?? ''
}

export function setPetBusinessOtherDescription(raw: string, description: string): string {
  const categories: string[] = parsePetBusinessCategories(raw).filter(value => value !== 'other')
  if (description.trim()) categories.push('other' as PetBusinessCategoryValue)
  const base = serializePetBusinessCategories(categories)
  return description ? [base, `other: ${description}`].filter(Boolean).join(', ') : base
}

export function serializePetBusinessCategories(values: Iterable<string>): string {
  const allowed = new Set(PET_BUSINESS_CATEGORY_OPTIONS.map(option => option.value))
  const unique = Array.from(new Set(Array.from(values).map(value => value.trim().toLowerCase().replace(/^other\s*:\s*/, 'other'))))
  return unique.filter((value): value is PetBusinessCategoryValue => allowed.has(value as PetBusinessCategoryValue)).join(', ')
}

export function togglePetBusinessCategory(
  current: string,
  value: PetBusinessCategoryValue,
): string {
  const selected = new Set(parsePetBusinessCategories(current))
  if (selected.has(value)) selected.delete(value)
  else selected.add(value)
  return serializePetBusinessCategories(selected)
}

export function formatPetBusinessCategories(raw: string | null | undefined): string {
  const values = parsePetBusinessCategories(raw)
  if (!values.length) return 'Not set'
  return values
    .map(value => PET_BUSINESS_CATEGORY_OPTIONS.find(option => option.value === value)?.label ?? value)
    .join(', ')
}

export type PropertyOwnership = 'lease' | 'owns' | ''

export const PROPERTY_OWNERSHIP_OPTIONS: Array<{ value: PropertyOwnership; label: string }> = [
  { value: '', label: 'Not specified' },
  { value: 'lease', label: 'Leases real estate' },
  { value: 'owns', label: 'Owns real estate' },
]
