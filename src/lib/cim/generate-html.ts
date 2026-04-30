import { CimInputData } from './types'

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function generateCimHtml(data: CimInputData): string {
  const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const thesisBullets = (data.investmentThesis || []).filter(Boolean).map(b => `<li>${escapeHtml(b)}</li>`).join('')
  const financialBullets = (data.financialHighlights || []).filter(Boolean).map(b => `<li>${escapeHtml(b)}</li>`).join('')

  // Income statement table rows
  const incomeRows = (data.incomeStatement || []).map(row => `
    <tr${row.label === 'Revenue' || row.label.includes('EBITDA') ? ' class="bold-row"' : ''}>
      <td>${escapeHtml(row.label)}</td>
      <td>${escapeHtml(row.fy1)}</td><td class="pct">${escapeHtml(row.fy1Pct)}</td>
      <td>${escapeHtml(row.fy2)}</td><td class="pct">${escapeHtml(row.fy2Pct)}</td>
      <td>${escapeHtml(row.fy3)}</td><td class="pct">${escapeHtml(row.fy3Pct)}</td>
      <td>${escapeHtml(row.ttm)}</td><td class="pct">${escapeHtml(row.ttmPct)}</td>
      <td>${escapeHtml(row.proj1)}</td><td class="pct">${escapeHtml(row.proj1Pct)}</td>
      <td>${escapeHtml(row.proj2)}</td><td class="pct">${escapeHtml(row.proj2Pct)}</td>
    </tr>`).join('')

  // Service line rows
  const serviceRows = (data.serviceLineBreakdown || []).map(sl => `
    <tr><td>${escapeHtml(sl.name)}</td><td>${escapeHtml(sl.ttmRevenue)}</td><td>${escapeHtml(sl.pctOfTotal)}</td></tr>`).join('')

  // Normalization rows
  const normRows = (data.normalizationItems || []).map(ni => `
    <tr><td>${escapeHtml(ni.item)}</td><td>${escapeHtml(ni.ttmAmount)}</td><td>${escapeHtml(ni.commentary)}</td></tr>`).join('')

  // Value creation rows
  const valueRows = (data.valueCreationItems || []).map(vc => `
    <tr><td>${escapeHtml(vc.initiative)}</td><td>${escapeHtml(vc.description)}</td><td>${escapeHtml(vc.timing)}</td><td>${escapeHtml(vc.revenueImpact)}</td><td>${escapeHtml(vc.dependencies)}</td></tr>`).join('')

  // Staffing bullets
  const staffBullets = (data.staffingOverview || []).filter(Boolean).map(b => `<li>${escapeHtml(b)}</li>`).join('')
  const techBullets = (data.technologyStack || []).filter(Boolean).map(b => `<li>${escapeHtml(b)}</li>`).join('')
  const mktgBullets = (data.marketingOverview || []).filter(Boolean).map(b => `<li>${escapeHtml(b)}</li>`).join('')
  const mktgOppBullets = (data.marketingOpportunities || []).filter(Boolean).map(b => `<li>${escapeHtml(b)}</li>`).join('')

  // Facility details
  const facilityRows = (data.facilityDetails || []).map(f => `<tr><td class="label-col">${escapeHtml(f.label)}</td><td>${escapeHtml(f.value)}</td></tr>`).join('')
  // Lease details
  const leaseRows = (data.leaseDetails || []).map(l => `<tr><td class="label-col">${escapeHtml(l.label)}</td><td>${escapeHtml(l.value)}</td></tr>`).join('')

  // Competitors
  const competitorRows = (data.competitors || []).map(c => `
    <tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.distance)}</td><td>${escapeHtml(c.services)}</td><td>${escapeHtml(c.capacity)}</td><td>${escapeHtml(c.rating)}</td><td>${escapeHtml(c.commentary)}</td></tr>`).join('')

  // Transaction terms
  const termRows = (data.transactionTerms || []).map(t => `<tr><td class="label-col">${escapeHtml(t.label)}</td><td>${escapeHtml(t.value)}</td></tr>`).join('')

  // Data room
  const dataRoomRows = (data.dataRoomContents || []).map(d => `<tr><td class="label-col">${escapeHtml(d.category)}</td><td>${escapeHtml(d.items)}</td></tr>`).join('')

  // Process steps
  const processStepHtml = (data.processSteps || []).map(s => `
    <div class="process-step">
      <div class="step-number">${escapeHtml(s.step)}</div>
      <div class="step-title">${escapeHtml(s.title)}</div>
      <div class="step-desc">${escapeHtml(s.description)}</div>
    </div>`).join('')

  // Overview cards
  const overviewSections = [
    { title: 'Facility Profile', content: data.facilityProfile },
    { title: 'Ownership & Management', content: data.ownershipManagement },
    { title: 'Client Profile', content: data.clientProfile },
    { title: 'Staff & Operations', content: data.staffOperations },
    { title: 'Real Estate', content: data.realEstate },
    { title: 'Technology', content: data.technology },
    { title: 'Permits & Zoning', content: data.permitsZoning },
  ].filter(s => s.content)

  const overviewCards = overviewSections.map(s => `
    <div class="overview-card">
      <h4>${escapeHtml(s.title)}</h4>
      <p>${escapeHtml(s.content!)}</p>
    </div>`).join('')

  // Competitive intro bullets
  const compIntroBullets = (data.competitiveIntro || []).filter(Boolean).map(b => `<li>${escapeHtml(b)}</li>`).join('')

  // Normalization notes
  const normNotes = (data.normalizationNotes || []).filter(Boolean).map(b => `<li>${escapeHtml(b)}</li>`).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(data.businessName)} \u2014 Confidential Information Memorandum</title>
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
  .cover { background: linear-gradient(135deg, #1a2332 0%, #0f172a 100%); color: white; padding: 80px 60px 60px; text-align: center; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; }
  .cover .brand { font-size: 11px; text-transform: uppercase; letter-spacing: 5px; color: #f59e0b; font-weight: 700; margin-bottom: 24px; }
  .cover h1 { font-size: 42px; font-weight: 800; letter-spacing: -1px; margin-bottom: 8px; }
  .cover .subtitle { font-size: 20px; color: #94a3b8; margin-bottom: 8px; }
  .cover .region { font-size: 14px; color: #64748b; }
  .cover .service-lines { font-size: 12px; color: #64748b; margin-top: 12px; letter-spacing: 1px; }
  .cover .divider { width: 60px; height: 3px; background: #f59e0b; margin: 40px auto; border-radius: 2px; }
  .cover .confidential { font-size: 10px; text-transform: uppercase; letter-spacing: 3px; color: #475569; margin-top: 40px; }
  .cover .date { font-size: 11px; color: #475569; margin-top: 8px; }

  /* Section styling */
  .section { padding: 48px 60px; }
  .section-header { font-size: 10px; text-transform: uppercase; letter-spacing: 4px; color: #f59e0b; font-weight: 700; margin-bottom: 8px; }
  .section-number { font-size: 10px; color: #94a3b8; margin-bottom: 4px; }
  .section h2 { font-size: 28px; font-weight: 700; color: #1e293b; margin-bottom: 24px; }
  .section h3 { font-size: 18px; font-weight: 700; color: #1e293b; margin-bottom: 16px; margin-top: 32px; }
  .section p { font-size: 14px; color: #475569; margin-bottom: 16px; line-height: 1.7; }
  .section ul { margin: 12px 0 16px 24px; }
  .section li { font-size: 13px; color: #475569; margin-bottom: 6px; line-height: 1.5; }

  /* Overview cards */
  .overview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; }
  .overview-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; }
  .overview-card h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #1e293b; font-weight: 700; margin-bottom: 10px; }
  .overview-card p { font-size: 12px; color: #64748b; margin: 0; line-height: 1.6; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
  th { background: #f8fafc; color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; padding: 10px 12px; text-align: left; border-bottom: 2px solid #e2e8f0; }
  td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; }
  td.pct { color: #94a3b8; font-size: 11px; }
  td.label-col { font-weight: 600; color: #1e293b; white-space: nowrap; width: 200px; }
  tr.bold-row td { font-weight: 700; color: #1e293b; }
  .income-table { overflow-x: auto; }
  .income-table table { min-width: 800px; }

  /* Footnotes */
  .footnote { font-size: 11px; color: #94a3b8; font-style: italic; margin-top: 12px; }

  /* Competitor table */
  .comp-table td:first-child { font-weight: 600; }

  /* Process steps */
  .process-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 24px 0; }
  .process-step { border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; text-align: center; }
  .step-number { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #f59e0b; font-weight: 700; margin-bottom: 8px; }
  .step-title { font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 6px; }
  .step-desc { font-size: 12px; color: #64748b; }

  /* Contact */
  .contact-box { background: linear-gradient(135deg, #1a2332 0%, #0f172a 100%); color: white; border-radius: 16px; padding: 40px; text-align: center; margin-top: 40px; }
  .contact-box .name { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
  .contact-box .title { font-size: 13px; color: #94a3b8; margin-bottom: 12px; }
  .contact-box .email { font-size: 14px; color: #f59e0b; text-decoration: none; }

  /* Gold line */
  .gold-rule { width: 100%; height: 2px; background: linear-gradient(90deg, transparent, #f59e0b, transparent); margin: 0; border: none; }
</style>
</head>
<body>

<!-- Cover -->
<div class="cover">
  <div class="brand">Cantara Pet Advisors</div>
  <h1>${escapeHtml(data.businessName)}</h1>
  <div class="subtitle">${escapeHtml(data.subtitle)}</div>
  <div class="region">${escapeHtml(data.region)}</div>
  ${data.serviceLines ? `<div class="service-lines">${escapeHtml(data.serviceLines)}</div>` : ''}
  <div class="divider"></div>
  <div class="confidential">Confidential Information Memorandum</div>
  <div class="date">${currentDate}</div>
</div>

<!-- 01 Executive Summary -->
<hr class="gold-rule">
<div class="section page-break">
  <div class="section-number">01</div>
  <div class="section-header">Executive Summary</div>
  <h2>Investment Overview</h2>
  <p>${escapeHtml(data.investmentOverview)}</p>

  ${thesisBullets ? `<h3>Investment Thesis</h3><ul>${thesisBullets}</ul>` : ''}

  ${data.sellerOverview ? `<h3>Seller Overview</h3><p>${escapeHtml(data.sellerOverview)}</p>` : ''}
  ${data.transactionOverview ? `<h3>Transaction Overview</h3><p>${escapeHtml(data.transactionOverview)}</p>` : ''}
</div>

<!-- 02 Business Overview -->
<hr class="gold-rule">
<div class="section page-break">
  <div class="section-number">02</div>
  <div class="section-header">Business Overview</div>
  <h2>Company Profile</h2>
  <p>${escapeHtml(data.businessDescription)}</p>

  ${overviewCards ? `<div class="overview-grid">${overviewCards}</div>` : ''}
</div>

<!-- 03 Financial Performance -->
<hr class="gold-rule">
<div class="section page-break">
  <div class="section-number">03</div>
  <div class="section-header">Financial Performance</div>
  <h2>Historical & Projected Performance</h2>

  ${financialBullets ? `<ul>${financialBullets}</ul>` : ''}

  ${incomeRows ? `
  <h3>Income Statement Summary</h3>
  <div class="income-table">
    <table>
      <thead>
        <tr><th>Line Item</th><th>FY1</th><th>%</th><th>FY2</th><th>%</th><th>FY3</th><th>%</th><th>TTM</th><th>%</th><th>Proj 1</th><th>%</th><th>Proj 2</th><th>%</th></tr>
      </thead>
      <tbody>${incomeRows}</tbody>
    </table>
  </div>
  <p class="footnote">${escapeHtml(data.incomeFootnote)}</p>` : ''}

  ${serviceRows ? `
  <h3>Service Line Breakdown</h3>
  <table>
    <thead><tr><th>Service Line</th><th>TTM Revenue</th><th>% of Total</th></tr></thead>
    <tbody>${serviceRows}</tbody>
  </table>` : ''}

  ${data.monthlyTrending ? `<h3>Monthly Trending</h3>${data.monthlyTrending}` : ''}
</div>

<!-- 04 EBITDA Normalization -->
${normRows ? `
<hr class="gold-rule">
<div class="section page-break">
  <div class="section-number">04</div>
  <div class="section-header">EBITDA Normalization</div>
  <h2>Normalization Schedule</h2>
  ${normNotes ? `<ul>${normNotes}</ul>` : ''}
  <table>
    <thead><tr><th>Add-Back Item</th><th>TTM Amount</th><th>Commentary</th></tr></thead>
    <tbody>${normRows}</tbody>
  </table>
  <p class="footnote">${escapeHtml(data.normalizationFootnote)}</p>
</div>` : ''}

<!-- 05 Value Creation -->
${valueRows ? `
<hr class="gold-rule">
<div class="section page-break">
  <div class="section-number">05</div>
  <div class="section-header">Value Creation</div>
  <h2>Growth & Optimization Roadmap</h2>
  <p>${escapeHtml(data.valueCreationIntro)}</p>
  <table>
    <thead><tr><th>Initiative</th><th>Description</th><th>Timing</th><th>Revenue Impact</th><th>Dependencies</th></tr></thead>
    <tbody>${valueRows}</tbody>
  </table>
</div>` : `
<hr class="gold-rule">
<div class="section page-break">
  <div class="section-number">05</div>
  <div class="section-header">Value Creation</div>
  <h2>Growth & Optimization Roadmap</h2>
  <p>${escapeHtml(data.valueCreationIntro)}</p>
</div>`}

<!-- 06 Operations & Management -->
<hr class="gold-rule">
<div class="section page-break">
  <div class="section-number">06</div>
  <div class="section-header">Operations & Management</div>
  <h2>Team & Infrastructure</h2>

  ${data.orgChartHtml ? `<h3>Organization Chart</h3>${data.orgChartHtml}` : ''}

  ${data.gmProfile.name ? `
  <h3>General Manager</h3>
  <table>
    <tbody>
      <tr><td class="label-col">Name</td><td>${escapeHtml(data.gmProfile.name)}</td></tr>
      <tr><td class="label-col">Tenure</td><td>${escapeHtml(data.gmProfile.tenure)}</td></tr>
      <tr><td class="label-col">Certifications</td><td>${escapeHtml(data.gmProfile.certifications)}</td></tr>
      <tr><td class="label-col">Transition Plan</td><td>${escapeHtml(data.gmProfile.transition)}</td></tr>
      <tr><td class="label-col">Responsibilities</td><td>${escapeHtml(data.gmProfile.responsibilities)}</td></tr>
    </tbody>
  </table>` : ''}

  ${staffBullets ? `<h3>Staffing Overview</h3><ul>${staffBullets}</ul>` : ''}
  ${techBullets ? `<h3>Technology Stack</h3><ul>${techBullets}</ul>` : ''}
  ${mktgBullets ? `<h3>Marketing Overview</h3><ul>${mktgBullets}</ul>` : ''}
  ${mktgOppBullets ? `<h3>Marketing Opportunities</h3><ul>${mktgOppBullets}</ul>` : ''}
</div>

<!-- 07 Real Estate -->
${facilityRows || leaseRows ? `
<hr class="gold-rule">
<div class="section page-break">
  <div class="section-number">07</div>
  <div class="section-header">Real Estate</div>
  <h2>Facility & Lease Details</h2>

  ${facilityRows ? `
  <h3>Facility Details</h3>
  <table><tbody>${facilityRows}</tbody></table>` : ''}

  ${leaseRows ? `
  <h3>Lease Summary</h3>
  <table><tbody>${leaseRows}</tbody></table>` : ''}
</div>` : ''}

<!-- 08 Competitive Landscape -->
${competitorRows ? `
<hr class="gold-rule">
<div class="section page-break">
  <div class="section-number">08</div>
  <div class="section-header">Competitive Landscape</div>
  <h2>Market Position</h2>
  ${compIntroBullets ? `<ul>${compIntroBullets}</ul>` : ''}
  <div class="comp-table">
    <table>
      <thead><tr><th>Competitor</th><th>Distance</th><th>Services</th><th>Capacity</th><th>Rating</th><th>Commentary</th></tr></thead>
      <tbody>${competitorRows}</tbody>
    </table>
  </div>
  ${data.pricingComparison ? `<h3>Pricing Comparison</h3>${data.pricingComparison}` : ''}
</div>` : ''}

<!-- 09 Transaction Details -->
<hr class="gold-rule">
<div class="section page-break">
  <div class="section-number">09</div>
  <div class="section-header">Transaction Details</div>
  <h2>Process & Next Steps</h2>

  ${termRows ? `
  <h3>Transaction Terms</h3>
  <table><tbody>${termRows}</tbody></table>` : ''}

  ${dataRoomRows ? `
  <h3>Data Room Contents</h3>
  <table>
    <thead><tr><th>Category</th><th>Documents</th></tr></thead>
    <tbody>${dataRoomRows}</tbody>
  </table>` : ''}

  ${processStepHtml ? `
  <h3>Process</h3>
  <div class="process-grid">${processStepHtml}</div>` : ''}
</div>

<!-- Contact -->
<div class="contact-box">
  <div class="name">${escapeHtml(data.contactName)}</div>
  <div class="title">${escapeHtml(data.contactTitle)}</div>
  <a class="email" href="mailto:${escapeHtml(data.contactEmail)}">${escapeHtml(data.contactEmail)}</a>
</div>

</body>
</html>`
}
