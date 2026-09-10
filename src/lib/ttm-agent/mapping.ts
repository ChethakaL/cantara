import { suggestCantaraMappings } from "@/lib/ttm-agent/claude";
import { MappedLedgerRow, NormalizedLedgerRow } from "@/lib/ttm-agent/types";
import { CANTARA_TAXONOMY, TaxonomyEntry, WORKING_CAPITAL_CODES } from "@/lib/ttm-agent/taxonomy";

type MappingProjection = Pick<
  MappedLedgerRow,
  "cantaraCode" | "category" | "categoryType" | "mappingMethod" | "mappingConfidence" | "candidateCodes" | "isMajor"
>;

// Only remove truly meaningless words — keep "expense", "income", "revenue" etc.
// as they help distinguish "Rent Expense" from "Rent Income"
const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "of",
  "to",
  "total",
  "account",
  "accounts",
]);

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s/&]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token && !STOPWORDS.has(token));
}

function parseGlPrefix(accountCode: string | null) {
  if (!accountCode) return null;
  const digits = accountCode.replace(/\D/g, "");
  if (digits.length < 1) return null;
  return Number(digits[0]);
}

// Cantara GL codes that are computed subtotals/rollups — never map as accounts.
// These exist in F1/F2 for human readability but are derived, not leaf-level data.
const ROLLUP_GL_CODES = new Set([
  // P&L rollup lines (computed from leaf accounts)
  "REV-TOTAL", "REV-SVC", "COGS-TOTAL", "GP",
  "PAY-TOTAL", "OPX-TOTAL", "NOI", "NET-INC",
  "OTH-INC", "OTH-EXP", "OTH-NET",

  // BS structural totals
  "CA-OTHER", "CA-TOTAL", "FA-TOTAL", "OA-TOTAL", "ASSET-TOTAL",
  "CL-OTHER", "CL-TOTAL", "LIAB-TOTAL", "EQ-TOTAL",

  // Equity accounts — outside P&L scope
  "EQ-DRAWS", "EQ-NETINC",

  // Fixed asset line (BS only)
  "FA-LHI",
]);

function isCalculatedSummaryRow(row: NormalizedLedgerRow) {
  const normalized = normalizeText(row.accountName);
  if (!normalized) return true;

  // Check Cantara GL code first — this catches rollup rows even if the name looks normal
  if (row.accountCode) {
    const code = row.accountCode.trim().toUpperCase();
    if (ROLLUP_GL_CODES.has(code)) return true;
    // Also catch any code ending in -TOTAL or -OTHER (future-proofing)
    if (/-TOTAL$/.test(code) || code === "GP" || code === "NET-INC") return true;
  }

  return (
    /^total\b/.test(normalized) ||
    /(gross profit|gross margin|net income|net ordinary income|ordinary income|ebitda|subtotal|pre recast|net working capital|working capital|current assets|current liabilities|total assets|total liabilities|total equity|owner.?s? equity|retained earnings)/.test(normalized)
  );
}

function shouldExcludeFromMapping(row: NormalizedLedgerRow, statementKind: "pl" | "bs") {
  if (isCalculatedSummaryRow(row)) return true;

  // Exclude equity and BS-only accounts from P&L mapping
  if (statementKind === "pl" && row.accountCode) {
    const code = row.accountCode.trim().toUpperCase();
    // Equity accounts have no place in P&L taxonomy
    if (code.startsWith("EQ-")) return true;
    // Fixed asset lines belong in BS, not P&L
    if (code.startsWith("FA-")) return true;
  }

  return false;
}

function getStatementTypesForGlPrefix(prefix: number | null) {
  if (prefix === 4) return new Set<TaxonomyEntry["type"]>(["revenue"]);
  if (prefix === 5) return new Set<TaxonomyEntry["type"]>(["cogs"]);
  if (prefix === 6 || prefix === 7 || prefix === 8 || prefix === 9) return new Set<TaxonomyEntry["type"]>(["opex"]);
  if (prefix === 1 || prefix === 2) return new Set<TaxonomyEntry["type"]>(["working_capital"]);
  return null;
}

/**
 * When the GL account code has no usable numeric prefix, infer P&L type from the
 * account name so expense lines never get revenue candidates (and vice versa).
 */
