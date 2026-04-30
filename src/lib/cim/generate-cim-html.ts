import { CimInputData } from './types'

export function generateCimHtml(data: CimInputData): string {
  const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(data.businessName)} &mdash; Confidential Information Memorandum</title>
<style>
  @page { size: A4; margin: 0; }
  @media print {
    .no-print { display: none !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page-break { page-break-before: always; }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 0; }

  /* ── Brand Palette ── */
  :root {
    --navy: #21263C;
    --navy-deep: #171B2E;
    --gold: #CAA15F;
    --gold-light: #D4B577;
    --sun: #F1E6BB;
    --slate: #64748b;
    --slate-light: #94a3b8;
    --border: #e2e8f0;
    --bg-alt: #f8fafc;
    --text-primary: #1e293b;
    --text-secondary: #475569;
  }

  /* ── Cover Page ── */
  .cover {
    background: linear-gradient(160deg, var(--navy) 0%, var(--navy-deep) 100%);
    color: white;
    padding: 80px 60px 60px;
    text-align: center;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    position: relative;
  }
  .cover::before {
    content: '';
    position: absolute;
    top: 0; right: 0; bottom: 0; left: 0;
    background: radial-gradient(ellipse at 70% 20%, rgba(202,161,95,0.08) 0%, transparent 60%);
    pointer-events: none;
  }
  .cover .brand { font-size: 13px; text-transform: uppercase; letter-spacing: 6px; color: var(--gold); font-weight: 700; margin-bottom: 8px; position: relative; }
  .cover .brand-sub { font-size: 10px; text-transform: uppercase; letter-spacing: 3px; color: var(--slate); font-weight: 600; margin-bottom: 32px; position: relative; }
  .cover .divider { width: 60px; height: 3px; background: var(--gold); margin: 0 auto 40px; border-radius: 2px; position: relative; }
  .cover h1 { font-size: 44px; font-weight: 800; letter-spacing: -1px; margin-bottom: 10px; color: var(--sun); position: relative; }
  .cover .subtitle { font-size: 20px; color: var(--slate-light); margin-bottom: 6px; position: relative; }
  .cover .region { font-size: 14px; color: var(--slate); position: relative; }
  .cover .service-lines { font-size: 12px; color: var(--slate); margin-top: 24px; letter-spacing: 1px; position: relative; }
  .cover .doc-type { font-size: 11px; text-transform: uppercase; letter-spacing: 4px; color: var(--gold); margin-top: 48px; position: relative; }
  .cover .doc-date { font-size: 11px; color: var(--slate); margin-top: 8px; position: relative; }
  .cover .confidential { font-size: 9px; text-transform: uppercase; letter-spacing: 3px; color: var(--slate); margin-top: 32px; border-top: 1px solid rgba(202,161,95,0.2); padding-top: 16px; position: relative; }

  /* ── Section Layout ── */
  .section { padding: 48px 60px; }
  .section-number { font-size: 11px; color: var(--slate-light); font-weight: 600; margin-bottom: 2px; }
  .section-header { font-size: 10px; text-transform: uppercase; letter-spacing: 4px; color: var(--gold); font-weight: 700; margin-bottom: 8px; }
  .section h2 { font-size: 28px; font-weight: 700; color: var(--text-primary); margin-bottom: 20px; }
  .section h3 { font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 28px 0 12px; }
  .section p { font-size: 14px; color: var(--text-secondary); margin-bottom: 14px; line-height: 1.7; }
  .section ul { margin: 12px 0 16px 20px; }
  .section li { font-size: 13px; color: var(--text-secondary); line-height: 1.7; margin-bottom: 6px; }

  /* ── Navy Section Bar ── */
  .navy-bar {
    background: var(--navy);
    color: var(--sun);
    padding: 32px 60px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 24px;
  }
  .navy-bar .bar-item { text-align: center; flex: 1; }
  .navy-bar .bar-value { font-size: 26px; font-weight: 800; color: var(--gold); }
  .navy-bar .bar-label { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: var(--slate-light); margin-top: 4px; }

  /* ── Tables ── */
  .cim-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
  .cim-table thead th {
    background: var(--navy);
    color: var(--sun);
    padding: 12px 14px;
    text-align: left;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    font-weight: 700;
    border: none;
  }
  .cim-table thead th.num { text-align: right; }
  .cim-table tbody td {
    padding: 11px 14px;
    border-bottom: 1px solid var(--border);
    color: var(--text-secondary);
  }
  .cim-table tbody tr:nth-child(even) td { background: var(--bg-alt); }
  .cim-table tbody td:first-child { font-weight: 600; color: var(--text-primary); }
  .cim-table tbody td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .cim-table tbody td.pct { text-align: right; color: var(--slate-light); font-size: 11px; }
  .cim-table tbody tr.total-row td { font-weight: 700; color: var(--text-primary); border-top: 2px solid var(--navy); background: #f1f5f9; }
  .cim-table tbody tr.subtotal-row td { font-weight: 600; color: var(--text-primary); border-top: 1px solid var(--slate-light); }
  .cim-table tfoot td { font-size: 11px; color: var(--slate-light); font-style: italic; padding: 10px 14px; border: none; }

  /* ── Key-Value Detail Table ── */
  .detail-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  .detail-table td { padding: 12px 16px; border-bottom: 1px solid var(--border); font-size: 13px; }
  .detail-table tr:nth-child(even) td { background: var(--bg-alt); }
  .detail-table td:first-child { font-weight: 600; color: var(--text-primary); width: 38%; }
  .detail-table td:last-child { color: var(--text-secondary); }

  /* ── Overview Cards ── */
  .card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; }
  .card-grid.three-col { grid-template-columns: 1fr 1fr 1fr; }
  .card {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 22px;
    background: white;
  }
  .card h4 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: var(--gold);
    font-weight: 700;
    margin-bottom: 10px;
  }
  .card p { font-size: 12px; color: var(--slate); margin: 0; line-height: 1.6; }

  /* ── Thesis Bullets ── */
  .thesis-list { list-style: none; margin: 16px 0; padding: 0; }
  .thesis-list li {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 14px 0;
    border-bottom: 1px solid var(--border);
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.6;
  }
  .thesis-list li:last-child { border-bottom: none; }
  .thesis-num {
    width: 32px; height: 32px;
    background: var(--navy);
    color: var(--gold);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 13px;
    flex-shrink: 0;
  }

  /* ── GM Profile Card ── */
  .gm-profile {
    background: var(--bg-alt);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 28px;
    margin: 20px 0;
  }
  .gm-profile h4 { font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 12px; }
  .gm-profile .gm-meta { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 12px; }
  .gm-profile .gm-meta span { font-size: 12px; color: var(--slate); }
  .gm-profile .gm-meta span strong { color: var(--text-primary); }
  .gm-profile p { font-size: 13px; color: var(--text-secondary); line-height: 1.7; margin: 0; }

  /* ── Process Steps ── */
  .process-steps { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin: 24px 0; }
  .process-step {
    background: var(--navy);
    border-radius: 12px;
    padding: 28px 24px;
    text-align: center;
    color: white;
  }
  .process-step .step-num { font-size: 10px; text-transform: uppercase; letter-spacing: 3px; color: var(--gold); margin-bottom: 10px; }
  .process-step .step-title { font-size: 16px; font-weight: 700; color: var(--sun); margin-bottom: 8px; }
  .process-step .step-desc { font-size: 12px; color: var(--slate-light); line-height: 1.5; }

  /* ── Contact Block ── */
  .contact-block {
    background: var(--navy);
    color: var(--sun);
    padding: 48px 60px;
    text-align: center;
  }
  .contact-block h3 { font-size: 22px; font-weight: 700; color: var(--sun); margin-bottom: 20px; }
  .contact-block .name { font-size: 16px; font-weight: 700; color: white; }
  .contact-block .title { font-size: 13px; color: var(--slate-light); margin-top: 4px; }
  .contact-block .email { font-size: 14px; color: var(--gold); margin-top: 8px; font-weight: 600; }

  /* ── Disclaimer ── */
  .disclaimer { padding: 32px 60px; border-top: 1px solid var(--border); }
  .disclaimer p { font-size: 9px; color: var(--slate-light); line-height: 1.6; }

  .footnote { font-size: 11px; color: var(--slate-light); font-style: italic; margin: 12px 0; }

  /* ── Data Room ── */
  .data-room-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0; }
  .data-room-item {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
  }
  .data-room-item .dr-cat {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: var(--gold);
    font-weight: 700;
    margin-bottom: 6px;
  }
  .data-room-item .dr-items { font-size: 12px; color: var(--slate); line-height: 1.6; }

  /* ── Bullet Lists in sections ── */
  .bullet-list { list-style: none; margin: 12px 0; padding: 0; }
  .bullet-list li { position: relative; padding: 6px 0 6px 18px; font-size: 13px; color: var(--text-secondary); line-height: 1.6; }
  .bullet-list li::before { content: '\\2022'; position: absolute; left: 0; color: var(--gold); font-weight: 700; }
