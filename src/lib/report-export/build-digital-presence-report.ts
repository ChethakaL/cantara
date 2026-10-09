import type { DigitalPresenceReport } from '@/lib/digital-presence/types'
import {
  generateReportHtml,
  buildHtmlTable,
  buildBulletList,
  type ReportConfig,
} from './generate-report-html'

export function buildDigitalPresenceReportHtml(report: DigitalPresenceReport): string {
  // Channel scores table
  const channelRows = report.channels.map(ch => [
    ch.channelLabel,
    `${ch.score}/5`,
    ch.trafficLight === 'green' ? 'Good' : ch.trafficLight === 'amber' ? 'Fair' : 'Poor',
    ch.summary,
  ])
  const channelTable = buildHtmlTable(
    ['Channel', 'Score', 'Status', 'Summary'],
    channelRows,
  )

  // Flags summary
  const allFlags = report.channels.flatMap(ch => ch.flags)
  const criticalFlags = allFlags.filter(f => f.severity === 'critical').map(f => f.message)
  const warningFlags = allFlags.filter(f => f.severity === 'warning').map(f => f.message)
  const positiveFlags = allFlags.filter(f => f.severity === 'positive').map(f => f.message)

  let flagsContent = ''
  if (criticalFlags.length) flagsContent += `<p style="font-weight:700;color:#b91c1c;">Critical Issues</p>` + buildBulletList(criticalFlags)
  if (warningFlags.length) flagsContent += `<p style="font-weight:700;color:#92400e;">Warnings</p>` + buildBulletList(warningFlags)
  if (positiveFlags.length) flagsContent += `<p style="font-weight:700;color:#166534;">Positive Signals</p>` + buildBulletList(positiveFlags)

  // Asset inventory
  const activeAssets = report.digitalAssetInventory.filter(a => a.status === 'active')
  const assetRows = activeAssets.map(a => [
    a.assetType,
    a.channelType.replace(/_/g, ' '),
    a.url,
    a.score ? `${a.score}/5` : '-',
  ])
  const assetTable = assetRows.length
    ? buildHtmlTable(['Asset', 'Channel', 'URL', 'Score'], assetRows)
    : '<p>No active digital assets found.</p>'

  const greenCount = report.channels.filter(ch => ch.trafficLight === 'green').length
  const redCount = report.channels.filter(ch => ch.trafficLight === 'red').length
  const marketingInputHtml = buildMarketingInputsHtml(report.marketingIntake)
  const marketingHighlightsHtml = buildMarketingHighlightsHtml(report.marketingIntake)
  const marketingEvidenceHtml = buildMarketingEvidenceHtml(report.marketingEvidence)

  const config: ReportConfig = {
    title: 'Marketing Spend & Performance Agent Report',
    subtitle: 'Marketing Performance & M&A Readiness',
    clientName: report.businessName,
    generatedAt: report.generatedAt,
    summary: report.executiveSummary,
    kpis: [
      { label: 'Overall Score', value: `${report.overallScore}/5` },
      { label: 'Channels Good', value: String(greenCount) },
      { label: 'Channels At Risk', value: String(redCount) },
      { label: 'Active Assets', value: String(activeAssets.length) },
    ],
    sections: [
      { title: 'Channel Scores', content: channelTable },
      ...(flagsContent ? [{ title: 'Key Flags', content: flagsContent }] : []),
      { title: 'Digital Asset Inventory', content: assetTable },
      ...((report.marketingAssessment || marketingEvidenceHtml || marketingInputHtml) ? [{
        title: 'Marketing Spend & Performance',
        newPage: true,
        content: `
          ${marketingHighlightsHtml}
          ${marketingEvidenceHtml ? `<div style="margin: 16px 0;"><h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Public Market &amp; Website Findings</h3>${marketingEvidenceHtml}</div>` : ''}
          ${report.marketingAssessment ? `
            <div class="executive-summary" style="margin: 16px 0;">
              <p class="summary-label">Advisor Assessment</p>
              <p style="font-size: 12.5px; line-height: 1.6; color: #334155; margin: 0;">${escapeHtml(advisorFriendlyText(report.marketingAssessment))}</p>
            </div>
          ` : ''}
          ${marketingInputHtml ? `<div style="margin: 16px 0;"><h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Owner-Provided Marketing Operations</h3>${marketingInputHtml}</div>` : ''}
          ${report.marketingIntake && Object.values(report.marketingIntake).some(value => /\b(?:assum(?:e|ed|ption)|sample|test entry)\b/i.test(value)) ? '<div class="flag-item orange" style="margin-top: 10px;"><div class="flag-title">Assumptions Note</div><div class="flag-detail">Some saved figures or descriptions are marked as assumed or sample information. Verify them with the business before relying on them.</div></div>' : ''}
          <div class="flag-item orange" style="margin-top: 14px;">
            <div class="flag-title">Buyer Follow-Up Guidance</div>
            <div class="flag-detail">Reconcile channel spend and bookings to platform exports and financials; obtain campaign-level advertising and website analytics, email results, written goals, and peak/off-season trends. Calculating spend as a share of revenue requires verified marketing expense and revenue. Public search placement and website performance do not verify advertising spend, traffic, bookings, or sales.</div>
          </div>
        `,
      }] : []),
      ...(report.maReadinessNotes ? [{ title: 'M&A Readiness Notes', content: `<p>${escapeHtml(report.maReadinessNotes)}</p>` }] : []),
    ],
  }

  const html = generateReportHtml(config)
  return html.replace(
    '</style>',
    `
  @page {
    size: A4;
    margin: 22mm 16mm 20mm 16mm !important;
  }
  @page :first {
    margin: 0 !important;
  }
  @media print {
    body {
      margin: 0 !important;
    }
    .cover {
      page-break-after: always;
      min-height: 100vh !important;
      height: 100vh !important;
    }
    .report-section {
      padding-top: 8px;
    }
  }
</style>`
  )
}

