// ─────────────────────────────────────────────────────────────────────────────
// WS1-6 Mock Data — Foothills Pet Resort Simulation
// ─────────────────────────────────────────────────────────────────────────────

import type { WS16Report } from '@/types/ws1-6-types'

export const foothillsReport: WS16Report = {
  clientName: 'Foothills Pet Resort LLC',
  generatedAt: new Date().toISOString(),
  hitlStatus: 'pending',

  coverageGaps: [
    {
      category: 'Retirement Plan Documents (Item 10)',
      reason: 'Not uploaded. Retirement plan handling at close cannot be assessed.',
      status: 'missing'
    },
    {
      category: 'PTO Accrual Ledger (Item 11)',
      reason: 'Not uploaded. Accrued PTO liability cannot be quantified.',
      status: 'missing'
    },
  ],

  documents: [
    {
      id: 'd1',
      filename: 'Owner_NonCompete_Agreement.pdf',
      docType: 'Non-Compete',
      partiesCovered: 'Owner / Seller',
      date: 'Mar 15, 2024',
      status: 'complete',
    },
    {
      id: 'd2',
      filename: 'OpsManager_EmploymentAgreement.pdf',
      docType: 'Employment Agreement',
      partiesCovered: 'Operations Manager',
      date: 'Jan 10, 2023',
      status: 'complete',
    },
    {
      id: 'd3',
      filename: 'Employee_Handbook_2024.pdf',
      docType: 'Handbook',
      partiesCovered: 'All Employees',
      date: 'Feb 1, 2024',
      status: 'complete',
    },
    {
      id: 'd4',
      filename: 'Benefits_Summary_2024.pdf',
      docType: 'Benefits Summary',
      partiesCovered: 'All Employees',
      date: 'Jan 1, 2024',
      status: 'complete',
    },
    {
      id: 'd5',
      filename: 'Payroll_Register_Q1_2026.xlsx',
      docType: 'Payroll Register',
      partiesCovered: '12 employees',
      date: 'Mar 31, 2026',
      status: 'complete',
    },
    {
      id: 'd6',
      filename: 'OrgChart_FPR_2026.png',
      docType: 'Org Chart',
      partiesCovered: 'All Employees',
      date: 'Undated',
      status: 'complete',
    },
    {
      id: 'd7',
      filename: 'OpsManager_OfferLetter_2023.pdf',
      docType: 'Offer Letter',
      partiesCovered: 'Operations Manager',
      date: 'Jan 3, 2023',
      status: 'incomplete',
      statusNote: 'Superseded by employment agreement',
    },
  ],

  agreements: [
    {
      role: 'Owner / Seller',
      agreementType: 'Standalone Non-Compete',
      term: 'At-will',
      hasNonCompete: true,
      hasNonSolicit: true,
      hasNDA: true,
      sourceRef: 'Owner_NonCompete §1–3',
      isKeyPerson: true,
    },
    {
      role: 'Operations Manager',
      agreementType: 'Employment Agreement',
      term: 'At-will, 30-day notice',
      hasNonCompete: false,
      hasNonSolicit: true,
      hasNDA: true,
      sourceRef: 'OpsManager_EA §7, §9',
      isKeyPerson: true,
    }
  ],

  nonCompetes: [
    {
      id: 'nc1',
      party: 'Owner / Seller',
      isCritical: true,
      sourceDoc: 'Owner_NonCompete_Agreement.pdf',
      sourceSection: '§1–3',
      geographicScope: '25-mile radius',
      duration: '24 months post-close',
      coveredActivities: ['Boarding', 'Grooming'],
      considerationNote: 'Adequate',
      stateEnforceabilityNote: 'AZ law compliant',
      flag: 'positive',
      flagExplanation: 'Standard scope'
    }
  ],

  benefits: [
    {
      benefitType: 'Health insurance',
      employerContribution: '~$200/mo',
      contractuallyBound: false,
      assetSaleTransferable: 'Unclear',
      estimatedAnnualCost: '~$28,800/yr',
      transitionComplexity: 'Medium'
    }
  ],

  contractors: [
    {
      id: 'ic-none',
      role: 'None identified',
      agreementProvided: false,
      misclassRisk: 'None Identified',
      riskFactors: [],
      flag: 'informational',
    },
  ],

  keyPeople: [
    {
      role: 'Owner / Operator',
      employmentType: 'Owner',
      hasNonCompete: true,
      hasAgreement: true,
      riskLevel: 'Medium',
      transitionNotes: 'Handles vendor relationships.',
    }
  ],

  keyPersonNarrative: 'Significant transition risk concentrated in two roles...',

  buyerSummary: {
    workforceOverview: 'Foothills Pet Resort operates with 12 employees...',
    nonCompeteProtections: 'Owner non-compete is primary protection...',
    assumedBenefitObligations: 'Health insurance ~$28,800/yr...',
    retirementAndPTO: 'Retirement plan status unknown...',
    transitionConsiderations: 'Asset sale complexity...',
    counselItems: ['Review PTO balances', 'Confirm health plan']
  }
}
