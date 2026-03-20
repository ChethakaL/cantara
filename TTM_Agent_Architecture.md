# TTM Financial Structuring Agent — Architecture Specification
**Cantara Business Sale Readiness & M&A Advisory Portal**
*Developed by Babalilm AI FZ-LLC*
*Version 1.0*

---

## 1. Agent Overview

| Parameter | Value |
|---|---|
| **Agent Name** | TTM Financial Structuring Agent |
| **Agent ID** | `agent_ttm_v1` |
| **Workstream** | Pre-Workstream Financial Foundation |
| **Model** | `claude-sonnet-4-20250514` |
| **Temperature** | `0` |
| **Max Tokens** | `8000` |
| **HITL Gate** | Yes — mandatory before WS2-2 (EBITDA Recast Agent) runs |
| **Trigger** | Orchestrator dispatches after all required financial inputs are confirmed uploaded |

**Purpose:**
The TTM Financial Structuring Agent ingests the seller's raw financial data, normalizes it against Cantara's standardized GL taxonomy, builds a structured 36-month financial model, computes the Trailing Twelve Months (TTM) P&L, produces a 3-year annual P&L with trend indicators, extracts Working Capital components for the Seller Net Proceeds Calculator, and generates a comprehensive Data Quality Report for Craig's review before the EBITDA Recast Agent (WS2-2) runs.

**This agent does not perform add-backs, owner compensation normalization, or EBITDA recasting.** Those functions belong exclusively to WS2-2. This agent's sole mandate is structured data ingestion, normalization, and quality control.

---

## 2. Inputs

| Input | Format | Source | Required |
|---|---|---|---|
| Monthly P&L Excel | `.xlsx` — 36 months, GL codes opened | QB export or standalone report | **Required** |
| Monthly Balance Sheet Excel | `.xlsx` — 36 months, GL codes opened | QB export or standalone report | **Required** |
| Accountant-prepared financial statements | `.xlsx` or `.pdf` — 3 fiscal years | CPA / accountant | **Required** |
| AR Aging Detail | `.xlsx` — current aging snapshot | QB export or standalone report | **Required** |
| QuickBooks data | QB read-only API connection | QB Online (if granted) | Optional |

### Input Format Flexibility
The agent must handle two source variants without requiring pre-formatting by the seller:

**QuickBooks Export Format:**
- Rows = GL accounts with QB account codes
- Columns = months (typically labeled MMM-YYYY)
- Subtotals and section headers embedded in the row structure
- QB account hierarchy preserved (parent/child accounts)

**Standalone Report Format:**
- Rows = line items (may or may not include GL codes)
- Columns = months
- Variable header placement (month labels may appear in row 1, 2, or 3)
- May include merged cells, blank spacer rows, or custom groupings

The agent must detect which format is present and apply the appropriate parsing logic before proceeding to GL mapping.

---

## 3. Cantara Standardized GL Taxonomy

All GL codes from the seller's data must be mapped to Cantara's standardized categories before any financial computation runs. This taxonomy is the authoritative classification system for all downstream agents.

### Revenue Categories
| Cantara Code | Category | Typical QB Accounts |
|---|---|---|
| `REV-BOARD` | Boarding Revenue | Boarding, Overnight, Suite Boarding |
| `REV-DAY` | Daycare Revenue | Daycare, Dog Daycare, Half-Day |
| `REV-GROOM` | Grooming Revenue | Grooming, Bath & Brush, Full Groom |
| `REV-TRAIN` | Training Revenue | Training, Group Class, Private Training |
| `REV-RETAIL` | Retail Revenue | Retail, Merchandise, Food Sales |
| `REV-VET` | Veterinary / Add-On Services | Vet Services, Medication Admin, Health Check |
| `REV-OTHER` | Other / Miscellaneous Revenue | Miscellaneous Income, Other Revenue |

