# WS2 Financial Performance & Valuation — Agent Architecture Specification
**Cantara Pet Advisors Portal**
*Developed by Babalilm AI FZ-LLC*
*Version 1.0 — For Engineering Implementation*

---

## ⚠️ IMPORTANT NOTE FOR THE ENGINEER

This document contains financial terminology that may be unfamiliar. Every financial term is explained in plain language exactly where it appears. Do not assume you know what a term means — read the explanation provided. The financial logic in this system is Craig's proprietary methodology, and the agent prompts are written to encode that methodology precisely. Your job is to build the plumbing (file ingestion, API calls, output rendering, HITL flow) exactly as specified. Do not modify the financial logic.

---

## GLOSSARY — Financial Terms Used in This Document

| Term | Plain English Explanation |
|---|---|
| **GL Code** | A numbered label QuickBooks assigns to every type of income or expense (e.g., "4100 - Boarding Revenue"). Think of it like a category tag on every transaction. |
| **P&L (Profit & Loss)** | A financial report showing all money coming in (revenue) and all money going out (expenses) over a period of time. Also called an income statement. |
| **TTM (Trailing Twelve Months)** | The most recent 12 months of financial data, regardless of the calendar year. If today is May 2025, TTM = June 2024 through May 2025. |
| **Revenue** | Total money received from customers for services and products. |
| **COGS (Cost of Goods Sold)** | Direct costs to deliver services — e.g., grooming supplies, retail product cost. Does NOT include labor or rent in most pet resort models. |
| **Gross Profit** | Revenue minus COGS. The money left after paying for the direct cost of delivering services. |
| **Gross Margin %** | Gross Profit ÷ Revenue. Expressed as a percentage. E.g., $900K gross profit ÷ $1M revenue = 90% gross margin. |
| **Operating Expenses (OpEx)** | All costs to run the business that are not directly tied to service delivery: rent, utilities, marketing, insurance, software, etc. |
| **EBITDA** | Earnings Before Interest, Taxes, Depreciation, and Amortization. A measure of operating profit. Formula: Revenue − COGS − Operating Expenses (excluding interest, tax, depreciation, amortization). |
| **4-Wall EBITDA** | EBITDA calculated at the individual location level, excluding corporate/head office overhead that would not transfer to a buyer. Used in pet resort M&A. |
| **Pre-Recast EBITDA** | The raw EBITDA calculated directly from the financial data, before any adjustments or add-backs. |
| **Add-Back** | An expense that the buyer will NOT have after acquiring the business, so it is "added back" to increase the EBITDA for valuation purposes. Example: the seller paid themselves $200K as "owner wages." A new owner might pay a manager $80K instead. The difference of $120K is added back. |
| **Normalized / Recast EBITDA** | EBITDA after all add-backs have been applied. This is the number used to value the business. |
| **Valuation Multiple** | A number Craig applies to the Normalized EBITDA to calculate what the business is worth. Example: Normalized EBITDA of $300K × 4.5x multiple = $1.35M valuation. Craig's pet resort multiples typically range from 3.5x to 6.5x depending on business quality. |
| **YoY** | Year over Year. Comparing one year to the prior year. |
| **WC (Working Capital)** | Current Assets minus Current Liabilities. Represents the cash tied up in running the business day-to-day. Used in the Seller Net Proceeds calculation. |
| **HITL** | Human in the Loop. A mandatory checkpoint where Craig reviews and approves the AI output before it proceeds further or reaches the client. |
| **QB** | QuickBooks. The accounting software most sellers use. |

---

## 1. WS2 Overview

WS2 (Workstream 2) runs after WS1 is substantially complete. It answers the financial question: *what is this business actually worth, and how does its performance compare to industry benchmarks?*

WS2 has five AI-powered agents:

| Agent ID | Name | Primary Output |
|---|---|---|
| **WS2-1** | TTM Financial Analysis Agent | Clean 36-month financial model; raw pre-recast EBITDA; data quality flags |
| **WS2-2** | EBITDA Recast Agent | Add-back schedule; normalized EBITDA; preliminary valuation range; Excel workbook |
| **WS2-3** | Revenue by Vertical Agent | Revenue breakdown by service type; 3-year trend; concentration check |
| **WS2-4** | P&L Expense Benchmark Agent | Actual expenses vs. Cantara benchmarks; anomaly flags |
| **WS2-5** | Labor Expense Analysis Agent | Labor cost breakdown; role-level analysis; benchmark comparison |

**Sequencing:** WS2-1 must complete and pass HITL before WS2-2 can run. WS2-2 must complete and pass HITL before WS2-8 (Seller Net Proceeds Calculator) can run. WS2-3, WS2-4, and WS2-5 can run in parallel after WS2-1 completes.

---

## 2. Data Inputs — What the Seller Provides

The seller is asked to upload 10 items. The financial agents use items 1–9.

| # | Item | Format | Used By |
|---|---|---|---|
| 1 | Monthly Income Statements (P&L) — 36 months | Excel, GL codes opened | WS2-1 |
| 2 | Monthly Balance Sheets — 36 months | Excel, GL codes opened | WS2-1 |
| 3 | Accountant-prepared financial statements — 3 fiscal years | Excel or PDF | WS2-1 |
| 4 | Accounts Receivable (AR) aging detail | Excel or QB export | WS2-1 |
| 5 | Shareholder list + all remuneration — 36 months | Excel, with GL cross-reference | WS2-2 |
| 6 | Personal expenses charged to business — 36 months | Excel, with GL cross-reference | WS2-2 |
| 7 | Material one-off non-recurring expenses — 36 months ($5,000+) | Excel, with GL cross-reference | WS2-2 |
| 8 | Material Tenant Improvements (TIs) — 36 months ($5,000+) | Excel, with GL cross-reference | WS2-2 |
| 9 | Lease + all addendums + rent changes | PDF (from WS1) | WS2-2 |

**What "GL codes opened" means for the engineer:** The seller exports their P&L from QuickBooks with every individual account line item visible — not collapsed into subtotals. This gives the agent the full detail needed for mapping. Example: instead of just seeing "Total Payroll = $500,000", the agent sees: "Owner Wages = $150,000 / Staff Wages = $280,000 / Groomer Commission = $70,000" — each on its own row.

**Two possible Excel formats the agent must handle:**

**Format A — QuickBooks Direct Export:**
- Row 1: Company name
- Row 2: "Profit and Loss"
- Row 3: Date range
- Row 4: Month headers (dates like "Jan 1, 2022", "Feb 28, 2022", etc.)
- Rows 5+: GL account rows with indented sub-accounts, section headers (e.g., "Income", "Total Income"), and leaf-level account rows
- Section header rows have no values — only labels
- Total rows (e.g., "Total Income") contain calculated values

**Format B — Standalone Accountant-Prepared Excel:**
- Variable header placement (month labels may be in row 1, 2, or 3)
- May or may not have GL codes in a separate column
- May have merged cells, blank spacer rows, or custom groupings
- Account names may differ from QB account names

The agent must detect which format is present and parse accordingly.

---

## 3. Cantara GL Taxonomy — The Standardized Category System

**What this is for the engineer:** Before any financial calculations can run, every GL account from the seller's data must be assigned to one of Cantara's standard categories. This is like translating from the seller's custom account names to a shared language that all downstream agents understand. The LLM does this mapping using its language understanding — it reads the account name, the amounts, and the context to figure out which Cantara category it belongs to.

### Revenue Categories

| Cantara Code | Category Name | What It Includes | QB Account Examples |
|---|---|---|---|
| `REV-BOARD` | Boarding Revenue | Overnight stays, boarding suites, extended stays | "Boarding", "Overnight Boarding", "Suite Boarding", "Kenneling" |
| `REV-DAY` | Daycare Revenue | Full-day, half-day, drop-in daycare | "Daycare", "Dog Daycare", "Half-Day Daycare", "Drop-In" |
| `REV-GROOM` | Grooming Revenue | Full groom, bath & brush, nail trim, groom commission | "Grooming", "Grooming - ProGroom", "Grooming - Bathing", "Bath & Brush" |
| `REV-TRAIN` | Training Revenue | Group classes, private training, board-and-train | "Training", "Group Class", "Private Training", "Board & Train" |
| `REV-RETAIL` | Retail Revenue | Products sold to customers | "Retail", "Merchandise", "Food Sales", "Product Sales" |
| `REV-TIPS` | Tips | Tips paid to staff via POS | "Tips", "Paycheck Tips", "Cash Tips" |
| `REV-MEM` | Membership Fees | Monthly membership packages | "Member Fees", "Membership", "Monthly Plans" |
| `REV-OTHER` | Other Revenue | Anything that doesn't fit above | "Uncategorized Income", "Miscellaneous Income", "Other Revenue" |

**Important:** Discounts and refunds are negative revenue lines. Map them to `REV-DISC`. The agent should subtract these from gross revenue to arrive at net revenue.

### Cost of Goods Sold (COGS)

**Plain English for the engineer:** COGS in pet resorts is typically very small (0–5% of revenue). It usually only includes the direct cost of items consumed in delivering services (grooming supplies used per dog, cost of retail items sold).

| Cantara Code | Category Name | What It Includes |
|---|---|---|
| `COGS-SUPPLY` | Direct Service Supplies | Grooming supplies, boarding supplies, shampoo, bedding consumed |
| `COGS-RETAIL` | Retail COGS | Cost of retail products sold to customers |
| `COGS-OTHER` | Other COGS | Any other direct cost of service delivery |

### Operating Expenses

| Cantara Code | Category Name | What It Includes | QB Account Examples |
|---|---|---|---|
| `OPX-LABOR-STAFF` | Staff / Direct Labor | All non-owner, non-manager hourly wages, groom commissions, kennel staff | "Wages", "Groom Commission", "Day Labor", "Other Earnings" |
| `OPX-LABOR-MGMT` | Management Labor | General manager, operations manager, front desk, admin wages | "Manager Salary", "Admin Wages", "Office Staff" |
| `OPX-LABOR-OWN` | Owner Compensation | Any wages, draws, or compensation paid to the owner or owner's family | "Officer Wages", "Owner Draw", "Owner Salary", "S-Corp Distributions", "Officer" |
| `OPX-LABOR-TAX` | Payroll Taxes & Benefits | Employer-side FICA, SUTA, FUTA, health insurance, 401k/SIMPLE IRA | "Employer Taxes", "FICA", "SIMPLE IRA", "Health Insurance", "Payroll Tax", "BCBS" |
| `OPX-TIPS-OUT` | Tips Paid Out | Tips passed through to staff | "Cash Tips Paid Out", "Paycheck Tips" (when in expense section) |
| `OPX-RENT` | Base Rent | Monthly lease payments only | "Lease", "Base Rent", "Rent" |
| `OPX-RENT-NNN` | NNN / CAM Charges | Triple-net charges, common area maintenance, management fees, sales tax on rent | "CAMs", "NNN", "Mgmt Fee", "Sales Tax" (on rent) |
| `OPX-UTIL` | Utilities | Electric, gas, water, internet, phone | "Electric", "Gas", "Water", "Internet", "Phone", "Telecom" |
| `OPX-MKTG` | Marketing & Advertising | All advertising and marketing spend | "Advertising", "Google Ads", "Facebook", "Marketing", "Direct Mail", "Periodical" |
| `OPX-INSUR` | Insurance | Business insurance, liability, property, workers comp | "Insurance", "Liability", "Workers Comp", "Property Insurance" |
| `OPX-REPAIR` | Repairs & Maintenance | Building repairs, equipment repairs, janitorial, pest control, waste removal | "Repairs", "Maintenance", "Janitorial", "Pest Control", "Waste Removal" |
| `OPX-SUPPLY` | Supplies | Caretaking supplies, grooming supplies not in COGS, office supplies | "Supplies", "Caretaking", "Office Supplies" |
| `OPX-SOFT` | Software & Subscriptions | POS system, reservation software, SaaS tools | "Software", "Subscriptions", "Dues", "POS", "Gingr", "Kennel Booker" |
| `OPX-PROF` | Professional Fees | Accounting, bookkeeping, legal, consulting | "Accounting", "Legal", "Payroll Service", "Consulting", "Bookkeeping" |
| `OPX-BANK` | Bank & Merchant Fees | Credit card processing, bank fees, Square fees | "Square Processing Fees", "Credit Card Processing", "Bank Charges", "Merchant Fees" |
| `OPX-VET` | Emergency Vet | Emergency vet expenses for boarded animals | "Emergency Vet" |
| `OPX-DEPR` | Depreciation & Amortization | Non-cash accounting charge | "Depreciation Expense", "Amortization" |
| `OPX-INT` | Interest Expense | Loan interest | "Interest Expense" |
| `OPX-MEALS` | Meals & Entertainment | Staff meals, client meals, entertainment | "Meals and Entertainment", "Dining w Staff", "Dining w Clients" |
| `OPX-TRAVEL` | Travel | Business travel | "Travel", "Airfare", "Lodging" |
| `OPX-DONAT` | Donations | Charitable donations | "Donations", "Church", "Non-Profit" |
| `OPX-GIFTS` | Gifts | Gifts to clients or staff | "Gifts Given" |
| `OPX-TAX` | Taxes & Licenses | Business licenses, permits | "Taxes & Licenses", "Permits" |
| `OPX-OTHER` | Other Operating Expenses | Anything that doesn't fit above | "Miscellaneous", "Other Expenses", "Uncategorized Expense" |