</style>
</head>
<body>

<div class="no-print" style="position:fixed;top:20px;right:20px;z-index:100;">
  <button onclick="window.print()" style="display:inline-flex;align-items:center;gap:8px;padding:10px 24px;background:var(--navy,#21263C);color:var(--gold,#CAA15F);border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;letter-spacing:1px;">PRINT / SAVE AS PDF</button>
</div>

<!-- ═══════════════════ COVER PAGE ═══════════════════ -->
<div class="cover">
  <div class="brand">Cantara</div>
  <div class="brand-sub">Pet Business Advisors</div>
  <div class="divider"></div>
  <h1>${escapeHtml(data.businessName)}</h1>
  <div class="subtitle">${escapeHtml(data.subtitle)}</div>
  <div class="region">${escapeHtml(data.region)}</div>
  <div class="service-lines">${escapeHtml(data.serviceLines)}</div>
  <div class="doc-type">Confidential Information Memorandum</div>
  <div class="doc-date">${currentDate}</div>
  <div class="confidential">Confidential &mdash; Do Not Distribute Without Written Consent</div>
</div>

<div class="page-break"></div>

<!-- ═══════════════════ 01 EXECUTIVE SUMMARY ═══════════════════ -->
<div class="section">
  <div class="section-number">01</div>
  <div class="section-header">Executive Summary</div>
  <h2>Investment Overview</h2>
  <p>${escapeHtml(data.investmentOverview)}</p>

  <h3>Investment Thesis</h3>
  <ul class="thesis-list">
    ${data.investmentThesis.filter(t => t).map((t, i) => `
    <li>
      <span class="thesis-num">${i + 1}</span>
      <span>${escapeHtml(t)}</span>
    </li>`).join('')}
  </ul>

  <h3>Seller Overview</h3>
  <p>${escapeHtml(data.sellerOverview)}</p>

  <h3>Transaction Overview</h3>
  <p>${escapeHtml(data.transactionOverview)}</p>
