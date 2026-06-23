export function formatProfessionalAdvisors(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value.map((advisor: any) => [
    advisor.role ?? '',
    advisor.name ?? '',
    advisor.company ?? '',
    advisor.email ?? '',
    advisor.phone ?? '',
    advisor.willingToParticipate ?? 'unknown',
    advisor.notes ?? '',
  ].join(' | ')).join('\n')
}

export function formatVendorDirectory(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value.map((item: any) => [
    item.name ?? '',
    item.vendor ?? '',
    item.category ?? '',
    item.annualCost ?? '',
    item.contractStatus ?? '',
    item.transferable ?? 'unknown',
    item.loginAccess ?? '',
    item.notes ?? '',
  ].join(' | ')).join('\n')
}

export function syncStructuredToFormResponses(existing: Record<string, any>, client: any): Record<string, string> {
  const explicit = { ...(existing.agentFormResponses ?? {}) }

  // 1. Digital Presence Form
  if (existing.digitalPresenceForm) {
    const dp = existing.digitalPresenceForm
    if (dp.websiteUrl) explicit.businessWebsite = dp.websiteUrl
    if (dp.googleBusinessProfileUrl) explicit.googleBusinessProfileUrl = dp.googleBusinessProfileUrl
    if (dp.googleBusinessLocations) explicit.googleBusinessLocations = dp.googleBusinessLocations
    if (dp.facebookHandle) explicit.facebookHandle = dp.facebookHandle
    if (dp.instagramHandle) explicit.instagramHandle = dp.instagramHandle
    if (dp.tiktokHandle) explicit.tiktokHandle = dp.tiktokHandle
    if (dp.bookingPlatformUrl) explicit.bookingPlatformUrl = dp.bookingPlatformUrl
    if (dp.yelpUrl) explicit.yelpUrl = dp.yelpUrl
    if (dp.nextdoorUrl) explicit.nextdoorUrl = dp.nextdoorUrl
    if (dp.linkedinUrl) explicit.linkedinUrl = dp.linkedinUrl
    if (dp.glassdoorUrl) explicit.glassdoorUrl = dp.glassdoorUrl
    if (dp.bbbUrl) explicit.bbbUrl = dp.bbbUrl
  }

  // 2. Facility Review Inputs
  if (existing.facilityReviewInputs) {
    const fr = existing.facilityReviewInputs
    if (fr.location) explicit.businessAddress = fr.location
    if (fr.notes) explicit.facilityReviewNotes = fr.notes
    // Sync all other facility review keys starting with facility
    for (const [key, val] of Object.entries(fr)) {
      if (key.startsWith('facility') && typeof val === 'string') {
        explicit[key] = val
      }
    }
  }

  // 3. Vendor Directory
  if (existing.vendorDirectory) {
    explicit.vendorDirectoryList = formatVendorDirectory(existing.vendorDirectory)
  }

  // 4. Professional Advisors
  if (existing.professionalAdvisors) {
    explicit.professionalAdvisorsList = formatProfessionalAdvisors(existing.professionalAdvisors)
  }

  // 5. Competitor Pricing Inputs
  if (existing.competitorPricingInputs) {
    const cp = existing.competitorPricingInputs
    if (cp.sellerWebsiteUrl) explicit.businessWebsite = cp.sellerWebsiteUrl
    if (Array.isArray(cp.competitors)) {
      cp.competitors.forEach((c: any, i: number) => {
        explicit[`competitor${i + 1}Name`] = c.name ?? ''
        explicit[`competitor${i + 1}Website`] = c.websiteUrl ?? ''
      })
    }
  }

  return explicit
}