function buildMarketingEvidenceHtml(evidence?: DigitalPresenceReport['marketingEvidence']): string {
  if (!evidence?.length) return ''

  const cleanLines = (content: string) => content
    .split('\n')
    .filter(line => !/^Reported DataForSEO request cost:/i.test(line))

  const speedItem = evidence.find(
    i => i.source === 'Google PageSpeed Insights' || i.source === 'Website speed and quality'
  )
  const cruxItem = evidence.find(
    i => i.source === 'Chrome UX Report (CrUX)' || i.source === 'Real visitor website experience'
  )
  const searchItem = evidence.find(
    i => i.source === 'Google organic search visibility' || i.source === 'Website visibility in Google search'
  )
  const mapsItem = evidence.find(
    i => i.source === 'DataForSEO Google Maps local results' || i.source === 'Nearby businesses in local search'
  )

  let html = ''

  // 1. TOP: Website Speed and Quality (Lighthouse Audit)
  if (speedItem && speedItem.status === 'connected') {
    const content = cleanLines(speedItem.content)
    const testedUrl = content.find(line => line.startsWith('Tested URL:'))?.replace('Tested URL:', '').trim()
    const testTime = content.find(line => line.startsWith('Test time:'))?.replace('Test time:', '').trim()
    const scoreLine = content.find(line => line.startsWith('Mobile Lighthouse scores:')) ?? ''
    const scores = Array.from(scoreLine.matchAll(/([^:;]+):\s*(\d+)\/100/g)).map(match => ({
      metric: match[1].replace('Mobile Lighthouse scores:', '').trim(),
      score: parseInt(match[2], 10),
    }))
    const opportunities = content
      .slice(content.findIndex(line => line.startsWith('Largest opportunities:')) + 1)
      .filter(line => line.startsWith('- '))
      .map(line => line.slice(2))

    if (scores.length) {
      const speedRows = scores.map(s => {
        const rating = s.score >= 90 ? 'Good' : s.score >= 50 ? 'Fair' : 'Poor'
        const details = s.metric.toLowerCase().includes('performance') && opportunities.length
          ? opportunities.join('; ')
          : s.score >= 90
          ? 'Meets standard Lighthouse thresholds'
          : 'Optimization recommended'
        return [s.metric, `${s.score}/100`, rating, details]
      })

      html += `
        <div style="margin: 14px 0 18px; break-inside: avoid;">
          <h4 style="font-size: 13px; font-weight: 700; color: #1e293b; margin: 0 0 4px;">Website Speed &amp; Quality (Lighthouse Audit)</h4>
          ${testedUrl ? `<p style="font-size: 11px; color: #64748b; margin-bottom: 8px;">Tested URL: <a href="${testedUrl}" target="_blank" style="color: #2563eb; text-decoration: underline;">${escapeHtml(testedUrl)}</a>${testTime ? ` &middot; Mobile lab audit` : ''}</p>` : ''}
          ${buildHtmlTable(['Audit Metric', 'Score', 'Status', 'Details & Opportunities'], speedRows)}
        </div>
      `
    }

    // CrUX field data if present
    if (cruxItem && cruxItem.status === 'connected') {
      const cruxContent = cleanLines(cruxItem.content)
      const labels: Record<string, string> = {
        LCP: 'Loading Speed (LCP)',
        CLS: 'Layout Stability (CLS)',
        INP: 'Responsiveness (INP)',
        FCP: 'First Content (FCP)',
        TTFB: 'Server Response (TTFB)',
      }
      const cruxMetrics = Array.from(cruxContent.join('\n').matchAll(/([A-Z]+) p75:\s*([\d.]+)(?:\s*(ms))?/g)).map(match => {
        const key = match[1]
        const val = `${match[2]} ${match[3] || ''}`.trim()
        const note = key === 'LCP' ? 'Target: < 2.5s' : key === 'CLS' ? 'Target: < 0.1' : key === 'INP' ? 'Target: < 200ms' : 'Standard Web Vital'
        return [labels[key] ?? key, val, note]
      })
      const period = cruxContent.find(line => line.startsWith('Collection period:'))?.replace('Collection period:', '').trim()

      if (cruxMetrics.length) {
        html += `
          <div style="margin: 12px 0 16px; break-inside: avoid;">
            <h5 style="font-size: 12px; font-weight: 700; color: #334155; margin: 0 0 4px;">Real Visitor Field Experience (CrUX)</h5>
            ${period ? `<p style="font-size: 10px; color: #64748b; margin-bottom: 6px;">Collection period: ${escapeHtml(period)} (75th percentile)</p>` : ''}
            ${buildHtmlTable(['Core Web Vital', '75th Percentile', 'Target Benchmark'], cruxMetrics)}
          </div>
        `
      }
    }
  }

  // 2. Google Organic Search Visibility
  if (searchItem && searchItem.status === 'connected') {
    const rawContent = searchItem.content ?? ''
    const keyword = rawContent.match(/Search phrase:\s*(.+)/)?.[1]
    const location = rawContent.match(/Search location:\s*(.+)/)?.[1]
    const content = cleanLines(searchItem.content)
    const resultLines = content.filter(line => line.startsWith('- Organic result ') || line.startsWith('- Paid placement '))
    const searchRows = resultLines.flatMap(line => {
      const match = /^- (Organic result|Paid placement) (\d+):\s*([^;]+)(?: \[CLIENT WEBSITE\])?;\s*([^;]*);\s*(.*)$/.exec(line)
      if (!match) return []
      const isClient = line.includes('[CLIENT WEBSITE]')
      const type = isClient ? 'Client Website' : match[1] === 'Paid placement' ? 'Paid Placement' : 'Organic'
      const title = match[4] || match[3]
      const url = match[5] || match[3]
      return [[`#${match[2]}`, type, title, url]]
    })

    if (searchRows.length) {
      html += `
        <div style="margin: 14px 0 18px; break-inside: avoid;">
          <h4 style="font-size: 13px; font-weight: 700; color: #1e293b; margin: 0 0 4px;">Website Visibility in Google Search</h4>
          <p style="font-size: 11px; color: #64748b; margin-bottom: 8px;">
            Search query: <strong>${escapeHtml(keyword || '—')}</strong>${location ? ` &middot; Location: <strong>${escapeHtml(location)}</strong>` : ''}
          </p>
          ${buildHtmlTable(['Rank', 'Type', 'Listing / Domain', 'URL'], searchRows)}
          <p style="font-size: 10px; color: #94a3b8; margin-top: 4px;">Search results show point-in-time visibility. Paid placements do not establish client ad spend.</p>
        </div>
      `
    }
  }

  // 3. Nearby Businesses in Local Search (Google Maps)
  if (mapsItem && mapsItem.status === 'connected') {
    const content = cleanLines(mapsItem.content)
    const heading = content.find(line => line.startsWith('Google Maps results for'))
    const resultLines = content.filter(line => line.startsWith('- Rank '))
    const mapRows = resultLines.flatMap(line => {
      const match = /^- Rank (\d+):\s*(.*)$/.exec(line)
      if (!match) return []
      const parts = match[2].split(';').map(p => p.trim())
      const rawName = parts.shift() ?? 'Business'
      const isClient = line.includes('[POSSIBLE CLIENT LISTING]')
      const name = rawName.replace(' [POSSIBLE CLIENT LISTING]', '') + (isClient ? ' (Your Business)' : '')
      const address = parts.find(p => /\d.*\b(?:OK|BC|WA|CA|TX|NY|AZ|CO|FL|ON|AB)\b/i.test(p)) ?? '—'
      const rating = parts.find(p => /^rating\s/i.test(p))?.replace(/^rating\s*/i, '') ?? '—'
      const reviews = parts.find(p => /^review count\s/i.test(p))?.replace(/^review count\s*/i, '') ?? '—'
      const website = parts.find(p => !/^rating\s|^review count\s|^\[POSSIBLE CLIENT LISTING\]$/i.test(p) && p !== address) ?? '—'
      return [[`#${match[1]}`, name, rating !== '—' ? `${rating} ★` : '—', reviews, address, website]]
    })

    if (mapRows.length) {
      html += `
        <div style="margin: 14px 0 18px; break-inside: avoid;">
          <h4 style="font-size: 13px; font-weight: 700; color: #1e293b; margin: 0 0 4px;">Nearby Businesses in Local Search (Google Maps)</h4>
          ${heading ? `<p style="font-size: 11px; color: #64748b; margin-bottom: 8px;">${escapeHtml(heading)}</p>` : ''}
          ${buildHtmlTable(['Rank', 'Business Name', 'Rating', 'Reviews', 'Address', 'Website'], mapRows)}
          <p style="font-size: 10px; color: #94a3b8; margin-top: 4px;">Local search results near business address. Rankings vary by time and location.</p>
        </div>
      `
    }
  }

  return html
}