### Cost of Goods Sold
| Cantara Code | Category | Typical QB Accounts |
|---|---|---|
| `COGS-LABOR` | Direct Labor — Service Delivery | Pet Care Staff, Groomers, Trainers |
| `COGS-SUPPLY` | Direct Supplies | Grooming Supplies, Boarding Supplies, Food |
| `COGS-RETAIL` | Cost of Retail Goods Sold | Retail COGS, Merchandise Cost |

### Operating Expenses
| Cantara Code | Category | Typical QB Accounts |
|---|---|---|
| `OPX-RENT` | Rent & Occupancy | Rent, Base Rent, CAM Charges |
| `OPX-UTIL` | Utilities | Electric, Gas, Water, Internet, Phone |
| `OPX-LABOR-MGMT` | Management / Admin Labor | Manager Salary, Admin Wages, Office Staff |
| `OPX-LABOR-OWN` | Owner Compensation | Owner Draw, Owner Salary, Officer Compensation |
| `OPX-PAYROLL-TAX` | Payroll Taxes & Benefits | Payroll Tax, FICA, Health Insurance, 401k |
| `OPX-MKTG` | Marketing & Advertising | Google Ads, Facebook Ads, Marketing, Advertising |
| `OPX-INSUR` | Insurance | General Liability, Property Insurance, Workers Comp |
| `OPX-REPAIR` | Repairs & Maintenance | Repairs, Maintenance, Equipment Repair |
| `OPX-SOFT` | Software & Subscriptions | Software, SaaS, Subscriptions |
| `OPX-PROF` | Professional Fees | Accounting, Legal, Consulting |
| `OPX-BANK` | Bank Fees & Merchant Processing | Bank Fees, Credit Card Processing, Merchant Fees |
| `OPX-DEPR` | Depreciation & Amortization | Depreciation, Amortization |
| `OPX-OTHER` | Other Operating Expenses | Miscellaneous, Other Expenses |

### Balance Sheet — Working Capital Components
| Cantara Code | Category | Typical QB Accounts |
|---|---|---|
| `WC-AR` | Accounts Receivable | Accounts Receivable, Trade Receivables |
| `WC-INV` | Inventory | Inventory, Retail Inventory, Supplies Inventory |
| `WC-PREPAID` | Prepaid Expenses | Prepaid, Prepaid Insurance, Prepaid Rent |
| `WC-AP` | Accounts Payable | Accounts Payable, Trade Payables |
| `WC-ACCR` | Accrued Liabilities | Accrued Expenses, Accrued Wages, Accrued Liabilities |
| `WC-DREV` | Deferred Revenue | Deferred Revenue, Gift Cards, Prepaid Packages |

---

## 4. Processing Steps

### STEP 1 — Data Ingestion & Mapping

**1a. Format Detection**
- Detect whether each input file is a QB export or standalone report
- Identify header row location (month labels)
- Identify GL code column location (or account name column if codes absent)
- Strip QB hierarchy rows (parent account subtotals) — retain leaf-level accounts only
- Remove blank spacer rows and section header rows
- Log detected format for each file in the Data Quality Report

**1b. GL Code Mapping**
- Map every GL account in the P&L and Balance Sheet to a Cantara Taxonomy code
- Use fuzzy name matching for accounts without explicit GL codes
- Flag any account that cannot be confidently mapped to a Cantara code — these are **GL Classification Requests** held for Craig
- If a QB account maps to multiple Cantara codes (ambiguous), flag for Craig

**1c. Cross-Reference: QB vs. Excel**
- If QB API is connected: pull monthly revenue and major expense line totals
- Compare QB totals against seller Excel by month
- Flag any monthly line where the variance exceeds **$500 or 2% of the line total** (whichever is greater)
- Flag all discrepancies in the Data Quality Report with: month, GL line, Excel value, QB value, variance amount, variance %

**1d. Cross-Reference: Accountant Statements vs. Monthly P&L**
- Aggregate monthly P&L totals into annual totals for each of the 3 fiscal years
- Compare against accountant-prepared annual figures for: Total Revenue, Total COGS, Gross Profit, Total OpEx, Net Income
- Flag any annual variance exceeding **$1,000 or 1% of the line total** (whichever is greater)
- Flag all discrepancies in the Data Quality Report

