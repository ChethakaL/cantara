export type TaxReadinessDocumentGroup = {
  id: string
  title: string
  shortTitle: string
  detail: string
  whyNeeded: string
  bestSource: string
  required: boolean
}

export const TAX_READINESS_DOCUMENT_GROUPS: TaxReadinessDocumentGroup[] = [
  {
    id: 'tax_returns_3yr',
    title: 'Federal & State Income Tax Returns',
    shortTitle: 'Income tax returns',
    detail: 'Last 3 years - Form 1120, 1120S, 1065, or Schedule C.',
    whyNeeded: 'Confirms reported taxable income, ownership structure, tax elections, add-backs, and consistency with financial statements.',
    bestSource: 'CPA, tax preparer, accountant, or business owner records.',
    required: true,
  },
  {
    id: 'irs_941_940_3yr',
    title: 'IRS Forms 941 & 940',
    shortTitle: 'Payroll tax filings',
    detail: 'Employer quarterly payroll tax returns and annual federal unemployment returns for the last 3 years.',
    whyNeeded: 'Verifies payroll tax compliance, employee wage reporting, and potential payroll tax exposure.',
    bestSource: 'Payroll provider, bookkeeper, CPA, or IRS payroll filing portal.',
    required: true,
  },
  {
    id: 'contractor_1099_agreements',
    title: 'Forms 1099-NEC / 1099-MISC + Contractor Agreements',
    shortTitle: '1099s and contractor agreements',
    detail: 'All 1099s issued and related independent contractor agreements for the last 3 years.',
    whyNeeded: 'Helps identify contractor classification risk, recurring outside labor, and missing documentation.',
    bestSource: 'Bookkeeper, accountant, payroll provider, or accounts payable files.',
    required: true,
  },
  {
    id: 'sales_use_tax_3yr',
    title: 'State Sales & Use Tax Returns',
    shortTitle: 'Sales and use tax returns',
    detail: 'All state sales and use tax filings, schedules, and payment records for the last 3 years.',
    whyNeeded: 'Checks filing compliance, taxable sales treatment, and possible state tax liabilities.',
    bestSource: 'CPA, bookkeeper, state tax portal, or point-of-sale reporting files.',
    required: true,
  },
  {
    id: 'irs_tax_notices_3yr',
    title: 'IRS / State Tax Notices & Audit Correspondence',
    shortTitle: 'Tax notices and audit correspondence',
    detail: 'Any deficiency letters, audit notices, state notices, or correspondence received in the last 3 years.',
    whyNeeded: 'Surfaces unresolved audits, balances due, penalties, payment plans, or buyer diligence issues.',
    bestSource: 'Business owner, CPA, accountant, IRS/state portal, or mail records.',
    required: false,
  },
]

export const TAX_READINESS_REFERENCE_CONTEXT = `
Tax readiness reference for the WS1-11 Tax Liability Review:
- Required document groups: federal and state income tax returns; IRS Forms 941 and 940; Forms 1099-NEC/1099-MISC plus contractor agreements; state sales and use tax returns; IRS or state tax notices and audit correspondence where applicable.
- The review should check completeness, filing consistency, taxable income support, payroll tax compliance, contractor classification exposure, sales/use tax compliance, unresolved notices, audit history, penalties, payment plans, and buyer diligence risk.
- Best source guidance: income tax returns usually come from the CPA/tax preparer/accountant; payroll tax forms from payroll provider/bookkeeper/CPA; 1099s and contractor agreements from bookkeeper/accounts payable/payroll provider; sales tax returns from CPA/bookkeeper/state tax portal/POS records; tax notices from owner/CPA/accountant/IRS or state portal.
- If a document group is missing or incomplete, explicitly state that limitation and avoid treating absence of evidence as evidence of no tax exposure.
`.trim()

