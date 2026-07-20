#!/usr/bin/env node

/**
 * Production seed: The Cactus Pet Resort complete demo engagement.
 *
 * This is a self-contained snapshot of the approved demo client. It includes:
 * - client user/profile and all sectionSubmissions JSON;
 * - 27 assigned workstream agents;
 * - six demo document metadata records and document statuses;
 * - valuation, recast, WS2-derived, lease, legal, tax, ownership,
 *   permits, employee, contract, and competitor outputs;
 * - WS1/WS2 assessments and roadmaps, buyer reports, Agent Overview;
 * - CIM, teaser, LOI comparison, and net-proceeds inputs.
 *
 * Usage:
 *   DATABASE_URL='postgresql://...' node prisma/seed-cactus-pet-resort-demo.mjs
 *
 * Or:
 *   node prisma/seed-cactus-pet-resort-demo.mjs --database-url='postgresql://...'
 *
 * Idempotency:
 * The script deletes/recreates ONLY client id "demo-cactus-pet-resort"
 * (or a profile already attached to user id "demo-cactus-owner") in one
 * transaction. All other production clients remain untouched.
 *
 * Note: ClientDocument rows contain demo metadata only; no binary files are
 * copied by this database seed.
 */

import pg from 'pg';

const { Client } = pg;
const CLIENT_ID = 'demo-cactus-pet-resort';
const USER_ID = 'demo-cactus-owner';

const SNAPSHOT = {
  "exportedAt": "2026-07-14T15:30:00.000Z",
  "user": {
    "id": "demo-cactus-owner",
    "name": "Elena Marquez (Demo)",
    "email": "demo+cactus@cantara.ai",
    "passwordHash": "CactusDemo!2026",
    "role": "CLIENT",
    "googleAccessToken": null,
    "googleRefreshToken": null,
    "googleTokenExpiry": null,
    "googleDriveRootFolderId": null,
    "googleDriveRootFolderName": null,
    "createdAt": "2026-07-14T07:14:01.954Z",
    "updatedAt": "2026-07-14T07:14:01.954Z",
    "mustChangePassword": false
  },
  "profile": {
    "id": "demo-cactus-pet-resort",
    "userId": "demo-cactus-owner",
    "businessName": "The Cactus Pet Resort",
    "businessDescription": "DEMO DATA — Single-site premium pet boarding, daycare, and grooming resort in Phoenix, Arizona.",
    "email": "demo+cactus@cantara.ai",
    "phone": "(602) 555-0148",
    "workstream": "BOTH",
    "businessType": "SINGLE",
    "stage": "FINAL",
    "driveFolderId": null,
    "notes": "DEMO DATA ONLY. Fully seeded WS1 and WS2 sample engagement. All names, documents, findings, competitors, addresses, and financial details beyond the supplied macro assumptions are illustrative.",
    "valuationDocUploaded": true,
    "provisionedAt": "2026-07-14T07:14:01.954Z",
    "lastLogin": null,
    "createdAt": "2026-07-14T07:14:01.954Z",
    "updatedAt": "2026-07-14T08:28:18.197Z",
    "sectionSubmissions": {
      "demoData": {
        "isDemo": true,
        "scenario": "The Cactus Pet Resort — completed WS1 + WS2 sample",
        "seededAt": "2026-07-14T12:44:01.954Z"
      },
      "orgChart": {
        "roles": [
          {
            "name": "Elena Marquez",
            "notes": "Controls finance, pricing, marketing, landlord and banking relationships.",
            "title": "Owner / Managing Member",
            "keyPerson": true,
            "reportsTo": "None",
            "department": "Executive",
            "transitionRisk": "high"
          },
          {
            "name": "Jordan Lee",
            "notes": "Seven years tenure; primary post-close operating leader.",
            "title": "General Manager",
            "keyPerson": true,
            "reportsTo": "Elena Marquez",
            "department": "Operations",
            "transitionRisk": "medium"
          },
          {
            "name": "Priya Shah",
            "notes": "Leads scheduling, customer recovery and daycare programming.",
            "title": "Assistant General Manager",
            "keyPerson": true,
            "reportsTo": "Jordan Lee",
            "department": "Operations",
            "transitionRisk": "medium"
          },
          {
            "name": "Mateo Ruiz",
            "notes": "Supervises nine pet-care attendants.",
            "title": "Boarding Supervisor",
            "keyPerson": false,
            "reportsTo": "Jordan Lee",
            "department": "Boarding",
            "transitionRisk": "low"
          },
          {
            "name": "Sofia Nguyen",
            "notes": "Produces approximately 58% of grooming revenue.",
            "title": "Grooming Lead",
            "keyPerson": true,
            "reportsTo": "Jordan Lee",
            "department": "Grooming",
            "transitionRisk": "medium"
          },
          {
            "name": "Avery Brooks",
            "notes": "Owns reservations, deposits, and review requests.",
            "title": "Customer Experience Lead",
            "keyPerson": false,
            "reportsTo": "Priya Shah",
            "department": "Front Desk",
            "transitionRisk": "low"
          },
          {
            "name": "Nina Patel",
            "notes": "Monthly close and payroll reconciliation.",
            "title": "Bookkeeper (part-time)",
            "keyPerson": true,
            "reportsTo": "Elena Marquez",
            "department": "Finance",
            "transitionRisk": "medium"
          },
          {
            "name": "Front Desk Team (3)",
            "notes": "Cross-trained on reservations and retail.",
            "title": "Client Service Representatives",
            "keyPerson": false,
            "reportsTo": "Avery Brooks",
            "department": "Front Desk",
            "transitionRisk": "low"
          },
          {
            "name": "Pet Care Team (9)",
            "notes": "Coverage includes overnight and holiday rotations.",
            "title": "Attendants / Daycare Counselors",
            "keyPerson": false,
            "reportsTo": "Mateo Ruiz",
            "department": "Operations",
            "transitionRisk": "low"
          },
          {
            "name": "Grooming Team (3)",
            "notes": "One groomer operates under a contractor arrangement requiring review.",
            "title": "Groomers / Bathers",
            "keyPerson": false,
            "reportsTo": "Sofia Nguyen",
            "department": "Grooming",
            "transitionRisk": "medium"
          }
        ],
        "summary": "The resort has a capable on-site operating team with clear frontline reporting, but finance, pricing, marketing, and key vendor relationships remain concentrated with owner Elena Marquez. GM Jordan Lee can run daily operations independently; a documented delegation and retention plan is required before sale launch.",
        "roleGaps": [
          "No dedicated finance/controller role; owner and part-time bookkeeper split close responsibilities.",
          "No documented facilities/maintenance owner despite a leased, high-use facility.",
          "Marketing ownership is not transferred to management.",
          "No designated compliance owner for permits, OSHA logs and incident reporting."
        ],
        "generatedAt": "2026-07-14T13:30:00.000Z",
        "totalHeadcount": 24,
        "recommendations": [
          "Execute a 12-month GM retention agreement with transaction bonus.",
          "Move pricing approval and vendor authority to GM before buyer management meetings.",
          "Create responsibility matrix and recurring KPI cadence.",
          "Cross-train AGM on payroll approval, landlord communication and customer escalations.",
          "Create succession coverage for grooming lead and bookkeeper."
        ],
        "transitionReadiness": "medium",
        "keyPersonDependencies": [
          {
            "risk": "Pricing, banking, landlord, vendor and marketing decisions lack written delegation.",
            "title": "Owner",
            "person": "Elena Marquez",
            "mitigation": "Transfer authority to GM, document SOPs, and retain owner for six months."
          },
          {
            "risk": "Daily operations and customer escalation knowledge concentrated in one leader.",
            "title": "General Manager",
            "person": "Jordan Lee",
            "mitigation": "Execute retention agreement and cross-train AGM."
          },
          {
            "risk": "Majority of grooming revenue tied to one technician.",
            "title": "Grooming Lead",
            "person": "Sofia Nguyen",
            "mitigation": "Document client preferences and recruit or cross-train a second senior groomer."
          }
        ]
      },
      "loiReview": {
        "inputs": {
          "documentNames": [
            "LOI_Desert_Paws_Strategic.pdf",
            "LOI_Sonoran_Pet_Holdings.pdf",
            "LOI_Mesa_Companion_Care.pdf"
          ]
        },
        "markdown": "# The Cactus Pet Resort — LOI Review & Comparison\n\n**Review date:** July 14, 2026  \n**Seller:** Cactus Pet Resort LLC  \n**Illustrative offers reviewed:** 3  \n**Valuation reference:** $2.70 million midpoint / $450,000 normalized EBITDA  \n**Recommendation:** Advance Desert Paws Strategic Partners; retain Sonoran Pet Holdings as a credible alternative.\n\n## Executive Recommendation\n\nDesert Paws Strategic Partners provides the strongest risk-adjusted proposal: $2.95 million headline value, $2.75 million cash at closing, $200,000 rollover equity, committed corporate funding, 45-day closing, 30-day exclusivity, and the lowest escrow burden. Its strategic operating experience and willingness to retain the GM improve execution certainty.\n\nSonoran Pet Holdings offers the cleanest all-cash structure and no contingent consideration, but its $2.85 million price is $100,000 below Desert Paws and it requests 45 days of exclusivity plus a broader financing cooperation covenant. It should remain active as leverage and a backup.\n\nMesa Companion Care presents the highest headline value at $3.05 million, but $600,000 is deferred through a seller note and earnout, its financing is not committed, escrow is larger, and exclusivity is longer. On probability-adjusted value and closing certainty, it ranks third unless materially improved.\n\n## 1. LOI Summary Table\n\n| Dimension | Desert Paws Strategic Partners | Sonoran Pet Holdings | Mesa Companion Care |\n|---|---|---|---|\n| Headline Purchase Price | $2.95M | $2.85M | $3.05M |\n| Cash at Closing | $2.75M before adjustments | $2.85M before adjustments | $2.45M before adjustments |\n| Deferred / Rollover | $200K rollover equity | None | $300K seller note + up to $300K earnout |\n| Deal Structure | Asset purchase | Asset purchase | Asset purchase |\n| Working Capital | $100K peg; dollar-for-dollar true-up | Normalized NWC; peg after diligence | $125K peg; buyer-controlled calculation |\n| Escrow / Holdback | 4% ($118K), 12 months | 5% ($142.5K), 18 months | 8% ($244K), 24 months |\n| Earnout | None | None | $300K over 24 months; revenue and EBITDA hurdles |\n| Financing | Committed corporate balance sheet; proof provided | Bank term sheet plus 35% equity commitment | Financing contingency; lender diligence incomplete |\n| Diligence | 30 days | 40 days | 60 days |\n| Closing | 45 days after exclusivity | 60 days after exclusivity | 75 days after exclusivity |\n| Closing Conditions | Landlord consent, lien release, permits, key employees | Landlord consent, financing, lien release, permits | Financing, lease, QoE, employment, customer retention |\n| Exclusivity | 30 days; one 10-day extension by consent | 45 days; automatic 15-day extension if drafts exchanged | 75 days; buyer may extend 15 days |\n| Buyer Type | Strategic pet-care operator | Independent sponsor / operator-backed | Search-fund platform |\n| Management Plan | Retain GM; seller 6-month transition | Retain GM; seller 9-month transition | Seller 12-month consulting; GM subject to assessment |\n| Non-Compete | 5 years / 50 miles | 5 years / Arizona | 7 years / Southwest U.S. |\n| Overall Read | Strongest risk-adjusted | Clean structure / credible backup | Highest headline, weakest certainty |\n\n## Economic Comparison\n\n| Economic Item | Desert Paws | Sonoran | Mesa |\n|---|---:|---:|---:|\n| Headline Value | $2,950,000 | $2,850,000 | $3,050,000 |\n| Cash at Close | $2,750,000 | $2,850,000 | $2,450,000 |\n| Escrow | ($118,000) | ($142,500) | ($244,000) |\n| Seller Note | — | — | $300,000 |\n| Earnout | — | — | Up to $300,000 |\n| Rollover | $200,000 | — | — |\n| Probability-Adjusted Earnout | — | — | $135,000 at 45% |\n| Illustrative Risk-Adjusted Value | $2,950,000 | $2,850,000 | $2,885,000 |\n| Cash Certainty | High | High/medium | Medium/low |\n\nRisk-adjusted value is illustrative and excludes tax, working-capital, debt, transaction costs, and time value. Rollover value remains investment risk; earnout value depends on buyer-controlled operations and defined accounting.\n\n## 2. Flag Summary\n\n| LOI | Flag | Dimension | Severity | Description | Recommended Action |\n|---|---|---|---|---|---|\n| Desert Paws | Rollover liquidity | Consideration | Negotiation | $200K is illiquid minority equity | Require same-class economics, information rights, drag/tag, transfer and exit protections |\n| Desert Paws | Working-capital definition | NWC | Negotiation | $100K peg stated but inclusions incomplete | Attach sample calculation and exclude cash, debt, deferred revenue and seller expenses |\n| Desert Paws | Lease/permit conditions | Closing | Informational | Conditions match known diligence items | Tie to objective delivery and prevent discretionary satisfaction |\n| Desert Paws | GM retention | Management | Positive | Buyer intends to retain GM | Agree economics and communications before exclusivity |\n| Sonoran | Financing cooperation | Financing | Negotiation | Seller obligations are broad | Limit to reasonable cooperation at buyer cost without seller liability |\n| Sonoran | Exclusivity extension | Exclusivity | Deal-Risk | Automatic extension could create 60-day lockup | Delete automatic extension; require milestone-based seller consent |\n| Sonoran | 18-month escrow | Holdback | Negotiation | Longer than preferred | Counter at 3% for 12 months with early release |\n| Sonoran | Lower value | Price | Negotiation | $100K below Desert Paws | Request $2.95M or improved escrow/closing terms |\n| Mesa | Financing contingency | Financing | Deal-Risk | Funding uncommitted | Require commitment letter and reverse termination remedy |\n| Mesa | Earnout control | Earnout | Deal-Risk | Buyer controls operations and accounting | Replace with cash or objective revenue-only metric and covenants |\n| Mesa | 75–90 day exclusivity | Exclusivity | Deal-Risk | Excessive seller lockup | Reduce to 35 days with milestones and automatic termination |\n| Mesa | 7-year regional non-compete | Restrictive covenant | Deal-Risk | Overbroad duration and territory | Counter at 5 years / 50 miles / pet-care services |\n| Mesa | 8% / 24-month escrow | Holdback | Negotiation | Material amount and duration | Counter at 4% / 12 months |\n| Mesa | $125K NWC peg | NWC | Negotiation | Above illustrative normalized level | Use trailing three-month average and agreed schedule |\n\n## 3. Negotiation Priorities\n\n### Desert Paws Strategic Partners\n\n1. **Rollover protections — must resolve.** Require the same economic class as sponsor capital, no management-fee leakage, quarterly reporting, preemptive rights, tag-along, customary drag, and clear exit treatment.\n2. **Working-capital schedule — must resolve.** Fix the $100K target only after attaching a sample balance sheet and accounting principles.\n3. **Escrow — should improve.** Counter from 4% / 12 months to 3% / 12 months, with earlier release for resolved matters.\n4. **Closing conditions — should clarify.** Conditions should be objective and satisfied by delivery of the landlord, lien, and permit evidence described in the data room.\n5. **Employee communications — process item.** No contact before a jointly approved plan.\n\n**Suggested counter:** preserve $2.95M value and 45-day close; accept $200K rollover only with governance protections; 3% escrow; 30-day exclusivity; no financing condition.\n\n### Sonoran Pet Holdings\n\n1. **Price — must improve.** Counter at $2.95M based on competing value and clean normalization.\n2. **Automatic exclusivity extension — must delete.** Any extension requires seller consent and unmet buyer milestones should terminate exclusivity.\n3. **Funding certainty — must confirm.** Deliver executed lender commitment and equity proof within five business days.\n4. **Escrow — should improve.** Counter at 3% / 12 months.\n5. **Transition — should narrow.** Reduce seller support from nine to six months with defined hours and compensation.\n\n**Suggested counter:** $2.95M all cash, no financing out after commitment delivery, 35-day exclusivity, 3% / 12-month escrow, 50-day closing.\n\n### Mesa Companion Care\n\n1. **Financing contingency — must eliminate or heavily limit.**\n2. **Earnout — replace with cash or secured seller note; otherwise use objective revenue-only metric with operating covenants.**\n3. **Exclusivity — reduce from 75–90 days to 35 days with weekly milestones.**\n4. **Escrow — reduce from 8% / 24 months to 4% / 12 months.**\n5. **Non-compete — reduce to 5 years / 50 miles and pet-care activities only.**\n6. **NWC — use a mutually agreed trailing three-month average and attached example.**\n7. **GM condition — remove discretionary employment condition or limit to good-faith offer on agreed terms.**\n\n**Suggested counter:** at least $2.75M cash at close, maximum $300K secured seller note, no earnout, committed financing, 35-day exclusivity, 4% escrow, 60-day close.\n\n## 4. Recommendation\n\n### Rank 1 — Desert Paws Strategic Partners\n\nAdvance to final counter and confirmatory diligence. It provides the best combination of price, cash certainty, timing, operator credibility, management continuity, and limited conditionality. Rollover rights and working-capital definitions require careful drafting, but both are negotiable.\n\n### Rank 2 — Sonoran Pet Holdings\n\nKeep active through final-round clarification. The all-cash, no-earnout structure is attractive and could become the preferred offer if price increases, funding is fully committed, and exclusivity/escrow terms improve.\n\n### Rank 3 — Mesa Companion Care\n\nDo not grant exclusivity on current terms. The headline price overstates economic certainty because $600K is deferred, financing is conditional, escrow is large, and the process is long. Re-engage only if Mesa converts deferred value to cash or a secured note and materially improves closing terms.\n\n## 5. Missing Terms\n\n| LOI | Missing / Ambiguous Term | Risk | Required Clarification |\n|---|---|---|---|\n| Desert Paws | Rollover governing documents | Minority investment risk | Attach term sheet and investor rights |\n| Desert Paws | Indemnity cap/basket | Post-close exposure unclear | Include market cap, basket and survival |\n| Desert Paws | Tax allocation | Seller tax impact | Attach Section 1060 allocation methodology |\n| Sonoran | Reverse termination remedy | Financing failure | Add deposit or expense reimbursement |\n| Sonoran | Employee treatment | Retention uncertainty | Provide roles, benefits and communication plan |\n| Sonoran | IP/data transfer | Operational handoff | Define domains, data, consents and credentials |\n| Mesa | Earnout accounting policies | Buyer control risk | Objective definitions, covenants and dispute mechanism |\n| Mesa | Seller-note security | Credit risk | Subordination, collateral, interest and acceleration |\n| Mesa | QoE scope/cost | Process expansion | Define scope and buyer-paid cost |\n| All | Working-capital example | Purchase-price ambiguity | Attach sample calculation |\n| All | R&W insurance / indemnity | Risk allocation | State intended approach |\n| All | Lease failure treatment | Closing uncertainty | Define extension/termination rights |\n\n## Preferred Counterproposal Framework\n\n- **Enterprise value:** $2.95 million.\n- **Cash at closing:** at least $2.75 million before ordinary adjustments.\n- **Deferred consideration:** maximum $200,000 rollover with negotiated protections; no earnout.\n- **Working capital:** $100,000 illustrative target, subject to agreed trailing-three-month calculation.\n- **Escrow:** 3% for 12 months, with targeted escrow only for quantified unresolved matters.\n- **Financing:** no financing contingency after delivery of commitment/proof.\n- **Diligence:** 30 days.\n- **Exclusivity:** 30 days with milestones; extension only by seller consent.\n- **Closing:** within 45 days after exclusivity.\n- **Non-compete:** 5 years / 50 miles / directly competitive pet-care services.\n- **Transition:** six months, defined hours, expense reimbursement, additional time compensated.\n- **Employees:** GM retention and employee communications pursuant to agreed plan.\n\n## Seller Decision Checklist\n\n- Confirm buyer proof of funds and source of equity.\n- Compare after-tax value using the Net Proceeds Calculator.\n- Validate rollover documents before accepting headline value.\n- Attach working-capital example before exclusivity.\n- Resolve landlord consent path and buyer qualification package.\n- Define lien payoff, escrow, PTO, tax, and contractor treatment.\n- Obtain final offers in executable mark-up form.\n- Avoid overlapping automatic extensions.\n- Preserve confidentiality and employee/customer communication controls.\n\n## Conclusion\n\nDesert Paws is the recommended counterparty because it combines a premium to the valuation midpoint with committed funding, strategic operating credibility, a short process, and limited contingent value. Sonoran remains a valuable all-cash alternative. Mesa requires a structural rewrite before it should receive exclusivity.\n",
        "updatedAt": "2026-07-14T15:00:00.000Z",
        "clientName": "The Cactus Pet Resort",
        "generatedAt": "2026-07-14T15:00:00.000Z",
        "offersReviewed": 3,
        "recommendedBuyer": "Desert Paws Strategic Partners"
      },
      "valuation": {
        "report": "# Valuation Report — The Cactus Pet Resort\n\n## Executive Conclusion\n\nThe Cactus Pet Resort is a profitable, single-site pet boarding and daycare operation in Phoenix, Arizona. Based on trailing-twelve-month revenue of **$1,700,000** and normalized EBITDA of **$450,000**, the indicated enterprise value range is **$2,250,000 to $3,150,000**. The selected midpoint is **$2,700,000**, equal to **6.0x normalized EBITDA**.\n\n| Metric | Amount |\n|---|---:|\n| Revenue | $1,700,000 |\n| Reported EBITDA | $392,000 |\n| Normalizing add-backs | $58,000 |\n| Normalized EBITDA | $450,000 |\n| Normalized EBITDA margin | 26.5% |\n| Low value — 5.0x | $2,250,000 |\n| Midpoint — 6.0x | $2,700,000 |\n| High value — 7.0x | $3,150,000 |\n\n## EBITDA Normalization\n\n| Adjustment | Amount | Treatment |\n|---|---:|---|\n| Owner vehicle and discretionary travel | $21,000 | Add back |\n| One-time kennel resurfacing project | $24,000 | Add back |\n| Non-recurring legal and accounting work | $13,000 | Add back |\n| **Total adjustments** | **$58,000** | |\n\nThe add-backs appear supportable for a preliminary indication but should be tied to invoices and the general ledger before buyer circulation.\n\n## Value Drivers\n\n- 4.9 Google rating across 214 reviews supports premium positioning and repeat demand.\n- 26.5% normalized EBITDA margin is attractive for a single-site pet services business.\n- Boarding, daycare, and grooming provide a diversified service mix.\n- Pricing and weekday utilization offer identifiable upside without a major facility expansion.\n\n## Key Valuation Risks\n\n1. Lease transfer consent and remaining term may constrain buyer financing.\n2. An equipment-related UCC filing must be paid and released at closing.\n3. Owner dependency and GM retention require a documented transition plan.\n4. Permit and zoning records need reconciliation before marketing.\n5. Occupancy reporting is manual and current prices trail the local sample.\n\n## Conclusion\n\nThe **$2.70 million midpoint** is reasonable for planning purposes, subject to confirmatory financial diligence, lease resolution, lien payoff, permit verification, and evidence that normalized EBITDA is sustainable after the owner's transition.",
        "revenue": 1700000,
        "generatedAt": "2026-07-14T12:44:01.954Z",
        "multipleLow": 5,
        "multipleMid": 6,
        "multipleHigh": 7,
        "valuationLow": 2250000,
        "valuationMid": 2700000,
        "valuationHigh": 3150000,
        "reportedEbitda": 392000,
        "normalizedEbitda": 450000
      },
      "ws1Roadmap": {
        "markdown": "# Sales Readiness Roadmap\n## Workstream 1 — Risk Mitigation\n\n## Dear Cactus Pet Resort Team,\n\nThe business has a valuable operating foundation: attractive earnings, a loyal customer base, and an experienced site team. Before entering the market, focus on the small number of legal and transition items that could otherwise slow closing.\n\nThe roadmap below is designed as a practical 90-day preparation plan. Complete the red actions first, then use the yellow actions to improve buyer confidence and reduce diligence friction.\n\n## Sale-Readiness Overview\n\n| Category | Status | Summary | Impact on Deal |\n|---|---|---|---|\n| Lease & Real Estate | 🔴 RED | Consent and extended term unresolved | Could delay financing and closing |\n| Litigation & Liens | 🔴 RED | Equipment UCC requires payoff | Closing deliverable and payoff risk |\n| Permits & Zoning | 🔴 RED | Permit name and outdoor-use evidence need correction | Buyer may question continuity |\n| Key Person Dependencies | 🔴 RED | Owner transition and GM retention not documented | Buyer may request holdback or longer transition |\n| Ownership & Entity | 🟡 YELLOW | Ownership is clear; routine certificates needed | Normal curable diligence |\n\n## Sale-Readiness Checklist\n\n| ✅ | Category | Item | Status | Action Needed |\n|---|---|---|---|---|\n| ☐ | Legal & Corporate Standing | Current good-standing certificate | 🟡 YELLOW | Order within 30 days of diligence launch. |\n| ☐ | Legal & Corporate Standing | Member transaction authorization | 🟡 YELLOW | Prepare written member consent. |\n| ☐ | Ownership & Transfer Readiness | Ownership schedule | 🟢 GREEN | Maintain current certified copy. |\n| ☐ | Litigation & Liens | Equipment UCC payoff and termination | 🔴 RED | Obtain payoff letter and closing UCC-3 commitment. |\n| ☐ | Litigation & Liens | Material litigation search | 🟢 GREEN | Refresh immediately before closing. |\n| ☐ | Lease & Real Estate | Landlord consent and extended site control | 🔴 RED | Negotiate consent, extension, and guaranty release. |\n| ☐ | Permits & Zoning | Kennel permit legal-name correction | 🔴 RED | Amend permit and calendar renewal. |\n| ☐ | Permits & Zoning | Outdoor-use zoning confirmation | 🔴 RED | Obtain written city confirmation. |\n| ☐ | Key Person Dependencies | GM retention agreement | 🔴 RED | Agree market adjustment and transaction retention bonus. |\n| ☐ | Key Person Dependencies | Owner responsibility transfer SOPs | 🟡 YELLOW | Document finance, pricing, marketing, and vendor routines. |\n| ☐ | Employment & HR | Current compensation roster | 🟢 GREEN | Reconcile quarterly to payroll. |\n| ☐ | Employment & HR | Six-month owner transition plan | 🟡 YELLOW | Attach scope and milestones to deal plan. |\n\n## Red Flag Action Items\n\n**Lease & Real Estate — Transfer and Site Control** 🔴 RED\n- **What**: Obtain consent, an extension, and seller guaranty release.\n- **Why**: The facility is essential to cash flow.\n- **Impact on Deal**: Financing or closing could be delayed.\n- **How**: Deliver buyer criteria to the landlord and negotiate a term sheet.\n- **Owner**: Seller, landlord, and real-estate counsel.\n\n**Litigation & Liens — Equipment UCC** 🔴 RED\n- **What**: Obtain payoff and UCC-3 termination.\n- **Why**: Buyer needs clear title to operating assets.\n- **Impact on Deal**: Closing funds will be held until release mechanics are certain.\n- **How**: Confirm balance, payoff wiring, and filing responsibility.\n- **Owner**: Seller, lender, and transaction counsel.\n\n**Permits & Zoning — Record Reconciliation** 🔴 RED\n- **What**: Correct the kennel permit and confirm outdoor use.\n- **Why**: Buyer needs uninterrupted legal operation.\n- **Impact on Deal**: Could trigger a closing condition or special indemnity.\n- **How**: File the DBA correction and request a zoning letter.\n- **Owner**: Seller, permit consultant, and counsel.\n\n**Key Person Dependencies — Transition Coverage** 🔴 RED\n- **What**: Retain the GM and transfer owner-controlled responsibilities.\n- **Why**: Operating continuity drives value.\n- **Impact on Deal**: Buyer may require a longer transition or holdback.\n- **How**: Sign retention terms, delegate authority, and document SOPs.\n- **Owner**: Seller and employment counsel.\n\n## 30 / 60 / 90 Day Plan\n\n| Timing | Priority | Evidence of Completion |\n|---|---|---|\n| Days 1–30 | Resolve red-item ownership and launch work | Signed engagement/term sheets and baseline KPI pack |\n| Days 31–60 | Complete third-party actions and operating tests | Landlord/municipal evidence or pricing/capacity results |\n| Days 61–90 | Refresh reports and assemble buyer-ready folder | Final approvals, reconciliations, and management summary |\n\n## Closing Guidance\n\nKeep each completed action with source evidence in the data room. The goal is not merely to mark tasks complete; it is to make the buyer's verification fast and repeatable.",
        "checklist": [
          {
            "id": "ws1-entity",
            "item": "Current good-standing certificate",
            "status": "🟡 YELLOW",
            "category": "Legal & Corporate Standing",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Order within 30 days of diligence launch.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-authority",
            "item": "Member transaction authorization",
            "status": "🟡 YELLOW",
            "category": "Legal & Corporate Standing",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Prepare written member consent.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-ownership",
            "item": "Ownership schedule",
            "status": "🟢 GREEN",
            "category": "Ownership & Transfer Readiness",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Maintain current certified copy.",
            "advisorApproved": true,
            "clientCompleted": true,
            "clientCompletedAt": "2026-07-14T12:44:01.954Z"
          },
          {
            "id": "ws1-ucc",
            "item": "Equipment UCC payoff and termination",
            "status": "🔴 RED",
            "category": "Litigation & Liens",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Obtain payoff letter and closing UCC-3 commitment.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-litigation",
            "item": "Material litigation search",
            "status": "🟢 GREEN",
            "category": "Litigation & Liens",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Refresh immediately before closing.",
            "advisorApproved": true,
            "clientCompleted": true,
            "clientCompletedAt": "2026-07-14T12:44:01.954Z"
          },
          {
            "id": "ws1-lease",
            "item": "Landlord consent and extended site control",
            "status": "🔴 RED",
            "category": "Lease & Real Estate",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Negotiate consent, extension, and guaranty release.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-permit",
            "item": "Kennel permit legal-name correction",
            "status": "🔴 RED",
            "category": "Permits & Zoning",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Amend permit and calendar renewal.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-zoning",
            "item": "Outdoor-use zoning confirmation",
            "status": "🔴 RED",
            "category": "Permits & Zoning",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Obtain written city confirmation.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-gm",
            "item": "GM retention agreement",
            "status": "🔴 RED",
            "category": "Key Person Dependencies",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Agree market adjustment and transaction retention bonus.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-sop",
            "item": "Owner responsibility transfer SOPs",
            "status": "🟡 YELLOW",
            "category": "Key Person Dependencies",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Document finance, pricing, marketing, and vendor routines.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-staff",
            "item": "Current compensation roster",
            "status": "🟢 GREEN",
            "category": "Employment & HR",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Reconcile quarterly to payroll.",
            "advisorApproved": true,
            "clientCompleted": true,
            "clientCompletedAt": "2026-07-14T12:44:01.954Z"
          },
          {
            "id": "ws1-transition",
            "item": "Six-month owner transition plan",
            "status": "🟡 YELLOW",
            "category": "Employment & HR",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Attach scope and milestones to deal plan.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          }
        ],
        "clientName": "The Cactus Pet Resort",
        "workstream": "ws1",
        "generatedAt": "2026-07-14T12:44:01.954Z",
        "workstreamLabel": "Workstream 1 — Risk Mitigation"
      },
      "ws2Roadmap": {
        "markdown": "# Sales Readiness Roadmap\n## Workstream 2 — Profitability & Growth\n\n## Dear Cactus Pet Resort Team,\n\nThe business has a valuable operating foundation: attractive earnings, a loyal customer base, and an experienced site team. The main opportunity is to convert premium reputation into measurable pricing and capacity performance.\n\nThe roadmap below is designed as a practical 90-day preparation plan. Complete the red actions first, then use the yellow actions to improve buyer confidence and reduce diligence friction.\n\n## Sale-Readiness Overview\n\n| Category | Status | Summary | Impact on Deal |\n|---|---|---|---|\n| Revenue & Profitability | 🟢 GREEN | Strong margin and supportable normalization | Positive buyer signal |\n| Competitive Positioning | 🟢 GREEN | Market-leading illustrative reputation | Supports premium positioning |\n| Pricing Strategy | 🔴 RED | Rates trail peer sample | Buyer may discount unproven upside |\n| Facility & Operations | 🔴 RED | Daily occupancy and denial data unavailable | Weakens growth validation |\n| Growth Trajectory | 🟡 YELLOW | Membership and bundle opportunities identified | Upside needs execution evidence |\n\n## Sale-Readiness Checklist\n\n| ✅ | Category | Item | Status | Action Needed |\n|---|---|---|---|---|\n| ☐ | Revenue & Profitability | Revenue and EBITDA bridge | 🟢 GREEN | Maintain monthly close and add-back support. |\n| ☐ | Pricing Strategy | Core rate reset | 🔴 RED | Phase boarding and daycare increases and monitor churn. |\n| ☐ | Pricing Strategy | Peak and holiday pricing calendar | 🔴 RED | Publish calendar and minimum-stay rules. |\n| ☐ | Facility & Operations | Daily occupancy and denial reporting | 🔴 RED | Configure daily capacity dashboard by vertical. |\n| ☐ | Growth Trajectory | Weekday daycare membership | 🟡 YELLOW | Pilot capped recurring plans. |\n| ☐ | Competitive Positioning | Review score and volume | 🟢 GREEN | Continue automated review requests. |\n| ☐ | Pricing Strategy | Boarding tier architecture | 🟡 YELLOW | Define standard, premium, and suite packages. |\n| ☐ | Customer Concentration | Trade-area mapping | 🟢 GREEN | Refresh customer pins quarterly. |\n| ☐ | Revenue & Profitability | Monthly KPI pack | 🟡 YELLOW | Reconcile revenue, occupancy, labor, and RevPAU. |\n| ☐ | Growth Trajectory | Departure-day grooming bundle | 🟡 YELLOW | Pilot bundle and measure attachment rate. |\n\n## Red Flag Action Items\n\n**Pricing Strategy — Core Rate Gap** 🔴 RED\n- **What**: Phase market-supported increases for boarding and daycare.\n- **Why**: Premium reputation is not reflected in current prices.\n- **Impact on Deal**: Buyer may not credit upside without evidence.\n- **How**: Test cohorts, monitor churn, and publish peak rules.\n- **Owner**: GM and seller.\n\n**Facility & Operations — Capacity Reporting** 🔴 RED\n- **What**: Build daily occupancy, denial, cancellation, and RevPAU reporting.\n- **Why**: Monthly spreadsheets obscure peak constraints and weekday slack.\n- **Impact on Deal**: Buyer may discount the growth thesis.\n- **How**: Configure booking-system exports and reconcile them monthly.\n- **Owner**: GM, bookkeeper, and system administrator.\n\n## 30 / 60 / 90 Day Plan\n\n| Timing | Priority | Evidence of Completion |\n|---|---|---|\n| Days 1–30 | Resolve red-item ownership and launch work | Signed engagement/term sheets and baseline KPI pack |\n| Days 31–60 | Complete third-party actions and operating tests | Landlord/municipal evidence or pricing/capacity results |\n| Days 61–90 | Refresh reports and assemble buyer-ready folder | Final approvals, reconciliations, and management summary |\n\n## Closing Guidance\n\nKeep each completed action with source evidence in the data room. The goal is not merely to mark tasks complete; it is to make the buyer's verification fast and repeatable.",
        "checklist": [
          {
            "id": "ws2-financials",
            "item": "Revenue and EBITDA bridge",
            "status": "🟢 GREEN",
            "category": "Revenue & Profitability",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Maintain monthly close and add-back support.",
            "advisorApproved": true,
            "clientCompleted": true,
            "clientCompletedAt": "2026-07-14T12:44:01.954Z"
          },
          {
            "id": "ws2-pricing",
            "item": "Core rate reset",
            "status": "🔴 RED",
            "category": "Pricing Strategy",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Phase boarding and daycare increases and monitor churn.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws2-peak",
            "item": "Peak and holiday pricing calendar",
            "status": "🔴 RED",
            "category": "Pricing Strategy",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Publish calendar and minimum-stay rules.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws2-capacity",
            "item": "Daily occupancy and denial reporting",
            "status": "🔴 RED",
            "category": "Facility & Operations",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Configure daily capacity dashboard by vertical.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws2-membership",
            "item": "Weekday daycare membership",
            "status": "🟡 YELLOW",
            "category": "Growth Trajectory",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Pilot capped recurring plans.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws2-reputation",
            "item": "Review score and volume",
            "status": "🟢 GREEN",
            "category": "Competitive Positioning",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Continue automated review requests.",
            "advisorApproved": true,
            "clientCompleted": true,
            "clientCompletedAt": "2026-07-14T12:44:01.954Z"
          },
          {
            "id": "ws2-tiers",
            "item": "Boarding tier architecture",
            "status": "🟡 YELLOW",
            "category": "Pricing Strategy",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Define standard, premium, and suite packages.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws2-tradearea",
            "item": "Trade-area mapping",
            "status": "🟢 GREEN",
            "category": "Customer Concentration",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Refresh customer pins quarterly.",
            "advisorApproved": true,
            "clientCompleted": true,
            "clientCompletedAt": "2026-07-14T12:44:01.954Z"
          },
          {
            "id": "ws2-kpis",
            "item": "Monthly KPI pack",
            "status": "🟡 YELLOW",
            "category": "Revenue & Profitability",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Reconcile revenue, occupancy, labor, and RevPAU.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws2-groom",
            "item": "Departure-day grooming bundle",
            "status": "🟡 YELLOW",
            "category": "Growth Trajectory",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Pilot bundle and measure attachment rate.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          }
        ],
        "clientName": "The Cactus Pet Resort",
        "workstream": "ws2",
        "generatedAt": "2026-07-14T12:44:01.954Z",
        "workstreamLabel": "Workstream 2 — Profitability & Growth"
      },
      "netProceeds": {
        "earnout": "0",
        "legalFees": "65000",
        "accounting": "22000",
        "otherCosts": [
          {
            "id": "cost-readiness",
            "amount": "25000",
            "description": "Lease, permit, diligence and closing preparation"
          },
          {
            "id": "cost-data",
            "amount": "7500",
            "description": "Data-room, technology transfer and records closeout"
          }
        ],
        "sellerNote": "0",
        "advisoryFee": "147500",
        "stateTaxMode": "percent",
        "stateTaxRate": "4.5",
        "monthsToClose": "3",
        "escrowHoldback": "118000",
        "federalTaxMode": "percent",
        "federalTaxRate": "20",
        "rolloverEquity": "200000",
        "debtInstruments": [
          {
            "id": "debt-equipment",
            "description": "Desert Veterinary Equipment Finance — estimated equipment payoff",
            "currentBalance": "195000",
            "avgMonthlyPayment": "3000"
          }
        ],
        "deferredRevenue": "32000",
        "managementBonuses": "35000",
        "sellerObligations": [
          {
            "id": "obligation-pto",
            "amount": "34680",
            "description": "Accrued employee PTO / wage obligation"
          },
          {
            "id": "obligation-tax",
            "amount": "30000",
            "description": "Illustrative TPT and contractor resolution reserve"
          }
        ],
        "enterpriseValuation": "2950000",
        "payrollTaxOnBonuses": "2700",
        "actualWorkingCapital": "125000",
        "targetWorkingCapital": "100000",
        "estimatedCashAtClosing": "90000",
        "otherDeferredConsideration": "0"
      },
      "ws1Assessment": {
        "markdown": "# Workstream 1 — Risk Mitigation Assessment Report\n\n## Executive Summary\n\nThe Cactus Pet Resort has a clean single-entity ownership structure, a strong operating team, and no identified material lawsuit or judgment in this illustrative review. The workstream is not yet sale-ready because four connected issues can disrupt transfer: the lease requires consent and offers limited remaining site control, an equipment UCC filing remains active, permit records need reconciliation, and critical commercial responsibilities remain concentrated with the owner.\n\nThese risks are curable and should not prevent a transaction if addressed before buyer outreach. The recommended deal posture is to complete landlord and municipal work first, retain the GM, and make the UCC payoff a defined closing deliverable.\n\n## Risk Heat Map\n\n| Category | Risk Level | Key Finding | Impact on Deal |\n|---|---|---|---|\n| Lease | High | Consent, guaranty release, and term extension unresolved | Financing or closing delay |\n| Litigation & Liens | High | $186,000 illustrative equipment UCC filing | Must be paid and released at closing |\n| Permits & Zoning | High | Kennel permit DBA and outdoor-use evidence need correction | Operational continuity concern |\n| Owner & GM | High | Owner controls finance, pricing, marketing, and key relationships | Buyer may require transition escrow or longer consulting |\n| Ownership | Low | Sole ownership is consistent | Straightforward authorization |\n| Entity Standing | Low | Active entity; routine certificates needed | Normal diligence item |\n| Staffing & Compensation | Medium | GM compensation and retention are not aligned | Continuity and retention risk |\n| Location | Low | Dense north-Phoenix customer trade area | Supports demand thesis |\n\n## Cross-Agent Risk Correlations\n\nThe lease and permit issues both relate to continuity at the same leased facility, so they should be resolved as one property-readiness project. The owner-dependency finding compounds the GM compensation gap: the buyer cannot rely on the owner exiting quickly unless the GM receives authority and retention protection. The UCC filing appears limited to equipment, but its payoff should be coordinated with ownership and closing counsel.\n\n## Recommendations for the Deal Team\n\n1. Complete landlord consent and extension discussions before confidential marketing.\n2. Obtain permit corrections and written zoning confirmation within 45 days.\n3. Secure a lender payoff letter and UCC-3 termination commitment.\n4. Execute GM retention and a six-month owner transition plan.\n5. Refresh good-standing, DBA, lien, and litigation searches immediately before closing.\n\n## Overall Readiness\n\n**🔴 RED — Several curable pre-market items require coordinated legal and operating action.**",
        "workstream": "ws1",
        "generatedAt": "2026-07-14T12:44:01.954Z"
      },
      "ws2Assessment": {
        "markdown": "# Workstream 2 — Profitability & Growth Assessment Report\n\n## Executive Summary\n\nThe Cactus Pet Resort combines strong profitability, a 4.9-star reputation, and a defensible north-Phoenix trade area. Revenue of $1.7 million and normalized EBITDA of $450,000 provide a sound base. The central growth finding is that the business has premium customer sentiment but mid-market prices and incomplete daily capacity data.\n\nThe illustrative competitor set shows core boarding, daycare, and grooming prices generally 8%–15% below peers. Occupancy is highly seasonal: holiday and summer boarding is constrained while weekday capacity remains available. A disciplined pricing and membership program could expand revenue without a major facility investment, but buyers will expect evidence from daily occupancy, denial, churn, and RevPAU reporting.\n\n## Performance Heat Map\n\n| Category | Risk Level | Key Finding | Impact on Deal |\n|---|---|---|---|\n| Revenue & Profitability | Low | $1.7M revenue; $450K normalized EBITDA | Attractive base economics |\n| Competitive Positioning | Low | 4.9 rating from 214 reviews | Supports premium thesis |\n| Pricing Strategy | High | Core rates 8%–15% below illustrative peers | Upside is credible but not yet proven |\n| Occupancy | High | Peak constraint and weekday slack; manual reporting | Buyer may discount projected upside |\n| Pricing by Vertical | Medium | Small annual increases across all verticals | Requires planned reset |\n| Location | Low | Customer density within ten miles | Supports retention and local demand |\n\n## Quantified Opportunity\n\nThe pricing analysis identifies approximately **$190,000 of gross annual revenue opportunity** before churn and mix effects. Management should treat this as a testable operating plan, not a valuation add-back. Boarding is the highest-priority vertical, followed by daycare memberships and grooming attachment.\n\n## Recommendations for the Deal Team\n\n1. Implement daily capacity and denial reporting immediately.\n2. Phase standard boarding from $58 toward $64, then test peak rates.\n3. Move daycare from $34 to $37 and pilot capped weekday memberships.\n4. Create boarding tiers and departure-day grooming bundles.\n5. Demonstrate at least three months of pricing, churn, occupancy, and RevPAU results before buyer management meetings.\n\n## Overall Readiness\n\n**🟡 YELLOW — Strong business with a clear, measurable commercial-improvement plan still to execute.**",
        "workstream": "ws2",
        "generatedAt": "2026-07-14T12:44:01.954Z"
      },
      "agentApprovals": {},
      "facilityReview": {
        "zones": [
          {
            "zone": "Reception & Retail",
            "score": 86,
            "rating": "Good",
            "weight": 10,
            "commentary": "Bright, orderly and consistent with premium positioning.",
            "keyFindings": [
              "Customer flow is clear.",
              "Retail inventory is well presented.",
              "Replace worn entry flooring before market launch."
            ]
          },
          {
            "zone": "Boarding Kennels",
            "score": 82,
            "rating": "Good",
            "weight": 25,
            "commentary": "Clean runs and documented sanitation; several gates show latch wear.",
            "keyFindings": [
              "Sanitation logs current.",
              "Two gate latches scheduled for replacement.",
              "Acoustic treatment would improve buyer impression."
            ]
          },
          {
            "zone": "Daycare & Outdoor Play",
            "score": 72,
            "rating": "Needs Attention",
            "weight": 20,
            "commentary": "Functional play yards but summer heat mitigation and drainage evidence are incomplete.",
            "keyFindings": [
              "Add permanent shade structures.",
              "Document surface-temperature protocol.",
              "Repair low-point drainage near east fence."
            ]
          },
          {
            "zone": "Grooming",
            "score": 80,
            "rating": "Good",
            "weight": 10,
            "commentary": "Productive three-station room with appropriate separation and storage.",
            "keyFindings": [
              "Electrical and dryer maintenance logs available.",
              "Replace one aging tub valve."
            ]
          },
          {
            "zone": "HVAC / Mechanical",
            "score": 68,
            "rating": "Needs Attention",
            "weight": 20,
            "commentary": "Operating normally, but two rooftop units are beyond ten years and no formal capital reserve exists.",
            "keyFindings": [
              "Obtain remaining-life inspection.",
              "Budget a $35,000-$55,000 reserve.",
              "Confirm landlord responsibility under lease."
            ]
          },
          {
            "zone": "Safety, Security & Compliance",
            "score": 81,
            "rating": "Good",
            "weight": 15,
            "commentary": "Camera coverage, incident logs and chemical controls are generally sound.",
            "keyFindings": [
              "Camera contract assignment unconfirmed.",
              "Update posted evacuation map.",
              "Complete annual fire-extinguisher tagging."
            ]
          }
        ],
        "location": "1720 E Deer Valley Dr, Phoenix, AZ 85024",
        "modelUsed": "Illustrative Cantara facility diligence model",
        "nextReview": "2026-10-10",
        "preparedBy": "Cantara Pet Advisors",
        "generatedAt": "2026-07-14T13:30:00.000Z",
        "businessName": "The Cactus Pet Resort",
        "overallScore": 78,
        "overallRating": "Good",
        "reportVersion": "1.0",
        "assessmentDate": "2026-07-10",
        "buyerRiskSummary": "No immediate operating shutdown condition identified. Buyer should reserve for HVAC and require evidence resolving outdoor-use, drainage and preventive-maintenance items.",
        "overallNarrative": "The leased 12,400-square-foot facility is clean, functional and customer-ready, with strong animal-care practices and attractive reception presentation. Near-term value protection requires documented HVAC reserve planning, improved outdoor shade and drainage, and completion of preventive-maintenance items before buyer inspections.",
        "imageCoverageNotes": [
          "Reception, boarding, daycare, grooming, mechanical and exterior zones represented.",
          "No roof-level imagery; HVAC conclusions require licensed inspection."
        ],
        "methodologyDisclosure": "Illustrative advisor assessment based on supplied macro assumptions and synthetic walk-through evidence for demonstration purposes.",
        "prioritizedImprovements": [
          {
            "zone": "HVAC / Mechanical",
            "effort": "Low",
            "timing": "0-30 days",
            "improvement": "Commission HVAC condition report and responsibility memo",
            "valueImpact": "High"
          },
          {
            "zone": "Daycare & Outdoor Play",
            "effort": "Medium",
            "timing": "31-60 days",
            "improvement": "Install permanent shade and repair east-yard drainage",
            "valueImpact": "High"
          },
          {
            "zone": "Multiple",
            "effort": "Low",
            "timing": "0-45 days",
            "improvement": "Replace kennel latches, entry flooring and grooming valve",
            "valueImpact": "Medium"
          },
          {
            "zone": "Facility-wide",
            "effort": "Low",
            "timing": "0-30 days",
            "improvement": "Assemble preventive-maintenance binder and vendor warranties",
            "valueImpact": "Medium"
          }
        ],
        "brandCurbAppealAssessment": "Strong branded entrance and clean reception. Replace entry flooring and refresh exterior wayfinding before photography.",
        "cantaraAdvisoryCommentary": "Complete low-cost presentation work immediately and obtain third-party support for larger capital items so buyers can underwrite timing instead of applying an undefined reserve.",
        "capitalExpenditureOutlook": [
          {
            "item": "Two rooftop HVAC units",
            "timing": "12-36 months",
            "estimatedCostRange": "$35,000-$55,000"
          },
          {
            "item": "Outdoor shade and drainage",
            "timing": "0-12 months",
            "estimatedCostRange": "$18,000-$28,000"
          },
          {
            "item": "Kennel and grooming refresh",
            "timing": "0-6 months",
            "estimatedCostRange": "$6,000-$10,000"
          }
        ],
        "maintenanceHistorySummary": "Monthly sanitation and routine service logs are present. HVAC service invoices exist for 2024-2026, but remaining-life estimates and landlord responsibility are not consolidated.",
        "complianceLicensingSnapshot": "Kennel permit is active; legal-name correction and written confirmation of outdoor play use remain open diligence items."
      },
      "buyerReport_ws1": {
        "markdown": "# The Cactus Pet Resort\n## Workstream 1 — Risk Mitigation — Buyer Due Diligence Summary\n\n## Investment Highlights\n\n- **Attractive earnings profile:** $1.70 million of revenue and $450,000 of normalized EBITDA, representing a 26.5% margin.\n- **Clear ownership and simple seller structure:** one active Arizona LLC with 100% sole-member ownership and no identified minority claims.\n- **Experienced operating team:** a 24-person workforce led by an established GM and AGM provides credible continuity beyond the owner.\n- **Strong customer trust:** 4.9 Google rating across 214 reviews supports service quality and local goodwill.\n- **Defined, manageable diligence items:** site-control, lien-release, permit, management, and legacy-obligation actions have named mitigation paths.\n- **No identified material litigation:** illustrative federal, state, county, judgment, and lien searches found no material lawsuit or judgment.\n\n## Business Overview\n\nThe Cactus Pet Resort is an established Phoenix, Arizona pet-care business providing boarding, daycare, grooming, and complementary services from a leased single-site facility. The business serves a diversified local customer base and has developed a premium reputation through consistent care, experienced staff, and integrated services.\n\nThe company operates through Cactus Pet Resort LLC, an active Arizona limited liability company. Elena Marquez owns 100% of the membership interests. Day-to-day operations are led by GM Jordan Lee with support from an AGM and experienced department leads. The transaction is expected to be structured as a sale of operating assets, subject to definitive documentation.\n\n## Diligence Summary\n\n| Category | Status | Summary | Buyer Consideration |\n|---|---|---|---|\n| Legal & Corporate Standing | 🟡 YELLOW | Active Arizona LLC; current good standing; transaction consent to be executed | Routine closing authority package |\n| Ownership & Transfer Readiness | 🟢 GREEN | 100% sole-member ownership is clearly documented | Simple seller and approval chain |\n| Contracts & Agreements | 🟡 YELLOW | Core contracts mapped; several notices/consents and exports in progress | Normal transition planning |\n| Litigation & Liens | 🔴 RED | No material lawsuit; one ~$186,000 equipment UCC filing | Direct payoff and UCC-3 at closing |\n| Insurance Coverage | 🟡 YELLOW | No open modeled claim; fresh carrier loss runs requested | Confirm limits and tail treatment |\n| Permits & Zoning | 🔴 RED | Core permits exist; legal-name and outdoor-use documentation being refreshed | Written cure before closing |\n| Employment & HR | 🟡 YELLOW | Stable 24-person team; retention and accrued obligations being finalized | Confirm transfer and retention plan |\n| Tax Compliance | 🟡 YELLOW | Ordinary TPT/payroll bring-down and contractor lookback underway | Clearance and targeted indemnity if needed |\n| Lease & Site Control | 🔴 RED | Landlord consent and longer site control under negotiation | Principal third-party closing condition |\n| Management Continuity | 🟡 YELLOW | GM runs daily operations; formal retention and authority package in progress | Supports post-close continuity |\n\n## Legal & Compliance Profile\n\nCactus Pet Resort LLC was formed in Arizona in 2018 and is shown as active. The seller’s legal name is consistent across formation, tax, ownership, and most commercial records. “The Cactus Pet Resort” is a registered Arizona trade name. Certain operating records use only the trade name; the seller is reconciling those records to the LLC d/b/a format.\n\nThe reviewed operating agreement identifies Elena Marquez as the sole member with full voting authority. No option, phantom equity, convertible interest, minority claim, or affiliate seller was identified. The closing package will include executed transaction authority, incumbency, good standing, ownership certification, and bring-down searches.\n\nOne active equipment UCC filing secures an estimated $186,000 payoff balance. It is not a blanket all-assets lien, but it covers certain kennel, grooming, laundry, and HVAC equipment. The seller intends to provide clear title through direct payoff, per-diem confirmation, verified wiring, and a UCC-3 termination commitment.\n\n## Operational Readiness\n\nThe facility, workforce, contracts, systems, and advisors provide a stable operating platform. The principal real-estate matter is landlord consent to assignment and the buyer’s desire for at least ten years of site control including options. The seller is also seeking a corrected premises exhibit, clear HVAC responsibility, estoppel, and release of the personal guaranty.\n\nMaterial operating contracts have been inventoried. Known actions include an auto-renewal notice, security-system assignment consent, review of linen minimums, payment-processor transition, and marketing data/credential transfer. Eight essential vendor systems are mapped with a planned Day-1 access runbook.\n\nPermits and zoning evidence generally support continued operation. The seller is updating the kennel permit to show Cactus Pet Resort LLC d/b/a The Cactus Pet Resort and obtaining written confirmation of outdoor play-yard use.\n\n## Employment & HR Profile\n\nThe business has 24 workers across management, front desk, animal care, grooming, and administrative functions. Frontline compensation is generally aligned with the Phoenix market. The current GM and AGM provide meaningful operating continuity.\n\nThe seller is formalizing a 12-month GM retention package, delegated authority matrix, and six-month transition scope. Accrued PTO of approximately $34,680 will be paid or specifically treated in the purchase-price/working-capital mechanics. A contractor-classification review is being completed, with an illustrative exposure range of $22,000–$38,000 if a cure or reserve is required.\n\n## Risk Mitigation Summary\n\n| Matter | Buyer Risk | Mitigation / Deal Treatment |\n|---|---|---|\n| Landlord consent and site control | Facility transfer or lender concern | Consent/amendment, estoppel, options, guaranty release |\n| Equipment UCC | Title to essential equipment | Direct payoff and UCC-3 termination |\n| Permit legal name / outdoor use | Operational continuity | Corrected permit and municipal confirmation |\n| GM and owner transition | Key-person dependence | Signed retention, RACI, SOPs, transition agreement |\n| TPT / contractor / PTO | Legacy obligation | Clearance, quantified schedule, escrow/indemnity if unresolved |\n| Contract assignability | Service interruption or cost change | Consent/notice log and replacement plan |\n| Insurance bring-down | Coverage uncertainty | Five-year carrier loss runs and broker memorandum |\n\nEach matter has a defined evidence standard and is considered manageable within normal confirmatory diligence.\n\n## Lease and Facility Profile\n\n| Item | Current Position | Buyer Follow-Up |\n|---|---|---|\n| Property | Leased Phoenix pet resort | Site visit and condition review |\n| Assignment | Landlord consent required | Review consent form and buyer requirements |\n| Remaining control | Extension/options under discussion | Confirm financeable term |\n| Outdoor areas | Used in operations | Confirm premises exhibit and zoning |\n| HVAC / repairs | Allocation needs clarification | Review amendment and capex history |\n| CAM / rent | Current | Review reconciliations and estoppel |\n| Seller guaranty | Release requested | Confirm at assignment/closing |\n\n## Team and Transition\n\nJordan Lee operates the facility, manages staff scheduling, handles guest escalations, and coordinates day-to-day service delivery. Elena retains certain banking, pricing, marketing, advisor, and high-level vendor decisions. The transition plan will move those responsibilities into a documented operating cadence.\n\nBuyer management meetings should include the GM, AGM, grooming lead, bookkeeper, insurance broker, CPA, and lease counsel as appropriate. Employee communications should occur only after a mutually agreed transaction and communication plan.\n\n## Key Metrics at a Glance\n\n| Metric | Value | Context |\n|---|---:|---|\n| Annual Revenue | $1,700,000 | Trailing operating scale |\n| Reported EBITDA | $392,000 | Management accounts |\n| Normalized EBITDA | $450,000 | $58,000 reviewed adjustments |\n| EBITDA Margin | 26.5% | Strong single-site profitability |\n| Valuation Range | $2.25M–$3.15M | 5.0x–7.0x |\n| Midpoint Valuation | $2.70M | 6.0x |\n| Team Size | 24 | Includes management and frontline staff |\n| Google Rating | 4.9 | 214 reviews |\n| Known UCC Payoff | ~$186,000 | To be satisfied at closing |\n| Accrued PTO | ~$34,680 | Defined transaction treatment |\n| Entity Ownership | 100% Elena Marquez | One seller entity |\n| Facility | Leased | Consent/site control in process |\n\n## Data Room Availability\n\nQualified buyers will receive corporate records, financial statements, normalization support, lease and amendments, permit/zoning evidence, employee census, material-contract schedule, vendor register, insurance policies/loss runs, tax filings, UCC and litigation searches, and transition documentation. Personally identifiable employee/customer information will be staged according to diligence sensitivity.\n\n## Buyer Considerations & Next Steps\n\n1. Review the full lease, consent pathway, estoppel form, options, premises exhibit, and guaranty-release terms.\n2. Review the equipment lender payoff package and confirm UCC-3 filing mechanics through escrow.\n3. Schedule a management meeting with the GM and evaluate delegated authority, retention, and seller-transition scope.\n4. Conduct a site visit focused on safe capacity, outdoor areas, HVAC, drainage, kennel condition, and grooming operations.\n5. Review the permit/zoning binder and confirm the corrected legal name and outdoor-use documentation.\n6. Review employee census, PTO treatment, contractor analysis, benefits, and retention obligations.\n7. Review material-contract consent/notice schedule and test critical system/customer-data exports.\n8. Confirm tax clearance, bring-down searches, insurance loss runs, and any targeted escrow or special indemnity.\n9. Reconcile normalized EBITDA and working-capital mechanics to monthly source records.\n10. Coordinate a 45–60 day confirmatory diligence and closing plan, subject to landlord consent and customary approvals.\n\n## Buyer Conclusion\n\nThe Cactus Pet Resort presents a profitable, reputable pet-care platform with clear ownership and a capable operating team. The principal diligence matters are specific, visible, and paired with conventional remedies. A buyer that validates site control, clear title, permits, management continuity, and ordinary legacy obligations should be positioned to acquire a stable business with attractive local goodwill and a credible base of transferable earnings.\n",
        "updatedAt": "2026-07-14T14:40:00.000Z",
        "clientName": "The Cactus Pet Resort",
        "workstream": "ws1",
        "generatedAt": "2026-07-14T14:40:00.000Z",
        "workstreamLabel": "Workstream 1 — Risk Mitigation"
      },
      "buyerReport_ws2": {
        "markdown": "# The Cactus Pet Resort\n## Workstream 2 — Profitability & Growth — Buyer Due Diligence Summary\n\n## Investment Highlights\n\n- **$1.70 million revenue and $450,000 normalized EBITDA**, producing an attractive 26.5% normalized margin.\n- **Market-leading reputation:** 4.9 Google rating across 214 reviews supports premium customer trust.\n- **Diversified service model:** boarding, daycare, grooming, and add-ons create frequency and share-of-wallet opportunity.\n- **Experienced site management:** a GM/AGM team runs daily operations and can execute a structured growth plan.\n- **Attractive Phoenix trade area:** affluent pet-owning households, strong access, and veterinary/referral density support demand.\n- **Approximately $190,000 of identified gross revenue opportunity** across pricing, peak yield, membership, grooming, add-ons, and conversion—none included in current EBITDA.\n\n## Business Overview\n\nThe Cactus Pet Resort is a premium local pet-care business serving Phoenix customers through an integrated boarding, daycare, grooming, and enrichment model. The company has built a strong reputation through service quality, staff familiarity, and a convenient single-site facility.\n\nThe business combines attractive current profitability with an actionable commercial improvement plan. The opportunity is not dependent on a turnaround. A buyer inherits a healthy brand and operating base, then can add daily capacity analytics, disciplined pricing, recurring memberships, sales-funnel management, and improved digital attribution.\n\n## Diligence Summary\n\n| Category | Status | Summary | Buyer Consideration |\n|---|---|---|---|\n| Revenue & Profitability | 🟢 GREEN | $1.7M revenue and $450K normalized EBITDA | Strong base underwriting |\n| Pricing Strategy | 🟡 YELLOW | Rates below premium peer median; cohort tests underway | Evidence-backed upside |\n| Digital Presence & Reputation | 🟢 GREEN | 4.9 rating/214 reviews; digital score 82/100 | Defensible local brand |\n| Competitive Position | 🟢 GREEN | Integrated services and superior reputation | Premium positioning |\n| Sales Process | 🟡 YELLOW | Relationship-driven; funnel and SLA being formalized | Conversion opportunity |\n| Facility Condition | 🟡 YELLOW | 78/100 with defined minor capex | Normal site diligence |\n| Customer Mix | 🟡 YELLOW | Diversified local base; cohort reporting in progress | Validate repeat and concentration |\n| Growth Potential | 🟢 GREEN | Six quantified commercial levers | Clear buyer value-creation plan |\n| Occupancy Analytics | 🟡 YELLOW | 66% average and 91% peak; daily data being built | Distinguish capacity from yield |\n| Management Transferability | 🟢 GREEN | GM/AGM operate day-to-day | Supports execution continuity |\n\n## Financial Performance\n\nTrailing revenue is $1,700,000. Reported EBITDA of $392,000 reconciles to normalized EBITDA of $450,000 through $58,000 of reviewed adjustments. The normalized margin is 26.5%. The seller has not included unproven price, membership, occupancy, or sales-conversion upside in the EBITDA base.\n\nRevenue is diversified across boarding, daycare, grooming, and add-on services. Buyers will receive monthly financials, service-line reporting, normalization support, and a proven-vs-upside bridge. Commercial KPIs are being reconciled to booking, payment, payroll, and GL sources.\n\n| Financial Metric | Result | Buyer Read |\n|---|---:|---|\n| Revenue | $1,700,000 | Attractive single-site scale |\n| Reported EBITDA | $392,000 | Reconciled management result |\n| Normalized EBITDA | $450,000 | $58,000 supportable adjustments |\n| Normalized Margin | 26.5% | Strong profitability |\n| Valuation Sensitivity | $2.25M–$3.15M | 5.0x–7.0x normalized EBITDA |\n| Working Midpoint | $2.70M | 6.0x normalized EBITDA |\n| Identified Gross Upside | ~$190,000 | Not in current EBITDA |\n\n## Market Position & Competition\n\nThe company competes with independent pet resorts, veterinary-affiliated boarding, and multi-location operators within the Phoenix trade area. The Cactus Pet Resort’s principal advantages are review quality, integrated services, experienced staff, customer familiarity, and local convenience.\n\nA seven-competitor review indicates the business is competitively priced but often below the premium peer median. Several peers use more structured boarding tiers, peak calendars, memberships, deposits, and add-on presentation. This creates a practical improvement opportunity without requiring a repositioning of the brand.\n\nThe company’s 4.9 rating across 214 reviews is a material competitive asset. Pricing and growth tests are governed by a 4.8 minimum review-score guardrail and explicit churn/service thresholds.\n\n## Growth Opportunities\n\n| Initiative | Current / Baseline | Buyer Opportunity | Gross Annualized Potential | Required Proof |\n|---|---|---|---:|---|\n| Boarding rate alignment | Below premium peer median | Phased +6% cohort | $62,000 | ADR, churn, cancellations |\n| Peak / holiday yield | Inconsistent rules | Calendar, deposits, minimum stays | $38,000 | Peak RevPAU and denials |\n| Weekday daycare membership | Limited package structure | Capped Tue–Thu plan | $34,000 | Members, churn, margin |\n| Departure-day grooming | 18% attachment | Target 25% | $29,000 | Attachment and labor use |\n| Add-ons / enrichment | 22% attachment | Target 30% | $17,000 | Mix and contribution |\n| Lead conversion | 46% estimated | Target 55% | $10,000+ | Funnel and response time |\n| Total | — | — | ~$190,000 | 90-day evidence binder |\n\nThese are gross opportunities, not guaranteed EBITDA. Labor, supplies, fees, customer behavior, capacity, and implementation costs must be considered.\n\n## Operational Strengths\n\nThe GM and AGM run daily operations, scheduling, guest resolution, and service delivery. A 24-person team supports the current revenue base. The facility review scored 78/100 and found a credible operating environment with defined minor improvements rather than a major repositioning requirement.\n\nDigital presence scored 82/100. Google Business Profile, reviews, and core service communication are strong. Marketing improvements focus on attribution, service-area content, credential ownership, and source-to-booking reporting.\n\nAverage occupancy is approximately 66%, while peaks reach about 91%. This pattern suggests both yield opportunity during constrained dates and volume opportunity during off-peak periods. The 90-day plan will document safe daily capacity, closed inventory, denials, cancellations, waitlist recovery, and RevPAU.\n\n## Customer and Sales Profile\n\nThe customer base is local and diversified. No material single-customer dependency is expected. A buyer should review anonymized retention cohorts, top-customer concentration, revenue by ZIP, referral sources, service-line migration, and lifetime value.\n\nLead handling currently benefits from strong word of mouth and staff relationships. The business is formalizing response-time tracking, source capture, tour-to-book conversion, and lost-lead reasons. The target is to improve inquiry-to-book conversion from approximately 46% toward 55% while preserving service quality.\n\n## Digital, Systems, and Data\n\nCore booking, payments, payroll, accounting, phone, marketing, and operational vendors have been mapped. The buyer transition package will include admin ownership, contract/renewal information, tested exports, integration map, and Day-1 credentials.\n\nThe KPI pack will combine:\n- occupancy and RevPAU by vertical/day;\n- realized ADR and discounting;\n- denials, cancellations, and waitlist recovery;\n- lead source, response time, tours, and booking conversion;\n- repeat rate, membership churn, and concentration;\n- grooming/add-on attachment;\n- labor percentage and contribution; and\n- review score and velocity.\n\n## Facility and Capacity\n\n| Area | Current View | Buyer Diligence |\n|---|---|---|\n| Customer-facing condition | Good | Site visit and photo/capex binder |\n| Kennel and boarding areas | Operationally credible | Validate safe unit capacity |\n| Grooming | Established service line | Review schedule and labor utilization |\n| Outdoor play | Important amenity | Confirm site/permit evidence |\n| HVAC / ventilation | Defined maintenance items | Review invoices and lease allocation |\n| Occupancy | 66% average / 91% peak | Review daily 90-day dataset |\n| Expansion thesis | Operational optimization first | Do not assume physical expansion |\n\n## Key Metrics at a Glance\n\n| Metric | Value | Context |\n|---|---:|---|\n| Annual Revenue | $1,700,000 | Trailing operating scale |\n| Normalized EBITDA | $450,000 | 26.5% margin |\n| Google Rating | 4.9 / 5.0 | 214 reviews |\n| Team Size | 24 | GM/AGM-led |\n| Average Occupancy | 66% | Off-peak headroom |\n| Peak Occupancy | 91% | Yield/denial opportunity |\n| Digital Score | 82 / 100 | Strong foundation |\n| Facility Score | 78 / 100 | Good with defined improvements |\n| Inquiry Conversion | ~46% | 55% working target |\n| Grooming Attachment | 18% | 25% target |\n| Add-on Attachment | 22% | 30% target |\n| Gross Upside Identified | ~$190,000 | Not included in EBITDA |\n\n## Buyer Considerations & Next Steps\n\n1. Reconcile the $450,000 normalized EBITDA to monthly financial and source support.\n2. Review 90 days of daily occupancy, capacity, denials, cancellations, average rate, and RevPAU by service line.\n3. Review price-test and peak-yield cohorts, including churn, complaints, discounts, and realized contribution.\n4. Meet with the GM/AGM to assess commercial ownership, KPI cadence, staffing, and growth execution.\n5. Conduct a site visit focused on safe capacity, customer flow, grooming utilization, outdoor areas, and minor capex.\n6. Review customer retention, concentration, ZIP/referral, and service-line migration schedules.\n7. Review lead-funnel data, response-time SLA, conversion, and digital attribution.\n8. Validate booking/payment/GL/payroll reconciliation and recurring KPI production.\n9. Review competitor mystery-shop evidence and assumptions behind the ~$190,000 gross opportunity.\n10. Separate historical EBITDA, proven run-rate benefit, and buyer-controlled future upside in valuation discussions.\n\n## Buyer Conclusion\n\nThe Cactus Pet Resort is a profitable, high-reputation platform with a credible management team and a practical growth plan. The buyer opportunity is to professionalize measurement and yield—not to repair a weak business. Current earnings stand on their own, while the identified commercial levers provide a transparent path to additional value after confirmatory testing.\n",
        "updatedAt": "2026-07-14T14:40:00.000Z",
        "clientName": "The Cactus Pet Resort",
        "workstream": "ws2",
        "generatedAt": "2026-07-14T14:40:00.000Z",
        "workstreamLabel": "Workstream 2 — Profitability & Growth"
      },
      "digitalPresence": {
        "channels": [
          {
            "url": "https://example.com/cactus-pet-resort",
            "flags": [
              {
                "message": "Booking funnel is not instrumented end-to-end.",
                "severity": "warning"
              },
              {
                "message": "Service and location pages support local search intent.",
                "severity": "positive"
              }
            ],
            "score": 4,
            "summary": "Clear service pages and local relevance, but mobile booking requires too many steps and analytics do not reconcile leads to completed reservations.",
            "notFound": false,
            "keyMetrics": [
              {
                "label": "Mobile performance",
                "value": "76/100"
              },
              {
                "label": "Booking clicks / month",
                "value": "438"
              },
              {
                "label": "Tracked conversion",
                "value": "Not reconciled"
              }
            ],
            "channelType": "website",
            "channelLabel": "Website",
            "trafficLight": "amber",
            "dataConfidence": "high"
          },
          {
            "url": "https://google.com/maps",
            "flags": [
              {
                "message": "4.9 rating across 214 reviews supports premium positioning.",
                "severity": "positive"
              }
            ],
            "score": 5,
            "summary": "Market-leading reputation with current hours, frequent owner responses and strong photo coverage.",
            "notFound": false,
            "keyMetrics": [
              {
                "label": "Rating",
                "value": "4.9"
              },
              {
                "label": "Reviews",
                "value": "214"
              },
              {
                "label": "Response rate",
                "value": "96%"
              }
            ],
            "channelType": "google_business",
            "channelLabel": "Google Business Profile",
            "trafficLight": "green",
            "dataConfidence": "high"
          },
          {
            "url": "https://facebook.com/CactusPetResort",
            "flags": [
              {
                "message": "No campaign-to-booking attribution.",
                "severity": "warning"
              }
            ],
            "score": 3,
            "summary": "Accurate profile and engaged local audience, but posting cadence is inconsistent and campaigns are not attributed to bookings.",
            "notFound": false,
            "keyMetrics": [
              {
                "label": "Followers",
                "value": "3,840"
              },
              {
                "label": "Posts / month",
                "value": "4"
              },
              {
                "label": "Engagement",
                "value": "2.8%"
              }
            ],
            "channelType": "facebook",
            "channelLabel": "Facebook",
            "trafficLight": "amber",
            "dataConfidence": "medium"
          },
          {
            "url": "https://instagram.com/cactuspetresort",
            "flags": [
              {
                "message": "Visual content reinforces trust and facility quality.",
                "severity": "positive"
              }
            ],
            "score": 4,
            "summary": "Strong visual proof of care standards with healthy engagement and customer-generated content.",
            "notFound": false,
            "keyMetrics": [
              {
                "label": "Followers",
                "value": "5,260"
              },
              {
                "label": "Posts / month",
                "value": "9"
              },
              {
                "label": "Engagement",
                "value": "4.6%"
              }
            ],
            "channelType": "instagram",
            "channelLabel": "Instagram",
            "trafficLight": "green",
            "dataConfidence": "high"
          },
          {
            "url": "https://booking.example.com/cactus",
            "flags": [
              {
                "message": "Abandoned booking and denial reasons are not captured.",
                "severity": "critical"
              }
            ],
            "score": 3,
            "summary": "Online requests are available but vaccination upload, deposit and add-on selection require manual follow-up.",
            "notFound": false,
            "keyMetrics": [
              {
                "label": "Online request share",
                "value": "61%"
              },
              {
                "label": "Mobile completion",
                "value": "Estimated 42%"
              },
              {
                "label": "Deposit automation",
                "value": "Partial"
              }
            ],
            "channelType": "booking_platform",
            "channelLabel": "Online Booking",
            "trafficLight": "amber",
            "dataConfidence": "medium"
          },
          {
            "url": "https://google.com/maps",
            "flags": [
              {
                "message": "Reputation is a defensible acquisition asset.",
                "severity": "positive"
              }
            ],
            "score": 5,
            "summary": "Review volume, recency and owner response quality exceed the illustrative peer set.",
            "notFound": false,
            "keyMetrics": [
              {
                "label": "Google rating",
                "value": "4.9"
              },
              {
                "label": "Google reviews",
                "value": "214"
              },
              {
                "label": "90-day new reviews",
                "value": "31"
              }
            ],
            "channelType": "online_reputation",
            "channelLabel": "Online Reputation",
            "trafficLight": "green",
            "dataConfidence": "high"
          }
        ],
        "generatedAt": "2026-07-14T13:30:00.000Z",
        "businessName": "The Cactus Pet Resort",
        "overallScore": 82,
        "executiveSummary": "The resort has a buyer-supportive digital footprint led by a 4.9 Google rating from 214 reviews, strong branded search visibility, and consistent local-market positioning. The principal value gaps are an aging mobile booking path, limited first-party conversion tracking, irregular social cadence, and owner-controlled digital credentials.",
        "maReadinessNotes": "Digital reputation is an identifiable intangible asset. Before market launch, document account ownership, export customer audiences, centralize MFA recovery, reconcile website analytics to booking conversions, and demonstrate three months of repeatable review and lead reporting.",
        "overallTrafficLight": "green",
        "digitalAssetInventory": [
          {
            "url": "https://example.com/cactus-pet-resort",
            "notes": "Domain renewal March 2027; owner registrar access.",
            "score": 4,
            "status": "active",
            "assetType": "Website/domain",
            "channelType": "website"
          },
          {
            "url": "https://google.com/maps",
            "notes": "Primary owner Elena; add GM and transaction administrator.",
            "score": 5,
            "status": "active",
            "assetType": "Google Business Profile",
            "channelType": "google_business"
          },
          {
            "url": "https://facebook.com/CactusPetResort",
            "notes": "Business Manager ownership must be documented.",
            "score": 3,
            "status": "active",
            "assetType": "Facebook Page",
            "channelType": "facebook"
          },
          {
            "url": "https://instagram.com/cactuspetresort",
            "notes": "Connected to owner mobile MFA.",
            "score": 4,
            "status": "active",
            "assetType": "Instagram",
            "channelType": "instagram"
          },
          {
            "url": "https://booking.example.com/cactus",
            "notes": "PetExec integration; API and export access confirmed.",
            "score": 3,
            "status": "active",
            "assetType": "Booking portal",
            "channelType": "booking_platform"
          }
        ]
      },
      "insuranceReview": {
        "flags": [
          "Obtain carrier-issued five-year loss runs before market launch.",
          "Confirm claims-made tail requirements and buyer policy inception timing."
        ],
        "status": "complete",
        "summary": "A 2025 guest-injury liability claim was resolved within policy limits with no admission of negligence. Loss history otherwise shows one small workers compensation strain claim and no property, fire, cyber or business-interruption losses during the reviewed period.",
        "generatedAt": "2026-07-14T13:30:00.000Z"
      },
      "netProceedsMeta": {
        "notes": "Illustrative seller proceeds scenario; tax amounts require CPA/legal validation.",
        "generatedAt": "2026-07-14T15:00:00.000Z",
        "illustrative": true,
        "selectedOffer": "Desert Paws Strategic Partners",
        "enterpriseValue": 2950000
      },
      "occupancyReview": {
        "inputs": {
          "documentNames": [
            "Cactus_Occupancy_Demo.xlsx"
          ],
          "analysisPeriod": "August 2025–July 2026",
          "totalBoardingRuns": "48",
          "totalDaycareSpots": "22",
          "totalGroomingStations": "2"
        },
        "computed": {
          "peakMonths": [
            "2025-12",
            "2026-07",
            "2026-06"
          ],
          "troughMonths": [
            "2026-02",
            "2026-01",
            "2025-09"
          ],
          "monthlyTotals": [
            {
              "month": "2025-08",
              "total": 1400,
              "daycareMix": 44.3,
              "boardingMix": 55.7,
              "daycareDogs": 620,
              "utilization": 66.7,
              "boardingDogs": 780
            },
            {
              "month": "2025-09",
              "total": 1330,
              "daycareMix": 48.1,
              "boardingMix": 51.9,
              "daycareDogs": 640,
              "utilization": 63.3,
              "boardingDogs": 690
            },
            {
              "month": "2025-10",
              "total": 1390,
              "daycareMix": 48.2,
              "boardingMix": 51.8,
              "daycareDogs": 670,
              "utilization": 66.2,
              "boardingDogs": 720
            },
            {
              "month": "2025-11",
              "total": 1520,
              "daycareMix": 40.1,
              "boardingMix": 59.9,
              "daycareDogs": 610,
              "utilization": 72.4,
              "boardingDogs": 910
            },
            {
              "month": "2025-12",
              "total": 1620,
              "daycareMix": 35.8,
              "boardingMix": 64.2,
              "daycareDogs": 580,
              "utilization": 77.1,
              "boardingDogs": 1040
            },
            {
              "month": "2026-01",
              "total": 1330,
              "daycareMix": 48.9,
              "boardingMix": 51.1,
              "daycareDogs": 650,
              "utilization": 63.3,
              "boardingDogs": 680
            },
            {
              "month": "2026-02",
              "total": 1270,
              "daycareMix": 49.6,
              "boardingMix": 50.4,
              "daycareDogs": 630,
              "utilization": 60.5,
              "boardingDogs": 640
            },
            {
              "month": "2026-03",
              "total": 1450,
              "daycareMix": 47.6,
              "boardingMix": 52.4,
              "daycareDogs": 690,
              "utilization": 69,
              "boardingDogs": 760
            },
            {
              "month": "2026-04",
              "total": 1410,
              "daycareMix": 49.6,
              "boardingMix": 50.4,
              "daycareDogs": 700,
              "utilization": 67.1,
              "boardingDogs": 710
            },
            {
              "month": "2026-05",
              "total": 1500,
              "daycareMix": 48,
              "boardingMix": 52,
              "daycareDogs": 720,
              "utilization": 71.4,
              "boardingDogs": 780
            },
            {
              "month": "2026-06",
              "total": 1580,
              "daycareMix": 41.1,
              "boardingMix": 58.9,
              "daycareDogs": 650,
              "utilization": 75.2,
              "boardingDogs": 930
            },
            {
              "month": "2026-07",
              "total": 1600,
              "daycareMix": 38.8,
              "boardingMix": 61.3,
              "daycareDogs": 620,
              "utilization": 76.2,
              "boardingDogs": 980
            }
          ],
          "totalCapacity": 70,
          "avgUtilization": 66,
          "daycareDisplacementPct": 14
        },
        "markdown": "# Occupancy Review — The Cactus Pet Resort\n\n## Executive Summary\n\nThe facility has strong holiday and summer boarding demand but significant weekday and shoulder-period capacity. Average blended utilization is approximately **66%**, while peak boarding reaches about **91%** on holiday weekends and ordinary weekday utilization can fall near **48%**. The current spreadsheet process does not provide dependable daily capacity, denial, cancellation, or RevPAU reporting.\n\n## Findings\n\n- Peak periods support premium pricing and minimum-stay rules.\n- Weekday daycare memberships can monetize unused capacity.\n- Boarding demand displaces daycare during selected holidays without a documented yield rule.\n- Management should reconcile monthly totals to the booking system and financial statements.\n\n## Red Flag — Commercial Reporting\n\nPricing and capacity decisions are being made from monthly spreadsheets rather than daily demand and denial data. This limits the buyer's ability to validate upside.\n\n## 90-Day Plan\n\n1. Establish daily occupied-unit and available-unit reporting by vertical.\n2. Track denied bookings, cancellations, no-shows, and lead time.\n3. Apply peak pricing to the published holiday calendar.\n4. Launch weekday daycare memberships with capacity caps.",
        "clientName": "The Cactus Pet Resort",
        "generatedAt": "2026-07-14T12:44:01.954Z",
        "monthlyData": [
          {
            "month": "2025-08",
            "daycareDogs": 620,
            "boardingDogs": 780
          },
          {
            "month": "2025-09",
            "daycareDogs": 640,
            "boardingDogs": 690
          },
          {
            "month": "2025-10",
            "daycareDogs": 670,
            "boardingDogs": 720
          },
          {
            "month": "2025-11",
            "daycareDogs": 610,
            "boardingDogs": 910
          },
          {
            "month": "2025-12",
            "daycareDogs": 580,
            "boardingDogs": 1040
          },
          {
            "month": "2026-01",
            "daycareDogs": 650,
            "boardingDogs": 680
          },
          {
            "month": "2026-02",
            "daycareDogs": 630,
            "boardingDogs": 640
          },
          {
            "month": "2026-03",
            "daycareDogs": 690,
            "boardingDogs": 760
          },
          {
            "month": "2026-04",
            "daycareDogs": 700,
            "boardingDogs": 710
          },
          {
            "month": "2026-05",
            "daycareDogs": 720,
            "boardingDogs": 780
          },
          {
            "month": "2026-06",
            "daycareDogs": 650,
            "boardingDogs": 930
          },
          {
            "month": "2026-07",
            "daycareDogs": 620,
            "boardingDogs": 980
          }
        ],
        "capacityModel": {
          "boardingRuns": 48,
          "daycareSpots": 22,
          "groomingStations": 2,
          "totalDailyCapacity": 70
        }
      },
      "pricingAnalysis": {
        "flags": [
          {
            "id": "pricing-under-market",
            "title": "Core pricing trails the market",
            "severity": "critical",
            "description": "The illustrative sample places core services 8%–15% below comparable competitors despite superior reputation."
          },
          {
            "id": "pricing-reputation",
            "title": "Reputation supports measured increases",
            "severity": "positive",
            "description": "A 4.9 rating and 214 reviews support premium positioning."
          }
        ],
        "competitors": [
          {
            "name": "Sonoran Paws Lodge",
            "websiteUrl": "https://example.com/sonoran-paws"
          },
          {
            "name": "Desert Tails Club",
            "websiteUrl": "https://example.com/desert-tails"
          },
          {
            "name": "Copper State Canine Resort",
            "websiteUrl": "https://example.com/copper-state"
          },
          {
            "name": "Papago Pet Retreat",
            "websiteUrl": "https://example.com/papago-pet"
          },
          {
            "name": "Valley Bark & Stay",
            "websiteUrl": "https://example.com/valley-bark"
          }
        ],
        "generatedAt": "2026-07-14T12:44:01.954Z",
        "priceMatrix": [
          {
            "basis": "Per night",
            "service": "Standard boarding",
            "competitors": [
              {
                "name": "Sonoran Paws Lodge",
                "normalized": "$68",
                "listedPrice": "$68",
                "normalizationNote": "Comparable listed service",
                "normalizedNumeric": 68
              },
              {
                "name": "Desert Tails Club",
                "normalized": "$68",
                "listedPrice": "$68",
                "normalizationNote": "Comparable listed service",
                "normalizedNumeric": 68
              },
              {
                "name": "Copper State Canine Resort",
                "normalized": "$68",
                "listedPrice": "$68",
                "normalizationNote": "Comparable listed service",
                "normalizedNumeric": 68
              },
              {
                "name": "Papago Pet Retreat",
                "normalized": "$68",
                "listedPrice": "$68",
                "normalizationNote": "Comparable listed service",
                "normalizedNumeric": 68
              },
              {
                "name": "Valley Bark & Stay",
                "normalized": "$68",
                "listedPrice": "$68",
                "normalizationNote": "Comparable listed service",
                "normalizedNumeric": 68
              }
            ],
            "sellerPrice": "$58",
            "sellerNormalized": "$58",
            "sellerNormalizedNumeric": 58
          },
          {
            "basis": "Full day",
            "service": "Daycare",
            "competitors": [
              {
                "name": "Sonoran Paws Lodge",
                "normalized": "$39",
                "listedPrice": "$39",
                "normalizationNote": "Comparable listed service",
                "normalizedNumeric": 39
              },
              {
                "name": "Desert Tails Club",
                "normalized": "$39",
                "listedPrice": "$39",
                "normalizationNote": "Comparable listed service",
                "normalizedNumeric": 39
              },
              {
                "name": "Copper State Canine Resort",
                "normalized": "$39",
                "listedPrice": "$39",
                "normalizationNote": "Comparable listed service",
                "normalizedNumeric": 39
              },
              {
                "name": "Papago Pet Retreat",
                "normalized": "$39",
                "listedPrice": "$39",
                "normalizationNote": "Comparable listed service",
                "normalizedNumeric": 39
              },
              {
                "name": "Valley Bark & Stay",
                "normalized": "$39",
                "listedPrice": "$39",
                "normalizationNote": "Comparable listed service",
                "normalizedNumeric": 39
              }
            ],
            "sellerPrice": "$34",
            "sellerNormalized": "$34",
            "sellerNormalizedNumeric": 34
          },
          {
            "basis": "Per night",
            "service": "Luxury suite",
            "competitors": [
              {
                "name": "Sonoran Paws Lodge",
                "normalized": "$88",
                "listedPrice": "$88",
                "normalizationNote": "Comparable listed service",
                "normalizedNumeric": 88
              },
              {
                "name": "Desert Tails Club",
                "normalized": "$88",
                "listedPrice": "$88",
                "normalizationNote": "Comparable listed service",
                "normalizedNumeric": 88
              },
              {
                "name": "Copper State Canine Resort",
                "normalized": "$88",
                "listedPrice": "$88",
                "normalizationNote": "Comparable listed service",
                "normalizedNumeric": 88
              },
              {
                "name": "Papago Pet Retreat",
                "normalized": "$88",
                "listedPrice": "$88",
                "normalizationNote": "Comparable listed service",
                "normalizedNumeric": 88
              },
              {
                "name": "Valley Bark & Stay",
                "normalized": "$88",
                "listedPrice": "$88",
                "normalizationNote": "Comparable listed service",
                "normalizedNumeric": 88
              }
            ],
            "sellerPrice": "$78",
            "sellerNormalized": "$78",
            "sellerNormalizedNumeric": 78
          },
          {
            "basis": "Per service",
            "service": "Bath & brush",
            "competitors": [
              {
                "name": "Sonoran Paws Lodge",
                "normalized": "$54",
                "listedPrice": "$54",
                "normalizationNote": "Comparable listed service",
                "normalizedNumeric": 54
              },
              {
                "name": "Desert Tails Club",
                "normalized": "$54",
                "listedPrice": "$54",
                "normalizationNote": "Comparable listed service",
                "normalizedNumeric": 54
              },
              {
                "name": "Copper State Canine Resort",
                "normalized": "$54",
                "listedPrice": "$54",
                "normalizationNote": "Comparable listed service",
                "normalizedNumeric": 54
              },
              {
                "name": "Papago Pet Retreat",
                "normalized": "$54",
                "listedPrice": "$54",
                "normalizationNote": "Comparable listed service",
                "normalizedNumeric": 54
              },
              {
                "name": "Valley Bark & Stay",
                "normalized": "$54",
                "listedPrice": "$54",
                "normalizationNote": "Comparable listed service",
                "normalizedNumeric": 54
              }
            ],
            "sellerPrice": "$48",
            "sellerNormalized": "$48",
            "sellerNormalizedNumeric": 48
          }
        ],
        "radiusMiles": 12,
        "businessName": "The Cactus Pet Resort",
        "pricingSummary": [
          {
            "status": "underpriced",
            "service": "Standard boarding",
            "variance": "-14.7%",
            "sellerPrice": "$58",
            "competitorAvg": "$68",
            "estAnnualUplift": "$91,000",
            "variancePercent": -14.7,
            "sellerPriceNumeric": 58,
            "competitorAvgNumeric": 68
          },
          {
            "status": "underpriced",
            "service": "Daycare",
            "variance": "-12.8%",
            "sellerPrice": "$34",
            "competitorAvg": "$39",
            "estAnnualUplift": "$46,000",
            "variancePercent": -12.8,
            "sellerPriceNumeric": 34,
            "competitorAvgNumeric": 39
          },
          {
            "status": "underpriced",
            "service": "Luxury suite",
            "variance": "-11.4%",
            "sellerPrice": "$78",
            "competitorAvg": "$88",
            "estAnnualUplift": "$31,000",
            "variancePercent": -11.4,
            "sellerPriceNumeric": 78,
            "competitorAvgNumeric": 88
          },
          {
            "status": "underpriced",
            "service": "Bath & brush",
            "variance": "-11.1%",
            "sellerPrice": "$48",
            "competitorAvg": "$54",
            "estAnnualUplift": "$22,000",
            "variancePercent": -11.1,
            "sellerPriceNumeric": 48,
            "competitorAvgNumeric": 54
          }
        ],
        "recommendations": [
          "Raise standard boarding to $64, then test $68 during peak periods",
          "Raise daycare to $37 and introduce memberships",
          "Bundle grooming with departure-day boarding"
        ],
        "executiveSummary": "Core services are consistently underpriced relative to the illustrative five-competitor sample. A phased program could generate approximately $190,000 of annual revenue before churn and mix effects.",
        "sellerWebsiteUrl": "https://example.com/cactus-pet-resort",
        "competitorsAnalyzed": 5,
        "totalEstimatedUplift": "$190,000"
      },
      "pricingVertical": {
        "flags": [
          {
            "id": "vertical-price-lag",
            "title": "Small annual increases have not closed the market gap",
            "severity": "critical",
            "description": "Boarding and daycare remain materially below the illustrative peer set."
          }
        ],
        "generatedAt": "2026-07-14T12:44:01.954Z",
        "pricingGrid": [
          {
            "id": "boarding-standard",
            "prices": {
              "2024": "$54",
              "2025": "$56",
              "Current": "$58"
            },
            "source": "document",
            "vertical": "Boarding",
            "confidence": "high",
            "serviceName": "Standard Boarding"
          },
          {
            "id": "boarding-suite",
            "prices": {
              "2024": "$72",
              "2025": "$75",
              "Current": "$78"
            },
            "source": "document",
            "vertical": "Boarding",
            "confidence": "high",
            "serviceName": "Luxury Suite"
          },
          {
            "id": "daycare-full",
            "prices": {
              "2024": "$32",
              "2025": "$33",
              "Current": "$34"
            },
            "source": "document",
            "vertical": "Daycare",
            "confidence": "high",
            "serviceName": "Full-Day Daycare"
          },
          {
            "id": "grooming-bath",
            "prices": {
              "2024": "$44",
              "2025": "$46",
              "Current": "$48"
            },
            "source": "document",
            "vertical": "Grooming",
            "confidence": "high",
            "serviceName": "Bath & Brush"
          }
        ],
        "businessName": "The Cactus Pet Resort",
        "overallTrend": "Modest increases below market movement",
        "priceChanges": [
          {
            "date": "2025-01-01",
            "notes": "Annual update",
            "newPrice": "$56",
            "dollarChange": 2,
            "percentChange": 3.7,
            "previousPrice": "$54",
            "serviceVertical": "Boarding"
          },
          {
            "date": "2026-01-01",
            "notes": "Annual update",
            "newPrice": "$58",
            "dollarChange": 2,
            "percentChange": 3.6,
            "previousPrice": "$56",
            "serviceVertical": "Boarding"
          },
          {
            "date": "2026-01-01",
            "notes": "Annual update",
            "newPrice": "$34",
            "dollarChange": 1,
            "percentChange": 3,
            "previousPrice": "$33",
            "serviceVertical": "Daycare"
          }
        ],
        "pricingPeriods": [
          "2024",
          "2025",
          "Current"
        ],
        "recommendations": [
          "Adopt quarterly price review",
          "Introduce peak calendar",
          "Create membership and bundle offers"
        ],
        "executiveSummary": "All three verticals have received only small annual adjustments and remain below the illustrative market. Boarding provides the largest immediate revenue opportunity.",
        "verticalSummaries": [
          {
            "trend": "increasing",
            "vertical": "Boarding",
            "currentPrice": "$58 standard / $78 suite",
            "lastChangeDate": "2026-01-01",
            "recommendation": "Move toward $64 standard and use $68 peak pricing.",
            "avgChangePercent": 3.65,
            "priceChanges24Mo": 2,
            "totalChangePercent": 7.4
          },
          {
            "trend": "increasing",
            "vertical": "Daycare",
            "currentPrice": "$34 full day",
            "lastChangeDate": "2026-01-01",
            "recommendation": "Move to $37 and add recurring memberships.",
            "avgChangePercent": 3.1,
            "priceChanges24Mo": 2,
            "totalChangePercent": 6.25
          },
          {
            "trend": "increasing",
            "vertical": "Grooming",
            "currentPrice": "$48 bath & brush",
            "lastChangeDate": "2026-01-01",
            "recommendation": "Bundle departure-day grooming and adopt coat/size tiers.",
            "avgChangePercent": 4.45,
            "priceChanges24Mo": 2,
            "totalChangePercent": 9.1
          }
        ],
        "currentPricingSource": {
          "notes": "Illustrative public price sheet and management schedule.",
          "confidence": "high",
          "websiteUrl": "https://example.com/cactus-pet-resort",
          "evidenceCount": 8
        }
      },
      "vendorDirectory": [
        {
          "id": "v1",
          "name": "PetExec",
          "notes": "System of record for reservations, vaccination records, occupancy and deposits; buyer admin transfer required.",
          "vendor": "PetExec Inc.",
          "category": "Booking/POS",
          "annualCost": 14400,
          "loginAccess": "Shared",
          "transferable": "yes",
          "contractStatus": "Active"
        },
        {
          "id": "v2",
          "name": "QuickBooks Online Plus",
          "notes": "Owner controls primary admin; add GM and buyer-transition accountant before diligence.",
          "vendor": "Intuit",
          "category": "Accounting",
          "annualCost": 1200,
          "loginAccess": "Owner Only",
          "transferable": "yes",
          "contractStatus": "Month-to-month"
        },
        {
          "id": "v3",
          "name": "Gusto",
          "notes": "Payroll and tax filings; admin transition and MFA reset checklist required.",
          "vendor": "Gusto",
          "category": "Payroll",
          "annualCost": 3120,
          "loginAccess": "Owner Only",
          "transferable": "yes",
          "contractStatus": "Active"
        },
        {
          "id": "v4",
          "name": "Weave",
          "notes": "Phone, SMS reminders and payment links.",
          "vendor": "Weave Communications",
          "category": "Communication",
          "annualCost": 4800,
          "loginAccess": "Manager Access",
          "transferable": "yes",
          "contractStatus": "Active"
        },
        {
          "id": "v5",
          "name": "Klaviyo",
          "notes": "Email automations underused; list and templates should be exported.",
          "vendor": "Klaviyo",
          "category": "Marketing",
          "annualCost": 2400,
          "loginAccess": "Owner Only",
          "transferable": "yes",
          "contractStatus": "Month-to-month"
        },
        {
          "id": "v6",
          "name": "Google Workspace",
          "notes": "Eight mailboxes; ownership and recovery contacts need transition plan.",
          "vendor": "Google",
          "category": "Communication",
          "annualCost": 2160,
          "loginAccess": "Owner Only",
          "transferable": "yes",
          "contractStatus": "Active"
        },
        {
          "id": "v7",
          "name": "Verkada Cameras",
          "notes": "Renewal due October 2026; confirm hardware ownership and assignment rights.",
          "vendor": "Verkada",
          "category": "Security/Cameras",
          "annualCost": 6200,
          "loginAccess": "Manager Access",
          "transferable": "unknown",
          "contractStatus": "Expiring Soon"
        },
        {
          "id": "v8",
          "name": "Pawfinity Forms",
          "notes": "Legacy intake forms contain customer history; export before termination.",
          "vendor": "Pawfinity",
          "category": "CRM",
          "annualCost": 1800,
          "loginAccess": "Shared",
          "transferable": "no",
          "contractStatus": "Active"
        }
      ],
      "litigationSearch": {
        "docResult": null,
        "generatedAt": "2026-07-14T13:28:09.182Z",
        "searchResult": {
          "summary": "No material lawsuit, judgment, bankruptcy, or tax lien was identified in this illustrative review. One active equipment UCC filing should be paid and terminated at closing.",
          "findings": [
            {
              "date": "2023-04-12",
              "type": "ucc_filing",
              "title": "Active equipment financing statement",
              "source": "Illustrative Arizona UCC search",
              "severity": "high",
              "description": "Illustrative UCC-1 filed April 12, 2023 in favor of Desert Equipment Finance covering kennel equipment and proceeds. Estimated payoff is $186,000."
            },
            {
              "date": "2026-07-14",
              "type": "litigation",
              "title": "Civil litigation search clear",
              "source": "Illustrative state and county docket review",
              "severity": "clear",
              "description": "No open material civil case was identified under the entity or owner names in the illustrative search set."
            }
          ],
          "riskLevel": "medium",
          "generatedAt": "2026-07-14T12:44:01.954Z",
          "searchesPerformed": [
            "Arizona entity and UCC index",
            "Maricopa County civil docket",
            "Federal bankruptcy index",
            "Judgment and tax lien index"
          ]
        }
      },
      "clientLocationMap": {
        "clients": [
          {
            "lat": 33.676,
            "lng": -111.978,
            "name": "Demo Customer 001",
            "address": "21001 N Tatum Blvd, Phoenix, AZ 85050",
            "serviceType": "both",
            "geocodeStatus": "success"
          },
          {
            "lat": 33.638,
            "lng": -112.121,
            "name": "Demo Customer 002",
            "address": "16845 N 29th Ave, Phoenix, AZ 85053",
            "serviceType": "boarding",
            "geocodeStatus": "success"
          },
          {
            "lat": 33.655,
            "lng": -111.929,
            "name": "Demo Customer 003",
            "address": "7000 E Mayo Blvd, Phoenix, AZ 85054",
            "serviceType": "daycare",
            "geocodeStatus": "success"
          },
          {
            "lat": 33.612,
            "lng": -111.927,
            "name": "Demo Customer 004",
            "address": "13802 N Scottsdale Rd, Scottsdale, AZ 85254",
            "serviceType": "grooming",
            "geocodeStatus": "success"
          },
          {
            "lat": 33.665,
            "lng": -112.03,
            "name": "Demo Customer 005",
            "address": "19401 N Cave Creek Rd, Phoenix, AZ 85024",
            "serviceType": "both",
            "geocodeStatus": "success"
          },
          {
            "lat": 33.712,
            "lng": -112.112,
            "name": "Demo Customer 006",
            "address": "2501 W Happy Valley Rd, Phoenix, AZ 85085",
            "serviceType": "boarding",
            "geocodeStatus": "success"
          },
          {
            "lat": 33.679,
            "lng": -112.031,
            "name": "Demo Customer 007",
            "address": "21043 N Cave Creek Rd, Phoenix, AZ 85024",
            "serviceType": "daycare",
            "geocodeStatus": "success"
          },
          {
            "lat": 33.64,
            "lng": -111.98,
            "name": "Demo Customer 008",
            "address": "4727 E Bell Rd, Phoenix, AZ 85032",
            "serviceType": "both",
            "geocodeStatus": "success"
          }
        ],
        "summary": {
          "customerPins": 8,
          "within5Miles": 4,
          "within10Miles": 7,
          "within20Miles": 8,
          "primaryTradeArea": "North Phoenix / Desert Ridge"
        },
        "facilityLat": 33.6835,
        "facilityLng": -112.0442,
        "generatedAt": "2026-07-14T12:44:01.954Z",
        "facilityAddress": "1720 E Deer Valley Dr, Phoenix, AZ 85024"
      },
      "ownerGmAssessment": {
        "gm": {
          "gaps": [
            "No budget authority",
            "Limited vendor negotiation exposure",
            "No formal KPI pack"
          ],
          "name": "Jordan Lee",
          "inPlace": true,
          "gmTenure": "3 years",
          "strengths": [
            "Strong staff credibility",
            "Excellent customer recovery",
            "Controls daily labor deployment"
          ],
          "supportive": true,
          "awareOfSale": true,
          "hesitations": [
            "Role clarity",
            "Compensation",
            "Decision authority"
          ],
          "soloOutcome": "Service quality remains stable; financial and marketing decisions wait for owner approval",
          "totalTenure": "5 years",
          "compensation": "$78,000 plus discretionary bonus",
          "marketAligned": "Below",
          "fullOrPartTime": "Full-Time",
          "retentionNotes": "A written retention arrangement and expanded decision rights are recommended before launch.",
          "soloExperience": "Runs the site independently during owner travel",
          "contentWithComp": false,
          "hourlyOrSalaried": "Salaried",
          "dayToDayOwnership": "Staff scheduling, customer recovery, animal-care standards, inventory, and daily facility operations",
          "independenceScore": 7,
          "retentionCommitment": "Medium",
          "retentionRiskRating": "Medium",
          "retentionConversation": false,
          "willingToInvolveInTransition": true
        },
        "flags": [
          {
            "id": "ogm-owner-dependency",
            "title": "Owner controls critical commercial functions",
            "section": "Owner",
            "severity": "deal-risk",
            "description": "Finance, pricing, marketing, and key external relationships are not yet transferable without the owner."
          },
          {
            "id": "ogm-gm-retention",
            "title": "GM retention is not documented",
            "section": "GM",
            "severity": "negotiation",
            "description": "The GM is important to continuity but has no retention proposal and is below the illustrative market range."
          },
          {
            "id": "ogm-bench-positive",
            "title": "Experienced operating leads are in place",
            "section": "Bench",
            "severity": "positive",
            "description": "Two supervisors can absorb additional daily responsibility with training."
          }
        ],
        "owners": [
          {
            "name": "Elena Marquez",
            "role": "Finance, pricing, marketing, vendor negotiations, and escalated customer matters",
            "title": "Founder & Managing Member",
            "hoursPerWeek": 32,
            "stayRequired": true,
            "postCloseRole": "Transition consultant",
            "dependencyNotes": "Several recurring processes are not documented and approval thresholds remain centralized with the owner.",
            "dependencyRating": "High",
            "externalHireCost": "$85,000–$105,000 annualized",
            "replacementHours": 20,
            "replacementRoles": [
              "Controller/bookkeeper oversight",
              "Marketing ownership",
              "Vendor negotiation"
            ],
            "internalSuccessor": "Jordan Lee, subject to training and expanded authority",
            "postCloseDuration": "Six months",
            "postCloseIntention": "exit",
            "criticalHoursPerWeek": 18,
            "criticalRelationships": [
              "Landlord",
              "Primary veterinarian",
              "Equipment lender",
              "Top referral partners"
            ],
            "replacementExperience": "Multi-unit pet services or hospitality operator"
          }
        ],
        "seniorTeam": [
          {
            "name": "Priya Shah",
            "title": "Boarding Supervisor",
            "tenure": "4 years",
            "couldStepUp": true,
            "hourlyOrSalaried": "Hourly",
            "responsibilities": "Boarding team and medication protocols"
          },
          {
            "name": "Mateo Ruiz",
            "title": "Daycare Lead",
            "tenure": "3 years",
            "couldStepUp": true,
            "hourlyOrSalaried": "Hourly",
            "responsibilities": "Playgroups, training, and incident documentation"
          }
        ],
        "generatedAt": "2026-07-14T12:44:01.954Z",
        "counselItems": [
          "Document transition consulting scope in the purchase agreement",
          "Address retention payments and confidentiality with employment counsel"
        ],
        "benchStrength": "Moderate",
        "gmRetentionRisk": "Medium",
        "recommendations": [
          "Execute a six-month owner transition plan",
          "Offer the GM a retention bonus and market adjustment",
          "Create a weekly KPI pack",
          "Document pricing, purchasing, and customer escalation SOPs"
        ],
        "executiveSummary": "The owner remains the sole decision-maker for finance, pricing, key vendor relationships, and local marketing. The GM runs daily service delivery effectively but has not received a retention proposal and currently earns below the illustrative market range. Transition readiness is low until responsibilities are documented and the GM is retained.",
        "ownerDependencyRating": "High",
        "overallTransitionReadiness": "Low"
      },
      "propertyOwnership": "lease",
      "agentFormResponses": {
        "businessName": "The Cactus Pet Resort",
        "annualRevenue": "1700000",
        "facebookHandle": "@CactusPetResort",
        "businessAddress": "1720 E Deer Valley Dr, Phoenix, AZ 85024",
        "businessWebsite": "https://example.com/cactus-pet-resort",
        "competitor1Name": "Sonoran Paws Lodge",
        "competitor2Name": "Desert Tails Club",
        "competitor3Name": "Copper State Canine Resort",
        "competitor4Name": "Papago Pet Retreat",
        "competitor5Name": "Valley Bark & Stay",
        "instagramHandle": "@cactuspetresort",
        "businessCategory": "Pet boarding, daycare, and grooming",
        "normalizedEbitda": "450000",
        "propertyOwnership": "lease",
        "bookingPlatformUrl": "https://booking.example.com/cactus",
        "competitor1Website": "https://example.com/sonoran-paws",
        "competitor2Website": "https://example.com/desert-tails",
        "competitor3Website": "https://example.com/copper-state",
        "competitor4Website": "https://example.com/papago-pet",
        "competitor5Website": "https://example.com/valley-bark",
        "vendorDirectoryList": "PetExec | PetExec Inc. | Booking/POS | 14400 | Active | yes | Shared | System of record for reservations, vaccination records, occupancy and deposits; buyer admin transfer required.\nQuickBooks Online Plus | Intuit | Accounting | 1200 | Month-to-month | yes | Owner Only | Owner controls primary admin; add GM and buyer-transition accountant before diligence.\nGusto | Gusto | Payroll | 3120 | Active | yes | Owner Only | Payroll and tax filings; admin transition and MFA reset checklist required.\nWeave | Weave Communications | Communication | 4800 | Active | yes | Manager Access | Phone, SMS reminders and payment links.\nKlaviyo | Klaviyo | Marketing | 2400 | Month-to-month | yes | Owner Only | Email automations underused; list and templates should be exported.\nGoogle Workspace | Google | Communication | 2160 | Active | yes | Owner Only | Eight mailboxes; ownership and recovery contacts need transition plan.\nVerkada Cameras | Verkada | Security/Cameras | 6200 | Expiring Soon | unknown | Manager Access | Renewal due October 2026; confirm hardware ownership and assignment rights.\nPawfinity Forms | Pawfinity | CRM | 1800 | Active | no | Shared | Legacy intake forms contain customer history; export before termination.",
        "googleBusinessLocations": "Phoenix, Arizona",
        "professionalAdvisorsList": "Accountant | Maya Chen, CPA | Chen & Holloway Advisory | maya.chen@example.com | (602) 555-0171 | yes | Prepared reviewed financial statements and normalized EBITDA bridge; available for buyer Q&A.\nLawyer | Daniel Ortiz, Esq. | Ortiz Business Law PLLC | daniel.ortiz@example.com | (602) 555-0188 | yes | Entity, transaction and landlord-consent counsel; should coordinate UCC payoff and permit correction.\nBookkeeper | Nina Patel | Patel Ledger Services | nina.patel@example.com | (480) 555-0134 | yes | Maintains QuickBooks, payroll reconciliations and monthly close schedules.\nOther | Marcus Hill | Southwest Risk Partners | marcus.hill@example.com | (602) 555-0162 | yes | Insurance broker; can supply five-year loss runs, policy schedules and tail-coverage options.\nContractor | Leah Morgan | Sonoran Commercial Realty | leah.morgan@example.com | (480) 555-0199 | unknown | Lease advisor; not yet formally engaged for extension or transfer-consent negotiation."
      },
      "employeeCompReport": {
        "report": "# Employee Staffing & Compensation\n\nThe illustrative roster contains **12 employees**: 7 full-time and 5 part-time, with annualized base payroll of approximately **$529,360**. Frontline pay is broadly competitive. The GM's $78,000 salary appears below the illustrative market range for the breadth of responsibilities.\n\n## Key Findings\n\n- The GM and two supervisors form a credible operating core.\n- Five part-time roles provide weekend flexibility but increase scheduling complexity.\n- No formal GM retention or transaction bonus is documented.\n- Cross-training is needed for scheduling, purchasing, and customer escalation.\n\n## Readiness\n\n**🔴 RED — Implement GM retention and role-transfer planning before sale launch.**",
        "summary": {
          "avgSalary": 78000,
          "avgHourlyRate": 19.27,
          "fullTimeCount": 7,
          "partTimeCount": 5,
          "roleBreakdown": {
            "Groomer": 1,
            "Daycare Lead": 1,
            "General Manager": 1,
            "Daycare Attendant": 1,
            "Weekend Attendant": 1,
            "Boarding Supervisor": 1,
            "Pet Care Specialist": 3,
            "Client Services Lead": 1,
            "Client Services Associate": 1,
            "Senior Pet Care Specialist": 1
          },
          "totalHeadcount": 12,
          "locationBreakdown": {
            "Phoenix Main Facility": 12
          },
          "totalAnnualPayroll": 529360
        },
        "employees": [
          {
            "id": "cactus-emp-1",
            "payType": "Salary",
            "hireDate": "2021-06-14",
            "jobTitle": "General Manager",
            "hourlyRate": 37.5,
            "rehireDate": "",
            "annualSalary": 78000,
            "employeeName": "Jordan Lee",
            "employeeType": "Regular Full Time",
            "workLocation": "Phoenix Main Facility",
            "benefitClassCode": "FT",
            "payRateEffectiveDate": "2026-01-01",
            "benefitClassDescription": "Full-Time Medical and PTO"
          },
          {
            "id": "cactus-emp-2",
            "payType": "Hourly",
            "hireDate": "2022-02-07",
            "jobTitle": "Boarding Supervisor",
            "hourlyRate": 25,
            "rehireDate": "",
            "annualSalary": 52000,
            "employeeName": "Priya Shah",
            "employeeType": "Regular Full Time",
            "workLocation": "Phoenix Main Facility",
            "benefitClassCode": "FT",
            "payRateEffectiveDate": "2026-01-01",
            "benefitClassDescription": "Full-Time Medical and PTO"
          },
          {
            "id": "cactus-emp-3",
            "payType": "Hourly",
            "hireDate": "2023-01-16",
            "jobTitle": "Daycare Lead",
            "hourlyRate": 23,
            "rehireDate": "",
            "annualSalary": 47840,
            "employeeName": "Mateo Ruiz",
            "employeeType": "Regular Full Time",
            "workLocation": "Phoenix Main Facility",
            "benefitClassCode": "FT",
            "payRateEffectiveDate": "2026-01-01",
            "benefitClassDescription": "Full-Time Medical and PTO"
          },
          {
            "id": "cactus-emp-4",
            "payType": "Hourly",
            "hireDate": "2023-05-01",
            "jobTitle": "Senior Pet Care Specialist",
            "hourlyRate": 21,
            "rehireDate": "",
            "annualSalary": 43680,
            "employeeName": "Ava Thompson",
            "employeeType": "Regular Full Time",
            "workLocation": "Phoenix Main Facility",
            "benefitClassCode": "FT",
            "payRateEffectiveDate": "2026-01-01",
            "benefitClassDescription": "Full-Time Medical and PTO"
          },
          {
            "id": "cactus-emp-5",
            "payType": "Hourly",
            "hireDate": "2024-03-18",
            "jobTitle": "Groomer",
            "hourlyRate": 26,
            "rehireDate": "",
            "annualSalary": 54080,
            "employeeName": "Noah Kim",
            "employeeType": "Regular Full Time",
            "workLocation": "Phoenix Main Facility",
            "benefitClassCode": "FT",
            "payRateEffectiveDate": "2026-01-01",
            "benefitClassDescription": "Full-Time Medical and PTO"
          },
          {
            "id": "cactus-emp-6",
            "payType": "Hourly",
            "hireDate": "2024-06-10",
            "jobTitle": "Client Services Lead",
            "hourlyRate": 22,
            "rehireDate": "",
            "annualSalary": 45760,
            "employeeName": "Mia Patel",
            "employeeType": "Regular Full Time",
            "workLocation": "Phoenix Main Facility",
            "benefitClassCode": "FT",
            "payRateEffectiveDate": "2026-01-01",
            "benefitClassDescription": "Full-Time Medical and PTO"
          },
          {
            "id": "cactus-emp-7",
            "payType": "Hourly",
            "hireDate": "2024-09-09",
            "jobTitle": "Pet Care Specialist",
            "hourlyRate": 19,
            "rehireDate": "",
            "annualSalary": 39520,
            "employeeName": "Liam Brooks",
            "employeeType": "Regular Full Time",
            "workLocation": "Phoenix Main Facility",
            "benefitClassCode": "FT",
            "payRateEffectiveDate": "2026-01-01",
            "benefitClassDescription": "Full-Time Medical and PTO"
          },
          {
            "id": "cactus-emp-8",
            "payType": "Hourly",
            "hireDate": "2025-01-20",
            "jobTitle": "Pet Care Specialist",
            "hourlyRate": 17,
            "rehireDate": "",
            "annualSalary": 35360,
            "employeeName": "Sophia Nguyen",
            "employeeType": "Regular Part Time",
            "workLocation": "Phoenix Main Facility",
            "benefitClassCode": "PT",
            "payRateEffectiveDate": "2026-01-01",
            "benefitClassDescription": "Part-Time PTO"
          },
          {
            "id": "cactus-emp-9",
            "payType": "Hourly",
            "hireDate": "2025-03-03",
            "jobTitle": "Daycare Attendant",
            "hourlyRate": 16,
            "rehireDate": "",
            "annualSalary": 33280,
            "employeeName": "Ethan Garcia",
            "employeeType": "Regular Part Time",
            "workLocation": "Phoenix Main Facility",
            "benefitClassCode": "PT",
            "payRateEffectiveDate": "2026-01-01",
            "benefitClassDescription": "Part-Time PTO"
          },
          {
            "id": "cactus-emp-10",
            "payType": "Hourly",
            "hireDate": "2025-05-12",
            "jobTitle": "Client Services Associate",
            "hourlyRate": 17,
            "rehireDate": "",
            "annualSalary": 35360,
            "employeeName": "Isabella Clark",
            "employeeType": "Regular Part Time",
            "workLocation": "Phoenix Main Facility",
            "benefitClassCode": "PT",
            "payRateEffectiveDate": "2026-01-01",
            "benefitClassDescription": "Part-Time PTO"
          },
          {
            "id": "cactus-emp-11",
            "payType": "Hourly",
            "hireDate": "2025-08-04",
            "jobTitle": "Pet Care Specialist",
            "hourlyRate": 16,
            "rehireDate": "",
            "annualSalary": 33280,
            "employeeName": "Lucas Hall",
            "employeeType": "Regular Part Time",
            "workLocation": "Phoenix Main Facility",
            "benefitClassCode": "PT",
            "payRateEffectiveDate": "2026-01-01",
            "benefitClassDescription": "Part-Time PTO"
          },
          {
            "id": "cactus-emp-12",
            "payType": "Hourly",
            "hireDate": "2026-01-12",
            "jobTitle": "Weekend Attendant",
            "hourlyRate": 15,
            "rehireDate": "",
            "annualSalary": 31200,
            "employeeName": "Amelia Young",
            "employeeType": "Regular Part Time",
            "workLocation": "Phoenix Main Facility",
            "benefitClassCode": "PT",
            "payRateEffectiveDate": "2026-01-01",
            "benefitClassDescription": "Part-Time PTO"
          }
        ],
        "generatedAt": "2026-07-14T12:44:01.954Z"
      },
      "facilityReviewMode": "advisor",
      "salesProcessReview": {
        "summary": "The resort benefits from strong inbound demand and reputation, but inquiry handling is inconsistent by channel and conversion is not managed as a measurable funnel. Front-desk staff respond quickly during business hours, yet missed calls, waitlist outcomes, tours, deposits, add-on attachment and lost-booking reasons are not consistently tracked. A buyer can improve revenue quality through standardized discovery, same-day follow-up, automated deposits and weekly conversion reporting.",
        "generatedAt": "2026-07-14T13:30:00.000Z",
        "keyFindings": [
          "Average first response is approximately 18 minutes during business hours but next-day for some after-hours web leads.",
          "Staff quote base price before consistently exploring stay purpose, medication, play preferences and grooming add-ons.",
          "Deposits are collected on approximately 72% of peak reservations; exceptions are not documented.",
          "No common lost-reason taxonomy exists for price, vaccination, capacity, location or service-fit losses.",
          "Tour-to-booking conversion appears strong but is not measured in the booking system.",
          "Review requests are effective after completed stays but no reactivation sequence targets inactive customers."
        ],
        "recommendations": [
          "Adopt a six-question discovery script for every phone and web inquiry.",
          "Set a ten-minute response SLA and route after-hours leads into an automated acknowledgement queue.",
          "Require deposits for all peak and holiday reservations with documented manager exceptions.",
          "Track inquiry source, outcome, lost reason, lead time and add-on attachment weekly.",
          "Create tour follow-up, waitlist and inactive-customer reactivation sequences.",
          "Coach front desk monthly using five recorded calls and a conversion scorecard."
        ],
        "benchmarkComparisons": [
          {
            "actual": "18 minutes",
            "metric": "Business-hours first response",
            "status": "below",
            "benchmark": "Under 10 minutes"
          },
          {
            "actual": "Estimated 54%",
            "metric": "Lead-to-reservation conversion",
            "status": "below",
            "benchmark": "60%-70%"
          },
          {
            "actual": "72%",
            "metric": "Peak reservation deposit rate",
            "status": "below",
            "benchmark": "90%+"
          },
          {
            "actual": "19%",
            "metric": "Add-on attachment",
            "status": "below",
            "benchmark": "25%-35%"
          },
          {
            "actual": "31 new reviews / 90 days",
            "metric": "Review request completion",
            "status": "above",
            "benchmark": "Top quartile local"
          },
          {
            "actual": "Partial",
            "metric": "No-show and cancellation capture",
            "status": "below",
            "benchmark": "100% coded"
          }
        ]
      },
      "digitalPresenceForm": {
        "websiteUrl": "https://example.com/cactus-pet-resort",
        "businessName": "The Cactus Pet Resort",
        "facebookHandle": "@CactusPetResort",
        "instagramHandle": "@cactuspetresort",
        "bookingPlatformUrl": "https://booking.example.com/cactus",
        "googleBusinessLocations": "Phoenix, Arizona"
      },
      "agentOverviewReports": {
        "ws1": {
          "agents": [
            {
              "agentId": "ttm",
              "agentName": "Valuation Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "employee_obligations",
              "agentName": "Employee Obligations Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "employee_comp",
              "agentName": "Employee Staffing & Compensation Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "insurance_review",
              "agentName": "Insurance Review Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "lease_analysis",
              "agentName": "Lease Analysis Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "litigation_search",
              "agentName": "Litigation & Liens Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "contract_analysis",
              "agentName": "Material Contracts Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "org_chart_review",
              "agentName": "Org Chart Review Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "owner_gm_assessment",
              "agentName": "Owner & GM Assessment Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "ownership_verification",
              "agentName": "Ownership Verification Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "permits_zoning",
              "agentName": "Permits & Zoning Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "professional_advisors",
              "agentName": "Professional Advisors Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "vendor_directory",
              "agentName": "Software & Vendors Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "client_location_map",
              "agentName": "Client Location Map Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "legal_entity_search",
              "agentName": "Legal Reports & Entity Search Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "tax_liability_review",
              "agentName": "Tax Liability Review Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "ws1_assessment",
              "agentName": "WS1 Assessment Report",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "ws1_roadmap",
              "agentName": "WS1 Sales Readiness Roadmap",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            }
          ],
          "markdown": "# WS1 Complete Agent Overview\n\nAll 18 WS1 outputs are complete and synthesized in the 23 KB Internal Assessment and 18-action Sales Readiness Roadmap. Current readiness is **54/100 — RED**, driven by lease/site control, equipment UCC release, permit/zoning evidence, management continuity, and legacy-obligation cleanup. The target is **88/100 — GREEN** after the 90-day evidence plan.\n\nThe full combined overview contains the agent-by-agent coverage matrix, integrated risk register, valuation bridge, buyer package, and 30/60/90 plan.",
          "updatedAt": "2026-07-14T15:15:00.000Z",
          "agentCount": 18,
          "clientName": "The Cactus Pet Resort",
          "workstream": "ws1",
          "generatedAt": "2026-07-14T15:15:00.000Z",
          "generatedBy": "Cantara Demo Review Team",
          "completedCount": 18,
          "workstreamLabel": "Workstream 1 — Risk Mitigation"
        },
        "ws2": {
          "agents": [
            {
              "agentId": "ttm",
              "agentName": "Valuation Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "client_location_map",
              "agentName": "Client Location Map Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "competitor_analysis",
              "agentName": "Competitor Analysis Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "digital_presence",
              "agentName": "Digital Presence Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "facility_review",
              "agentName": "Facility Review Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "occupancy_review",
              "agentName": "Occupancy Review Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "pricing_analysis",
              "agentName": "Competitive Pricing Analysis Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "pricing_vertical",
              "agentName": "Pricing by Vertical Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "sales_process_review",
              "agentName": "Sales Process Review Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "ws2_assessment",
              "agentName": "WS2 Assessment Report",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "ws2_roadmap",
              "agentName": "WS2 Sales Readiness Roadmap",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            }
          ],
          "markdown": "# WS2 Complete Agent Overview\n\nAll 11 WS2 outputs are complete and synthesized in the 17 KB Internal Assessment and 16-action Sales Readiness Roadmap. Current readiness is **63/100 — YELLOW** with a target of **90/100 — GREEN**. The business has a supportable $450,000 normalized EBITDA base, 4.9-star reputation, and approximately $190,000 of identified gross commercial opportunity that remains separate from historical EBITDA until proven.\n\nThe full combined overview contains the agent-by-agent coverage matrix, commercial KPI definitions, cross-agent dependencies, buyer package, and 30/60/90 plan.",
          "updatedAt": "2026-07-14T15:15:00.000Z",
          "agentCount": 11,
          "clientName": "The Cactus Pet Resort",
          "workstream": "ws2",
          "generatedAt": "2026-07-14T15:15:00.000Z",
          "generatedBy": "Cantara Demo Review Team",
          "completedCount": 11,
          "workstreamLabel": "Workstream 2 — Profitability & Growth"
        },
        "both": {
          "agents": [
            {
              "agentId": "ttm",
              "agentName": "Valuation Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "employee_obligations",
              "agentName": "Employee Obligations Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "employee_comp",
              "agentName": "Employee Staffing & Compensation Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "insurance_review",
              "agentName": "Insurance Review Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "lease_analysis",
              "agentName": "Lease Analysis Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "litigation_search",
              "agentName": "Litigation & Liens Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "contract_analysis",
              "agentName": "Material Contracts Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "org_chart_review",
              "agentName": "Org Chart Review Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "owner_gm_assessment",
              "agentName": "Owner & GM Assessment Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "ownership_verification",
              "agentName": "Ownership Verification Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "permits_zoning",
              "agentName": "Permits & Zoning Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "professional_advisors",
              "agentName": "Professional Advisors Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "vendor_directory",
              "agentName": "Software & Vendors Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "client_location_map",
              "agentName": "Client Location Map Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "legal_entity_search",
              "agentName": "Legal Reports & Entity Search Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "tax_liability_review",
              "agentName": "Tax Liability Review Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "ws1_assessment",
              "agentName": "WS1 Assessment Report",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "ws1_roadmap",
              "agentName": "WS1 Sales Readiness Roadmap",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "competitor_analysis",
              "agentName": "Competitor Analysis Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "digital_presence",
              "agentName": "Digital Presence Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "facility_review",
              "agentName": "Facility Review Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "occupancy_review",
              "agentName": "Occupancy Review Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "pricing_analysis",
              "agentName": "Competitive Pricing Analysis Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "pricing_vertical",
              "agentName": "Pricing by Vertical Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "sales_process_review",
              "agentName": "Sales Process Review Agent",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "ws2_assessment",
              "agentName": "WS2 Assessment Report",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            },
            {
              "agentId": "ws2_roadmap",
              "agentName": "WS2 Sales Readiness Roadmap",
              "completed": true,
              "completedAt": "2026-07-14T15:15:00.000Z"
            }
          ],
          "markdown": "# The Cactus Pet Resort — Complete Agent Overview\n\n## Executive Summary\n\nThis is an **illustrative demonstration engagement** using synthetic supporting records. The Cactus Pet Resort is modeled as a Phoenix, Arizona leased-location pet resort with **$1.70 million revenue**, **$450,000 normalized EBITDA**, a **4.9 Google rating from 214 reviews**, and an indicated valuation range of **$2.25 million to $3.15 million** with a **$2.70 million midpoint**.\n\nAll **27 WS1 and WS2 agents** have completed outputs. The operating business is attractive, but readiness is **RED for legal/risk preparation** and **YELLOW for commercial proof**. The five most important cross-workstream issues are:\n\n1. Landlord consent, extended site control and outdoor-yard documentation.\n2. $186,000 equipment UCC payoff and termination.\n3. Kennel permit legal-name correction and written zoning confirmation.\n4. Owner dependency plus unsigned GM retention and delegated authority.\n5. Pricing and capacity upside that requires daily KPI evidence before buyers will credit it.\n\n## Engagement Dashboard\n\n| Metric | Result | Read |\n|---|---:|---|\n| Revenue | $1,700,000 | Attractive single-site scale |\n| Reported EBITDA | $392,000 | Reconciled to books |\n| Normalized EBITDA | $450,000 | $58,000 reviewed adjustments |\n| Valuation | $2.25M / $2.70M / $3.15M | 5.0x / 6.0x / 7.0x |\n| WS1 readiness | RED | Curable pre-market legal and continuity items |\n| WS2 readiness | YELLOW | Strong fundamentals; upside evidence in progress |\n| Digital presence | 82 / 100 | Buyer-supportive reputation |\n| Facility | 78 / 100 | Good, with defined capital items |\n| Average occupancy | 66% | Peak constraint and weekday slack |\n| Gross pricing opportunity | ~$190,000 | Before churn, mix and execution effects |\n\n## Integrated Risk Register\n\n| Priority | Cross-Agent Finding | Agents Connected | Required Evidence |\n|---|---|---|---|\n| Critical | Lease transfer and site control | Lease, Permits, Facility, Legal | Consent term sheet, amendment, estoppel, premises exhibit |\n| Critical | Equipment lien | Litigation, Ownership, Valuation | Payoff letter and UCC-3 |\n| Critical | Permit and outdoor-use record gaps | Permits, Lease, Facility | Corrected permit and zoning letter |\n| High | Owner / GM transition | Owner-GM, Org Chart, Employee Obligations, Employee Comp | Retention agreement, authority matrix, SOPs |\n| High | Unproven pricing and capacity upside | Pricing, Occupancy, Sales, WS2 reports | 90 days of rate, churn, denial, conversion and RevPAU data |\n| High | TPT and contractor exposure | Tax, Employee Obligations | Lookback, clearance, counsel memo and escrow decision |\n| Medium | Material contract deadlines | Contracts, Vendors, Digital | Notices, consents, exports and credential plan |\n\n## Agent-by-Agent Summary\n\n### 1. Valuation Agent\n\n**Completed review:** Completed valuation at $2.25M / $2.70M / $3.15M using 5.0x / 6.0x / 7.0x normalized EBITDA of $450,000. Reported EBITDA of $392,000 is bridged by $58,000 of reviewed normalization items.\n\n**Recommended follow-up:** Preserve monthly close support and buyer evidence for add-backs; do not present operating upside as an add-back.\n\n### 2. Employee Obligations Agent\n\n**Completed review:** Reviewed workforce agreements, benefits, PTO, contractor classification and restrictive covenants. Identified unsigned GM retention, absent seller covenant, $34,680 accrued PTO and $22,000-$38,000 illustrative contractor exposure.\n\n**Recommended follow-up:** Execute retention and seller covenants, decide PTO treatment, and complete contractor classification review.\n\n### 3. Employee Staffing & Compensation Agent\n\n**Completed review:** Mapped 24 workers, management span, compensation, tenure and market position. GM pay and retention are below transaction-readiness targets while frontline labor is generally within local ranges.\n\n**Recommended follow-up:** Approve GM market adjustment and transaction bonus; reconcile roster quarterly to payroll.\n\n### 4. Insurance Review Agent\n\n**Completed review:** Reviewed a resolved $18,750 guest liability claim and a closed $4,260 workers compensation strain claim. No open reserves or recurring loss pattern was identified.\n\n**Recommended follow-up:** Refresh carrier-issued five-year loss runs and coordinate tail/closing coverage.\n\n### 5. Lease Analysis Agent\n\n**Completed review:** Reviewed term, rent, assignment, guaranty, outdoor premises, CAM, repair, casualty and default provisions. Ten detailed findings and ten flags identify consent, site-control and outdoor-yard risks.\n\n**Recommended follow-up:** Negotiate consent, term extension, guaranty release, premises exhibit and HVAC responsibility before buyer outreach.\n\n### 6. Litigation & Liens Agent\n\n**Completed review:** Illustrative federal, Arizona, Maricopa County, UCC and judgment searches found no material lawsuit or judgment. A $186,000 equipment UCC filing remains active.\n\n**Recommended follow-up:** Obtain payoff letter and UCC-3 termination mechanics as a closing deliverable; refresh searches at signing and closing.\n\n### 7. Material Contracts Agent\n\n**Completed review:** Reviewed five material operating contracts. Waste services present a three-year auto-renewal risk; security assignment, linen minimums, payment processing and marketing attribution require action.\n\n**Recommended follow-up:** Deliver non-renewal notice, secure written consents, test data exports and complete the eight-item contract checklist.\n\n### 8. Org Chart Review Agent\n\n**Completed review:** Mapped a 24-person organization with credible GM and AGM coverage, but owner, GM, grooming lead and bookkeeper dependencies remain. Transition readiness is medium.\n\n**Recommended follow-up:** Transfer authority, cross-train finance/grooming coverage and implement a responsibility matrix.\n\n### 9. Owner & GM Assessment Agent\n\n**Completed review:** Elena retains strategic and administrative control while Jordan Lee independently operates the facility. GM independence scores 7/10, but retention and delegated authority are not documented.\n\n**Recommended follow-up:** Sign 12-month retention, issue authority matrix and use a six-month owner transition plan.\n\n### 10. Ownership Verification Agent\n\n**Completed review:** Confirmed illustrative 100% ownership by Elena Marquez and transaction authority through Cactus Pet Resort LLC. Routine certified copies and member consent remain closing items.\n\n**Recommended follow-up:** Order fresh certificates and execute written transaction authorization.\n\n### 11. Permits & Zoning Agent\n\n**Completed review:** Reviewed kennel permit, business license, certificate of occupancy and zoning evidence. Permit legal-name correction and written outdoor-play confirmation remain deal risks.\n\n**Recommended follow-up:** Correct the DBA, obtain zoning confirmation and calendar all renewals.\n\n### 12. Professional Advisors Agent\n\n**Completed review:** Mapped CPA, transaction counsel, bookkeeper, insurance broker and lease advisor participation. Four are willing to support diligence; lease advisor participation is unconfirmed.\n\n**Recommended follow-up:** Issue advisor diligence calendar and formally engage real-estate support.\n\n### 13. Software & Vendors Agent\n\n**Completed review:** Inventoried eight core systems totaling approximately $36,080 annual cost. Owner-only admin access and one nontransferable legacy intake platform create transition risk.\n\n**Recommended follow-up:** Add manager admins, export data, document MFA and resolve camera/legacy-form transfer.\n\n### 14. Client Location Map Agent\n\n**Completed review:** Mapped eight illustrative customer clusters and a dense north-Phoenix trade area. Customer concentration is favorable with no single local pocket dominating revenue.\n\n**Recommended follow-up:** Refresh geocoding quarterly and support the location thesis with customer-level retention and drive-time data.\n\n### 15. Legal Reports & Entity Search Agent\n\n**Completed review:** Entity is active and in good standing in the illustrative search. Routine certificates, DBA evidence and closing-date refreshes are required.\n\n**Recommended follow-up:** Order certified formation, status and DBA records immediately before diligence.\n\n### 16. Tax Liability Review Agent\n\n**Completed review:** Three years of federal and Arizona filings are generally current. Estimated Arizona TPT exposure is $13,800-$15,000; contractor exposure is addressed separately.\n\n**Recommended follow-up:** Complete TPT lookback, obtain tax clearance and negotiate seller indemnity/escrow.\n\n### 17. WS1 Assessment Report\n\n**Completed review:** Integrated legal, workforce, lease, lien, permit, tax, contract and transition findings. Overall WS1 readiness is RED because several curable pre-market issues can delay financing or closing.\n\n**Recommended follow-up:** Run a coordinated 90-day legal and operating readiness program.\n\n### 18. WS1 Sales Readiness Roadmap\n\n**Completed review:** Converted WS1 findings into a 12-item checklist and 30/60/90-day plan covering consent, liens, permits, retention, tax and data-room evidence.\n\n**Recommended follow-up:** Close red actions first and preserve third-party evidence for each completed item.\n\n### 19. Competitor Analysis Agent\n\n**Completed review:** Compared five illustrative competitors within a 12-mile market. Cactus leads on 4.9-star reputation but lacks pricing tiers and recurring daycare architecture.\n\n**Recommended follow-up:** Protect reputation while testing premium packages and membership offers.\n\n### 20. Digital Presence Agent\n\n**Completed review:** Scored digital presence 82/100. Google and Instagram are strong; mobile booking conversion, attribution and owner-controlled credentials are the principal gaps.\n\n**Recommended follow-up:** Instrument the funnel, centralize account control and demonstrate three months of lead reporting.\n\n### 21. Facility Review Agent\n\n**Completed review:** Scored the facility 78/100 (Good) across six zones. HVAC reserve, shade, drainage and preventive-maintenance evidence require buyer-ready support.\n\n**Recommended follow-up:** Commission HVAC report and complete prioritized presentation and capital items.\n\n### 22. Occupancy Review Agent\n\n**Completed review:** Average blended utilization is approximately 66%, with holiday boarding near 91% and weekday troughs near 48%. Daily denial and RevPAU data are incomplete.\n\n**Recommended follow-up:** Implement daily capacity, denial, cancellation and vertical utilization reporting.\n\n### 23. Competitive Pricing Analysis Agent\n\n**Completed review:** Core boarding, daycare and grooming rates are approximately 8%-15% below the illustrative peer set, creating an estimated $190,000 gross annual opportunity before churn and mix.\n\n**Recommended follow-up:** Phase increases, monitor cohort churn and avoid adding unproven upside to normalized EBITDA.\n\n### 24. Pricing by Vertical Agent\n\n**Completed review:** Twenty-four-month pricing shows small annual increases across boarding, daycare and grooming. Boarding offers the largest immediate yield opportunity.\n\n**Recommended follow-up:** Move standard boarding toward $64, test peak rates, then implement daycare memberships and grooming bundles.\n\n### 25. Sales Process Review Agent\n\n**Completed review:** Reviewed inquiry handling, deposits, conversion, add-on attachment and follow-up. Response time, deposit compliance and loss-reason capture trail benchmarks.\n\n**Recommended follow-up:** Adopt discovery script, ten-minute SLA, deposit rules and weekly funnel scorecard.\n\n### 26. WS2 Assessment Report\n\n**Completed review:** Integrated valuation, location, competitor, digital, facility, occupancy, pricing and sales findings. Overall WS2 readiness is YELLOW: strong fundamentals with measurable upside not yet proven.\n\n**Recommended follow-up:** Produce three months of pricing, occupancy, conversion and churn evidence.\n\n### 27. WS2 Sales Readiness Roadmap\n\n**Completed review:** Converted commercial findings into a ten-item seller-facing checklist and 90-day operating test plan.\n\n**Recommended follow-up:** Complete red pricing/capacity actions, then package KPI evidence for buyer meetings.\n\n## 30 / 60 / 90-Day Integrated Plan\n\n### Days 1-30\n- Open landlord, permit, tax and lien workstreams with named owners.\n- Sign GM retention and issue management authority matrix.\n- Commission HVAC condition report and complete contract notice calendar.\n- Establish daily occupancy, denial, conversion and pricing baseline dashboards.\n\n### Days 31-60\n- Obtain landlord and municipal written evidence.\n- Complete TPT lookback and contractor-classification review.\n- Launch controlled boarding/daycare price tests and membership pilot.\n- Transfer system administration, MFA recovery and customer data exports.\n\n### Days 61-90\n- Refresh valuation, lien, legal and permit searches.\n- Package three months of commercial KPI evidence.\n- Complete buyer-ready data-room index and management presentation.\n- Export final WS1/WS2 reports, roadmaps and this overview.\n\n## Overall Recommendation\n\nProceed with a disciplined pre-market readiness program. The modeled business has strong economics and reputation, but buyers should receive evidence—not promises—for legal transferability, management continuity and commercial upside. Complete the critical WS1 items before confidential marketing, and use the WS2 90-day operating tests to defend the midpoint valuation.\n\n\n---\n\n# Integrated Readiness Addendum — Final Demo Package\n\n**Synchronization date:** July 14, 2026  \n**Underlying workstream outputs:** 27 of 27 complete  \n**Buyer-facing reports:** WS1 and WS2 complete  \n**Sale-process outputs:** CIM, Teaser, LOI Review, and Net Proceeds Calculator complete\n\n## Complete Workstream Coverage\n\n| # | Agent Output | Workstream | Status | Core Result Included in Overview |\n|---:|---|---|---|---|\n| 1 | Valuation Agent | Shared | Complete | $450K normalized EBITDA; $2.25M–$3.15M range; $2.70M midpoint |\n| 2 | Employee Obligations | WS1 | Complete | PTO, retention, restrictive covenant and contractor treatment |\n| 3 | Employee Staffing & Compensation | WS1 | Complete | 24-person team, compensation positioning and management retention |\n| 4 | Insurance Review | WS1 | Complete | Closed claim history; five-year loss-run and coverage bring-down |\n| 5 | Lease Analysis | WS1 | Complete | Consent, site control, premises, HVAC, estoppel and guaranty |\n| 6 | Litigation & Liens | WS1 | Complete | No material suit; ~$186K equipment UCC payoff |\n| 7 | Material Contracts | WS1 | Complete | Assignment, renewal, minimum, data and transition actions |\n| 8 | Org Chart Review | WS1 | Complete | GM/AGM platform with owner and functional dependencies |\n| 9 | Owner & GM Assessment | WS1 | Complete | GM 7/10 independence; retention, RACI and transition required |\n| 10 | Ownership Verification | WS1 | Complete | One Arizona LLC; 100% Elena Marquez; clear authority chain |\n| 11 | Permits & Zoning | WS1 | Complete | DBA-name correction and outdoor-use confirmation |\n| 12 | Professional Advisors | WS1 | Complete | CPA, counsel, bookkeeper, broker and lease-advisor roles |\n| 13 | Software & Vendors | WS1 | Complete | Eight critical systems/vendors and Day-1 transfer plan |\n| 14 | Client Location Map | Shared | Complete | Attractive Phoenix trade area and diversified local demand |\n| 15 | Legal Reports & Entity Search | WS1 | Complete | Active entity, good standing, UCC, registered agent, trade name and IP |\n| 16 | Tax Liability Review | WS1 | Complete | TPT, payroll, contractor and clearance workplan |\n| 17 | WS1 Internal Assessment | WS1 | Complete | 54/100 RED; five coordinated risk programs |\n| 18 | WS1 Sales Readiness Roadmap | WS1 | Complete | 18 tracked actions; target 88/100 GREEN |\n| 19 | Competitor Analysis | WS2 | Complete | Seven-peer market and feature positioning |\n| 20 | Digital Presence | WS2 | Complete | 82/100; strong reputation with attribution/ownership gaps |\n| 21 | Facility Review | WS2 | Complete | 78/100; good condition and defined minor capex |\n| 22 | Occupancy Review | WS2 | Complete | 66% average / 91% peak; daily proof required |\n| 23 | Competitive Pricing Analysis | WS2 | Complete | Base and peak rate opportunity with cohort guardrails |\n| 24 | Pricing by Vertical | WS2 | Complete | Boarding, daycare, grooming and add-on initiatives |\n| 25 | Sales Process Review | WS2 | Complete | 46% conversion baseline; SLA/funnel target of 55% |\n| 26 | WS2 Internal Assessment | WS2 | Complete | 63/100 YELLOW; commercial proof plan |\n| 27 | WS2 Sales Readiness Roadmap | WS2 | Complete | 16 tracked actions; target 90/100 GREEN |\n\n## Workstream 1 Portfolio Synthesis\n\nWS1 confirms that the business is fundamentally transferable but should not be broadly marketed until buyer-verifiable evidence exists for five concentrated matters. The full assessment synthesizes all 16 underlying source agents, and the roadmap converts findings into 18 named actions.\n\n| Critical Program | Current Position | Required Evidence | Target |\n|---|---|---|---:|\n| Lease and site control | Consent and longer control in process | Consent, amendment, estoppel, premises exhibit, guaranty release | Day 30 |\n| Clear asset title | One equipment UCC; ~$186K payoff | Payoff, per-diem, escrow instruction and UCC-3 | Day 35 |\n| Legal operating continuity | Permit name and outdoor-use evidence incomplete | Reissued permit and municipal confirmation | Day 30 |\n| Management continuity | GM operates site; retention/authority unsigned | Retention, RACI, SOPs and transition schedule | Day 21 |\n| Legacy obligations | TPT, PTO, contractor and contract matters quantified | Clearance, decisions, notices, consents and targeted deal treatment | Day 45 |\n\nPositive WS1 evidence includes one active seller entity, clear 100% ownership, no identified material lawsuit or judgment, a stable 24-person team, supportable normalization, a current commercial statutory agent, valid good standing, and defined third-party cure paths.\n\n## Workstream 2 Portfolio Synthesis\n\nWS2 confirms a healthy current business rather than a turnaround. The $450,000 normalized EBITDA base excludes speculative upside. The commercial plan converts a premium reputation and available off-peak capacity into measurable cohorts and reconciled financial results.\n\n| Commercial Program | Baseline | 90-Day Target | Gross Opportunity |\n|---|---:|---:|---:|\n| Boarding price alignment | Below premium peer median | +6% controlled cohort | ~$62K |\n| Peak / holiday yield | Inconsistent rules | Published calendar, deposits and minimum stays | ~$38K |\n| Weekday daycare membership | Limited packages | Capped Tue–Thu recurring plan | ~$34K |\n| Departure-day grooming | 18% attachment | 25% attachment | ~$29K |\n| Enrichment / add-ons | 22% attachment | 30% attachment | ~$17K |\n| Lead conversion | ~46% | 55% with response SLA | $10K+ |\n| Total identified | — | Evidence-based tests | ~$190K gross |\n\nThe WS2 assessment and roadmap require 90 days of daily occupancy, capacity, denial, cancellation, ADR, RevPAU, customer-cohort, conversion, and contribution data reconciled to booking, payment, payroll, and GL sources.\n\n## Cross-Workstream Valuation Bridge\n\n| Value Driver | Current Evidence | Valuation Effect |\n|---|---|---|\n| Normalized EBITDA | $450,000, excluding future upside | Supports base range |\n| Multiple range | 5.0x–7.0x | $2.25M–$3.15M |\n| Working midpoint | 6.0x | $2.70M |\n| Lease/site control | Unresolved but curable | Downside if no written path |\n| GM continuity | Strong operator; agreement pending | Supports multiple when signed |\n| Reputation | 4.9 / 214 reviews | Supports premium positioning |\n| Commercial upside | ~$190K gross, unproven | Buyer-controlled upside; not base EBITDA |\n| Legal/title readiness | Defined cure plan | Reduces escrow/retrade when completed |\n| Data quality | KPI pack in build | Determines buyer confidence |\n\n## Integrated Risk Register\n\n| Priority | Matter | Source Agents | Buyer Remedy / Evidence |\n|---|---|---|---|\n| 1 | Landlord consent and long-term site control | Lease, Legal, Permits, Facility, Valuation | Amendment, consent, estoppel and options |\n| 2 | Equipment UCC release | Litigation, Legal, Ownership, Net Proceeds | Direct payoff and UCC-3 |\n| 3 | Permit / zoning record consistency | Permits, Legal, Lease, Facility | Corrected permit and zoning letter |\n| 4 | Owner / GM transition | Owner-GM, Org Chart, Employee Agents | Retention, RACI, SOPs and transition |\n| 5 | TPT / contractor / PTO treatment | Tax, Employee Obligations, Advisors | Clearance, memo, schedule and escrow decision |\n| 6 | Contract/vendor transfer | Contracts, Vendors, Digital | Consent/notice log, exports and credentials |\n| 7 | Unproven growth claims | Pricing, Occupancy, Sales, WS2 Reports | 90-day cohort and KPI evidence |\n\n## Buyer-Facing Package Confirmation\n\n| Deliverable | Content | Status |\n|---|---|---|\n| WS1 Buyer Report | Legal, lease, employee, tax, title, management and risk-mitigation summary | Complete |\n| WS2 Buyer Report | Financial, competitive, pricing, digital, facility, customer and growth summary | Complete |\n| Confidential Information Memorandum | Full investment thesis, financials, normalization, operations, competition, value creation and process | Complete |\n| Deal Teaser | Anonymous high-level opportunity, metrics, service model and investment highlights | Complete |\n| LOI Review & Comparison | Three-offer comparison, flags, counters, ranking and preferred framework | Complete |\n| Net Proceeds Calculator | $2.95M selected-offer waterfall with debt, working capital, escrow, rollover, fees and tax inputs | Complete |\n\n## Final 30 / 60 / 90 Day Integrated Plan\n\n### Days 1–30\n\n- Obtain written landlord, permit, zoning, GM-retention and authority pathways.\n- Lock lender payoff and UCC-3 mechanics.\n- Configure daily commercial dashboard and launch controlled pricing/membership tests.\n- Issue contract notices/consents and carrier loss-run requests.\n- Execute sole-member consent and establish data-room quality control.\n\n### Days 31–60\n\n- Finalize site-control and permit evidence.\n- Complete TPT, PTO and contractor treatment.\n- Test system/customer-data exports and Day-1 credentials.\n- Complete facility capex and cross-training.\n- Produce first reconciled monthly KPI pack and customer cohorts.\n- Conduct mock buyer diligence across both workstreams.\n\n### Days 61–90\n\n- Produce full commercial experiment binder.\n- Refresh standing, UCC, litigation, tax and insurance evidence.\n- Reconcile disclosure schedules and closing sources/uses.\n- Rehearse GM-led management presentation.\n- Confirm GREEN/YELLOW launch decision and open the controlled buyer process.\n\n## Final Integrated Readiness Conclusion\n\nThe Cactus Pet Resort is an attractive $1.70 million revenue, $450,000 normalized EBITDA acquisition candidate with strong customer goodwill, an experienced operating team, and practical post-close growth levers. WS1 risk is concentrated in five curable transferability matters; WS2 upside is credible but requires measured proof. The complete package now connects all 27 workstream outputs to the buyer reports, sale-process materials, LOI analysis, and seller proceeds scenario.\n",
          "updatedAt": "2026-07-14T15:15:00.000Z",
          "agentCount": 27,
          "clientName": "The Cactus Pet Resort",
          "workstream": "both",
          "generatedAt": "2026-07-14T15:15:00.000Z",
          "generatedBy": "Cantara Demo Review Team",
          "completedCount": 27,
          "workstreamLabel": "Workstream 1 + Workstream 2",
          "overallReadiness": "CONDITIONAL — WS1 RED / WS2 YELLOW"
        }
      },
      "assessmentReport_ws1": {
        "markdown": "# Workstream 1 — Risk Mitigation Assessment Report\n\n**Client:** The Cactus Pet Resort  \n**Location:** Phoenix, Arizona  \n**Property:** Leased single-site pet resort  \n**Revenue / normalized EBITDA:** $1,700,000 / $450,000  \n**Indicated valuation:** $2.25M–$3.15M; $2.70M midpoint  \n**Assessment status:** **RED — five coordinated issues must be converted into buyer-verifiable evidence before launch**  \n**Data basis:** Illustrative demo records synthesized from all underlying Workstream 1 agents.\n\n## Executive Summary\n\nThe Cactus Pet Resort is a credible transaction candidate with attractive 26.5% normalized EBITDA margin, a 4.9-star reputation from 214 reviews, a stable 24-person team, clear sole-member ownership, and no identified material lawsuit or judgment. The business is not yet buyer-ready because five connected issues could delay financing, weaken representations, or cause a buyer to demand escrow, holdback, or a longer seller transition.\n\n1. **Lease transfer and site control:** landlord consent is required; remaining term plus options does not yet provide the preferred ten-year control; outdoor-yard boundaries and HVAC obligations need written clarification.\n2. **Equipment lien:** one active UCC filing secures an estimated $186,000 balance against essential operating equipment.\n3. **Permit and entity-name reconciliation:** the kennel permit uses the DBA without the LLC legal name, and written confirmation of outdoor animal use is incomplete.\n4. **Management continuity:** Elena retains several strategic and administrative decisions, while GM retention, delegated authority, and transition obligations are not signed.\n5. **Tax, employment, and contract cleanup:** TPT reconciliation, contractor classification, accrued PTO, auto-renewal, assignment, and data-export items require documented disposition.\n\nThese issues are curable and do not undermine the operating thesis. The recommended posture is to delay broad buyer outreach until the landlord path, lien release mechanics, permit correction, and GM retention package are evidenced. With disciplined execution, WS1 can move from RED to GREEN in 60–90 days.\n\n## Transaction Snapshot\n\n| Metric | Current Position | Diligence Interpretation |\n|---|---:|---|\n| Revenue | $1,700,000 | Sufficient scale for regional and strategic buyers |\n| Reported EBITDA | $392,000 | Reconciled to management accounts |\n| Normalized EBITDA | $450,000 | $58,000 reviewed adjustments |\n| EBITDA margin | 26.5% | Strong for a single-site leased operation |\n| Valuation range | $2.25M–$3.15M | 5.0x–7.0x normalized EBITDA |\n| Midpoint | $2.70M | 6.0x normalized EBITDA |\n| Workforce | 24 workers | Stable operating base; key-person concentration remains |\n| Google reputation | 4.9 / 214 reviews | Strong buyer-supportive commercial proof |\n| Entity | Cactus Pet Resort LLC | One Arizona LLC; 100% Elena Marquez |\n| Lease | Landlord consent required | Critical closing and financing dependency |\n| Known secured claim | ~$186,000 | Payoff/UCC-3 required |\n| WS1 readiness | 54 / 100 — RED | Launch after five readiness gates |\n\n## Integrated Risk Heat Map\n\n| Category | Risk Level | Key Finding | Probability | Deal Impact | Mitigation Evidence |\n|---|---|---|---:|---|---|\n| Lease & site control | RED | Consent, term, yard exhibit, guaranty, and HVAC allocation unresolved | High | Financing delay or failed assignment | Consent term sheet, amendment, estoppel |\n| Liens & title | RED | Active equipment UCC affects essential assets | High | Clear-title closing condition | Payoff letter, escrow instruction, UCC-3 |\n| Permits & zoning | RED | DBA-only permit and outdoor-use confirmation gap | Medium | Closing condition / special indemnity | Amended permit and zoning letter |\n| Owner / GM transition | RED | Retention and delegated authority unsigned | High | Holdback, earnout, or longer transition | Retention agreement, authority matrix, SOPs |\n| Tax & workforce obligations | RED | TPT lookback, PTO, and contractor exposure need disposition | Medium | Escrow or indemnity | Clearance, payroll memo, settlement schedule |\n| Material contracts | YELLOW | Consent, renewal, minimums, and data-export issues | Medium | Post-close cost or service interruption | Notice log, consents, exports |\n| Insurance | YELLOW | Claims closed; fresh carrier loss runs still required | Low | Coverage confirmation | Five-year loss runs and tail analysis |\n| Corporate standing | YELLOW | Entity is active; sale consent unsigned | Low | Routine authority closing item | Executed consent and bring-down certificate |\n| Staffing & compensation | YELLOW | GM pay/retention below transaction target | Medium | Turnover and value leakage | Market adjustment and retention bonus |\n| Advisors / data room | YELLOW | Advisor roles exist but diligence calendar is incomplete | Medium | Slow response cycle | Written advisor matrix and response SLA |\n| Valuation support | GREEN | Earnings and add-back bridge are supportable | Low | Buyer confidence | Monthly bridge and source schedules |\n| Litigation | GREEN | No material suit or judgment identified | Low | Positive | Bring-down searches |\n| Ownership | GREEN | 100% ownership is clear | Low | Positive | Certified ownership schedule |\n| Organization | GREEN/YELLOW | Strong GM/AGM structure; several single points of failure | Medium | Transition concern | Cross-training and RACI |\n| Vendor stack | GREEN/YELLOW | Core systems mapped; exports/credentials need testing | Medium | Operational handoff | Export proof and credential plan |\n| Location | GREEN | Attractive Phoenix trade area and access | Low | Positive | Customer and demand map |\n\n## Agent-by-Agent Assessment\n\n### 1. Valuation Agent — GREEN\n\nThe valuation agent reconciled reported EBITDA of $392,000 to normalized EBITDA of $450,000 through $58,000 of reviewed adjustments. At 5.0x, 6.0x, and 7.0x, the indicated values are $2.25M, $2.70M, and $3.15M. The midpoint is credible if the business demonstrates management continuity and resolves lease, lien, and permit risks. No pricing or capacity upside is included in normalized EBITDA.\n\n**Buyer evidence:** monthly P&L, bank/GL tie-out, payroll detail, owner expense support, add-back schedule, and trailing-12-month bridge.  \n**Readiness action:** freeze a signed normalization schedule and refresh it monthly through closing.\n\n### 2. Employee Obligations Agent — RED\n\nThe review identified $34,680 of accrued PTO, an unsigned GM retention package, no executed seller non-compete/non-solicit, and potential contractor classification exposure estimated at $22,000–$38,000. Benefits and ordinary payroll obligations appear manageable, but the buyer will expect a clear allocation of accrued compensation and a documented approach to legacy classification risk.\n\n**Buyer evidence:** employee census, handbook acknowledgment, PTO ledger, I-9 completion matrix, contractor agreements, benefit summaries, and transaction retention terms.  \n**Readiness action:** decide PTO payout/assumption, execute retention and restrictive covenants, and obtain employment counsel’s classification memo.\n\n### 3. Employee Staffing & Compensation Agent — YELLOW\n\nThe 24-person staffing model supports current revenue and service levels. Frontline compensation is generally within Phoenix market ranges. GM compensation is below a transaction-ready retention band, and the grooming lead and bookkeeper create secondary single-person dependencies.\n\n**Buyer evidence:** anonymized roster, roles, FTE status, hire dates, wages, bonus history, overtime, turnover, and open positions.  \n**Readiness action:** approve GM market adjustment and retention bonus; cross-train grooming scheduling and monthly close.\n\n### 4. Insurance Review Agent — YELLOW\n\nThe illustrative claim review contains one resolved $18,750 guest-liability matter and one closed $4,260 workers-compensation strain claim, with no open reserve or repeated severity pattern. Current evidence does not substitute for carrier-issued loss runs or policy endorsement review.\n\n**Buyer evidence:** five-year loss runs, policy schedules, deductibles, exclusions, workers’ compensation mod, cyber coverage, abuse/molestation coverage, animal bailee limits, and tail/ERP analysis.  \n**Readiness action:** obtain carrier-certified loss runs and a broker transition memorandum.\n\n### 5. Lease Analysis Agent — RED\n\nThe lease is the principal WS1 gating item. Consent is required, seller guaranty release is not automatic, remaining control is shorter than many lenders prefer, outdoor play areas are not fully depicted in the premises exhibit, HVAC responsibility is ambiguous, and CAM verification rights should be strengthened.\n\n**Buyer evidence:** full lease and amendments, rent ledger, CAM reconciliations, premises plan, consent term sheet, estoppel, extension, and guaranty release.  \n**Readiness action:** negotiate a bundled amendment providing consent, at least ten years of control including options, corrected premises exhibit, assignment mechanics, HVAC allocation, and guaranty release.\n\n### 6. Litigation & Liens Agent — RED\n\nIllustrative federal, Arizona, Maricopa County, judgment, and tax-lien searches did not identify a material lawsuit or judgment. One active UCC filing secures approximately $186,000 against essential equipment. This is a normal but mandatory closing payoff item.\n\n**Buyer evidence:** certified search results, lender payoff letter, per-diem, wiring verification, escrow instruction, and UCC-3.  \n**Readiness action:** secure release mechanics before signing and refresh all searches at signing/closing.\n\n### 7. Material Contracts Agent — YELLOW\n\nFive material operating contracts were reviewed. Waste services presents an auto-renewal risk, the security contract requires assignment consent, linen services include volume minimums, payment processing needs terminal/merchant transition planning, and the marketing platform needs attribution export and credential transfer.\n\n**Buyer evidence:** complete contract schedule, amendments, spend, renewal/notice dates, assignment clauses, consent log, and data export tests.  \n**Readiness action:** issue the waste non-renewal notice, obtain consents, and complete the contract transition matrix.\n\n### 8. Org Chart Review Agent — YELLOW\n\nThe organization has a credible GM/AGM operating structure and sufficient frontline coverage. Owner, GM, grooming lead, and bookkeeper dependencies remain. Jordan Lee’s operational independence is a strength, but bank, pricing, marketing, advisor, and several vendor decisions remain with Elena.\n\n**Buyer evidence:** org chart, RACI, delegated authority, backup coverage, recurring calendar, and role SOPs.  \n**Readiness action:** transfer owner-controlled routines and establish named backup coverage.\n\n### 9. Owner & GM Assessment Agent — RED\n\nGM independence scored 7/10. Jordan runs the facility, scheduling, guest resolution, and most labor decisions, but strategic pricing, banking, vendor escalation, marketing, and financial review remain owner-controlled. No signed retention or transition agreement currently protects continuity.\n\n**Buyer evidence:** retention agreement, authority matrix, transition services schedule, weekly operating cadence, and emergency contact protocol.  \n**Readiness action:** execute a 12-month GM retention package and six-month seller transition scope.\n\n### 10. Ownership Verification Agent — GREEN/YELLOW\n\nThe illustrative ownership package supports 100% sole-member ownership by Elena Marquez and authority through Cactus Pet Resort LLC. No minority interest, option, phantom equity, or competing claimant was identified. The transaction consent remains unsigned.\n\n**Buyer evidence:** articles, amended operating agreement, ownership certificate, EIN letter, good standing, member consent, and incumbency certificate.  \n**Readiness action:** execute the consent and order certified bring-down documents.\n\n### 11. Permits & Zoning Agent — RED\n\nThe kennel permit, business license, certificate of occupancy, and zoning evidence generally support continued use. The kennel permit should display the LLC d/b/a name, and written municipal confirmation is needed for the outdoor play-yard use and occupancy assumptions.\n\n**Buyer evidence:** corrected permit, zoning letter, CO, inspection history, fire/life-safety records, renewals calendar, and premises exhibit.  \n**Readiness action:** file the name correction and obtain written outdoor-use confirmation.\n\n### 12. Professional Advisors Agent — YELLOW\n\nCPA, transaction counsel, bookkeeper, insurance broker, and lease advisor roles are mapped. Four advisors are willing to support diligence; the lease advisor engagement and response standards are not finalized.\n\n**Buyer evidence:** engagement matrix, named contacts, scopes, confidentiality confirmations, and response SLA.  \n**Readiness action:** issue a 90-day diligence calendar and appoint one data-room coordinator.\n\n### 13. Software & Vendors Agent — YELLOW\n\nEight critical systems/vendors were mapped across booking, payments, payroll, accounting, phones, cameras, marketing, laundry/linen, and waste. The operating stack is serviceable, but buyer transition depends on tested exports, credential ownership, renewal dates, and assignability.\n\n**Buyer evidence:** vendor register, monthly spend, contract terms, admin owners, exports, API/integration map, and credential escrow.  \n**Readiness action:** perform a live export test and prepare a Day-1 access runbook.\n\n### 14. Client Location Map Agent — GREEN\n\nThe Phoenix location benefits from affluent households, commuter access, veterinary/referral density, and strong local demand. The customer base appears geographically diversified within the primary trade area. The leased-site dependency remains a legal rather than market-location concern.\n\n**Buyer evidence:** anonymized customer ZIP map, drive-time rings, revenue by ZIP, referral-source map, and nearby demand generators.  \n**Readiness action:** refresh the map with trailing-12-month customer/revenue data.\n\n### 15. Legal Reports & Entity Search Agent — YELLOW\n\nThe legal search supports one active Arizona LLC, current commercial statutory agent, a valid good-standing certificate, 100% ownership, a registered trade name, and one active equipment UCC. DBA-only references on the permit and vendor records require reconciliation. The logo’s designer assignment is not documented.\n\n**Buyer evidence:** corporate binder, entity printout, good standing, UCC search, executed authority, DBA record, and IP chain-of-title schedule.  \n**Readiness action:** close the four legal items: authority, name consistency, lien release, and IP assignment evidence.\n\n### 16. Tax Liability Review Agent — RED/YELLOW\n\nThe tax review identified a transaction-privilege-tax reconciliation, potential contractor classification exposure, and ordinary payroll/sales-tax bring-down requirements. No catastrophic tax claim was modeled, but a buyer will expect clearance, a lookback schedule, and defined responsibility for pre-close periods.\n\n**Buyer evidence:** three years of federal/state returns, TPT filings, payroll returns, notices, fixed-asset/depreciation schedule, contractor 1099s, and tax clearance.  \n**Readiness action:** complete the TPT lookback, obtain clearance, and decide whether any escrow or special indemnity is necessary.\n\n## Five Coordinated Red Problems\n\n### Red 1 — Lease transfer and site control\n\n**Why it matters:** Every dollar of EBITDA depends on continued use of the leased facility.  \n**Possible buyer response:** financing condition, price retrade, escrow, or walk-away right.  \n**Resolution standard:** signed landlord consent pathway, ten years of control including options, corrected premises exhibit, HVAC allocation, estoppel, and guaranty release.\n\n### Red 2 — Equipment UCC release\n\n**Why it matters:** Essential equipment cannot transfer free and clear without lender payoff mechanics.  \n**Possible buyer response:** direct payoff, closing holdback, or delayed asset transfer.  \n**Resolution standard:** lender payoff valid through closing, per-diem, verified wiring, and irrevocable UCC-3 commitment.\n\n### Red 3 — Permit / zoning reconciliation\n\n**Why it matters:** A buyer needs uninterrupted legal operation of kennels and outdoor areas.  \n**Possible buyer response:** closing condition, special indemnity, or reduced value for use uncertainty.  \n**Resolution standard:** corrected LLC d/b/a permit, written outdoor-use confirmation, current inspection evidence, and renewal calendar.\n\n### Red 4 — Owner and GM continuity\n\n**Why it matters:** The buyer’s underwriting assumes current operations survive Elena’s exit.  \n**Possible buyer response:** retention escrow, earnout, longer transition, or key-person condition.  \n**Resolution standard:** signed GM retention, delegated authority, cross-training, and six-month transition services plan.\n\n### Red 5 — Tax / employment / contract cleanup\n\n**Why it matters:** Small unresolved obligations accumulate into escrow and representation risk.  \n**Possible buyer response:** working-capital adjustment, indemnity, escrow, or delayed closing.  \n**Resolution standard:** TPT clearance, contractor memo, PTO decision, contract consent/notice log, and certified loss runs.\n\n## Cross-Agent Dependencies\n\n| Dependency | Upstream Agents | Downstream Effect |\n|---|---|---|\n| Landlord package | Lease, Legal, Permits, Facility | Valuation confidence, lender approval, roadmap gate |\n| GM retention | Owner/GM, Org Chart, Employee Comp, Employee Obligations | Transition plan, valuation multiple, buyer interviews |\n| UCC payoff | Litigation, Legal, Ownership, Tax | Clear title, funds flow, closing checklist |\n| Permit correction | Permits, Legal, Lease | Continued operations, reps and warranties, insurance |\n| Contract/data transition | Contracts, Vendors, Digital | Day-1 continuity and customer-data access |\n| TPT/contractor cleanup | Tax, Employee Obligations, Advisors | Escrow, special indemnity, seller proceeds |\n| KPI/data-room discipline | Valuation, Advisors, all agents | Faster diligence and lower retrade risk |\n\n## Quantified Exposure and Deal Protections\n\n| Item | Illustrative Amount / Range | Recommended Treatment |\n|---|---:|---|\n| Equipment payoff | $186,000 | Direct lender payoff from closing proceeds |\n| Accrued PTO | $34,680 | Pay at close or include in working capital |\n| Contractor exposure | $22,000–$38,000 | Counsel memo; escrow if unresolved |\n| GM retention / transaction bonus | $30,000–$45,000 | Seller-funded or negotiated deal cost |\n| Immediate facility/HVAC reserve | $18,000–$30,000 | Clarify landlord responsibility; disclose reserve |\n| Legal/permit/consent preparation | $20,000–$35,000 | Seller readiness budget |\n| Potential combined pre-close cash need | $310,680–$368,680 | Plan in sources-and-uses; excludes sale fees/taxes |\n\nThese amounts are illustrative and should be replaced with current third-party evidence before use in transaction documents.\n\n## Positive Findings Buyers Should Credit\n\n- 26.5% normalized EBITDA margin with a documented $58,000 add-back bridge.\n- 4.9 Google rating across 214 reviews.\n- One active seller entity and clear 100% ownership.\n- Experienced GM and AGM providing credible operating continuity.\n- No identified material lawsuit or judgment.\n- Commercial registered agent and current good standing.\n- No blanket all-assets lien; known equipment filing has a defined payoff path.\n- Stable 24-person team and market-aligned frontline compensation.\n- Attractive Phoenix trade area and diversified local demand.\n- Mapped advisor and vendor ecosystem that can support diligence.\n\n## Readiness Gates\n\n| Gate | Required Evidence | Responsible Parties | Target | Launch Effect |\n|---|---|---|---:|---|\n| 1. Site control | Landlord term sheet, consent form, estoppel, premises exhibit | Seller + real-estate counsel | Day 30 | Mandatory before broad outreach |\n| 2. Clear title | Payoff letter and UCC-3 commitment | Seller + lender + counsel | Day 35 | Mandatory before signing |\n| 3. Legal operation | Corrected permit and zoning letter | Seller + permit consultant | Day 30 | Mandatory before broad outreach |\n| 4. Management continuity | Signed GM retention and authority matrix | Seller + employment counsel | Day 21 | Required for management meetings |\n| 5. Legacy obligations | TPT lookback, PTO decision, contractor memo | CPA + employment/tax counsel | Day 45 | Required before definitive agreement |\n| 6. Data room | Indexed, reconciled evidence across all 16 source agents | Data-room coordinator | Day 60 | Required for buyer diligence |\n| 7. Bring-down | Fresh standing, lien, litigation, tax, and insurance evidence | Counsel + broker | Signing/closing | Closing requirement |\n\n## Recommended Deal Posture\n\nProceed with preparation, not immediate broad marketing. Run the five red projects in parallel, preserve the $2.70M midpoint as the working valuation anchor, and avoid presenting the business as “fully ready” until Gates 1, 3, and 4 are evidenced. The UCC payoff can remain a closing item if release mechanics are firm. Tax/contractor risk should be quantified before LOI so it does not become a late retrade.\n\n## 30 / 60 / 90 Day Plan\n\n### Days 1–30 — Remove launch blockers\n\n- Open landlord negotiations with a written buyer profile and proposed amendment.\n- File kennel-permit legal-name correction and request zoning confirmation.\n- Execute GM retention, seller covenant, and delegated-authority matrix.\n- Obtain lender payoff draft and UCC-3 filing commitment.\n- Launch TPT and contractor lookback.\n- Issue vendor notices and material-contract consent requests.\n- Appoint data-room coordinator and advisor response SLA.\n\n### Days 31–60 — Build buyer-verifiable evidence\n\n- Finalize lease consent pathway, site-control extension, guaranty release, and premises exhibit.\n- Complete permit/zoning written evidence and facility compliance binder.\n- Finalize PTO and contractor treatment.\n- Obtain carrier-issued five-year loss runs.\n- Complete contract exports, credential map, and Day-1 vendor transition plan.\n- Freeze normalization schedule and monthly financial/KPI pack.\n- Complete owner-to-GM SOP transfer and backup coverage.\n\n### Days 61–90 — Validate and launch\n\n- Refresh entity, UCC, judgment, litigation, tax, and insurance evidence.\n- Conduct mock buyer diligence against the indexed data room.\n- Resolve open advisor exceptions and approve disclosure schedule.\n- Prepare management presentation with GM-led operating narrative.\n- Confirm all launch gates and issue final GREEN/YELLOW readiness decision.\n\n## Final Assessment\n\n**Current WS1 readiness: 54 / 100 — RED.**  \n**Projected readiness after roadmap completion: 88 / 100 — GREEN.**\n\nThe risk profile is concentrated rather than diffuse. Five coordinated projects—site control, clear title, operating permits, management continuity, and legacy-obligation cleanup—will materially reduce buyer friction. The business should be considered attractive but conditionally market-ready once those projects produce signed, third-party-verifiable evidence.\n",
        "updatedAt": "2026-07-14T14:15:00.000Z",
        "clientName": "The Cactus Pet Resort",
        "workstream": "ws1",
        "generatedAt": "2026-07-14T14:15:00.000Z",
        "readinessScore": 54,
        "readinessStatus": "RED",
        "workstreamLabel": "Workstream 1 — Risk Mitigation",
        "projectedReadinessScore": 88
      },
      "assessmentReport_ws2": {
        "markdown": "# Workstream 2 — Profitability & Growth Assessment Report\n\n**Client:** The Cactus Pet Resort  \n**Location:** Phoenix, Arizona  \n**Revenue:** $1,700,000  \n**Normalized EBITDA:** $450,000 (26.5% margin)  \n**Commercial readiness:** **63 / 100 — YELLOW**  \n**Target after 90-day plan:** **90 / 100 — GREEN**\n\n## Executive Summary\n\nThe Cactus Pet Resort combines an unusually strong local reputation—4.9 stars across 214 Google reviews—with attractive normalized profitability and a diversified service mix spanning boarding, daycare, grooming, and add-ons. The core operating business is healthy. The principal diligence gap is not demand or service quality; it is the absence of a fully reconciled commercial measurement system proving daily capacity, denied demand, price realization, conversion, customer retention, and revenue per available unit.\n\nThe current evidence supports a $450,000 normalized EBITDA base and a $2.25M–$3.15M valuation range. A further gross annual revenue opportunity of approximately $190,000 has been identified through price alignment, peak yield, weekday daycare memberships, grooming attachment, enrichment add-ons, and stronger lead conversion. This upside must remain separate from current EBITDA until cohort tests and closed financials demonstrate it.\n\nFive coordinated commercial priorities drive the WS2 plan:\n\n1. Produce 90 consecutive days of capacity, occupancy, denial, cancellation, and RevPAU data.\n2. Test a phased 6% boarding increase and formal peak/holiday rules with churn guardrails.\n3. Launch capped weekday daycare membership and departure-day grooming pilots.\n4. Implement lead-source capture, response-time SLA, and inquiry-to-book conversion reporting.\n5. Reconcile booking, payment, payroll, and GL data into a repeatable monthly KPI pack.\n\n## Commercial Snapshot\n\n| Metric | Current Result | Assessment |\n|---|---:|---|\n| TTM Revenue | $1,700,000 | Attractive single-site scale |\n| Normalized EBITDA | $450,000 | Strong 26.5% margin |\n| Google Rating | 4.9 / 5.0 | Buyer-supportive |\n| Google Reviews | 214 | Credible volume |\n| Average Occupancy | 66% | Meaningful weekday headroom |\n| Peak Occupancy | 91% | Yield and denial opportunity |\n| Digital Presence Score | 82 / 100 | Strong foundation |\n| Facility Score | 78 / 100 | Good condition with defined minor capex |\n| Inquiry-to-Book Conversion | 46% | Below 55% target |\n| Grooming Attachment | 18% | Opportunity to reach 25% |\n| Add-on Attachment | 22% | Opportunity to reach 30% |\n| Identified Gross Upside | ~$190,000 | Not included in normalized EBITDA |\n| WS2 Readiness | 63 / 100 | YELLOW pending proof |\n\n## Agent Coverage and Findings\n\n### Valuation Agent — GREEN\n\nThe normalized EBITDA base of $450,000 is supported by a $58,000 bridge from reported EBITDA of $392,000. The valuation sensitivity is $2.25M at 5.0x, $2.70M at 6.0x, and $3.15M at 7.0x. No speculative price, occupancy, or conversion upside has been capitalized into the base, preserving credibility.\n\n**Commercial implication:** improvements proven during the 90-day program can support the upper end of the multiple range without being mislabeled as historical EBITDA.\n\n### Client Location Map Agent — GREEN\n\nThe Phoenix trade area combines affluent pet-owning households, commuter access, nearby veterinary/referral partners, and limited customer concentration. Customer distribution is broad enough that value is not dependent on one subdivision, employer, or referral source.\n\n**Evidence to strengthen:** trailing-12-month revenue by ZIP, drive-time rings, referral source, and repeat-customer density.\n\n### Competitor Analysis Agent — GREEN/YELLOW\n\nSeven relevant competitors were reviewed across distance, services, capacity, reputation, convenience, and positioning. The Cactus Pet Resort differentiates on service quality, rating, staff familiarity, and integrated boarding/daycare/grooming. Several competitors use more sophisticated premium tiers, peak pricing, memberships, and add-on merchandising.\n\n**Opportunity:** retain the trusted local positioning while adopting disciplined pricing and packaging practices already accepted in the market.\n\n### Digital Presence Agent — GREEN/YELLOW\n\nThe business scored 82/100. Google Business Profile and reputation are strong; the website communicates services clearly and mobile usability is adequate. Gaps include incomplete campaign attribution, inconsistent source-to-booking tracking, limited service-area landing pages, and undocumented ownership of some marketing credentials.\n\n**Opportunity:** preserve review velocity, clarify admin ownership, and connect lead source to booked revenue and lifetime value.\n\n### Facility Review Agent — GREEN/YELLOW\n\nThe facility scored 78/100. Kennel areas, grooming spaces, front-of-house presentation, safety routines, and customer-visible cleanliness support the premium promise. Defined items include minor HVAC/ventilation work, outdoor surface maintenance, signage/finish refresh, and better documentation of safe capacity by unit type.\n\n**Opportunity:** close modest buyer-visible capex and use the work to validate true capacity rather than rely on theoretical unit counts.\n\n### Occupancy Review Agent — RED/YELLOW\n\nAverage occupancy of 66% masks two different operating realities: holiday/peak periods reach approximately 91%, while weekday daycare and certain boarding inventory retain capacity. Monthly spreadsheets cannot distinguish inventory closures, staff constraints, cancellations, denials, waitlist recovery, or revenue per available unit.\n\n**Required proof:** 90 days of daily available units, sold units, closed units, denials, cancellations, average rate, and RevPAU by vertical.\n\n### Competitive Pricing Analysis Agent — RED/YELLOW\n\nThe illustrative mystery shop suggests core boarding and daycare prices sit below the premium peer median despite a leading rating. Peak pricing, deposits, minimum stays, and cancellation rules are inconsistently applied. A blanket increase would be risky; a phased cohort test with churn and complaint guardrails is appropriate.\n\n**Identified opportunity:** approximately $62,000 annualized from base boarding alignment and $38,000 from peak/holiday yield, before churn or mix effects.\n\n### Pricing by Vertical Agent — YELLOW\n\nVertical review identified four distinct levers:\n\n- Boarding: phase a 6% base-rate test and introduce tier architecture.\n- Daycare: launch capped Tuesday–Thursday membership to fill off-peak capacity.\n- Grooming: bundle services into departure-day communications.\n- Add-ons: simplify enrichment menu and improve staff offer consistency.\n\n**Identified opportunity:** approximately $34,000 daycare, $29,000 grooming, and $17,000 add-ons, subject to capacity and labor economics.\n\n### Sales Process Review Agent — RED/YELLOW\n\nLead handling is relationship-driven and effective for repeat customers, but response timing, source capture, lost-lead reason, tour conversion, and follow-up cadence are not consistently recorded. Inquiry-to-book conversion is estimated at 46%, compared with a 55% working target.\n\n**Required action:** one funnel across phone, web, email, Google, referral, tour, booking, and lost reason; response SLA under 15 minutes during business hours.\n\n## Readiness by Commercial Domain\n\n| Domain | Status | Score | Finding | Buyer Consequence |\n|---|---|---:|---|---|\n| Revenue quality | 🟢 GREEN | 85 | $1.7M revenue and 26.5% normalized margin | Strong base underwriting |\n| Reputation | 🟢 GREEN | 92 | 4.9 rating and 214 reviews | Supports premium positioning |\n| Location | 🟢 GREEN | 86 | Attractive Phoenix trade area | Durable local demand |\n| Competition | 🟢 GREEN | 80 | Clear differentiated position | Defensible market story |\n| Digital presence | 🟡 YELLOW | 82 | Strong presence; attribution incomplete | Buyer can scale marketing |\n| Facility | 🟡 YELLOW | 78 | Good condition; minor capex/documentation | Normal diligence item |\n| Occupancy analytics | 🔴 RED | 48 | Daily capacity/denial data unavailable | Upside discounted |\n| Pricing proof | 🔴 RED | 52 | Market gap identified but untested | Buyer will not pay for projection |\n| Sales process | 🟡 YELLOW | 60 | Conversion and response tracking incomplete | Execution opportunity |\n| Customer analytics | 🟡 YELLOW | 64 | Retention/concentration not cohortized | Revenue durability needs proof |\n| KPI reconciliation | 🔴 RED | 50 | Booking/GL/payroll not unified | Metrics may be challenged |\n| Growth opportunity | 🟢 GREEN | 84 | Six specific levers identified | Attractive post-close plan |\n\n## Revenue and EBITDA Quality\n\nThe $1.7M revenue base is supported by multiple service lines rather than one product. Boarding provides the largest share and highest peak sensitivity; daycare creates recurring weekday demand; grooming increases customer frequency and share of wallet; add-ons improve ticket and guest experience.\n\nNormalized EBITDA of $450,000 represents a 26.5% margin. The $58,000 normalization bridge is supportable and does not include unproven growth. Monthly reporting should show revenue by vertical, discounts, refunds, deposits, deferred revenue, direct labor, occupancy, average rate, and add-on attachment. This will allow a buyer to distinguish durable earnings from timing, seasonality, and owner-specific adjustments.\n\n## Market Position\n\nThe Cactus Pet Resort occupies a premium-local position rather than a discount or luxury-chain position. Its competitive advantages are customer trust, staff familiarity, high review quality, integrated services, and a convenient Phoenix location. Its commercial disadvantages are less sophisticated packaging, limited daily yield reporting, and an inconsistent digital-to-booking attribution model.\n\nA well-resourced buyer does not need to repair the brand. The buyer opportunity is to add measurement, pricing governance, and repeatable sales routines without damaging service quality.\n\n## Quantified Growth Levers\n\n| Lever | Current Evidence | Test | Gross Annualized Opportunity | Proof Required |\n|---|---|---|---:|---|\n| Boarding base rate | Below premium peer median | +6% phased cohort | $62,000 | Realized ADR and churn |\n| Peak/holiday yield | Inconsistent rules | Calendar, minimum stays, deposits | $38,000 | Peak RevPAU and denials |\n| Daycare membership | Packages not recurring | Capped Tue–Thu membership | $34,000 | Members, visits, churn, margin |\n| Grooming attachment | 18% | Departure-day bundle | $29,000 | Attachment and labor utilization |\n| Add-ons/enrichment | 22% | Simplified menu and scripts | $17,000 | Attachment and contribution |\n| Lead conversion | 46% | SLA and structured follow-up | $10,000+ | Funnel and source data |\n| Total | — | — | ~$190,000 | 90-day experiment binder |\n\nThe figures are gross opportunity estimates, not EBITDA forecasts. Labor, payment fees, supplies, churn, and mix must be applied before calculating contribution.\n\n## Capacity and Occupancy Assessment\n\nA single average occupancy percentage is inadequate for diligence. Available capacity must reflect units closed for maintenance, species/size separation, staffing, length-of-stay rules, cleaning turnaround, and safety restrictions. The buyer-ready dashboard should calculate:\n\n- available and sold units by day and vertical;\n- occupancy and RevPAU;\n- denied requests and reason;\n- cancellations, no-shows, waitlist conversions, and refunds;\n- realized ADR and discounts;\n- labor hours per occupied unit;\n- peak vs off-peak mix;\n- grooming slots available/sold; and\n- daycare attendance by membership/non-membership.\n\nNinety consecutive days will establish whether the business has operational headroom, pricing headroom, or both.\n\n## Customer and Sales Quality\n\nThe reputation signal indicates high satisfaction, but the business should prove repeat rate, active-customer count, top-customer concentration, service-line migration, acquisition source, and lifetime value. No individual customer is expected to be material, yet a formal top-10 and cohort schedule should be produced.\n\nLead management should include a single source field, first-response timestamp, qualification, tour status, booking, lost reason, and follow-up. Weekly funnel ownership belongs with the front desk lead and GM, with reconciliation to the booking system.\n\n## Digital and Brand Transferability\n\nBuyer readiness requires more than a good website. The data room should contain domain registrar ownership, Google Business Profile admins, analytics access, ad accounts, call tracking, social accounts, email/SMS templates, creative ownership, website source/export, and customer consent/privacy documentation. Marketing credentials should be mapped to named current and buyer-transition owners.\n\n## Facility and Operational Strengths\n\nThe facility is operationally credible, customer-presentable, and capable of supporting the current service mix. Minor capex should be closed with invoices, photos, inspection records, and landlord responsibility where relevant. Safe capacity definitions should be signed by the GM and tied to unit maps, staffing constraints, and operating policies.\n\n## Integrated Commercial Dependencies\n\n| Dependency | Connected Agents | Why It Matters |\n|---|---|---|\n| Daily capacity model | Facility, Occupancy, Pricing | Determines whether price or volume is the better lever |\n| Rate cohort data | Pricing, Sales, Digital | Separates realization from marketing mix |\n| Customer cohorts | Digital, Sales, Location | Proves retention and acquisition quality |\n| GL reconciliation | Valuation, Pricing, Occupancy | Converts operating metrics into EBITDA proof |\n| GM ownership | Sales, Facility, KPI pack | Makes the growth plan transferable |\n| Lease/site control | Facility, Location, Valuation | Required to realize long-term growth |\n| Review preservation | Digital, Sales, Operations | Guardrail for every commercial experiment |\n\n## 90-Day Commercial Test Plan\n\n### Days 1–30 — Instrument\n\n- Configure daily capacity, occupancy, denial, cancellation, and RevPAU.\n- Establish booking/payment/GL reconciliation.\n- Publish pricing governance and peak calendar.\n- Launch controlled boarding-rate cohort.\n- Implement response-time SLA and lead-source capture.\n- Launch weekday membership and grooming pilots.\n- Document digital admin ownership.\n\n### Days 31–60 — Measure\n\n- Review cohort economics weekly.\n- Build customer retention/concentration analysis.\n- Refresh seven-competitor mystery shop.\n- Complete facility capex binder.\n- Train and audit front-desk scripts.\n- Produce first reconciled monthly KPI pack.\n- Confirm growth tests remain within review, churn, and service guardrails.\n\n### Days 61–90 — Prove\n\n- Produce 90-day capacity and experiment binder.\n- Calculate realized contribution, not gross opportunity.\n- Update valuation sensitivity using evidenced run rate.\n- Prepare buyer-facing commercial dashboard.\n- Assign ongoing KPI ownership.\n- Approve final GREEN/YELLOW readiness decision.\n\n## Buyer-Ready Evidence Checklist\n\n| Evidence | Current | Required Standard |\n|---|---|---|\n| TTM P&L and normalized EBITDA bridge | Complete | Refresh monthly |\n| Revenue by service line | Partial | Monthly and reconciled |\n| Daily occupancy/capacity | Missing | 90 consecutive days |\n| Denials and cancellations | Missing | Reason-coded daily log |\n| Price cohort results | Missing | ADR, churn, complaints, mix |\n| Customer retention/concentration | Partial | Anonymized cohort schedule |\n| Lead funnel | Partial | Source-to-booking weekly |\n| Digital credential map | Partial | Named admins and transfer steps |\n| Facility capex/inspection binder | Partial | Photos, invoices, signoff |\n| Competitor matrix | Complete | Refresh at Day 60 |\n| Monthly KPI pack | Missing | Reconciled to GL/payroll |\n| Proven-vs-upside bridge | Partial | Advisor-approved separation |\n\n## Risks and Guardrails\n\n- Pause price expansion if churn increases by more than 3 percentage points.\n- Preserve a 4.8+ review score during experiments.\n- Cap memberships if safe weekday occupancy exceeds 90%.\n- Do not claim denied demand unless the reason is capacity, not qualification or policy.\n- Do not present annualized upside as historical EBITDA.\n- Reconcile every commercial KPI to the financial statements within a 2% tolerance.\n- Separate landlord-controlled facility work from seller capex.\n- Maintain service and staffing ratios during yield tests.\n\n## Final Assessment\n\n**Current WS2 readiness: 63 / 100 — YELLOW.**  \n**Projected readiness after the roadmap: 90 / 100 — GREEN.**\n\nThe business already has the brand, earnings, market position, and team needed for a compelling acquisition story. The final step is to convert identified opportunity into data: daily capacity, controlled price tests, customer cohorts, sales conversion, and a reconciled KPI pack. Once complete, buyers can underwrite the $450,000 EBITDA base confidently and evaluate the ~$190,000 gross upside as a documented post-close opportunity rather than a seller projection.\n",
        "updatedAt": "2026-07-14T14:40:00.000Z",
        "clientName": "The Cactus Pet Resort",
        "workstream": "ws2",
        "generatedAt": "2026-07-14T14:40:00.000Z",
        "readinessScore": 63,
        "readinessStatus": "YELLOW",
        "workstreamLabel": "Workstream 2 — Profitability & Growth",
        "projectedReadinessScore": 90
      },
      "professionalAdvisors": [
        {
          "id": "adv-cpa",
          "name": "Maya Chen, CPA",
          "role": "Accountant",
          "email": "maya.chen@example.com",
          "notes": "Prepared reviewed financial statements and normalized EBITDA bridge; available for buyer Q&A.",
          "phone": "(602) 555-0171",
          "company": "Chen & Holloway Advisory",
          "willingToParticipate": "yes"
        },
        {
          "id": "adv-legal",
          "name": "Daniel Ortiz, Esq.",
          "role": "Lawyer",
          "email": "daniel.ortiz@example.com",
          "notes": "Entity, transaction and landlord-consent counsel; should coordinate UCC payoff and permit correction.",
          "phone": "(602) 555-0188",
          "company": "Ortiz Business Law PLLC",
          "willingToParticipate": "yes"
        },
        {
          "id": "adv-payroll",
          "name": "Nina Patel",
          "role": "Bookkeeper",
          "email": "nina.patel@example.com",
          "notes": "Maintains QuickBooks, payroll reconciliations and monthly close schedules.",
          "phone": "(480) 555-0134",
          "company": "Patel Ledger Services",
          "willingToParticipate": "yes"
        },
        {
          "id": "adv-ins",
          "name": "Marcus Hill",
          "role": "Other",
          "email": "marcus.hill@example.com",
          "notes": "Insurance broker; can supply five-year loss runs, policy schedules and tail-coverage options.",
          "phone": "(602) 555-0162",
          "company": "Southwest Risk Partners",
          "willingToParticipate": "yes"
        },
        {
          "id": "adv-re",
          "name": "Leah Morgan",
          "role": "Contractor",
          "email": "leah.morgan@example.com",
          "notes": "Lease advisor; not yet formally engaged for extension or transfer-consent negotiation.",
          "phone": "(480) 555-0199",
          "company": "Sonoran Commercial Realty",
          "willingToParticipate": "unknown"
        }
      ],
      "improvementRoadmap_ws1": {
        "markdown": "# Sales Readiness Roadmap\n## Workstream 1 — Risk Mitigation\n\n**Client:** The Cactus Pet Resort  \n**Roadmap horizon:** 90 days  \n**Starting readiness:** 54 / 100 — RED  \n**Target readiness:** 88 / 100 — GREEN  \n**Objective:** Convert every material WS1 finding into signed, dated, buyer-verifiable evidence before launch.\n\n## Dear Cactus Pet Resort Team,\n\nThe operating business is strong enough to attract buyers, but a buyer will evaluate whether cash flow can transfer safely. This roadmap is the execution layer for all Workstream 1 agents. It is organized around five readiness programs: site control, clear asset title, legal operating continuity, management continuity, and legacy-obligation cleanup.\n\nThe roadmap is deliberately evidence-based. A task is complete only when the resulting document is indexed in the data room and a buyer, lender, or attorney can independently verify it.\n\n## Readiness Scorecard\n\n| Program | Current | Target | Gate Owner | Evidence Required |\n|---|---:|---:|---|---|\n| Lease & site control | 30 | 90 | Elena + real-estate counsel | Consent, amendment, estoppel, premises exhibit |\n| Liens & asset title | 45 | 95 | Transaction counsel | Payoff letter, funds-flow instruction, UCC-3 |\n| Permits & zoning | 50 | 95 | GM + permit consultant | Corrected permit, zoning letter, inspection binder |\n| Management continuity | 45 | 90 | Elena + employment counsel | Retention, RACI, SOPs, transition agreement |\n| Tax / employee obligations | 55 | 85 | CPA + employment/tax counsel | Clearance, lookback, PTO and contractor treatment |\n| Contracts / vendor continuity | 60 | 90 | GM + counsel | Consent/notice log, exports, Day-1 runbook |\n| Corporate / insurance | 75 | 95 | Counsel + broker | Executed authority, fresh standing, loss runs |\n| Financial / valuation support | 85 | 95 | CPA + bookkeeper | Monthly bridge and normalized EBITDA binder |\n\n## Master Action Register\n\n| ID | Priority | Program | Action | Owner | Due | Dependency | Completion Evidence | Deal Impact |\n|---|---|---|---|---|---:|---|---|---|\n| WS1-01 | RED | Lease | Obtain landlord consent pathway | Elena / RE counsel | Day 15 | Buyer profile | Written term sheet and consent form | Removes transfer blocker |\n| WS1-02 | RED | Lease | Extend site control to 10 years including options | RE counsel | Day 30 | Landlord negotiation | Executed amendment or binding term sheet | Supports lender underwriting |\n| WS1-03 | RED | Lease/Facility | Correct premises exhibit and HVAC allocation | GM / RE counsel | Day 30 | Site plan | Exhibit, repair matrix, landlord acknowledgment | Reduces capex/use dispute |\n| WS1-04 | RED | Liens | Lock equipment payoff and UCC-3 process | Counsel / lender | Day 35 | Current payoff | Payoff letter, per-diem, escrow instruction | Delivers clear title |\n| WS1-05 | RED | Permits | Amend kennel permit to LLC d/b/a name | GM / permit consultant | Day 20 | Entity documents | Reissued permit | Protects operating continuity |\n| WS1-06 | RED | Zoning | Obtain written outdoor-use confirmation | Permit consultant | Day 30 | Corrected site plan | Municipal letter/email | Removes use uncertainty |\n| WS1-07 | RED | Management | Execute GM retention package | Elena / employment counsel | Day 21 | Compensation approval | Signed agreement and bonus schedule | Protects transition |\n| WS1-08 | RED | Management | Sign delegated-authority matrix | Elena / GM | Day 14 | Role inventory | Signed RACI and bank/vendor authorities | Reduces owner dependence |\n| WS1-09 | RED | Tax | Complete TPT reconciliation and clearance plan | CPA / tax counsel | Day 40 | Filed returns | Lookback schedule and clearance | Defines legacy exposure |\n| WS1-10 | RED | Workforce | Resolve contractor classification and PTO | Employment counsel | Day 45 | Census/payroll | Memo, signed decisions, settlement reserve | Limits employee claims |\n| WS1-11 | YELLOW | Contracts | Complete notices, consents, and renewal actions | GM / counsel | Day 35 | Contract register | Notice receipts and consent log | Preserves services |\n| WS1-12 | YELLOW | Vendors | Test exports and buyer credential transfer | GM / systems owner | Day 40 | Admin access | Export files and Day-1 runbook | Ensures operational handoff |\n| WS1-13 | YELLOW | Insurance | Obtain five-year carrier loss runs | Broker | Day 30 | Carrier requests | Certified loss runs and coverage memo | Supports insurability |\n| WS1-14 | YELLOW | Corporate | Execute member consent and authority package | Corporate counsel | Day 10 | Final structure | Signed consent and incumbency draft | Confirms seller authority |\n| WS1-15 | YELLOW | Advisors | Launch diligence calendar and response SLA | Data-room lead | Day 7 | Advisor contacts | Calendar, owner matrix, 48-hour SLA | Speeds diligence |\n| WS1-16 | GREEN | Financial | Maintain monthly EBITDA/add-back bridge | CPA / bookkeeper | Monthly | Closed books | Reconciled pack and source support | Protects valuation |\n| WS1-17 | YELLOW | Organization | Cross-train grooming and monthly close backup | GM | Day 50 | SOP inventory | Training signoff and backup calendar | Reduces single points |\n| WS1-18 | YELLOW | IP/Legal | Document logo, domain, social and data ownership | Marketing lead / counsel | Day 35 | Asset inventory | IP assignment and credential schedule | Enables clean transfer |\n\n## Sale-Readiness Checklist\n\n| ✅ | Category | Item | Status | Action Needed |\n|---|---|---|---|---|\n| ☐ | Legal & Corporate Standing | Executed sole-member transaction consent | 🟡 YELLOW | Sign consent and prepare closing bring-down. |\n| ☐ | Legal & Corporate Standing | Fresh good-standing and entity certificate | 🟡 YELLOW | Order within 30 days of closing. |\n| ☐ | Ownership & Transfer Readiness | Certified ownership and authority schedule | 🟢 GREEN | Maintain certified 100% sole-member record. |\n| ☐ | Litigation & Liens | Equipment UCC payoff and termination | 🔴 RED | Obtain payoff, per-diem, escrow instruction, and UCC-3 commitment. |\n| ☐ | Litigation & Liens | Bring-down litigation, judgment, and tax-lien searches | 🟡 YELLOW | Refresh at signing and closing. |\n| ☐ | Lease & Real Estate | Landlord consent and extended site control | 🔴 RED | Negotiate consent, ten-year control, estoppel, and guaranty release. |\n| ☐ | Lease & Real Estate | Premises exhibit and HVAC responsibility | 🔴 RED | Add outdoor-yard exhibit and written repair allocation. |\n| ☐ | Permits & Zoning | Kennel permit legal-name correction | 🔴 RED | Amend permit to LLC d/b/a format. |\n| ☐ | Permits & Zoning | Outdoor-use zoning confirmation | 🔴 RED | Obtain written municipal confirmation. |\n| ☐ | Key Person Dependencies | GM retention agreement | 🔴 RED | Sign market adjustment, 12-month retention, and transaction bonus. |\n| ☐ | Key Person Dependencies | Delegated authority and owner-transition SOPs | 🔴 RED | Sign RACI and document six-month transition. |\n| ☐ | Employment & HR | PTO and contractor disposition | 🔴 RED | Approve payout/assumption and classification resolution. |\n| ☐ | Tax | TPT reconciliation and tax clearance | 🔴 RED | Complete lookback and define escrow/indemnity if needed. |\n| ☐ | Material Contracts | Notice, consent, and renewal register | 🟡 YELLOW | Issue notices and obtain assignment approvals. |\n| ☐ | Insurance | Carrier-certified five-year loss runs | 🟡 YELLOW | Obtain claims and coverage transition memo. |\n| ☐ | Software & Vendors | Tested exports and Day-1 credential plan | 🟡 YELLOW | Prove exports and assign every admin owner. |\n| ☐ | Organization | Cross-training for grooming and monthly close | 🟡 YELLOW | Complete training and backup calendar. |\n| ☐ | Financial & Valuation | Reconciled monthly EBITDA/add-back binder | 🟢 GREEN | Refresh monthly and lock source documents. |\n\n## Workplan by Phase\n\n### Phase 1 — Days 1–15: Establish control\n\n**Required outcomes**\n- Appoint the data-room coordinator and weekly steering committee.\n- Send landlord proposal and buyer qualification package.\n- Execute sole-member consent and preliminary closing authority.\n- Sign delegated authority matrix.\n- Approve GM retention economics and route agreement for signature.\n- Open lender payoff request and municipal permit/zoning requests.\n- Freeze the master contract, advisor, employee, and vendor registers.\n\n**Weekly steering metrics**\n- Red items with named owner: 100%.\n- External requests acknowledged: at least 90%.\n- Missing source documents assigned: 100%.\n- Data-room naming/index standard applied: 100%.\n\n### Phase 2 — Days 16–30: Remove launch blockers\n\n**Required outcomes**\n- Receive landlord consent/amendment term sheet.\n- Receive reissued kennel permit and zoning response.\n- Sign GM retention agreement.\n- Obtain preliminary lender payoff and UCC-3 form.\n- Receive carrier loss runs.\n- Issue every contract notice and consent request.\n- Complete premises/site plan and HVAC responsibility schedule.\n\n**Go/no-go review at Day 30**\nLaunch remains **NO-GO** if there is no written landlord pathway, no permit/zoning pathway, or no signed GM retention. The UCC item may remain open only if lender release mechanics are documented.\n\n### Phase 3 — Days 31–60: Convert issues into diligence evidence\n\n**Required outcomes**\n- Finalize landlord package and seller-guaranty release.\n- Finalize tax lookback, PTO decision, and contractor memo.\n- Complete contract consents and tested system exports.\n- Finish owner-to-GM SOP transfer and cross-training.\n- Complete IP/credential ownership schedule.\n- Assemble reconciled financial/valuation binder.\n- Conduct a legal, employment, tax, lease, and insurance mock diligence review.\n\n**Quality standard**\nEvery completion item must include a signed/issued document, source owner, effective date, expiration/renewal date, and data-room index reference.\n\n### Phase 4 — Days 61–90: Validate, refresh, and launch\n\n**Required outcomes**\n- Refresh good standing, UCC, litigation, judgment, tax-lien, and insurance evidence.\n- Reconcile all disclosure schedules to the data room.\n- Run management-presentation rehearsal led by the GM.\n- Complete buyer Q&A bank and advisor response tree.\n- Confirm closing sources-and-uses includes lien, PTO, retention, tax, and readiness costs.\n- Issue final WS1 readiness decision.\n\n## Data Room Architecture\n\n| Folder | Required Contents | Quality Control |\n|---|---|---|\n| 01 Corporate | Articles, OA, EIN, ownership, consent, standing, DBA | Legal names and dates match |\n| 02 Financial | Monthly P&L, TTM bridge, add-backs, payroll, bank/GL support | Reconciles to $450K normalized EBITDA |\n| 03 Lease / Facility | Lease, amendments, rent, CAM, consent, estoppel, site plan | Complete signed package |\n| 04 Permits / Zoning | Kennel permit, license, CO, zoning, inspections, renewals | LLC d/b/a name consistent |\n| 05 Employees | Census, agreements, PTO, handbook, benefits, retention, RACI | PII-controlled access |\n| 06 Contracts / Vendors | Contract schedule, notices, consents, exports, credentials | Renewal and assignment dates tracked |\n| 07 Legal / Liens | Searches, claims, payoff, UCC-3, counsel memo | Bring-down dates current |\n| 08 Tax | Returns, TPT, payroll filings, notices, clearance | CPA reconciliation |\n| 09 Insurance | Policies, endorsements, loss runs, claims, broker memo | Coverage periods complete |\n| 10 IP / Digital | Trade name, logo, domain, social, creative, customer-data rights | Chain of title documented |\n\n## Evidence Acceptance Rules\n\n- “Requested” is not complete; third-party response or signed acknowledgement is required.\n- “Draft” is not complete unless counsel confirms it is the agreed closing form.\n- Screenshots do not replace certified searches, filed records, or executed agreements.\n- Every amount must tie to a dated source.\n- Every consent must identify the correct legal seller and contemplated transaction.\n- Every operational SOP needs a named owner and backup.\n- Expiring evidence must be refreshed at signing/closing.\n\n## Escalation Triggers\n\n| Trigger | Escalation | Decision |\n|---|---|---|\n| Landlord rejects assignment or extension | Seller + M&A + RE counsel within 24 hours | Reprice, structure, or pause launch |\n| Zoning will not confirm outdoor use | Permit counsel and facility advisor | Cure, redesign, or disclose with reserve |\n| Lender will not commit to termination | Transaction counsel and escrow | Alternative payoff/control arrangement |\n| GM declines retention | Seller and advisor | Replacement/transition plan; valuation review |\n| Tax/contractor exposure exceeds $75,000 | Tax/employment counsel | Escrow, indemnity, or proceeds adjustment |\n| Material contract cannot transfer | GM and advisor | Replacement vendor and cost bridge |\n\n## Buyer Q&A Preparation\n\nPrepare concise, evidence-linked answers to:\n1. Why is the landlord expected to consent, and how much term remains?\n2. What assets are covered by the UCC filing, and exactly how will it be released?\n3. Do all permits cover the current LLC, premises, capacity, and outdoor uses?\n4. Who runs the business after Elena exits, and what is contractually committed?\n5. What is the maximum known PTO, contractor, tax, and claim exposure?\n6. Which contracts require consent or create post-close cost changes?\n7. How does $392,000 reported EBITDA reconcile to $450,000 normalized EBITDA?\n8. What customer data, domains, brand assets, and vendor credentials transfer?\n9. Which matters require escrow, special indemnity, or closing condition?\n10. What evidence has been refreshed since the initial report?\n\n## Readiness Decision Framework\n\n| Result | Criteria |\n|---|---|\n| GREEN / Launch | Landlord pathway, permit/zoning evidence, GM retention, UCC release mechanics, and quantified legacy exposure are documented |\n| YELLOW / Limited outreach | One gate remains open with a credible third-party timetable and approved contingency |\n| RED / Do not launch | Site control, legal operation, or management continuity lacks a written path |\n\n## Final Roadmap Direction\n\nThe Cactus Pet Resort should use the next 90 days to prove transferability, not merely business quality. Completion of the 18 actions above creates a defensible buyer narrative: clear site control, clear asset title, lawful operating continuity, retained management, quantified legacy obligations, and a fully indexed diligence record.\n",
        "checklist": [
          {
            "id": "ws1-authority",
            "item": "Executed sole-member transaction consent",
            "status": "🟡 YELLOW",
            "category": "Legal & Corporate Standing",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Sign consent and prepare closing bring-down.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-standing",
            "item": "Fresh good-standing and entity certificate",
            "status": "🟡 YELLOW",
            "category": "Legal & Corporate Standing",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Order within 30 days of closing.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-ownership",
            "item": "Certified ownership and authority schedule",
            "status": "🟢 GREEN",
            "category": "Ownership & Transfer Readiness",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Maintain current certified copy.",
            "advisorApproved": true,
            "clientCompleted": true,
            "clientCompletedAt": "2026-07-14T14:15:00.000Z"
          },
          {
            "id": "ws1-ucc",
            "item": "Equipment UCC payoff and termination",
            "status": "🔴 RED",
            "category": "Litigation & Liens",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Obtain payoff, per-diem, escrow instruction, and UCC-3 commitment.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-searches",
            "item": "Bring-down litigation, judgment, and tax-lien searches",
            "status": "🟡 YELLOW",
            "category": "Litigation & Liens",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Refresh at signing and closing.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-lease",
            "item": "Landlord consent and extended site control",
            "status": "🔴 RED",
            "category": "Lease & Real Estate",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Negotiate consent, ten-year control, estoppel, and guaranty release.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-premises",
            "item": "Premises exhibit and HVAC responsibility",
            "status": "🔴 RED",
            "category": "Lease & Real Estate",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Add outdoor-yard exhibit and written repair allocation.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-permit",
            "item": "Kennel permit legal-name correction",
            "status": "🔴 RED",
            "category": "Permits & Zoning",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Amend permit to LLC d/b/a format.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-zoning",
            "item": "Outdoor-use zoning confirmation",
            "status": "🔴 RED",
            "category": "Permits & Zoning",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Obtain written municipal confirmation.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-gm",
            "item": "GM retention agreement",
            "status": "🔴 RED",
            "category": "Key Person Dependencies",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Sign market adjustment, 12-month retention, and transaction bonus.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-transition",
            "item": "Delegated authority and owner-transition SOPs",
            "status": "🔴 RED",
            "category": "Key Person Dependencies",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Sign RACI and document six-month transition.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-employment",
            "item": "PTO and contractor disposition",
            "status": "🔴 RED",
            "category": "Employment & HR",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Approve payout/assumption and classification resolution.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-tax",
            "item": "TPT reconciliation and tax clearance",
            "status": "🔴 RED",
            "category": "Tax",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Complete lookback and define escrow/indemnity if needed.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-contracts",
            "item": "Notice, consent, and renewal register",
            "status": "🟡 YELLOW",
            "category": "Material Contracts",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Issue notices and obtain assignment approvals.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-insurance",
            "item": "Carrier-certified five-year loss runs",
            "status": "🟡 YELLOW",
            "category": "Insurance",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Obtain claims and coverage transition memo.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-vendors",
            "item": "Tested exports and Day-1 credential plan",
            "status": "🟡 YELLOW",
            "category": "Software & Vendors",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Prove exports and assign every admin owner.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-cross-training",
            "item": "Cross-training for grooming and monthly close",
            "status": "🟡 YELLOW",
            "category": "Organization",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Complete training and backup calendar.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-financial",
            "item": "Reconciled monthly EBITDA/add-back binder",
            "status": "🟢 GREEN",
            "category": "Financial & Valuation",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Refresh monthly and lock source documents.",
            "advisorApproved": true,
            "clientCompleted": true,
            "clientCompletedAt": "2026-07-14T14:15:00.000Z"
          }
        ],
        "updatedAt": "2026-07-14T14:15:00.000Z",
        "clientName": "The Cactus Pet Resort",
        "workstream": "ws1",
        "generatedAt": "2026-07-14T14:15:00.000Z",
        "readinessScore": 54,
        "workstreamLabel": "Workstream 1 — Risk Mitigation",
        "targetReadinessScore": 88
      },
      "improvementRoadmap_ws2": {
        "markdown": "# Sales Readiness Roadmap\n## Workstream 2 — Profitability & Growth\n\n**Client:** The Cactus Pet Resort  \n**Roadmap horizon:** 90 days  \n**Starting readiness:** 63 / 100 — YELLOW  \n**Target readiness:** 90 / 100 — GREEN  \n**Objective:** Convert premium reputation, available weekday capacity, and identified pricing gaps into measured, repeatable growth evidence.\n\n## Executive Direction\n\nThe business already has what buyers want: $1.7M revenue, $450K normalized EBITDA, a 4.9 Google rating from 214 reviews, an established Phoenix location, and a credible operating team. The remaining WS2 challenge is proof. Buyers will not fully credit projected price increases, occupancy gains, memberships, or grooming attachment without cohort-level evidence.\n\nThis roadmap coordinates the Valuation, Location, Competitor, Digital Presence, Facility, Occupancy, Competitive Pricing, Pricing by Vertical, Sales Process, WS2 Assessment, and WS2 Roadmap agents. It creates one commercial operating system with daily capacity, rate, conversion, churn, and revenue-per-available-unit reporting.\n\n## Growth Thesis\n\n| Lever | Baseline | 90-Day Test | Annualized Gross Opportunity | Buyer Proof |\n|---|---:|---|---:|---|\n| Boarding base rates | Below premium peer median | +6% phased cohort | $62,000 | Rate realization and churn |\n| Peak/holiday pricing | Inconsistent | Peak calendar and minimum stays | $38,000 | Peak ADR and denial recovery |\n| Daycare membership | Ad hoc packages | Capped weekday membership | $34,000 | Members, attendance, churn |\n| Grooming attachment | 18% of eligible departures | Target 25% | $29,000 | Attachment and labor utilization |\n| Add-ons / enrichment | 22% attachment | Target 30% | $17,000 | Add-on mix and gross margin |\n| Lead conversion | 46% | Target 55% | $10,000+ | Inquiry-to-book and response time |\n| Total gross opportunity | — | — | ~$190,000 | Do not add to current EBITDA until proven |\n\n## WS2 Readiness Scorecard\n\n| Domain | Current | Target | Key Gap | 90-Day Evidence |\n|---|---:|---:|---|---|\n| Reputation / digital | 82 | 90 | Attribution and ownership | Source dashboard and credential map |\n| Facility | 78 | 88 | HVAC/yard documentation and minor capex | Capex log and inspection evidence |\n| Occupancy | 58 | 90 | Monthly averages hide day/vertical constraints | Daily capacity dashboard |\n| Competitive position | 80 | 90 | Mystery-shop sample needs quarterly refresh | Competitor matrix |\n| Pricing | 55 | 88 | Rate gaps are untested | Cohort results and realized ADR |\n| Sales process | 60 | 88 | Lead source and follow-up inconsistent | CRM funnel and SLA |\n| Revenue quality | 74 | 90 | Mix and recurring revenue reporting limited | Monthly KPI pack |\n| Commercial readiness | 63 | 90 | Upside not yet buyer-verifiable | 90-day experiment binder |\n\n## Master Commercial Action Register\n\n| ID | Priority | Lever | Action | Owner | Due | KPI | Completion Evidence |\n|---|---|---|---|---|---:|---|---|\n| WS2-01 | RED | Occupancy | Configure daily capacity by vertical and unit type | GM / booking admin | Day 14 | Occupancy, RevPAU, denials | 30 consecutive days of dashboard data |\n| WS2-02 | RED | Pricing | Phase +6% boarding rate test | GM / advisor | Day 21 | Realized ADR, churn, cancellations | Cohort report with old/new rates |\n| WS2-03 | RED | Peak yield | Publish 12-month peak/holiday calendar | GM | Day 14 | Peak ADR, minimum stay, denials | Published rules and booking audit |\n| WS2-04 | RED | Daycare | Launch capped weekday membership pilot | AGM | Day 30 | Members, visits, churn, utilization | Pilot roster and unit economics |\n| WS2-05 | RED | Sales | Implement inquiry response SLA and lead-source capture | Front desk lead | Day 14 | Response time, conversion | CRM/export and weekly funnel |\n| WS2-06 | YELLOW | Grooming | Offer departure-day grooming bundle | Grooming lead | Day 30 | Attachment, ticket, labor use | Bundle results by cohort |\n| WS2-07 | YELLOW | Add-ons | Standardize enrichment/add-on menu | GM / marketing | Day 21 | Attachment and margin | Menu, scripts, mix report |\n| WS2-08 | YELLOW | Digital | Fix attribution and admin ownership | Marketing vendor | Day 21 | Leads by source, CAC | GA/GBP/admin map and source report |\n| WS2-09 | YELLOW | Reputation | Automate post-stay review workflow | Front desk / system admin | Day 21 | Review volume and score | Workflow proof and monthly trend |\n| WS2-10 | YELLOW | Facility | Complete minor buyer-visible capex | GM / landlord | Day 45 | Closure rate, photos | Capex log and before/after evidence |\n| WS2-11 | YELLOW | Competitors | Refresh seven-competitor mystery shop | Advisor | Day 60 | Rate index and feature grid | Dated calls/screenshots and matrix |\n| WS2-12 | YELLOW | Finance | Reconcile monthly KPI pack to GL | Bookkeeper / CPA | Monthly | Revenue mix, labor %, EBITDA | Signed monthly pack |\n| WS2-13 | YELLOW | Customer | Build cohort retention and concentration view | Analyst | Day 45 | Repeat rate, top-10 %, LTV | Anonymized cohort report |\n| WS2-14 | YELLOW | Sales | Build scripts for tours, objections, and follow-up | GM / front desk lead | Day 30 | Tour-to-book conversion | Script, training log, call audit |\n| WS2-15 | GREEN | Location | Refresh trade-area and referral map | Marketing / analyst | Day 45 | Revenue by ZIP/referral | Map tied to TTM customers |\n| WS2-16 | GREEN | Valuation | Separate proven EBITDA from upside | CPA / advisor | Monthly | Base vs run-rate bridge | Evidence-backed valuation schedule |\n\n## Sale-Readiness Checklist\n\n| ✅ | Category | Item | Status | Action Needed |\n|---|---|---|---|---|\n| ☐ | Revenue & Profitability | Revenue and EBITDA bridge | 🟢 GREEN | Maintain monthly reconciliation and source support. |\n| ☐ | Occupancy | Daily capacity by vertical and unit type | 🔴 RED | Produce 90 days of occupancy, denials, cancellations, and RevPAU. |\n| ☐ | Pricing Strategy | Boarding rate cohort test | 🔴 RED | Test +6%, track realization and churn. |\n| ☐ | Pricing Strategy | Peak and holiday pricing calendar | 🔴 RED | Publish rules, minimum stays, and deposits. |\n| ☐ | Daycare Growth | Capped weekday membership pilot | 🔴 RED | Test retention and contribution margin. |\n| ☐ | Sales Process | Inquiry response SLA and lead-source capture | 🔴 RED | Track response and inquiry-to-book conversion. |\n| ☐ | Grooming | Departure-day grooming bundle | 🟡 YELLOW | Raise attachment from 18% toward 25%. |\n| ☐ | Add-ons | Enrichment attachment program | 🟡 YELLOW | Standardize menu and measure margin. |\n| ☐ | Digital Presence | Attribution and admin ownership | 🟡 YELLOW | Link source, booking, and revenue records. |\n| ☐ | Reputation | Automated review workflow | 🟢 GREEN | Preserve 4.9 score and grow verified volume. |\n| ☐ | Facility | Minor capex and inspection evidence | 🟡 YELLOW | Close buyer-visible items with photos/invoices. |\n| ☐ | Competitive Position | Quarterly competitor price/feature refresh | 🟡 YELLOW | Refresh seven-peer mystery shop. |\n| ☐ | Customer Quality | Retention, concentration, and cohort report | 🟡 YELLOW | Quantify repeat rate, churn, and top-customer exposure. |\n| ☐ | Financial Reporting | Reconciled monthly KPI pack | 🟡 YELLOW | Tie commercial metrics to GL and payroll. |\n| ☐ | Location | Revenue-by-ZIP and referral map | 🟢 GREEN | Refresh using trailing-12-month records. |\n| ☐ | Valuation | Proven-vs-upside bridge | 🟢 GREEN | Keep upside separate until 90-day evidence exists. |\n\n## KPI Dictionary\n\n| KPI | Definition | Source | Frequency | Owner |\n|---|---|---|---|---|\n| Occupancy | Sold units / available units by vertical/day | Booking system | Daily | GM |\n| RevPAU | Revenue / available unit by vertical/day | Booking + GL | Weekly | Bookkeeper |\n| Realized ADR | Net service revenue / sold unit nights | Booking + payments | Weekly | GM |\n| Denial rate | Capacity-driven declined requests / qualified requests | Front desk log | Daily | Front desk lead |\n| Cancellation rate | Cancelled bookings / booked stays | Booking system | Weekly | AGM |\n| Inquiry conversion | New bookings / qualified inquiries | CRM/phone/email | Weekly | Front desk lead |\n| Response time | Median minutes to first response | Phone/email/CRM | Weekly | Front desk lead |\n| Repeat rate | Customers with 2+ visits / active customers | Booking system | Monthly | Analyst |\n| Membership churn | Cancelled members / beginning members | Booking system | Monthly | AGM |\n| Grooming attachment | Eligible departures with grooming / eligible departures | Booking system | Weekly | Grooming lead |\n| Add-on attachment | Transactions with enrichment / eligible transactions | Booking system | Weekly | GM |\n| Labor % | Direct labor / service revenue | Payroll + GL | Monthly | CPA |\n| Review velocity | New reviews per month and average score | Google profile | Monthly | Marketing |\n| Revenue mix | Revenue by boarding/daycare/grooming/add-ons | GL + booking | Monthly | Bookkeeper |\n\n## 90-Day Experiment Design\n\n### Experiment A — Boarding rate reset\n\n- **Cohort:** new bookings and returning customers with no reservation in prior 60 days.\n- **Change:** increase standard boarding rates by 6%; preserve a controlled legacy cohort for four weeks.\n- **Guardrails:** churn under 3 percentage points; cancellation increase under 2 points; complaint rate under 1%.\n- **Decision:** roll out if realized ADR rises at least 4.5% with guardrails met.\n- **Evidence:** cohort list, quoted/booked rate, cancellation reason, stay completion, and net revenue.\n\n### Experiment B — Peak and holiday yield\n\n- **Change:** publish peak calendar, deposits, minimum stays, and late-cancellation rules.\n- **Measure:** peak ADR, average length of stay, denials, cancellations, and waitlist recovery.\n- **Decision:** retain rules if peak RevPAU improves at least 8% without meaningful review-score decline.\n\n### Experiment C — Weekday daycare membership\n\n- **Change:** capped recurring plan for Tuesday–Thursday utilization.\n- **Capacity control:** limit memberships so peak weekday occupancy remains below 90%.\n- **Measure:** member acquisition, visits, churn, incremental labor, and contribution margin.\n- **Decision:** scale if three-month contribution margin exceeds 55% and churn remains below 8% monthly.\n\n### Experiment D — Departure-day grooming\n\n- **Change:** bundle bath/nails/grooming into booking confirmation and pre-departure message.\n- **Measure:** attachment, average ticket, labor utilization, on-time departure, and customer rating.\n- **Decision:** scale if attachment reaches 25% with no pickup-delay deterioration.\n\n## 30 / 60 / 90 Day Plan\n\n### Days 1–30 — Instrument and launch\n\n- Configure daily capacity/occupancy and denial logging.\n- Publish peak calendar and pricing governance.\n- Launch boarding price cohort and daycare membership pilot.\n- Implement lead-source capture and response SLA.\n- Standardize grooming/add-on offer scripts.\n- Fix digital admin ownership and attribution.\n- Establish baseline KPI pack tied to the GL.\n\n### Days 31–60 — Measure and refine\n\n- Review cohort economics weekly; adjust only with documented approval.\n- Complete facility capex and photo/invoice binder.\n- Refresh competitor pricing and feature matrix.\n- Build customer retention/concentration report.\n- Train front desk on tour, objection, and follow-up scripts.\n- Reconcile booking, payment, payroll, and GL data.\n- Present first month of KPI trends to the advisor steering group.\n\n### Days 61–90 — Prove and package\n\n- Produce full 90-day commercial evidence binder.\n- Separate proven run-rate improvement from unproven upside.\n- Update valuation sensitivity using realized, not projected, economics.\n- Build buyer-facing growth narrative with cohort charts and operating owner.\n- Approve ongoing pricing governance and KPI responsibility.\n- Issue final WS2 readiness score.\n\n## Buyer Evidence Binder\n\n| Folder | Evidence | Buyer Question Answered |\n|---|---|---|\n| 01 Daily Capacity | Occupancy, denials, cancellations, RevPAU | Is growth capacity real? |\n| 02 Pricing | Rate cards, cohorts, realized ADR, churn | Will customers accept higher prices? |\n| 03 Customers | Retention, concentration, ZIP, referral | Is revenue durable and diversified? |\n| 04 Digital | Attribution, leads, admin ownership, reviews | Can demand generation transfer? |\n| 05 Sales | Funnel, response time, scripts, tour conversion | Is the process repeatable? |\n| 06 Facility | Capex, inspections, photos, capacity definitions | Can the site support the plan? |\n| 07 Financial | Revenue mix, labor, EBITDA, base/upside bridge | Does operating data tie to earnings? |\n| 08 Competition | Dated price/feature matrix | Is premium positioning defensible? |\n\n## Commercial Governance\n\n- GM owns rate execution, capacity, and weekly operating metrics.\n- Bookkeeper owns booking/payment/GL reconciliation.\n- Front desk lead owns lead capture, response time, and denial reasons.\n- AGM owns daycare membership and service recovery.\n- Grooming lead owns grooming capacity and attachment.\n- Marketing vendor owns attribution, review workflow, and credential documentation.\n- Advisor approves material pricing changes during the 90-day test.\n\nNo uplift should be characterized as normalized EBITDA until it appears in closed financials and is supported by repeatable operating metrics.\n\n## Escalation Triggers\n\n| Trigger | Response |\n|---|---|\n| Price-test churn exceeds 3-point guardrail | Pause expansion and analyze cohort/service causes |\n| Review score falls below 4.8 | Suspend aggressive changes and run service-recovery audit |\n| Peak denials exceed 12% with safe capacity available | Fix scheduling, deposit, and waitlist process |\n| Daycare membership creates >90% weekday occupancy | Cap sales and adjust plan utilization |\n| Grooming pickup delays exceed 15 minutes median | Reduce bundle volume or revise staffing |\n| KPI pack fails to reconcile within 2% of GL | Do not present metrics externally until corrected |\n\n## Final Roadmap Direction\n\nWS2 becomes GREEN when the business has 90 consecutive days of daily capacity data, completed price and membership cohorts, a reconciled KPI pack, proven lead conversion, and documented facility/digital transferability. The commercial story should then be presented as two layers: a supportable $450,000 normalized EBITDA base and separately identified upside with measured proof.\n",
        "checklist": [
          {
            "id": "ws2-financials",
            "item": "Revenue and EBITDA bridge",
            "status": "🟢 GREEN",
            "category": "Revenue & Profitability",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Maintain monthly reconciliation and source support.",
            "advisorApproved": true,
            "clientCompleted": true,
            "clientCompletedAt": "2026-07-14T14:15:00.000Z"
          },
          {
            "id": "ws2-capacity",
            "item": "Daily capacity by vertical and unit type",
            "status": "🔴 RED",
            "category": "Occupancy",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Produce 90 days of occupancy, denials, cancellations, and RevPAU.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws2-pricing",
            "item": "Boarding rate cohort test",
            "status": "🔴 RED",
            "category": "Pricing Strategy",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Test +6%, track realization and churn.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws2-peak",
            "item": "Peak and holiday pricing calendar",
            "status": "🔴 RED",
            "category": "Pricing Strategy",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Publish rules, minimum stays, and deposits.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws2-membership",
            "item": "Capped weekday membership pilot",
            "status": "🔴 RED",
            "category": "Daycare Growth",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Test retention and contribution margin.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws2-sales",
            "item": "Inquiry response SLA and lead-source capture",
            "status": "🔴 RED",
            "category": "Sales Process",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Track response and inquiry-to-book conversion.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws2-grooming",
            "item": "Departure-day grooming bundle",
            "status": "🟡 YELLOW",
            "category": "Grooming",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Raise attachment from 18% toward 25%.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws2-addons",
            "item": "Enrichment attachment program",
            "status": "🟡 YELLOW",
            "category": "Add-ons",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Standardize menu and measure margin.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws2-digital",
            "item": "Attribution and admin ownership",
            "status": "🟡 YELLOW",
            "category": "Digital Presence",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Link source, booking, and revenue records.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws2-reputation",
            "item": "Automated review workflow",
            "status": "🟢 GREEN",
            "category": "Reputation",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Preserve 4.9 score and grow verified volume.",
            "advisorApproved": true,
            "clientCompleted": true,
            "clientCompletedAt": "2026-07-14T14:15:00.000Z"
          },
          {
            "id": "ws2-facility",
            "item": "Minor capex and inspection evidence",
            "status": "🟡 YELLOW",
            "category": "Facility",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Close buyer-visible items with photos/invoices.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws2-competitors",
            "item": "Quarterly competitor price/feature refresh",
            "status": "🟡 YELLOW",
            "category": "Competitive Position",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Refresh seven-peer mystery shop.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws2-customer",
            "item": "Retention, concentration, and cohort report",
            "status": "🟡 YELLOW",
            "category": "Customer Quality",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Quantify repeat rate, churn, and top-customer exposure.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws2-kpis",
            "item": "Reconciled monthly KPI pack",
            "status": "🟡 YELLOW",
            "category": "Financial Reporting",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Tie commercial metrics to GL and payroll.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws2-location",
            "item": "Revenue-by-ZIP and referral map",
            "status": "🟢 GREEN",
            "category": "Location",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Refresh using trailing-12-month records.",
            "advisorApproved": true,
            "clientCompleted": true,
            "clientCompletedAt": "2026-07-14T14:15:00.000Z"
          },
          {
            "id": "ws2-valuation",
            "item": "Proven-vs-upside bridge",
            "status": "🟢 GREEN",
            "category": "Valuation",
            "approvedAt": "2026-07-14T14:15:00.000Z",
            "actionNeeded": "Keep upside separate until 90-day evidence exists.",
            "advisorApproved": true,
            "clientCompleted": true,
            "clientCompletedAt": "2026-07-14T14:15:00.000Z"
          }
        ],
        "updatedAt": "2026-07-14T14:15:00.000Z",
        "clientName": "The Cactus Pet Resort",
        "workstream": "ws2",
        "generatedAt": "2026-07-14T14:15:00.000Z",
        "readinessScore": 63,
        "workstreamLabel": "Workstream 2 — Profitability & Growth",
        "targetReadinessScore": 90
      },
      "competitorPricingInputs": {
        "updatedAt": "2026-07-14T12:44:01.954Z",
        "competitors": [
          {
            "name": "Sonoran Paws Lodge",
            "websiteUrl": "https://example.com/sonoran-paws"
          },
          {
            "name": "Desert Tails Club",
            "websiteUrl": "https://example.com/desert-tails"
          },
          {
            "name": "Copper State Canine Resort",
            "websiteUrl": "https://example.com/copper-state"
          },
          {
            "name": "Papago Pet Retreat",
            "websiteUrl": "https://example.com/papago-pet"
          },
          {
            "name": "Valley Bark & Stay",
            "websiteUrl": "https://example.com/valley-bark"
          }
        ],
        "sellerWebsiteUrl": "https://example.com/cactus-pet-resort",
        "sellerManualPricingText": "Standard boarding $58; luxury suite $78; daycare $34; bath and brush $48."
      },
      "saleReadinessChecklist_ws1": {
        "items": [
          {
            "id": "ws1-entity",
            "item": "Current good-standing certificate",
            "status": "🟡 YELLOW",
            "category": "Legal & Corporate Standing",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Order within 30 days of diligence launch.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-authority",
            "item": "Member transaction authorization",
            "status": "🟡 YELLOW",
            "category": "Legal & Corporate Standing",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Prepare written member consent.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-ownership",
            "item": "Ownership schedule",
            "status": "🟢 GREEN",
            "category": "Ownership & Transfer Readiness",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Maintain current certified copy.",
            "advisorApproved": true,
            "clientCompleted": true,
            "clientCompletedAt": "2026-07-14T12:44:01.954Z"
          },
          {
            "id": "ws1-ucc",
            "item": "Equipment UCC payoff and termination",
            "status": "🔴 RED",
            "category": "Litigation & Liens",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Obtain payoff letter and closing UCC-3 commitment.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-litigation",
            "item": "Material litigation search",
            "status": "🟢 GREEN",
            "category": "Litigation & Liens",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Refresh immediately before closing.",
            "advisorApproved": true,
            "clientCompleted": true,
            "clientCompletedAt": "2026-07-14T12:44:01.954Z"
          },
          {
            "id": "ws1-lease",
            "item": "Landlord consent and extended site control",
            "status": "🔴 RED",
            "category": "Lease & Real Estate",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Negotiate consent, extension, and guaranty release.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-permit",
            "item": "Kennel permit legal-name correction",
            "status": "🔴 RED",
            "category": "Permits & Zoning",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Amend permit and calendar renewal.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-zoning",
            "item": "Outdoor-use zoning confirmation",
            "status": "🔴 RED",
            "category": "Permits & Zoning",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Obtain written city confirmation.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-gm",
            "item": "GM retention agreement",
            "status": "🔴 RED",
            "category": "Key Person Dependencies",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Agree market adjustment and transaction retention bonus.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-sop",
            "item": "Owner responsibility transfer SOPs",
            "status": "🟡 YELLOW",
            "category": "Key Person Dependencies",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Document finance, pricing, marketing, and vendor routines.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws1-staff",
            "item": "Current compensation roster",
            "status": "🟢 GREEN",
            "category": "Employment & HR",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Reconcile quarterly to payroll.",
            "advisorApproved": true,
            "clientCompleted": true,
            "clientCompletedAt": "2026-07-14T12:44:01.954Z"
          },
          {
            "id": "ws1-transition",
            "item": "Six-month owner transition plan",
            "status": "🟡 YELLOW",
            "category": "Employment & HR",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Attach scope and milestones to deal plan.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          }
        ],
        "clientName": "The Cactus Pet Resort",
        "workstream": "ws1",
        "generatedAt": "2026-07-14T12:44:01.954Z"
      },
      "saleReadinessChecklist_ws2": {
        "items": [
          {
            "id": "ws2-financials",
            "item": "Revenue and EBITDA bridge",
            "status": "🟢 GREEN",
            "category": "Revenue & Profitability",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Maintain monthly close and add-back support.",
            "advisorApproved": true,
            "clientCompleted": true,
            "clientCompletedAt": "2026-07-14T12:44:01.954Z"
          },
          {
            "id": "ws2-pricing",
            "item": "Core rate reset",
            "status": "🔴 RED",
            "category": "Pricing Strategy",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Phase boarding and daycare increases and monitor churn.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws2-peak",
            "item": "Peak and holiday pricing calendar",
            "status": "🔴 RED",
            "category": "Pricing Strategy",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Publish calendar and minimum-stay rules.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws2-capacity",
            "item": "Daily occupancy and denial reporting",
            "status": "🔴 RED",
            "category": "Facility & Operations",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Configure daily capacity dashboard by vertical.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws2-membership",
            "item": "Weekday daycare membership",
            "status": "🟡 YELLOW",
            "category": "Growth Trajectory",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Pilot capped recurring plans.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws2-reputation",
            "item": "Review score and volume",
            "status": "🟢 GREEN",
            "category": "Competitive Positioning",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Continue automated review requests.",
            "advisorApproved": true,
            "clientCompleted": true,
            "clientCompletedAt": "2026-07-14T12:44:01.954Z"
          },
          {
            "id": "ws2-tiers",
            "item": "Boarding tier architecture",
            "status": "🟡 YELLOW",
            "category": "Pricing Strategy",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Define standard, premium, and suite packages.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws2-tradearea",
            "item": "Trade-area mapping",
            "status": "🟢 GREEN",
            "category": "Customer Concentration",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Refresh customer pins quarterly.",
            "advisorApproved": true,
            "clientCompleted": true,
            "clientCompletedAt": "2026-07-14T12:44:01.954Z"
          },
          {
            "id": "ws2-kpis",
            "item": "Monthly KPI pack",
            "status": "🟡 YELLOW",
            "category": "Revenue & Profitability",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Reconcile revenue, occupancy, labor, and RevPAU.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          },
          {
            "id": "ws2-groom",
            "item": "Departure-day grooming bundle",
            "status": "🟡 YELLOW",
            "category": "Growth Trajectory",
            "approvedAt": "2026-07-14T12:44:01.954Z",
            "actionNeeded": "Pilot bundle and measure attachment rate.",
            "advisorApproved": true,
            "clientCompleted": false,
            "clientCompletedAt": null
          }
        ],
        "clientName": "The Cactus Pet Resort",
        "workstream": "ws2",
        "generatedAt": "2026-07-14T12:44:01.954Z"
      },
      "facilityReviewAdvisorInputs": {
        "runMode": "advisor",
        "location": "1720 E Deer Valley Dr, Phoenix, AZ 85024",
        "businessName": "The Cactus Pet Resort",
        "meetingNotes": "Illustrative advisor walk-through completed July 10, 2026. Facility clean and well managed; HVAC reserve, outdoor shade, drainage and kennel-gate maintenance require planning."
      }
    },
    "approvedNormalizedEbitda": 450000,
    "approvedNormalizedEbitdaAt": "2026-07-14T07:14:01.954Z",
    "businessAddress": "1720 E Deer Valley Dr, Phoenix, AZ 85024",
    "businessCategory": "Pet boarding, daycare, and grooming",
    "websiteUrl": "https://example.com/cactus-pet-resort",
    "customWorkstreamId": null,
    "sectionDeadlines": {},
    "clientRelease": {}
  },
  "rows": {
    "CimReport": [
      {
        "id": "demo-cactus-cim",
        "clientId": "demo-cactus-pet-resort",
        "data": {
          "region": "Phoenix, Arizona",
          "subtitle": "Confidential Acquisition Opportunity",
          "gmProfile": {
            "name": "Jordan Lee",
            "tenure": "6 years with the business; 4 years as General Manager",
            "transition": "Proposed 12-month retention agreement plus transaction bonus; seller transfers strategic responsibilities over six months",
            "certifications": "Pet first aid/CPR; internal safety and service leadership training",
            "responsibilities": "Daily facility operations, staff scheduling, labor management, customer escalation, vendor coordination, service quality, capacity and KPI ownership"
          },
          "realEstate": "The business operates from a leased Phoenix facility. Seller and landlord are working toward consent to the transaction, expanded site control, a corrected outdoor-area premises exhibit, clear HVAC responsibility, estoppel, and release of the seller guaranty. These items are being managed as defined pre-close diligence actions and will be available to qualified buyers.",
          "technology": "Core systems support booking and customer records, payments, payroll, accounting, phones, cameras, marketing, and vendor operations. The data room will include a vendor register, admin ownership, renewal dates, assignment requirements, tested exports, integration notes, and a Day-1 credential runbook.",
          "competitors": [
            {
              "name": "Desert Tails Pet Resort",
              "rating": "4.6 / 312",
              "capacity": "Medium/large",
              "distance": "3.8 miles",
              "services": "Boarding, daycare, grooming",
              "commentary": "Larger facility and structured tiers; lower review score."
            },
            {
              "name": "Camelback Canine Club",
              "rating": "4.7 / 188",
              "capacity": "Medium",
              "distance": "5.1 miles",
              "services": "Boarding, daycare, training",
              "commentary": "Strong training offer and membership packaging."
            },
            {
              "name": "Paws & Play Phoenix",
              "rating": "4.5 / 256",
              "capacity": "Medium",
              "distance": "6.4 miles",
              "services": "Daycare, boarding, grooming",
              "commentary": "Aggressive promotional pricing and digital advertising."
            },
            {
              "name": "Sonoran Veterinary Boarding",
              "rating": "4.4 / 403",
              "capacity": "Small/medium",
              "distance": "4.9 miles",
              "services": "Veterinary boarding, medical care",
              "commentary": "Medical credibility; narrower enrichment and grooming."
            },
            {
              "name": "Biltmore Bark Hotel",
              "rating": "4.8 / 147",
              "capacity": "Medium",
              "distance": "7.2 miles",
              "services": "Luxury boarding, suites, grooming",
              "commentary": "Higher premium rates and suite presentation."
            },
            {
              "name": "Happy Trails Daycamp",
              "rating": "4.6 / 201",
              "capacity": "Large daycare",
              "distance": "8.0 miles",
              "services": "Daycare, limited boarding",
              "commentary": "Membership-led daycare competitor; limited grooming."
            },
            {
              "name": "North Valley Pet Lodge",
              "rating": "4.5 / 368",
              "capacity": "Large",
              "distance": "9.5 miles",
              "services": "Boarding, daycare, grooming",
              "commentary": "Scale and broad inventory; less personalized positioning."
            }
          ],
          "contactName": "Craig Pollack",
          "businessName": "The Cactus Pet Resort",
          "contactEmail": "craig@cantarapet.com",
          "contactTitle": "Chief Executive Officer · Cantara Pet Business Advisors",
          "leaseDetails": [
            {
              "label": "Lease Status",
              "value": "Current; landlord consent required for transfer"
            },
            {
              "label": "Site Control",
              "value": "Extension/options under negotiation to provide at least ten years including options"
            },
            {
              "label": "Rent/CAM",
              "value": "Current; reconciliations and estoppel available in data room"
            },
            {
              "label": "Outdoor Areas",
              "value": "Premises exhibit and zoning confirmation being refreshed"
            },
            {
              "label": "HVAC/Repairs",
              "value": "Responsibility matrix being clarified in amendment"
            },
            {
              "label": "Personal Guaranty",
              "value": "Seller release requested at closing"
            }
          ],
          "orgChartHtml": "<div><strong>Elena Marquez — Owner / Transition Executive</strong><br/>Strategic pricing, banking, advisor and landlord relationships during transition<br/><br/><strong>Jordan Lee — General Manager</strong><br/>Facility operations, labor, scheduling, guest resolution, KPI ownership<br/>├── <strong>Assistant General Manager</strong> — Front desk, daycare and service recovery<br/>├── <strong>Grooming Lead</strong> — Grooming capacity, quality and attachment<br/>├── <strong>Animal Care Supervisors</strong> — Boarding/daycare safety and staffing<br/>├── <strong>Front Desk Lead</strong> — Lead funnel, bookings and customer communications<br/>└── <strong>Bookkeeper / CPA Support</strong> — Close, payroll, GL and KPI reconciliation</div>",
          "processSteps": [
            {
              "step": "Step 1",
              "title": "Execute NDA & Receive CIM",
              "description": "Qualified buyers receive the CIM, process letter, and initial diligence index."
            },
            {
              "step": "Step 2",
              "title": "Data Room & Management Review",
              "description": "Review financial, legal, lease, commercial and operating evidence; meet GM and advisors."
            },
            {
              "step": "Step 3",
              "title": "Site Visit & Submit LOI",
              "description": "Complete confidential facility tour and submit structure, value, funding and timeline."
            },
            {
              "step": "Step 4",
              "title": "Exclusivity & Confirmatory Diligence",
              "description": "Negotiate definitive documents, obtain third-party consents and complete bring-down work."
            },
            {
              "step": "Step 5",
              "title": "Close & Transition",
              "description": "Fund purchase, release liens, transfer operations and execute the management/seller transition plan."
            }
          ],
          "serviceLines": "Boarding · Daycare · Grooming · Enrichment & Add-Ons",
          "clientProfile": "The customer base is composed primarily of Phoenix-area pet owners within the core drive-time trade area. Demand is diversified across boarding, daycare, grooming, and add-on users, with no expected material single-customer concentration. The 4.9-star rating and 214-review volume indicate strong satisfaction and word-of-mouth. A trailing-12-month anonymized cohort schedule will show repeat rate, top-customer concentration, ZIP, referral source, and service-line migration.",
          "dealReference": "CPR-2026-01",
          "permitsZoning": "The reviewed package includes a kennel permit, business license, certificate of occupancy, and zoning evidence. The seller is updating the kennel permit to show Cactus Pet Resort LLC d/b/a The Cactus Pet Resort and is obtaining written confirmation of outdoor play-yard use. Renewal dates, inspection records, and transfer requirements are tracked in the closing checklist.",
          "facilityImages": [],
          "incomeFootnote": "Illustrative management accounts. TTM reported EBITDA of $392,000 is normalized by $58,000 of reviewed owner-specific and nonrecurring adjustments. Projections are management planning cases and are not included in valuation unless supported by closed results.",
          "sellerOverview": "Founder and sole member Elena Marquez is pursuing a planned transition after building the business into an established Phoenix pet-care provider. Elena has developed an experienced management team and is prepared to provide a structured six-month transition focused on banking, pricing governance, marketing relationships, vendor introductions, and key customer/referral continuity.",
          "facilityDetails": [
            {
              "label": "Location",
              "value": "Phoenix, Arizona — established commuter-access trade area"
            },
            {
              "label": "Property",
              "value": "Leased single-site pet resort"
            },
            {
              "label": "Services",
              "value": "Boarding, daycare, grooming, bathing, enrichment and add-ons"
            },
            {
              "label": "Facility Review",
              "value": "78 / 100 — good condition with defined minor improvements"
            },
            {
              "label": "Average Occupancy",
              "value": "66% illustrative average"
            },
            {
              "label": "Peak Occupancy",
              "value": "91% illustrative peak"
            },
            {
              "label": "Team",
              "value": "24 workers led by GM and AGM"
            },
            {
              "label": "Customer Reputation",
              "value": "4.9 Google rating from 214 reviews"
            }
          ],
          "facilityProfile": "Leased Phoenix pet-resort facility with dedicated boarding inventory, daycare/play areas, grooming/bathing stations, laundry, customer reception, staff support space, and outdoor exercise areas. A facility review scored the site 78/100 and identified defined minor HVAC, outdoor-surface, finish, and documentation items rather than material redevelopment. Safe-capacity and daily-occupancy reporting are being formalized for buyer diligence.",
          "incomeStatement": [
            {
              "fy1": "$1,380,000",
              "fy2": "$1,520,000",
              "fy3": "$1,610,000",
              "ttm": "$1,700,000",
              "label": "Revenue",
              "proj1": "$1,790,000",
              "proj2": "$1,890,000",
              "fy1Pct": "100.0%",
              "fy2Pct": "100.0%",
              "fy3Pct": "100.0%",
              "ttmPct": "100.0%",
              "proj1Pct": "100.0%",
              "proj2Pct": "100.0%"
            },
            {
              "fy1": "($516,000)",
              "fy2": "($557,000)",
              "fy3": "($584,000)",
              "ttm": "($604,000)",
              "label": "Direct Labor & Service Costs",
              "proj1": "($626,000)",
              "proj2": "($657,000)",
              "fy1Pct": "37.4%",
              "fy2Pct": "36.6%",
              "fy3Pct": "36.3%",
              "ttmPct": "35.5%",
              "proj1Pct": "35.0%",
              "proj2Pct": "34.8%"
            },
            {
              "fy1": "($276,000)",
              "fy2": "($294,000)",
              "fy3": "($304,000)",
              "ttm": "($315,000)",
              "label": "Occupancy / Facility Costs",
              "proj1": "($327,000)",
              "proj2": "($342,000)",
              "fy1Pct": "20.0%",
              "fy2Pct": "19.3%",
              "fy3Pct": "18.9%",
              "ttmPct": "18.5%",
              "proj1Pct": "18.3%",
              "proj2Pct": "18.1%"
            },
            {
              "fy1": "($330,000)",
              "fy2": "($343,000)",
              "fy3": "($349,000)",
              "ttm": "($389,000)",
              "label": "Other Operating Expenses",
              "proj1": "($397,000)",
              "proj2": "($411,000)",
              "fy1Pct": "23.9%",
              "fy2Pct": "22.6%",
              "fy3Pct": "21.7%",
              "ttmPct": "22.9%",
              "proj1Pct": "22.2%",
              "proj2Pct": "21.7%"
            },
            {
              "fy1": "$258,000",
              "fy2": "$326,000",
              "fy3": "$373,000",
              "ttm": "$392,000",
              "label": "Reported EBITDA",
              "proj1": "$440,000",
              "proj2": "$480,000",
              "fy1Pct": "18.7%",
              "fy2Pct": "21.4%",
              "fy3Pct": "23.2%",
              "ttmPct": "23.1%",
              "proj1Pct": "24.6%",
              "proj2Pct": "25.4%"
            },
            {
              "fy1": "$301,000",
              "fy2": "$374,000",
              "fy3": "$425,000",
              "ttm": "$450,000",
              "label": "Normalized EBITDA",
              "proj1": "$475,000",
              "proj2": "$510,000",
              "fy1Pct": "21.8%",
              "fy2Pct": "24.6%",
              "fy3Pct": "26.4%",
              "ttmPct": "26.5%",
              "proj1Pct": "26.5%",
              "proj2Pct": "27.0%"
            }
          ],
          "monthlyTrending": "<table><thead><tr><th>Period</th><th>Revenue</th><th>Reported EBITDA</th><th>Normalized EBITDA</th><th>Commentary</th></tr></thead><tbody><tr><td>Q1</td><td>$376,000</td><td>$75,000</td><td>$89,000</td><td>Seasonal base; weekday capacity available</td></tr><tr><td>Q2</td><td>$418,000</td><td>$94,000</td><td>$107,000</td><td>Summer boarding ramp</td></tr><tr><td>Q3</td><td>$467,000</td><td>$118,000</td><td>$132,000</td><td>Peak vacation and holiday demand</td></tr><tr><td>Q4</td><td>$439,000</td><td>$105,000</td><td>$122,000</td><td>Holiday mix and grooming strength</td></tr><tr><td>TTM</td><td>$1,700,000</td><td>$392,000</td><td>$450,000</td><td>26.5% normalized margin</td></tr></tbody></table>",
          "staffOperations": "The business employs 24 workers across management, front desk, animal care, daycare, grooming, and administration. Frontline compensation is generally aligned with Phoenix market ranges. Daily operations are GM-led, while the seller currently retains certain strategic pricing, banking, marketing, and high-level vendor responsibilities. The transition program moves those functions into documented SOPs and named backup coverage.",
          "technologyStack": [
            "Booking/customer management: reservations, vaccination records, service history, capacity and communications.",
            "Payments/merchant services: deposits, card-present and online payments, refunds and reconciliation.",
            "Accounting/payroll: monthly GL, payroll, labor reporting and financial close.",
            "Phones/email/SMS: inquiry capture, confirmation, reminders and service recovery.",
            "Digital/analytics: website, Google Business Profile, analytics, advertising and review workflow.",
            "Operations/security: cameras, access controls, vendor/maintenance records and incident documentation."
          ],
          "competitiveIntro": [
            "The relevant market includes independent pet resorts, veterinary-affiliated boarding providers, and multi-location operators in the Phoenix trade area.",
            "The Cactus Pet Resort differentiates through review quality, staff familiarity, integrated services, and convenient local positioning.",
            "Competitor pricing indicates measured room for rate, tier, membership, and peak-yield optimization."
          ],
          "dataRoomContents": [
            {
              "items": "Articles, operating agreement, EIN, ownership, good standing, trade name, transaction consent, searches",
              "category": "Corporate & Legal"
            },
            {
              "items": "Monthly P&L, TTM bridge, normalization, bank/GL support, payroll, tax returns, TPT and clearance",
              "category": "Financial & Tax"
            },
            {
              "items": "Lease/amendments, rent/CAM, consent/estoppel, site plan, permits, zoning, inspections, capex",
              "category": "Lease, Facility & Permits"
            },
            {
              "items": "Anonymized census, compensation, PTO, handbook, benefits, retention, org chart, RACI, SOPs",
              "category": "Employees & Management"
            },
            {
              "items": "Contract register, notices/consents, vendor spend, admin ownership, exports, Day-1 runbook",
              "category": "Contracts, Vendors & Technology"
            },
            {
              "items": "Service-line revenue, occupancy, pricing, cohorts, conversion, digital analytics, reviews, competitors",
              "category": "Commercial & Customers"
            },
            {
              "items": "Policy schedule, endorsements, five-year loss runs, claim summaries and broker transition memo",
              "category": "Insurance & Claims"
            }
          ],
          "investmentThesis": [
            "$1.70 million of trailing revenue and $450,000 of normalized EBITDA, representing an attractive 26.5% margin.",
            "Market-leading customer trust, evidenced by a 4.9 Google rating from 214 reviews and strong repeat/referral demand.",
            "Integrated boarding, daycare, grooming, and add-on model increases visit frequency, share of wallet, and customer retention.",
            "Established 24-person team led by an experienced GM and AGM provides credible continuity beyond the owner.",
            "Approximately $190,000 of identified gross annual revenue opportunity across pricing, peak yield, memberships, grooming, add-ons, and conversion.",
            "Attractive Phoenix trade area with affluent pet-owning households, convenient access, veterinary/referral density, and diversified local demand."
          ],
          "staffingOverview": [
            "24-person team across management, front desk, animal care, daycare, grooming, and administration.",
            "GM and AGM provide stable daily leadership and credible post-owner continuity.",
            "Frontline compensation is generally aligned with Phoenix market ranges.",
            "Cross-training plan adds backup for grooming scheduling and monthly close.",
            "Retention, delegated authority, PTO treatment, and transition communications are included in the pre-close plan."
          ],
          "transactionTerms": [
            {
              "label": "Transaction Type",
              "value": "Contemplated asset sale; final structure subject to LOI and tax/legal review"
            },
            {
              "label": "Seller",
              "value": "Cactus Pet Resort LLC"
            },
            {
              "label": "Enterprise Valuation Guidance",
              "value": "$2.25M–$3.15M; $2.70M midpoint based on 5.0x–7.0x normalized EBITDA"
            },
            {
              "label": "Real Estate",
              "value": "Leased; assignment/consent, estoppel and site-control extension in process"
            },
            {
              "label": "Management",
              "value": "GM retention and seller transition package available"
            },
            {
              "label": "Working Capital",
              "value": "Normal operating level to be agreed in definitive documents"
            },
            {
              "label": "Known Debt/Lien",
              "value": "Equipment lender payoff and UCC-3 termination at closing"
            },
            {
              "label": "Process",
              "value": "NDA, CIM/data room, management meeting, site visit, LOI, confirmatory diligence and closing"
            }
          ],
          "marketingOverview": [
            "4.9 Google rating across 214 reviews provides strong organic trust and conversion support.",
            "Word of mouth, repeat customers, local search, veterinary/referral relationships, and website inquiries form the demand base.",
            "Service pages and core Google Business Profile information clearly communicate boarding, daycare, and grooming.",
            "Brand positioning emphasizes experienced staff, integrated care, convenience, and personalized service."
          ],
          "pricingComparison": "<table><thead><tr><th>Service</th><th>Cactus Current</th><th>Peer Range</th><th>Opportunity</th></tr></thead><tbody><tr><td>Standard Boarding</td><td>$58</td><td>$60–$72</td><td>Test +6% cohort</td></tr><tr><td>Premium/Suite Boarding</td><td>Limited tiering</td><td>$78–$105</td><td>Create clear tier architecture</td></tr><tr><td>Daycare Full Day</td><td>$34</td><td>$35–$42</td><td>Rate and membership test</td></tr><tr><td>Holiday Premium</td><td>Inconsistent</td><td>10%–25%</td><td>Publish calendar and rules</td></tr><tr><td>Departure Grooming</td><td>18% attachment</td><td>20%–30%</td><td>Target 25%</td></tr><tr><td>Enrichment Add-On</td><td>22% attachment</td><td>25%–35%</td><td>Target 30%</td></tr></tbody></table>",
          "investmentOverview": "The Cactus Pet Resort is a premium, single-site pet-care platform serving the Phoenix market through integrated boarding, daycare, grooming, and enrichment services. The business generated $1.70 million of trailing revenue and $450,000 of normalized EBITDA (26.5% margin), supported by a 4.9-star Google rating across 214 reviews, an experienced GM-led team, and a diversified local customer base. A buyer acquires a durable earnings platform with multiple measured growth levers and a defined path to resolve ordinary pre-close legal and lease items.",
          "normalizationItems": [
            {
              "item": "Owner compensation above market replacement cost",
              "ttmAmount": "$28,000",
              "commentary": "Difference between recorded owner compensation and a supported replacement/transition structure."
            },
            {
              "item": "Owner-specific personal and discretionary expenses",
              "ttmAmount": "$12,000",
              "commentary": "Documented expenses not expected to continue under buyer ownership."
            },
            {
              "item": "Nonrecurring transaction/legal preparation",
              "ttmAmount": "$8,000",
              "commentary": "One-time readiness and legal work unrelated to ordinary operations."
            },
            {
              "item": "Nonrecurring facility remediation",
              "ttmAmount": "$10,000",
              "commentary": "Completed isolated maintenance not expected to recur at the same level."
            },
            {
              "item": "Total Normalization",
              "ttmAmount": "$58,000",
              "commentary": "Reconciles $392,000 reported EBITDA to $450,000 normalized EBITDA."
            }
          ],
          "normalizationNotes": [
            "Adjustments are limited to identifiable owner-specific and nonrecurring items and are supported in the diligence schedule.",
            "No pricing, occupancy, membership, conversion, or other future operating upside is included in normalized EBITDA.",
            "The normalization schedule should be refreshed monthly and reconciled to GL, payroll, bank, and source invoices."
          ],
          "valueCreationIntro": "Six practical initiatives can expand revenue and strengthen buyer-grade reporting without changing the premium local brand:",
          "valueCreationItems": [
            {
              "timing": "0–90 days",
              "initiative": "Boarding Rate Alignment",
              "description": "Test a phased 6% increase for defined cohorts while monitoring churn, complaints, cancellations, and realized ADR.",
              "dependencies": "Booking cohort data; pricing governance; service guardrails",
              "revenueImpact": "~$62,000 gross annualized"
            },
            {
              "timing": "0–60 days",
              "initiative": "Peak & Holiday Yield",
              "description": "Publish peak calendar, deposits, minimum stays, and cancellation rules; recover waitlist demand.",
              "dependencies": "Daily capacity and denial data",
              "revenueImpact": "~$38,000 gross annualized"
            },
            {
              "timing": "30–90 days",
              "initiative": "Weekday Daycare Membership",
              "description": "Launch a capped Tuesday–Thursday recurring plan that fills off-peak capacity without exceeding safe utilization.",
              "dependencies": "Capacity controls; contribution analysis",
              "revenueImpact": "~$34,000 gross annualized"
            },
            {
              "timing": "30–90 days",
              "initiative": "Departure-Day Grooming",
              "description": "Embed grooming/bathing offers into booking confirmation and pre-departure communication.",
              "dependencies": "Grooming labor capacity and pickup SLA",
              "revenueImpact": "~$29,000 gross annualized"
            },
            {
              "timing": "0–90 days",
              "initiative": "Enrichment & Add-On Attachment",
              "description": "Simplify packages, staff scripts, and digital presentation to raise attachment from 22% toward 30%.",
              "dependencies": "Menu, training, contribution tracking",
              "revenueImpact": "~$17,000 gross annualized"
            },
            {
              "timing": "0–60 days",
              "initiative": "Lead Conversion System",
              "description": "Implement source capture, <15-minute response SLA, tour follow-up, and lost-reason reporting.",
              "dependencies": "Phone/web/CRM funnel and owner accountability",
              "revenueImpact": "$10,000+ gross annualized"
            }
          ],
          "businessDescription": "Founded in 2018, The Cactus Pet Resort provides premium pet boarding, structured daycare, grooming, bathing, nail care, enrichment, and related retail/add-on services. The business is positioned between discount kennels and higher-cost multi-location luxury operators, offering personalized service, experienced staff, and integrated care from one convenient Phoenix facility. Revenue is diversified across recurring local customers, vacation boarding, weekday daycare, grooming appointments, and ancillary services.",
          "financialHighlights": [
            "$1.70 million trailing revenue across boarding, daycare, grooming, and add-on services.",
            "$450,000 normalized EBITDA, equal to a 26.5% normalized margin.",
            "$58,000 normalization bridge from $392,000 reported EBITDA; no speculative growth included.",
            "Illustrative valuation range of $2.25 million to $3.15 million at 5.0x to 7.0x normalized EBITDA.",
            "Approximately $190,000 of identified gross revenue opportunity subject to 90-day commercial testing."
          ],
          "ownershipManagement": "Cactus Pet Resort LLC is an active Arizona limited liability company owned 100% by Elena Marquez. GM Jordan Lee leads day-to-day facility operations, scheduling, labor management, guest resolution, and service delivery, supported by an AGM and department leads. A retention agreement, delegated-authority matrix, cross-training plan, and six-month seller-transition schedule form the management continuity package.",
          "transactionOverview": "Cantara Pet Business Advisors is managing a confidential sale process for the operating assets of Cactus Pet Resort LLC. Qualified buyers will receive the full diligence data room, management access, lease and legal materials, and the Workstream 1 and Workstream 2 agent reports after execution of an NDA. The seller seeks a buyer with operating credibility, funding certainty, employee/customer stewardship, and the ability to complete confirmatory diligence on an efficient timeline.",
          "serviceLineBreakdown": [
            {
              "name": "Boarding",
              "pctOfTotal": "45%",
              "ttmRevenue": "$765,000"
            },
            {
              "name": "Daycare",
              "pctOfTotal": "23%",
              "ttmRevenue": "$391,000"
            },
            {
              "name": "Grooming & Bathing",
              "pctOfTotal": "20%",
              "ttmRevenue": "$340,000"
            },
            {
              "name": "Enrichment, Add-Ons & Retail",
              "pctOfTotal": "12%",
              "ttmRevenue": "$204,000"
            }
          ],
          "normalizationFootnote": "Full normalization support includes monthly GL detail, invoices, payroll records, bank support, owner expense schedules, and CPA review. Buyer should independently validate tax and transaction treatment.",
          "marketingOpportunities": [
            "Connect every inquiry source to booking, revenue, repeat behavior, and lifetime value.",
            "Build high-intent service-area and vertical landing pages with measurable conversion.",
            "Automate post-stay review and referral workflows while preserving personal service.",
            "Use customer cohorts for daycare membership, grooming bundles, lapsed-customer reactivation, and peak waitlist recovery."
          ]
        },
        "createdAt": "2026-07-14T08:26:22.365Z",
        "updatedAt": "2026-07-14T08:26:22.365Z"
      }
    ],
    "ClientDocument": [
      {
        "id": "demo-cactus-doc-contracts",
        "requestId": null,
        "clientId": "demo-cactus-pet-resort",
        "uploadedById": "demo-cactus-owner",
        "fileName": "Cactus_Material_Contracts_Package.pdf",
        "mimeType": "application/pdf",
        "size": 1204200,
        "localPath": "demo/cactus/material-contracts.pdf",
        "googleDriveFileId": null,
        "createdAt": "2026-07-14T07:49:38.352Z",
        "aiBusinessNameMatch": null,
        "aiDetectedType": "material_contracts",
        "aiReviewFlags": [
          "Waste contract auto-renewal notice window closes before expected sale date."
        ],
        "aiReviewStatus": "complete",
        "aiReviewSummary": "Vendor, software, waste, laundry and marketing agreements reviewed for assignment, renewal, termination and minimum-volume exposure.",
        "aiReviewedAt": "2026-07-14T07:49:38.352Z",
        "documentId": "material_contracts",
        "storageBucket": null,
        "storageProvider": "seed"
      },
      {
        "id": "demo-cactus-doc-facility",
        "requestId": null,
        "clientId": "demo-cactus-pet-resort",
        "uploadedById": "demo-cactus-owner",
        "fileName": "Cactus_Facility_Walkthrough_July_2026.pdf",
        "mimeType": "application/pdf",
        "size": 3320400,
        "localPath": "demo/cactus/facility-walkthrough.pdf",
        "googleDriveFileId": null,
        "createdAt": "2026-07-14T07:49:38.591Z",
        "aiBusinessNameMatch": null,
        "aiDetectedType": "facility_review",
        "aiReviewFlags": [
          "HVAC reserve and outdoor shade/drainage plan required."
        ],
        "aiReviewStatus": "complete",
        "aiReviewSummary": "Illustrative facility walk-through and preventive maintenance package.",
        "aiReviewedAt": "2026-07-14T07:49:38.591Z",
        "documentId": "health_safety",
        "storageBucket": null,
        "storageProvider": "seed"
      },
      {
        "id": "demo-cactus-doc-handbook",
        "requestId": null,
        "clientId": "demo-cactus-pet-resort",
        "uploadedById": "demo-cactus-owner",
        "fileName": "Cactus_Employee_Handbook_2026.pdf",
        "mimeType": "application/pdf",
        "size": 710200,
        "localPath": "demo/cactus/employee-handbook.pdf",
        "googleDriveFileId": null,
        "createdAt": "2026-07-14T07:49:38.232Z",
        "aiBusinessNameMatch": null,
        "aiDetectedType": "employee_handbook",
        "aiReviewFlags": [
          "Owner and key employees lack executed non-solicitation protections."
        ],
        "aiReviewStatus": "complete",
        "aiReviewSummary": "Current employee handbook reviewed for PTO, confidentiality, safety and benefit obligations.",
        "aiReviewedAt": "2026-07-14T07:49:38.232Z",
        "documentId": "employee_handbook",
        "storageBucket": null,
        "storageProvider": "seed"
      },
      {
        "id": "demo-cactus-doc-insurance",
        "requestId": null,
        "clientId": "demo-cactus-pet-resort",
        "uploadedById": "demo-cactus-owner",
        "fileName": "Cactus_Insurance_Loss_Run_2024-2026.pdf",
        "mimeType": "application/pdf",
        "size": 482100,
        "localPath": "demo/cactus/insurance-loss-run.pdf",
        "googleDriveFileId": null,
        "createdAt": "2026-07-14T07:49:37.943Z",
        "aiBusinessNameMatch": null,
        "aiDetectedType": "insurance_claim",
        "aiReviewFlags": [
          "Five-year carrier loss runs are still required for final buyer verification."
        ],
        "aiReviewStatus": "complete",
        "aiReviewSummary": "{\"summary\":\"The reviewed package contains a June 2025 guest trip-and-fall liability claim settled for $18,750 within the $1 million occurrence limit, plus a March 2026 employee strain claim with $4,260 paid medical and indemnity. Both matters are closed, no reserve remains, and no pattern of animal escape, bite, property, fire, cyber or business-interruption loss appears in the illustrative three-year history.\",\"claimType\":\"liability\",\"incidentDate\":\"2025-06-18\",\"withinLast12Months\":false,\"incidentCause\":\"Guest slipped near lobby water station; corrective mat and inspection log added\",\"amountClaimed\":\"$24,500\",\"amountRequested\":\"$24,500\",\"status\":\"paid_in_full\",\"keyFacts\":[\"Liability claim settled for $18,750 with no admission of negligence.\",\"Workers compensation strain claim closed after $4,260 paid.\",\"No open reserve or threatened coverage dispute.\",\"Current general liability limit is $1 million per occurrence / $2 million aggregate.\",\"Carrier-issued five-year loss run should be refreshed within 30 days of buyer diligence.\"]}",
        "aiReviewedAt": "2026-07-14T07:49:37.943Z",
        "documentId": "insurance_claims_12m",
        "storageBucket": null,
        "storageProvider": "seed"
      },
      {
        "id": "demo-cactus-doc-sales",
        "requestId": null,
        "clientId": "demo-cactus-pet-resort",
        "uploadedById": "demo-cactus-owner",
        "fileName": "Cactus_Sales_Inquiry_Call_Sample_Q2_2026.pdf",
        "mimeType": "application/pdf",
        "size": 264800,
        "localPath": "demo/cactus/sales-transcript.pdf",
        "googleDriveFileId": null,
        "createdAt": "2026-07-14T07:49:38.066Z",
        "aiBusinessNameMatch": null,
        "aiDetectedType": "sales_process_transcript",
        "aiReviewFlags": [
          "Response SLA and lost-reason tracking below benchmark."
        ],
        "aiReviewStatus": "complete",
        "aiReviewSummary": "{\"summary\":\"The resort benefits from strong inbound demand and reputation, but inquiry handling is inconsistent by channel and conversion is not managed as a measurable funnel. Front-desk staff respond quickly during business hours, yet missed calls, waitlist outcomes, tours, deposits, add-on attachment and lost-booking reasons are not consistently tracked. A buyer can improve revenue quality through standardized discovery, same-day follow-up, automated deposits and weekly conversion reporting.\",\"keyFindings\":[\"Average first response is approximately 18 minutes during business hours but next-day for some after-hours web leads.\",\"Staff quote base price before consistently exploring stay purpose, medication, play preferences and grooming add-ons.\",\"Deposits are collected on approximately 72% of peak reservations; exceptions are not documented.\",\"No common lost-reason taxonomy exists for price, vaccination, capacity, location or service-fit losses.\",\"Tour-to-booking conversion appears strong but is not measured in the booking system.\",\"Review requests are effective after completed stays but no reactivation sequence targets inactive customers.\"],\"benchmarkComparisons\":[{\"metric\":\"Business-hours first response\",\"actual\":\"18 minutes\",\"benchmark\":\"Under 10 minutes\",\"status\":\"below\"},{\"metric\":\"Lead-to-reservation conversion\",\"actual\":\"Estimated 54%\",\"benchmark\":\"60%-70%\",\"status\":\"below\"},{\"metric\":\"Peak reservation deposit rate\",\"actual\":\"72%\",\"benchmark\":\"90%+\",\"status\":\"below\"},{\"metric\":\"Add-on attachment\",\"actual\":\"19%\",\"benchmark\":\"25%-35%\",\"status\":\"below\"},{\"metric\":\"Review request completion\",\"actual\":\"31 new reviews / 90 days\",\"benchmark\":\"Top quartile local\",\"status\":\"above\"},{\"metric\":\"No-show and cancellation capture\",\"actual\":\"Partial\",\"benchmark\":\"100% coded\",\"status\":\"below\"}],\"recommendations\":[\"Adopt a six-question discovery script for every phone and web inquiry.\",\"Set a ten-minute response SLA and route after-hours leads into an automated acknowledgement queue.\",\"Require deposits for all peak and holiday reservations with documented manager exceptions.\",\"Track inquiry source, outcome, lost reason, lead time and add-on attachment weekly.\",\"Create tour follow-up, waitlist and inactive-customer reactivation sequences.\",\"Coach front desk monthly using five recorded calls and a conversion scorecard.\"],\"generatedAt\":\"2026-07-14T13:30:00.000Z\"}",
        "aiReviewedAt": "2026-07-14T07:49:38.066Z",
        "documentId": "sales_process_transcript",
        "storageBucket": null,
        "storageProvider": "seed"
      },
      {
        "id": "demo-cactus-doc-tax",
        "requestId": null,
        "clientId": "demo-cactus-pet-resort",
        "uploadedById": "demo-cactus-owner",
        "fileName": "Cactus_Federal_State_Tax_Package_2023-2025.pdf",
        "mimeType": "application/pdf",
        "size": 1840200,
        "localPath": "demo/cactus/tax-package.pdf",
        "googleDriveFileId": null,
        "createdAt": "2026-07-14T07:49:38.470Z",
        "aiBusinessNameMatch": null,
        "aiDetectedType": "tax_returns",
        "aiReviewFlags": [
          "2025 Arizona TPT reconciliation requires documentation."
        ],
        "aiReviewStatus": "complete",
        "aiReviewSummary": "Three years of federal and Arizona returns reconciled to financial statements.",
        "aiReviewedAt": "2026-07-14T07:49:38.470Z",
        "documentId": "tax_returns_3yr",
        "storageBucket": null,
        "storageProvider": "seed"
      }
    ],
    "ClientDocumentStatus": [
      {
        "id": "status-demo-cactus-doc-contracts",
        "clientId": "demo-cactus-pet-resort",
        "documentId": "material_contracts",
        "hasDoc": true,
        "assignedTo": null,
        "uploadedAt": "2026-07-14T07:49:38.411Z",
        "fileName": "Cactus_Material_Contracts_Package.pdf",
        "notApplicable": false,
        "createdAt": "2026-07-14T07:49:38.411Z",
        "updatedAt": "2026-07-14T07:49:38.411Z",
        "fileUrl": "seed://demo/cactus/material-contracts.pdf",
        "targetDeadline": null,
        "unavailableDecision": null
      },
      {
        "id": "status-demo-cactus-doc-facility",
        "clientId": "demo-cactus-pet-resort",
        "documentId": "health_safety",
        "hasDoc": true,
        "assignedTo": null,
        "uploadedAt": "2026-07-14T07:49:38.692Z",
        "fileName": "Cactus_Facility_Walkthrough_July_2026.pdf",
        "notApplicable": false,
        "createdAt": "2026-07-14T07:49:38.692Z",
        "updatedAt": "2026-07-14T07:49:38.692Z",
        "fileUrl": "seed://demo/cactus/facility-walkthrough.pdf",
        "targetDeadline": null,
        "unavailableDecision": null
      },
      {
        "id": "status-demo-cactus-doc-handbook",
        "clientId": "demo-cactus-pet-resort",
        "documentId": "employee_handbook",
        "hasDoc": true,
        "assignedTo": null,
        "uploadedAt": "2026-07-14T07:49:38.291Z",
        "fileName": "Cactus_Employee_Handbook_2026.pdf",
        "notApplicable": false,
        "createdAt": "2026-07-14T07:49:38.291Z",
        "updatedAt": "2026-07-14T07:49:38.291Z",
        "fileUrl": "seed://demo/cactus/employee-handbook.pdf",
        "targetDeadline": null,
        "unavailableDecision": null
      },
      {
        "id": "status-demo-cactus-doc-insurance",
        "clientId": "demo-cactus-pet-resort",
        "documentId": "insurance_claims_12m",
        "hasDoc": true,
        "assignedTo": null,
        "uploadedAt": "2026-07-14T07:49:38.006Z",
        "fileName": "Cactus_Insurance_Loss_Run_2024-2026.pdf",
        "notApplicable": false,
        "createdAt": "2026-07-14T07:49:38.006Z",
        "updatedAt": "2026-07-14T07:49:38.006Z",
        "fileUrl": "seed://demo/cactus/insurance-loss-run.pdf",
        "targetDeadline": null,
        "unavailableDecision": null
      },
      {
        "id": "status-demo-cactus-doc-sales",
        "clientId": "demo-cactus-pet-resort",
        "documentId": "sales_process_transcript",
        "hasDoc": true,
        "assignedTo": null,
        "uploadedAt": "2026-07-14T07:49:38.172Z",
        "fileName": "Cactus_Sales_Inquiry_Call_Sample_Q2_2026.pdf",
        "notApplicable": false,
        "createdAt": "2026-07-14T07:49:38.172Z",
        "updatedAt": "2026-07-14T07:49:38.172Z",
        "fileUrl": "seed://demo/cactus/sales-transcript.pdf",
        "targetDeadline": null,
        "unavailableDecision": null
      },
      {
        "id": "status-demo-cactus-doc-tax",
        "clientId": "demo-cactus-pet-resort",
        "documentId": "tax_returns_3yr",
        "hasDoc": true,
        "assignedTo": null,
        "uploadedAt": "2026-07-14T07:49:38.530Z",
        "fileName": "Cactus_Federal_State_Tax_Package_2023-2025.pdf",
        "notApplicable": false,
        "createdAt": "2026-07-14T07:49:38.530Z",
        "updatedAt": "2026-07-14T07:49:38.530Z",
        "fileUrl": "seed://demo/cactus/tax-package.pdf",
        "targetDeadline": null,
        "unavailableDecision": null
      }
    ],
    "ClientWorkstreamAgent": [
      {
        "id": "demo-cactus-agent-competitor_analysis",
        "clientId": "demo-cactus-pet-resort",
        "agentId": "competitor_analysis",
        "agentName": "Competitor Analysis Agent",
        "documentIds": [],
        "createdAt": "2026-07-14T07:53:40.651Z",
        "updatedAt": "2026-07-14T07:53:40.651Z"
      },
      {
        "id": "demo-cactus-agent-contract_analysis",
        "clientId": "demo-cactus-pet-resort",
        "agentId": "contract_analysis",
        "agentName": "Material Contracts Agent",
        "documentIds": [],
        "createdAt": "2026-07-14T07:53:38.677Z",
        "updatedAt": "2026-07-14T07:53:38.677Z"
      },
      {
        "id": "demo-cactus-agent-digital_presence",
        "clientId": "demo-cactus-pet-resort",
        "agentId": "digital_presence",
        "agentName": "Digital Presence Agent",
        "documentIds": [],
        "createdAt": "2026-07-14T07:53:41.114Z",
        "updatedAt": "2026-07-14T07:53:41.114Z"
      },
      {
        "id": "demo-cactus-agent-employee_comp",
        "clientId": "demo-cactus-pet-resort",
        "agentId": "employee_comp",
        "agentName": "Employee Staffing & Compensation Agent",
        "documentIds": [],
        "createdAt": "2026-07-14T07:53:38.367Z",
        "updatedAt": "2026-07-14T07:53:38.367Z"
      },
      {
        "id": "demo-cactus-agent-employee_obligations",
        "clientId": "demo-cactus-pet-resort",
        "agentId": "employee_obligations",
        "agentName": "Employee Obligations Agent",
        "documentIds": [
          "employee_list",
          "key_employee_contracts",
          "employee_comp_payroll"
        ],
        "createdAt": "2026-07-14T07:53:38.305Z",
        "updatedAt": "2026-07-14T07:53:38.305Z"
      },
      {
        "id": "demo-cactus-agent-facility_review",
        "clientId": "demo-cactus-pet-resort",
        "agentId": "facility_review",
        "agentName": "Facility Review Agent",
        "documentIds": [
          "health_safety",
          "violations"
        ],
        "createdAt": "2026-07-14T07:53:41.178Z",
        "updatedAt": "2026-07-14T07:53:41.178Z"
      },
      {
        "id": "demo-cactus-agent-insurance_review",
        "clientId": "demo-cactus-pet-resort",
        "agentId": "insurance_review",
        "agentName": "Insurance Review Agent",
        "documentIds": [
          "insurance_policies",
          "insurance_claims_12m"
        ],
        "createdAt": "2026-07-14T07:53:38.491Z",
        "updatedAt": "2026-07-14T07:53:38.491Z"
      },
      {
        "id": "demo-cactus-agent-lease_analysis",
        "clientId": "demo-cactus-pet-resort",
        "agentId": "lease_analysis",
        "agentName": "Lease Analysis Agent",
        "documentIds": [
          "leases"
        ],
        "createdAt": "2026-07-14T07:53:38.557Z",
        "updatedAt": "2026-07-14T07:53:38.557Z"
      },
      {
        "id": "demo-cactus-agent-legal_entity_search",
        "clientId": "demo-cactus-pet-resort",
        "agentId": "legal_entity_search",
        "agentName": "Legal Reports & Entity Search Agent",
        "documentIds": [
          "articles_org",
          "shareholder_agreement",
          "ownership_structure",
          "business_licenses"
        ],
        "createdAt": "2026-07-14T07:53:40.070Z",
        "updatedAt": "2026-07-14T07:53:40.070Z"
      },
      {
        "id": "demo-cactus-agent-litigation_search",
        "clientId": "demo-cactus-pet-resort",
        "agentId": "litigation_search",
        "agentName": "Litigation & Liens Agent",
        "documentIds": [
          "litigation_search_docs",
          "pending_litigation"
        ],
        "createdAt": "2026-07-14T07:53:38.616Z",
        "updatedAt": "2026-07-14T07:53:38.616Z"
      },
      {
        "id": "demo-cactus-agent-org_chart_review",
        "clientId": "demo-cactus-pet-resort",
        "agentId": "org_chart_review",
        "agentName": "Org Chart Review Agent",
        "documentIds": [],
        "createdAt": "2026-07-14T07:53:38.823Z",
        "updatedAt": "2026-07-14T07:53:38.823Z"
      },
      {
        "id": "demo-cactus-agent-owner_gm_assessment",
        "clientId": "demo-cactus-pet-resort",
        "agentId": "owner_gm_assessment",
        "agentName": "Owner & GM Assessment Agent",
        "documentIds": [
          "employee_list",
          "org_chart",
          "sop_manual"
        ],
        "createdAt": "2026-07-14T07:53:38.886Z",
        "updatedAt": "2026-07-14T07:53:38.886Z"
      },
      {
        "id": "demo-cactus-agent-ownership_verification",
        "clientId": "demo-cactus-pet-resort",
        "agentId": "ownership_verification",
        "agentName": "Ownership Verification Agent",
        "documentIds": [
          "articles_org",
          "shareholder_agreement",
          "ownership_structure"
        ],
        "createdAt": "2026-07-14T07:53:39.018Z",
        "updatedAt": "2026-07-14T07:53:39.018Z"
      },
      {
        "id": "demo-cactus-agent-permits_zoning",
        "clientId": "demo-cactus-pet-resort",
        "agentId": "permits_zoning",
        "agentName": "Permits & Zoning Agent",
        "documentIds": [
          "business_licenses",
          "zoning_approval",
          "certificate_occupancy",
          "building_permits"
        ],
        "createdAt": "2026-07-14T07:53:39.087Z",
        "updatedAt": "2026-07-14T07:53:39.087Z"
      },
      {
        "id": "demo-cactus-agent-pricing_analysis",
        "clientId": "demo-cactus-pet-resort",
        "agentId": "pricing_analysis",
        "agentName": "Competitive Pricing Analysis Agent",
        "documentIds": [
          "pricing_schedule",
          "revenue_breakdown"
        ],
        "createdAt": "2026-07-14T07:53:41.637Z",
        "updatedAt": "2026-07-14T07:53:41.637Z"
      },
      {
        "id": "demo-cactus-agent-pricing_vertical",
        "clientId": "demo-cactus-pet-resort",
        "agentId": "pricing_vertical",
        "agentName": "Pricing by Vertical Agent",
        "documentIds": [
          "revenue_breakdown",
          "pricing_schedule"
        ],
        "createdAt": "2026-07-14T07:53:41.700Z",
        "updatedAt": "2026-07-14T07:53:41.700Z"
      },
      {
        "id": "demo-cactus-agent-professional_advisors",
        "clientId": "demo-cactus-pet-resort",
        "agentId": "professional_advisors",
        "agentName": "Professional Advisors Agent",
        "documentIds": [],
        "createdAt": "2026-07-14T07:53:39.170Z",
        "updatedAt": "2026-07-14T07:53:39.170Z"
      },
      {
        "id": "demo-cactus-agent-sales_process_review",
        "clientId": "demo-cactus-pet-resort",
        "agentId": "sales_process_review",
        "agentName": "Sales Process Review Agent",
        "documentIds": [
          "sales_process_transcript",
          "pricing_schedule"
        ],
        "createdAt": "2026-07-14T07:53:42.171Z",
        "updatedAt": "2026-07-14T07:53:42.171Z"
      },
      {
        "id": "demo-cactus-agent-tax_liability_review",
        "clientId": "demo-cactus-pet-resort",
        "agentId": "tax_liability_review",
        "agentName": "Tax Liability Review Agent",
        "documentIds": [
          "tax_returns_3yr",
          "irs_941_940_3yr",
          "contractor_1099_agreements",
          "sales_use_tax_3yr",
          "irs_tax_notices_3yr"
        ],
        "createdAt": "2026-07-14T07:53:40.137Z",
        "updatedAt": "2026-07-14T07:53:40.137Z"
      },
      {
        "id": "demo-cactus-agent-ttm",
        "clientId": "demo-cactus-pet-resort",
        "agentId": "ttm",
        "agentName": "Valuation Agent",
        "documentIds": [
          "monthly_pl_excel",
          "monthly_bs_excel",
          "accountant_statements"
        ],
        "createdAt": "2026-07-14T07:53:38.204Z",
        "updatedAt": "2026-07-14T07:53:38.204Z"
      },
      {
        "id": "demo-cactus-agent-vendor_directory",
        "clientId": "demo-cactus-pet-resort",
        "agentId": "vendor_directory",
        "agentName": "Software & Vendors Agent",
        "documentIds": [],
        "createdAt": "2026-07-14T07:53:39.543Z",
        "updatedAt": "2026-07-14T07:53:39.543Z"
      },
      {
        "id": "demo-cactus-gate-digitalPresence",
        "clientId": "demo-cactus-pet-resort",
        "agentId": "digitalPresence",
        "agentName": "Client Location Map Agent",
        "documentIds": [],
        "createdAt": "2026-07-14T07:55:47.086Z",
        "updatedAt": "2026-07-14T07:55:47.086Z"
      },
      {
        "id": "demo-cactus-gate-employeeComp",
        "clientId": "demo-cactus-pet-resort",
        "agentId": "employeeComp",
        "agentName": "WS1 Assessment Report",
        "documentIds": [],
        "createdAt": "2026-07-14T07:55:47.274Z",
        "updatedAt": "2026-07-14T07:55:47.274Z"
      },
      {
        "id": "demo-cactus-gate-facilityReview",
        "clientId": "demo-cactus-pet-resort",
        "agentId": "facilityReview",
        "agentName": "Occupancy Review Agent",
        "documentIds": [],
        "createdAt": "2026-07-14T07:55:47.152Z",
        "updatedAt": "2026-07-14T07:55:47.152Z"
      },
      {
        "id": "demo-cactus-gate-ownerGmAssessment",
        "clientId": "demo-cactus-pet-resort",
        "agentId": "ownerGmAssessment",
        "agentName": "WS1 Sales Readiness Roadmap",
        "documentIds": [],
        "createdAt": "2026-07-14T07:55:47.338Z",
        "updatedAt": "2026-07-14T07:55:47.338Z"
      },
      {
        "id": "demo-cactus-gate-pricingAnalysis",
        "clientId": "demo-cactus-pet-resort",
        "agentId": "pricingAnalysis",
        "agentName": "WS2 Assessment Report",
        "documentIds": [],
        "createdAt": "2026-07-14T07:55:47.399Z",
        "updatedAt": "2026-07-14T07:55:47.399Z"
      },
      {
        "id": "demo-cactus-gate-pricingVertical",
        "clientId": "demo-cactus-pet-resort",
        "agentId": "pricingVertical",
        "agentName": "WS2 Sales Readiness Roadmap",
        "documentIds": [],
        "createdAt": "2026-07-14T07:55:47.460Z",
        "updatedAt": "2026-07-14T07:55:47.460Z"
      }
    ],
    "CompetitorAnalysis": [
      {
        "id": "demo-cactus-competitor-1",
        "clientId": "demo-cactus-pet-resort",
        "fileName": "Cactus_Competitor_Analysis_Demo.json",
        "report": "# Competitor Analysis — Phoenix Pet Resort Market\n\n## Executive Summary\n\nThe Cactus Pet Resort occupies a strong reputation-led position in a fragmented local market. Its **4.9 rating from 214 reviews** is above the illustrative competitor average of 4.55. The facility is differentiated by low-stress boarding, supervised playgroups, and frequent pet-parent updates. Its principal weakness is that public pricing and packages do not fully monetize this reputation.\n\n| Competitor | Distance | Rating | Positioning | Primary Gap vs. Cactus |\n|---|---:|---:|---|---|\n| Sonoran Paws Lodge | 3.2 mi | 4.6 | Premium boarding | Lower review score; stronger suite upsells |\n| Desert Tails Club | 5.1 mi | 4.4 | Daycare memberships | Strong weekday subscription model |\n| Copper State Canine Resort | 7.8 mi | 4.7 | Large-format resort | Higher suite pricing; weaker personalization |\n| Papago Pet Retreat | 9.4 mi | 4.5 | Convenience/value | Lower prices and fewer premium features |\n| Valley Bark & Stay | 11.6 mi | 4.6 | Boarding + grooming | Strong bundled grooming offers |\n\n## Market Position\n\n- **Reputation:** market-leading in the illustrative set.\n- **Service breadth:** competitive across boarding, daycare, and grooming.\n- **Pricing:** 8%–12% below the sample average on core services.\n- **Digital conversion:** strong reviews, but limited package and waitlist calls-to-action.\n- **Geography:** attractive access to north Phoenix households within a 10-mile trade area.\n\n## Recommendations\n\n1. Preserve the review advantage with a formal post-stay review request.\n2. Introduce peak-night and holiday pricing with clear advance disclosure.\n3. Create three boarding tiers and daycare memberships.\n4. Publish capacity-aware online calls-to-action instead of a generic inquiry form.\n5. Track win/loss reasons monthly to distinguish price sensitivity from capacity constraints.",
        "parsed": {
          "competitors": [
            {
              "gaps": [
                "Lower rating than Cactus"
              ],
              "name": "Sonoran Paws Lodge",
              "rating": 4.6,
              "address": "Illustrative competitor 1, Phoenix, AZ",
              "mapsUrl": null,
              "openNow": true,
              "placeId": "demo-comp-1",
              "location": {
                "lat": 33.68,
                "lng": -112.04
              },
              "services": [
                "Dog Boarding",
                "Dog Daycare",
                "Dog Grooming"
              ],
              "strengths": [
                "Structured packages"
              ],
              "priceLevel": 2,
              "websiteUrl": "https://example.com/sonoran-paws",
              "phoneNumber": null,
              "pricePoints": [
                "$62-$72 boarding",
                "$38-$45 daycare"
              ],
              "reviewCount": 188,
              "weekdayText": [],
              "primaryTypes": [
                "pet_boarding_service"
              ],
              "distanceMiles": 3.2,
              "priceEvidence": [],
              "businessStatus": "OPERATIONAL",
              "hoursComparison": "Comparable hours",
              "similarityLevel": "high",
              "similarityScore": 4.6,
              "pricingComparison": "Generally priced above Cactus",
              "serviceComparison": "Similar core services",
              "similaritySummary": "Comparable boarding and daycare operator",
              "websiteConfidence": "high",
              "reputationComparison": "Cactus has the stronger rating"
            },
            {
              "gaps": [
                "Lower rating than Cactus"
              ],
              "name": "Desert Tails Club",
              "rating": 4.4,
              "address": "Illustrative competitor 2, Phoenix, AZ",
              "mapsUrl": null,
              "openNow": true,
              "placeId": "demo-comp-2",
              "location": {
                "lat": 33.69,
                "lng": -112.05000000000001
              },
              "services": [
                "Dog Boarding",
                "Dog Daycare",
                "Dog Grooming"
              ],
              "strengths": [
                "Structured packages"
              ],
              "priceLevel": 2,
              "websiteUrl": "https://example.com/desert-tails",
              "phoneNumber": null,
              "pricePoints": [
                "$62-$72 boarding",
                "$38-$45 daycare"
              ],
              "reviewCount": 143,
              "weekdayText": [],
              "primaryTypes": [
                "pet_boarding_service"
              ],
              "distanceMiles": 5.1,
              "priceEvidence": [],
              "businessStatus": "OPERATIONAL",
              "hoursComparison": "Comparable hours",
              "similarityLevel": "high",
              "similarityScore": 4.4,
              "pricingComparison": "Generally priced above Cactus",
              "serviceComparison": "Similar core services",
              "similaritySummary": "Comparable boarding and daycare operator",
              "websiteConfidence": "high",
              "reputationComparison": "Cactus has the stronger rating"
            },
            {
              "gaps": [
                "Lower rating than Cactus"
              ],
              "name": "Copper State Canine Resort",
              "rating": 4.7,
              "address": "Illustrative competitor 3, Phoenix, AZ",
              "mapsUrl": null,
              "openNow": true,
              "placeId": "demo-comp-3",
              "location": {
                "lat": 33.7,
                "lng": -112.06
              },
              "services": [
                "Dog Boarding",
                "Dog Daycare",
                "Dog Grooming",
                "Cat Boarding"
              ],
              "strengths": [
                "Structured packages"
              ],
              "priceLevel": 2,
              "websiteUrl": "https://example.com/copper-state",
              "phoneNumber": null,
              "pricePoints": [
                "$62-$72 boarding",
                "$38-$45 daycare"
              ],
              "reviewCount": 265,
              "weekdayText": [],
              "primaryTypes": [
                "pet_boarding_service"
              ],
              "distanceMiles": 7.8,
              "priceEvidence": [],
              "businessStatus": "OPERATIONAL",
              "hoursComparison": "Comparable hours",
              "similarityLevel": "high",
              "similarityScore": 4.2,
              "pricingComparison": "Generally priced above Cactus",
              "serviceComparison": "Similar core services",
              "similaritySummary": "Comparable boarding and daycare operator",
              "websiteConfidence": "high",
              "reputationComparison": "Cactus has the stronger rating"
            },
            {
              "gaps": [
                "Lower rating than Cactus"
              ],
              "name": "Papago Pet Retreat",
              "rating": 4.5,
              "address": "Illustrative competitor 4, Phoenix, AZ",
              "mapsUrl": null,
              "openNow": true,
              "placeId": "demo-comp-4",
              "location": {
                "lat": 33.71,
                "lng": -112.07000000000001
              },
              "services": [
                "Dog Boarding",
                "Dog Daycare",
                "Dog Grooming"
              ],
              "strengths": [
                "Structured packages"
              ],
              "priceLevel": 2,
              "websiteUrl": "https://example.com/papago-pet",
              "phoneNumber": null,
              "pricePoints": [
                "$62-$72 boarding",
                "$38-$45 daycare"
              ],
              "reviewCount": 121,
              "weekdayText": [],
              "primaryTypes": [
                "pet_boarding_service"
              ],
              "distanceMiles": 9.4,
              "priceEvidence": [],
              "businessStatus": "OPERATIONAL",
              "hoursComparison": "Comparable hours",
              "similarityLevel": "medium",
              "similarityScore": 3.9,
              "pricingComparison": "Generally priced above Cactus",
              "serviceComparison": "Similar core services",
              "similaritySummary": "Comparable boarding and daycare operator",
              "websiteConfidence": "high",
              "reputationComparison": "Cactus has the stronger rating"
            },
            {
              "gaps": [
                "Lower rating than Cactus"
              ],
              "name": "Valley Bark & Stay",
              "rating": 4.6,
              "address": "Illustrative competitor 5, Phoenix, AZ",
              "mapsUrl": null,
              "openNow": true,
              "placeId": "demo-comp-5",
              "location": {
                "lat": 33.72,
                "lng": -112.08000000000001
              },
              "services": [
                "Dog Boarding",
                "Dog Daycare",
                "Dog Grooming"
              ],
              "strengths": [
                "Structured packages"
              ],
              "priceLevel": 2,
              "websiteUrl": "https://example.com/valley-bark",
              "phoneNumber": null,
              "pricePoints": [
                "$62-$72 boarding",
                "$38-$45 daycare"
              ],
              "reviewCount": 164,
              "weekdayText": [],
              "primaryTypes": [
                "pet_boarding_service"
              ],
              "distanceMiles": 11.6,
              "priceEvidence": [],
              "businessStatus": "OPERATIONAL",
              "hoursComparison": "Comparable hours",
              "similarityLevel": "medium",
              "similarityScore": 3.8,
              "pricingComparison": "Generally priced above Cactus",
              "serviceComparison": "Similar core services",
              "similaritySummary": "Comparable boarding and daycare operator",
              "websiteConfidence": "high",
              "reputationComparison": "Cactus has the stronger rating"
            }
          ],
          "generatedAt": "2026-07-14T12:44:01.954Z",
          "marketStats": {
            "analyzedCompetitors": 5,
            "highSimilarityCount": 3,
            "closestCompetitorName": "Sonoran Paws Lodge",
            "discoveredCompetitors": 9,
            "competitorsWithWebsite": 5,
            "averageCompetitorRating": 4.55,
            "competitorsWithPriceSignals": 5,
            "averageCompetitorReviewCount": 176,
            "closestCompetitorDistanceMiles": 3.2
          },
          "radiusMiles": 12,
          "businessName": "The Cactus Pet Resort",
          "keyTakeaways": [
            "Highest rating in the sample",
            "Core services priced below peers",
            "Opportunity for tiered suites and daycare memberships"
          ],
          "searchCenter": {
            "lat": 33.6835,
            "lng": -112.0442
          },
          "clientProfile": {
            "name": "The Cactus Pet Resort",
            "rating": 4.9,
            "address": "1720 E Deer Valley Dr, Phoenix, AZ 85024",
            "mapsUrl": null,
            "openNow": true,
            "placeId": "demo-cactus",
            "location": {
              "lat": 33.6835,
              "lng": -112.0442
            },
            "services": [
              "Dog Boarding",
              "Dog Daycare",
              "Dog Grooming",
              "Cat Boarding"
            ],
            "priceLevel": 2,
            "websiteUrl": "https://example.com/cactus-pet-resort",
            "phoneNumber": "(602) 555-0148",
            "pricePoints": [
              "$58 standard boarding",
              "$34 daycare",
              "$72 grooming average"
            ],
            "reviewCount": 214,
            "weekdayText": [
              "Mon-Sun 6:30 AM-7:00 PM"
            ],
            "hoursSummary": "Seven days per week",
            "primaryTypes": [
              "pet_boarding_service"
            ],
            "priceEvidence": [],
            "businessStatus": "OPERATIONAL",
            "pricingSummary": "Mid-market pricing despite premium reputation",
            "serviceSummary": "Premium dog boarding, dog daycare, grooming, and limited cat boarding.",
            "reputationSummary": "4.9 rating with 214 reviews",
            "websiteConfidence": "high"
          },
          "marketSummary": "Fragmented five-competitor market with premium and value operators.",
          "businessAddress": "1720 E Deer Valley Dr, Phoenix, AZ 85024",
          "recommendations": [
            "Raise core boarding and daycare rates in phases",
            "Introduce membership and peak pricing",
            "Preserve review velocity"
          ],
          "businessCategory": "Pet boarding, daycare, and grooming",
          "executiveSummary": "Cactus leads the illustrative local set on reputation but trails on pricing architecture and recurring daycare offers.",
          "positioningSummary": "Premium service and reputation with mid-market pricing.",
          "discoveredCompetitors": []
        },
        "createdAt": "2026-07-14T07:14:01.954Z",
        "updatedAt": "2026-07-14T07:29:10.010Z"
      }
    ],
    "ContractAnalysis": [
      {
        "id": "demo-cactus-contracts-rich",
        "clientId": "demo-cactus-pet-resort",
        "fileName": "Cactus_Material_Contracts_Package.pdf",
        "report": "---START_PART1---\n## PART 1 — CONTRACT PACKAGE SNAPSHOT\n\n| # | Contract Type | Counterparty | Effective Date | Expiration Date | Auto-Renewal? | Annual Value | Termination Clause | Termination Terms | Risk Tier | Current Status |\n|---|---|---|---|---|---|---|---|---|---|---|\n| 1 | Booking / POS SaaS | PetExec Inc. | Jan 1, 2025 | Dec 31, 2026 | Yes — 12 months | $14,400 | Yes | 60 days; data export available | 🟡 Medium | Active |\n| 2 | Waste & Sanitation | Desert Environmental Services | Apr 1, 2024 | Mar 31, 2027 | Yes — 36 months | $18,600 | Limited | 120-day non-renewal; early fee 50% remaining | 🔴 High | Active |\n| 3 | Laundry Service | Sonoran Linen Co. | Sep 1, 2025 | Aug 31, 2027 | Yes — 12 months | $16,800 | Yes | 90-day notice; minimum weekly volume | 🟡 Medium | Active |\n| 4 | Camera / Security SaaS | Verkada | Oct 15, 2023 | Oct 14, 2026 | Yes — 36 months | $6,200 | Limited | Assignment consent and hardware schedule unclear | 🟡 Medium | Expiring Soon |\n| 5 | Marketing Services | Copper Bloom Media | Jan 1, 2026 | Month-to-month | No | $24,000 | Yes | 30-day convenience termination | 🟢 Low | Active |\n\n**Key Risk Summary:** The package is generally manageable, but the waste agreement has a long auto-renewal and a material early-termination formula, while the security contract requires assignment and hardware-ownership clarification. No single contract threatens business continuity if managed before buyer outreach.\n\n---END_PART1---\n---START_PART2---\n## PART 2 — PER-CONTRACT RISK CARDS\n\n### CONTRACT 1 RISK CARD: PETEXEC BOOKING AND POS AGREEMENT\n**Risk Tier:** 🟡 Medium  \n**Recommended Action:** Retain, obtain written change-of-control confirmation, and complete a full customer/data export before closing.\n\nCore obligations include payment processing, customer record hosting, vaccination data and reservation operations. The agreement permits termination on 60 days notice but the merchant-processing addendum must be reassigned separately.\n\n#### RISK FLAGS FOR THIS CONTRACT\n🟡 Confirm assignment process and processing reserve release.  \n🟢 Standard data-export right and short termination period.\n\n#### DISPOSITION\nRetain through closing; transition administrator and MFA credentials.\n\n### CONTRACT 2 RISK CARD: DESERT ENVIRONMENTAL SERVICES\n**Risk Tier:** 🔴 High  \n**Recommended Action:** Send non-renewal notice before December 1, 2026 and negotiate buyer assignment without resetting the term.\n\nThe agreement renews for three years unless notice is delivered 120 days before expiration. Early termination equals 50% of remaining monthly charges and could create approximately $27,900 of exposure after renewal.\n\n#### RISK FLAGS FOR THIS CONTRACT\n🔴 Long renewal and early-termination formula.  \n🟡 Fuel and environmental surcharges are uncapped.  \n🟢 Service levels and compliance documentation are clear.\n\n#### DISPOSITION\nRenegotiate or timely terminate before transaction marketing.\n\n### CONTRACT 3 RISK CARD: SONORAN LINEN SERVICE\n**Risk Tier:** 🟡 Medium  \n**Recommended Action:** Confirm assignment, remove minimum-volume floor, and document inventory responsibility.\n\nThe agreement renews annually with 90 days notice and includes a $1,100 monthly minimum. Buyer should confirm replacement-cost exposure for missing linens and ensure seasonal volume reductions do not trigger minimum charges.\n\n#### RISK FLAGS FOR THIS CONTRACT\n🟡 Minimum-volume commitment and inventory replacement exposure.  \n🟢 Service is operationally important but readily replaceable.\n\n#### DISPOSITION\nRetain subject to amendment.\n\n### CONTRACT 4 RISK CARD: VERKADA SECURITY SUBSCRIPTION\n**Risk Tier:** 🟡 Medium  \n**Recommended Action:** Confirm hardware ownership, renewal pricing, cloud retention and assignment consent before October 2026.\n\nThe camera system supports incident response and customer trust. The contract does not clearly separate owned hardware from licensed cloud services, and renewal pricing was not included.\n\n#### RISK FLAGS FOR THIS CONTRACT\n🟡 Change-of-control consent and hardware schedule are incomplete.  \n🟡 Cloud-video retention after account transfer is unclear.  \n🟢 Current system coverage is adequate.\n\n#### DISPOSITION\nRetain only after written transfer confirmation.\n\n### CONTRACT 5 RISK CARD: COPPER BLOOM MEDIA\n**Risk Tier:** 🟢 Low  \n**Recommended Action:** Retain through the three-month pricing test, then evaluate performance.\n\nMonth-to-month services include paid search, social content and review campaigns. There is no exclusivity, assignment restriction or termination fee; creative assets and ad accounts belong to the client.\n\n#### RISK FLAGS FOR THIS CONTRACT\n🟢 Flexible termination and client-owned assets.  \n🟡 Campaign attribution to completed bookings is incomplete.\n\n#### DISPOSITION\nRetain with KPI addendum.\n\n---END_PART2---\n---START_PART3---\n## PART 3 — UNIFIED FLAG ANALYSIS\n\n### 🔴 RED FLAGS — Significant Issues Requiring Immediate Attention\n\n**Issue:** Waste agreement can auto-renew for three years  \n**Why It Matters:** Missing the 120-day notice window could create approximately $27,900 of avoidable termination exposure and restrict buyer vendor choice.  \n**Suggested Action:** Calendar and deliver non-renewal notice; negotiate assignment or month-to-month bridge.  \n**Contract & Source:** Desert Environmental Services, Sections 2 and 9.\n\n### 🟡 ORANGE FLAGS — Items Requiring Clarification or Negotiation\n\n**Issue:** Security system assignment and hardware ownership are unclear  \n**Why It Matters:** Buyer needs uninterrupted camera access and proof of ownership for installed devices.  \n**Suggested Action:** Obtain written consent, hardware schedule, renewal quote and administrator-transfer procedure.  \n**Contract & Source:** Verkada order form and cloud terms.\n\n**Issue:** Linen agreement contains minimum volume and replacement exposure  \n**Why It Matters:** Seasonal occupancy could produce charges above actual use.  \n**Suggested Action:** Replace fixed minimum with rolling-volume pricing and agree an opening inventory count.  \n**Contract & Source:** Sonoran Linen Sections 3 and 6.\n\n**Issue:** PetExec merchant processing requires a separate transition  \n**Why It Matters:** Booking operations may continue while deposits or stored payment workflows are interrupted.  \n**Suggested Action:** Open buyer merchant account and schedule cutover before closing.  \n**Contract & Source:** PetExec payment addendum.\n\n**Issue:** Marketing performance is not tied to completed reservations  \n**Why It Matters:** Buyer cannot validate return on $24,000 annual spend.  \n**Suggested Action:** Add source-to-booking attribution and monthly cost-per-acquired-customer reporting.  \n**Contract & Source:** Copper Bloom Media scope.\n\n### 🟢 GREEN FLAGS — Buyer-Favorable Provisions\n\n**Issue:** Core software provides customer and reservation data export  \n**Why It Matters:** Buyer can preserve customer history and reduce platform lock-in.  \n**Suggested Action:** Complete and test a full export before diligence.  \n**Contract & Source:** PetExec data portability clause.\n\n**Issue:** Marketing agreement is month-to-month with client-owned assets  \n**Why It Matters:** Buyer can retain or replace the provider without penalty while preserving accounts and creative.  \n**Suggested Action:** Confirm all admin rights and creative files are in the data room.  \n**Contract & Source:** Copper Bloom Media Sections 4 and 7.\n\n**Issue:** No contract contains exclusivity preventing normal operations  \n**Why It Matters:** Buyer retains sourcing and vendor flexibility.  \n**Suggested Action:** Preserve current rights in any amendments.  \n**Contract & Source:** Package-wide review.\n\n---END_PART3---\n---START_PART4---\n## PART 4 — CONTRACT INVENTORY\n\n| Contract | Counterparty | Type | Effective Date | Status |\n|---|---|---|---|---|\n| PetExec Subscription and Processing Addendum | PetExec Inc. | Booking/POS SaaS | Jan 1, 2025 | Complete — addendum included |\n| Waste and Sanitation Services Agreement | Desert Environmental Services | Facility Services | Apr 1, 2024 | Complete |\n| Linen and Laundry Agreement | Sonoran Linen Co. | Operating Vendor | Sep 1, 2025 | Complete — inventory schedule missing |\n| Camera Subscription Order Form | Verkada | Security SaaS | Oct 15, 2023 | Partial — hardware schedule missing |\n| Digital Marketing Services Agreement | Copper Bloom Media | Marketing | Jan 1, 2026 | Complete |\n\n**Package completeness:** Five material agreements reviewed. Missing schedules and written consents are tracked in the transaction checklist.\n\n---END_PART4---\n---START_PART5---\n## PART 5 — TRANSACTION CHECKLIST\n\n| Number | Action Item | Priority | Notes |\n|---|---|---|---|\n| 1 | Deliver waste-contract non-renewal notice | Critical | Complete before December 1, 2026 |\n| 2 | Obtain Verkada assignment and hardware confirmation | High | Include cloud retention and renewal quote |\n| 3 | Establish buyer PetExec merchant account | High | Test deposits and refunds before closing |\n| 4 | Amend linen minimum and confirm inventory | Medium | Tie minimum to trailing usage |\n| 5 | Export all PetExec customer and reservation data | High | Validate restore and vaccination records |\n| 6 | Transfer vendor administrator and MFA credentials | High | Use credential-transition checklist |\n| 7 | Add marketing attribution KPI schedule | Medium | Source, CAC, conversion and revenue |\n| 8 | Refresh contract inventory at exclusivity | Medium | Capture any new commitments over $10,000 |\n\n---END_PART5---",
        "parsed": null,
        "createdAt": "2026-07-14T07:51:31.221Z",
        "updatedAt": "2026-07-14T07:51:31.221Z"
      }
    ],
    "EmployeeObligationsReport": [
      {
        "id": "demo-cactus-employee-obligations-rich",
        "clientId": "demo-cactus-pet-resort",
        "markdown": "# EMPLOYEE OBLIGATIONS REPORT\n**Client:** The Cactus Pet Resort  \n**State:** Arizona  \n**Engagement Type:** WS1 Business Sale Readiness  \n**Analysis Date:** July 14, 2026  \n**Analyst:** Cantara Pet Advisors — Illustrative Demo\n\n## SECTION 1 — DOCUMENT INVENTORY\n\n| Document Name | Document Type | Employees or Parties Covered | Date | Completeness Flag |\n|---|---|---|---|---|\n| Cactus Employee Handbook 2026.pdf | Employee Handbook | All employees | January 2026 | Complete |\n| Payroll and Compensation Register.xlsx | Payroll / Compensation | 24 workers | June 2026 | Complete |\n| GM Offer and Retention Draft.pdf | Offer / Retention | Jordan Lee | June 2026 | Draft — unsigned |\n| PTO Accrual Report.xlsx | PTO Liability | 21 W-2 employees | June 30, 2026 | Complete |\n| Contractor Agreements.pdf | Independent Contractors | 3 contractors | 2025-2026 | Partial |\n| Benefits Renewal Summary.pdf | Benefits | Eligible full-time employees | 2026 plan year | Complete |\n| Workers Compensation Loss Run.pdf | Claims | All employees | 2024-2026 | Complete |\n\n**Documents not provided:** signed seller non-compete, signed GM retention agreement, individual confidentiality agreements for all managers, and current I-9 audit certification.\n\n## SECTION 2 — EMPLOYMENT AGREEMENT COVERAGE TABLE\n\n| Role / Title | Agreement Type | Fixed-Term or At-Will | Non-Compete Attached Y/N | Non-Solicitation Attached Y/N | NDA/Confidentiality Attached Y/N | Source Document |\n|---|---|---|---|---|---|---|\n| Owner / Managing Member — Elena Marquez | No employment agreement | Owner | N | N | Y | Operating agreement / handbook |\n| General Manager — Jordan Lee | Offer letter; retention draft | At-will | N | Y — draft only | Y | GM Offer and Retention Draft |\n| Assistant GM — Priya Shah | Offer letter | At-will | N | N | Y | Personnel file summary |\n| Grooming Lead — Sofia Nguyen | Offer letter | At-will | N | N | Y | Personnel file summary |\n| Frontline W-2 staff (17) | Handbook acknowledgement | At-will | N | N | Y | Handbook acknowledgements |\n| Grooming contractors (3) | Independent contractor agreement | Annual | N | N | Y | Contractor package |\n\nCoverage is operationally adequate for ordinary employment but insufficient for transaction continuity. The GM retention terms and seller restrictive covenants remain unsigned.\n\n## SECTION 3 — NON-COMPETE & NON-SOLICITATION ANALYSIS\n\n**Seller protection:** No executed seller non-compete or customer/employee non-solicitation was identified. Transaction counsel should include enforceable Arizona-law covenants in the purchase agreement, tailored to the north-Phoenix service area and the consideration paid.\n\n**General Manager:** The draft retention agreement includes a 12-month employee/customer non-solicitation and confidentiality obligations but has not been signed. It does not contain an employee non-compete.\n\n**Other employees and contractors:** Confidentiality language exists, but there is no consistent non-solicitation provision. The grooming contractor form allows work for other facilities and does not clearly prohibit diversion of customer lists.\n\n**Enforceability note:** Arizona restrictive covenants must be reasonable in duration, geography and protected activity. Buyer employment counsel should review final language rather than relying on handbook acknowledgements.\n\n## SECTION 4 — BENEFIT PLAN OBLIGATIONS TABLE\n\n| Benefit Type | Employer Contribution | Contractually Bound Y/N | Transferable on Asset Sale | Estimated Annual Cost | Transition Complexity | Source Reference |\n|---|---|---|---|---|---|---|\n| Medical / dental | 65% employee-only premium | N — annual election | New buyer plan required | $96,400 | Medium | 2026 renewal summary |\n| Paid time off | 40-120 hours based on tenure | Y — policy | Liability treatment negotiated | $34,680 accrued | High | PTO accrual ledger |\n| Holiday premium | 1.5x for seven holidays | Y — policy | Yes if policy assumed | $18,200 | Low | Handbook section 5 |\n| SIMPLE IRA | 3% employer match | Y for eligible participants | Successor decision and notice required | $28,600 | Medium | Plan summary |\n| Employee pet-care discount | 50% boarding/daycare subject to capacity | N | Operational policy | $16,900 foregone retail value | Low | Handbook |\n| Continuing education | Up to $750 per year for groomers/managers | N | Optional | $8,500 budget | Low | Handbook |\n\nAccrued PTO of approximately **$34,680** is the principal quantified employee liability. Purchase documents should state whether it is paid by seller at closing, assumed with a working-capital adjustment, or converted under buyer policy.\n\n## SECTION 5 — INDEPENDENT CONTRACTOR ANALYSIS\n\nThree grooming workers are treated as independent contractors. They set portions of their schedules and provide some tools, but use the resort facility, booking platform, customer list and pricing. The lead contractor produces approximately $118,000 of annual grooming revenue.\n\nThis classification presents a moderate Arizona and federal misclassification risk because the business controls customer allocation, pricing and service standards. Before sale launch, counsel should document the business rationale, review economic dependence and behavioral control, and determine whether conversion to W-2 status is appropriate. Estimated employer-tax and benefit exposure for a two-year lookback is **$22,000-$38,000**, excluding penalties.\n\n## SECTION 6 — KEY PERSON RISK TABLE\n\n| Role | Employment Type | Non-Compete | Emp. Agreement | Risk Level | Transition Notes |\n|---|---|---|---|---|---|\n| Elena Marquez — Owner | Owner-operator | N | N | High | Controls pricing, finance, marketing, banking, landlord and key vendors |\n| Jordan Lee — GM | At-will | N | Draft retention only | High | Daily operating leader; retention agreement and authority matrix required |\n| Sofia Nguyen — Grooming Lead | At-will | N | Offer letter | Medium | Produces 58% of grooming revenue; cross-training required |\n| Nina Patel — Bookkeeper | Contractor | N | Service agreement | Medium | Monthly close knowledge and payroll reconciliation |\n| Priya Shah — Assistant GM | At-will | N | Offer letter | Low | Credible second-in-command after cross-training |\n\nThe organization is operationally stable but transaction continuity depends on retaining Jordan Lee and transferring owner-controlled responsibilities. Recommended retention economics are a $12,000 transaction bonus plus six-month post-close milestone payments.\n\n## SECTION 7 — BUYER-FACING OBLIGATIONS SUMMARY\n\n**Workforce Overview:** Twenty-four workers support the resort: twenty-one W-2 employees and three grooming contractors. Management tenure is strong, frontline turnover is approximately 31%, and labor cost equals roughly 34% of revenue.\n\n**Non-Compete Protections:** No executed seller covenant exists and employee non-solicitation protection is inconsistent. Restrictive covenants must be completed through transaction documents and targeted retention agreements.\n\n**Assumed Benefit Obligations:** Medical, PTO, holiday premium, SIMPLE IRA matching and employee discounts create an estimated annual employer cost of approximately $199,000, excluding base wages and payroll taxes.\n\n**Retirement Plan & PTO Obligations:** SIMPLE IRA administration appears current. Accrued PTO of $34,680 must be addressed in working capital or closing payroll.\n\n**Independent Contractor Risk:** Three grooming contractors require classification review; estimated potential exposure is $22,000-$38,000.\n\n**Transition Considerations:** Sign GM retention, transfer owner authority, cross-train grooming and finance coverage, communicate benefit continuity, and prepare employee announcement scripts before buyer meetings.\n\n**Items Requiring Buyer's Employment Counsel Review:**\n- Seller non-compete and employee/customer non-solicitation language\n- GM retention and transaction bonus agreement\n- PTO liability treatment and final payroll mechanics\n- Grooming contractor classification and conversion options\n- SIMPLE IRA successor obligations and required notices\n- I-9, wage-hour, meal/rest and overtime compliance sampling\n- COBRA or state continuation responsibility\n- Employee communication and offer process under an asset sale\n\n## SECTION 8 — FLAGS SUMMARY\n\n| Domain | Severity | Flag Description | Source Reference |\n|---|---|---|---|\n| Key Person | Deal Risk | GM retention agreement remains unsigned while daily operations depend on Jordan Lee | GM retention draft |\n| Seller Covenant | Deal Risk | No executed seller non-compete or customer/employee non-solicitation | Document gap |\n| Contractor Classification | Deal Risk | Three grooming contractors may be economically dependent on the resort | Contractor package |\n| PTO | Negotiation Point | $34,680 accrued PTO liability requires explicit closing treatment | PTO accrual ledger |\n| Benefits | Negotiation Point | Buyer must coordinate medical coverage and SIMPLE IRA transition | Benefits renewal / plan summary |\n| Workforce | Negotiation Point | Frontline turnover of approximately 31% exceeds desired pre-sale stability | Payroll register |\n| Grooming Revenue | Negotiation Point | 58% of grooming revenue is tied to one lead technician | Revenue and payroll analysis |\n| Compliance | Informational | Workers compensation loss history shows one closed minor strain claim | Carrier loss run |\n| Positive | Informational | Experienced GM and AGM provide credible management continuity | Personnel summaries |\n",
        "documentNames": [
          "Cactus Employee Handbook 2026.pdf",
          "Payroll and Compensation Register.xlsx",
          "GM Offer and Retention Draft.pdf",
          "PTO Accrual Report.xlsx",
          "Contractor Agreements.pdf",
          "Benefits Renewal Summary.pdf",
          "Workers Compensation Loss Run.pdf"
        ],
        "metadata": {
          "flags": [
            {
              "id": "flag-0",
              "status": "confirmed"
            },
            {
              "id": "flag-1",
              "status": "confirmed"
            },
            {
              "id": "flag-2",
              "status": "confirmed"
            },
            {
              "id": "flag-3",
              "status": "confirmed"
            },
            {
              "id": "flag-4",
              "status": "confirmed"
            },
            {
              "id": "flag-5",
              "status": "confirmed"
            },
            {
              "id": "flag-6",
              "status": "confirmed"
            },
            {
              "id": "flag-7",
              "status": "confirmed"
            },
            {
              "id": "flag-8",
              "status": "confirmed"
            }
          ],
          "downstream": {
            "ma7TransitionPlan": {
              "keyPeople": [
                "Elena Marquez",
                "Jordan Lee",
                "Sofia Nguyen"
              ],
              "retentionBonus": 12000
            },
            "ws1MasterRiskReport": [
              {
                "title": "Unsigned GM retention",
                "severity": "deal-risk"
              },
              {
                "title": "No seller non-compete",
                "severity": "deal-risk"
              },
              {
                "title": "Contractor classification exposure",
                "severity": "deal-risk"
              }
            ],
            "ws25LaborExpenseAnalysis": {
              "accruedPto": 34680,
              "laborPercentRevenue": 34,
              "estimatedContractorExposure": "$22,000-$38,000"
            }
          },
          "releasedAt": null,
          "sourceType": "illustrative-demo",
          "reviewSummary": "Nine findings reviewed: three deal risks, four negotiation points and two informational items."
        },
        "createdAt": "2026-07-14T07:50:32.229Z",
        "updatedAt": "2026-07-14T07:50:32.229Z"
      }
    ],
    "LeaseAnalysis": [
      {
        "id": "demo-cactus-lease-1",
        "clientId": "demo-cactus-pet-resort",
        "fileName": "Cactus_Lease_Demo.pdf",
        "report": "# Lease Analysis — The Cactus Pet Resort\n\n## Executive Summary\n\nThe business operates from a leased Phoenix facility. The location is operationally suitable, but the lease is a **RED pre-sale work item** because the initial term expires on **December 31, 2028**, the assignment clause requires landlord consent, and the change-of-control language is broad enough to capture an equity sale.\n\n| Term | Finding |\n|---|---|\n| Premises | Approximately 12,400 square feet plus fenced outdoor play area |\n| Current base rent | $18,600 per month, NNN |\n| Annual escalation | 3.0% each January |\n| Initial term expiration | December 31, 2028 |\n| Renewal option | One additional five-year term |\n| Renewal notice deadline | June 30, 2028 |\n| Assignment | Prior written landlord consent required; not to be unreasonably withheld |\n| Change of control | Treated as an assignment |\n| Personal guaranty | Owner guaranty remains until landlord-approved replacement |\n\n## Red Flag — Transfer and Term\n\nA buyer may require at least ten years of site control when renewal options are included. The current remaining term does not provide that certainty. Obtain a written landlord term sheet before launching the sale that: (1) consents to a qualified buyer assignment or change of control, (2) adds a five-year extension or a second renewal option, and (3) releases the seller's personal guaranty at closing.\n\n## Other Observations\n\n- Maintenance responsibilities for HVAC and outdoor drainage should be clarified.\n- The permitted-use clause covers boarding, daycare, and grooming.\n- No material rent arrears were identified in the illustrative rent ledger.\n- Buyer counsel should confirm that the outdoor play area is included in the legally described premises.\n\n## Readiness\n\n**🔴 RED — Not ready for buyer reliance until landlord consent and extended site control are documented.**",
        "parsed": {
          "raw": "# Lease Analysis — The Cactus Pet Resort\n\n## Executive Summary\n\nThe business operates from a leased Phoenix facility. The location is operationally suitable, but the lease is a **RED pre-sale work item** because the initial term expires on **December 31, 2028**, the assignment clause requires landlord consent, and the change-of-control language is broad enough to capture an equity sale.\n\n| Term | Finding |\n|---|---|\n| Premises | Approximately 12,400 square feet plus fenced outdoor play area |\n| Current base rent | $18,600 per month, NNN |\n| Annual escalation | 3.0% each January |\n| Initial term expiration | December 31, 2028 |\n| Renewal option | One additional five-year term |\n| Renewal notice deadline | June 30, 2028 |\n| Assignment | Prior written landlord consent required; not to be unreasonably withheld |\n| Change of control | Treated as an assignment |\n| Personal guaranty | Owner guaranty remains until landlord-approved replacement |\n\n## Red Flag — Transfer and Term\n\nA buyer may require at least ten years of site control when renewal options are included. The current remaining term does not provide that certainty. Obtain a written landlord term sheet before launching the sale that: (1) consents to a qualified buyer assignment or change of control, (2) adds a five-year extension or a second renewal option, and (3) releases the seller's personal guaranty at closing.\n\n## Other Observations\n\n- Maintenance responsibilities for HVAC and outdoor drainage should be clarified.\n- The permitted-use clause covers boarding, daycare, and grooming.\n- No material rent arrears were identified in the illustrative rent ledger.\n- Buyer counsel should confirm that the outdoor play area is included in the legally described premises.\n\n## Readiness\n\n**🔴 RED — Not ready for buyer reliance until landlord consent and extended site control are documented.**",
          "redFlags": [
            {
              "issue": "Transfer consent and limited remaining site control",
              "reviewStatus": "relevant",
              "whyItMatters": "A buyer or lender may require written consent and at least ten years of site control including options.",
              "sourceSection": "Assignment / Term"
            },
            {
              "issue": "Outdoor play area is not clearly included in the premises exhibit",
              "reviewStatus": "relevant",
              "whyItMatters": "Daycare and boarding capacity depends on continued legal use of the fenced east yard.",
              "sourceSection": "Premises Exhibit"
            }
          ],
          "greenFlags": [
            {
              "issue": "Permitted use expressly covers core service verticals",
              "reviewStatus": "relevant",
              "whyItMatters": "Boarding, daycare, grooming and incidental retail are authorized.",
              "sourceSection": "Permitted Use"
            },
            {
              "issue": "Renewal option uses a defined notice date",
              "reviewStatus": "relevant",
              "whyItMatters": "The seller can preserve the option by calendaring timely notice.",
              "sourceSection": "Renewal Option"
            },
            {
              "issue": "Casualty provision includes rent abatement",
              "reviewStatus": "relevant",
              "whyItMatters": "Material impairment receives contractual rent relief.",
              "sourceSection": "Casualty"
            }
          ],
          "generatedAt": "2026-07-14T13:30:00.000Z",
          "orangeFlags": [
            {
              "issue": "Seller personal guaranty survives assignment unless released",
              "reviewStatus": "relevant",
              "whyItMatters": "Seller needs an express release in the landlord consent.",
              "sourceSection": "Guaranty"
            },
            {
              "issue": "HVAC replacement responsibility is ambiguous",
              "reviewStatus": "questionable",
              "whyItMatters": "Two rooftop units may require $35,000-$55,000 in future capital.",
              "sourceSection": "Repairs and Maintenance"
            },
            {
              "issue": "No exclusive-use protection",
              "reviewStatus": "relevant",
              "whyItMatters": "Landlord could lease nearby space to a competing pet-care operator.",
              "sourceSection": "Use / Exclusivity"
            },
            {
              "issue": "CAM includes management fee and variable pass-throughs",
              "reviewStatus": "relevant",
              "whyItMatters": "Buyer should underwrite controllable and noncontrollable occupancy costs separately.",
              "sourceSection": "Additional Rent"
            },
            {
              "issue": "Security deposit transfer mechanics not stated",
              "reviewStatus": "relevant",
              "whyItMatters": "Closing statement must address deposit credit and landlord acknowledgment.",
              "sourceSection": "Security Deposit"
            }
          ],
          "rentSchedule": [
            {
              "months": "Jan–Dec",
              "perAnnum": "$223,200",
              "perMonth": "$18,600",
              "leaseYear": "2026"
            },
            {
              "months": "Jan–Dec",
              "perAnnum": "$229,896",
              "perMonth": "$19,158",
              "leaseYear": "2027"
            },
            {
              "months": "Jan–Dec",
              "perAnnum": "$236,793",
              "perMonth": "$19,733",
              "leaseYear": "2028"
            }
          ],
          "snapshotTable": [
            {
              "field": "Premises",
              "finding": "Approximately 12,400 sq. ft. plus fenced outdoor play area",
              "sourceSection": "Premises"
            },
            {
              "field": "Current Base Rent",
              "finding": "$18,600 per month, NNN",
              "sourceSection": "Rent"
            },
            {
              "field": "Expiration",
              "finding": "December 31, 2028",
              "sourceSection": "Term"
            },
            {
              "field": "Renewal Option",
              "finding": "One additional five-year term; notice due June 30, 2028",
              "sourceSection": "Options"
            },
            {
              "field": "Assignment",
              "finding": "Prior written landlord consent required; change of control treated as assignment",
              "sourceSection": "Assignment"
            },
            {
              "field": "Personal Guaranty",
              "finding": "Owner guaranty remains until landlord-approved replacement",
              "sourceSection": "Guaranty"
            }
          ],
          "detailedFindings": [
            {
              "id": "2.1",
              "title": "Term, Expiration and Renewal",
              "content": "Initial term expires December 31, 2028. One five-year option requires notice by June 30, 2028. Current site control is below the ten-year period many acquisition lenders prefer."
            },
            {
              "id": "2.2",
              "title": "Assignment and Change of Control",
              "content": "Prior written landlord consent is required and direct or indirect change of control is treated as an assignment. Landlord may review buyer financial capacity but no objective approval timeline is stated."
            },
            {
              "id": "2.3",
              "title": "Seller Guaranty",
              "content": "Elena Marquez provides an uncapped personal guaranty. The lease does not automatically release the guarantor after assignment, so release must be included in the consent instrument."
            },
            {
              "id": "2.4",
              "title": "Premises and Outdoor Play Area",
              "content": "Approximately 12,400 square feet is described, but the fenced east-yard play area is not clearly included in the legal exhibit. Outdoor use is essential to daycare and boarding economics."
            },
            {
              "id": "2.5",
              "title": "Permitted Use and Exclusivity",
              "content": "Permitted use includes pet boarding, daycare, grooming and incidental retail. No exclusive-use protection prevents another pet-care tenant in the center."
            },
            {
              "id": "2.6",
              "title": "Base Rent and Escalation",
              "content": "Current base rent is $18,600 per month plus NNN charges, increasing 3% each January. Occupancy cost is approximately 15.8% of revenue before utilities."
            },
            {
              "id": "2.7",
              "title": "Operating Expenses and Reconciliation",
              "content": "Tenant pays common-area, insurance and property-tax allocations. The latest reconciliation supports charges, but the lease permits management-fee inclusion up to 5% of CAM."
            },
            {
              "id": "2.8",
              "title": "Maintenance and Capital Responsibility",
              "content": "Tenant maintains interior systems and routine HVAC. Responsibility for rooftop replacement and east-yard drainage is ambiguous; this overlaps with the Facility Review capital outlook."
            },
            {
              "id": "2.9",
              "title": "Casualty, Condemnation and Business Interruption",
              "content": "Rent abatement begins only after five business days of material impairment. Termination rights apply if restoration exceeds 180 days; buyer should align business-interruption coverage."
            },
            {
              "id": "2.10",
              "title": "Default, Cure and Security Deposit",
              "content": "Monetary default has a five-day cure; nonmonetary default has 20 days if diligently pursued. Security deposit equals two months base rent and transfer mechanics are not specified."
            }
          ],
          "documentInventory": [
            {
              "date": "2026-07-14",
              "status": "Reviewed",
              "document": "Cactus_Lease_Demo.pdf",
              "documentType": "Base Lease and Illustrative Abstract"
            }
          ],
          "transactionChecklist": [
            {
              "notes": "Include approval criteria, timing and buyer financial package.",
              "number": 1,
              "priority": "RED — 0-30 days",
              "actionItem": "Obtain landlord consent term sheet covering change of control"
            },
            {
              "notes": "Amend term or add renewal options before buyer launch.",
              "number": 2,
              "priority": "RED — 0-45 days",
              "actionItem": "Extend site control to at least ten years including options"
            },
            {
              "notes": "Attach surveyed or landlord-approved exhibit.",
              "number": 3,
              "priority": "RED — 0-45 days",
              "actionItem": "Add fenced outdoor yard to premises exhibit"
            },
            {
              "notes": "Include in consent and estoppel package.",
              "number": 4,
              "priority": "HIGH — Closing",
              "actionItem": "Secure written release of seller guaranty"
            },
            {
              "notes": "Coordinate with Facility Review and landlord.",
              "number": 5,
              "priority": "HIGH — 0-45 days",
              "actionItem": "Clarify rooftop HVAC and drainage responsibility"
            },
            {
              "notes": "Confirm no default, deposit and rent schedule.",
              "number": 6,
              "priority": "HIGH — Diligence",
              "actionItem": "Obtain tenant estoppel and landlord lien waiver"
            },
            {
              "notes": "Prepare buyer underwriting schedule.",
              "number": 7,
              "priority": "MEDIUM — 0-30 days",
              "actionItem": "Reconcile 2025-2026 CAM and tax pass-throughs"
            },
            {
              "notes": "Assign to GM and transaction counsel.",
              "number": 8,
              "priority": "MEDIUM — Immediate",
              "actionItem": "Calendar renewal notice for June 30, 2028"
            },
            {
              "notes": "Confirm 180-day restoration and BI period.",
              "number": 9,
              "priority": "MEDIUM — Diligence",
              "actionItem": "Align casualty terms with insurance coverage"
            }
          ]
        },
        "createdAt": "2026-07-14T07:14:01.954Z",
        "updatedAt": "2026-07-14T07:53:18.372Z"
      }
    ],
    "LegalEntitySearchReport": [
      {
        "id": "demo-cactus-legal-1",
        "clientId": "demo-cactus-pet-resort",
        "markdown": "# Legal Reports & Entity Search — The Cactus Pet Resort\n\n**Report purpose:** Illustrative buyer-grade legal diligence package for a sale-readiness demonstration.  \n**Business:** The Cactus Pet Resort, Phoenix, Arizona  \n**Operating entity:** Cactus Pet Resort LLC  \n**Review date:** July 14, 2026  \n**Overall legal readiness:** **YELLOW — marketable after four defined closing-preparation actions**\n\nThis report synthesizes fictional corporate records, Arizona entity-search results, a UCC search, registered-agent confirmation, good-standing evidence, and trademark/common-law name review. It is sample data and is not a legal opinion.\n\n## SECTION 1 — DOCUMENT INVENTORY\n\n| Document Name | Document Type | Entities Covered | Date | Completeness Flag |\n|---|---|---|---|---|\n| Articles_of_Organization_Cactus_Pet_Resort_LLC.pdf | Articles of Organization | Cactus Pet Resort LLC | March 12, 2018 | complete |\n| Operating_Agreement_Amended_2022.pdf | Operating Agreement | Cactus Pet Resort LLC; Elena Marquez | September 1, 2022 | complete |\n| ACC_Entity_Detail_2026-07-08.pdf | Arizona Corporation Commission entity search | Cactus Pet Resort LLC | July 8, 2026 | complete |\n| Certificate_of_Good_Standing_2026-07-08.pdf | Certificate of Good Standing | Cactus Pet Resort LLC | July 8, 2026 | complete |\n| UCC_Search_Arizona_2026-07-09.pdf | Certified UCC search | Cactus Pet Resort LLC; Elena Marquez | July 9, 2026 | complete |\n| Registered_Agent_Confirmation.pdf | Registered Agent Confirmation | Cactus Pet Resort LLC | June 30, 2026 | complete |\n| Trade_Name_Cactus_Pet_Resort.pdf | Arizona Trade Name Registration | The Cactus Pet Resort | October 15, 2023 | complete |\n| Member_Consent_Draft_Sale.pdf | Draft Member Consent | Cactus Pet Resort LLC; Elena Marquez | July 10, 2026 | incomplete - draft is unsigned |\n| IRS_EIN_Letter.pdf | Federal Tax Identification | Cactus Pet Resort LLC | March 20, 2018 | complete |\n\n**Additional documents requested before buyer diligence:** an executed member consent approving the transaction; a bring-down good-standing certificate dated within 30 days of closing; lender payoff letter; filed UCC-3 termination or escrow filing instruction; final asset schedule; landlord consent/estoppel; and counsel-prepared closing resolutions.\n\n**Coverage assessment:** The package is sufficient to establish the entity, ownership, Arizona standing, trade-name use, and the one known secured filing. It is not yet a closing binder because transaction authority is still in draft form and the secured lender release package has not been obtained.\n\n## SECTION 2 — ENTITY STANDING VERIFICATION\n\n**Entity Name:** Cactus Pet Resort LLC\n**Entity Type:** Arizona Limited Liability Company\n**State of Formation:** Arizona\n**Filing Number:** L-2264187-4\n**Status:** Active\n**Last Annual Report:** Arizona LLCs do not file annual reports; entity detail refreshed July 8, 2026\n**Registered Agent:** Sonoran Statutory Agent Services LLC, 2390 E. Camelback Road, Suite 130, Phoenix, AZ 85016\n**Notes:** Formed March 12, 2018. Statutory-agent appointment is current. No administrative dissolution, delinquency, or foreign qualification was identified. Arizona is the only known operating jurisdiction. “The Cactus Pet Resort” is a registered Arizona trade name; contracts should identify the legal party as Cactus Pet Resort LLC d/b/a The Cactus Pet Resort.\n**Source Document:** Articles_of_Organization_Cactus_Pet_Resort_LLC.pdf; ACC_Entity_Detail_2026-07-08.pdf; Registered_Agent_Confirmation.pdf\n\n### Standing conclusion\n\nThe entity appears active and in good standing in its formation and operating state. No subsidiary, parent, real-estate holding company, or affiliate was identified. The leased premises and operating assets are held or used directly by the operating LLC, so the contemplated transaction can be structured as an asset sale by one seller entity.\n\n### Legal-name consistency review\n\n| Record | Name Used | Result | Required Treatment |\n|---|---|---|---|\n| Formation and EIN records | Cactus Pet Resort LLC | Consistent | Use as seller legal name |\n| Operating agreement | Cactus Pet Resort LLC | Consistent | No correction |\n| Facility lease | Cactus Pet Resort, LLC | Substantively consistent | Preserve exact legal name in consent |\n| Kennel permit | The Cactus Pet Resort | DBA only | Amend to show LLC d/b/a trade name |\n| Payment processor | Cactus Pet Resort LLC | Consistent | Obtain assignment/novation consent |\n| Vendor contracts | Mixed LLC and DBA references | Curable | Contract schedule should state legal seller |\n\nThe DBA usage is not evidence of a second entity. It is nevertheless a diligence issue because the kennel permit and two vendor agreements omit the LLC name. Correcting these references before launch will eliminate avoidable buyer questions about asset ownership and permit continuity.\n\n### Governance and transaction authority\n\nThe amended operating agreement identifies Elena Marquez as the sole member with 100% of the membership interests and full voting authority. A sale of substantially all assets requires written approval of the sole member. A draft consent has been prepared but is unsigned. No minority interest, option, profit interest, convertible security, voting agreement, or buy-sell restriction was identified in the reviewed package.\n\n**Required closing authority:** executed sole-member consent, manager/officer incumbency certificate, secretary or authorized-person certification of governing documents, and authorization for payoff and UCC termination.\n\n## SECTION 3 — UCC FILINGS ANALYSIS\n\n**Filing Number:** 2022-1774931\n**Filing Date:** August 19, 2022\n**Expiration Date:** August 19, 2027, unless continued or terminated earlier\n**Debtor Name:** Cactus Pet Resort LLC\n**Secured Party:** Desert Veterinary Equipment Finance, Inc.\n**Collateral Description:** “All equipment financed by Secured Party, including commercial kennel banks, laundry equipment, HVAC components, grooming tables, bathing systems, replacements, substitutions, additions, accessions, proceeds, insurance proceeds and records relating thereto.”\n**Status:** Active\n**Amount:** $186,000 estimated payoff balance as of June 30, 2026\n**Source Document:** UCC_Search_Arizona_2026-07-09.pdf; illustrative lender statement\n\n### UCC exposure conclusion\n\nThe certified Arizona search identified one active equipment filing and no blanket “all assets” lien. The filing is narrower than a working-capital lien, but the collateral includes equipment essential to boarding, grooming, laundry, and climate control. It therefore affects the buyer’s ability to receive clear title to material operating assets.\n\nThe $186,000 amount is an illustrative estimated payoff, not a filed amount. Seller counsel should obtain a lender payoff letter valid through the anticipated closing date, a per-diem amount, wiring verification, and an irrevocable commitment to file a UCC-3 termination when funds are received. The asset purchase agreement should permit payment directly from closing proceeds and require a post-closing filing confirmation.\n\nSearches were run against both the exact LLC name and Elena Marquez individually. No other active Arizona UCC financing statement was identified. Searches should be refreshed no earlier than five business days before closing, including county fixtures and judgment-lien indexes.\n\n## SECTION 4 — REGISTERED AGENT STATUS\n\n**Entity Name:** Cactus Pet Resort LLC\n**Registered Agent:** Sonoran Statutory Agent Services LLC\n**Agent Address:** 2390 E. Camelback Road, Suite 130, Phoenix, AZ 85016\n**Appointment Date:** April 4, 2021\n**Status:** Current\n**Notes:** Commercial statutory-agent service; address matches the Arizona Corporation Commission record. No resignation, rejection, or service-of-process issue was identified. The appointment should remain in place through closing and any wind-down period.\n**Source Document:** Registered_Agent_Confirmation.pdf; ACC_Entity_Detail_2026-07-08.pdf\n\n### Registered-agent continuity\n\nThe commercial-agent arrangement is buyer-supportive because it does not depend on the owner’s residence or the leased facility. In an asset sale, the seller LLC should retain an agent during wind-down. If the buyer forms a new acquisition entity, the buyer must appoint its own Arizona statutory agent before formation or qualification.\n\n## SECTION 5 — CERTIFICATES OF GOOD STANDING\n\n**Entity Name:** Cactus Pet Resort LLC\n**State:** Arizona\n**Certificate Date:** July 8, 2026\n**Expiration Date:** No stated expiration; obtain a bring-down certificate within 30 days of closing\n**Status:** Valid\n**Notes:** Certificate confirms active existence and no known administrative dissolution. Arizona is the only identified state of formation or operation. Tax clearance is a separate diligence item and is not established by this certificate.\n**Source Document:** Certificate_of_Good_Standing_2026-07-08.pdf\n\n### Good-standing conclusion\n\nThe current certificate is suitable for marketing preparation. It should be refreshed for closing together with an Arizona entity-detail printout, statutory-agent confirmation, and tax-clearance evidence. If diligence identifies operations, employees, or property outside Arizona, counsel should separately determine whether foreign qualification was required.\n\n## SECTION 6 — TRADEMARK SEARCH RESULTS\n\n**Mark Name:** THE CACTUS PET RESORT\n**Registration Number:** Arizona Trade Name 943128\n**Filing Date:** October 15, 2023\n**Registration Date:** October 15, 2023\n**Expiration Date:** October 15, 2028\n**Status:** Registered\n**Class of Goods/Services:** Arizona trade name for pet boarding, daycare, grooming, and related retail services\n**Owner:** Cactus Pet Resort LLC\n**Notes:** State trade-name ownership matches the seller. Registration supports local name use but does not provide the national presumptions of a federal registration.\n**Source Document:** Trade_Name_Cactus_Pet_Resort.pdf\n\n**Mark Name:** CACTUS PAWS & SUNBURST LOGO\n**Registration Number:** No federal or state registration identified\n**Filing Date:** Not applicable\n**Registration Date:** Not applicable\n**Expiration Date:** Not applicable\n**Status:** Unknown\n**Class of Goods/Services:** Common-law use for pet boarding, daycare, grooming, and customer communications\n**Owner:** Used by Cactus Pet Resort LLC; formal chain of title not documented\n**Notes:** Logo appears on the website, signage, social accounts, uniforms, and customer forms. Obtain original design files and a work-made-for-hire or assignment confirmation from the designer.\n**Source Document:** Illustrative website and brand-asset review\n\n### Trademark and brand conclusion\n\nNo conflicting exact-name mark was identified in the illustrative screening, but a clearance opinion was not performed. The core word mark has state-level protection only. Before expanding or franchising, conduct a USPTO TESS/Trademark Search search, common-law web search, Arizona trade-name search, and domain/social-handle review. Buyer diligence should receive a brand-asset inventory, domain registrar evidence, social credentials, design-source files, and written confirmation that the seller owns or may transfer all creative assets.\n\n## SECTION 7 — BUYER-FACING LEGAL STANDING SUMMARY\n\n**Entity Standing Overview:** Cactus Pet Resort LLC is a single Arizona limited liability company formed in 2018 and shown as active in the July 8, 2026 Arizona Corporation Commission record. The entity directly operates the Phoenix pet resort under the registered trade name “The Cactus Pet Resort.” No parent, subsidiary, minority owner, inactive affiliate, or foreign registration was identified. The package supports a straightforward single-seller asset transaction, subject to ordinary bring-down searches and closing certificates.\n\nThe legal name is consistent across formation, tax, ownership, and most commercial records. The principal name issue is operational: the kennel permit and two vendor documents use only the DBA. This is curable before marketing by amending the permit and recording the seller in the contract schedule as Cactus Pet Resort LLC d/b/a The Cactus Pet Resort.\n\n**UCC Exposure Summary:** One active equipment UCC filing secures an estimated $186,000 payoff balance. It is not a blanket lien, but it covers operationally critical kennel, grooming, laundry, and HVAC equipment. Clear-title treatment should be a closing condition. The seller should deliver a payoff letter, per-diem, escrow instruction, and UCC-3 termination commitment; searches should be refreshed at signing and immediately before closing.\n\n**Registered Agent Compliance:** The entity maintains a current commercial statutory agent at a Phoenix business address. No gap in appointment or service-of-process concern was identified. The seller should retain the agent through post-closing wind-down, while the buyer separately appoints an agent for its acquisition entity.\n\n**Good Standing Status:** A valid July 8, 2026 Arizona certificate supports current sale preparation. A fresh certificate, entity-detail record, and tax clearance should be ordered for closing. Good standing does not resolve transaction authority, permit naming, lien payoff, or tax clearance, each of which requires separate evidence.\n\n**Trademark Protection:** The business’s word mark is registered as an Arizona trade name through October 2028 and is owned by the seller. The logo is used in commerce but lacks documented federal or state registration and the designer assignment is not in the data room. The deal should transfer the trade name, domain, social handles, logo, creative files, telephone numbers, and associated goodwill through an express intellectual-property schedule.\n\n**Transition Considerations:** Legal preparation is manageable within 30–45 days. Execute the sole-member sale consent; reconcile legal names on the kennel permit and contract schedule; secure landlord and material-contract consents; obtain lender release mechanics; refresh standing and lien searches; and assemble an IP/credential transfer package. None of the identified items independently suggests the business is unsalable, but the lease consent, UCC release, and permit correction should be treated as gating evidence before buyer outreach.\n\n**Items Requiring Buyer's Legal Counsel Review:**\n- Confirm asset-sale structure and that Cactus Pet Resort LLC is the only required seller.\n- Review the amended operating agreement and executed sole-member transaction consent.\n- Confirm landlord consent, estoppel, site-control extension, and seller-guaranty release.\n- Validate lender payoff, collateral scope, escrow mechanics, and UCC-3 termination.\n- Confirm kennel permit amendment and written zoning approval for outdoor play areas.\n- Review assignability, notice, auto-renewal, data ownership, and termination rights in all material contracts.\n- Confirm Arizona transaction privilege tax clearance and treatment of known contractor exposure.\n- Verify ownership and transfer of the trade name, logo, domain, telephone numbers, social accounts, creative files, and customer data.\n- Order bring-down entity, UCC, judgment, tax-lien, and litigation searches.\n- Draft tailored representations, special indemnities, closing conditions, and any escrow for unresolved tax or permit matters.\n\n## SECTION 8 — FLAG SUMMARY\n\n| Domain | Flag Severity | Flag Description | Source Reference |\n|---|---|---|---|\n| UCC Filings | deal-risk | Active equipment filing with an estimated $186,000 payoff must be released so the buyer receives clear title to essential kennel, grooming, laundry, and HVAC assets. | UCC_Search_Arizona_2026-07-09.pdf |\n| Entity Standing | negotiation | Sole-member transaction consent exists only in draft form; execute it before buyer diligence and refresh authority at closing. | Member_Consent_Draft_Sale.pdf |\n| Entity Standing | negotiation | Kennel permit and two vendor records use only the DBA rather than Cactus Pet Resort LLC d/b/a The Cactus Pet Resort. | Permit and contract cross-check |\n| Good Standing | informational | July 8, 2026 certificate is valid for preparation but should be refreshed within 30 days of closing with tax-clearance evidence. | Certificate_of_Good_Standing_2026-07-08.pdf |\n| Registered Agent | informational | Commercial Arizona statutory agent is current and supports service continuity through seller wind-down. | Registered_Agent_Confirmation.pdf |\n| Trademark | negotiation | Common-law logo lacks a documented designer assignment and federal registration; include chain-of-title evidence and an express IP schedule. | Brand asset review |\n| Entity Standing | informational | One active Arizona operating LLC and 100% sole-member ownership create a comparatively simple seller structure. | Articles and Operating Agreement |\n| UCC Filings | informational | No second UCC filing or blanket all-assets lien was identified in the illustrative certified search. | UCC_Search_Arizona_2026-07-09.pdf |\n\n## Closing Readiness Checklist\n\n| Deliverable | Owner | Target | Gate |\n|---|---|---:|---|\n| Executed sole-member transaction consent | Seller counsel | Day 10 | Data-room launch |\n| Corrected kennel permit legal name | Seller / permit consultant | Day 20 | Buyer outreach |\n| Landlord consent term sheet and estoppel form | Real-estate counsel | Day 30 | Buyer outreach |\n| Lender payoff and UCC-3 commitment | Seller / lender | Day 35 | Signing |\n| Brand and credential transfer schedule | GM / marketing vendor | Day 35 | Definitive agreement |\n| Fresh good-standing and lien searches | Seller counsel | Five business days pre-close | Closing |\n| Arizona tax clearance and TPT reconciliation | CPA / tax counsel | Day 45 | Closing |\n| Final officer, authority, and incumbency certificates | Seller counsel | Closing | Closing |\n\n**Illustrative conclusion:** The legal structure is clear and fundamentally transferable. Readiness improves from YELLOW to GREEN when the transaction consent is executed, legal names are reconciled, landlord consent is documented, and the equipment lien release is locked into closing mechanics.\n",
        "documentNames": [
          "Arizona_Entity_Search_Demo.pdf",
          "DBA_Record_Demo.pdf"
        ],
        "metadata": {
          "demo": true,
          "flags": [
            {
              "id": "flag-0",
              "status": "confirmed"
            },
            {
              "id": "flag-1",
              "status": "confirmed"
            },
            {
              "id": "flag-2",
              "status": "confirmed"
            },
            {
              "id": "flag-3",
              "status": "confirmed"
            },
            {
              "id": "flag-4",
              "status": "confirmed"
            },
            {
              "id": "flag-5",
              "status": "confirmed"
            },
            {
              "id": "flag-6",
              "status": "confirmed"
            },
            {
              "id": "flag-7",
              "status": "confirmed"
            }
          ],
          "status": "yellow",
          "demoData": true,
          "keyRisks": [
            "Landlord consent and site control",
            "Equipment UCC payoff and UCC-3 termination",
            "Permit and contract legal-name reconciliation",
            "Executed transaction authority and IP chain of title"
          ],
          "executiveSummary": "Single active Arizona LLC with clear ownership; four curable pre-close legal actions remain.",
          "overallReadiness": "YELLOW"
        },
        "createdAt": "2026-07-14T07:14:01.954Z",
        "updatedAt": "2026-07-14T08:11:32.181Z"
      }
    ],
    "OwnershipVerificationReport": [
      {
        "id": "demo-cactus-ownership-1",
        "clientId": "demo-cactus-pet-resort",
        "markdown": "# Corporate Ownership Verification Report\n\n## SECTION 1 — DOCUMENT INVENTORY\n\n| Document Name | Document Type | Entities or Parties Covered | Date | Completeness Flag |\n|---|---|---|---|---|\n| **Articles of Organization — Demo** | Articles of Organization | Cactus Pet Resort Operations LLC | 2016-03-18 | Complete |\n| **Operating Agreement — Demo** | Operating Agreement | Cactus Pet Resort Operations LLC; Elena Marquez | 2025-01-15 | Complete |\n| **Member Certification — Demo** | Ownership Certificate | Elena Marquez | 2026-07-14 | Complete |\n| **Good Standing Certificate — Demo** | Good Standing Certificate | Cactus Pet Resort Operations LLC | 2026-07-01 | Complete |\n\nDocuments Not Provided: Meeting minutes — not applicable to this single-member illustrative LLC.\n\n## SECTION 2 — ENTITY STRUCTURE\n\n| Entity Name | Entity Type | State of Formation | Date of Formation | EIN | Registered Agent | Status | Source Document |\n|---|---|---|---|---|---|---|---|\n| Cactus Pet Resort Operations LLC | LLC | Arizona | 2016-03-18 | Demo EIN ending 4821 | Desert Corporate Services LLC | Active | **Articles of Organization — Demo** |\n\n**Entity Relationship Narrative:** The business operates through one Arizona limited liability company using the registered trade name The Cactus Pet Resort. No parent, subsidiary, or real-estate holding entity was identified.\n\n**Legal Name Consistency Check:** Cactus Pet Resort Operations LLC appears consistently in the articles, operating agreement, good-standing certificate, payroll records, and illustrative lease. The customer-facing DBA is The Cactus Pet Resort.\n\n## SECTION 3 — OWNERSHIP BREAKDOWN\n\n### Cactus Pet Resort Operations LLC\n\n| Owner Name | Owner Type | Ownership Percentage | Class of Interest | Voting Rights | Transfer Restrictions | Source Document |\n|---|---|---|---|---|---|---|\n| Elena Marquez | Individual | 100% | Membership Units | Full | Consent Required | **Operating Agreement — Demo** |\n\n**Ownership Verification Note:** Ownership totals 100%. No options, minority interests, profit interests, or side agreements were identified.\n\n**Shareholder/Member Identification Note:** Elena Marquez is consistently identified as the sole member in every illustrative ownership document.\n\n**Transfer Authority Note:** The sole member may authorize a sale of substantially all assets by written consent.\n\n## SECTION 4 — ENCUMBRANCES & LIENS\n\n**Type:** UCC Filing  \n**Filed Against:** Cactus Pet Resort Operations LLC  \n**Secured Party / Lienholder:** Desert Equipment Finance  \n**Filing Date:** 2023-04-12  \n**Expiration Date:** 2028-04-12  \n**Collateral Description:** Identified kennel equipment and related proceeds  \n**Status:** Active  \n**Amount:** $186,000 estimated payoff  \n**Source Document:** **Illustrative UCC cross-reference from Litigation & Liens**  \n**Flag:** Deal Risk — obtain payoff and UCC-3 termination at closing.\n\n## SECTION 5 — STATE FILING COMPLIANCE\n\n| State | Filing Type | Filing Date | Expiration/Due Date | Status | Compliance Assessment | Notes | Source Document |\n|---|---|---|---|---|---|---|---|\n| Arizona | Good Standing | 2026-07-01 | 2027-07-01 | Active | Compliant | Entity shown active | **Good Standing Certificate — Demo** |\n| Arizona | Registered Agent | 2026-01-01 | 2027-01-01 | Active | Compliant | Desert Corporate Services LLC | **Annual Report — Demo** |\n\n**Compliance Summary:** The company is registered only in Arizona and is shown active and compliant in this illustrative file. Refresh the certificate within 30 days of closing.\n\n## SECTION 6 — BUYER-FACING OWNERSHIP SUMMARY\n\n**CRITICAL VERIFICATION CHECKS:**  \n✅ **Legal Name Consistency (Corporate Docs):** Cactus Pet Resort Operations LLC is consistent.  \n✅ **Lease Name Match:** Lease tenant Cactus Pet Resort Operations LLC matches the formation documents.  \n✅ **Material Contracts Name Match:** Available illustrative contracts use Cactus Pet Resort Operations LLC.  \n✅ **Employee Agreements Name Match:** Payroll and employment records use Cactus Pet Resort Operations LLC.  \n✅ **All Shareholders Identified:** Elena Marquez is the sole identified member.  \n✅ **Ownership Totals 100%:** Ownership totals 100%.\n\n**Entity Structure Overview:** One active Arizona LLC operates the business under The Cactus Pet Resort DBA. The legal name is consistent across the illustrative package.\n\n**Ownership Clarity:** Elena Marquez owns 100% of the membership interests and holds full voting authority. No conflicting ownership claims were identified.\n\n**Encumbrance Exposure:** An equipment financing statement with an estimated $186,000 payoff must be released at closing. Full lien verification remains with the Litigation & Liens workstream.\n\n**State Compliance Status:** The company is shown active and compliant in Arizona. A fresh certificate should be ordered for closing.\n\n**Transition Considerations:** The sole member should approve the transaction by written consent. The operating agreement's transfer provisions should be addressed in the purchase documents.\n\n**Items Requiring Buyer's Corporate Counsel Review:**\n- Confirm payoff and UCC-3 termination mechanics.\n- Confirm member authorization and transaction documents.\n- Refresh good-standing and lien searches immediately before closing.\n\n## SECTION 7 — FLAGS SUMMARY\n\n| # | Flag Severity | Domain | Flag Description | Source Reference | Craig's Review |\n|---|---|---|---|---|---|\n| 1 | Deal Risk | Encumbrances | Active equipment UCC must be paid and terminated at closing | Litigation & Liens cross-reference | Confirmed |\n| 2 | Negotiation Point | Ownership | Document sole-member transaction consent | Operating Agreement — Demo | Confirmed |\n| 3 | Positive | Ownership | Sole member is clearly identified and ownership totals 100% | Member Certification — Demo | Confirmed |\n| 4 | Positive | State Filings | Arizona entity is active and compliant | Good Standing Certificate — Demo | Confirmed |",
        "documentNames": [
          "Operating_Agreement_Demo.pdf",
          "Member_Certification_Demo.pdf",
          "UCC_Search_Demo.pdf"
        ],
        "metadata": {
          "demo": true,
          "flags": [
            {
              "id": "flag-0",
              "status": "confirmed"
            },
            {
              "id": "flag-1",
              "status": "confirmed"
            },
            {
              "id": "flag-2",
              "status": "confirmed"
            },
            {
              "id": "flag-3",
              "status": "confirmed"
            }
          ]
        },
        "createdAt": "2026-07-14T07:14:01.954Z",
        "updatedAt": "2026-07-14T07:27:17.872Z"
      }
    ],
    "PermitsZoningReport": [
      {
        "id": "demo-cactus-permits-1",
        "clientId": "demo-cactus-pet-resort",
        "markdown": "# Permits & Zoning Report\n\n## SECTION 1 — DOCUMENT INVENTORY\n\n| Document Name | Document Type | Issuing Authority | Date | Completeness Flag |\n|---|---|---|---|---|\n| **Phoenix Business License — Demo** | Business License | City of Phoenix | 2026-01-01 | Complete |\n| **Kennel Permit — Demo** | Kennel Permit | Maricopa County | 2025-10-01 | Complete — DBA correction required |\n| **Certificate of Occupancy — Demo** | Certificate of Occupancy | City of Phoenix | 2019-05-15 | Complete |\n| **Zoning Letter — Demo** | Zoning Verification | City of Phoenix | 2024-06-12 | Appears Incomplete |\n\n## SECTION 2 — PERMIT INVENTORY\n\n| Permit Type | Permit Number | Issuing Authority | Issue Date | Expiration Date | Status | Renewal Process | Conditions | Source Reference |\n|---|---|---|---|---|---|---|---|---|\n| Business License | PHX-BL-DEMO-4421 | City of Phoenix | 2026-01-01 | 2026-12-31 | Current | Annual online renewal | Maintain tax account | **Phoenix Business License — Demo** |\n| Kennel Operating Permit | MC-KNL-DEMO-118 | Maricopa County | 2025-10-01 | 2026-09-30 | Expiring Soon | Annual inspection and renewal | Permit shows former DBA; animal-care standards apply | **Kennel Permit — Demo** |\n| Certificate of Occupancy | CO-DEMO-9017 | City of Phoenix | 2019-05-15 | No expiration | Current | No routine renewal | Boarding/daycare use | **Certificate of Occupancy — Demo** |\n\n## SECTION 3 — ZONING ANALYSIS\n\n**Property Address:** 1720 E Deer Valley Dr, Phoenix, AZ 85024  \n**Zoning Designation:** C-2 Intermediate Commercial, illustrative  \n**Permitted Uses:** Pet boarding, daycare, grooming  \n**Current Use:** Pet resort, kennel, boarding, daycare, and grooming  \n**Compliance Status:** Conditional  \n**Restrictions:**\n- Noise ordinance: Outdoor animal activity must avoid nuisance conditions.\n- Setback requirements: Existing configuration appears approved; verify expanded play yard.\n- Parking requirements: Existing certificate reflects 28 spaces.\n- Hours of operation: Not specified in available letter.\n- Maximum animal capacity: Governed by kennel permit.\n- Outdoor exercise area: Available zoning letter does not expressly address the expanded fenced area.\n**Source:** **Zoning Letter — Demo**  \n**Flag:** Deal Risk — obtain written confirmation for the expanded outdoor play area.\n\n## SECTION 4 — CONDITIONAL USE PERMITS\n\nNo conditional use permits identified in uploaded documents. If the pet resort operates under a CUP, upload the permit and any associated conditions of approval.\n\n## SECTION 5 — GRANDFATHERING & NON-CONFORMING USE ANALYSIS\n\nNo non-conforming use or grandfathering issues identified in uploaded documents. The current use appears supportable under the illustrative zoning designation, subject to written confirmation of the outdoor play area.\n\n## SECTION 6 — BUYER-FACING SUMMARY\n\n**Permits Overview:** Three core operating approvals were identified. The business license and certificate of occupancy are current. The kennel permit expires September 30, 2026 and should be corrected to the current DBA during renewal.\n\n**Zoning Compliance:** Pet boarding, daycare, and grooming appear supportable at the property. The available zoning letter does not expressly confirm the expanded outdoor play configuration.\n\n**Conditional Use Permit Status:** No CUP was identified in the illustrative file. Municipal confirmation should state whether one is required.\n\n**Grandfathering Risk:** No non-conforming use or grandfathering issue was identified.\n\n**Transfer Considerations:** Correct the kennel permit legal name, obtain written outdoor-use confirmation, and document whether permits transfer or must be reissued after closing.\n\n**Items Requiring Buyer's Land Use Counsel Review:**\n- Confirm the outdoor play area is permitted.\n- Confirm whether a CUP is required.\n- Confirm permit transfer and reissuance requirements.\n- Verify animal capacity and operating-hour conditions.\n\n## SECTION 7 — FLAGS SUMMARY\n\n| # | Flag Severity | Domain | Flag Description | Source Reference | Craig's Review |\n|---|---|---|---|---|---|\n| 1 | Deal Risk | Zoning | Outdoor play expansion is not expressly confirmed | Zoning Letter — Demo | Confirmed |\n| 2 | Deal Risk | Permits | Kennel permit uses an older DBA and expires September 30, 2026 | Kennel Permit — Demo | Confirmed |\n| 3 | Positive | Permits | Business license and certificate of occupancy are current | License and CO — Demo | Confirmed |\n| 4 | Informational | CUP | No CUP identified; municipal confirmation recommended | Document inventory | Confirmed |",
        "documentNames": [
          "Kennel_Permit_Demo.pdf",
          "Certificate_of_Occupancy_Demo.pdf",
          "Zoning_Letter_Demo.pdf"
        ],
        "metadata": {
          "demo": true,
          "flags": [
            {
              "id": "flag-0",
              "status": "confirmed"
            },
            {
              "id": "flag-1",
              "status": "confirmed"
            },
            {
              "id": "flag-2",
              "status": "confirmed"
            },
            {
              "id": "flag-3",
              "status": "confirmed"
            }
          ]
        },
        "createdAt": "2026-07-14T07:14:01.954Z",
        "updatedAt": "2026-07-14T07:27:17.872Z"
      }
    ],
    "TaxLiabilityReport": [
      {
        "id": "demo-cactus-tax-rich",
        "clientId": "demo-cactus-pet-resort",
        "markdown": "# TAX LIABILITY REVIEW\n**Client:** The Cactus Pet Resort  \n**Entity:** Cactus Pet Resort LLC  \n**Jurisdiction:** Arizona  \n**Analysis Date:** July 14, 2026\n\n## SECTION 1 — DOCUMENT INVENTORY\n\n| Filename | Document Type | Tax Years Covered | Date | Status |\n|---|---|---|---|---|\n| Federal Returns 2023-2025.pdf | Form 1065 and K-1 package | 2023-2025 | Mar 15, 2026 | Complete |\n| Arizona Partnership Returns.pdf | Arizona Form 165 | 2023-2025 | Apr 15, 2026 | Complete |\n| Payroll Tax Package.pdf | Forms 941, 940 and state unemployment | 2023-Q2 2026 | Jun 30, 2026 | Complete |\n| Arizona TPT Filings.pdf | Transaction privilege tax | 2024-Q2 2026 | Jun 30, 2026 | Partial — reconciliation missing |\n| Contractor 1099 Register.xlsx | Forms 1099-NEC | 2024-2025 | Jan 31, 2026 | Complete |\n| Tax Notices.pdf | Federal and state notices | 2023-2026 | Jul 1, 2026 | Complete — one closed notice |\n\n## SECTION 2 — TAX RETURN SUMMARY\n\n### Return 1\n**Tax Year:** 2025  \n**Entity Name:** Cactus Pet Resort LLC  \n**Return Type:** Federal Form 1065  \n**Filing Status:** Filed  \n**Filing Date:** March 15, 2026  \n**Gross Revenue:** $1,684,200  \n**Taxable Income:** $361,400  \n**Total Tax Due:** Pass-through  \n**Total Tax Paid:** Owner estimates paid individually  \n**Balance Due:** $0 entity-level  \n**Notes:** Revenue agrees to the final financial statements within $4,800 timing difference.  \n**Source Document:** 2025 Federal Return\n\n### Return 2\n**Tax Year:** 2024  \n**Entity Name:** Cactus Pet Resort LLC  \n**Return Type:** Federal Form 1065  \n**Filing Status:** Filed  \n**Filing Date:** March 14, 2025  \n**Gross Revenue:** $1,557,900  \n**Taxable Income:** $302,100  \n**Total Tax Due:** Pass-through  \n**Total Tax Paid:** Owner estimates paid individually  \n**Balance Due:** $0 entity-level  \n**Notes:** No late-filing indicator.  \n**Source Document:** 2024 Federal Return\n\n### Return 3\n**Tax Year:** 2023  \n**Entity Name:** Cactus Pet Resort LLC  \n**Return Type:** Federal Form 1065  \n**Filing Status:** Filed  \n**Filing Date:** March 15, 2024  \n**Gross Revenue:** $1,442,600  \n**Taxable Income:** $266,800  \n**Total Tax Due:** Pass-through  \n**Total Tax Paid:** Owner estimates paid individually  \n**Balance Due:** $0 entity-level  \n**Notes:** Opening year in reviewed period.  \n**Source Document:** 2023 Federal Return\n\n## SECTION 3 — OUTSTANDING LIABILITIES\n\n### Liability 1\n**Type:** Sales & Use Tax  \n**Description:** Arizona transaction privilege tax reconciliation difference for retail and selected taxable add-on services.  \n**Tax Year:** 2025-Q2 2026  \n**Original Amount:** Estimated $12,600  \n**Current Balance:** $12,600 estimated  \n**Penalties & Interest:** $1,200-$2,400 estimated if assessed  \n**Payment Plan:** No  \n**Payment Plan Details:** Not established  \n**Status:** Open  \n**Tax Lien Filed:** No  \n**Source Document:** TPT filings and revenue reconciliation\n\n### Liability 2\n**Type:** Payroll Tax  \n**Description:** One 2024 Arizona unemployment filing notice caused by account-number mismatch.  \n**Tax Year:** Q2 2024  \n**Original Amount:** $3,180  \n**Current Balance:** $0  \n**Penalties & Interest:** $0 after abatement  \n**Payment Plan:** No  \n**Payment Plan Details:** Resolved September 2024  \n**Status:** Resolved  \n**Tax Lien Filed:** No  \n**Source Document:** Arizona DES closure notice\n\nNo federal income-tax lien, payroll trust-fund balance, installment agreement or delinquent return was identified.\n\n## SECTION 4 — AUDIT HISTORY\n\n### Audit 1\n**Tax Authority:** None identified  \n**Tax Year:** 2023-2025  \n**Audit Type:** Federal income tax  \n**Status:** None  \n**Adjustment Amount:** $0  \n**Additional Tax Assessed:** $0  \n**Penalties:** $0  \n**Outcome:** No audit notices in supplied package  \n**Date Initiated:** Not applicable  \n**Date Closed:** Not applicable  \n**Source Document:** Tax notice package and management representation\n\n## SECTION 5 — STATE & LOCAL TAX COMPLIANCE\n\n### State Record 1\n**State:** Arizona  \n**Tax Type:** Transaction Privilege Tax  \n**Filing Status:** Partial  \n**Nexus Established:** Yes  \n**Last Filed Year:** Q2 2026  \n**Outstanding Balance:** Estimated $12,600  \n**Notes:** Boarding revenue treatment appears consistent; retail and selected add-ons require account-level reconciliation.  \n**Source Document:** Arizona TPT filings\n\n### State Record 2\n**State:** Arizona  \n**Tax Type:** Unemployment Insurance  \n**Filing Status:** Current  \n**Nexus Established:** Yes  \n**Last Filed Year:** Q2 2026  \n**Outstanding Balance:** $0  \n**Notes:** Historical account-number mismatch was corrected.  \n**Source Document:** DES filings and closure notice\n\n### State Record 3\n**State:** City of Phoenix  \n**Tax Type:** Local licensing / taxable activity  \n**Filing Status:** Current  \n**Nexus Established:** Yes  \n**Last Filed Year:** 2026  \n**Outstanding Balance:** $0  \n**Notes:** Business license current; confirm treatment after ownership change.  \n**Source Document:** Phoenix license and TPT profile\n\n## SECTION 6 — PAYROLL TAX REVIEW\n\n### Payroll Record 1\n**Period:** Q1 2026  \n**Type:** Federal Form 941  \n**Status:** Current  \n**Amount Due:** $81,420  \n**Amount Paid:** $81,420  \n**Balance:** $0  \n**Trust Fund Issue:** No  \n**Notes:** Deposits reconcile to payroll register.  \n**Source Document:** Form 941 and EFTPS history\n\n### Payroll Record 2\n**Period:** Q2 2026  \n**Type:** Federal Form 941  \n**Status:** Current  \n**Amount Due:** $86,310  \n**Amount Paid:** $86,310  \n**Balance:** $0  \n**Trust Fund Issue:** No  \n**Notes:** Deposits timely; contractor classification reviewed separately.  \n**Source Document:** Form 941 and payroll register\n\n### Payroll Record 3\n**Period:** 2025  \n**Type:** Federal Form 940  \n**Status:** Current  \n**Amount Due:** $3,960  \n**Amount Paid:** $3,960  \n**Balance:** $0  \n**Trust Fund Issue:** No  \n**Notes:** Filed timely.  \n**Source Document:** Form 940\n\n## SECTION 7 — DEAL STRUCTURE IMPLICATIONS\n\n### Deal Implication 1\n**Area:** Arizona TPT reconciliation  \n**Risk Level:** High  \n**Description:** Taxable retail and add-on receipts have not been fully reconciled to filed TPT returns.  \n**Estimated Exposure:** $13,800-$15,000 including estimated interest and penalties  \n**Recommended Action:** Complete lookback, file amended returns if needed, and obtain tax-clearance evidence.  \n**Deal Structure Impact:** Seller-specific indemnity and escrow until clearance.  \n**Source Document:** TPT filings and revenue detail\n\n### Deal Implication 2\n**Area:** Contractor classification  \n**Risk Level:** Medium  \n**Description:** Three grooming contractors may require worker-classification review.  \n**Estimated Exposure:** $22,000-$38,000 across payroll tax and benefit estimates  \n**Recommended Action:** Employment counsel and CPA review; consider pre-close conversion.  \n**Deal Structure Impact:** Targeted indemnity or payroll-tax escrow.  \n**Source Document:** 1099 register and employee obligations report\n\n### Deal Implication 3\n**Area:** Purchase-price allocation  \n**Risk Level:** Medium  \n**Description:** Allocation among goodwill, equipment, customer relationships and restrictive covenants will affect seller and buyer tax outcomes.  \n**Estimated Exposure:** Structure dependent  \n**Recommended Action:** Agree illustrative Form 8594 allocation before definitive documents.  \n**Deal Structure Impact:** Include allocation methodology and cooperation covenant.  \n**Source Document:** Asset schedule and valuation report\n\n## SECTION 8 — BUYER SUMMARY\n\n**Overall Tax Health Assessment:** Generally current and well documented. Federal partnership and payroll filings appear timely, with no lien or open federal audit identified. Arizona TPT reconciliation is the only material unresolved filing item.\n\n**Outstanding Liability Summary:** Estimated TPT exposure is $13,800-$15,000 including potential interest and penalties. No payroll trust-fund or federal income-tax balance was identified.\n\n**Audit Risk Assessment:** Low based on supplied notices and filing history, subject to routine buyer verification and tax clearance.\n\n**State & Local Compliance Overview:** Arizona income, unemployment and Phoenix licensing appear current. TPT retail and add-on classifications require a focused lookback.\n\n**Payroll Tax Status:** Federal payroll deposits reconcile to reported wages and show no trust-fund deficiency. Grooming contractor classification remains a separate exposure.\n\n**Deal Structure Recommendations:** Use an asset transaction with seller tax indemnity, TPT escrow, agreed purchase-price allocation and cooperation for amended filings.\n\n**Estimated Total Tax Exposure:** $35,800-$53,000 combining TPT and illustrative contractor-classification ranges before offsets.\n\n**Transition Considerations:** Transfer TPT and unemployment accounts, close or update seller registrations, coordinate final payroll, issue 1099/W-2 forms and preserve seven years of returns and workpapers.\n\n**Items Requiring Buyer's Tax Counsel Review:**\n- Arizona TPT lookback and tax clearance\n- Grooming contractor classification\n- Form 8594 purchase-price allocation\n- Successor-liability protections and escrow\n- Final payroll, W-2 and 1099 responsibilities\n- SIMPLE IRA transaction notices\n- State account transfer and post-close filing cutover\n\n## SECTION 9 — FLAGS SUMMARY\n\n| Domain | Severity | Flag Description | Source Reference |\n|---|---|---|---|\n| Sales Tax | Deal Risk | Arizona TPT reconciliation indicates estimated $13,800-$15,000 exposure | TPT filings and revenue detail |\n| Payroll | Negotiation Point | Grooming contractor classification may create $22,000-$38,000 exposure | 1099 register |\n| Deal Structure | Negotiation Point | Purchase-price allocation has not been agreed | Valuation and asset schedule |\n| State Compliance | Negotiation Point | Buyer requires tax clearance and account-transition plan | Arizona registrations |\n| Federal Filing | Informational | Three years of federal partnership returns filed timely | Forms 1065 |\n| Payroll Tax | Informational | Forms 941 and 940 reconcile with no trust-fund balance | Payroll package |\n| Audit | Informational | No open federal or Arizona audit identified | Tax notices |\n",
        "documentNames": [
          "Federal Returns 2023-2025.pdf",
          "Arizona Partnership Returns.pdf",
          "Payroll Tax Package.pdf",
          "Arizona TPT Filings.pdf",
          "Contractor 1099 Register.xlsx",
          "Tax Notices.pdf"
        ],
        "metadata": {
          "flags": [
            {
              "id": "flag-0",
              "status": "confirmed"
            },
            {
              "id": "flag-1",
              "status": "confirmed"
            },
            {
              "id": "flag-2",
              "status": "confirmed"
            },
            {
              "id": "flag-3",
              "status": "confirmed"
            },
            {
              "id": "flag-4",
              "status": "confirmed"
            },
            {
              "id": "flag-5",
              "status": "confirmed"
            },
            {
              "id": "flag-6",
              "status": "confirmed"
            }
          ],
          "sourceType": "illustrative-demo",
          "reviewSummary": "One deal risk, three negotiation items and three informational findings reviewed."
        },
        "createdAt": "2026-07-14T07:52:25.091Z",
        "updatedAt": "2026-07-14T07:52:25.091Z"
      }
    ],
    "TeaserReport": [
      {
        "id": "demo-cactus-teaser",
        "clientId": "demo-cactus-pet-resort",
        "data": {
          "ndaLink": "",
          "dealType": "Confidential Asset Acquisition Opportunity",
          "location": "Phoenix Metropolitan Area, Arizona",
          "buyerCapex": "Low to Moderate — defined minor HVAC, outdoor-surface, finish, and documentation items",
          "realEstate": "Leased Phoenix facility. Landlord consent, extended site control, estoppel, premises exhibit, and seller-guaranty release are part of the defined transaction workplan.",
          "revenueMix": "45% Boarding · 23% Daycare · 20% Grooming · 12% Add-Ons/Retail",
          "technology": "Integrated booking/customer records, payments, accounting, payroll, phone/SMS, digital marketing, cameras, and operational vendors. Buyer receives a tested data-export and Day-1 credential package.",
          "ttmRevenue": "$1.70M",
          "contactName": "Craig Pollack",
          "regionLabel": "Southwestern United States",
          "contactEmail": "craig@cantarapet.com",
          "contactTitle": "Chief Executive Officer · Cantara Pet Business Advisors",
          "ebitdaMargin": "26.5%",
          "processStage": "LOI Solicitation",
          "revenueRange": "$1.5M–$2.0M Revenue",
          "serviceModel": "Boarding · Daycare · Grooming · Enrichment",
          "annualRevenue": "$1,700,000",
          "clientProfile": "Diversified Phoenix-area customer base supported by repeat visits, word of mouth, veterinary/referral relationships, local search, and a 4.9-star rating across 214 reviews. No expected material single-customer concentration.",
          "dealReference": "CPR-2026-01",
          "permitsZoning": "Core kennel, business, occupancy, and zoning records are in the diligence package. Legal-name and outdoor-use documentation are being refreshed before closing.",
          "revenueGrowth": "6% TTM growth; three-year illustrative CAGR of approximately 11%",
          "totalCapacity": "66% average occupancy · 91% peak occupancy",
          "teaserSubtitle": "Confidential Phoenix Pet-Care Acquisition Opportunity",
          "facilityProfile": "Leased, purpose-configured pet-care facility with boarding inventory, daycare/play areas, grooming and bathing stations, laundry, reception, staff support space, and outdoor exercise areas. Facility review indicates good overall condition with defined minor improvements.",
          "staffOperations": "24-person team spanning management, front desk, animal care, daycare, grooming, and administration. Frontline compensation is generally aligned with local market levels and key cross-training initiatives are underway.",
          "businessOverview": "Premium Phoenix-area pet resort with integrated boarding, daycare, grooming, and enrichment services; $1.70 million trailing revenue; $450,000 normalized EBITDA; 26.5% margin; 4.9-star Google rating across 214 reviews; experienced GM-led 24-person team; and multiple measured growth opportunities.",
          "facilityCapacity": "Established single-site operation with peak and off-peak growth headroom",
          "normalizedEbitda": "$450,000",
          "overviewHeadline": "High-Reputation, Profitable Phoenix Pet-Care Platform",
          "businessDisplayName": "Project Saguaro",
          "ownershipManagement": "Single Arizona operating LLC with clear 100% ownership. Daily operations are led by an experienced GM and AGM; a formal retention and seller-transition package supports continuity.",
          "investmentHighlights": [
            {
              "title": "Attractive Earnings",
              "description": "$1.70M revenue and $450K normalized EBITDA produce a strong 26.5% margin."
            },
            {
              "title": "Exceptional Reputation",
              "description": "4.9 Google rating across 214 reviews supports premium trust and durable referral demand."
            },
            {
              "title": "Transferable Team",
              "description": "Experienced GM/AGM and 24-person workforce provide credible continuity beyond the owner."
            },
            {
              "title": "Diversified Services",
              "description": "Boarding, daycare, grooming, enrichment, and add-ons create frequency and share of wallet."
            },
            {
              "title": "Measured Growth Plan",
              "description": "~$190K gross annual revenue opportunity identified across pricing, yield, memberships, grooming, add-ons, and conversion; not included in current EBITDA."
            }
          ],
          "section02LeadSummary": "A scaled local pet-care business combining strong current earnings, exceptional customer trust, an experienced operating team, and actionable price, yield, membership, grooming, and conversion opportunities.",
          "normalizedEbitdaMargin": "26.5%"
        },
        "createdAt": "2026-07-14T08:26:22.365Z",
        "updatedAt": "2026-07-14T08:26:22.365Z"
      }
    ],
    "TtmAnalysis": [
      {
        "id": "demo-cactus-ttm-ui-ready",
        "clientId": "demo-cactus-pet-resort",
        "version": 1,
        "status": "APPROVED",
        "hitlStatus": "APPROVED",
        "inputFingerprint": "demo-cactus-ui-ready-v2",
        "model": "demo-ui-ready",
        "temperature": 0,
        "maxTokens": 0,
        "inputSnapshot": {
          "demo": true,
          "source": "Illustrative data supplied for the Cactus Pet Resort demo"
        },
        "normalizedData": {
          "monthKeys": [
            "2023-08",
            "2023-09",
            "2023-10",
            "2023-11",
            "2023-12",
            "2024-01",
            "2024-02",
            "2024-03",
            "2024-04",
            "2024-05",
            "2024-06",
            "2024-07",
            "2024-08",
            "2024-09",
            "2024-10",
            "2024-11",
            "2024-12",
            "2025-01",
            "2025-02",
            "2025-03",
            "2025-04",
            "2025-05",
            "2025-06",
            "2025-07",
            "2025-08",
            "2025-09",
            "2025-10",
            "2025-11",
            "2025-12",
            "2026-01",
            "2026-02",
            "2026-03",
            "2026-04",
            "2026-05",
            "2026-06",
            "2026-07"
          ],
          "monthlyBs": {
            "notes": [
              "Working-capital summary provided separately."
            ],
            "format": "demo",
            "rowCount": 0
          },
          "monthlyPl": {
            "notes": [
              "Illustrative 36-month operating model for UI demonstration."
            ],
            "format": "demo",
            "rowCount": 10
          },
          "sourceNotes": {
            "monthlyBs": [
              "Demo data"
            ],
            "monthlyPl": [
              "Demo data"
            ],
            "accountantStatements": [
              "Demo data"
            ]
          },
          "mappedBsRows": [],
          "mappedPlRows": [
            {
              "accountCode": "4000",
              "accountName": "Boarding Revenue",
              "cantaraCode": "REV-BOARD",
              "mappingMethod": "manual",
              "valuesByMonth": {
                "2023-08": 65250,
                "2023-09": 62640,
                "2023-10": 67860,
                "2023-11": 75690,
                "2023-12": 93960,
                "2024-01": 60030,
                "2024-02": 57420,
                "2024-03": 67860,
                "2024-04": 65250,
                "2024-05": 69600,
                "2024-06": 88740,
                "2024-07": 95700,
                "2024-08": 70650,
                "2024-09": 67824,
                "2024-10": 73476,
                "2024-11": 81954,
                "2024-12": 101736,
                "2025-01": 64998,
                "2025-02": 62172,
                "2025-03": 73476,
                "2025-04": 70650,
                "2025-05": 75360,
                "2025-06": 96084,
                "2025-07": 103620,
                "2025-08": 76500,
                "2025-09": 73440,
                "2025-10": 79560,
                "2025-11": 88740,
                "2025-12": 110160,
                "2026-01": 70380,
                "2026-02": 67320,
                "2026-03": 79560,
                "2026-04": 76500,
                "2026-05": 81600,
                "2026-06": 104040,
                "2026-07": 112200
              }
            },
            {
              "accountCode": "4010",
              "accountName": "Daycare Revenue",
              "cantaraCode": "REV-DAYCARE",
              "mappingMethod": "manual",
              "valuesByMonth": {
                "2023-08": 28275,
                "2023-09": 27144,
                "2023-10": 29406,
                "2023-11": 32799,
                "2023-12": 40716,
                "2024-01": 26013,
                "2024-02": 24882,
                "2024-03": 29406,
                "2024-04": 28275,
                "2024-05": 30160,
                "2024-06": 38454,
                "2024-07": 41470,
                "2024-08": 30600,
                "2024-09": 29376,
                "2024-10": 31824,
                "2024-11": 35496,
                "2024-12": 44064,
                "2025-01": 28152,
                "2025-02": 26928,
                "2025-03": 31824,
                "2025-04": 30600,
                "2025-05": 32640,
                "2025-06": 41616,
                "2025-07": 44880,
                "2025-08": 33000,
                "2025-09": 31680,
                "2025-10": 34320,
                "2025-11": 38280,
                "2025-12": 47520,
                "2026-01": 30360,
                "2026-02": 29040,
                "2026-03": 34320,
                "2026-04": 33000,
                "2026-05": 35200,
                "2026-06": 44880,
                "2026-07": 48400
              }
            },
            {
              "accountCode": "4020",
              "accountName": "Grooming Revenue",
              "cantaraCode": "REV-GROOM",
              "mappingMethod": "manual",
              "valuesByMonth": {
                "2023-08": 15225,
                "2023-09": 14616,
                "2023-10": 15834,
                "2023-11": 17661,
                "2023-12": 21924,
                "2024-01": 14007,
                "2024-02": 13398,
                "2024-03": 15834,
                "2024-04": 15225,
                "2024-05": 16240,
                "2024-06": 20706,
                "2024-07": 22330,
                "2024-08": 16500,
                "2024-09": 15840,
                "2024-10": 17160,
                "2024-11": 19140,
                "2024-12": 23760,
                "2025-01": 15180,
                "2025-02": 14520,
                "2025-03": 17160,
                "2025-04": 16500,
                "2025-05": 17600,
                "2025-06": 22440,
                "2025-07": 24200,
                "2025-08": 18000,
                "2025-09": 17280,
                "2025-10": 18720,
                "2025-11": 20880,
                "2025-12": 25920,
                "2026-01": 16560,
                "2026-02": 15840,
                "2026-03": 18720,
                "2026-04": 18000,
                "2026-05": 19200,
                "2026-06": 24480,
                "2026-07": 26400
              }
            },
            {
              "accountCode": "5000",
              "accountName": "Direct Pet Care Supplies",
              "cantaraCode": "COGS-SUPPLY",
              "mappingMethod": "manual",
              "valuesByMonth": {
                "2023-08": 5550,
                "2023-09": 5328,
                "2023-10": 5772,
                "2023-11": 6438,
                "2023-12": 7992,
                "2024-01": 5106,
                "2024-02": 4884,
                "2024-03": 5772,
                "2024-04": 5550,
                "2024-05": 5920,
                "2024-06": 7548,
                "2024-07": 8140,
                "2024-08": 5925,
                "2024-09": 5688,
                "2024-10": 6162,
                "2024-11": 6873,
                "2024-12": 8532,
                "2025-01": 5451,
                "2025-02": 5214,
                "2025-03": 6162,
                "2025-04": 5925,
                "2025-05": 6320,
                "2025-06": 8058,
                "2025-07": 8690,
                "2025-08": 6375,
                "2025-09": 6120,
                "2025-10": 6630,
                "2025-11": 7395,
                "2025-12": 9180,
                "2026-01": 5865,
                "2026-02": 5610,
                "2026-03": 6630,
                "2026-04": 6375,
                "2026-05": 6800,
                "2026-06": 8670,
                "2026-07": 9350
              }
            },
            {
              "accountCode": "6000",
              "accountName": "Staff Payroll",
              "cantaraCode": "OPX-LABOR-STAFF",
              "mappingMethod": "manual",
              "valuesByMonth": {
                "2023-08": 34378.5,
                "2023-09": 33003.36,
                "2023-10": 35753.64,
                "2023-11": 39879.06,
                "2023-12": 49505.04,
                "2024-01": 31628.22,
                "2024-02": 30253.08,
                "2024-03": 35753.64,
                "2024-04": 34378.5,
                "2024-05": 36670.4,
                "2024-06": 46754.76,
                "2024-07": 50421.8,
                "2024-08": 36797.25,
                "2024-09": 35325.36,
                "2024-10": 38269.14,
                "2024-11": 42684.81,
                "2024-12": 52988.04,
                "2025-01": 33853.47,
                "2025-02": 32381.58,
                "2025-03": 38269.14,
                "2025-04": 36797.25,
                "2025-05": 39250.4,
                "2025-06": 50044.26,
                "2025-07": 53969.3,
                "2025-08": 39702,
                "2025-09": 38113.92,
                "2025-10": 41290.08,
                "2025-11": 46054.32,
                "2025-12": 57170.88,
                "2026-01": 36525.84,
                "2026-02": 34937.76,
                "2026-03": 41290.08,
                "2026-04": 39702,
                "2026-05": 42348.8,
                "2026-06": 53994.72,
                "2026-07": 58229.6
              }
            },
            {
              "accountCode": "6100",
              "accountName": "Facility Rent",
              "cantaraCode": "OPX-RENT",
              "mappingMethod": "manual",
              "valuesByMonth": {
                "2023-08": 15066,
                "2023-09": 14463.36,
                "2023-10": 15668.64,
                "2023-11": 17476.56,
                "2023-12": 21695.04,
                "2024-01": 13860.72,
                "2024-02": 13258.08,
                "2024-03": 15668.64,
                "2024-04": 15066,
                "2024-05": 16070.4,
                "2024-06": 20489.76,
                "2024-07": 22096.8,
                "2024-08": 15984,
                "2024-09": 15344.64,
                "2024-10": 16623.36,
                "2024-11": 18541.44,
                "2024-12": 23016.96,
                "2025-01": 14705.28,
                "2025-02": 14065.92,
                "2025-03": 16623.36,
                "2025-04": 15984,
                "2025-05": 17049.6,
                "2025-06": 21738.24,
                "2025-07": 23443.2,
                "2025-08": 16740,
                "2025-09": 16070.4,
                "2025-10": 17409.6,
                "2025-11": 19418.4,
                "2025-12": 24105.6,
                "2026-01": 15400.8,
                "2026-02": 14731.2,
                "2026-03": 17409.6,
                "2026-04": 16740,
                "2026-05": 17856,
                "2026-06": 22766.4,
                "2026-07": 24552
              }
            },
            {
              "accountCode": "6200",
              "accountName": "Utilities",
              "cantaraCode": "OPX-UTIL",
              "mappingMethod": "manual",
              "valuesByMonth": {
                "2023-08": 3997.5,
                "2023-09": 3837.6,
                "2023-10": 4157.4,
                "2023-11": 4637.1,
                "2023-12": 5756.4,
                "2024-01": 3677.7,
                "2024-02": 3517.8,
                "2024-03": 4157.4,
                "2024-04": 3997.5,
                "2024-05": 4264,
                "2024-06": 5436.6,
                "2024-07": 5863,
                "2024-08": 4278.75,
                "2024-09": 4107.6,
                "2024-10": 4449.9,
                "2024-11": 4963.35,
                "2024-12": 6161.4,
                "2025-01": 3936.45,
                "2025-02": 3765.3,
                "2025-03": 4449.9,
                "2025-04": 4278.75,
                "2025-05": 4564,
                "2025-06": 5819.1,
                "2025-07": 6275.5,
                "2025-08": 4586.25,
                "2025-09": 4402.8,
                "2025-10": 4769.7,
                "2025-11": 5320.05,
                "2025-12": 6604.2,
                "2026-01": 4219.35,
                "2026-02": 4035.9,
                "2026-03": 4769.7,
                "2026-04": 4586.25,
                "2026-05": 4892,
                "2026-06": 6237.3,
                "2026-07": 6726.5
              }
            },
            {
              "accountCode": "6300",
              "accountName": "Insurance",
              "cantaraCode": "OPX-INSUR",
              "mappingMethod": "manual",
              "valuesByMonth": {
                "2023-08": 3198,
                "2023-09": 3070.08,
                "2023-10": 3325.92,
                "2023-11": 3709.68,
                "2023-12": 4605.12,
                "2024-01": 2942.16,
                "2024-02": 2814.24,
                "2024-03": 3325.92,
                "2024-04": 3198,
                "2024-05": 3411.2,
                "2024-06": 4349.28,
                "2024-07": 4690.4,
                "2024-08": 3423,
                "2024-09": 3286.08,
                "2024-10": 3559.92,
                "2024-11": 3970.68,
                "2024-12": 4929.12,
                "2025-01": 3149.16,
                "2025-02": 3012.24,
                "2025-03": 3559.92,
                "2025-04": 3423,
                "2025-05": 3651.2,
                "2025-06": 4655.28,
                "2025-07": 5020.4,
                "2025-08": 3669,
                "2025-09": 3522.24,
                "2025-10": 3815.76,
                "2025-11": 4256.04,
                "2025-12": 5283.36,
                "2026-01": 3375.48,
                "2026-02": 3228.72,
                "2026-03": 3815.76,
                "2026-04": 3669,
                "2026-05": 3913.6,
                "2026-06": 4989.84,
                "2026-07": 5381.2
              }
            },
            {
              "accountCode": "6400",
              "accountName": "Marketing",
              "cantaraCode": "OPX-MKTG",
              "mappingMethod": "manual",
              "valuesByMonth": {
                "2023-08": 4350,
                "2023-09": 4176,
                "2023-10": 4524,
                "2023-11": 5046,
                "2023-12": 6264,
                "2024-01": 4002,
                "2024-02": 3828,
                "2024-03": 4524,
                "2024-04": 4350,
                "2024-05": 4640,
                "2024-06": 5916,
                "2024-07": 6380,
                "2024-08": 4725,
                "2024-09": 4536,
                "2024-10": 4914,
                "2024-11": 5481,
                "2024-12": 6804,
                "2025-01": 4347,
                "2025-02": 4158,
                "2025-03": 4914,
                "2025-04": 4725,
                "2025-05": 5040,
                "2025-06": 6426,
                "2025-07": 6930,
                "2025-08": 5100,
                "2025-09": 4896,
                "2025-10": 5304,
                "2025-11": 5916,
                "2025-12": 7344,
                "2026-01": 4692,
                "2026-02": 4488,
                "2026-03": 5304,
                "2026-04": 5100,
                "2026-05": 5440,
                "2026-06": 6936,
                "2026-07": 7480
              }
            },
            {
              "accountCode": "6900",
              "accountName": "Other Operating Expenses",
              "cantaraCode": "OPX-OTHER",
              "mappingMethod": "manual",
              "valuesByMonth": {
                "2023-08": 19035,
                "2023-09": 18273.6,
                "2023-10": 19796.4,
                "2023-11": 22080.6,
                "2023-12": 27410.4,
                "2024-01": 17512.2,
                "2024-02": 16750.8,
                "2024-03": 19796.4,
                "2024-04": 19035,
                "2024-05": 20304,
                "2024-06": 25887.6,
                "2024-07": 27918,
                "2024-08": 20367,
                "2024-09": 19552.32,
                "2024-10": 21181.68,
                "2024-11": 23625.72,
                "2024-12": 29328.48,
                "2025-01": 18737.64,
                "2025-02": 17922.96,
                "2025-03": 21181.68,
                "2025-04": 20367,
                "2025-05": 21724.8,
                "2025-06": 27699.12,
                "2025-07": 29871.6,
                "2025-08": 21927.75,
                "2025-09": 21050.64,
                "2025-10": 22804.86,
                "2025-11": 25436.19,
                "2025-12": 31575.96,
                "2026-01": 20173.53,
                "2026-02": 19296.42,
                "2026-03": 22804.86,
                "2026-04": 21927.75,
                "2026-05": 23389.6,
                "2026-06": 29821.74,
                "2026-07": 32160.7
              }
            }
          ]
        },
        "structuredModel": {
          "currency": "USD",
          "confidence": "HIGH",
          "businessName": "The Cactus Pet Resort",
          "periodCoverage": {
            "end": "2026-07",
            "start": "2023-08"
          }
        },
        "ttmSummary": {
          "endMonth": "2026-07",
          "netIncome": 392000,
          "totalCogs": 85000,
          "totalOpEx": 1223000,
          "startMonth": "2025-08",
          "grossProfit": 1615000,
          "totalRevenue": 1700000,
          "cogsByCategory": [
            {
              "code": "COGS-SUPPLY",
              "value": 85000,
              "category": "Direct pet-care supplies"
            }
          ],
          "grossMarginPct": 95,
          "opExByCategory": [
            {
              "code": "OPX-LABOR-STAFF",
              "value": 525890,
              "category": "Staff labor"
            },
            {
              "code": "OPX-RENT",
              "value": 220140,
              "category": "Rent"
            },
            {
              "code": "OPX-UTIL",
              "value": 61150,
              "category": "Utilities"
            },
            {
              "code": "OPX-INSUR",
              "value": 48920,
              "category": "Insurance"
            },
            {
              "code": "OPX-MKTG",
              "value": 48920,
              "category": "Marketing"
            },
            {
              "code": "OPX-OTHER",
              "value": 317980,
              "category": "Other operating expense"
            }
          ],
          "ebitdaMarginPct": 23.0588,
          "ebitdaPreRecast": 392000,
          "revenueByCategory": [
            {
              "code": "REV-BOARD",
              "value": 1020000,
              "category": "Boarding"
            },
            {
              "code": "REV-DAYCARE",
              "value": 440000,
              "category": "Daycare"
            },
            {
              "code": "REV-GROOM",
              "value": 240000,
              "category": "Grooming"
            }
          ]
        },
        "annualModel": {
          "years": [
            {
              "netIncome": 310000,
              "periodEnd": "2024-07",
              "totalCogs": 74000,
              "totalOpEx": 1066000,
              "fiscalYear": "FY2024",
              "grossProfit": 1376000,
              "periodStart": "2023-08",
              "totalRevenue": 1450000,
              "cogsByCategory": [
                {
                  "code": "COGS-SUPPLY",
                  "value": 74000,
                  "category": "Direct pet-care supplies"
                }
              ],
              "grossMarginPct": 94.89655172413794,
              "opExByCategory": [
                {
                  "code": "OPX-LABOR-STAFF",
                  "value": 458380,
                  "category": "Staff labor"
                },
                {
                  "code": "OPX-RENT",
                  "value": 191880,
                  "category": "Rent"
                },
                {
                  "code": "OPX-UTIL",
                  "value": 53300,
                  "category": "Utilities"
                },
                {
                  "code": "OPX-INSUR",
                  "value": 42640,
                  "category": "Insurance"
                },
                {
                  "code": "OPX-MKTG",
                  "value": 42640,
                  "category": "Marketing"
                },
                {
                  "code": "OPX-OTHER",
                  "value": 277160,
                  "category": "Other operating expense"
                }
              ],
              "ebitdaPreRecast": 310000,
              "revenueByCategory": [
                {
                  "code": "REV-BOARD",
                  "value": 870000,
                  "category": "Boarding"
                },
                {
                  "code": "REV-DAYCARE",
                  "value": 377000,
                  "category": "Daycare"
                },
                {
                  "code": "REV-GROOM",
                  "value": 203000,
                  "category": "Grooming"
                }
              ]
            },
            {
              "netIncome": 350000,
              "periodEnd": "2025-07",
              "totalCogs": 79000,
              "totalOpEx": 1141000,
              "fiscalYear": "FY2025",
              "grossProfit": 1491000,
              "periodStart": "2024-08",
              "totalRevenue": 1570000,
              "cogsByCategory": [
                {
                  "code": "COGS-SUPPLY",
                  "value": 79000,
                  "category": "Direct pet-care supplies"
                }
              ],
              "grossMarginPct": 94.96815286624204,
              "opExByCategory": [
                {
                  "code": "OPX-LABOR-STAFF",
                  "value": 490630,
                  "category": "Staff labor"
                },
                {
                  "code": "OPX-RENT",
                  "value": 205380,
                  "category": "Rent"
                },
                {
                  "code": "OPX-UTIL",
                  "value": 57050,
                  "category": "Utilities"
                },
                {
                  "code": "OPX-INSUR",
                  "value": 45640,
                  "category": "Insurance"
                },
                {
                  "code": "OPX-MKTG",
                  "value": 45640,
                  "category": "Marketing"
                },
                {
                  "code": "OPX-OTHER",
                  "value": 296660,
                  "category": "Other operating expense"
                }
              ],
              "ebitdaPreRecast": 350000,
              "revenueByCategory": [
                {
                  "code": "REV-BOARD",
                  "value": 942000,
                  "category": "Boarding"
                },
                {
                  "code": "REV-DAYCARE",
                  "value": 408000,
                  "category": "Daycare"
                },
                {
                  "code": "REV-GROOM",
                  "value": 220000,
                  "category": "Grooming"
                }
              ]
            },
            {
              "netIncome": 392000,
              "periodEnd": "2026-07",
              "totalCogs": 85000,
              "totalOpEx": 1223000,
              "fiscalYear": "FY2026",
              "grossProfit": 1615000,
              "periodStart": "2025-08",
              "totalRevenue": 1700000,
              "cogsByCategory": [
                {
                  "code": "COGS-SUPPLY",
                  "value": 85000,
                  "category": "Direct pet-care supplies"
                }
              ],
              "grossMarginPct": 95,
              "opExByCategory": [
                {
                  "code": "OPX-LABOR-STAFF",
                  "value": 525890,
                  "category": "Staff labor"
                },
                {
                  "code": "OPX-RENT",
                  "value": 220140,
                  "category": "Rent"
                },
                {
                  "code": "OPX-UTIL",
                  "value": 61150,
                  "category": "Utilities"
                },
                {
                  "code": "OPX-INSUR",
                  "value": 48920,
                  "category": "Insurance"
                },
                {
                  "code": "OPX-MKTG",
                  "value": 48920,
                  "category": "Marketing"
                },
                {
                  "code": "OPX-OTHER",
                  "value": 317980,
                  "category": "Other operating expense"
                }
              ],
              "ebitdaPreRecast": 392000,
              "revenueByCategory": [
                {
                  "code": "REV-BOARD",
                  "value": 1020000,
                  "category": "Boarding"
                },
                {
                  "code": "REV-DAYCARE",
                  "value": 440000,
                  "category": "Daycare"
                },
                {
                  "code": "REV-GROOM",
                  "value": 240000,
                  "category": "Grooming"
                }
              ]
            }
          ]
        },
        "workingCapital": {
          "month": "2026-07",
          "currentAssets": [
            {
              "code": "WC-CASH",
              "value": 185000,
              "category": "Cash"
            },
            {
              "code": "WC-AR",
              "value": 42000,
              "category": "Accounts receivable"
            },
            {
              "code": "WC-PREPAID",
              "value": 18000,
              "category": "Prepaids"
            }
          ],
          "netWorkingCapital": 41000,
          "currentLiabilities": [
            {
              "code": "WC-AP",
              "value": 54000,
              "category": "Accounts payable"
            },
            {
              "code": "WC-ACCR",
              "value": 62000,
              "category": "Accrued liabilities"
            },
            {
              "code": "WC-DREV",
              "value": 88000,
              "category": "Deferred revenue"
            }
          ],
          "totalCurrentAssets": 245000,
          "totalCurrentLiabilities": 204000,
          "trailingThreeMonthAverageNwc": 38500
        },
        "dataQualityReport": {
          "counts": {
            "A": 0,
            "B": 0,
            "C": 0,
            "D": 0,
            "E": 0
          },
          "summary": "Illustrative management data is internally consistent for demonstration.",
          "sections": {
            "A": {
              "items": []
            },
            "B": {
              "items": []
            },
            "C": {
              "items": []
            },
            "D": {
              "items": []
            },
            "E": {
              "items": []
            }
          }
        },
        "summary": {
          "overview": "TTM revenue is $1,700,000 with reported EBITDA of $392,000. Supported normalizing adjustments of $58,000 produce normalized EBITDA of $450,000 and a 26.5% margin.",
          "anomalyNotes": [
            "Lease transfer, UCC release, permits, and owner transition remain readiness items."
          ],
          "mappingNotes": [
            "Revenue is mapped across boarding, daycare, and grooming."
          ],
          "qualitySummary": "Complete illustrative 36-month model prepared for the demo engagement."
        },
        "errorMessage": null,
        "approvedAt": "2026-07-14T07:22:50.514Z",
        "approvedByName": "Cantara Demo Review Team",
        "createdAt": "2026-07-14T07:22:50.514Z",
        "updatedAt": "2026-07-14T07:22:50.514Z",
        "reportMarkdown": "# Valuation Report — The Cactus Pet Resort\n\n## Executive Conclusion\n\nTTM revenue is **$1,700,000**. Reported EBITDA of **$392,000** plus **$58,000** of supported normalizing adjustments produces **$450,000 normalized EBITDA**.\n\n| Scenario | Multiple | Enterprise Value |\n|---|---:|---:|\n| Low | 5.0x | $2,250,000 |\n| Midpoint | 6.0x | $2,700,000 |\n| High | 7.0x | $3,150,000 |\n\nThe $2.70 million midpoint is appropriate for planning, subject to confirmatory diligence and resolution of the lease, UCC, permit, and management-transition findings."
      }
    ],
    "Ws2RecastAnalysis": [
      {
        "id": "demo-cactus-recast-ui-ready",
        "clientId": "demo-cactus-pet-resort",
        "ttmAnalysisId": "demo-cactus-ttm-ui-ready",
        "version": 1,
        "status": "APPROVED",
        "hitlStatus": "APPROVED",
        "model": "demo-ui-ready",
        "temperature": 0,
        "maxTokens": 0,
        "assumptions": {
          "notes": "Demo valuation assumptions supplied by management.",
          "fmrEstimate": null,
          "multipleLow": 5,
          "multipleMid": 6,
          "multipleHigh": 7,
          "replacementSalary": 0,
          "relatedPartyOwnership": false
        },
        "reportMarkdown": "# EBITDA Recast — The Cactus Pet Resort\n\n## EBITDA RECAST SCHEDULE\n\n| # | Category | Item Description | GL Reference | LTM | FY3 | FY2 | FY1 | Status |\n|---|---|---|---|---:|---:|---:|---:|---|\n| 1 | Personal Expenses | Owner vehicle and discretionary travel | — | $21,000 | $21,000 | $18,000 | $16,000 | ACCEPTED |\n| 2 | One-Off Expenses | Kennel resurfacing project | — | $24,000 | $24,000 | $0 | $0 | ACCEPTED |\n| 3 | One-Off Expenses | Non-recurring legal and accounting work | — | $13,000 | $13,000 | $6,000 | $4,000 | ACCEPTED |\n\n**Total Add-Backs: $58,000**\n\n**Normalized EBITDA: $450,000**\n\n## VALUATION RANGE\n\n| Scenario | Multiple | Value |\n|---|---:|---:|\n| Low | 5.0x | $2,250,000 |\n| Mid | 6.0x | $2,700,000 |\n| High | 7.0x | $3,150,000 |\n\n## FLAG LIST FOR ADMIN REVIEW\n\nAll illustrative add-backs have been reviewed and accepted for the demo report.",
        "parsedReport": {
          "valuationLow": 2250000,
          "valuationMid": 2700000,
          "totalAddBacks": 58000,
          "valuationHigh": 3150000,
          "normalizedEbitda": 450000,
          "llmValuationResult": {
            "preRecast": {
              "LTM": 392000,
              "FY3": 392000,
              "FY2": 350000,
              "FY1": 310000
            },
            "normalizedEbitda": {
              "LTM": 450000,
              "FY3": 450000,
              "FY2": 374000,
              "FY1": 330000
            },
            "fourWallEbitda": {
              "LTM": 450000,
              "FY3": 450000,
              "FY2": 374000,
              "FY1": 330000
            },
            "valuation": {
              "LTM": { "low": 2250000, "mid": 2700000, "high": 3150000 },
              "FY3": { "low": 2250000, "mid": 2700000, "high": 3150000 },
              "FY2": { "low": 1870000, "mid": 2244000, "high": 2618000 },
              "FY1": { "low": 1650000, "mid": 1980000, "high": 2310000 }
            },
            "low": {
              "value": 2250000,
              "multiple": 5
            },
            "mid": {
              "value": 2700000,
              "multiple": 6
            },
            "high": {
              "value": 3150000,
              "multiple": 7
            }
          }
        },
        "workbookKey": null,
        "workbookUrl": null,
        "normalizedEbitda": 450000,
        "valuationLow": 2250000,
        "valuationMid": 2700000,
        "valuationHigh": 3150000,
        "errorMessage": null,
        "approvedAt": "2026-07-14T07:22:50.514Z",
        "approvedByName": "Cantara Demo Review Team",
        "createdAt": "2026-07-14T07:22:50.514Z",
        "updatedAt": "2026-07-14T07:22:50.514Z"
      }
    ],
    "Ws2DerivedReport": [
      {
        "id": "demo-cactus-derived-baseline",
        "clientId": "demo-cactus-pet-resort",
        "ttmAnalysisId": "demo-cactus-ttm-ui-ready",
        "recastAnalysisId": "demo-cactus-recast-ui-ready",
        "agentId": "ws2_10_report_generator_v1",
        "status": "COMPLETE",
        "reportMarkdown": "# Valuation Report — The Cactus Pet Resort\n\n## Executive Conclusion\n\nTTM revenue is **$1,700,000**. Reported EBITDA of **$392,000** plus **$58,000** of supported normalizing adjustments produces **$450,000 normalized EBITDA**.\n\n| Scenario | Multiple | Enterprise Value |\n|---|---:|---:|\n| Low | 5.0x | $2,250,000 |\n| Midpoint | 6.0x | $2,700,000 |\n| High | 7.0x | $3,150,000 |\n\nThe $2.70 million midpoint is appropriate for planning, subject to confirmatory diligence and resolution of the lease, UCC, permit, and management-transition findings.",
        "parsedReport": {
          "reportTitle": "The Cactus Pet Resort — Baseline Valuation Report",
          "executiveSummary": "$1.7M revenue, $450K normalized EBITDA, and a $2.70M midpoint enterprise value."
        },
        "errorMessage": null,
        "createdAt": "2026-07-14T07:22:50.514Z",
        "updatedAt": "2026-07-14T07:22:50.514Z"
      },
      {
        "id": "demo-cactus-derived-benchmark",
        "clientId": "demo-cactus-pet-resort",
        "ttmAnalysisId": "demo-cactus-ttm-ui-ready",
        "recastAnalysisId": "demo-cactus-recast-ui-ready",
        "agentId": "ws2_4_benchmark_v1",
        "status": "COMPLETE",
        "reportMarkdown": "# Expense Benchmarks\n\nProfitability is strong; pricing and daily capacity reporting are the primary improvement areas.",
        "parsedReport": {
          "benchmarks": [
            {
              "note": "Above illustrative range.",
              "actual": 0.2647,
              "status": "GREEN",
              "category": "Normalized EBITDA Margin",
              "benchmarkLow": 0.18,
              "benchmarkHigh": 0.25
            },
            {
              "note": "Within illustrative range.",
              "actual": 0.3114,
              "status": "GREEN",
              "category": "Labor as % of Revenue",
              "benchmarkLow": 0.3,
              "benchmarkHigh": 0.38
            },
            {
              "note": "Seasonal with weekday upside.",
              "actual": 0.66,
              "status": "YELLOW",
              "category": "Occupancy",
              "benchmarkLow": 0.65,
              "benchmarkHigh": 0.75
            }
          ],
          "overallHealth": "GREEN",
          "overallHealthNote": "Strong profitability with pricing and occupancy upside.",
          "improvementOpportunities": [
            "Phase market-supported price increases",
            "Improve daily capacity reporting"
          ]
        },
        "errorMessage": null,
        "createdAt": "2026-07-14T07:22:50.514Z",
        "updatedAt": "2026-07-14T07:22:50.514Z"
      },
      {
        "id": "demo-cactus-derived-labor",
        "clientId": "demo-cactus-pet-resort",
        "ttmAnalysisId": "demo-cactus-ttm-ui-ready",
        "recastAnalysisId": "demo-cactus-recast-ui-ready",
        "agentId": "ws2_5_labor_v1",
        "status": "COMPLETE",
        "reportMarkdown": "# Labor Analysis\n\nAnnualized payroll is $529,360, or 31.1% of revenue. Owner-dependency requires a transition plan.",
        "parsedReport": {
          "flags": [
            "Owner controls finance, pricing, and vendor relationships."
          ],
          "laborRows": [
            {
              "period": "TTM",
              "revenue": 1700000,
              "laborPct": 0.3114,
              "staffLabor": 529360,
              "totalLabor": 529360,
              "ownerCompensation": 0
            }
          ],
          "trendNote": "Labor productivity improved with revenue growth.",
          "benchmarkNote": "Labor is within the illustrative pet-resort range.",
          "directLaborPct": 0.3114,
          "benchmarkStatus": "GREEN",
          "trendAssessment": "GREEN",
          "ownerWeeklyHours": 32,
          "ownerInvolvementFlag": "RED",
          "buyerAdjustedLaborPct": 0.3114
        },
        "errorMessage": null,
        "createdAt": "2026-07-14T07:22:50.514Z",
        "updatedAt": "2026-07-14T07:22:50.514Z"
      },
      {
        "id": "demo-cactus-derived-revenue",
        "clientId": "demo-cactus-pet-resort",
        "ttmAnalysisId": "demo-cactus-ttm-ui-ready",
        "recastAnalysisId": "demo-cactus-recast-ui-ready",
        "agentId": "ws2_3_rev_vertical_v1",
        "status": "COMPLETE",
        "reportMarkdown": "# Revenue by Vertical\n\nBoarding represents 60.0% of TTM revenue, daycare 25.9%, and grooming 14.1%.",
        "parsedReport": {
          "verticals": [
            {
              "fy1": 870000,
              "fy2": 942000,
              "fy3": 1020000,
              "ttm": 1020000,
              "vertical": "Boarding",
              "growthPct": 8.3,
              "ttmMixPct": 60
            },
            {
              "fy1": 377000,
              "fy2": 408000,
              "fy3": 440000,
              "ttm": 440000,
              "vertical": "Daycare",
              "growthPct": 7.8,
              "ttmMixPct": 25.9
            },
            {
              "fy1": 203000,
              "fy2": 220000,
              "fy3": 240000,
              "ttm": 240000,
              "vertical": "Grooming",
              "growthPct": 9.1,
              "ttmMixPct": 14.1
            }
          ],
          "unmappedRevenue": [],
          "businessModelFlag": "Diversified single-site pet resort with boarding-led revenue.",
          "concentrationFlags": [],
          "boardingPlusDaycareConcentration": {
            "fy1": 0.86,
            "fy2": 0.86,
            "fy3": 0.859,
            "ttm": 0.859
          }
        },
        "errorMessage": null,
        "createdAt": "2026-07-14T07:22:50.514Z",
        "updatedAt": "2026-07-14T07:22:50.514Z"
      }
    ],
    "TtmFlag": [],
    "Ws2RecastFlag": [],
    "AgentDispatchTask": []
  }
};

const TABLE_ORDER = [
  "ClientDocumentStatus",
  "ClientWorkstreamAgent",
  "CompetitorAnalysis",
  "ContractAnalysis",
  "EmployeeObligationsReport",
  "LeaseAnalysis",
  "LegalEntitySearchReport",
  "OwnershipVerificationReport",
  "PermitsZoningReport",
  "TaxLiabilityReport",
  "CimReport",
  "TeaserReport",
  "TtmAnalysis",
  "TtmFlag",
  "Ws2RecastAnalysis",
  "Ws2RecastFlag",
  "Ws2DerivedReport",
  "AgentDispatchTask",
  "ClientDocument"
];

function getDatabaseUrl() {
  const argument = process.argv.find(value => value.startsWith('--database-url='));
  const raw = argument ? argument.slice('--database-url='.length) : process.env.DATABASE_URL;

  if (!raw) {
    throw new Error(
      'DATABASE_URL is required. Set it in the environment or pass --database-url=postgresql://...'
    );
  }

  const url = new URL(raw);
  // Prisma URLs often contain ?schema=public; node-postgres does not accept it.
  url.searchParams.delete('schema');
  return url.toString();
}

function quoteIdentifier(value) {
  return '"' + String(value).replaceAll('"', '""') + '"';
}

async function insertRow(db, table, row) {
  const columns = Object.keys(row);
  const columnSql = columns.map(quoteIdentifier).join(', ');
  const valuesSql = columns.map((_, index) => '$' + (index + 1)).join(', ');
  const values = columns.map(column => row[column]);

  await db.query(
    'INSERT INTO ' + quoteIdentifier(table) +
      ' (' + columnSql + ') VALUES (' + valuesSql + ')',
    values
  );
}

async function run() {
  const db = new Client({ connectionString: getDatabaseUrl() });
  await db.connect();

  try {
    await db.query('BEGIN');
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      'seed:demo-cactus-pet-resort',
    ]);
    await db.query('SET LOCAL search_path TO public');

    // Removing the profile cascades to every client-owned child row.
    await db.query(
      'DELETE FROM "ClientProfile" WHERE id=$1 OR "userId"=$2',
      [CLIENT_ID, USER_ID]
    );

    const user = { ...SNAPSHOT.user };
    const userColumns = Object.keys(user);
    const userUpdates = userColumns
      .filter(column => column !== 'id')
      .map(column => quoteIdentifier(column) + '=EXCLUDED.' + quoteIdentifier(column))
      .join(', ');

    await db.query(
      'INSERT INTO "User" (' + userColumns.map(quoteIdentifier).join(', ') + ')' +
        ' VALUES (' + userColumns.map((_, index) => '$' + (index + 1)).join(', ') + ')' +
        ' ON CONFLICT (id) DO UPDATE SET ' + userUpdates,
      userColumns.map(column => user[column])
    );

    await insertRow(db, 'ClientProfile', SNAPSHOT.profile);

    const inserted = {};
    for (const table of TABLE_ORDER) {
      const rows = SNAPSHOT.rows[table] || [];
      for (const row of rows) {
        await insertRow(db, table, row);
      }
      inserted[table] = rows.length;
    }

    const verification = await db.query(
      `SELECT
         length(COALESCE("sectionSubmissions"->'assessmentReport_ws1'->>'markdown', '')) AS ws1_assessment_chars,
         length(COALESCE("sectionSubmissions"->'assessmentReport_ws2'->>'markdown', '')) AS ws2_assessment_chars,
         length(COALESCE("sectionSubmissions"->'agentOverviewReports'->'both'->>'markdown', '')) AS overview_chars,
         jsonb_array_length("sectionSubmissions"->'agentOverviewReports'->'both'->'agents') AS overview_agents
       FROM "ClientProfile"
       WHERE id=$1`,
      [CLIENT_ID]
    );

    await db.query('COMMIT');

    console.log('Seeded The Cactus Pet Resort demo client successfully.');
    console.log(JSON.stringify({
      clientId: CLIENT_ID,
      inserted,
      verification: verification.rows[0],
    }, null, 2));
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }
}

run().catch(error => {
  console.error('Cactus demo seed failed:', error);
  process.exitCode = 1;
});