</div>

<div class="page-break"></div>

<!-- ═══════════════════ 02 BUSINESS OVERVIEW ═══════════════════ -->
<div class="section">
  <div class="section-number">02</div>
  <div class="section-header">Business Overview</div>
  <h2>Company Profile</h2>
  <p>${escapeHtml(data.businessDescription)}</p>

  <div class="card-grid">
    <div class="card">
      <h4>Facility Profile</h4>
      <p>${escapeHtml(data.facilityProfile)}</p>
    </div>
    <div class="card">
      <h4>Ownership &amp; Management</h4>
      <p>${escapeHtml(data.ownershipManagement)}</p>
    </div>
    <div class="card">
      <h4>Client Profile</h4>
      <p>${escapeHtml(data.clientProfile)}</p>
    </div>
    <div class="card">
      <h4>Staff &amp; Operations</h4>
      <p>${escapeHtml(data.staffOperations)}</p>
    </div>
    <div class="card">
      <h4>Real Estate</h4>
      <p>${escapeHtml(data.realEstate)}</p>
    </div>
    <div class="card">
      <h4>Technology</h4>
      <p>${escapeHtml(data.technology)}</p>
    </div>
  </div>

  ${data.permitsZoning ? `<h3>Permits &amp; Zoning</h3><p>${escapeHtml(data.permitsZoning)}</p>` : ''}
</div>

<div class="page-break"></div>