function buildMarketingInputsHtml(intake?: Record<string, string>): string {
  if (!intake || !Object.keys(intake).length) return ''

  let html = ''

  // Channel Spend table
  if (intake.marketingChannelsAndSpend) {
    try {
      const rows = JSON.parse(intake.marketingChannelsAndSpend)
      if (Array.isArray(rows) && rows.length > 0) {
        const tableRows = rows.map((r: any) => [
          r.channel || 'Other channel',
          r.amount ? formatCurrency(Number(r.amount)) : 'Not provided',
          r.frequency || 'Monthly',
          r.spendType || 'Estimate',
        ])
        html += `
          <div style="margin: 14px 0; break-inside: avoid;">
            <h4 style="font-size: 13px; font-weight: 700; color: #1e293b; margin: 0 0 6px;">Marketing Channels &amp; Spend</h4>
            ${buildHtmlTable(['Channel', 'Amount', 'Frequency', 'Basis'], tableRows)}
          </div>
        `
      }
    } catch { /* ignore */ }
  }

  // Reported Outcomes table
  if (intake.marketingChannelResults) {
    try {
      const rows = JSON.parse(intake.marketingChannelResults)
      if (Array.isArray(rows) && rows.length > 0) {
        const tableRows = rows.map((r: any) => [
          r.source || 'Other source',
          r.clicks || 'Not tracked',
          r.inquiries || 'Not tracked',
          r.bookings || 'Not tracked',
          r.revenue ? formatCurrency(Number(r.revenue)) : 'Not tracked',
          r.tracking || 'Estimated',
        ])
        html += `
          <div style="margin: 14px 0; break-inside: avoid;">
            <h4 style="font-size: 13px; font-weight: 700; color: #1e293b; margin: 0 0 6px;">Reported Channel Inquiries, Bookings &amp; Revenue</h4>
            ${buildHtmlTable(['Source', 'Clicks / Calls', 'Inquiries', 'Bookings', 'Attributed Revenue', 'Tracking Method'], tableRows)}
          </div>
        `
      }
    } catch { /* ignore */ }
  }

  // Email Program
  if (intake.marketingEmailProgram) {
    try {
      const rows = JSON.parse(intake.marketingEmailProgram)
      if (Array.isArray(rows) && rows.length > 0) {
        const tableRows = rows.map((r: any) => [
          r.provider || 'Email platform',
          r.activeSubscribers || 'Not provided',
          r.frequency || 'Monthly',
          r.results || 'Not provided',
        ])
        html += `
          <div style="margin: 14px 0; break-inside: avoid;">
            <h4 style="font-size: 13px; font-weight: 700; color: #1e293b; margin: 0 0 6px;">Email &amp; Direct Outreach</h4>
            ${buildHtmlTable(['Platform', 'Active Subscribers', 'Sending Cadence', 'Reported Measurement'], tableRows)}
          </div>
        `
      }
    } catch { /* ignore */ }
  }

  // Booking Funnel & Plan text
  const funnel = intake.marketingBookingFunnel?.trim()
  const plan = intake.marketingPlanAndBudget?.trim()
  if (funnel || plan) {
    const textRows = [
      ...(funnel ? [['Booking & Conversion Path', funnel]] : []),
      ...(plan ? [['Marketing Budget & Plan', plan]] : []),
    ]
    html += `
      <div style="margin: 14px 0; break-inside: avoid;">
        <h4 style="font-size: 13px; font-weight: 700; color: #1e293b; margin: 0 0 6px;">Conversion Funnel &amp; Growth Plan</h4>
        ${buildHtmlTable(['Area', 'Reported Practice'], textRows)}
      </div>
    `
  }

  // People & Vendors
  if (intake.marketingPeopleAndVendors) {
    try {
      const rows = JSON.parse(intake.marketingPeopleAndVendors)
      if (Array.isArray(rows) && rows.length > 0) {
        const tableRows = rows.map((r: any) => [
          r.name || 'Unspecified',
          r.role || 'Unspecified',
          r.monthlyCost ? formatCurrency(Number(r.monthlyCost)) : 'Not provided',
          r.transferable || 'Not confirmed',
        ])
        html += `
          <div style="margin: 14px 0; break-inside: avoid;">
            <h4 style="font-size: 13px; font-weight: 700; color: #1e293b; margin: 0 0 6px;">Marketing Team &amp; Agency Vendors</h4>
            ${buildHtmlTable(['Name / Agency', 'Role & Responsibilities', 'Monthly Cost', 'Transferable Post-Sale?'], tableRows)}
          </div>
        `
      }
    } catch { /* ignore */ }
  }

  // Account Ownership
  if (intake.marketingAccountOwnership) {
    try {
      const rows = JSON.parse(intake.marketingAccountOwnership)
      if (Array.isArray(rows) && rows.length > 0) {
        const tableRows = rows.map((r: any) => [
          r.asset || 'Marketing account',
          r.owner || 'Not verified',
          r.adminAccess || 'Not verified',
          r.transferable || 'Not confirmed',
        ])
        html += `
          <div style="margin: 14px 0; break-inside: avoid;">
            <h4 style="font-size: 13px; font-weight: 700; color: #1e293b; margin: 0 0 6px;">Account Ownership &amp; Administrator Access</h4>
            ${buildHtmlTable(['Marketing Asset', 'Account Owner', 'Admin Credentials', 'Transferable Post-Sale?'], tableRows)}
          </div>
        `
      }
    } catch { /* ignore */ }
  }

  // Referral Partners
  if (intake.marketingReferralPartners) {
    try {
      const rows = JSON.parse(intake.marketingReferralPartners)
      if (Array.isArray(rows) && rows.length > 0) {
        const tableRows = rows.map((r: any) => [
          r.partner || 'Partner',
          r.type || 'Referral source',
          r.annualCustomers || 'Not tracked',
          r.annualRevenue ? formatCurrency(Number(r.annualRevenue)) : 'Not tracked',
        ])
        html += `
          <div style="margin: 14px 0; break-inside: avoid;">
            <h4 style="font-size: 13px; font-weight: 700; color: #1e293b; margin: 0 0 6px;">Referral Relationships &amp; Strategic Partners</h4>
            ${buildHtmlTable(['Partner Name', 'Partner Type', 'Annual Customers', 'Annual Attributed Revenue'], tableRows)}
          </div>
        `
      }
    } catch { /* ignore */ }
  }

  const reviews = intake.marketingReviewManagement?.trim()
  if (reviews) {
    html += `
      <div style="margin: 14px 0; break-inside: avoid;">
        <h4 style="font-size: 13px; font-weight: 700; color: #1e293b; margin: 0 0 6px;">Reputation &amp; Review Management</h4>
        <p style="font-size: 12px; color: #334155; line-height: 1.6; margin: 0;">${escapeHtml(reviews)}</p>
      </div>
    `
  }

  return html
}

