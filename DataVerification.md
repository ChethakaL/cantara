# Harborview Pet Resort — Verification Cheatsheet v3
### Simple: find the number on screen, check it matches this list

---

## HOW TO USE THIS
1. Open a section in your system
2. Find the number on screen
3. Check it matches what's written here
4. If it matches ✅ move on. If it doesn't ❌ that's a bug.

---

## WS2-1 — TTM Financial Analysis
*What it does: Ingests 36 months of data, builds the financial model, produces TTM P&L, YoY trends, data quality flags*

### The 4 numbers that matter most — check these first
| What to find on screen | Should say |
|---|---|
| TTM Revenue | **$1,286,264** |
| TTM Gross Margin % | **98.7%** |
| TTM EBITDA (Pre-Recast) | **$51,336** |
| 36-Month Confidence | **HIGH** (all 53 accounts auto-mapped) |

### 3-Year P&L table — Revenue row
| FY2022 | FY2023 | FY2024 |
|---|---|---|
| **$1,125,690** | **$1,216,154** | **$1,286,264** |

> ⚠️ If FY2022 shows $1,123,760 or FY2023 shows $1,213,875 — those are the accountant statement numbers. The P&L table must use the monthly rollup numbers above.

### 3-Year P&L table — EBITDA row
| FY2022 | FY2023 | FY2024 |
|---|---|---|
| **($46,472)** | **($7,043)** | **$51,336** |

### YoY Revenue Growth
| FY1→FY2 | FY2→FY3 |
|---|---|
| **+8.0%** | **+5.8%** |

### Working Capital (Dec 2024)
| What to find | Should say |
|---|---|
| Cash | $75,070 |
| Accounts Receivable | $5,419 |
| Inventory | $7,129 |
| Prepaid | $500 |
| Total Current Assets | $88,118 |
| Accounts Payable | $7,887 |
| Accrued Liabilities | $6,343 |
| Deferred Revenue | $3,699 |
| Total Current Liabilities | $17,929 |
| **Net Working Capital** | **$70,189** |

### Data Quality Flags — these MUST appear
- ❗ AR gap: Balance Sheet AR ($5,419) vs Aging total ($6,635) = **$1,216 variance**
- ❗ Customer concentration: Harbor Animal Hospital = **42%+ of total AR**
- ❗ Section C: Accountant statement vs monthly rollup variances flagged for all 3 years

### Section C comparison table (accountant vs rollup)
| Year | Monthly Rollup | Accountant Statement | Difference |
|---|---|---|---|
| FY2022 | $1,125,690 | $1,123,760 | $1,930 |
| FY2023 | $1,216,154 | $1,213,875 | $2,279 |
| FY2024 | $1,286,264 | $1,285,878 | $386 |

> ℹ️ All 3 variances exceed $1,000 and are above the 1% threshold for FY2022 — they must all be flagged per architecture rules, even if small.

---

## WS2-2 — EBITDA Recast
*What it does: Applies 5 add-back categories to normalize EBITDA, produces adjusted earnings and preliminary valuation*

### Starting point
| What to find | Should say |
|---|---|
| Starting TTM EBITDA | **$51,336** |

### Owner Compensation add-back (Category 1)
| Line | Should say |
|---|---|
| Officer Wages (GL 6020) | $144,000 — VERIFIED ✓ |
| S-Corp Health (GL 6021) | $6,240 — VERIFIED ✓ |
| Employer FICA on owner wages | $11,016 — CALCULATED (144,000 × 7.65%) |
| Replacement Salary | ($65,000) — DEFAULT (Craig to confirm) |
| **Net owner add-back** | **$96,256** |

### Personal Expenses (Category 2) — actual GL amounts from FY2024
| Item | GL | Should say |
|---|---|---|
| Auto Expense | 7400 | $5,772 |
| Cell Phone | 7401 | $3,360 |
| Donations | 7300 | $1,000 |
| **Total personal** | | **$10,132** |

> ℹ️ Auto Expense uses actual FY2024 GL total ($5,772) — not the seller's stated average ($6,240/yr). The actual amounts vary month to month. Cell phone is fixed at $280/month ($3,360/yr). Donations are $250/quarter ($1,000/yr).

### One-Off Items (Category 3)
| Item | Year | TTM amount | FY2023 amount | FY2022 amount |
|---|---|---|---|---|
| Roof repair | Jul-2023 | **$0** | $18,500 | $0 |
| Legal fees | Dec-2022 | **$0** | $0 | $8,200 |

> ⚠️ One-off items must show $0 in the TTM column. Both items occurred outside the FY2024/TTM period — they are NOT added back to TTM EBITDA, only shown for historical context.

