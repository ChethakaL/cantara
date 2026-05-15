import { TeaserInputData } from './types'
import { CANTARA_COVER_BRAND_CSS, buildCantaraCoverBrandHtml } from '@/lib/report-export/cantara-cover-branding'

function escapeHtml(str: any): string {
  if (typeof str !== 'string') return String(str ?? '')
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/** Under section 02 headline: one line → paragraph; multiple lines → bullet list. */
function section02LeadHtml(text: string): string {
  const raw = String(text ?? '').trim()
  if (!raw) return ''
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length <= 1) {
    return `<p class="section02-lead">${escapeHtml(lines[0] ?? raw)}</p>`
  }
  return `<ul class="section02-lead-bullets">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`
}

/** Renders textarea content as a bullet list (one non-empty line = one bullet). */
function multilineToBulletList(text: string): string {
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (!lines.length) {
    return '<p class="overview-empty" style="font-size:12px;color:#94a3b8;margin:0;">&mdash;</p>'
  }
  return `<ul class="overview-bullets">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`
}

export function generateTeaserHtml(data: TeaserInputData): string {
  const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(data.businessDisplayName)} — Investment Teaser</title>
<style>
  @page { size: A4; margin: 0; }
  @media print {
    .no-print { display: none !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page-break { page-break-before: always; }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 0; }

  /* Cover */
  .cover { background: linear-gradient(135deg, #21263C 0%, #161a2e 100%); color: white; padding: 80px 60px 60px; text-align: center; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; }
  ${CANTARA_COVER_BRAND_CSS}
  .cover .deal-ref { font-size: 11px; letter-spacing: 2px; color: #94a3b8; margin: 8px 0 20px; font-weight: 600; }
  .cover h1 { font-size: 42px; font-weight: 800; letter-spacing: -1px; margin-bottom: 8px; }
  .cover .subtitle { font-size: 20px; color: #94a3b8; margin-bottom: 8px; }
  .cover .region { font-size: 14px; color: #64748b; }
  .cover .divider { width: 60px; height: 3px; background: #CAA15F; margin: 40px auto; border-radius: 2px; }
  .cover .confidential { font-size: 10px; text-transform: uppercase; letter-spacing: 3px; color: #475569; margin-top: 40px; }

  /* Section styling */
  .section { padding: 48px 60px; }
  .section-header { font-size: 10px; text-transform: uppercase; letter-spacing: 4px; color: #f59e0b; font-weight: 700; margin-bottom: 8px; }
  .section-number { font-size: 10px; color: #94a3b8; margin-bottom: 4px; }
  .section h2 { font-size: 28px; font-weight: 700; color: #1e293b; margin-bottom: 24px; }
  .section p { font-size: 14px; color: #475569; margin-bottom: 16px; line-height: 1.7; }

  /* Snapshot grid */
  .snapshot-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #e2e8f0; border-radius: 12px; overflow: hidden; margin: 24px 0; }
  .snapshot-cell { background: white; padding: 20px 24px; }
  .snapshot-cell .label { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #f59e0b; font-weight: 700; margin-bottom: 6px; }
  .snapshot-cell .value { font-size: 16px; font-weight: 700; color: #1e293b; }
  .snapshot-cell .detail { font-size: 11px; color: #94a3b8; margin-top: 4px; }

  /* Overview cards */
  .overview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; }
  .overview-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; }
  .overview-card h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #1e293b; font-weight: 700; margin-bottom: 10px; }
  .overview-card p { font-size: 12px; color: #64748b; margin: 0; line-height: 1.6; }
  .overview-card ul.overview-bullets { margin: 0; padding-left: 18px; }
  .overview-card ul.overview-bullets li { font-size: 12px; color: #64748b; margin-bottom: 6px; line-height: 1.55; }
  .overview-card ul.overview-bullets li:last-child { margin-bottom: 0; }
  .section02-lead { font-size: 14px; color: #475569; margin: 0 0 24px; line-height: 1.7; max-width: 720px; }
  .section02-lead-bullets { margin: 0 0 24px; padding-left: 20px; max-width: 720px; }
  .section02-lead-bullets li { font-size: 14px; color: #475569; margin-bottom: 8px; line-height: 1.6; }
  .section02-lead-bullets li:last-child { margin-bottom: 0; }

  /* Financial table */
  .fin-table { width: 100%; border-collapse: collapse; margin: 24px 0; }
  .fin-table th { text-align: left; padding: 12px 16px; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #94a3b8; font-weight: 700; border-bottom: 2px solid #e2e8f0; }
  .fin-table td { padding: 14px 16px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
  .fin-table td:first-child { font-weight: 600; color: #1e293b; }
  .fin-table td:nth-child(2) { color: #64748b; }
  .fin-table td:nth-child(3) { color: #64748b; font-size: 12px; }
  .fin-table td:last-child { font-weight: 700; color: #1e293b; text-align: right; }

  /* KPI strip */
  .kpi-strip { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1px; background: #1a2332; border-radius: 12px; overflow: hidden; margin: 32px 0; }
  .kpi-cell { background: #1e293b; padding: 24px; text-align: center; color: white; }
  .kpi-cell .kpi-value { font-size: 28px; font-weight: 800; color: #f59e0b; }
  .kpi-cell .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #94a3b8; margin-top: 6px; }

  /* Investment highlights */
  .highlights { margin: 24px 0; }
  .highlights-section-label { font-size: 10px; text-transform: uppercase; letter-spacing: 3px; color: #f59e0b; font-weight: 700; padding: 16px 0 8px; border-top: 2px solid #e2e8f0; margin-top: 8px; }
  .highlights-section-label:first-child { border-top: none; margin-top: 0; }
  .highlight-item { display: flex; gap: 20px; padding: 20px 0; border-bottom: 1px solid #f1f5f9; }
  .highlight-item:last-child { border-bottom: none; }
  .highlight-num { width: 36px; height: 36px; background: #1a2332; color: #f59e0b; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; flex-shrink: 0; }
  .highlight-content h4 { font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 6px; }
  .highlight-content p { font-size: 13px; color: #64748b; margin: 0; line-height: 1.6; }

  /* Next steps */
  .next-steps { background: #f8fafc; border-radius: 12px; padding: 32px; margin: 24px 0; text-align: center; }
  .next-steps h3 { font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 12px; }
  .next-steps p { font-size: 13px; color: #64748b; margin-bottom: 16px; }
  .next-steps .nda-link { display: inline-block; background: #1a2332; color: #f59e0b; padding: 12px 28px; border-radius: 8px; font-size: 13px; font-weight: 700; text-decoration: none; letter-spacing: 1px; }
  .contact-info { margin-top: 20px; }
  .contact-info .name { font-weight: 700; color: #1e293b; }
  .contact-info .title { color: #64748b; font-size: 12px; }
  .contact-info .email { color: #f59e0b; font-size: 12px; }

  /* Disclaimer */
  .disclaimer { padding: 32px 60px; border-top: 1px solid #e2e8f0; }
  .disclaimer p { font-size: 9px; color: #94a3b8; line-height: 1.6; }

  .footnote { font-size: 11px; color: #94a3b8; font-style: italic; }
</style>
</head>
<body>

<div class="no-print" style="position:fixed;top:20px;right:20px;z-index:100;">
  <button onclick="window.print()" style="display:inline-flex;align-items:center;gap:8px;padding:10px 24px;background:#1a2332;color:#f59e0b;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;letter-spacing:1px;">PRINT / SAVE AS PDF</button>
</div>

<!-- COVER PAGE -->
<div class="cover">
  ${buildCantaraCoverBrandHtml()}
  ${data.dealReference?.trim() ? `<div class="deal-ref">Cantara Deal Reference # ${escapeHtml(data.dealReference.trim())}</div>` : ''}
  <div class="divider"></div>
  <h1>${escapeHtml(data.businessDisplayName)}</h1>
  <div class="subtitle">${escapeHtml(data.teaserSubtitle)}</div>
  <div class="region">${escapeHtml(data.regionLabel)}</div>
  <div class="confidential" style="margin-top: 60px;">Confidential Investment Teaser</div>
  <div style="font-size: 11px; color: #475569; margin-top: 8px;">${currentDate}</div>
</div>

<div class="page-break"></div>

<!-- 01 — TRANSACTION SNAPSHOT -->
<div class="section">
  <div class="section-number">01</div>
  <div class="section-header">Transaction Snapshot</div>
  <h2>Deal at a Glance</h2>
  <p>${escapeHtml(data.businessOverview)}</p>

  <div class="snapshot-grid">
    <div class="snapshot-cell">
      <div class="label">Deal Type</div>
      <div class="value">${escapeHtml(data.dealType)}</div>
      <div class="detail">Structure negotiable with qualified buyers</div>
    </div>
    <div class="snapshot-cell">
      <div class="label">Location</div>
      <div class="value">${escapeHtml(data.location)}</div>
      <div class="detail">Specific market disclosed post-LOI</div>
    </div>
    <div class="snapshot-cell">
      <div class="label">Revenue (TTM)</div>
      <div class="value">${escapeHtml(data.revenueRange)}</div>
      <div class="detail">Management accounts - All service lines</div>
    </div>
    <div class="snapshot-cell">
      <div class="label">Service Model</div>
      <div class="value">${escapeHtml(data.serviceModel)}</div>
    </div>
    <div class="snapshot-cell">
      <div class="label">Total Capacity</div>
      <div class="value">${escapeHtml(data.facilityCapacity)}</div>
      <div class="detail">Variety of enclosure sizes &middot; Multiple service zones</div>
    </div>
    <div class="snapshot-cell">
      <div class="label">Process Stage</div>
      <div class="value">${escapeHtml(data.processStage)}</div>
      <div class="detail">Data room access granted post-NDA execution</div>
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- 02 — BUSINESS OVERVIEW -->
<div class="section">
  <div class="section-number">02</div>
  <div class="section-header">Business Overview</div>
  <h2>${escapeHtml(data.overviewHeadline || 'A Purpose-Built Premium Pet Resort')}</h2>
  ${data.section02LeadSummary?.trim() ? section02LeadHtml(data.section02LeadSummary) : ''}

  <div class="overview-grid">
    <div class="overview-card">
      <h4>Facility Profile</h4>
      ${multilineToBulletList(data.facilityProfile)}
    </div>
    <div class="overview-card">
      <h4>Ownership & Management</h4>
      ${multilineToBulletList(data.ownershipManagement)}
    </div>
    <div class="overview-card">
      <h4>Client Profile</h4>
      ${multilineToBulletList(data.clientProfile)}
    </div>
    <div class="overview-card">
      <h4>Staff & Operations</h4>
      ${multilineToBulletList(data.staffOperations)}
    </div>
    <div class="overview-card">
      <h4>Real Estate</h4>
      ${multilineToBulletList(data.realEstate)}
    </div>
    <div class="overview-card">
      <h4>Technology</h4>
      ${multilineToBulletList(data.technology)}
    </div>
    <div class="overview-card">
      <h4>Permits & Zoning</h4>
      ${multilineToBulletList(data.permitsZoning)}
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- 03 — FINANCIAL HIGHLIGHTS -->
<div class="section">
  <div class="section-number">03</div>
  <div class="section-header">Financial Highlights</div>
  <h2>Indicative Financial Performance</h2>
  <p>The business generates consistent, recurring revenue across multiple service lines with healthy normalized EBITDA margins. Full financials, including a detailed EBITDA normalization schedule, are available to qualified buyers in the data room following NDA execution.</p>

  <table class="fin-table">
    <thead>
      <tr>
        <th>Metric</th>
        <th>Period</th>
        <th>Commentary</th>
        <th>Indicative Range</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Annual Revenue</td>
        <td>TTM</td>
        <td>Management accounts - All service lines combined</td>
        <td>${escapeHtml(data.annualRevenue)}</td>
      </tr>
      <tr>
        <td>Revenue Growth</td>
        <td>2-Year Trend</td>
        <td>Positive year-over-year trajectory across all service lines</td>
        <td>${escapeHtml(data.revenueGrowth || 'Disclosed post-NDA')}</td>
      </tr>
      <tr>
        <td>Normalized EBITDA</td>
        <td>TTM</td>
        <td>Owner add-backs applied &middot; Normalization schedule provided in CIM</td>
        <td>${escapeHtml(data.normalizedEbitda)}</td>
      </tr>
      <tr>
        <td>EBITDA Margin</td>
        <td>TTM</td>
        <td>Normalized - Benchmarks favorably vs. sector peers</td>
        <td>${escapeHtml(data.ebitdaMargin)}</td>
      </tr>
      <tr>
        <td>Revenue Mix</td>
        <td>TTM</td>
        <td>Boarding & daycare dominant - Grooming & training growing</td>
        <td>${escapeHtml(data.revenueMix)}</td>
      </tr>
      <tr>
        <td>Buyer Capex Requirement</td>
        <td>Forward</td>
        <td>Light ongoing maintenance capex</td>
        <td>${escapeHtml(data.buyerCapex)}</td>
      </tr>
    </tbody>
  </table>

  <p class="footnote">* All figures based on management accounts. EBITDA presented on a normalized basis inclusive of owner add-backs. Independent verification available during diligence.</p>

</div>

<div class="page-break"></div>

<!-- 04 — INVESTMENT HIGHLIGHTS -->
<div class="section">
  <div class="section-number">04</div>
  <div class="section-header">Investment Highlights</div>
  <h2>Why This Opportunity</h2>

  <div class="highlights">
    <div class="highlights-section-label">Business Strengths</div>
    ${data.investmentHighlights.slice(0, 2).filter(h => h.title).map((h, i) => `
    <div class="highlight-item">
      <div class="highlight-num">0${i + 1}</div>
      <div class="highlight-content">
        <h4>${escapeHtml(h.title)}</h4>
        <p>${escapeHtml(h.description)}</p>
      </div>
    </div>`).join('')}

    <div class="highlights-section-label">Growth Opportunities</div>
    ${data.investmentHighlights.slice(2).filter(h => h.title).map((h, i) => `
    <div class="highlight-item">
      <div class="highlight-num">0${i + 3}</div>
      <div class="highlight-content">
        <h4>${escapeHtml(h.title)}</h4>
        <p>${escapeHtml(h.description)}</p>
      </div>
    </div>`).join('')}
  </div>
</div>

<div class="page-break"></div>

<!-- 05 — NEXT STEPS -->
<div class="section">
  <div class="section-number">05</div>
  <div class="section-header">Next Steps</div>

  <div class="next-steps">
    <h3>Interested?</h3>
    <p>Execute an NDA to receive the CIM & access to the data room</p>
    <a href="#" class="nda-link">Click here to access and complete the NDA</a>
    <div class="contact-info" style="margin-top: 24px;">
      <div class="name">${escapeHtml(data.contactName)}</div>
      <div class="title">${escapeHtml(data.contactTitle)}</div>
      <div class="email">${escapeHtml(data.contactEmail)}</div>
    </div>
  </div>
</div>

<!-- DISCLAIMER -->
<div class="disclaimer">
  <p>DISCLAIMER: This document has been prepared by Cantara Pet Advisors solely for informational purposes and is intended exclusively for the named recipient. It may not be reproduced, distributed, or disclosed to any third party without prior written consent. Information has been obtained from sources believed to be reliable, including management accounts provided by the seller, but has not been independently verified. No representation or warranty is made as to accuracy or completeness. This document does not constitute an offer to sell or solicitation to buy any securities or assets. Cantara is acting as exclusive sell-side advisor and owes no duty to any prospective buyer. All financial figures are indicative and subject to verification during due diligence. &copy; ${new Date().getFullYear()} Cantara Pet Advisors. All rights reserved.</p>
</div>

</body>
</html>`
}