function inferStatementTypesFromLabel(accountLabel: string): Set<TaxonomyEntry["type"]> | null {
  const text = normalizeText(accountLabel);
  if (!text) return null;

  const revenueHints =
    /\b(revenue|revenues|sales|income(?!\s+tax)|boarding|daycare|grooming|training|retail sales|membership|tips?\b|fee income|service income)\b/;
  const cogsHints =
    /\b(cogs|cost of (goods|sales|services)|direct cost|product cost|retail cost)\b/;
  const opexHints =
    /\b(expense|expenses|expenditure|expenditures|opex|overhead|payroll|wages|salary|salaries|rent|utilities|insurance|marketing|advertising|repair|repairs|maintenance|supplies|software|professional fees|legal|accounting|bank fees|office|depreciation|amortization|interest expense|taxes? (and|&) licenses|owner draw|draws?)\b/;

  const types = new Set<TaxonomyEntry["type"]>();
  if (revenueHints.test(text)) types.add("revenue");
  if (cogsHints.test(text)) types.add("cogs");
  if (opexHints.test(text)) types.add("opex");

  // Strong expense words without revenue/cogs → opex only
  if (/\b(expenditure|expenditures|expense|expenses)\b/.test(text) && !revenueHints.test(text)) {
    return new Set<TaxonomyEntry["type"]>(["opex", "cogs"]);
  }

  if (types.size > 0) return types;
  return null;
}

function getCandidateEntries(row: NormalizedLedgerRow, statementKind: "pl" | "bs") {
  const allowedEntries = getAllowedEntries(statementKind);
  if (statementKind !== "pl") return allowedEntries;

  const prefixTypes = getStatementTypesForGlPrefix(parseGlPrefix(row.accountCode));
  const inferredTypes = inferStatementTypesFromLabel(`${row.accountCode ?? ""} ${row.accountName}`);
  const typeFilter = prefixTypes ?? inferredTypes;

  // Never fall back to the full P&L taxonomy — that surfaces REV-* as the first
  // zero-score candidates for unlabeled expense accounts.
  if (!typeFilter) {
    return allowedEntries.filter((entry) => entry.type === "opex" || entry.type === "cogs");
  }
  return allowedEntries.filter((entry) => typeFilter.has(entry.type));
}

function isCodeAllowedForRow(code: string, row: NormalizedLedgerRow, statementKind: "pl" | "bs") {
  return getCandidateEntries(row, statementKind).some((entry) => entry.code === code);
}

function scoreAlias(accountLabel: string, entry: TaxonomyEntry) {
  const normalizedAccount = normalizeText(accountLabel);
  const accountTokens = tokenize(accountLabel);
  let bestScore = 0;

  for (const alias of [entry.category, ...entry.aliases]) {
    const normalizedAlias = normalizeText(alias);
    if (normalizedAccount === normalizedAlias) return 0.99;
    if (normalizedAccount.includes(normalizedAlias) || normalizedAlias.includes(normalizedAccount)) {
      bestScore = Math.max(bestScore, 0.9);
      continue;
    }

    const aliasTokens = tokenize(alias);
    const overlap = aliasTokens.filter((token) => accountTokens.includes(token)).length;
    if (!aliasTokens.length) continue;
    bestScore = Math.max(bestScore, overlap / aliasTokens.length);
  }

  return bestScore;
}

function getAllowedEntries(statementKind: "pl" | "bs") {
  return statementKind === "pl"
    ? CANTARA_TAXONOMY.filter((entry) => entry.type !== "working_capital")
    : CANTARA_TAXONOMY.filter((entry) => WORKING_CAPITAL_CODES.includes(entry.code));
}

function getExplicitMappingOverride(row: NormalizedLedgerRow, statementKind: "pl" | "bs"): MappingProjection | null {
  if (statementKind !== "pl") return null;

  const normalizedAccount = normalizeText(`${row.accountCode ?? ""} ${row.accountName}`);
  if (!normalizedAccount) return null;

  const maxAbsMonthlyValue = Math.max(...Object.values(row.valuesByMonth).map((value) => Math.abs(value)), 0);
  const isMajor = maxAbsMonthlyValue >= 1000 || Math.abs(row.total) >= 12000;

  // WS2 architecture requires any owner/officer/family compensation to map to OPX-LABOR-OWN.
  // This also catches "Donna Harris - Draw", "John Smith - Draw" type QB entries.
  const ownerCompPattern =
    /\b(officer|owner|member distributions?|shareholder|share holder|partner draw|owner draw|s corp|s-corp|family member)\b/;
  // After normalization, "Donna Harris - Draw" becomes "donna harris draw"
  // Match "draw" or "draws" at the end of the account name (owner draw entries)
  const drawPattern = /\bdraws?\s*$/;
  if (ownerCompPattern.test(normalizedAccount) || drawPattern.test(normalizedAccount)) {
    return {
      cantaraCode: "OPX-LABOR-OWN",
      category: "Owner Compensation",
      categoryType: "opex",
      mappingMethod: "alias",
      mappingConfidence: 0.99,
      candidateCodes: ["OPX-LABOR-OWN", "OPX-LABOR-MGMT", "OPX-LABOR-TAX"],
      isMajor,
    };
  }

  return null;
}