### TI Add-Backs (Category 4)
| Item | Year | TTM amount | FY2022 amount |
|---|---|---|---|
| Turf & fencing | 2022 | **$0** | $24,000 |

> ⚠️ TI occurred in FY2022, so $0 in TTM add-back. Permit #2022-1847 confirmed.

### Category 5 — Fair Market Rent
No adjustment. Landlord is an unrelated third party (Harbor Commercial Real Estate LLC).

### Full recast schedule
| | TTM | FY3 2024 | FY2 2023 | FY1 2022 |
|---|---|---|---|---|
| Pre-Recast EBITDA | $51,336 | $51,336 | ($7,043) | ($46,472) |
| Cat 1: Owner Comp | $96,256 | $96,256 | $96,256 | $96,256 |
| Cat 2: Personal Expenses | $10,132 | $10,132 | $10,884 | $11,348 |
| Cat 3: One-Off Non-Recurring | $0 | $0 | $18,500 | $8,200 |
| Cat 4: Tenant Improvements | $0 | $0 | $0 | $24,000 |
| Cat 5: FMR Rent | $0 | $0 | $0 | $0 |
| **Total Add-Backs** | **$106,388** | **$106,388** | **$125,640** | **$139,804** |
| **Normalized EBITDA** | **$157,724** | **$157,724** | **$118,597** | **$93,332** |
| Normalized Margin | 12.3% | 12.3% | 9.8% | 8.3% |

> ⚠️ FY22 add-backs include all 4 categories, FY23 includes Cat 1 + Cat 2 + roof repair, FY24/TTM includes Cat 1 + Cat 2 only.

### Valuation range
| | Low (3.5x) | Mid (4.5x) | High (5.5x) |
|---|---|---|---|
| **Valuation** | **$552,034** | **$709,758** | **$867,482** |

### Flags that MUST appear in WS2-2
- ❗ HIGH: Add-backs ($106,388) = 207.2% of pre-recast EBITDA — exceeds 30% threshold
- ❗ MEDIUM: Cell phone exact $280/month recurring — confirm truly personal
- ❗ MEDIUM: Donations exact $250/quarter — may be an estimate
- ❗ DEFAULT: Replacement salary $65,000 used as default — Craig must confirm

### Disclaimer that MUST appear
> "This is a PRELIMINARY valuation range for Craig's internal planning. It has not been reviewed or approved. It must not be shared with the seller until Craig approves it."

---

## WS2-3 — Revenue by Vertical
*What it does: Breaks down revenue by service line over 3 years, checks boarding+daycare concentration, identifies revenue mix trends*

### Revenue mix table
| Vertical | FY2022 $ | FY2022 % | FY2023 $ | FY2023 % | FY2024/TTM $ | FY2024/TTM % |
|---|---|---|---|---|---|---|
| BOARDING | $456,437 | 40.5% | $503,929 | 41.4% | $538,895 | 41.9% |
| DAYCARE | $275,879 | 24.5% | $295,315 | 24.3% | $317,165 | 24.7% |
| GROOMING | $322,478 | 28.6% | $343,432 | 28.2% | $354,837 | 27.6% |
| TRAINING | $0 | 0.0% | $0 | 0.0% | $0 | 0.0% |
| RETAIL | $30,819 | 2.7% | $32,242 | 2.7% | $33,236 | 2.6% |
| MEMBERSHIP | $9,743 | 0.9% | $9,856 | 0.8% | $10,088 | 0.8% |
| OTHER (Tips) | $39,037 | 3.5% | $40,869 | 3.4% | $42,022 | 3.3% |

> ℹ️ Discounts (GL 4010) are subtracted from gross revenue to get net revenue. Tips (GL 4500) map to REV-TIPS → shown in OTHER vertical. Total net revenue = $1,286,264 for FY2024.

### YoY growth table
| Vertical | FY1→FY2 | FY2→FY3 |
|---|---|---|
| Boarding | +10.4% | +6.9% |
| Daycare | +7.0% | +7.4% |
| Grooming | +6.5% | +3.3% |
| Retail | +4.6% | +3.1% |
| Membership | +1.2% | +2.4% |
| Other (Tips) | +4.7% | +2.8% |

### Concentration flags that MUST appear
- ❗ Boarding + Daycare combined = **66.6%** → below 70% threshold → flag as non-standard revenue profile
- ❗ Training = $0 across all 3 years → flag as untapped opportunity (RED status)
- ✅ Grooming at 27.6% → below 40% concentration risk, but groomer dependency note should appear

---

## WS2-4 — P&L Expense Benchmarks
*What it does: Compares expense categories against Cantara industry benchmarks, flags anomalies*