<!-- ═══════════════════ 03 FINANCIAL PERFORMANCE ═══════════════════ -->
<div class="section">
  <div class="section-number">03</div>
  <div class="section-header">Financial Performance</div>
  <h2>Historical &amp; Projected Financials</h2>

  ${data.financialHighlights.filter(h => h).length > 0 ? `
  <ul class="bullet-list">
    ${data.financialHighlights.filter(h => h).map(h => `<li>${escapeHtml(h)}</li>`).join('')}
  </ul>` : ''}

  ${data.incomeStatement.length > 0 ? `
  <h3>Consolidated Income Statement</h3>
  <table class="cim-table">
    <thead>
      <tr>
        <th>Line Item</th>
        <th class="num">FY1</th><th class="num">%</th>
        <th class="num">FY2</th><th class="num">%</th>
        <th class="num">FY3</th><th class="num">%</th>
        <th class="num">TTM</th><th class="num">%</th>
        <th class="num">Proj Y1</th><th class="num">%</th>
        <th class="num">Proj Y2</th><th class="num">%</th>
      </tr>
    </thead>
    <tbody>
      ${data.incomeStatement.map(row => {
        const isTotal = row.label.toLowerCase().includes('ebitda') || row.label.toLowerCase().includes('total') || row.label.toLowerCase().includes('net income')
        const cls = isTotal ? ' class="total-row"' : ''
        return `<tr${cls}>
        <td>${escapeHtml(row.label)}</td>
        <td class="num">${escapeHtml(row.fy1)}</td><td class="pct">${escapeHtml(row.fy1Pct)}</td>
        <td class="num">${escapeHtml(row.fy2)}</td><td class="pct">${escapeHtml(row.fy2Pct)}</td>
        <td class="num">${escapeHtml(row.fy3)}</td><td class="pct">${escapeHtml(row.fy3Pct)}</td>
        <td class="num">${escapeHtml(row.ttm)}</td><td class="pct">${escapeHtml(row.ttmPct)}</td>
        <td class="num">${escapeHtml(row.proj1)}</td><td class="pct">${escapeHtml(row.proj1Pct)}</td>
        <td class="num">${escapeHtml(row.proj2)}</td><td class="pct">${escapeHtml(row.proj2Pct)}</td>
      </tr>`}).join('')}
    </tbody>
    <tfoot><tr><td colspan="13">${escapeHtml(data.incomeFootnote)}</td></tr></tfoot>
  </table>` : ''}

  ${data.serviceLineBreakdown.length > 0 ? `
  <h3>Revenue by Service Line</h3>
  <table class="cim-table">
    <thead>
      <tr>
        <th>Service Line</th>
        <th class="num">TTM Revenue</th>
        <th class="num">% of Total</th>
      </tr>
    </thead>
    <tbody>
      ${data.serviceLineBreakdown.map(s => `<tr>
        <td>${escapeHtml(s.name)}</td>
        <td class="num">${escapeHtml(s.ttmRevenue)}</td>
        <td class="num">${escapeHtml(s.pctOfTotal)}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : ''}

  ${data.monthlyTrending ? `
  <h3>Monthly Revenue Trending</h3>
  ${data.monthlyTrending}` : ''}
</div>

<div class="page-break"></div>

