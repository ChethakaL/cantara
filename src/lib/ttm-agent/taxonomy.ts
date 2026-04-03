export interface TaxonomyEntry {
  code: string;
  category: string;
  type: "revenue" | "cogs" | "opex" | "working_capital";
  aliases: string[];
  /** If true, the full GL amount for this code is added back in EBITDA recast (WS2-2) */
  addBack?: boolean;
}

export const CANTARA_TAXONOMY: TaxonomyEntry[] = [
  // ── REVENUE ──────────────────────────────────────────────────────────────
  {
    code: "REV-BOARD",
    category: "Boarding Revenue",
    type: "revenue",
    aliases: ["boarding", "overnight boarding", "suite boarding", "kenneling", "lodging", "boarding & petsitting", "petsitting", "boarding revenue", "services revenue", "service revenue", "sales", "cash & check sales", "cash and check sales", "credit card income", "credit card sales"],
  },
  {
    code: "REV-DAY",
    category: "Daycare Revenue",
    type: "revenue",
    aliases: ["daycare", "dog daycare", "day care", "half day daycare", "drop in", "daycare & adventures", "adventures"],
  },
  {
    code: "REV-GROOM",
    category: "Grooming Revenue",
    type: "revenue",
    aliases: ["grooming", "bath & brush", "bath and brush", "full groom", "groom commission income", "grooming revenue"],
  },
  {
    code: "REV-TRAIN",
    category: "Training Revenue",
    type: "revenue",
    aliases: ["training", "group class", "private training", "board and train", "board & train", "evaluations", "walks jogs", "walks", "dog transport"],
  },
  {
    code: "REV-RETAIL",
    category: "Retail Revenue",
    type: "revenue",
    aliases: ["retail", "merchandise", "food sales", "product sales", "product revenue", "sales of product income", "product income", "product & other revenue"],
  },
  {
    code: "REV-TIPS",
    category: "Tips",
    type: "revenue",
    aliases: ["tips", "paycheck tips", "cash tips", "tips received", "tip income"],
  },
  {
    code: "REV-MEM",
    category: "Membership Fees",
    type: "revenue",
    aliases: ["membership", "member fees", "monthly plans", "membership packages"],
  },
  {
    code: "REV-DISC",
    category: "Discounts and Refunds",
    type: "revenue",
    aliases: ["discount", "discounts", "refund", "refunds", "promotional discounts", "sales discounts", "service discounts", "additional discount"],
  },
  {
    code: "REV-OTHER",
    category: "Other Revenue",
    type: "revenue",
    aliases: ["uncategorized income", "miscellaneous income", "other revenue", "other income", "interest income", "commission received", "reimbursed expense income", "uncategorized revenue", "after hours", "holiday fees"],
  },

  // ── COST OF GOODS SOLD ───────────────────────────────────────────────────
  {
    code: "COGS-SUPPLY",
    category: "Direct Service Supplies",
    type: "cogs",
    aliases: ["grooming supplies", "boarding supplies", "service supplies", "shampoo", "bedding consumed", "cleaning supplies cogs"],
  },
  {
    code: "COGS-RETAIL",
    category: "Retail COGS",
    type: "cogs",
    aliases: ["retail cogs", "merchandise cost", "cost of retail goods sold"],
  },
  {
    code: "COGS-OTHER",
    category: "Other COGS",
    type: "cogs",
    aliases: ["other direct cost", "other cogs", "cost of sales", "cost of goods sold", "damaged/lost goods", "damaged lost goods", "shipping cogs", "shipping - cogs"],
  },

  // ── OPERATING EXPENSES — LABOR ───────────────────────────────────────────
  {
    code: "OPX-LABOR-STAFF",
    category: "Staff / Direct Labor",
    type: "opex",
    aliases: ["wages", "groom commission", "day labor", "hourly wages", "kennel staff", "staff payroll", "payroll staff", "payroll staff wages", "payroll staff (wages)", "contactor and worker expenses", "contractor expenses", "worker expenses", "hiring and training", "payroll expenses"],
  },
  {
    code: "OPX-LABOR-MGMT",
    category: "Management Labor",
    type: "opex",
    aliases: ["manager salary", "admin wages", "office staff", "front desk", "management wages", "operations manager"],
  },
  {
    code: "OPX-LABOR-OWN",
    category: "Owner Compensation",
    type: "opex",
    addBack: true,
    aliases: ["officer wages", "owner draw", "owner salary", "s corp distributions", "member distributions", "officer compensation", "s-corp health", "owner health insurance", "consulting fees owner", "payroll owner", "payroll owner wages", "payroll owner (wages)", "payroll - officer", "draw", "owner draws", "member draw"],
  },
  {
    code: "OPX-LABOR-TAX",
    category: "Payroll Taxes & Benefits",
    type: "opex",
    aliases: ["employer taxes", "fica", "simple ira", "health insurance", "payroll tax", "bcbs", "benefits", "workers compensation", "workers comp premiums", "workers comp premiums - labour", "payroll fees", "payroll owner employer taxes", "payroll owner (employer taxes)", "payroll staff employer taxes", "payroll staff (employer taxes)", "payroll expenses - other"],
  },
  {
    code: "OPX-TIPS-OUT",
    category: "Tips Paid Out",
    type: "opex",
    aliases: ["cash tips paid out", "tips paid out", "tip payout", "payroll tips"],
  },

  // ── OPERATING EXPENSES — FACILITY ────────────────────────────────────────
  {
    code: "OPX-RENT",
    category: "Base Rent",
    type: "opex",
    aliases: ["lease", "base rent", "rent", "rent expense", "rent expense - home office"],
  },
  {
    code: "OPX-RENT-NNN",
    category: "NNN / CAM Charges",
    type: "opex",
    aliases: ["cams", "cam", "nnn", "management fee", "sales tax on rent", "common area maintenance"],
  },
  {
    code: "OPX-UTIL",
    category: "Utilities (Business)",
    type: "opex",
    aliases: ["electric", "gas", "water", "internet", "phone", "telecom", "utilities", "phone and internet", "cell phone expense", "cell phone"],
  },
  {
    code: "OPX-UTIL-OWNER",
    category: "Utilities (Personal/Home)",
    type: "opex",
    addBack: true,
    aliases: ["home utilities", "personal utilities", "owner home phone", "personal internet", "home electric"],
  },

  // ── OPERATING EXPENSES — BUSINESS OPS ────────────────────────────────────
  {
    code: "OPX-MKTG",
    category: "Marketing & Advertising",
    type: "opex",
    aliases: ["advertising", "google ads", "facebook", "marketing", "direct mail", "periodical", "advertising and promotion", "promotion"],
  },
  {
    code: "OPX-INSUR",
    category: "Insurance",
    type: "opex",
    aliases: ["insurance", "liability", "workers comp", "property insurance", "insurance expense"],
  },
  {
    code: "OPX-REPAIR",
    category: "Repairs & Maintenance (Business)",
    type: "opex",
    aliases: ["repairs", "maintenance", "janitorial", "pest control", "waste removal", "building maintenance", "repairs and maintenance", "cleaners"],
  },
  {
    code: "OPX-REPAIR-OWNER",
    category: "Repairs & Maintenance (Personal/Home)",
    type: "opex",
    addBack: true,
    aliases: ["home repairs", "personal repairs", "owner home maintenance", "landscape owner home", "personal home repair"],
  },
  {
    code: "OPX-SUPPLY",
    category: "Supplies (Business)",
    type: "opex",
    aliases: ["supplies", "caretaking supplies", "cleaning supplies", "office supplies", "general supplies", "facility supplies", "facility supplies - other", "uniforms"],
  },
  {
    code: "OPX-SUPPLY-OWNER",
    category: "Supplies (Personal/Home)",
    type: "opex",
    addBack: true,
    aliases: ["home supplies", "personal supplies", "owner home supplies", "personal caretaking"],
  },
  {
    code: "OPX-SOFT",
    category: "Software & Subscriptions",
    type: "opex",
    aliases: ["software", "subscriptions", "pos", "gingr", "kennel booker", "saas", "dues and subscriptions", "dues & subscriptions"],
  },
  {
    code: "OPX-PROF",
    category: "Professional Fees (Business)",
    type: "opex",
    aliases: ["accounting", "legal", "payroll service", "bookkeeping", "professional fees", "cpa", "legal expenses", "accounting expense"],
  },
  {
    code: "OPX-PROF-OWNER",
    category: "Professional Fees (Personal)",
    type: "opex",
    addBack: true,
    aliases: ["personal legal", "personal accounting", "owner legal fees", "personal professional fees"],
  },
  {
    code: "OPX-BANK",
    category: "Bank & Merchant Fees",
    type: "opex",
    aliases: ["square processing fees", "credit card processing", "bank charges", "merchant fees", "bank fees", "bank service charges"],
  },
  {
    code: "OPX-VET",
    category: "Emergency Vet (Business)",
    type: "opex",
    aliases: ["emergency vet business", "boarded animal vet", "client pet vet expense", "vet commission"],
  },
  {
    code: "OPX-VET-OWNER",
    category: "Emergency Vet (Personal)",
    type: "opex",
    addBack: true,
    aliases: ["personal vet", "owner pet vet", "personal emergency vet", "owner vet expense"],
  },
  {
    code: "OPX-DEPR",
    category: "Depreciation & Amortization",
    type: "opex",
    aliases: ["depreciation expense", "amortization", "d&a", "depreciation", "depreciation & amortization"],
  },
  {
    code: "OPX-INT",
    category: "Interest Expense",
    type: "opex",
    aliases: ["interest expense", "loan interest", "interest", "penalty and interest"],
  },

  // ── OPERATING EXPENSES — PERSONAL / OWNER (100% add-back) ───────────────
  {
    code: "OPX-MEALS",
    category: "Meals & Entertainment (Business)",
    type: "opex",
    aliases: ["business meals", "staff meals", "client entertainment", "meals and entertainment", "meals & entertainment"],
  },
  {
    code: "OPX-MEALS-OWNER",
    category: "Meals & Entertainment (Personal)",
    type: "opex",
    addBack: true,
    aliases: ["personal meals", "owner meals", "personal entertainment", "personal dining"],
  },
  {
    code: "OPX-TRAVEL",
    category: "Travel (Business)",
    type: "opex",
    aliases: ["business travel", "conference travel", "travel expense", "transportation & travel", "automobile expense", "vehicle expense"],
  },
  {
    code: "OPX-TRAVEL-OWNER",
    category: "Travel (Personal)",
    type: "opex",
    addBack: true,
    aliases: ["personal travel", "owner travel", "personal airfare", "personal lodging", "vacation"],
  },
  {
    code: "OPX-DONAT",
    category: "Donations",
    type: "opex",
    addBack: true,
    aliases: ["donations", "church", "non profit", "charitable", "sponsorship", "charitable contributions"],
  },
  {
    code: "OPX-GIFTS",
    category: "Gifts Given (Personal)",
    type: "opex",
    addBack: true,
    aliases: ["gifts", "gifts given", "personal gifts"],
  },
  {
    code: "OPX-OFFICE-OWNER",
    category: "Office Expenses (Personal)",
    type: "opex",
    addBack: true,
    aliases: ["personal office", "owner office supplies", "home office", "personal admin"],
  },
  {
    code: "OPX-POSTAGE-OWNER",
    category: "Postage & Delivery (Personal)",
    type: "opex",
    addBack: true,
    aliases: ["personal postage", "personal delivery", "personal shipping", "shipping freight and delivery", "shipping, freight, and delivery"],
  },
  {
    code: "OPX-DUES-OWNER",
    category: "Dues & Subscriptions (Personal)",
    type: "opex",
    addBack: true,
    aliases: ["personal dues", "personal subscriptions", "personal memberships", "owner dues"],
  },
  {
    code: "OPX-TAX",
    category: "Taxes & Licenses",
    type: "opex",
    aliases: ["taxes & licenses", "permits", "licenses", "corporate tax expense", "tax expense"],
  },
  {
    code: "OPX-ONEOFF",
    category: "One-Off Non-Recurring Expenses",
    type: "opex",
    addBack: true,
    aliases: ["one-off", "non-recurring", "extraordinary", "leasehold improvement", "leasehold improvements", "losses", "exchange gain or loss", "unrealized foreign ex gain/loss"],
  },
  {
    code: "OPX-OTHER",
    category: "Other Operating Expenses",
    type: "opex",
    aliases: ["miscellaneous", "other expenses", "uncategorized expense", "uncategorized expenses", "miscellaneous expenses", "ask my accountant", "reconciliation discrepancies", "fixed costs - other", "removing credits/balances", "seminar"],
  },

  // ── WORKING CAPITAL ──────────────────────────────────────────────────────
  {
    code: "WC-CASH",
    category: "Cash & Equivalents",
    type: "working_capital",
    aliases: ["checking", "cash", "petty cash", "savings", "money market"],
  },
  {
    code: "WC-AR",
    category: "Accounts Receivable",
    type: "working_capital",
    aliases: ["accounts receivable", "a/r", "ar", "trade receivables"],
  },
  {
    code: "WC-INV",
    category: "Inventory",
    type: "working_capital",
    aliases: ["inventory", "retail inventory"],
  },
  {
    code: "WC-PREPAID",
    category: "Prepaid Expenses",
    type: "working_capital",
    aliases: ["prepaid", "prepaid insurance", "prepaid rent"],
  },
  {
    code: "WC-AP",
    category: "Accounts Payable",
    type: "working_capital",
    aliases: ["accounts payable", "a/p", "ap", "trade payables"],
  },
  {
    code: "WC-ACCR",
    category: "Accrued Liabilities",
    type: "working_capital",
    aliases: ["accrued expenses", "accrued wages", "accrued liabilities", "payroll liabilities"],
  },
  {
    code: "WC-DREV",
    category: "Deferred Revenue",
    type: "working_capital",
    aliases: ["deferred revenue", "gift cards", "prepaid packages", "customer deposits"],
  },
];