**1e. Period Coverage Verification**
- Confirm 36 consecutive months are present with no gaps
- Flag any missing month
- Flag any month with zero values across all revenue lines (possible data omission vs. actual zero)
- Confirm fiscal year alignment between monthly data and accountant statements

---

### STEP 2 — TTM Build

Using the most recent 12 months in the dataset (months 25–36):

- **TTM Revenue** — sum by Cantara revenue category and total
- **TTM COGS** — sum by Cantara COGS category and total
- **TTM Gross Profit** — Revenue minus COGS
- **TTM Gross Margin %** — Gross Profit ÷ Revenue
- **TTM Operating Expenses** — sum by Cantara OpEx category and total
- **TTM EBITDA (pre-recast)** — Gross Profit minus OpEx (before add-backs — this is raw EBITDA, not recast)
- **TTM EBITDA Margin % (pre-recast)**

> **Important:** Label all TTM EBITDA figures as "pre-recast" in all outputs. The EBITDA Recast Agent (WS2-2) will apply add-backs to produce the adjusted/recast EBITDA figure.

---

### STEP 3 — 3-Year P&L Model

For each of the 3 full fiscal years in the dataset (FY1 = oldest, FY3 = most recent):

- **Annual Revenue** by Cantara category and total
- **Annual COGS** by Cantara category and total
- **Annual Gross Profit and Gross Margin %**
- **Annual Operating Expenses** by Cantara category and total
- **Annual EBITDA (pre-recast)**

**Year-over-Year Trend Indicators (FY1→FY2 and FY2→FY3):**
- Revenue YoY growth % (▲ / ▼)
- Gross Margin % change (▲ / ▼)
- EBITDA % change (▲ / ▼)
- OpEx as % of Revenue change by category

Flag trend anomalies for Craig's awareness (e.g., gross margin compression >3 points YoY, revenue decline >10% YoY, any OpEx category growing >15% YoY while revenue is flat or declining).

---

### STEP 4 — Working Capital (WC) Baseline

Extract from the most recent month-end Balance Sheet:

| WC Component | Cantara Code | Value |
|---|---|---|
| Accounts Receivable | `WC-AR` | $ |
| Inventory | `WC-INV` | $ |
| Prepaid Expenses | `WC-PREPAID` | $ |
| **Total Current Assets** | | **$** |
| Accounts Payable | `WC-AP` | $ |
| Accrued Liabilities | `WC-ACCR` | $ |
| Deferred Revenue | `WC-DREV` | $ |
| **Total Current Liabilities** | | **$** |
| **Net Working Capital** | | **$** |

Also extract the prior 3 month-end balance sheets and compute average NWC (3-month trailing average) — this smooths seasonal distortions and is the figure that feeds the Seller Net Proceeds Calculator.

**AR Aging Analysis (from AR Aging Detail input):**
- Total AR balance
- AR by aging bucket: Current, 1–30 days, 31–60 days, 61–90 days, 90+ days
- % of total AR in each bucket
- Flag if 90+ days exceeds **15% of total AR** — this is a Data Quality flag for Craig
- Flag if AR Aging total does not reconcile to Balance Sheet AR within **$500**

---

### STEP 5 — Data Quality Report

The Data Quality Report is the HITL gate output. WS2-2 (EBITDA Recast Agent) **cannot run** until Craig reviews and resolves all items in this report.

The report is organized into five sections:

**Section A — GL Classification Requests**
List every GL account that could not be auto-mapped to a Cantara taxonomy code.
For each: Account Name | QB Code (if present) | Monthly $ Range | Craig Action Required: [Assign Cantara Code]

**Section B — QB vs. Excel Discrepancies**
List every month/line variance exceeding the material threshold.
For each: Month | GL Line | Excel Value | QB Value | Variance $ | Variance % | Severity [High / Medium]