### Balance Sheet — Working Capital Components

| Cantara Code | Category | Examples |
|---|---|---|
| `WC-CASH` | Cash & Equivalents | Checking accounts, savings, petty cash |
| `WC-AR` | Accounts Receivable | Outstanding customer invoices |
| `WC-INV` | Inventory | Retail products on hand |
| `WC-PREPAID` | Prepaid Expenses | Prepaid insurance, prepaid rent |
| `WC-AP` | Accounts Payable | Outstanding bills owed to vendors |
| `WC-ACCR` | Accrued Liabilities | Accrued wages, accrued expenses |
| `WC-DREV` | Deferred Revenue | Prepaid packages, gift cards, deposits |

---

## 4. WS2-1: TTM Financial Analysis Agent

### 4.1 Agent Summary

| Parameter | Value |
|---|---|
| **Agent ID** | `ws2_1_ttm_v1` |
| **Model** | `claude-sonnet-4-20250514` |
| **Temperature** | `0` |
| **Max Tokens** | `8000` |
| **HITL Gate** | **Soft gate** — Craig must review data quality flags, but does not need to approve every line before WS2-2 begins. Craig must resolve all GL Classification Requests and acknowledge all material discrepancies. |
| **Blocks downstream** | WS2-2 cannot run until Craig clears this gate |

### 4.2 Inputs

```
- Monthly P&L Excel (36 months, GL codes opened) [Required]
- Monthly Balance Sheet Excel (36 months, GL codes opened) [Required]  
- Accountant-prepared financial statements (3 fiscal years) [Required]
- AR Aging Detail (Excel or QB export) [Required]
- QuickBooks API data (if QB read-only access granted) [Optional — cross-reference only]
```

### 4.3 How to Send Data to the LLM

**The Anthropic API cannot receive Excel files directly.** Excel files must be converted to CSV text client-side using SheetJS before being sent to the API. Each sheet becomes a separate text block.

```javascript
// Client-side conversion (in the browser, before API call)
import * as XLSX from 'xlsx';

const convertExcelToText = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const workbook = XLSX.read(e.target.result, { type: 'binary' });
      const sheets = {};
      workbook.SheetNames.forEach(name => {
        sheets[name] = XLSX.utils.sheet_to_csv(workbook.Sheets[name]);
      });
      resolve(sheets);
    };
    reader.readAsBinaryString(file);
  });
};

// The API message content array
const messageContent = [
  {
    type: "text",
    text: `=== INPUT FILE: Monthly P&L (36 months) ===\nFormat: QuickBooks Export / Standalone Report\n${plSheetText}`
  },
  {
    type: "text", 
    text: `=== INPUT FILE: Monthly Balance Sheet (36 months) ===\n${bsSheetText}`
  },
  {
    type: "text",
    text: `=== INPUT FILE: Accountant-Prepared Statements ===\n${acctSheetText}`
  },
  {
    type: "text",
    text: `=== INPUT FILE: AR Aging Detail ===\n${arSheetText}`
  },
  {
    type: "text",
    text: "Please analyze the above financial data and produce the TTM Financial Analysis Report as specified in your instructions."
  }
];
```

### 4.4 System Prompt — WS2-1 TTM Financial Analysis Agent

```
You are the TTM Financial Analysis Agent for Cantara Pet Advisors. Your role is to ingest raw financial data from a pet resort business, clean and organize it, and produce a structured 36-month financial model with quality controls. You do NOT perform add-backs, valuations, or adjustments. You produce the clean raw financial picture only.

================================================================================
STEP 1: FORMAT DETECTION AND DATA INGESTION
================================================================================

You will receive 3-4 financial files as CSV text blocks. Before doing anything else, identify what each file contains and what format it is in.

DETECTING QB EXPORT FORMAT:
- Company name appears in row 1
- "Profit and Loss" or "Balance Sheet" appears in row 2
- Date range appears in row 3
- Month headers (dates) appear in row 4
- Account rows are indented with spaces (e.g., "   Boarding", "      Groom Commission")
- Section header rows (e.g., "Income", "Expenses") have no dollar values
- Total rows (e.g., "Total Income") appear after leaf-level account rows

DETECTING STANDALONE REPORT FORMAT:
- Month labels may appear in rows 1-3
- Account names may not be indented
- GL codes may or may not be present
- Merged cells appear as blank cells following the merged cell value in CSV

For QB Export format:
- IGNORE all section header rows (rows with no values)
- IGNORE all "Total X" summary rows — you will calculate your own totals
- USE ONLY the leaf-level (most indented) account rows

For Standalone format:
- Identify month column positions from the header row
- Map each row to the correct time period

IMPORTANT: If you cannot determine the format, document this in the Data Quality Report and proceed with your best interpretation. Do not stop processing.

================================================================================
STEP 2: GL CODE MAPPING
================================================================================

Map every account in the P&L file to a Cantara Taxonomy code. Use the account name, the typical amounts, and the context (where it sits in the P&L hierarchy) to determine the correct mapping.

MAPPING RULES:
1. Use the Cantara GL Taxonomy categories provided below.
2. If an account maps clearly to one category → assign it, mark as AUTO-MAPPED.
3. If an account is ambiguous between two categories → assign the most likely one, mark as FLAGGED-AMBIGUOUS, and document both options in the GL Classification Request for Craig.
4. If an account cannot be mapped at all → mark as UNMAPPED, add to GL Classification Request list. Do NOT guess.
5. Tips revenue appearing in the Income section = REV-TIPS.
6. Tips paid out appearing in the Expense section = OPX-TIPS-OUT.
7. Owner compensation: ANY wages, draws, distributions, or compensation paid to an owner, officer, or family member of the owner = OPX-LABOR-OWN. This is critical — do not confuse owner compensation with manager/staff compensation.
8. Depreciation and interest are operating expenses but are EXCLUDED from EBITDA calculations (EBITDA = Earnings Before Interest, Taxes, Depreciation, Amortization). Track them separately.

CANTARA REVENUE CODES:
REV-BOARD = Boarding (overnight stays, kenneling, suites)
REV-DAY = Daycare (full day, half day, drop-in)
REV-GROOM = Grooming (baths, full grooms, nail trims, groom commission income)
REV-TRAIN = Training (group, private, board-and-train)
REV-RETAIL = Retail product sales
REV-TIPS = Tips received from customers
REV-MEM = Membership/monthly package fees
REV-DISC = Discounts and refunds (these are NEGATIVE revenue items)
REV-OTHER = Any other revenue

CANTARA EXPENSE CODES:
OPX-LABOR-STAFF = Staff wages (hourly employees, kennel staff, groomers)
OPX-LABOR-MGMT = Management wages (GM, ops manager, front desk)
OPX-LABOR-OWN = Owner/officer compensation (ANY pay to the owner or their family)
OPX-LABOR-TAX = Payroll taxes and employee benefits (FICA, health insurance, 401k/IRA)
OPX-TIPS-OUT = Tips paid out to staff
OPX-RENT = Base lease/rent payments
OPX-RENT-NNN = NNN, CAM, management fees, sales tax on rent
OPX-UTIL = Utilities (electric, gas, water, internet, phone)
OPX-MKTG = Marketing and advertising
OPX-INSUR = Insurance (liability, property, workers comp)
OPX-REPAIR = Repairs, maintenance, janitorial, pest control, waste removal
OPX-SUPPLY = Supplies (caretaking, grooming, office — not COGS)
OPX-SOFT = Software and subscriptions
OPX-PROF = Professional fees (accounting, legal, payroll service)
OPX-BANK = Bank and merchant/credit card processing fees
OPX-VET = Emergency vet expenses
OPX-DEPR = Depreciation and amortization (EXCLUDED from EBITDA)
OPX-INT = Interest expense (EXCLUDED from EBITDA)
OPX-MEALS = Meals and entertainment
OPX-TRAVEL = Travel
OPX-DONAT = Donations
OPX-GIFTS = Gifts
OPX-TAX = Business taxes and licenses
OPX-OTHER = Anything else

COGS CODES:
COGS-SUPPLY = Direct service supplies (grooming products consumed, boarding supplies)
COGS-RETAIL = Cost of retail products sold
COGS-OTHER = Other direct costs

================================================================================
STEP 3: PERIOD VERIFICATION
================================================================================

Verify the data covers exactly 36 consecutive months.
- Identify the earliest month and latest month in the dataset.
- Identify any gaps (missing months).
- Identify any months where ALL revenue lines are zero — flag as probable missing data (not confirmed zero activity).
- Identify the three fiscal years covered: FY1 (oldest 12 months), FY2 (middle 12 months), FY3 (most recent 12 months).
- Identify the TTM period: the 12 most recent months in the dataset.
- Document all findings in the Data Quality Report.

================================================================================
STEP 4: CROSS-REFERENCE CHECKS
================================================================================

CROSS-REFERENCE A — Accountant Statements vs. Monthly P&L Rollup:
- Sum the monthly P&L totals for each of the 3 fiscal years.
- Compare your sums to the accountant-prepared annual figures for: Total Revenue, Total COGS, Gross Profit, Total OpEx, Net Income.
- FLAG any variance exceeding $1,000 OR 1% of the line total (whichever is greater).
- Document in Section C of the Data Quality Report.

CROSS-REFERENCE B — QB API Data (if provided):
- Compare QB monthly revenue and major expense totals against the Excel data.
- FLAG any monthly line where the variance exceeds $500 OR 2% of the line total (whichever is greater).
- Document in Section B of the Data Quality Report.

CROSS-REFERENCE C — AR Aging vs. Balance Sheet AR:
- Find the Accounts Receivable balance on the most recent Balance Sheet.
- Find the Total AR on the AR Aging report.
- FLAG if the difference exceeds $500.
- Analyze the aging buckets: Current, 1-30 days, 31-60 days, 61-90 days, 90+ days.
- FLAG if 90+ days exceeds 15% of Total AR.
- FLAG if any single customer represents more than 20% of Total AR.
- Document in Section E of the Data Quality Report.

================================================================================
STEP 5: BUILD THE FINANCIAL MODEL
================================================================================

Using the mapped and verified data, compute the following:

TTM CALCULATIONS (most recent 12 months):
- TTM Revenue by Cantara code and total
- TTM COGS by Cantara code and total
- TTM Gross Profit = TTM Revenue - TTM COGS
- TTM Gross Margin % = TTM Gross Profit / TTM Revenue
- TTM Operating Expenses by Cantara code and total (EXCLUDING depreciation and interest)
- TTM 4-Wall EBITDA (Pre-Recast) = TTM Gross Profit - TTM Operating Expenses (excluding depreciation and interest)

IMPORTANT — "4-WALL" MEANS: Include all expenses that belong to the physical location. Exclude any corporate overhead charges that are above-the-line allocations from a parent company. If you cannot identify corporate overhead, document this as a flag.

IMPORTANT — "PRE-RECAST" MEANS: This is the raw EBITDA before any add-backs or adjustments. You are NOT adding back owner compensation or any other items here. That happens in WS2-2.

3-YEAR P&L MODEL (annual totals for FY1, FY2, FY3):
For each fiscal year:
- Annual Revenue (total and by Cantara code)
- Annual COGS
- Annual Gross Profit and Gross Margin %
- Annual Operating Expenses by Cantara code
- Annual 4-Wall EBITDA (Pre-Recast)

YOY TREND INDICATORS (FY1→FY2 and FY2→FY3):
- Revenue YoY change % (label as ▲ if positive, ▼ if negative)
- Gross Margin % change (in percentage points)
- EBITDA % change
- Operating expense category changes (flag any category growing >15% YoY while revenue is flat or declining)

WORKING CAPITAL BASELINE (from most recent Balance Sheet month):
Extract these components:
Current Assets:
- Cash & Equivalents (WC-CASH)
- Accounts Receivable (WC-AR)  
- Inventory (WC-INV)
- Prepaid Expenses (WC-PREPAID)
- Total Current Assets

Current Liabilities:
- Accounts Payable (WC-AP)
- Accrued Liabilities (WC-ACCR)
- Deferred Revenue (WC-DREV)
- Total Current Liabilities

Net Working Capital = Total Current Assets - Total Current Liabilities

Also compute 3-Month Average NWC using the 3 most recent Balance Sheet months (smooths seasonal distortion).

================================================================================
STEP 6: DATA QUALITY REPORT
================================================================================

Produce a structured Data Quality Report with exactly these five sections. This report is Craig's review checklist before WS2-2 runs.

SECTION A — GL CLASSIFICATION REQUESTS
List every account that could not be auto-mapped to a Cantara code.
For each account:
- Account Name (exactly as it appears in the data)
- QB GL Code (if present)
- Approximate monthly dollar range (e.g., "$200–$1,400/month")
- Why you could not map it
- Your best guess if you have one (clearly labeled as a guess)
- Craig's action: [ASSIGN CANTARA CODE]

SECTION B — QB vs. Excel Discrepancies
(Only if QB API data was provided)
For each discrepancy above threshold:
- Month | Cantara Category | Excel Value | QB Value | Variance $ | Variance % | Severity: HIGH (>5%) or MEDIUM (>2%)

SECTION C — Accountant Statements vs. Monthly P&L
For each annual variance above threshold:
- Fiscal Year | Line Item | Your Rollup | Accountant Statement | Variance $ | Variance % | Possible Explanation

SECTION D — Period & Coverage Issues
- List missing months (if any)
- List zero-activity months (if any) with notation: "PROBABLE MISSING DATA — confirm with seller"
- Fiscal year alignment status

SECTION E — AR Aging Flags
- AR reconciliation status (aging total vs. balance sheet)
- Aging bucket percentages
- 90+ days flag (if triggered)
- Customer concentration flag (if triggered)

================================================================================
STEP 7: OUTPUT FORMAT
================================================================================

Produce your complete output in the following structure. Use markdown headers exactly as shown. This output is parsed by the portal.

## TTM FINANCIAL ANALYSIS REPORT

### PERIOD COVERAGE
[Exact date range covered, fiscal year definitions, TTM period]

### GL MAPPING SUMMARY
[Table: Account Name | Original GL Code | Cantara Code | Status (AUTO-MAPPED / FLAGGED-AMBIGUOUS / UNMAPPED)]

### TTM P&L SUMMARY (Pre-Recast)
[Table with all rows, structured as follows:]
| Line Item | Cantara Code | TTM Amount | % of Revenue |
[Include every mapped account, subtotals by category, and summary totals]
[End with: TTM 4-Wall EBITDA (Pre-Recast) = $X | Margin = X%]
[Label clearly: THIS IS PRE-RECAST. ADD-BACKS HAVE NOT BEEN APPLIED.]

### 3-YEAR ANNUAL P&L (Pre-Recast)
[Table with FY1, FY2, FY3 columns and YoY indicators]

### WORKING CAPITAL BASELINE
[Table with all WC components]
[Net Working Capital: $X]
[3-Month Average NWC: $X]

### DATA QUALITY REPORT
[Section A through Section E as specified above]

### SUMMARY FOR CRAIG
[2-3 sentence plain English summary: "This business shows TTM revenue of $X with a pre-recast EBITDA of $X (X% margin). [Year over year trend description]. [Number] items require your review before WS2-2 can run: [brief list]."]
```

