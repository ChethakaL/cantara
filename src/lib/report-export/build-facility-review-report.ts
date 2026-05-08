import type { FacilityReviewReport } from '@/lib/facility-review/types'

function esc(value: string | number): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function rows(cells: string[]): string {
  return `<tr>${cells.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`
}

function bullets(items: string[]): string {
  return `<ul>${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`
}

function ratingClass(rating: string): string {
  if (rating === 'Excellent') return 'excellent'
  if (rating === 'Good') return 'good'
  if (rating === 'Critical') return 'critical'
  return 'attention'
}

function defaultMethodology(report: FacilityReviewReport): string {
  return report.methodologyDisclosure || 'This report is based on supporting photo documentation submitted to Cantara Pet Business Advisors and information provided by the seller or advisory team. Scores and findings reflect information as provided and have not been independently verified by Cantara or any third party. Items rated Critical or Needs Attention are recommended for independent third-party verification prior to going to market. This report is a strategic advisory tool and does not constitute a property inspection, engineering report, or legal compliance certification. This report is prepared exclusively for the seller and Cantara advisory team and is confidential.'
}

export function buildFacilityReviewReportHtml(report: FacilityReviewReport): string {
  const sortedZones = report.zones.slice().sort((a, b) => a.score - b.score)
  const overallRows = [
    ...report.zones.map(zone => `<tr><td>${esc(zone.zone)}</td><td>${zone.weight}%</td><td><strong>${zone.score} / 100</strong></td><td class="rating-cell ${ratingClass(zone.rating)}">${esc(zone.rating)}</td></tr>`),
    `<tr class="total-row"><td>Overall Facility Score<br><span>(weighted)</span></td><td>100%</td><td>${report.overallScore} / 100</td><td class="rating-cell ${ratingClass(report.overallRating)}">${esc(report.overallRating)}</td></tr>`,
  ].join('')

  const commentary = sortedZones.map(zone => `
    <section class="zone-block">
      <h2>${esc(zone.zone)} &mdash; ${zone.score}/100 &mdash; ${esc(zone.rating)}</h2>
      <p>${esc(zone.commentary)}</p>
      <p class="key-label">Key findings:</p>
      ${bullets(zone.keyFindings)}
    </section>
  `).join('')

  const improvementRows = report.prioritizedImprovements.map(item => rows([
    item.improvement,
    item.zone,
    item.valueImpact,
    item.effort,
    item.timing,
  ])).join('')

  const capexRows = (report.capitalExpenditureOutlook?.length ? report.capitalExpenditureOutlook : [
    { item: 'Additional facility documentation and photo coverage', estimatedCostRange: 'Not estimated from images', timing: 'Before marketing' },
  ]).map(item => rows([item.item, item.estimatedCostRange, item.timing])).join('')

  const maintenance = report.maintenanceHistorySummary || 'Maintenance records were not provided with the image set. Recommend seller compile service invoices, warranties, HVAC records, equipment maintenance logs, and recent capital expenditure documentation for the data room prior to going to market.'
  const compliance = report.complianceLicensingSnapshot || 'Compliance and licensing status cannot be verified from facility images alone. Business license status, animal care permits, inspection history, and any outstanding regulatory items should be independently confirmed as part of buyer due diligence.'
  const brand = report.brandCurbAppealAssessment || 'Client-facing imagery suggests a polished public presentation, but the facility photo set should be expanded before marketing. Updated professional photography across Google, Yelp, the business website, and sale materials will improve buyer confidence and help support premium positioning.'
  const advisory = report.cantaraAdvisoryCommentary || report.buyerRiskSummary

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(report.businessName)} - Facility Assessment Report</title>
<style>
  @page { size: letter; margin: 0.58in 0.68in 0.62in; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
    .cover { page-break-after: always; }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: #21263C;
    background: #fff;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 13px;
    line-height: 1.38;
  }
  .print-bar {
    position: fixed;
    top: 18px;
    right: 18px;
    z-index: 50;
  }
  .print-bar button {
    border: 0;
    background: #21263C;
    color: #CAA15F;
    border-radius: 8px;
    padding: 10px 18px;
    font-weight: 700;
    cursor: pointer;
  }
  .cover {
    height: 9.62in;
    margin: 0 auto;
    width: 7.28in;
    background: linear-gradient(135deg, #21263C 0%, #151a2e 100%);
    color: white;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 0.75in;
  }
  .cover img { width: 132px; margin-bottom: 38px; }
  .cover .eyebrow { color: #CAA15F; font-size: 14px; font-weight: 700; letter-spacing: 9px; text-transform: uppercase; margin-top: 28px; }
  .cover .subbrand { color: #7e8aa0; font-size: 13px; font-weight: 700; letter-spacing: 8px; text-transform: uppercase; margin-top: 18px; }
  .cover .rule { width: 72px; height: 4px; background: #CAA15F; border-radius: 2px; margin: 42px 0; }
  .cover h1 { margin: 0; font-size: 35px; line-height: 1.1; font-weight: 800; color: #ffffff !important; }
  .cover .title { color: #CAA15F; font-size: 21px; font-weight: 700; margin-top: 26px; }
  .cover .subtitle { color: #98a2b3; font-size: 16px; margin-top: 13px; }
  .cover .date { color: #536075; font-size: 12px; margin-top: 48px; }
  .cover .conf { color: #536075; font-size: 11px; letter-spacing: 5px; text-transform: uppercase; margin-top: 26px; }
  .page { min-height: 9.8in; position: relative; padding: 0.03in 0 0.38in; }
  .header {
    color: #21263C;
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 34px;
    padding-bottom: 7px;
    border-bottom: 1.5px solid #D37141;
    white-space: nowrap;
  }
  .header span { color: #777; font-style: italic; font-weight: 600; }
  .footer {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    color: #777;
    font-size: 11px;
    padding-top: 10px;
    border-top: 1px solid #d8d8d8;
  }
  h1 {
    font-size: 26px;
    line-height: 1.2;
    font-weight: 700;
    margin: 0 0 28px;
    color: #21263C;
    padding-bottom: 8px;
    border-bottom: 2px solid #D37141;
  }
  h2 {
    font-size: 14px;
    line-height: 1.25;
    font-weight: 700;
    color: #21263C;
    margin: 0 0 9px;
  }
  p { margin: 0 0 12px; color: #404040; }
  .meta { width: 4.8in; text-align: left; }
  .meta-row { display: grid; grid-template-columns: 1.8in 1fr; gap: 0.2in; margin: 0 0 18px; }
  .meta-row strong { font-weight: 700; }
  .prepared { margin-top: 48px; font-size: 10px; color: #374151; }
  .score-grid {
    display: grid;
    grid-template-columns: 1.85in 1fr;
    gap: 0;
    align-items: stretch;
    margin: 12px 0 32px;
    border: 1.5px solid #73777f;
  }
  .score-pane {
    background: #21263C;
    min-height: 1.55in;
    display: grid;
    align-content: center;
    justify-items: center;
  }
  .score-copy { background: #F4F0EC; padding: 16px 20px; }
  .score-number { font-size: 50px; font-weight: 700; color: #CAA15F; line-height: 0.9; text-align: center; }
  .score-out { text-align: center; color: #c7c9cf; font-size: 13px; margin-top: 8px; }
  .rating-label { font-size: 13px; font-weight: 700; color: #D37141; text-transform: uppercase; margin-bottom: 6px; }
  .rating { font-size: 28px; font-weight: 700; margin-bottom: 8px; color: #21263C; line-height: 1; }
  .score-copy p { font-size: 14px; line-height: 1.12; color: #404040; }
  table { width: 100%; border-collapse: collapse; margin: 14px 0 15px; }
  th {
    text-align: left;
    font-size: 16px;
    font-weight: 700;
    color: #ffffff;
    background: #21263C;
    padding: 7px 9px;
    border: 1px solid #c7c7c7;
  }
  td {
    vertical-align: top;
    padding: 7px 9px;
    color: #404040;
    border: 1px solid #d6d6d6;
    font-size: 14px;
  }
  .score-table th:nth-child(2),
  .score-table th:nth-child(3),
  .score-table th:nth-child(4),
  .score-table td:nth-child(2),
  .score-table td:nth-child(3),
  .score-table td:nth-child(4) { text-align: right; }
  .score-table td:first-child { width: 3.1in; }
  .score-table .total-row td { font-weight: 700; background: #21263C; color: #ffffff; }
  .score-table .total-row td:nth-child(3) { color: #CAA15F; }
  .score-table .total-row span { font-weight: 400; }
  .rating-cell { font-weight: 700; text-align: center !important; }
  .rating-cell.excellent { background: #E7F1DD; color: #2E7D32; }
  .rating-cell.good { background: #DDEBF7; color: #1769AA; }
  .rating-cell.attention { background: #FFF0D9; color: #B8701A; }
  .rating-cell.critical { background: #F9E1E1; color: #A83232; }
  .tiers { font-size: 14px; color: #888; margin-top: 22px; }
  .zone-block { margin-bottom: 19px; page-break-inside: avoid; }
  .zone-block p { margin-bottom: 8px; font-size: 13px; line-height: 1.45; }
  .key-label { font-weight: 700; margin-top: 10px; }
  ul { margin: 5px 0 0 20px; padding: 0; }
  li { margin: 0 0 3px; padding-left: 2px; }
  .improvement-intro { margin-bottom: 18px; }
  .improvement-table th,
  .capex-table th { font-size: 13px; }
  .improvement-table td,
  .capex-table td { font-size: 12px; }
  .improvement-table th:nth-child(n+3),
  .improvement-table td:nth-child(n+3) { text-align: center; }
  .improvement-table td:first-child { width: 2.35in; font-weight: 600; }
  .capex-table td:first-child { width: 3.1in; }
  .additional h2, .method h2 { margin-top: 25px; }
</style>
</head>
<body>
  <div class="no-print print-bar"><button onclick="window.print()">PRINT / SAVE AS PDF</button></div>

  <section class="cover">
    <img src="/brand/logo-wordmark-dark.svg" alt="Cantara" onerror="this.style.display='none'">
    <div class="eyebrow">Cantara</div>
    <div class="subbrand">Pet Business Advisors</div>
    <div class="rule"></div>
    <h1>${esc(report.businessName)}</h1>
    <div class="title">Facility Assessment Report</div>
    <div class="subtitle">Baseline Assessment &mdash; Sale Readiness Engagement</div>
    <div class="meta" style="margin-top:42px;color:#d7dde8;text-align:left;">
      <div class="meta-row"><strong>Location</strong><span>${esc(report.location)}</span></div>
      <div class="meta-row"><strong>Prepared by</strong><span>${esc(report.preparedBy)}</span></div>
      <div class="meta-row"><strong>Report version</strong><span>${esc(report.reportVersion)}</span></div>
      <div class="meta-row"><strong>Next review</strong><span>${esc(report.nextReview)}</span></div>
    </div>
    <div class="date">${esc(report.assessmentDate)}</div>
    <div class="conf">Confidential</div>
  </section>

  <section class="page">
    <div class="header">Cantara Pet Business Advisors<span> Facility Assessment Report&nbsp; | &nbsp;Confidential</span></div>
    <h1>Overall Facility Score</h1>
    <div class="score-grid">
      <div class="score-pane"><div><div class="score-number">${report.overallScore}</div><div class="score-out">out of 100</div></div></div>
      <div class="score-copy"><div class="rating-label">Overall Rating</div><div class="rating">${esc(report.overallRating)}</div><p>${esc(report.overallNarrative)}</p></div>
    </div>
    <h1>Zone Scores at a Glance</h1>
    <table class="score-table">
      <thead><tr><th>Assessment Zone</th><th>Weight</th><th>Score</th><th>Rating</th></tr></thead>
      <tbody>${overallRows}</tbody>
    </table>
    <div class="tiers">Score tiers: Excellent = 85&ndash;100 | Good = 70&ndash;84 | Needs Attention = 50&ndash;69 | Critical = below 50</div>
    <div class="footer">Sale Readiness Consulting | v1.0 Baseline</div>
  </section>

  <section class="page">
    <div class="header">Cantara Pet Business Advisors<span> Facility Assessment Report&nbsp; | &nbsp;Confidential</span></div>
    <h1>Zone-by-Zone Commentary</h1>
    ${commentary}
    <div class="footer">Sale Readiness Consulting | v1.0 Baseline</div>
  </section>

  <section class="page">
    <div class="header">Cantara Pet Business Advisors<span> Facility Assessment Report&nbsp; | &nbsp;Confidential</span></div>
    <h1>Prioritized Improvement Plan</h1>
    <p class="improvement-intro">Items are ranked by value impact relative to effort &mdash; address high-impact, low-effort items first. All items should be completed or in-progress before marketing photography.</p>
    <table class="improvement-table">
      <thead><tr><th>Improvement</th><th>Zone</th><th>Value<br>Impact</th><th>Effort</th><th>Timing</th></tr></thead>
      <tbody>${improvementRows}</tbody>
    </table>
    <div class="footer">Sale Readiness Consulting | v1.0 Baseline</div>
  </section>

  <section class="page additional">
    <div class="header">Cantara Pet Business Advisors<span> Facility Assessment Report&nbsp; | &nbsp;Confidential</span></div>
    <h1>Additional Report Elements</h1>
    <h2>Maintenance History Summary</h2>
    <p>${esc(maintenance)}</p>
    <h2>Capital Expenditure Outlook &mdash; Years 1 to 3</h2>
    <p>A buyer should anticipate the following capital requirements in the near term based on current facility condition and available documentation:</p>
    <table class="capex-table">
      <thead><tr><th>Item</th><th>Est. Cost Range</th><th>Timing</th></tr></thead>
      <tbody>${capexRows}</tbody>
    </table>
    <h2>Compliance &amp; Licensing Snapshot</h2>
    <p>${esc(compliance)}</p>
    <h2>Brand &amp; Curb Appeal Assessment</h2>
    <p>${esc(brand)}</p>
    <h2>Cantara Advisory Commentary &mdash; Market Context</h2>
    <p>${esc(advisory)}</p>
    <div class="footer">Sale Readiness Consulting | v1.0 Baseline</div>
  </section>

  <section class="page method">
    <div class="header">Cantara Pet Business Advisors<span> Facility Assessment Report&nbsp; | &nbsp;Confidential</span></div>
    <h1>Methodology Disclosure</h1>
    <h2>Methodology &amp; Limitations</h2>
    <p>${esc(defaultMethodology(report))}</p>
    <h2>Image Coverage Notes</h2>
    ${bullets(report.imageCoverageNotes)}
    <div class="footer">Sale Readiness Consulting | v1.0 Baseline</div>
  </section>
</body>
</html>`
}