export function buildTaxReadinessReferenceHtml(clientName: string, audience: 'client' | 'advisor' = 'advisor') {
  const rows = TAX_READINESS_DOCUMENT_GROUPS.map(group => `
    <tr>
      <td><strong>${group.title}</strong><br><span>${group.detail}</span></td>
      <td>${group.whyNeeded}</td>
      <td>${group.bestSource}</td>
    </tr>
  `).join('')

  const intro = audience === 'client'
    ? 'Use this reference to gather the tax documentation needed for a Sale Readiness tax liability review.'
    : 'Use this reference to gather the tax documentation needed for a Sale Readiness tax liability review. Complete files help Cantara identify tax exposure, filing gaps, audit history, and buyer due-diligence issues before a transaction process begins.'

  const advisorNote = audience === 'client'
    ? 'If a document group is unavailable, tell your Cantara advisor whether it is not applicable, pending from the CPA/bookkeeper, or unavailable.'
    : 'If a document group is not available, note whether it is not applicable, pending from the CPA/bookkeeper, or unavailable. Missing documents should be called out in the Tax Liability Review rather than treated as evidence of no tax exposure.'

  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${clientName} - Tax Readiness Document Reference</title>
  <style>
    @page { size: Letter; margin: 0.55in; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, Arial, sans-serif; color: #0d1829; background: #fff; }
    .cover { min-height: 10in; margin: -0.55in; padding: 3.2in 0.65in 0.65in; background: #1f263b; color: #fff; text-align: center; page-break-after: always; }
    .logo { font-family: Georgia, serif; font-size: 34px; letter-spacing: 0.02em; }
    .logo-sub { margin-top: 3px; font-size: 9px; letter-spacing: 0.22em; color: #d6cfc4; }
    .eyebrow { margin-top: 46px; color: #caa15f; font-size: 13px; font-weight: 700; letter-spacing: 0.38em; }
    h1 { margin: 26px 0 12px; font-size: 42px; line-height: 1.05; color: #fff; }
    .subtitle { color: #a8b2c7; font-size: 18px; }
    .gold-line { width: 64px; height: 4px; background: #caa15f; margin: 48px auto 0; border-radius: 999px; }
    .confidential { margin-top: 84px; color: #677187; font-size: 11px; letter-spacing: 0.42em; }
    .date { margin-top: 18px; color: #677187; font-size: 12px; }
    .header { border-bottom: 2px solid #caa15f; padding-bottom: 14px; margin-bottom: 24px; }
    .header .brand { font-family: Georgia, serif; font-size: 24px; }
    .header .label { margin-top: 4px; font-size: 10px; letter-spacing: 0.24em; color: #caa15f; font-weight: 700; }
    h2 { font-size: 24px; margin: 0 0 10px; color: #0d1829; }
    p { color: #475569; line-height: 1.55; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 12px; }
    th { background: #0d1829; color: #fff; text-align: left; padding: 10px; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; }
    td { border: 1px solid #dbe3ef; padding: 11px; vertical-align: top; line-height: 1.45; color: #334155; }
    td strong { color: #0d1829; }
    td span { color: #64748b; font-size: 11px; }
    .note { margin-top: 24px; padding: 14px 16px; border-left: 4px solid #caa15f; background: #fff8ec; }
  </style>
</head>
<body>
  <section class="cover">
    <div class="logo">Cantara</div>
    <div class="logo-sub">PET BUSINESS ADVISORS</div>
    <div class="eyebrow">CANTARA</div>
    <h1>${clientName}</h1>
    <div class="subtitle">Pre-Listing Tax Readiness Reference</div>
    <div class="gold-line"></div>
    <div class="confidential">TAX DOCUMENT REFERENCE</div>
    <div class="date">${dateLabel}</div>
  </section>
  <section>
    <div class="header">
      <div class="brand">Cantara</div>
      <div class="label">PET BUSINESS ADVISORS</div>
    </div>
    <h2>Tax Document Request Guide</h2>
    <p>${intro}</p>
    <table>
      <thead><tr><th>Document Needed</th><th>Why It Matters</th><th>Best Source</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="note">
      <p><strong>Advisor note:</strong> ${advisorNote}</p>
    </div>
  </section>
</body>
</html>`
}
