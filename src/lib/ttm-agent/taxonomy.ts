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
    aliases: ["boarding", "overnight boarding", "suite boarding", "lodging"],
  },
  {
    code: "REV-DAY",
    category: "Daycare Revenue",
    type: "revenue",
    aliases: ["daycare", "dog daycare", "day care", "half-day"],
  },
  {
    code: "REV-GROOM",
    category: "Grooming Revenue",
    type: "revenue",
    aliases: ["grooming", "bath & brush", "bath and brush", "full groom"],
  },
  {
    code: "REV-TRAIN",
    category: "Training Revenue",
    type: "revenue",
    aliases: ["training", "group class", "private training"],
  },
  {
    code: "REV-RETAIL",
    category: "Retail Revenue",
    type: "revenue",
    aliases: ["retail", "merchandise", "food sales", "product sales"],
  },
  {
    code: "REV-VET",
    category: "Veterinary / Add-On Services",
    type: "revenue",
    aliases: ["vet services", "medication admin", "health check", "vaccination"],
  },
  {
    code: "REV-OTHER",
    category: "Other / Miscellaneous Revenue",
    type: "revenue",
    aliases: ["miscellaneous income", "other revenue", "other income", "discount income"],
  },
  {
    code: "COGS-LABOR",
    category: "Direct Labor - Service Delivery",
    type: "cogs",
    aliases: ["pet care staff", "groomer wages", "trainer wages", "direct labor", "service labor"],
  },
  {
    code: "COGS-SUPPLY",
    category: "Direct Supplies",
    type: "cogs",
    aliases: ["grooming supplies", "boarding supplies", "food", "consumables", "service supplies"],
  },
  {
    code: "COGS-RETAIL",
    category: "Cost of Retail Goods Sold",
    type: "cogs",
    aliases: ["retail cogs", "merchandise cost", "cost of retail goods sold"],
  },
  {
    code: "OPX-RENT",
    category: "Rent & Occupancy",
    type: "opex",
    aliases: ["rent", "base rent", "cam charges", "occupancy", "lease expense"],
  },
  {
    code: "OPX-UTIL",
    category: "Utilities",
    type: "opex",
    aliases: ["electric", "gas", "water", "internet", "phone", "utilities"],
  },
  {
    code: "OPX-LABOR-MGMT",
    category: "Management / Admin Labor",
    type: "opex",
    aliases: ["manager salary", "admin wages", "office staff", "management wages", "admin payroll"],
  },
  {
    code: "OPX-LABOR-OWN",
    category: "Owner Compensation",
    type: "opex",
    aliases: ["owner draw", "owner salary", "officer compensation", "member distributions"],
  },
  {
    code: "OPX-PAYROLL-TAX",
    category: "Payroll Taxes & Benefits",
    type: "opex",
    aliases: ["payroll tax", "fica", "health insurance", "401k", "benefits"],
  },
  {
    code: "OPX-MKTG",
    category: "Marketing & Advertising",
    type: "opex",
    aliases: ["google ads", "facebook ads", "marketing", "advertising", "promotion"],
  },
  {
    code: "OPX-INSUR",
    category: "Insurance",
    type: "opex",
    aliases: ["general liability", "property insurance", "workers comp", "insurance"],
  },
  {
    code: "OPX-REPAIR",
    category: "Repairs & Maintenance",
    type: "opex",
    aliases: ["repairs", "maintenance", "equipment repair", "building maintenance"],
  },
  {
    code: "OPX-SOFT",
    category: "Software & Subscriptions",
    type: "opex",
    aliases: ["software", "saas", "subscriptions", "technology", "hosting"],
  },
  {
    code: "OPX-PROF",
    category: "Professional Fees",
    type: "opex",
    aliases: ["accounting", "legal", "consulting", "professional fees", "outside services"],
  },
  {
    code: "OPX-BANK",
    category: "Bank Fees & Merchant Processing",
    type: "opex",
    aliases: ["bank fees", "credit card processing", "merchant fees", "merchant processing"],
  },
  {
    code: "OPX-DEPR",
    category: "Depreciation & Amortization",
    type: "opex",
    aliases: ["depreciation", "amortization", "d&a", "depr & amort"],
  },
  {
    code: "OPX-OTHER",
    category: "Other Operating Expenses",
    type: "opex",
    aliases: ["miscellaneous", "other expenses", "general expense", "office expense"],
  },
  {
    code: "WC-AR",
    category: "Accounts Receivable",
    type: "working_capital",
    aliases: ["accounts receivable", "trade receivables", "a/r", "ar"],
  },
  {
    code: "WC-INV",
    category: "Inventory",
    type: "working_capital",
    aliases: ["inventory", "retail inventory", "supplies inventory"],
  },
  {
    code: "WC-PREPAID",
    category: "Prepaid Expenses",
    type: "working_capital",
    aliases: ["prepaid", "prepaid insurance", "prepaid rent", "deposit asset"],
  },
  {
    code: "WC-AP",
    category: "Accounts Payable",
    type: "working_capital",
    aliases: ["accounts payable", "trade payables", "a/p", "ap"],
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

export function getCategoryLabel(code: string) {
  return TAXONOMY_BY_CODE[code]?.category ?? code;
}
