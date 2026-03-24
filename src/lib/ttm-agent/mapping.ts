import { suggestCantaraMappings } from "@/lib/ttm-agent/claude";
import { MappedLedgerRow, NormalizedLedgerRow } from "@/lib/ttm-agent/types";
import { CANTARA_TAXONOMY, TaxonomyEntry, WORKING_CAPITAL_CODES } from "@/lib/ttm-agent/taxonomy";

type MappingProjection = Pick<
  MappedLedgerRow,
  "cantaraCode" | "category" | "categoryType" | "mappingMethod" | "mappingConfidence" | "candidateCodes" | "isMajor"
>;

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "of",
  "to",
  "expense",
  "expenses",
  "income",
  "revenue",
  "account",
  "accounts",
  "other",
  "total",
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

function isCalculatedSummaryRow(row: NormalizedLedgerRow) {
  const normalized = normalizeText(row.accountName);
  if (!normalized) return true;

  return (
    /^total\b/.test(normalized) ||
    /(gross profit|gross margin|net income|net ordinary income|ordinary income|ebitda|subtotal|pre recast|net working capital|working capital|current assets|current liabilities)/.test(normalized)
  );
}

function shouldExcludeFromMapping(row: NormalizedLedgerRow, statementKind: "pl" | "bs") {
  if (isCalculatedSummaryRow(row)) return true;
  return false;
}

function getStatementTypesForGlPrefix(prefix: number | null) {
  if (prefix === 4) return new Set<TaxonomyEntry["type"]>(["revenue"]);
  if (prefix === 5) return new Set<TaxonomyEntry["type"]>(["cogs"]);
  if (prefix === 6 || prefix === 7 || prefix === 8 || prefix === 9) return new Set<TaxonomyEntry["type"]>(["opex"]);
  if (prefix === 1 || prefix === 2) return new Set<TaxonomyEntry["type"]>(["working_capital"]);
  return null;
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

function getCandidateEntries(row: NormalizedLedgerRow, statementKind: "pl" | "bs") {
  const allowedEntries = getAllowedEntries(statementKind);
  const prefixTypes = getStatementTypesForGlPrefix(parseGlPrefix(row.accountCode));
  if (!prefixTypes) return allowedEntries;
  return allowedEntries.filter((entry) => prefixTypes.has(entry.type));
}

function buildInitialMapping(row: NormalizedLedgerRow, statementKind: "pl" | "bs"): MappingProjection {
  if (shouldExcludeFromMapping(row, statementKind)) {
    const maxAbsMonthlyValue = Math.max(...Object.values(row.valuesByMonth).map((value) => Math.abs(value)), 0);
    const isMajor = maxAbsMonthlyValue >= 1000 || Math.abs(row.total) >= 12000;
    return {
      cantaraCode: null,
      category: null,
      categoryType: statementKind === "pl" ? ("other" as const) : ("working_capital" as const),
      mappingMethod: "unmapped" as const,
      mappingConfidence: 0,
      candidateCodes: [],
      isMajor,
    };
  }

  const candidateEntries = getCandidateEntries(row, statementKind);
  const ranked = candidateEntries
    .map((entry) => ({ entry, score: scoreAlias(`${row.accountCode ?? ""} ${row.accountName}`, entry) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const second = ranked[1];
  const maxAbsMonthlyValue = Math.max(...Object.values(row.valuesByMonth).map((value) => Math.abs(value)), 0);
  const isMajor = maxAbsMonthlyValue >= 1000 || Math.abs(row.total) >= 12000;

  if (best && best.score >= 0.92 && (!second || best.score - second.score >= 0.1)) {
    return {
      cantaraCode: best.entry.code,
      category: best.entry.category,
      categoryType: best.entry.type,
      mappingMethod: best.score >= 0.98 ? ("exact" as const) : ("alias" as const),
      mappingConfidence: best.score,
      candidateCodes: ranked.slice(0, 3).map((candidate) => candidate.entry.code),
      isMajor,
    };
  }

  if (best && best.score >= 0.72 && (!second || best.score - second.score >= 0.08)) {
    return {
      cantaraCode: best.entry.code,
      category: best.entry.category,
      categoryType: best.entry.type,
      mappingMethod: "fuzzy" as const,
      mappingConfidence: best.score,
      candidateCodes: ranked.slice(0, 3).map((candidate) => candidate.entry.code),
      isMajor,
    };
  }

  return {
    cantaraCode: null,
    category: null,
    categoryType: statementKind === "pl" ? ("other" as const) : ("working_capital" as const),
    mappingMethod: "unmapped" as const,
    mappingConfidence: best?.score ?? 0,
    candidateCodes: ranked.slice(0, 3).map((candidate) => candidate.entry.code),
    isMajor,
  };
}

export async function mapLedgerRows(rows: NormalizedLedgerRow[], statementKind: "pl" | "bs") {
  const initial: MappedLedgerRow[] = rows.map((row) => ({
    ...row,
    ...buildInitialMapping(row, statementKind),
  }));

  const unresolved = initial.filter(
    (row) => (!row.cantaraCode || row.mappingMethod === "unmapped") && !shouldExcludeFromMapping(row, statementKind),
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
    if (!matchedEntry) {
      return row;
    }

    return {
      ...row,
      cantaraCode: matchedEntry.code,
      category: matchedEntry.category,
      categoryType: matchedEntry.type,
      mappingMethod: "claude",
      mappingConfidence: suggestion.confidence,
      candidateCodes: [matchedEntry.code, ...row.candidateCodes].slice(0, 3),
    };
  });
}