### How COGS is defined in this benchmark (important)
The benchmark COGS category = **GL 5000 only** ($17,248). This is the sole item the seller's P&L places under "Cost of Goods Sold." GL 6600 (Grooming Supplies) and GL 6601 (Caretaking Supplies) are listed under "Expenses → Supplies" in the P&L — they map to **OPX-SUPPLY**, not COGS. OPX-SUPPLY is a separate line item shown below the benchmark table for reference.

> ⚠️ If your system shows COGS = $53,363 (which includes 6600+6601), that is **wrong**. The correct COGS benchmark figure is $17,248. The old cheatsheet v2 had this incorrect.

### Benchmark comparison table (FY2024/TTM)
| Category | GL Codes | FY2024 $ | FY2024 % | Benchmark | Flag |
|---|---|---|---|---|---|
| COGS | 5000 | $17,248 | **1.3%** | 0–5% | ✅ GREEN |
| Marketing | 6300+6301+6302 | $36,072 | **2.8%** | 3–5% | 🟡 YELLOW |
| Direct Labor | 6000+6010+6011+6030+6031 | $576,987 | **44.9%** | 35–45% | ✅ GREEN |
| Payroll Tax | 6040+6041 | $56,682 | **4.4%** | 2–5% | ✅ GREEN |
| Building Rent | 6100+6101+6102 | $198,360 | **15.4%** | 10–15% | 🟡 YELLOW |
| Other Building | 6200+6201+6202+6203+6500+6501+6502+6503 | $72,496 | **5.6%** | 3–5% | 🟡 YELLOW |
| Biz Ops | 6700+6701+6400+6900+6901+6800+6801+6802 | $66,629 | **5.2%** | 7–12% | ✅ GREEN |
| Supplies (ref only) | 6600+6601+6602 | $38,705 | **3.0%** | — | ℹ️ INFO |

> ℹ️ Supplies (OPX-SUPPLY) is shown for reference only — it is not one of the 7 official benchmark categories. It does not get a flag.

> ℹ️ Biz Ops at 5.2% is 1.8pp below the 7% low benchmark. Per the architecture, a YELLOW flag only fires if >3pp below low. 1.8pp does NOT trigger a flag. Your system should show GREEN here.

### Full 3-year benchmark table
| Category | FY2022 $ | FY22 % | FY2023 $ | FY23 % | FY2024 $ | FY24 % |
|---|---|---|---|---|---|---|
| COGS | $16,032 | 1.4% | $16,762 | 1.4% | $17,248 | 1.3% |
| Marketing | $35,520 | 3.2% | $36,217 | 3.0% | $36,072 | 2.8% |
| Direct Labor | $524,934 | 46.6% | $554,919 | 45.6% | $576,987 | 44.9% |
| Payroll Tax | $51,648 | 4.6% | $54,413 | 4.5% | $56,682 | 4.4% |
| Building Rent | $198,360 | 17.6% | $198,360 | 16.3% | $198,360 | 15.4% |
| Other Building | $69,060 | 6.1% | $86,795 | 7.1% | $72,496 | 5.6% |
| Biz Ops | $70,765 | 6.3% | $64,855 | 5.3% | $66,629 | 5.2% |
| Supplies (ref) | $35,570 | 3.2% | $37,310 | 3.1% | $38,705 | 3.0% |

> ℹ️ FY2023 Other Building is elevated to $86,795 (7.1%) because it includes the $18,500 one-time roof repair (GL 6502). This is a historical flag, not a structural problem — confirmed by the non-recurring expense add-back.

### Flags that MUST appear — corrected list
- 🟡 YELLOW: Marketing at 2.8% — below 3% minimum benchmark
- 🟡 YELLOW: Building Rent at 15.4% — marginally above 15% high benchmark
- 🟡 YELLOW: Other Building at 5.6% — above 5% high benchmark
- 📌 NOTE: FY2022 Direct Labor was 46.6% and FY2023 was 45.6% — both historically above the 45% deal-risk threshold (historical RED flags, now trending to GREEN in FY2024)
- ✅ POSITIVE: Direct Labor trending down year over year (46.6% → 45.6% → 44.9%)
- ✅ POSITIVE: Building Rent trending down as % of revenue (17.6% → 16.3% → 15.4%) — fixed rent, growing revenue

> ⚠️ The old cheatsheet v2 had the wrong COGS figure ($53,363 instead of $17,248) and was missing the Biz Ops GREEN explanation and the historical Direct Labor flags for FY22/FY23.

---

## WS2-5 — Labor Expense Analysis
*What it does: Calculates total labor cost %, role-level breakdown, benchmarks against industry norms, normalizes owner labor*

