export type MarketingIntakeFieldKey =
  | 'marketingChannelsAndSpend'
  | 'marketingChannelResults'
  | 'marketingPeopleAndVendors'
  | 'marketingReferralPartners'
  | 'marketingEmailProgram'
  | 'marketingAccountOwnership'

export type MarketingIntakeColumn = {
  key: string
  label: string
  placeholder?: string
  inputType?: 'text' | 'number' | 'select'
  options?: string[]
}

export const MARKETING_INTAKE_FIELDS: Record<MarketingIntakeFieldKey, MarketingIntakeColumn[]> = {
  marketingChannelsAndSpend: [
    { key: 'channel', label: 'Marketing channel', inputType: 'select', options: ['Google Ads', 'TikTok Ads', 'Directory/listing ads', 'Social media', 'Email/text marketing', 'Agency/consultant', 'Sponsorships/events', 'Other'] },
    { key: 'amount', label: 'Spend ($)', inputType: 'number', placeholder: '0' },
    { key: 'frequency', label: 'Period', inputType: 'select', options: ['Monthly', 'Annual'] },
    { key: 'spendType', label: 'Amount type', inputType: 'select', options: ['Actual', 'Estimate'] },
  ],
  marketingChannelResults: [
    { key: 'source', label: 'Channel / customer source', inputType: 'select', options: ['Paid advertising', 'Organic search / website', 'Google Business Profile', 'Social media', 'Email / text', 'Referral partners (total)', 'Repeat customers', 'Walk-in / other'] },
    { key: 'clicks', label: 'Clicks / calls', inputType: 'number', placeholder: 'If known' },
    { key: 'inquiries', label: 'Inquiries / leads', inputType: 'number', placeholder: 'If known' },
    { key: 'bookings', label: 'Bookings / new customers', inputType: 'number', placeholder: 'If known' },
    { key: 'revenue', label: 'Attributed revenue ($)', inputType: 'number', placeholder: 'If known' },
    { key: 'tracking', label: 'How tracked?', inputType: 'select', options: ['System reported', 'Asked customer', 'Estimated', 'Not tracked'] },
  ],
  marketingPeopleAndVendors: [
    { key: 'name', label: 'Name / agency', placeholder: 'Person or company' },
    { key: 'role', label: 'Role', placeholder: 'What they handle' },
    { key: 'monthlyCost', label: 'Monthly cost ($)', inputType: 'number', placeholder: '0' },
    { key: 'transferable', label: 'Can continue after sale?', inputType: 'select', options: ['Yes', 'No', 'Not sure'] },
  ],
  marketingReferralPartners: [
    { key: 'partner', label: 'Partner / source', placeholder: 'Veterinarian or referral source' },
    { key: 'type', label: 'Partner type', inputType: 'select', options: ['Veterinarian / vet hospital', 'Pet business', 'Customer referral', 'Community / event', 'Other'] },
    { key: 'annualCustomers', label: 'Customers / bookings per year', inputType: 'number', placeholder: 'If known' },
    { key: 'annualRevenue', label: 'Estimated annual revenue ($)', inputType: 'number', placeholder: 'If known' },
  ],
  marketingEmailProgram: [
    { key: 'provider', label: 'Email / text provider', placeholder: 'e.g. Mailchimp' },
    { key: 'activeSubscribers', label: 'Active subscribers', inputType: 'number', placeholder: 'If known' },
    { key: 'frequency', label: 'Send frequency', inputType: 'select', options: ['Weekly', 'Monthly', 'Quarterly', 'Occasionally', 'Not currently used'] },
    { key: 'results', label: 'Tracked results', placeholder: 'e.g. bookings, clicks, or not tracked' },
  ],
  marketingAccountOwnership: [
    { key: 'asset', label: 'Account / asset', placeholder: 'e.g. Google Ads, website domain' },
    { key: 'owner', label: 'Who owns it?', placeholder: 'Business, owner, agency…' },
    { key: 'adminAccess', label: 'Who has admin access?', placeholder: 'Role or person' },
    { key: 'transferable', label: 'Can transfer?', inputType: 'select', options: ['Yes', 'No', 'Not sure'] },
  ],
}

export function isMarketingIntakeField(fieldKey: string): fieldKey is MarketingIntakeFieldKey {
  return Object.prototype.hasOwnProperty.call(MARKETING_INTAKE_FIELDS, fieldKey)
}

export function parseMarketingRows(value: string, fieldKey: MarketingIntakeFieldKey): Array<Record<string, string>> {
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    const validKeys = new Set(MARKETING_INTAKE_FIELDS[fieldKey].map(column => column.key))
    return parsed
      .filter(row => row && typeof row === 'object' && !Array.isArray(row))
      .map(row => Object.fromEntries(Array.from(validKeys).map(key => [key, String(row[key] ?? '')])))
  } catch {
    return []
  }
}