<!-- ═══════════════════ 04 EBITDA NORMALIZATION ═══════════════════ -->
<div class="section">
  <div class="section-number">04</div>
  <div class="section-header">EBITDA Normalization</div>
  <h2>Adjusted Earnings Analysis</h2>

  ${data.normalizationNotes.filter(n => n).length > 0 ? `
  <ul class="bullet-list">
    ${data.normalizationNotes.filter(n => n).map(n => `<li>${escapeHtml(n)}</li>`).join('')}
  </ul>` : ''}

  ${data.normalizationItems.length > 0 ? `
  <h3>Normalization Schedule</h3>
  <table class="cim-table">
    <thead>
      <tr>
        <th>Add-Back / Adjustment</th>
        <th class="num">TTM Amount</th>
        <th>Commentary</th>
      </tr>
    </thead>
    <tbody>
      ${data.normalizationItems.map(item => `<tr>
        <td>${escapeHtml(item.item)}</td>
        <td class="num">${escapeHtml(item.ttmAmount)}</td>
        <td>${escapeHtml(item.commentary)}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  <p class="footnote">${escapeHtml(data.normalizationFootnote)}</p>` : ''}
</div>

<div class="page-break"></div>

<!-- ═══════════════════ 05 VALUE CREATION ═══════════════════ -->
<div class="section">
  <div class="section-number">05</div>
  <div class="section-header">Value Creation</div>
  <h2>Growth &amp; Optimization Opportunities</h2>
  <p>${escapeHtml(data.valueCreationIntro)}</p>

  ${data.valueCreationItems.length > 0 ? `
  <table class="cim-table">
    <thead>
      <tr>
        <th style="width: 4%">#</th>
        <th style="width: 18%">Initiative</th>
        <th style="width: 30%">Description</th>
        <th style="width: 14%">Timing</th>
        <th style="width: 18%">Revenue Impact</th>
        <th style="width: 16%">Dependencies</th>
      </tr>
    </thead>
    <tbody>
      ${data.valueCreationItems.map((v, i) => `<tr>
        <td style="text-align:center; font-weight:700; color:var(--gold);">${i + 1}</td>
        <td style="font-weight:600;">${escapeHtml(v.initiative)}</td>
        <td>${escapeHtml(v.description)}</td>
        <td>${escapeHtml(v.timing)}</td>
        <td class="num">${escapeHtml(v.revenueImpact)}</td>
        <td>${escapeHtml(v.dependencies)}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : ''}
</div>

<div class="page-break"></div>

<!-- ═══════════════════ 06 OPERATIONS & MANAGEMENT ═══════════════════ -->
<div class="section">
  <div class="section-number">06</div>
  <div class="section-header">Operations &amp; Management</div>
  <h2>Organizational Overview</h2>

  ${data.orgChartHtml ? `
  <h3>Organization Chart</h3>
  ${data.orgChartHtml}` : ''}

  ${data.gmProfile.name ? `
  <h3>General Manager Profile</h3>
  <div class="gm-profile">
    <h4>${escapeHtml(data.gmProfile.name)}</h4>
    <div class="gm-meta">
      <span><strong>Tenure:</strong> ${escapeHtml(data.gmProfile.tenure)}</span>
      <span><strong>Certifications:</strong> ${escapeHtml(data.gmProfile.certifications)}</span>
      <span><strong>Transition:</strong> ${escapeHtml(data.gmProfile.transition)}</span>
    </div>
    <p>${escapeHtml(data.gmProfile.responsibilities)}</p>
  </div>` : ''}

  ${data.staffingOverview.length > 0 ? `
  <h3>Staffing Overview</h3>
  <ul class="bullet-list">
    ${data.staffingOverview.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
  </ul>` : ''}

  ${data.technologyStack.length > 0 ? `
  <h3>Technology Stack</h3>
  <ul class="bullet-list">
    ${data.technologyStack.map(t => `<li>${escapeHtml(t)}</li>`).join('')}
  </ul>` : ''}

  ${data.marketingOverview.length > 0 ? `
  <h3>Marketing Overview</h3>
  <ul class="bullet-list">
    ${data.marketingOverview.map(m => `<li>${escapeHtml(m)}</li>`).join('')}
  </ul>` : ''}

  ${data.marketingOpportunities.length > 0 ? `
  <h3>Marketing Opportunities</h3>
  <ul class="bullet-list">
    ${data.marketingOpportunities.map(m => `<li>${escapeHtml(m)}</li>`).join('')}
  </ul>` : ''}
</div>

<div class="page-break"></div>

<!-- ═══════════════════ 07 REAL ESTATE & FACILITY ═══════════════════ -->
<div class="section">
  <div class="section-number">07</div>
  <div class="section-header">Real Estate &amp; Facility</div>
  <h2>Property &amp; Lease Details</h2>

  ${data.facilityDetails.length > 0 ? `
  <h3>Facility Details</h3>
  <table class="detail-table">
    ${data.facilityDetails.map(d => `<tr>
      <td>${escapeHtml(d.label)}</td>
      <td>${escapeHtml(d.value)}</td>
    </tr>`).join('')}
  </table>` : ''}

  ${data.leaseDetails.length > 0 ? `
  <h3>Lease Summary</h3>
  <table class="detail-table">
    ${data.leaseDetails.map(d => `<tr>
      <td>${escapeHtml(d.label)}</td>
      <td>${escapeHtml(d.value)}</td>
    </tr>`).join('')}
  </table>` : ''}
</div>

<div class="page-break"></div>

<!-- ═══════════════════ 08 COMPETITIVE LANDSCAPE ═══════════════════ -->
<div class="section">
  <div class="section-number">08</div>
  <div class="section-header">Competitive Landscape</div>
  <h2>Market Position &amp; Competitors</h2>

  ${data.competitiveIntro.filter(c => c).length > 0 ? `
  <ul class="bullet-list">
    ${data.competitiveIntro.filter(c => c).map(c => `<li>${escapeHtml(c)}</li>`).join('')}
  </ul>` : ''}

  ${data.competitors.length > 0 ? `
  <h3>Competitor Comparison</h3>
  <table class="cim-table">
    <thead>
      <tr>
        <th>Competitor</th>
        <th>Distance</th>
        <th>Services</th>
        <th>Capacity</th>
        <th>Rating</th>
        <th>Commentary</th>
      </tr>
    </thead>
    <tbody>
      ${data.competitors.map(c => `<tr>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.distance)}</td>
        <td>${escapeHtml(c.services)}</td>
        <td>${escapeHtml(c.capacity)}</td>
        <td>${escapeHtml(c.rating)}</td>
        <td>${escapeHtml(c.commentary)}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : ''}

  ${data.pricingComparison ? `
  <h3>Pricing Comparison</h3>
  ${data.pricingComparison}` : ''}
</div>

<div class="page-break"></div>

<!-- ═══════════════════ 09 TRANSACTION & PROCESS ═══════════════════ -->
<div class="section">
  <div class="section-number">09</div>
  <div class="section-header">Transaction &amp; Process</div>
  <h2>Deal Structure &amp; Next Steps</h2>

  ${data.transactionTerms.length > 0 ? `
  <h3>Indicative Terms</h3>
  <table class="detail-table">
    ${data.transactionTerms.map(t => `<tr>
      <td>${escapeHtml(t.label)}</td>
      <td>${escapeHtml(t.value)}</td>
    </tr>`).join('')}
  </table>` : ''}

  ${data.dataRoomContents.length > 0 ? `
  <h3>Data Room Contents</h3>
  <div class="data-room-grid">
    ${data.dataRoomContents.map(d => `<div class="data-room-item">
      <div class="dr-cat">${escapeHtml(d.category)}</div>
      <div class="dr-items">${escapeHtml(d.items)}</div>
    </div>`).join('')}
  </div>` : ''}

  <h3>Process Overview</h3>
  <div class="process-steps">
    ${data.processSteps.map(s => `<div class="process-step">
      <div class="step-num">${escapeHtml(s.step)}</div>
      <div class="step-title">${escapeHtml(s.title)}</div>
      <div class="step-desc">${escapeHtml(s.description)}</div>
    </div>`).join('')}
  </div>
</div>

<!-- ═══════════════════ CONTACT ═══════════════════ -->
<div class="contact-block">
  <h3>Contact</h3>
  <div class="name">${escapeHtml(data.contactName)}</div>
  <div class="title">${escapeHtml(data.contactTitle)}</div>
  <div class="email">${escapeHtml(data.contactEmail)}</div>
</div>

<!-- ═══════════════════ DISCLAIMER ═══════════════════ -->
<div class="disclaimer">
  <p>DISCLAIMER: This Confidential Information Memorandum (&ldquo;CIM&rdquo;) has been prepared by Cantara Pet Advisors solely for informational purposes and is intended exclusively for the named recipient. It may not be reproduced, distributed, or disclosed to any third party without prior written consent. Information has been obtained from sources believed to be reliable, including management accounts provided by the seller, but has not been independently verified. No representation or warranty, express or implied, is made as to the accuracy, completeness, or fairness of the information contained herein. This document does not constitute an offer to sell or a solicitation of an offer to buy any securities, business interests, or assets. Cantara Pet Advisors is acting as exclusive sell-side advisor and owes no fiduciary or other duty to any prospective buyer. All financial figures are indicative and subject to verification during due diligence. Prospective buyers should conduct their own independent investigation and assessment. &copy; ${new Date().getFullYear()} Cantara Pet Advisors. All rights reserved.</p>
</div>

</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