function buildInitialMapping(row: NormalizedLedgerRow, statementKind: "pl" | "bs"): MappingProjection {
  console.log(`[MAPPING] Account: "${row.accountName}" | Code: "${row.accountCode}" | Kind: ${statementKind}`);
  if (shouldExcludeFromMapping(row, statementKind)) {
    console.log(`[MAPPING]   → EXCLUDED (summary/rollup row)`);

    // Mark as excluded — NOT "unmapped". Excluded rows are computed subtotals,
    // rollup lines, or out-of-scope accounts that should never appear in the
    // GL mapping queue or be counted in financial calculations.
    return {
      cantaraCode: "_EXCLUDED",
      category: "Excluded (computed subtotal or out-of-scope)",
      categoryType: "other" as const,
      mappingMethod: "exact" as const,
      mappingConfidence: 1,
      candidateCodes: [],
      isMajor: false,
    };
  }

  const explicitOverride = getExplicitMappingOverride(row, statementKind);
  if (explicitOverride) {
    return explicitOverride;
  }

  const candidateEntries = getCandidateEntries(row, statementKind);
  const ranked = candidateEntries
    .map((entry) => ({ entry, score: scoreAlias(`${row.accountCode ?? ""} ${row.accountName}`, entry) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const second = ranked[1];
  const maxAbsMonthlyValue = Math.max(...Object.values(row.valuesByMonth).map((value) => Math.abs(value)), 0);
  const isMajor = maxAbsMonthlyValue >= 1000 || Math.abs(row.total) >= 12000;
  // Prefer scored matches; if everything is zero, still only expose type-filtered codes.
  const topCandidates = (
    ranked.some((item) => item.score > 0)
      ? ranked.filter((item) => item.score > 0)
      : ranked
  )
    .slice(0, 3)
    .map((candidate) => candidate.entry.code);

  console.log(`[MAPPING]   Best: ${best?.entry.code} score=${best?.score.toFixed(3)} | Second: ${second?.entry.code} score=${second?.score.toFixed(3)} | isMajor=${isMajor}`);
  if (best && best.score >= 0.75 && (!second || best.score - second.score >= 0.06)) {
    console.log(`[MAPPING]   → AUTO-MAPPED to ${best.entry.code} (${best.entry.category})`);
    return {
      cantaraCode: best.entry.code,
      category: best.entry.category,
      categoryType: best.entry.type,
      mappingMethod: best.score >= 0.98 ? ("exact" as const) : ("alias" as const),
      mappingConfidence: best.score,
      candidateCodes: topCandidates,
      isMajor,
    };
  }

  if (best && best.score >= 0.50 && (!second || best.score - second.score >= 0.04)) {
    return {
      cantaraCode: best.entry.code,
      category: best.entry.category,
      categoryType: best.entry.type,
      mappingMethod: "fuzzy" as const,
      mappingConfidence: best.score,
      candidateCodes: topCandidates,
      isMajor,
    };
  }

  return {
    cantaraCode: null,
    category: null,
    categoryType: statementKind === "pl" ? ("other" as const) : ("working_capital" as const),
    mappingMethod: "unmapped" as const,
    mappingConfidence: best?.score ?? 0,
    candidateCodes: topCandidates,
    isMajor,
  };
}

export async function mapLedgerRows(rows: NormalizedLedgerRow[], statementKind: "pl" | "bs") {
  const initial: MappedLedgerRow[] = rows.map((row) => ({
    ...row,
    ...buildInitialMapping(row, statementKind),
  }));

  const unresolved = initial.filter(
    (row) => row.cantaraCode !== "_EXCLUDED" && (!row.cantaraCode || row.mappingMethod === "unmapped"),
  );
  if (!unresolved.length) return initial;

  const suggestions = await suggestCantaraMappings(
    unresolved.map((row) => ({
      accountName: row.accountName,
      accountCode: row.accountCode,
      statementKind,
    })),
    Array.from(new Set(unresolved.flatMap((row) => getCandidateEntries(row, statementKind).map((entry) => entry.code)))),
  );

  const suggestionMap = new Map(
    suggestions.map((suggestion) => [`${suggestion.accountCode ?? ""}|${suggestion.accountName}`, suggestion]),
  );

  return initial.map((row): MappedLedgerRow => {
    if (row.cantaraCode && row.mappingMethod !== "unmapped") {
      return row;
    }

    const suggestion = suggestionMap.get(`${row.accountCode ?? ""}|${row.accountName}`);
    if (!suggestion?.cantaraCode || suggestion.confidence < 0.7) {
      return row;
    }

    const matchedEntry = CANTARA_TAXONOMY.find((entry) => entry.code === suggestion.cantaraCode);
    if (!matchedEntry || !isCodeAllowedForRow(matchedEntry.code, row, statementKind)) {
      return row;
    }

    return {
      ...row,
      cantaraCode: matchedEntry.code,
      category: matchedEntry.category,
      categoryType: matchedEntry.type,
      mappingMethod: "claude",
      mappingConfidence: suggestion.confidence,
      candidateCodes: [matchedEntry.code, ...row.candidateCodes.filter((code) => code !== matchedEntry.code)].slice(0, 3),
    };
  });
}