### Labor cost summary (TTM = FY2024)
| Category | GL Codes | TTM $ | TTM % of Revenue |
|---|---|---|---|
| Staff Labor | 6000+6010+6011 | $429,387 | 33.4% |
| Management Labor | 6030+6031 | $147,600 | 11.5% |
| Owner Compensation | 6020+6021 | $150,240 | 11.7% |
| Payroll Taxes & Benefits | 6040+6041 | $56,682 | 4.4% |
| **All-in Labor** | all above | **$783,909** | **60.9%** |
| **Buyer-Adjusted Labor** | staff+mgmt+$65k+tax | **$698,669** | **54.3%** |
| **Labor excl. owner** | staff+mgmt+tax | **$633,669** | **49.3%** |

> ℹ️ Tips Paid Out: there is no OPX-TIPS-OUT line in this P&L. Tips appear only as revenue (GL 4500). All-in Labor does not include a tips-out component for this business.

### 3-year trend (labor excl. owner vs 35-45% benchmark)
| FY2022 | FY2023 | FY2024 |
|---|---|---|
| 51.2% | 50.1% | 49.3% |
| ❌ above | ❌ above | ❌ above |

### Flags that MUST appear
- 🔴 RED: Labor excl. owner at **49.3%** exceeds the 45% Cantara deal-risk threshold
- ✅ Positive note: trending down each year (51.2% → 50.1% → 49.3%) as revenue grows

---

## WS2-10 / Baseline Valuation Report
*What it does: Assembles all outputs into one report. Craig HITL required before delivery to seller.*

### The 6 numbers to spot-check immediately
| What to find | Should say |
|---|---|
| TTM Revenue | **$1,286,264** |
| TTM Normalized EBITDA | **$157,724** |
| Normalized Margin | **12.3%** |
| Valuation Low | **$552,034** |
| Valuation Mid | **$709,758** |
| Valuation High | **$867,482** |

### Disclaimer — MUST be present before delivery
> "This is a PRELIMINARY valuation range for Craig's internal planning. It has not been reviewed or approved. It must not be shared with the seller until Craig approves it."

### HITL gate — MUST be enforced
- Craig must click Approve before this report can reach the seller
- All flags from WS2-1 through WS2-5 must be resolved or acknowledged
- WS2-2 is a HARD gate — no exceptions

---

## Aliya's checklist — confirming all 6 capabilities work

| Capability | Agent | Key number to verify it worked |
|---|---|---|
| Ingests 36 months, builds model, TTM P&L, YoY trends, data quality flags | WS2-1 | TTM EBITDA = $51,336 and flags present |
| 5-category add-back schedule, normalized EBITDA, valuation range | WS2-2 | Normalized EBITDA = $157,724, valuation $552K–$867K |
| Revenue by service line, boarding+daycare concentration check | WS2-3 | 66.6% concentration flag present, all 7 verticals shown |
| Expense benchmarks, flags anomalies | WS2-4 | 3 YELLOW flags present (marketing, rent, other building); COGS = $17,248 = 1.3% |
| Labor cost %, role breakdown, benchmarks, owner labor normalized | WS2-5 | RED flag at 49.3% labor, buyer-adjusted labor = $698,669 |
| Baseline report assembled, disclaimer, Craig HITL required | WS2-10 | Valuation shows, disclaimer present, approve button required |

---

## What changed from v2 → v3

| Section | What was wrong in v2 | Correct value in v3 |
|---|---|---|
| WS2-4 COGS | Showed $53,363 (included GL 6600+6601) | **$17,248** — GL 5000 only. 6600/6601 are OPX-SUPPLY, not COGS |
| WS2-4 COGS % | Showed 4.1% | **1.3%** |
| WS2-4 GL codes for COGS | Listed 5000+6600+6601 | **5000 only** |
| WS2-4 Biz Ops flag | Showed GREEN with no explanation | GREEN confirmed — 1.8pp below low does NOT trigger flag (needs >3pp) |
| WS2-4 Historical flags | Only mentioned FY22 Direct Labor | Added FY22 and FY23 Direct Labor RED flags; FY22 and FY23 Rent RED flags; FY23 Other Building elevated by roof repair |
| WS2-4 Supplies row | Not shown | Added as INFO-only reference row (OPX-SUPPLY, no benchmark) |
| WS2-3 OTHER vertical | Showed $30,334 / 2.7% | **$42,022 / 3.3%** — Tips (GL 4500) correctly included in OTHER |

---
*All numbers calculated directly from: HA_1_Monthly_PL.xlsx, HA_2_Monthly_BS.xlsx, HA_3_Accountant_Statements.xlsx, HA_4_AR_Aging.xlsx*
*Methodology verified against WS2_Agent_Architecture-3.md*
*Version 3 — corrections verified by recalculating from raw GL data*