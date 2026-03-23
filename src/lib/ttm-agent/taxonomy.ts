export interface TaxonomyEntry {
  code: string;
  category: string;
  type: "revenue" | "cogs" | "opex" | "working_capital";
  aliases: string[];
}

export const CANTARA_TAXONOMY: TaxonomyEntry[] = [
  {
    code: "REV-BOARD",
    category: "Boarding Revenue",
    type: "revenue",
    aliases: ["boarding", "overnight boarding", "suite boarding", "kenneling", "lodging"],
  },
  {
    code: "REV-DAY",
    category: "Daycare Revenue",
    type: "revenue",
    aliases: ["daycare", "dog daycare", "day care", "half day daycare", "drop in"],
  },
  {
    code: "REV-GROOM",
    category: "Grooming Revenue",
    type: "revenue",
    aliases: ["grooming", "bath & brush", "bath and brush", "full groom", "groom commission income"],
  },
  {
    code: "REV-TRAIN",
    category: "Training Revenue",
    type: "revenue",
    aliases: ["training", "group class", "private training", "board and train", "board & train"],
  },
  {
    code: "REV-RETAIL",
    category: "Retail Revenue",
    type: "revenue",
    aliases: ["retail", "merchandise", "food sales", "product sales"],
  },
  {
    code: "REV-TIPS",
    category: "Tips",
    type: "revenue",
    aliases: ["tips", "paycheck tips", "cash tips", "tips received"],
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
    aliases: ["discount", "discounts", "refund", "refunds", "promotional discounts"],
  },
  {
    code: "REV-OTHER",
    category: "Other Revenue",
    type: "revenue",
    aliases: ["uncategorized income", "miscellaneous income", "other revenue", "other income"],
  },
  {
    code: "COGS-SUPPLY",
    category: "Direct Service Supplies",
    type: "cogs",
    aliases: ["grooming supplies", "boarding supplies", "service supplies", "shampoo", "bedding consumed"],
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
    aliases: ["other direct cost", "other cogs", "cost of sales"],
  },
  {
    code: "OPX-LABOR-STAFF",
    category: "Staff / Direct Labor",
    type: "opex",
    aliases: ["wages", "groom commission", "day labor", "hourly wages", "kennel staff", "staff payroll"],
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
    aliases: ["officer wages", "owner draw", "owner salary", "s corp distributions", "member distributions", "officer compensation"],
  },
  {
    code: "OPX-LABOR-TAX",
    category: "Payroll Taxes & Benefits",
    type: "opex",
    aliases: ["employer taxes", "fica", "simple ira", "health insurance", "payroll tax", "bcbs", "benefits"],
  },
  {
    code: "OPX-TIPS-OUT",
    category: "Tips Paid Out",
    type: "opex",
    aliases: ["cash tips paid out", "tips paid out", "tip payout"],
  },
  {
    code: "OPX-RENT",
    category: "Base Rent",
    type: "opex",
    aliases: ["lease", "base rent", "rent"],
  },
  {
    code: "OPX-RENT-NNN",
    category: "NNN / CAM Charges",
    type: "opex",
    aliases: ["cams", "cam", "nnn", "management fee", "sales tax on rent", "common area maintenance"],
  },
  {
    code: "OPX-UTIL",
    category: "Utilities",
    type: "opex",
    aliases: ["electric", "gas", "water", "internet", "phone", "telecom", "utilities"],
  },
  {
    code: "OPX-MKTG",
    category: "Marketing & Advertising",
    type: "opex",
    aliases: ["advertising", "google ads", "facebook", "marketing", "direct mail", "periodical"],
  },
  {
    code: "OPX-INSUR",
    category: "Insurance",
    type: "opex",
    aliases: ["insurance", "liability", "workers comp", "property insurance"],
  },
  {
    code: "OPX-REPAIR",
    category: "Repairs & Maintenance",
    type: "opex",
    aliases: ["repairs", "maintenance", "janitorial", "pest control", "waste removal", "building maintenance"],
  },
  {
    code: "OPX-SUPPLY",
    category: "Supplies",
    type: "opex",
    aliases: ["supplies", "office supplies"],
  },
  {
    code: "OPX-SOFT",
    category: "Software & Subscriptions",
    type: "opex",
    aliases: ["software", "subscriptions", "dues", "pos", "gingr", "kennel booker", "saas"],
  },
  {
    code: "OPX-PROF",
    category: "Professional Fees",
    type: "opex",
    aliases: ["accounting", "legal", "payroll service", "consulting", "bookkeeping", "professional fees"],
  },
  {
    code: "OPX-BANK",
    category: "Bank & Merchant Fees",
    type: "opex",
    aliases: ["square processing fees", "credit card processing", "bank charges", "merchant fees", "bank fees"],
  },
  {
    code: "OPX-VET",
    category: "Emergency Vet",
    type: "opex",
    aliases: ["emergency vet", "veterinary", "vet expense"],
  },
  {
    code: "OPX-DEPR",
    category: "Depreciation & Amortization",
    type: "opex",
    aliases: ["depreciation expense", "amortization", "d&a", "depreciation"],
  },
  {
    code: "OPX-INT",
    category: "Interest Expense",
    type: "opex",
    aliases: ["interest expense", "loan interest", "interest"],
  },
  {
    code: "OPX-MEALS",
    category: "Meals & Entertainment",
    type: "opex",
    aliases: ["meals and entertainment", "dining w staff", "dining w clients", "meals"],
  },
  {
    code: "OPX-TRAVEL",
    category: "Travel",
    type: "opex",
    aliases: ["travel", "airfare", "lodging"],
  },
  {
    code: "OPX-DONAT",
    category: "Donations",
    type: "opex",
    aliases: ["donations", "church", "non profit"],
  },
  {
    code: "OPX-GIFTS",
    category: "Gifts",
    type: "opex",
    aliases: ["gifts", "gifts given"],
  },
  {
    code: "OPX-TAX",
    category: "Taxes & Licenses",
    type: "opex",
    aliases: ["taxes & licenses", "permits", "licenses"],
  },
  {
    code: "OPX-OTHER",
    category: "Other Operating Expenses",
    type: "opex",
    aliases: ["miscellaneous", "other expenses", "uncategorized expense"],
  },
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

export function getCategoryLabel(code: string) {
  return TAXONOMY_BY_CODE[code]?.category ?? code;
}