export const TAXONOMY_BY_CODE = Object.fromEntries(
  CANTARA_TAXONOMY.map((entry) => [entry.code, entry]),
) as Record<string, TaxonomyEntry>;

export const REVENUE_CODES = CANTARA_TAXONOMY.filter((entry) => entry.type === "revenue").map((entry) => entry.code);
export const COGS_CODES = CANTARA_TAXONOMY.filter((entry) => entry.type === "cogs").map((entry) => entry.code);
export const OPEX_CODES = CANTARA_TAXONOMY.filter((entry) => entry.type === "opex").map((entry) => entry.code);
export const WORKING_CAPITAL_CODES = CANTARA_TAXONOMY.filter((entry) => entry.type === "working_capital").map((entry) => entry.code);
export const EBITDA_EXCLUDED_OPEX_CODES = ["OPX-DEPR", "OPX-INT"];
export const EBITDA_OPERATING_EXPENSE_CODES = OPEX_CODES.filter((code) => !EBITDA_EXCLUDED_OPEX_CODES.includes(code));

/** Codes where the full GL amount is added back in EBITDA normalization */
export const ADD_BACK_CODES = CANTARA_TAXONOMY.filter((entry) => entry.addBack).map((entry) => entry.code);

export function getCategoryLabel(code: string) {
  return TAXONOMY_BY_CODE[code]?.category ?? code;
}

export function isAddBackCode(code: string) {
  return TAXONOMY_BY_CODE[code]?.addBack === true;
}
