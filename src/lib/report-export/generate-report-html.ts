/**
 * Shared PDF-ready report HTML generator.
 * Produces a self-contained HTML document styled with Cantara branding that
 * can be printed to PDF via window.print() or saved as .html.
 */

import { CANTARA_COVER_BRAND_CSS, buildCantaraCoverBrandHtml } from './cantara-cover-branding'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReportSection {
  title: string
  content: string // HTML content for this section
}

export interface ReportConfig {
  title: string           // e.g. "Lease Analysis Report"
  subtitle: string        // e.g. "Deal Killer & Risk Assessment"
  clientName: string
  generatedAt: string
  sections: ReportSection[]
  summary?: string        // Executive summary paragraph
  flags?: { red: number; orange: number; green: number }
  kpis?: Array<{ label: string; value: string }> // Top KPI cards
}

// ── Generator ────────────────────────────────────────────────────────────────

export function generateReportHtml(config: ReportConfig): string {
  const date = new Date(config.generatedAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const flagBadges = config.flags
    ? `
      <div class="flag-row">
        ${config.flags.red > 0 ? `<span class="flag-badge flag-red">${config.flags.red} Red Flag${config.flags.red !== 1 ? 's' : ''}</span>` : ''}
        ${config.flags.orange > 0 ? `<span class="flag-badge flag-orange">${config.flags.orange} Yellow Flag${config.flags.orange !== 1 ? 's' : ''}</span>` : ''}
        ${config.flags.green > 0 ? `<span class="flag-badge flag-green">${config.flags.green} Green Flag${config.flags.green !== 1 ? 's' : ''}</span>` : ''}
      </div>`
    : ''

  const kpiStrip = config.kpis?.length
    ? `
      <div class="kpi-strip">
        ${config.kpis.map(k => `
          <div class="kpi-cell">
            <div class="kpi-value">${escapeHtml(k.value)}</div>
            <div class="kpi-label">${escapeHtml(k.label)}</div>
          </div>`).join('')}
      </div>`
    : ''

  const summaryBlock = config.summary
    ? `<div class="executive-summary">
        <p class="summary-label">Executive Summary</p>
        <p>${escapeHtml(config.summary)}</p>
       </div>`
    : ''

  const sectionBlocks = config.sections.map((section, idx) => `
    ${idx > 0 ? '<div class="section-divider"></div>' : ''}
    <div class="report-section">
      <h2>${escapeHtml(section.title)}</h2>
      ${renderInlineMarkdown(section.content)}
    </div>`).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(config.clientName)} — ${escapeHtml(config.title)}</title>
<style>
  @page { size: A4; margin: 20mm 16mm 20mm 16mm; }
  @media print {
    .no-print { display: none !important; }
    html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page-break { page-break-before: always; }
    /* Fill first sheet within @page margins (A4 20mm top+bottom) */
    .cover {
      page-break-after: always;
      min-height: calc(297mm - 40mm);
      height: calc(297mm - 40mm);
    }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1e293b;
    line-height: 1.6;
    margin: 0;
    padding: 0;
    font-size: 13px;
    width: 100%;
    max-width: none;
  }
  /* Center report content only; cover stays full page width for print/PDF */
  .report-shell {
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
  }

  /* ── Cover ──────────────────────────────────────────────────── */
  .cover {
    width: 100%;
    background: linear-gradient(135deg, #21263C 0%, #161a2e 100%);
    color: #F1E6BB;
    padding: 48px 40px 40px;
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    text-align: center;
  }
  .cover-top,
  .cover-mid,
  .cover-bottom {
    width: 100%;
    max-width: 720px;
    margin-left: auto;
    margin-right: auto;
  }
  .cover-mid {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    min-height: 0;
  }
  ${CANTARA_COVER_BRAND_CSS}
  .cover .divider {
    width: 60px;
    height: 3px;
    background: #CAA15F;
    margin: 36px auto;
    border-radius: 2px;
  }
  .cover h1 {
    font-size: 36px;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: white;
    margin-bottom: 8px;
  }
  .cover .report-title {
    font-size: 20px;
    color: #CAA15F;
    font-weight: 600;
    margin-bottom: 4px;
  }
  .cover .report-subtitle {
    font-size: 14px;
    color: #94a3b8;
  }
  .cover .cover-date {
    font-size: 11px;
    color: #94a3b8;
    margin-top: 0;
  }
  .cover .confidential {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 3px;
    color: #94a3b8;
    margin-top: 10px;
  }

  /* ── Flag badges ────────────────────────────────────────────── */
  .flag-row {
    display: flex;
    gap: 10px;
    justify-content: center;
    margin-top: 28px;
    flex-wrap: wrap;
  }
  .flag-badge {
    display: inline-flex;
    align-items: center;
    padding: 6px 16px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 700;
    border: 1px solid;
  }
  .flag-red { background: #FEF2F2; color: #b91c1c; border-color: #FCA5A5; }
  .flag-orange { background: #FFFBEB; color: #92400e; border-color: #FCD34D; }
  .flag-green { background: #F0FDF4; color: #166534; border-color: #86EFAC; }

  /* ── KPI strip ──────────────────────────────────────────────── */
  .kpi-strip {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1px;
    background: #21263C;
    border-radius: 12px;
    overflow: hidden;
    margin: 24px 0;
  }
  .kpi-cell {
    background: #1e293b;
    padding: 20px 16px;
    text-align: center;
    color: white;
  }
  .kpi-value {
    font-size: 22px;
    font-weight: 800;
    color: #CAA15F;
  }
  .kpi-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #94a3b8;
    margin-top: 4px;
  }

  /* ── Executive summary ──────────────────────────────────────── */
  .executive-summary {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 20px 24px;
    margin: 24px 0;
  }
  .executive-summary .summary-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 3px;
    color: #CAA15F;
    font-weight: 700;
    margin-bottom: 8px;
  }
  .executive-summary p {
    font-size: 13px;
    color: #475569;
    line-height: 1.7;
  }

  /* ── Sections ───────────────────────────────────────────────── */
  .report-body {
    padding: 40px 48px;
  }
  .report-section {
    margin-bottom: 28px;
  }
  .report-section h2 {
    font-size: 18px;
    font-weight: 700;
    color: #21263C;
    border-bottom: 2px solid #CAA15F;
    padding-bottom: 6px;
    margin-bottom: 16px;
  }
  .report-section p {
    font-size: 13px;
    color: #475569;
    margin-bottom: 8px;
    line-height: 1.7;
  }
  .section-divider {
    height: 1px;
    background: #e2e8f0;
    margin: 24px 0;
  }

  /* ── Tables ─────────────────────────────────────────────────── */
  table.report-table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0 16px;
    font-size: 12px;
  }
  table.report-table th {
    text-align: left;
    padding: 10px 12px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: #94a3b8;
    font-weight: 700;
    border-bottom: 2px solid #e2e8f0;
    background: #f8fafc;
  }
  table.report-table td {
    padding: 10px 12px;
    font-size: 12px;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
  }
  table.report-table td:first-child {
    font-weight: 600;
    color: #1e293b;
  }
  table.report-table tr:last-child td {
    border-bottom: none;
  }
  table.report-table tr.total-row td {
    font-weight: 700;
    border-top: 2px solid #e2e8f0;
    background: #f8fafc;
  }

  /* ── Flag lists inside sections ─────────────────────────────── */
  .flag-item {
    padding: 10px 14px;
    border-radius: 8px;
    margin-bottom: 8px;
    border: 1px solid;
  }
  .flag-item.red { background: #FEF2F2; border-color: #FCA5A5; }
  .flag-item.orange { background: #FFFBEB; border-color: #FCD34D; }
  .flag-item.green { background: #F0FDF4; border-color: #86EFAC; }
  .flag-item .flag-title {
    font-weight: 700;
    font-size: 13px;
    margin-bottom: 2px;
  }
  .flag-item.red .flag-title { color: #b91c1c; }
  .flag-item.orange .flag-title { color: #92400e; }
  .flag-item.green .flag-title { color: #166534; }
  .flag-item .flag-detail {
    font-size: 12px;
    color: #475569;
    line-height: 1.5;
  }

  /* ── Material contracts print layout ────────────────────────── */
  .contract-dashboard {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1px;
    overflow: hidden;
    border-radius: 10px;
    background: #21263C;
    margin-bottom: 18px;
  }
  .contract-dashboard div {
    background: #1e293b;
    color: white;
    padding: 14px 12px;
    text-align: center;
  }
  .contract-dashboard span {
    display: block;
    color: #94a3b8;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }
  .contract-dashboard strong {
    display: block;
    margin-top: 4px;
    color: #CAA15F;
    font-size: 22px;
    line-height: 1;
  }
  /* ── Contract snapshot — card layout ───────────────────────── */
  .contract-snapshot {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin: 8px 0;
  }
  @media print {
    .contract-snapshot { grid-template-columns: 1fr 1fr; }
  }
  .contract-snapshot-card {
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    overflow: hidden;
    break-inside: avoid;
    background: #fff;
  }
  .contract-snapshot-card-header {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 12px 8px;
    border-bottom: 1px solid #f1f5f9;
    background: #f8fafc;
  }
  .contract-snapshot-index {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    border-radius: 999px;
    background: #21263C;
    color: #CAA15F;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 800;
    margin-top: 1px;
  }
  .contract-snapshot-field {
    flex: 1;
    color: #0f172a;
    font-size: 12px;
    font-weight: 700;
    line-height: 1.4;
  }
  .contract-snapshot-badge {
    flex-shrink: 0;
    background: #fef9ec;
    border: 1px solid #fde68a;
    color: #92400e;
    border-radius: 6px;
    padding: 2px 7px;
    font-size: 9px;
    font-weight: 600;
    line-height: 1.5;
    white-space: nowrap;
  }
  .contract-finding-pills {
    padding: 8px 10px 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .contract-finding-pill {
    display: flex;
    align-items: baseline;
    gap: 6px;
    background: #f8fafc;
    border: 1px solid #f1f5f9;
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 11px;
    line-height: 1.45;
  }
  .contract-finding-pill-plain {
    color: #475569;
  }
  .contract-finding-label {
    flex-shrink: 0;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #94a3b8;
    min-width: 56px;
  }
  .contract-finding-value {
    color: #1e293b;
    font-weight: 500;
  }
  .contract-flag {
    break-inside: avoid;
    padding: 12px 14px;
  }

  /* ── Info grid (key-value pairs) ────────────────────────────── */
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin: 12px 0;
  }
  .info-cell {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px 14px;
  }
  .info-cell .info-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #94a3b8;
    font-weight: 600;
  }
  .info-cell .info-value {
    font-size: 13px;
    font-weight: 600;
    color: #1e293b;
    margin-top: 2px;
  }

  /* ── Disclaimer / footer ────────────────────────────────────── */
  .disclaimer {
    padding: 28px 48px;
    border-top: 1px solid #e2e8f0;
  }
  .disclaimer p {
    font-size: 9px;
    color: #94a3b8;
    line-height: 1.6;
  }

  /* ── Print button ───────────────────────────────────────────── */
  .print-bar {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 100;
    display: flex;
    gap: 8px;
  }
  .print-bar button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 24px;
    background: #21263C;
    color: #CAA15F;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 1px;
  }
  .print-bar button:hover { opacity: 0.9; }

  /* ── Bullet lists ───────────────────────────────────────────── */
  ul.report-list {
    margin: 8px 0 12px 18px;
    padding: 0;
  }
  ul.report-list li {
    font-size: 12px;
    color: #475569;
    margin-bottom: 4px;
    line-height: 1.6;
  }
</style>
</head>
<body>

<div class="no-print print-bar">
  <button onclick="window.print()">PRINT / SAVE AS PDF</button>
</div>

<!-- COVER PAGE -->
<div class="cover">
  <div class="cover-top">
    ${buildCantaraCoverBrandHtml()}
    <div class="divider"></div>
  </div>
  <div class="cover-mid">
    <h1>${escapeHtml(config.clientName)}</h1>
    <div class="report-title">${escapeHtml(config.title)}</div>
    <div class="report-subtitle">${escapeHtml(config.subtitle)}</div>
    ${flagBadges}
  </div>
  <div class="cover-bottom">
    <div class="cover-date">${date}</div>
    <div class="confidential">Confidential &mdash; For Internal Use Only</div>
  </div>
</div>

<div class="report-shell">
<!-- REPORT BODY -->
<div class="report-body">
  ${kpiStrip}
  ${summaryBlock}
  ${sectionBlocks}
</div>

<!-- DISCLAIMER -->
<div class="disclaimer">
  <p>DISCLAIMER: This report has been generated by Cantara&rsquo;s AI-powered analysis platform for internal advisory use. Information is derived from uploaded documents and public data sources. All findings should be independently verified during formal due diligence. This document does not constitute financial, legal, or investment advice. &copy; ${new Date().getFullYear()} Cantara Pet Advisors. All rights reserved.</p>
</div>
</div>

</body>
</html>`
}

// ── Utility: HTML table builder ──────────────────────────────────────────────

export function buildHtmlTable(
  headers: Array<string | number | null | undefined>,
  rows: Array<Array<string | number | null | undefined>>,
  options?: { totalRow?: boolean; prelineHeaders?: boolean },
): string {
  const ths = headers
    .map((h) => {
      const raw = h == null ? '' : String(h)
      if (options?.prelineHeaders && raw.includes('\n')) {
        const parts = raw.split('\n').map((line) => escapeHtml(line.trim())).filter(Boolean)
        const inner = parts
          .map((p, i) =>
            i === 0
              ? `<div style="font-weight:700;">${p}</div>`
              : `<div style="font-size:10px;font-weight:600;color:#64748b;margin-top:2px;">${p}</div>`,
          )
          .join('')
        return `<th style="vertical-align:bottom;text-align:right;">${inner}</th>`
      }
      return `<th>${escapeHtml(raw)}</th>`
    })
    .join('')
  const trs = rows.map((row, idx) => {
    const isTotal = options?.totalRow && idx === rows.length - 1
    const tds = row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')
    return `<tr${isTotal ? ' class="total-row"' : ''}>${tds}</tr>`
  }).join('\n')

  return `<table class="report-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`
}

export function buildFlagListHtml(
  flags: Array<{ issue: string | null | undefined; whyItMatters: string | null | undefined }>,
  color: 'red' | 'orange' | 'green',
): string {
  if (!flags.length) return ''
  return flags.map(f => `
    <div class="flag-item ${color}">
      <div class="flag-title">${escapeHtml(f.issue)}</div>
      <div class="flag-detail">${escapeHtml(f.whyItMatters)}</div>
    </div>`).join('\n')
}

export function buildInfoGrid(pairs: Array<{ label: string | null | undefined; value: string | number | null | undefined }>): string {
  return `<div class="info-grid">${pairs.map(p => `
    <div class="info-cell">
      <div class="info-label">${escapeHtml(p.label)}</div>
      <div class="info-value">${escapeHtml(p.value)}</div>
    </div>`).join('')}
  </div>`
}

export function buildBulletList(items: Array<string | number | null | undefined>): string {
  if (!items.length) return ''
  return `<ul class="report-list">${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str: string | number | null | undefined): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function renderInlineMarkdown(html: string): string {
  return html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}