**Section C — Accountant Statement vs. Monthly P&L Discrepancies**
List every annual line variance exceeding the material threshold.
For each: Fiscal Year | Line Item | Monthly Rollup | Accountant Statement | Variance $ | Variance % | Severity

**Section D — Period & Coverage Issues**
- Missing months (if any)
- Zero-revenue months (flag for confirmation)
- Fiscal year misalignment between inputs

**Section E — AR Aging Flags**
- AR aging reconciliation to Balance Sheet
- 90+ day concentration flag (if triggered)
- Any single customer representing >20% of total AR (concentration risk)

---

## 5. Outputs

| Output | Destination | Consumer |
|---|---|---|
| Structured 36-Month Financial Model | Portal / Google Drive | EBITDA Recast Agent (WS2-2), Craig |
| TTM P&L Summary | Portal Dashboard | Craig, Client (post-HITL approval) |
| 3-Year Annual P&L with YoY Trend Indicators | Portal Dashboard | Craig, Client |
| WC Component Data | Passed to Seller Net Proceeds Calculator | Seller Net Proceeds Agent |
| Data Quality Flags List | Craig HITL Review Queue | Craig only — not visible to client |
| GL Classification Requests | Craig HITL Review Queue | Craig only |

---

## 6. HITL Gate Design

Upon completion of Step 5, the agent posts a **HITL Review Task** to Craig's portal dashboard.

The task contains:
- Summary count of flags by category (e.g., "3 GL Classification Requests, 2 QB Discrepancies, 1 AR Aging Flag")
- Full Data Quality Report (expandable)
- Action buttons per flag: **Resolve / Override / Escalate to Client**
- A single **"Approve & Release to WS2-2"** button — only enabled when all flags have a resolution action applied

The Orchestrator blocks the WS2-2 dispatch until the HITL task status = `approved`.

---

## 7. Downstream Dependencies

```
TTM Agent Output
    ├──► WS2-2 EBITDA Recast Agent (primary consumer — runs after HITL gate cleared)
    ├──► Seller Net Proceeds Calculator (WC_Calc component)
    └──► 3-Year Financial Recast Agent (M&A workstream — uses 36-month model as base)
```

---

## 8. Error Handling

| Condition | Agent Behavior |
|---|---|
| Missing required input file | Block processing; notify Craig via portal; do not proceed |
| Fewer than 24 months of data present | Proceed with available data; flag in Data Quality Report; downgrade TTM confidence |
| All 36 months present but one month is zero across all lines | Flag as probable missing data, not confirmed zero — escalate to Craig |
| GL mapping confidence < 70% for a major account | Flag as High Severity in Section A; do not auto-assign |
| QB API connection fails | Proceed without QB cross-reference; note in Data Quality Report |
| Accountant statements in PDF format | Extract data via document parsing; flag lower confidence on reconciliation |

---

## 9. Agent Configuration Block

```json
{
  "agent_id": "agent_ttm_v1",
  "agent_name": "TTM Financial Structuring Agent",
  "model": "claude-sonnet-4-20250514",
  "temperature": 0,
  "max_tokens": 8000,
  "hitl_required": true,
  "hitl_gate_blocks": ["agent_ebitda_recast_v1"],
  "inputs": [
    "monthly_pl_excel",
    "monthly_bs_excel",
    "accountant_statements",
    "ar_aging_detail",
    "quickbooks_api"
  ],
  "outputs": [
    "structured_36m_model",
    "ttm_pl_summary",
    "three_year_pl_trends",
    "wc_component_data",
    "data_quality_report",
    "gl_classification_requests"
  ],
  "downstream_agents": [
    "agent_ebitda_recast_v1",
    "agent_seller_net_proceeds_v1",
    "agent_3yr_recast_v1"
  ]
}
```

---

*TTM Financial Structuring Agent — Architecture Specification v1.0*
*Cantara Business Sale Readiness & M&A Advisory Portal*
*Developed by Babalilm AI FZ-LLC for Pollack Strategy Corp dba Cantara Pet Advisors*


<!-- Formulas -->
EBITDA = Gross Profit - OpEx + Depreciation