function buildMarketingHighlightsHtml(intake?: Record<string, string>): string {
  if (!intake) return ''
  let monthlySpend = 0
  let hasSpend = false
  let allEstimates = true
  try {
    const rows: unknown = JSON.parse(intake.marketingChannelsAndSpend ?? '[]')
    if (Array.isArray(rows)) for (const row of rows) {
      const amount = Number(row?.amount)
      if (!Number.isFinite(amount)) continue
      hasSpend = true
      monthlySpend += amount / (/annual/i.test(String(row.frequency ?? '')) ? 12 : 1)
      allEstimates &&= /estimate/i.test(String(row.spendType ?? ''))
    }
  } catch { /* ignore */ }
  const results = (() => { try { const rows: unknown = JSON.parse(intake.marketingChannelResults ?? '[]'); return Array.isArray(rows) ? rows.length : 0 } catch { return 0 } })()
  if (!hasSpend && !results && !intake.marketingReportingPeriod) return ''

  const rows = [
    ['Estimated Monthly Spend', hasSpend ? formatCurrency(monthlySpend) : 'Not provided', allEstimates ? 'Owner estimate' : 'Reported amounts'],
    ['Annualized Spend Run-Rate', hasSpend ? formatCurrency(monthlySpend * 12) : 'Not provided', 'Annualized based on entered channel amounts'],
    ['Revenue Attribution', results > 0 ? `${results} channel sources reported` : 'Not provided', intake.marketingReportingPeriod ? `Period: ${intake.marketingReportingPeriod}` : 'Verification varies by source'],
  ]

  return `
    <div style="margin: 0 0 16px; break-inside: avoid;">
      <h4 style="font-size: 13px; font-weight: 700; color: #1e293b; margin: 0 0 8px;">Marketing Investment &amp; Attribution Summary</h4>
      ${buildHtmlTable(['Financial Metric', 'Reported Amount', 'Basis & Verification'], rows)}
    </div>
  `
}

function formatMarketingCell(label: string, value: unknown): string {
  if (['amount', 'revenue', 'monthlyCost', 'annualRevenue'].includes(label)) {
    const amount = Number(value)
    if (String(value ?? '').trim() && Number.isFinite(amount)) return formatCurrency(amount)
  }
  return String(value ?? '')
}

function formatCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`
}

function marketingEvidenceTitle(source: string): string {
  const labels: Record<string, string> = {
    'DataForSEO Google Maps local results': 'Nearby businesses in local search',
    'Google PageSpeed Insights': 'Website speed and quality',
    'Chrome UX Report (CrUX)': 'Real visitor website experience',
    'Google organic search visibility': 'Website visibility in Google search',
  }
  return labels[source] ?? source
}

function advisorFriendlyText(value: string): string {
  return value
    .replace(/Chrome UX Report\s*\(CrUX\)|\bCrUX\b/gi, 'real visitor website data')
    .replace(/Google PageSpeed Insights/gi, 'website speed test')
    .replace(/Google Places API/gi, 'Google Business Profile records')
    .replace(/DataForSEO/gi, 'local search results')
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