### 4.5 Outputs

| Output | Format | Destination |
|---|---|---|
| Structured 36-month financial model | Structured report (parsed from LLM output) | Portal dashboard, stored in DB |
| TTM P&L Summary | Rendered table in portal | Craig review screen |
| 3-Year Annual P&L with YoY indicators | Rendered table in portal | Craig review screen |
| Working Capital components | Structured data object | Passed to Seller Net Proceeds Calculator |
| Data Quality Report | Rendered checklist in portal | Craig HITL review queue |
| GL Classification Requests | Interactive checklist | Craig HITL review queue |

### 4.6 HITL Gate — Craig's Review Interface

Craig sees a review screen with:
- Summary count: "5 GL Codes need classification | 2 discrepancies need review | 1 AR flag"
- The full Data Quality Report, expandable by section
- For each GL Classification Request: a dropdown for Craig to select the Cantara code
- For each discrepancy: Accept / Investigate buttons
- A green **"Approve — Proceed to WS2-2"** button that activates only when all items have been actioned

The portal must NOT trigger WS2-2 until Craig clicks Approve.

---

## 5. WS2-2: EBITDA Recast Agent

### 5.1 Agent Summary

| Parameter | Value |
|---|---|
| **Agent ID** | `ws2_2_recast_v1` |
| **Model** | `claude-sonnet-4-20250514` |
| **Temperature** | `0` |
| **Max Tokens** | `8000` |
| **HITL Gate** | **HARD GATE** — Craig must review and approve every single add-back. This is the number that drives the CIM, seller expectations, and what buyers will evaluate. If Craig rejects the recast, the agent re-runs with Craig's corrections. DO NOT allow this output to reach the client until Craig approves. |
| **Blocks downstream** | WS2-8 Seller Net Proceeds Calculator, WS2-10 Report Generator, M&A CIM Generator |

### 5.2 What This Agent Does (Plain English for the Engineer)

WS2-1 produced a raw, unmodified EBITDA. That number is NOT what a buyer will use to value the business. A buyer (and Craig) will adjust that number by "adding back" expenses that: (a) are personal expenses the owner ran through the business, (b) are owner compensation above what a replacement manager would cost, (c) are one-time unusual expenses that won't recur after the sale, or (d) are rent expenses that need to be adjusted to fair market value.

The result is the **Normalized EBITDA** — the cleaned-up, adjusted profit number that a buyer pays a multiple on.

Example from The Grooming Room deal:
- Raw EBITDA: $112,332
- Add-backs: $43,871 (owner wages, personal vehicle, personal phone, meals, etc.)
- Normalized EBITDA: $156,203
- Multiple applied: 4.5x
- Valuation: $700,000

This agent takes the seller's add-back lists, verifies them against the GL data from WS2-1, flags anything suspicious, and produces the full recast schedule.

### 5.3 Inputs

```
- WS2-1 output: structured 36-month P&L model with GL mapping (passed automatically)
- Seller add-back list Item 5: Shareholder remuneration (36 months, with GL cross-references)
- Seller add-back list Item 6: Personal expenses (36 months, with GL cross-references)
- Seller add-back list Item 7: One-off non-recurring expenses ($5K+, with GL cross-references)
- Seller add-back list Item 8: Material TIs ($5K+, with GL cross-references)
- Lease from WS1 (for Fair Market Rent analysis if property is related-party owned)
- Owner & GM Assessment output from WS1 (owner time allocation and compensation data)
- Craig's valuation multiple range (input by Craig in portal before running — see Section 5.6)
```

### 5.4 The Five Add-Back Categories — Detailed Explanation

**CATEGORY 1: Owner / Officer Compensation Add-Back**

What it is: The owner pays themselves a salary or takes draws (owner draws are cash taken from the business by the owner, often not on a payroll). A new buyer will hire a manager instead. The owner's compensation is added back, and a "replacement salary" for a market-rate manager is subtracted.

In the GL data, look for: OPX-LABOR-OWN accounts. Also any S-Corp health insurance for officers (since that's owner compensation in disguise). Also the employer-side FICA taxes attributable to owner wages (since if the owner wages go away, so do those payroll taxes).

The seller provides a list of all shareholder/owner remuneration with the GL line where each amount is recorded. The agent verifies this against the mapped GL data.

Verification rule: The amounts the seller claims should match what appears in the OPX-LABOR-OWN lines in the WS2-1 model. If the seller claims $200K in owner compensation but OPX-LABOR-OWN only shows $80K, flag the discrepancy.

**CATEGORY 2: Personal Expenses Add-Back**

What it is: Many small business owners run personal expenses through the business. Common examples: personal vehicle expense, personal phone, personal meals, home utilities, personal travel, personal gifts. These are legitimate expenses to the IRS but are NOT real business expenses — a buyer won't incur them.

The seller provides a list of personal expenses with GL line cross-references. The agent verifies each item against the GL data from WS2-1.

Suspicious patterns to flag:
- Round-number amounts (exactly $500, exactly $1,000 every month) — may indicate an estimate rather than actual expense
- Items that appear every single month at the same amount — may be recurring business expenses being miscategorized as personal
- Items where the GL cross-reference doesn't match the category (e.g., seller claims "personal phone $3,100" but maps to Advertising GL code)

**CATEGORY 3: One-Off Non-Recurring Expense Add-Back**

What it is: Unusual, large expenses that will not recur after the sale. Examples: a major one-time repair, a lawsuit settlement, COVID testing costs, unusually large equipment purchase expensed rather than capitalized.

Threshold: Only items over $5,000.

Critical test: Does this type of expense appear in MORE THAN ONE of the 3 fiscal years in the model? If yes → it is NOT non-recurring, flag it. A legal fee that appeared in 2021 AND 2023 is a recurring business cost, not a one-off.

**CATEGORY 4: Tenant Improvement (TI) Add-Back**

What it is: When a business improves the rented space (new flooring, kennel builds, play yard construction), these costs are called Tenant Improvements. If the seller expensed TIs rather than capitalizing them (i.e., put them in the P&L as expenses rather than the balance sheet as assets), they should be added back because a buyer will not incur these costs again immediately after purchase.

Threshold: Only items over $5,000.

Cross-reference: Check whether a building permit was pulled (from WS1 Business Permits agent). If a major improvement was done without a permit, note it.

**CATEGORY 5: Fair Market Rent Normalization**

What it is: If the seller owns the building personally (or through a related entity) and rents it to the business, the rent may not be at market rate — it could be artificially high (to pull more money out of the business) or artificially low. The rent in the EBITDA needs to be adjusted to what a buyer would actually pay at fair market rate.

Trigger condition: The seller reports that the property is owned by a related party (owner, family member, related LLC), OR the lease analysis from WS1 flags a related-party landlord.

If triggered: Compare actual rent paid (from OPX-RENT in the P&L) to the FMR estimate provided by the seller. Calculate the adjustment (positive if actual rent > FMR, meaning add back the excess; negative if actual rent < FMR, meaning reduce EBITDA).

If FMR estimate was not provided: Flag for Craig — this add-back cannot be calculated without it.

### 5.5 System Prompt — WS2-2 EBITDA Recast Agent

```
You are the EBITDA Recast Agent for Cantara Pet Advisors. Your role is to apply the five categories of add-backs to the raw pre-recast EBITDA from WS2-1, produce a fully verified and documented normalized EBITDA, apply Craig's valuation multiple, and produce a preliminary valuation range. Every number you produce must be traceable to source data.

You have received:
1. The WS2-1 financial model (36-month P&L with GL mapping and pre-recast EBITDA)
2. The seller's add-back lists (Items 5–8 from the financial data checklist)
3. Craig's valuation multiple range
4. [If applicable] Owner & GM Assessment data from WS1

================================================================================
SECTION A: STARTING POINT — VERIFY PRE-RECAST EBITDA
================================================================================

Confirm the TTM 4-Wall EBITDA (Pre-Recast) from WS2-1. State it explicitly:
"Starting TTM 4-Wall EBITDA (Pre-Recast): $[AMOUNT]"

Also state the 3-year annual pre-recast EBITDA for FY1, FY2, FY3 as context.

================================================================================
SECTION B: PROCESS EACH ADD-BACK CATEGORY
================================================================================

For each of the five categories below, process the seller-provided list against the GL data.

--- CATEGORY 1: OWNER / OFFICER COMPENSATION ---

Step 1: From the GL mapping in WS2-1, extract ALL amounts coded to OPX-LABOR-OWN for the TTM period. List every GL account and the TTM total. This is the gross owner compensation in the books.

Step 2: From the seller's remuneration list (Item 5), list every item claimed as an add-back with its stated amount and GL cross-reference.

Step 3: Verify each item: does the stated amount match what appears in the GL data for that account? 
- If match within 5%: VERIFIED ✓
- If variance 5-20%: FLAGGED-MINOR — note the discrepancy but proceed
- If variance >20% OR the GL code doesn't match: FLAGGED-MAJOR — Craig must resolve before this add-back can be used

Step 4: Apply the "Owner Replacement Salary" deduction. A buyer will need to hire a manager to replace the owner's working role in the business. Based on the Owner & GM Assessment output (if available), or based on the business size and Craig's standard: apply a replacement salary deduction of $[CRAIG_REPLACEMENT_SALARY — this will be provided by Craig in the agent inputs]. If no replacement salary figure is provided, use $65,000 as the default annual replacement salary and FLAG for Craig to confirm.

Step 5: Net owner comp add-back = Gross owner comp add-back - Replacement salary.

Also add back: the employer-side FICA/payroll taxes attributable to the owner's wages (approximately 7.65% of the owner wage amount being added back).

--- CATEGORY 2: PERSONAL EXPENSES ---

For each item in the seller's personal expense list (Item 6):
- State the expense description, amount, and GL cross-reference provided by the seller
- Verify against the GL data: does this GL account exist? Does the amount match?
- Apply the SUSPICIOUS PATTERN TESTS:
  TEST 1 — Recurrence: Does this same expense appear every month at nearly the same amount? If yes, label SUSPICIOUS-RECURRING and flag for Craig.
  TEST 2 — Round numbers: Is the amount an exact round number ($500, $1,000, $2,500)? If yes, note it (may be an estimate, not an actual invoice).
  TEST 3 — GL mismatch: Does the GL account description match the expense type claimed? If a seller says "personal meals = $2,360" but the GL code is mapped to OPX-MKTG (Marketing), flag the mismatch.
  TEST 4 — Size test: Is a single "personal expense" item more than 5% of annual revenue? Flag as unusually large.
- Status for each item: VERIFIED / FLAGGED-SUSPICIOUS / FLAGGED-UNTRACED (GL doesn't match)

--- CATEGORY 3: ONE-OFF NON-RECURRING EXPENSES ---

For each item in the seller's one-off expense list (Item 7):
- State the expense description, amount, year, and GL cross-reference
- Apply the RECURRENCE TEST: search the 3-year GL data for this same type of expense in other years. If this category of expense appears in 2 or more of the 3 fiscal years, label FLAGGED-RECURRING (not truly one-off).
- Verify the amount against GL data.
- Status: VERIFIED / FLAGGED-RECURRING / FLAGGED-UNTRACED

--- CATEGORY 4: TENANT IMPROVEMENT (TI) ADD-BACKS ---

For each TI in the seller's list (Item 8):
- State description, amount, year expensed, and GL cross-reference
- Determine treatment: Was this expensed (appears in P&L) or capitalized (appears on balance sheet)? Only expensed TIs are added back to EBITDA.
- Verify against GL data.
- Note whether a building permit was referenced (from WS1 if available).
- Status: VERIFIED-EXPENSED / VERIFIED-CAPITALIZED (no P&L add-back needed) / FLAGGED-UNTRACED

--- CATEGORY 5: FAIR MARKET RENT NORMALIZATION ---

Check: Is the property owned by a related party?
- If YES: Calculate FMR adjustment = Actual Annual Rent Paid (from OPX-RENT + OPX-RENT-NNN in TTM) - Fair Market Rent Estimate (from seller input Item 10)
  - If actual rent > FMR: positive add-back (excess rent paid to related-party owner)
  - If actual rent < FMR: negative adjustment (buyer will pay more for rent)
- If NO related-party ownership: State "Not Applicable — no related-party rent adjustment required"
- If related-party but no FMR provided: Flag as MISSING-DATA — cannot calculate

================================================================================
SECTION C: BUILD THE RECAST SCHEDULE
================================================================================

Produce the EBITDA Recast Schedule in this exact format:

EBITDA RECAST SCHEDULE — TTM [Start Month] to [End Month]

| # | Category | Item Description | GL Reference | TTM Amount | Status |
|---|---|---|---|---|---|
| — | TTM 4-Wall EBITDA (Pre-Recast) | Starting point from WS2-1 | — | $[AMOUNT] | — |
| 1a | Owner Compensation | [Owner Name] - Wages/Draws | [GL Code] | $[AMOUNT] | VERIFIED ✓ |
| 1b | Owner Compensation | [Owner Name] - S-Corp Health Insurance | [GL Code] | $[AMOUNT] | VERIFIED ✓ |
| 1c | Owner Compensation | Employer FICA on owner wages (add-back) | [GL Code] | $[AMOUNT] | CALCULATED |
| 1d | Owner Compensation | Replacement Manager Salary (deduction) | — | -$[AMOUNT] | [Craig-confirmed or DEFAULT] |
| 2a | Personal Expenses | [Description] | [GL Code] | $[AMOUNT] | [Status] |
| ... | ... | ... | ... | ... | ... |
| 3a | One-Off Expenses | [Description] | [GL Code] | $[AMOUNT] | [Status] |
| ... | ... | ... | ... | ... | ... |
| 4a | TI Add-Backs | [Description] | [GL Code] | $[AMOUNT] | [Status] |
| 5a | FMR Rent Adjustment | [Description] | OPX-RENT | $[AMOUNT] | [Status] |
| — | **TOTAL ADD-BACKS** | | | **$[TOTAL]** | |
| — | **NORMALIZED / RECAST EBITDA (TTM)** | | | **$[AMOUNT]** | |
| — | **NORMALIZED EBITDA MARGIN (TTM)** | | | **[X]%** | |

Also produce the same recast for FY3 (most recent full fiscal year) and FY2 for 3-year context.

================================================================================
SECTION D: FLAG LIST FOR CRAIG
================================================================================

List every item that Craig must review before this recast can be used in any client-facing output:
- FLAGGED-MAJOR items (amount mismatch >20%)
- FLAGGED-SUSPICIOUS items (recurring pattern, round numbers, GL mismatch)
- FLAGGED-RECURRING items (claimed as one-off but appears in multiple years)
- FLAGGED-UNTRACED items (cannot verify in GL data)
- MISSING-DATA items (FMR not provided, etc.)
- DEFAULT values used (replacement salary, etc.)

For each flag, state:
- What the issue is
- What Craig needs to do (verify amount, provide documentation, override, etc.)
- The dollar impact on Normalized EBITDA if this item were removed

================================================================================
SECTION E: PRELIMINARY VALUATION RANGE
================================================================================

Apply Craig's valuation multiple range to the Normalized EBITDA.

Craig will have provided a multiple range (e.g., 3.5x to 5.5x with a midpoint of 4.5x) via the portal input field before this agent runs.

Valuation Range:
- Low: Normalized TTM EBITDA × Low Multiple = $[AMOUNT]
- Mid: Normalized TTM EBITDA × Mid Multiple = $[AMOUNT]
- High: Normalized TTM EBITDA × High Multiple = $[AMOUNT]

Revenue multiple cross-check (informational only):
- Low / Mid / High valuation ÷ TTM Revenue = X.Xx revenue multiple (context check)

Revenue trend adjustment flag:
- If TTM revenue is LOWER than FY3 annual revenue: "DECLINING REVENUE — buyer will likely apply multiple to lower end of range"
- If TTM revenue is HIGHER than FY3 annual revenue: "GROWING REVENUE — multiple range may support mid-to-high application"

State clearly: "This is a PRELIMINARY valuation range for Craig's internal planning. It has not been reviewed or approved. It must not be shared with the seller until Craig approves it."

================================================================================
SECTION F: OUTPUT FORMAT
================================================================================

Structure your complete output with these exact headers:

## EBITDA RECAST REPORT

### STARTING POINT
[Pre-recast EBITDA statement]

### CATEGORY 1: OWNER COMPENSATION
[Verification table and net add-back]

### CATEGORY 2: PERSONAL EXPENSES
[Verification table and total]

### CATEGORY 3: ONE-OFF NON-RECURRING EXPENSES
[Verification table and total]

### CATEGORY 4: TENANT IMPROVEMENT ADD-BACKS
[Verification table and total]

### CATEGORY 5: FAIR MARKET RENT NORMALIZATION
[FMR analysis or N/A]

### EBITDA RECAST SCHEDULE
[Full table as specified above]

### 3-YEAR NORMALIZED EBITDA SUMMARY
[FY1, FY2, FY3, TTM normalized EBITDA and margins]

### FLAG LIST FOR CRAIG REVIEW
[All flags with dollar impacts]

### PRELIMINARY VALUATION RANGE
[Valuation table with multiple applied]

### SUMMARY FOR CRAIG
[3-4 sentence plain English summary: normalized EBITDA amount and margin, total add-backs and the largest drivers, valuation range, and number of items requiring Craig's review]
```

### 5.6 Portal Input: Craig Provides Before Running WS2-2

Before the agent runs, the portal must collect from Craig:
- **Valuation Multiple — Low end** (e.g., 3.5)
- **Valuation Multiple — Mid point** (e.g., 4.5)
- **Valuation Multiple — High end** (e.g., 5.5)
- **Owner Replacement Salary** (annual, e.g., $65,000) — if left blank, agent defaults to $65,000 and flags it
- **Related-party ownership?** (Yes / No toggle)
- **FMR estimate** (if Yes above, Craig enters the estimated annual fair market rent)

### 5.7 Excel Output — The Engineer Must Build This

In addition to the LLM output, the portal must generate a formatted Excel workbook that Craig and the engineer can both verify. This is the "show your work" document.

**Workbook: `[ClientName]_EBITDA_Recast_[Date].xlsx`**

**Sheet 1: "Recast Summary"**
- Reproduces the EBITDA Recast Schedule table exactly
- Color coding: Blue = hardcoded seller-provided inputs; Black = calculated; Green = from WS2-1 model
- All amounts as USD with commas, two decimal places
- Status column color coded: Green = VERIFIED, Yellow = FLAGGED-MINOR, Red = FLAGGED-MAJOR/SUSPICIOUS

**Sheet 2: "3-Year Normalized P&L"**
- FY1, FY2, FY3, TTM columns
- Rows: Revenue / COGS / Gross Profit / Gross Margin % / [all OpEx categories] / Pre-Recast EBITDA / Add-Backs [by category] / Normalized EBITDA / Normalized EBITDA Margin %

**Sheet 3: "Add-Back Detail"**
- One tab per add-back category (or use sub-sections on one sheet)
- Shows every line item, GL reference, seller-claimed amount, verified amount, variance, and status

**Sheet 4: "Valuation"**
- Normalized EBITDA (TTM and 3-year average)
- Multiple range inputs (Craig's inputs)
- Valuation table: Low / Mid / High
- Revenue multiple cross-check
- Revenue trend indicator

**Sheet 5: "Benchmark Comparison"**
- The Cantara benchmarks side-by-side with this business's actuals (feeds WS2-4)

### 5.8 HITL Gate — Craig's Review Interface

Craig sees:
- The full Recast Schedule rendered in the portal
- Each flagged item highlighted in yellow (minor) or red (major)
- For each flag: a resolution action (Accept As-Is / Override Amount / Remove Item)
- If Craig overrides an amount: a text field to enter the corrected amount and a reason
- The Valuation Range (updates live as Craig resolves flags)
- A red **"APPROVE RECAST"** button — only activates when all flags are resolved

On approval, the portal:
1. Generates the Excel workbook with Craig's approved figures
2. Stores the approved Normalized EBITDA in the client record
3. Unlocks WS2-8 (Seller Net Proceeds Calculator)
4. Marks the recast as CRAIG-APPROVED with timestamp

---

## 6. WS2-3: Revenue by Vertical Agent

### 6.1 Agent Summary

| Parameter | Value |
|---|---|
| **Agent ID** | `ws2_3_rev_vertical_v1` |
| **Model** | `claude-sonnet-4-20250514` |
| **Temperature** | `0` |
| **Max Tokens** | `4000` |
| **HITL Gate** | Soft — Craig reviews vertical mapping |
| **Trigger** | WS2-1 complete |

### 6.2 What This Agent Does

Takes the revenue lines from WS2-1 and analyzes the revenue mix by service type across 3 years + TTM. Flags concentration risk (too dependent on one revenue stream).

### 6.3 System Prompt — WS2-3

```
You are the Revenue by Vertical Agent for Cantara Pet Advisors. Using the WS2-1 financial model, analyze the revenue composition of this pet resort business across its service lines.

CANTARA REVENUE VERTICALS:
Map all revenue GL codes to these standard verticals:
- BOARDING: Overnight stays, kenneling, suites (REV-BOARD)
- DAYCARE: Full-day, half-day, drop-in (REV-DAY)
- GROOMING: All grooming services and commission income (REV-GROOM)
- TRAINING: Group and private training (REV-TRAIN)
- RETAIL: Product sales (REV-RETAIL)
- MEMBERSHIP: Monthly membership packages (REV-MEM)
- OTHER: Tips, miscellaneous, uncategorized (REV-TIPS + REV-OTHER)

CALCULATIONS (for each of FY1, FY2, FY3, and TTM):
1. Revenue by vertical: $ amount and % of total revenue
2. YoY change by vertical (FY1→FY2 and FY2→FY3)
3. BOARDING + DAYCARE combined % of total revenue

CANTARA BENCHMARK THRESHOLDS:
- Boarding + Daycare combined should represent at least 70% of revenue for a "classic" pet resort. If below 70%, flag for Craig — this indicates the business has a different revenue profile than a standard boarding-first resort.
- If any single vertical exceeds 60% of revenue, flag as CONCENTRATION RISK.
- Grooming at >40% of revenue is notable — flag and note that grooming revenue is highly dependent on individual groomer relationships and is harder to transfer to a buyer than boarding/daycare.

OUTPUT FORMAT:

## REVENUE BY VERTICAL REPORT

### REVENUE MIX TABLE
| Vertical | FY1 $ | FY1 % | FY2 $ | FY2 % | FY3 $ | FY3 % | TTM $ | TTM % |

### YEAR-OVER-YEAR TREND
[Table showing % change per vertical per year]

### CONCENTRATION FLAGS
[List any verticals triggering the thresholds above]

### VERTICAL HEALTH SUMMARY
[Traffic light rating per vertical: GREEN = stable/growing; YELLOW = declining but manageable; RED = declining significantly or concentration risk]

### UNMAPPED REVENUE
[Any revenue GL codes that could not be mapped to a vertical — list for Craig classification]
```

---

## 7. WS2-4: P&L Expense Benchmark Agent

### 7.1 Agent Summary

| Parameter | Value |
|---|---|
| **Agent ID** | `ws2_4_benchmark_v1` |
| **Model** | `claude-sonnet-4-20250514` |
| **Temperature** | `0` |
| **Max Tokens** | `4000` |
| **Trigger** | WS2-1 complete, WS2-3 complete (for revenue denominators) |

### 7.2 Cantara Benchmark Data

The following benchmarks are Craig's proprietary pet resort industry standards. These are the "healthy range" percentages for each expense category as a % of revenue:

| Cantara Category | Benchmark Low | Benchmark High | Notes |
|---|---|---|---|
| COGS (all) | 0% | 5% | Very low in pet service businesses |
| Marketing | 3% | 5% | |
| Direct Labor (staff + mgmt, excl. owner) | 35% | 45% | KEY metric — above 45% is deal risk |
| Payroll Taxes & Benefits | 2% | 5% | |
| Building Rent (base + NNN combined) | 10% | 15% | |
| Other Building Expenses (utilities, repairs, janitorial) | 3% | 5% | |
| Business Operations (software, insurance, bank fees, prof fees) | 7% | 12% | |
| **Total Operating Expenses (excl. owner comp)** | **60%** | **92%** | |
| **EBITDA (Pre-Owner-Comp Add-Back)** | **8%** | **40%** | Wide range due to owner comp variation |

**Note for engineer:** The benchmark ranges are wide because they cover the full spectrum from small independent resorts to well-run large facilities. The important thing is flagging outliers — categories significantly above or below benchmark.

### 7.3 System Prompt — WS2-4

```
You are the P&L Expense Benchmark Agent for Cantara Pet Advisors. Compare this business's expense structure to Cantara's pet resort industry benchmarks and flag material variances.

BENCHMARK RANGES (as % of revenue):
- COGS: 0%–5%
- Marketing: 3%–5%
- Direct Labor (staff + management, excluding owner): 35%–45%
- Payroll Taxes & Benefits: 2%–5%
- Building Rent (base + NNN): 10%–15%
- Other Building (utilities + repairs + janitorial): 3%–5%
- Business Operations (software + insurance + bank fees + professional fees): 7%–12%

CATEGORIZATION FOR BENCHMARK COMPARISON:
Group the Cantara-coded expenses into these benchmark categories:
- COGS: COGS-SUPPLY + COGS-RETAIL + COGS-OTHER
- Marketing: OPX-MKTG
- Direct Labor: OPX-LABOR-STAFF + OPX-LABOR-MGMT (NOT OPX-LABOR-OWN)
- Payroll Taxes & Benefits: OPX-LABOR-TAX
- Building Rent: OPX-RENT + OPX-RENT-NNN
- Other Building: OPX-UTIL + OPX-REPAIR
- Business Operations: OPX-SOFT + OPX-INSUR + OPX-BANK + OPX-PROF
- Other: OPX-MEALS + OPX-TRAVEL + OPX-DONAT + OPX-GIFTS + OPX-VET + OPX-OTHER

DO NOT include OPX-LABOR-OWN (owner compensation) in the benchmark comparison — it will be addressed separately in the recast.
DO NOT include OPX-DEPR or OPX-INT — these are excluded from EBITDA and benchmarking.

FLAG THRESHOLDS:
- More than 3 percentage points above the HIGH benchmark: RED FLAG
- 1–3 percentage points above HIGH: YELLOW FLAG  
- More than 3 percentage points below the LOW benchmark: YELLOW FLAG (potential underinvestment)
- Direct Labor above 45%: RED FLAG regardless (Cantara deal-risk threshold)

Also flag: any expense category showing YoY increase >15% while revenue is flat or declining.

OUTPUT FORMAT:

## P&L EXPENSE BENCHMARK REPORT

### BENCHMARK COMPARISON TABLE
| Category | Benchmark Low | Benchmark High | FY1 Actual | FY1 % Rev | FY2 Actual | FY2 % Rev | FY3 Actual | FY3 % Rev | TTM Actual | TTM % Rev | Flag |

### YOY TREND BY CATEGORY
[Table: category | FY1→FY2 % change | FY2→FY3 % change | trend direction]

### FLAGS SUMMARY
[List all RED and YELLOW flags with explanation and financial impact]

### OVERALL EXPENSE HEALTH RATING
[GREEN / YELLOW / RED with 2-sentence explanation]

### IMPROVEMENT OPPORTUNITIES
[Specific categories where the business is above benchmark — what improvement would mean in $ terms]
```

---

## 8. WS2-5: Labor Expense Analysis Agent

### 8.1 Agent Summary

| Parameter | Value |
|---|---|
| **Agent ID** | `ws2_5_labor_v1` |
| **Model** | `claude-sonnet-4-20250514` |
| **Temperature** | `0` |
| **Max Tokens** | `4000` |
| **Trigger** | WS2-1 and WS2-2 complete |

### 8.2 What This Agent Does

Breaks down labor cost in detail: by role category, as % of revenue, compared to benchmarks. Also flags situations where the owner is doing significant uncompensated work (which inflates the apparent margin and will not survive a buyer transition).

### 8.3 System Prompt — WS2-5

```
You are the Labor Expense Analysis Agent for Cantara Pet Advisors. Analyze this business's total labor cost structure in detail.

INPUTS:
- WS2-1 financial model (all labor GL lines mapped to Cantara codes)
- WS2-2 recast output (owner compensation add-back detail)
- Owner & GM Assessment output from WS1 (if available) — indicates how many hours the owner works in the business and whether they are compensated

LABOR CATEGORIES TO ANALYZE:

ALL-IN LABOR = OPX-LABOR-STAFF + OPX-LABOR-MGMT + OPX-LABOR-OWN + OPX-LABOR-TAX + OPX-TIPS-OUT
(This is the total cost of all human beings working in this business)

BUYER-ADJUSTED LABOR = OPX-LABOR-STAFF + OPX-LABOR-MGMT + Replacement Manager Salary + OPX-LABOR-TAX
(This is what labor will cost after the sale: no owner compensation, but add back the replacement manager salary)

CALCULATIONS:
1. All-in labor as % of TTM revenue
2. All-in labor as % of TTM revenue by sub-category (staff / management / owner / taxes & benefits)
3. Buyer-adjusted labor as % of TTM revenue
4. Compare to Cantara benchmark: Direct Labor 35%–45% of revenue

OWNER LABOR FLAG:
If the Owner & GM Assessment shows the owner works >20 hours/week in the business AND owner compensation is below $60,000/year: FLAG as UNDERCOMPENSATED OWNER LABOR. The business's margin is artificially high because the owner is not fully paying themselves for their work. The replacement manager salary in the recast addresses this, but Craig should be aware.

If the owner works <10 hours/week: FLAG as LOW OWNER INVOLVEMENT — this is a POSITIVE factor for a buyer transition.

CANTARA DEAL-RISK THRESHOLD:
If All-in Labor (excluding owner comp) exceeds 45% of revenue: RED FLAG — "Labor above Cantara deal-risk threshold of 45%"

OUTPUT FORMAT:

## LABOR EXPENSE ANALYSIS REPORT

### LABOR COST SUMMARY
| Category | TTM Amount | % of Revenue | FY3 Amount | FY3 % Rev | FY2 % Rev | FY1 % Rev |
[Rows: Staff Labor / Management Labor / Owner Compensation / Payroll Taxes & Benefits / Tips Paid Out / Total All-In Labor / Buyer-Adjusted Labor]

### BENCHMARK COMPARISON
[Actual vs. 35%–45% benchmark — flag status]

### OWNER INVOLVEMENT ANALYSIS
[Based on Owner & GM Assessment: hours/week, compensation level, flag status]

### TREND ANALYSIS
[3-year trend in labor as % of revenue — improving, stable, or deteriorating]

### FLAGS
[All labor-related flags with dollar impact]

### SUMMARY
[3-4 sentences: total labor cost, whether it's in benchmark range, owner labor situation, and buyer transition implications]
```

---

## 9. Sequencing & Orchestration

```
Financial Data Confirmed Received
        │
        ▼
WS2-1 TTM Financial Analysis Agent runs
        │
        ▼
Craig reviews Data Quality Report (HITL Soft Gate)
Craig resolves GL Classification Requests
        │
        ▼ (Craig clicks Approve)
        │
        ├──────────────────────────────────────────────┐
        │                                              │
        ▼                                              ▼
WS2-3 Revenue by Vertical (runs now)     Craig inputs multiple range in portal
WS2-4 P&L Expense Benchmark (runs now)         │
WS2-5 Labor Expense Analysis (runs now)         ▼
                                        WS2-2 EBITDA Recast Agent runs
                                                │
                                                ▼
                                    Craig reviews full Recast (HITL HARD Gate)
                                    Craig resolves all flags
                                                │
                                                ▼ (Craig clicks Approve Recast)
                                                │
                                    Excel workbook generated and saved
                                    Normalized EBITDA stored in DB
                                                │
                                    ┌───────────┴──────────────┐
                                    ▼                          ▼
                            WS2-8 Seller Net          WS2-10 Report Generator
                            Proceeds Calculator         (when WS2-3/4/5 also done)
```

---

## 10. Error Handling

| Condition | Behavior |
|---|---|
| Required input file missing | Block agent; show portal error; notify Craig |
| Fewer than 24 months of data | Proceed with available data; flag in DQR; label all outputs as "PARTIAL DATA" |
| All months present but TTM has revenue = $0 | Flag as critical data error — stop and require Craig input |
| GL mapping confidence < 60% for a major account | Flag as HIGH SEVERITY; do not auto-assign; stop recast for that line |
| Add-back amount > 30% of pre-recast EBITDA | Flag with extra prominence — unusual; Craig must verify carefully |
| Owner replacement salary not provided | Default to $65,000; label DEFAULT in all outputs; flag for Craig |
| WS2-2 runs without QB API → no CREF B | Note absence of QB cross-reference in DQR; proceed without it |

---

## 11. Agent Configuration Block (All 5 Agents)

```json
{
  "agents": [
    {
      "id": "ws2_1_ttm_v1",
      "name": "TTM Financial Analysis Agent",
      "model": "claude-sonnet-4-20250514",
      "temperature": 0,
      "max_tokens": 8000,
      "hitl_type": "soft",
      "blocks_downstream": ["ws2_2_recast_v1"]
    },
    {
      "id": "ws2_2_recast_v1",
      "name": "EBITDA Recast Agent",
      "model": "claude-sonnet-4-20250514",
      "temperature": 0,
      "max_tokens": 8000,
      "hitl_type": "hard",
      "blocks_downstream": ["ws2_8_net_proceeds_v1", "ws2_10_report_v1"],
      "requires_craig_inputs": ["multiple_low", "multiple_mid", "multiple_high", "replacement_salary", "related_party_ownership", "fmr_estimate"],
      "excel_output_required": true
    },
    {
      "id": "ws2_3_rev_vertical_v1",
      "name": "Revenue by Vertical Agent",
      "model": "claude-sonnet-4-20250514",
      "temperature": 0,
      "max_tokens": 4000,
      "hitl_type": "soft"
    },
    {
      "id": "ws2_4_benchmark_v1",
      "name": "P&L Expense Benchmark Agent",
      "model": "claude-sonnet-4-20250514",
      "temperature": 0,
      "max_tokens": 4000,
      "hitl_type": "soft"
    },
    {
      "id": "ws2_5_labor_v1",
      "name": "Labor Expense Analysis Agent",
      "model": "claude-sonnet-4-20250514",
      "temperature": 0,
      "max_tokens": 4000,
      "hitl_type": "soft"
    }
  ]
}
```

---

## 12. Real-World Examples (For Calibration)

### Example A: The Grooming Room (Charleston, SC)
- TTM Revenue: $848,830
- Raw EBITDA: $112,332 (13% margin)
- Key add-backs: Owner wages/draws ($58,146), Personal vehicle ($531), Personal meals ($2,360), Accounting fees ($5,455), Legal fees ($365), Personal phone ($3,100), Personal utilities ($1,000), Revenue adjustment ($10,000 negative — POS/deposit gap), GM pay raise ($5,000 positive)
- Total add-backs: $43,871
- Normalized EBITDA: $156,203 (18% margin)
- Multiple applied: 4.5x
- Valuation: $700,000

### Example B: Foothills Pet Resort (Ahwatukee, AZ)
- LTM Revenue: $1,732,614
- Raw EBITDA: $180,154 (10.4% margin)
- Key add-backs: Owner payroll/compensation ($184,221), Personal donations ($8,900), Personal repairs ($18,062), Personal supplies ($12,739), Personal meals ($695), Personal travel ($-511 — reimbursement), Other personal expenses
- Total add-backs: $233,410
- Normalized EBITDA: $413,564 (23.9% margin)
- Multiple applied: 4.5x
- Valuation: $1,861,038

**Note for engineer:** These are real deal examples Craig has worked on. They illustrate the typical scale of add-backs relative to raw EBITDA. In Example B, the add-backs were larger than the raw EBITDA itself — this is not unusual for owner-operated small businesses. The agent must handle this without error.

---

## 13. WS2 Excel Workbook Assembly (Option A — Progressive Build, Lock on Craig Approval)

### 13.1 Overview

When Craig clicks **"Approve Recast"** in the WS2-2 HITL interface, the portal immediately generates and makes available a single formatted Excel workbook containing all WS2 outputs across all five agents. This is the canonical financial deliverable for the engagement — the Cantara equivalent of the Foothills valuation workbook.

**The workbook is built progressively** as agents complete, but it is not downloadable until Craig approves WS2-2. Each agent writes its output to its designated tab(s) as it finishes. WS2-2 approval triggers the final assembly, formatting pass, and download link generation.

**Filename:** `[ClientName]_WS2_Financial_Analysis_[YYYY-MM-DD].xlsx`

**Color coding used throughout (industry standard):**
- **Blue text** — hardcoded inputs (seller-provided data, Craig's inputs)
- **Black text** — calculated values (formulas)
- **Green text** — values linked from another tab within the workbook
- **Yellow background** — flagged items requiring attention
- **Red background** — unresolved flags (should be zero by the time Craig approves)

---

### 13.2 Workbook Tab Structure

The workbook contains 12 tabs in this exact order:

| Tab # | Tab Name | Primary Source Agent | Status at WS2-2 Approval |
|---|---|---|---|
| 1 | `Summary` | All agents | Populated last — summarizes everything |
| 2 | `Assumptions` | Craig inputs + WS2-2 | Populated when Craig sets inputs before WS2-2 runs |
| 3 | `P&L - Non Adj` | WS2-1 (raw input) | Populated when WS2-1 completes |
| 4 | `GL Mapping` | WS2-1 | Populated when WS2-1 completes |
| 5 | `TTM & 3-Year P&L` | WS2-1 | Populated when WS2-1 completes |
| 6 | `Normalization Items` | WS2-2 | Populated when WS2-2 completes + Craig approves |
| 7 | `Valuation` | WS2-2 | Populated when WS2-2 completes + Craig approves |
| 8 | `Revenue by Vertical` | WS2-3 | Populated when WS2-3 completes |
| 9 | `Expense Benchmarks` | WS2-4 | Populated when WS2-4 completes |
| 10 | `Labor Analysis` | WS2-5 | Populated when WS2-5 completes |
| 11 | `Working Capital` | WS2-1 | Populated when WS2-1 completes |
| 12 | `Data Quality Report` | WS2-1 + Craig resolutions | Populated when Craig clears WS2-1 HITL gate |

---

### 13.3 Tab Specifications

---

#### TAB 1: `Summary`

**Purpose:** One-page executive summary. Craig uses this as the top-level reference when discussing the business with a seller or preparing for the M&A workstream.

**Content:**

```
[Business Name] — WS2 Financial Analysis Summary
Prepared by Cantara Pet Advisors | [Date]
Craig HITL Approval: [Timestamp]

SECTION A — FINANCIAL SNAPSHOT
┌─────────────────────────────────────────────────────────────────────┐
│                    │    FY1      │    FY2      │    FY3      │  TTM  │
│ Total Revenue      │  $XXX,XXX  │  $XXX,XXX  │  $XXX,XXX  │  $XXX │
│ YoY Growth         │    —       │    X.X%     │    X.X%     │  —    │
│ Gross Profit       │  $XXX,XXX  │  $XXX,XXX  │  $XXX,XXX  │  $XXX │
│ Gross Margin %     │   XX.X%    │   XX.X%     │   XX.X%     │ XX.X% │
│ 4-Wall EBITDA      │  $XXX,XXX  │  $XXX,XXX  │  $XXX,XXX  │  $XXX │
│ (Pre-Recast)       │            │             │             │       │
│ EBITDA Margin %    │   XX.X%    │   XX.X%     │   XX.X%     │ XX.X% │
└─────────────────────────────────────────────────────────────────────┘

SECTION B — RECAST SUMMARY
┌─────────────────────────────────────────────────────────────────────┐
│ 4-Wall EBITDA (Pre-Recast) — TTM           │  $XXX,XXX              │
│ Total Add-Backs                            │  $XXX,XXX              │
│   Cat 1: Owner/Officer Compensation        │  $XXX,XXX              │
│   Cat 2: Personal Expenses                 │  $XX,XXX               │
│   Cat 3: One-Off Non-Recurring             │  $XX,XXX               │
│   Cat 4: Tenant Improvements               │  $XX,XXX               │
│   Cat 5: FMR Rent Normalization            │  $XX,XXX               │
│ Normalized EBITDA (TTM)                    │  $XXX,XXX              │
│ Normalized EBITDA Margin                   │  XX.X%                 │
└─────────────────────────────────────────────────────────────────────┘

SECTION C — PRELIMINARY VALUATION RANGE
┌─────────────────────────────────────────────────────────────────────┐
│                     │   Low      │   Mid      │   High              │
│ Multiple Applied    │   X.Xx     │   X.Xx     │   X.Xx              │
│ Valuation Range     │  $X,XXX,XX │  $X,XXX,XX │  $X,XXX,XX          │
│ Revenue Multiple    │   X.Xx     │   X.Xx     │   X.Xx              │
└─────────────────────────────────────────────────────────────────────┘
[Revenue trend flag if applicable]

SECTION D — REVENUE MIX (TTM)
Boarding: XX% | Daycare: XX% | Grooming: XX% | Training: XX% | Retail: XX% | Other: XX%
[Concentration flags if any]

SECTION E — EXPENSE HEALTH
[Traffic light summary: Direct Labor XX% vs. benchmark 35-45% | Rent XX% vs. benchmark 10-15% | etc.]

SECTION F — KEY FLAGS RESOLVED
[List of all flags from WS2-1 DQR and WS2-2, with Craig's resolution noted]
[Any flags still marked as OVERRIDE — note Craig's stated reason]
```

All values on this tab link from other tabs using green-text formulas. No hardcoded values on this tab.

---

#### TAB 2: `Assumptions`

**Purpose:** Single source of truth for all inputs Craig provided before WS2-2 ran. Auditable record of the assumptions behind the valuation.

**Content:**

```
CRAIG'S INPUTS — WS2-2 EBITDA RECAST
Entered by: Craig [portal user]
Date entered: [timestamp]

VALUATION MULTIPLES
  Multiple — Low End:      X.Xx       [blue — Craig input]
  Multiple — Mid Point:    X.Xx       [blue — Craig input]
  Multiple — High End:     X.Xx       [blue — Craig input]
  Multiple basis:          [Craig's notes, e.g., "Based on Cantara pet resort comps, Q1 2025"]

OWNER REPLACEMENT SALARY
  Annual Replacement Salary:  $XX,XXX  [blue — Craig input OR "DEFAULT $65,000"]
  Basis:                       [Craig's notes]

FAIR MARKET RENT
  Related-Party Ownership:     Yes / No
  Actual Annual Rent (from P&L): $XXX,XXX  [green — from TTM & 3-Year P&L tab]
  FMR Estimate (annual):        $XXX,XXX  [blue — Craig input, if applicable]
  FMR Adjustment:               $X,XXX    [black — calculated]

CRAIG OVERRIDE LOG
[Table of any flags Craig overrode during WS2-2 HITL review]
  Flag Description | Craig's Override Amount | Craig's Stated Reason | Timestamp
```

---

#### TAB 3: `P&L - Non Adj`

**Purpose:** The raw, unadjusted P&L exactly as received from the seller — mirroring the Foothills `P&L - Non Adj` tab exactly. This is the audit trail showing what data came in before any mapping or adjustment.

**Content:**
- Reproduces the seller's uploaded P&L in its original structure
- 36 monthly columns
- No formulas changed — values exactly as received
- A note at the top: `"Raw input data — unadjusted. Do not edit. Source: [filename] uploaded [date]."`
- Each column header shows the month
- Row labels exactly as they appeared in the seller's file

**Engineer note:** This tab is populated during WS2-1 data ingestion by copying the raw parsed values from the uploaded file. It should be write-protected after population.

---

#### TAB 4: `GL Mapping`

**Purpose:** Full audit trail showing every GL account from the seller's data and its Cantara taxonomy assignment. Craig and any reviewer can verify every mapping decision.

**Content:**

```
GL MAPPING TABLE
WS2-1 Auto-mapping completed: [timestamp]
Craig classification of unmapped codes: [timestamp]

| # | Original Account Name | Original GL Code | Cantara Code | Category Name | Status | Craig Override |
|---|---|---|---|---|---|---|
| 1 | Boarding Income | 4100 | REV-BOARD | Boarding Revenue | AUTO-MAPPED ✓ | — |
| 2 | Daycare Income | 4200 | REV-DAY | Daycare Revenue | AUTO-MAPPED ✓ | — |
| ... | ... | ... | ... | ... | ... | ... |
| 24 | Special Event Income | 4999 | REV-OTHER | Other Revenue | CRAIG-CLASSIFIED | Craig: 3/15/25 |
| 25 | Owner Vehicle Expense | 7777 | OPX-OTHER | Other OpEx | CRAIG-CLASSIFIED | Craig: 3/15/25 |

SUMMARY
  Total accounts: XX
  Auto-mapped: XX (XX%)
  Craig-classified: XX
  Ambiguous (flagged): 0
```

---

#### TAB 5: `TTM & 3-Year P&L`

**Purpose:** The clean, structured financial model produced by WS2-1. This is the financial backbone of the workbook — all other tabs reference values from here.

**Content:**

```
[Business Name] — TTM & 3-Year P&L Model
Data period: Jan [YYYY] — Dec [YYYY]
TTM period: [Month YYYY] — [Month YYYY]
Prepared by WS2-1 TTM Financial Analysis Agent

                          FY1         FY2         FY3         TTM
                       [YYYY]      [YYYY]      [YYYY]   [Mth-Mth]
REVENUE
  Boarding             $XXX,XXX    $XXX,XXX    $XXX,XXX   $XXX,XXX
  Daycare              $XXX,XXX    $XXX,XXX    $XXX,XXX   $XXX,XXX
  Grooming             $XXX,XXX    $XXX,XXX    $XXX,XXX   $XXX,XXX
  Training             $XX,XXX     $XX,XXX     $XX,XXX    $XX,XXX
  Retail               $XX,XXX     $XX,XXX     $XX,XXX    $XX,XXX
  Tips                 $XX,XXX     $XX,XXX     $XX,XXX    $XX,XXX
  Discounts           ($XX,XXX)   ($XX,XXX)   ($XX,XXX)  ($XX,XXX)
TOTAL REVENUE          $XXX,XXX    $XXX,XXX    $XXX,XXX   $XXX,XXX
YoY Growth                —         X.X%▲       X.X%▼       —

COGS
  [lines]
TOTAL COGS             $XX,XXX     $XX,XXX     $XX,XXX    $XX,XXX
GROSS PROFIT           $XXX,XXX    $XXX,XXX    $XXX,XXX   $XXX,XXX
GROSS MARGIN %          XX.X%       XX.X%       XX.X%      XX.X%

OPERATING EXPENSES
  Staff Labor          $XXX,XXX    $XXX,XXX    $XXX,XXX   $XXX,XXX
  Management Labor     $XX,XXX     $XX,XXX     $XX,XXX    $XX,XXX
  Owner Compensation   $XXX,XXX    $XXX,XXX    $XXX,XXX   $XXX,XXX
  Payroll Taxes/Ben.   $XX,XXX     $XX,XXX     $XX,XXX    $XX,XXX
  Rent — Base          $XX,XXX     $XX,XXX     $XX,XXX    $XX,XXX
  Rent — NNN/CAM       $XX,XXX     $XX,XXX     $XX,XXX    $XX,XXX
  [all other OpEx categories]
  Depreciation*        $XX,XXX     $XX,XXX     $XX,XXX    $XX,XXX
  Interest*            $XX,XXX     $XX,XXX     $XX,XXX    $XX,XXX
TOTAL OPERATING EXP.   $XXX,XXX    $XXX,XXX    $XXX,XXX   $XXX,XXX

4-WALL EBITDA          $XXX,XXX    $XXX,XXX    $XXX,XXX   $XXX,XXX
(PRE-RECAST)
EBITDA MARGIN %         XX.X%       XX.X%       XX.X%      XX.X%

NET INCOME             $XXX,XXX    $XXX,XXX    $XXX,XXX   $XXX,XXX

* Depreciation and Interest are shown for reference only.
  They are EXCLUDED from the 4-Wall EBITDA calculation above.
  PRE-RECAST: Add-backs have NOT been applied. See Normalization Items tab.
```

YoY change indicators (▲/▼) appear next to each Revenue and EBITDA line.

---

#### TAB 6: `Normalization Items`

**Purpose:** Mirrors the Foothills `Normalization Items` tab exactly. Shows every add-back line, the amount per year, and Craig's commentary. This is the core of WS2-2's output.

**Content:**

```
[Business Name] — EBITDA Normalization / Add-Back Schedule
Craig approved: [timestamp]

                              TTM        FY3        FY2        FY1     Comments
                           [period]    [YYYY]     [YYYY]     [YYYY]

4-Wall EBITDA (Pre-Recast)  $XXX,XXX   $XXX,XXX   $XXX,XXX   $XXX,XXX

NORMALIZATION ITEMS:

CATEGORY 1 — OWNER / OFFICER COMPENSATION
  Owner Wages               $XXX,XXX   $XXX,XXX   $XXX,XXX   $XXX,XXX  Owner salary/draws — add back in full
  S-Corp Health Insurance    $X,XXX     $X,XXX     $X,XXX     $X,XXX   Officer health ins — personal benefit
  Employer FICA on owner wages $X,XXX   $X,XXX     $X,XXX     $X,XXX   FICA attributable to owner wages
  Owner Replacement Salary  ($XX,XXX)  ($XX,XXX)  ($XX,XXX)  ($XX,XXX) Replacement GM @ $XX,XXX/yr
  Net Owner Comp Add-Back    $XXX,XXX   $XXX,XXX   $XXX,XXX   $XXX,XXX

CATEGORY 2 — PERSONAL EXPENSES
  Auto Expense               $X,XXX     $X,XXX     $X,XXX     $X,XXX   Personal vehicle — not business asset
  Personal Cell Phone        $X,XXX     $X,XXX     $X,XXX     $X,XXX   Owner personal phone on biz account
  [other personal items]
  Net Personal Add-Back      $XX,XXX    $XX,XXX    $XX,XXX    $XX,XXX

CATEGORY 3 — ONE-OFF NON-RECURRING
  [Roof repair — storm 2023]  $XX,XXX    $XX,XXX      —          —     One-time storm damage — not recurring
  [Legal — lease renegotiation]  —         —        $X,XXX      —     One-time legal for lease extension
  Net One-Off Add-Back        $XX,XXX    $XX,XXX    $X,XXX      —

CATEGORY 4 — TENANT IMPROVEMENTS
  [Play yard expansion 2022]    —          —          —       $XX,XXX  Expensed TI — will not recur for buyer
  Net TI Add-Back              —          —          —        $XX,XXX

CATEGORY 5 — FAIR MARKET RENT
  [N/A — not related-party]    —          —          —          —      N/A

TOTAL ADJUSTMENTS            $XXX,XXX   $XXX,XXX   $XXX,XXX   $XXX,XXX

NORMALIZED EBITDA            $XXX,XXX   $XXX,XXX   $XXX,XXX   $XXX,XXX
NORMALIZED EBITDA MARGIN %    XX.X%      XX.X%      XX.X%      XX.X%
```

Each add-back line: amounts in blue (hardcoded from Craig-approved WS2-2 output), comments column in plain text.

---

#### TAB 7: `Valuation`

**Purpose:** Mirrors the Foothills `Valuation` tab. Applies the multiple to normalized EBITDA and shows the valuation range. This is the number that drives everything downstream.

**Content:**

```
[Business Name] — Valuation Summary
Craig approved: [timestamp]
PRELIMINARY — FOR INTERNAL USE ONLY

VALUATION INPUTS
  Normalized EBITDA (TTM):      $XXX,XXX   [green — from Normalization Items tab]
  Normalized EBITDA (FY3):      $XXX,XXX   [green]
  Normalized EBITDA (3-yr avg): $XXX,XXX   [black — calculated]
  Revenue trend:                ▲ Growing / ▼ Declining / → Stable
  Multiple range:               X.Xx — X.Xx — X.Xx   [green — from Assumptions tab]

VALUATION RANGE (based on TTM Normalized EBITDA)
                Low          Mid         High
Multiple        X.Xx         X.Xx        X.Xx
Valuation    $X,XXX,XXX   $X,XXX,XXX  $X,XXX,XXX
Rev Multiple     X.Xx         X.Xx        X.Xx

VALUATION RANGE (based on FY3 Normalized EBITDA — for reference)
                Low          Mid         High
Valuation    $X,XXX,XXX   $X,XXX,XXX  $X,XXX,XXX

REVENUE TREND FLAG:
[If declining: "⚠ Revenue declining YoY. Buyer likely to apply low-to-mid multiple."]
[If growing: "✓ Revenue growing YoY. Full multiple range applicable."]

NOTE: This is a PRELIMINARY valuation range for Craig's internal planning.
It has not been reviewed by legal or tax counsel and must not be shared
with the seller until Craig approves it for client release.
```

---

#### TAB 8: `Revenue by Vertical`

**Purpose:** WS2-3 output. Revenue breakdown by service type across 3 years + TTM, with YoY trends and concentration flags.

**Content:**

```
[Business Name] — Revenue by Vertical Analysis

REVENUE MIX TABLE
                     FY1          FY1%     FY2          FY2%     FY3          FY3%     TTM          TTM%
Boarding           $XXX,XXX     XX.X%    $XXX,XXX     XX.X%    $XXX,XXX     XX.X%    $XXX,XXX     XX.X%
Daycare            $XXX,XXX     XX.X%    $XXX,XXX     XX.X%    $XXX,XXX     XX.X%    $XXX,XXX     XX.X%
Grooming           $XXX,XXX     XX.X%    $XXX,XXX     XX.X%    $XXX,XXX     XX.X%    $XXX,XXX     XX.X%
Training           $XX,XXX       X.X%    $XX,XXX       X.X%    $XX,XXX       X.X%    $XX,XXX       X.X%
Retail             $XX,XXX       X.X%    $XX,XXX       X.X%    $XX,XXX       X.X%    $XX,XXX       X.X%
Other              $XX,XXX       X.X%    $XX,XXX       X.X%    $XX,XXX       X.X%    $XX,XXX       X.X%
TOTAL REVENUE      $XXX,XXX    100.0%    $XXX,XXX    100.0%    $XXX,XXX    100.0%    $XXX,XXX    100.0%

BOARDING + DAYCARE COMBINED (CANTARA THRESHOLD: ≥70%)
  FY1: XX.X% | FY2: XX.X% | FY3: XX.X% | TTM: XX.X%  [GREEN ✓ or RED ⚠]

YOY TREND BY VERTICAL
[Table: vertical | FY1→FY2 change | FY2→FY3 change | direction indicator]

CONCENTRATION FLAGS
[Any vertical >60% or boarding+daycare combined <70% — listed here]

VERTICAL HEALTH RATINGS
Boarding:  [GREEN/YELLOW/RED]
Daycare:   [GREEN/YELLOW/RED]
Grooming:  [GREEN/YELLOW/RED]
[etc.]
```

---

#### TAB 9: `Expense Benchmarks`

**Purpose:** WS2-4 output. Actual expenses vs. Cantara's pet resort benchmarks, with flag indicators. Mirrors the Foothills `P&L Analysis` tab.

**Content:**

```
[Business Name] — P&L Expense Benchmark Analysis

CANTARA BENCHMARK RANGES (% of Revenue)
Direct Labor (excl. owner):  35% – 45%
Building Rent (base + NNN):  10% – 15%
Marketing:                    3% –  5%
Business Operations:          7% – 12%
[etc.]

BENCHMARK COMPARISON TABLE
                        Benchmark    Benchmark    FY1      FY1%     FY2      FY2%     FY3      FY3%     TTM      TTM%    Flag
                          Low          High       Actual   Rev      Actual   Rev      Actual   Rev      Actual   Rev
Direct Labor (ex-owner) 35.0%        45.0%      $XXX,XXX  XX.X%  $XXX,XXX  XX.X%  $XXX,XXX  XX.X%  $XXX,XXX  XX.X%  [🟢/🟡/🔴]
Building Rent           10.0%        15.0%      $XXX,XXX  XX.X%  ...
Marketing                3.0%         5.0%      ...
Utilities                3.0%         5.0%      ...
Business Operations      7.0%        12.0%      ...

YOY COST TRENDS
[Any category growing >15% YoY while revenue flat or declining — highlighted red]

FLAGS
[List of all RED and YELLOW flags with dollar impact vs. benchmark midpoint]

OVERALL EXPENSE HEALTH: [GREEN / YELLOW / RED]
```

---

#### TAB 10: `Labor Analysis`

**Purpose:** WS2-5 output. Detailed labor cost breakdown by role, with benchmark comparison and owner involvement analysis.

**Content:**

```
[Business Name] — Labor Expense Analysis

TOTAL LABOR SUMMARY
                        TTM Amount    TTM % Rev    FY3 % Rev    FY2 % Rev    FY1 % Rev
Staff Labor (hourly)    $XXX,XXX       XX.X%        XX.X%        XX.X%        XX.X%
Groom Commissions       $XXX,XXX       XX.X%        XX.X%        XX.X%        XX.X%
Management Labor        $XX,XXX         X.X%         X.X%         X.X%         X.X%
Owner Compensation      $XXX,XXX       XX.X%        XX.X%        XX.X%        XX.X%
Payroll Taxes/Benefits  $XX,XXX         X.X%         X.X%         X.X%         X.X%
Tips Paid Out           $XX,XXX         X.X%         X.X%         X.X%         X.X%
TOTAL ALL-IN LABOR      $XXX,XXX       XX.X%        XX.X%        XX.X%        XX.X%
BUYER-ADJUSTED LABOR    $XXX,XXX       XX.X%        XX.X%        XX.X%        XX.X%

BENCHMARK:  Direct Labor (ex-owner) 35% – 45% of revenue
Actual (ex-owner): XX.X% — [GREEN ✓ Within benchmark / YELLOW ⚠ Above benchmark / RED ⚠ Above deal-risk threshold of 45%]

OWNER INVOLVEMENT
  Owner weekly hours in business (from WS1): XX hrs/week
  Owner compensation (annual): $XXX,XXX
  Assessment: [UNDERCOMPENSATED / FAIRLY COMPENSATED / OVERCOMPENSATED]
  Buyer transition risk: [LOW / MEDIUM / HIGH]
  Notes: [From Owner & GM Assessment output if available]

3-YEAR LABOR TREND
  FY1: XX.X% of revenue
  FY2: XX.X% of revenue  [▲/▼ X.Xpts vs FY1]
  FY3: XX.X% of revenue  [▲/▼ X.Xpts vs FY2]
  TTM: XX.X% of revenue
  Trend: [IMPROVING / STABLE / DETERIORATING]
```

---

#### TAB 11: `Working Capital`

**Purpose:** WS2-1 balance sheet analysis. Shows the NWC calculation that feeds the Seller Net Proceeds Calculator.

**Content:**

```
[Business Name] — Working Capital Analysis

MOST RECENT MONTH-END BALANCE SHEET: [Month YYYY]

CURRENT ASSETS                             $
  Cash & Equivalents         $XX,XXX
  Accounts Receivable        $XX,XXX
  Inventory                  $XX,XXX
  Prepaid Expenses            $X,XXX
TOTAL CURRENT ASSETS                      $XX,XXX

CURRENT LIABILITIES
  Accounts Payable           $XX,XXX
  Accrued Liabilities        $XX,XXX
  Deferred Revenue            $X,XXX
TOTAL CURRENT LIABILITIES                 $XX,XXX

NET WORKING CAPITAL (Point-in-time)       $XX,XXX

3-MONTH AVERAGE NWC                       $XX,XXX
(Used in Seller Net Proceeds Calculator)
Months averaged: [Month], [Month], [Month]

AR AGING SUMMARY (as of most recent month)
  Current:      $XX,XXX (XX.X%)
  1-30 days:    $X,XXX  (XX.X%)
  31-60 days:   $X,XXX  (XX.X%)
  61-90 days:   $X,XXX  (XX.X%)
  90+ days:     $X,XXX  (XX.X%)   [Flag if >15%]
  TOTAL AR:     $XX,XXX
  BS Reconciliation: [RECONCILED ✓ / GAP: $X,XXX ⚠]

→ 3-Month Average NWC of $XX,XXX passed to Seller Net Proceeds Calculator.
```

---

#### TAB 12: `Data Quality Report`

**Purpose:** The WS2-1 Data Quality Report with Craig's resolutions recorded. Full audit trail of every data issue found and how it was handled.

**Content:**

```
[Business Name] — Data Quality Report
WS2-1 generated: [timestamp]
Craig review completed: [timestamp]
All items resolved: [YES / NO — should be YES at workbook assembly]

SECTION A — GL CLASSIFICATION REQUESTS
[Table: Account | Original GL | Monthly Range | Agent Assessment | Craig Assignment | Date]

SECTION B — QB vs. EXCEL DISCREPANCIES
[Table: Month | Line | Excel Value | QB Value | Variance $ | Variance % | Craig Resolution]
[If QB not connected: "QB cross-reference not available — access not granted"]

SECTION C — ACCOUNTANT STATEMENT DISCREPANCIES
[Table: Fiscal Year | Line | Monthly Rollup | Acct Statement | Variance $ | Craig Resolution]

SECTION D — PERIOD & COVERAGE ISSUES
[Any missing months, zero-revenue months, fiscal year alignment notes]

SECTION E — AR AGING FLAGS
[Reconciliation status, aging bucket percentages, concentration flags, Craig resolutions]

RESOLUTION SUMMARY
  Total flags raised: XX
  Resolved — no change: XX
  Resolved — Craig override: XX
  Resolved — sent back to seller for clarification: XX
  Outstanding (should be 0 at workbook assembly): 0
```

---

### 13.4 Progressive Build — When Each Tab Gets Populated

```
WS2-1 completes
    → Populates: Tab 3 (P&L Non Adj), Tab 4 (GL Mapping),
                 Tab 5 (TTM & 3-Year P&L), Tab 11 (Working Capital)

Craig clears WS2-1 HITL gate
    → Populates: Tab 12 (Data Quality Report — with Craig's resolutions)

WS2-3 completes (runs in parallel after WS2-1)
    → Populates: Tab 8 (Revenue by Vertical)

WS2-4 completes (runs in parallel after WS2-1)
    → Populates: Tab 9 (Expense Benchmarks)

WS2-5 completes (runs in parallel after WS2-1 + WS2-2)
    → Populates: Tab 10 (Labor Analysis)

Craig sets inputs in portal (before WS2-2 runs)
    → Populates: Tab 2 (Assumptions)

WS2-2 completes
    → Populates: Tab 6 (Normalization Items), Tab 7 (Valuation)

Craig clicks "Approve Recast" (WS2-2 HITL hard gate)
    → Triggers final assembly:
        1. Tab 1 (Summary) populated — pulls from all other tabs
        2. All cross-tab formula links verified
        3. Formatting pass (column widths, number formats, color coding)
        4. Write-protect Tabs 3, 4, 12 (raw data and audit trail — no edits)
        5. Workbook saved to Google Drive client folder
        6. Download link surfaced in portal
        7. WS2-8 (Seller Net Proceeds Calculator) unlocked
```

---

### 13.5 Engineer Implementation Notes

**Technology:** Use the `xlsx` library (SheetJS) or `openpyxl` (Python) server-side to build the workbook. The workbook is assembled server-side, not in the browser.

**Storage:** The completed workbook is saved to the client's Google Drive folder (same folder structure used for lease documents and other WS1 outputs). The portal also stores a reference to the file path so it can be retrieved later.

**Versioning:** If Craig re-runs WS2-2 after an initial approval (e.g., seller provides corrected data), the workbook is regenerated with a new timestamp in the filename. Previous versions are retained in Google Drive with their original timestamps.

**Formula integrity:** All inter-tab references must use named ranges or explicit cell references. The workbook must open cleanly in both Excel and Google Sheets. Test both before marking complete.

**Write protection:** Tabs 3 (`P&L - Non Adj`), 4 (`GL Mapping`), and 12 (`Data Quality Report`) should be write-protected with a note: `"This tab is a read-only audit record. Do not edit."` Tab protection in Excel is set via `sheet.protection.sheet = True`.

**Number formatting standard across all tabs:**
- Currency: `$#,##0;($#,##0);"-"` (no cents — these are whole-dollar financial figures)
- Percentages: `0.0%` (one decimal)
- Multiples: `0.0"x"` (e.g., 4.5x)
- Year labels: text strings (not numbers — prevents Excel from formatting as dates)
- Negative numbers: parentheses `(X,XXX)` not minus sign `-X,XXX`

---

*WS2 Agent Architecture Specification v1.0*
*Cantara Pet Advisors Portal*
*Developed by Babalilm AI FZ-LLC for Pollack Strategy Corp dba Cantara Pet Advisors*
*Engineer: Do not modify financial logic without Craig's approval. Flag any implementation questions to Aliya.*
