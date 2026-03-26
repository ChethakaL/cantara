import * as XLSX from "xlsx";
import type { AnnualModel, AnnualModelYear, TtmAnalysisView, Ws2DerivedReportView, Ws2RecastFlagView, Ws2RecastView, TtmSummary, WorkingCapitalSummary } from "@/lib/ttm-agent/types";

/* ────────────────────────────────────────────────────────────────────────────
   V3 Section 13 — WS2 Excel Workbook Assembly
   Produces a 12-tab professional workbook per the Cantara specification.
   ──────────────────────────────────────────────────────────────────────────── */

// ── Number Format Constants ────────────────────────────────────────────────
const FMT_CURRENCY = '$#,##0;($#,##0);"-"';
const FMT_PERCENT = '0.0%';
const FMT_MULTIPLE = '0.0"x"';

function normalizeCurrencyString(raw: string) {
  return raw
    .replace(/\*\*/g, "")
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, "")
    .replace(/^\((.*)\)$/, "-$1");
}

export function parseCurrencyValue(raw: string | null | undefined) {
  if (!raw) return null;
  const parsed = Number(normalizeCurrencyString(raw));
  return Number.isFinite(parsed) ? parsed : null;
}

function readCurrencyValues(raw: string) {
  return Array.from(raw.matchAll(/-?\$[0-9,().-]+/g))
    .map((match) => parseCurrencyValue(match[0]))
    .filter((value): value is number => value !== null);
}

function extractFlagDollarImpact(raw: string) {
  const explicitImpactMatch =
    raw.match(/dollar impact[^-+$]*(-?\$[0-9,().-]+)/i) ??
    raw.match(/impact[^-+$]*(-?\$[0-9,().-]+)/i);

  if (explicitImpactMatch?.[1]) {
    return parseCurrencyValue(explicitImpactMatch[1]);
  }

  const values = readCurrencyValues(raw);
  return values.length === 1 ? values[0] : null;
}

function toFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeDescriptionKey(value: string) {
  return normalizeWhitespace(value).toLowerCase();
}

function parsePeriodReference(value: string | null | undefined) {
  if (!value) return null;

  const isoMonthMatch = value.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/);
  if (isoMonthMatch) {
    return `${isoMonthMatch[1]}-${isoMonthMatch[2]}`;
  }

  const monthMatch = value.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})/i);
  if (monthMatch) {
    const months = {
      january: "01",
      february: "02",
      march: "03",
      april: "04",
      may: "05",
      june: "06",
      july: "07",
      august: "08",
      september: "09",
      october: "10",
      november: "11",
      december: "12",
    } as const;
    return `${monthMatch[2]}-${months[monthMatch[1].toLowerCase() as keyof typeof months]}`;
  }

  const yearMatch = value.match(/\b(20\d{2})\b/);
  if (yearMatch) return `${yearMatch[1]}-01`;
  return null;
}

function compareMonthKey(a: string, b: string) {
  return a.localeCompare(b);
}

function monthsBetween(start: string, end: string) {
  if (!start || !end) return [];
  const result: string[] = [];
  let [year, month] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(endYear) || !Number.isFinite(endMonth)) {
    return [];
  }

  while (year < endYear || (year === endYear && month <= endMonth)) {
    result.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }

  return result;
}

function formatCurrencyForReport(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  const abs = Math.abs(value);
  const formatted = `$${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return value < 0 ? `-${formatted}` : formatted;
}

function formatPeriodMargin(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(1)}%`;
}

function formatMultipleForReport(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(2)}x`;
}

function periodMonths(year: AnnualModelYear) {
  const start = parsePeriodReference(year.periodStart);
  const end = parsePeriodReference(year.periodEnd);
  return start && end ? monthsBetween(start, end) : [];
}

function periodYearLabel(year: AnnualModelYear | undefined, fallbackFiscalYear: string) {
  if (!year) return fallbackFiscalYear;
  const parsedStart = parsePeriodReference(year.periodStart);
  if (parsedStart) return parsedStart.slice(0, 4);
  const fiscalYearMatch = year.fiscalYear.match(/\b(20\d{2})\b/);
  return fiscalYearMatch?.[1] ?? fallbackFiscalYear;
}

function sumGlForMonths(
  rows: Array<{ accountCode?: string | null; valuesByMonth?: Record<string, number> }>,
  glReference: string,
  months: string[],
) {
  return rows
    .filter((row) => (row.accountCode ?? "") === glReference)
    .reduce(
      (sum, row) =>
        sum + months.reduce((monthTotal, month) => monthTotal + Number(row.valuesByMonth?.[month] ?? 0), 0),
      0,
    );
}

type Ws22ScheduleItem = {
  index: string;
  category: string;
  description: string;
  glReference: string;
  ttmAmount: number | null;
  status: string;
};

type Ws22PeriodMappedItem = Ws22ScheduleItem & {
  sourcePeriod: string | null;
  sourceAmount: number | null;
};

function parseScheduleTable(reportMarkdown: string) {
  const match = reportMarkdown.match(/## EBITDA RECAST SCHEDULE[\s\S]*?\n(\| # \| Category \| Item Description \| GL Reference \| TTM Amount \| Status \|[\s\S]*?)(?:\n\*\*3-Year Normalized EBITDA Summary:|\n## FLAG LIST FOR ADMIN REVIEW|$)/i);
  if (!match) return [] as Ws22ScheduleItem[];

  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"))
    .filter((line) => !/^\|\s*-+/.test(line))
    .map((line) =>
      line
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => normalizeWhitespace(cell.replace(/\*\*/g, ""))),
    )
    .filter((cells) => cells.length >= 6 && cells[0] !== "#" && cells[1] !== "Category")
    .map((cells) => ({
      index: cells[0],
      category: cells[1],
      description: cells[2],
      glReference: cells[3],
      ttmAmount: parseCurrencyValue(cells[4]),
      status: cells[5],
    }))
    .filter(
      (item) =>
        !/TOTAL ADD-BACKS|NORMALIZED \/ RECAST EBITDA|NORMALIZED EBITDA MARGIN/i.test(item.category) &&
        !/TOTAL ADD-BACKS|NORMALIZED \/ RECAST EBITDA|NORMALIZED EBITDA MARGIN/i.test(item.description),
    );
}

function parseCategoryPeriodItems(reportMarkdown: string, heading: string) {
  const sectionMatch = reportMarkdown.match(new RegExp(`## ${heading}([\\s\\S]*?)(?=\\n## |$)`, "i"));
  if (!sectionMatch) return [] as Array<{ description: string; sourcePeriod: string | null; amount: number | null; glReference: string | null; status: string | null }>;

  return Array.from(sectionMatch[1].matchAll(/\*\*Item\s+\d+:[^\n]*\*\*[\s\S]*?(?=(?:\n\*\*Item\s+\d+:)|$)/g)).map((match) => {
    const block = match[0];
    const description = normalizeWhitespace(block.match(/- Description:\s*([^\n]+)/i)?.[1] ?? "");
    const sourcePeriod = parsePeriodReference(block.match(/- Year:\s*([^\n]+)/i)?.[1] ?? null);
    const amount = parseCurrencyValue(block.match(/- Amount:\s*(\$[0-9,().-]+)/i)?.[1]);
    const glReference = normalizeWhitespace(block.match(/- GL Account:\s*.*?\(([^)]+)\)/i)?.[1] ?? block.match(/- GL Account:\s*([^\n]+)/i)?.[1] ?? "");
    const status = normalizeWhitespace(block.match(/- Status:\s*([^\n]+)/i)?.[1] ?? "");
    return {
      description,
      sourcePeriod,
      amount,
      glReference: glReference || null,
      status: status || null,
    };
  });
}

function buildPeriodKey(glReference: string | null | undefined, amount: number | null | undefined) {
  return `${normalizeWhitespace(glReference ?? "").toLowerCase()}|${amount ?? "n/a"}`;
}

function buildWs22PeriodCorrection(args: {
  reportMarkdown: string;
  analysis: Pick<TtmAnalysisView, "ttmSummary" | "annualModel" | "normalizedData">;
  assumptions: Pick<Ws2RecastView["assumptions"], "replacementSalary" | "multipleLow" | "multipleMid" | "multipleHigh">;
}) {
  const scheduleItems = parseScheduleTable(args.reportMarkdown);
  const annualYears = args.analysis.annualModel?.years ?? [];
  const ttmSummary = args.analysis.ttmSummary;
  const mappedPlRows = Array.isArray(args.analysis.normalizedData?.mappedPlRows)
    ? (args.analysis.normalizedData?.mappedPlRows as Array<{ accountCode?: string | null; valuesByMonth?: Record<string, number> }>)
    : [];

  if (!ttmSummary || annualYears.length < 3 || scheduleItems.length === 0) {
    return null;
  }

  const ttmMonths = monthsBetween(ttmSummary.startMonth, ttmSummary.endMonth);
  const category3Items = parseCategoryPeriodItems(args.reportMarkdown, "CATEGORY 3: ONE-OFF NON-RECURRING EXPENSES");
  const category4Items = parseCategoryPeriodItems(args.reportMarkdown, "CATEGORY 4: TENANT IMPROVEMENT ADD-BACKS");
  const periodByDescription = new Map<string, string | null>();
  const periodByKey = new Map<string, string | null>();
  const amountByDescription = new Map<string, number | null>();
  const amountByKey = new Map<string, number | null>();
  for (const item of [...category3Items, ...category4Items]) {
    periodByDescription.set(normalizeDescriptionKey(item.description), item.sourcePeriod);
    periodByKey.set(buildPeriodKey(item.glReference, item.amount), item.sourcePeriod);
    amountByDescription.set(normalizeDescriptionKey(item.description), item.amount);
    amountByKey.set(buildPeriodKey(item.glReference, item.amount), item.amount);
  }
  const categoryPeriodOrder = {
    "One-Off Expenses": category3Items.map((item) => item.sourcePeriod),
    "TI Add-Backs": category4Items.map((item) => item.sourcePeriod),
  } as const;
  const categoryAmountOrder = {
    "One-Off Expenses": category3Items.map((item) => item.amount),
    "TI Add-Backs": category4Items.map((item) => item.amount),
  } as const;
  const categoryCounters = new Map<string, number>();

  const enrichedItems: Ws22PeriodMappedItem[] = scheduleItems.map((item) => ({
    ...item,
    sourcePeriod: (() => {
      const direct =
        periodByDescription.get(normalizeDescriptionKey(item.description)) ??
        periodByKey.get(buildPeriodKey(item.glReference, item.ttmAmount)) ??
        null;
      if (direct) return direct;

      if (item.category === "One-Off Expenses" || item.category === "TI Add-Backs") {
        const currentIndex = categoryCounters.get(item.category) ?? 0;
        categoryCounters.set(item.category, currentIndex + 1);
        return categoryPeriodOrder[item.category][currentIndex] ?? null;
      }

      return null;
    })(),
    sourceAmount:
      amountByDescription.get(normalizeDescriptionKey(item.description)) ??
      amountByKey.get(buildPeriodKey(item.glReference, item.ttmAmount)) ??
      ((item.category === "One-Off Expenses" || item.category === "TI Add-Backs")
        ? categoryAmountOrder[item.category][(categoryCounters.get(item.category) ?? 1) - 1] ?? item.ttmAmount
        : item.ttmAmount),
  }));

  const replacementSalary = toFiniteNumber(args.assumptions.replacementSalary) ?? 65000;

  const computeItemAmount = (item: Ws22PeriodMappedItem, months: string[]) => {
    if (item.index === "—") return item.ttmAmount ?? 0;
    if (/Replacement Manager Salary/i.test(item.description)) {
      return -(replacementSalary * months.length) / 12;
    }
    if (/Employer FICA on owner wages/i.test(item.description)) {
      const ownerWages = sumGlForMonths(mappedPlRows, "6020", months);
      return ownerWages * 0.0765;
    }
    if (item.category === "One-Off Expenses" || item.category === "TI Add-Backs") {
      if (!item.sourcePeriod) return item.ttmAmount ?? 0;
      return months.includes(item.sourcePeriod) ? item.sourceAmount ?? item.ttmAmount ?? 0 : 0;
    }
    if (/^\d+$/.test(item.glReference)) {
      return sumGlForMonths(mappedPlRows, item.glReference, months);
    }
    return item.ttmAmount ?? 0;
  };

  const ttmStartingEbitda = ttmSummary.ebitdaPreRecast;
  const annualStartingByYear = new Map(annualYears.map((year) => [year.fiscalYear, year.ebitdaPreRecast]));

  const ttmAddbacks = enrichedItems
    .filter((item) => item.index !== "—")
    .reduce((sum, item) => sum + computeItemAmount(item, ttmMonths), 0);

  const annualAddbacks = annualYears.map((year) => {
    const months = periodMonths(year);
    return enrichedItems
      .filter((item) => item.index !== "—")
      .reduce((sum, item) => sum + computeItemAmount(item, months), 0);
  });

  const normalizedByYear = annualYears.map((year, index) => {
    const normalizedEbitda = (annualStartingByYear.get(year.fiscalYear) ?? 0) + annualAddbacks[index];
    const margin = year.totalRevenue ? (normalizedEbitda / year.totalRevenue) * 100 : null;
    return {
      fiscalYear: year.fiscalYear,
      normalizedEbitda,
      margin,
    };
  });

  const correctedNormalizedTtm = ttmStartingEbitda + ttmAddbacks;
  const correctedTtmMargin = ttmSummary.totalRevenue ? (correctedNormalizedTtm / ttmSummary.totalRevenue) * 100 : null;
  const valuationLow = toFiniteNumber(args.assumptions.multipleLow) != null ? correctedNormalizedTtm * Number(args.assumptions.multipleLow) : null;
  const valuationMid = toFiniteNumber(args.assumptions.multipleMid) != null ? correctedNormalizedTtm * Number(args.assumptions.multipleMid) : null;
  const valuationHigh = toFiniteNumber(args.assumptions.multipleHigh) != null ? correctedNormalizedTtm * Number(args.assumptions.multipleHigh) : null;

  const correctedScheduleRows = enrichedItems.map((item) => {
    if (item.index === "—") return item;
    const correctedTtmAmount = computeItemAmount(item, ttmMonths);
    const needsOutOfPeriodNote =
      (item.category === "One-Off Expenses" || item.category === "TI Add-Backs") &&
      item.sourcePeriod &&
      !ttmMonths.includes(item.sourcePeriod) &&
      correctedTtmAmount === 0;

    return {
      ...item,
      ttmAmount: correctedTtmAmount,
      status:
        needsOutOfPeriodNote && !/OUT-OF-PERIOD FOR TTM/i.test(item.status)
          ? `${item.status} · OUT-OF-PERIOD FOR TTM`
          : item.status,
    };
  });

  return {
    correctedScheduleRows,
    ttmAddbacks,
    correctedNormalizedTtm,
    correctedTtmMargin,
    normalizedByYear,
    valuationLow,
    valuationMid,
    valuationHigh,
    hasOutOfPeriodItems:
      correctedScheduleRows.some((item) => /OUT-OF-PERIOD FOR TTM/.test(item.status)),
  };
}

export function applyWs22SpecCorrections(args: {
  reportMarkdown: string;
  analysis: Pick<TtmAnalysisView, "ttmSummary" | "annualModel" | "normalizedData">;
  assumptions: Pick<Ws2RecastView["assumptions"], "replacementSalary" | "multipleLow" | "multipleMid" | "multipleHigh">;
}) {
  const correction = buildWs22PeriodCorrection(args);
  if (!correction) {
    return {
      reportMarkdown: args.reportMarkdown,
      metrics: extractWs2RecastMetrics(args.reportMarkdown),
      extraFlags: [] as Array<{ title: string; description: string; severity: Ws2RecastFlagView["severity"]; payload: Record<string, unknown> }>,
    };
  }

  const scheduleLines = [
    "**EBITDA RECAST SCHEDULE — TTM Jan 2024 to Dec 2024**",
    "",
    "| # | Category | Item Description | GL Reference | TTM Amount | Status |",
    "|---|---|---|---|---|---|",
    ...correction.correctedScheduleRows.map((item) => [
      item.index,
      item.category,
      item.description,
      item.glReference,
      item.index === "—" && /TTM 4-Wall EBITDA/i.test(item.description)
        ? formatCurrencyForReport(args.analysis.ttmSummary?.ebitdaPreRecast ?? item.ttmAmount)
        : formatCurrencyForReport(item.ttmAmount),
      item.status,
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |")),
    `| — | **TOTAL ADD-BACKS** |  |  | **${formatCurrencyForReport(correction.ttmAddbacks)}** |  |`,
    `| — | **NORMALIZED / RECAST EBITDA (TTM)** |  |  | **${formatCurrencyForReport(correction.correctedNormalizedTtm)}** |  |`,
    `| — | **NORMALIZED EBITDA MARGIN (TTM)** |  |  | **${formatPeriodMargin(correction.correctedTtmMargin)}** |  |`,
    "",
    "**3-Year Normalized EBITDA Summary:**",
    ...correction.normalizedByYear.map(
      (year, index) => `- ${year.fiscalYear} (${periodYearLabel(args.analysis.annualModel?.years?.[index], year.fiscalYear)}) Normalized EBITDA: ${formatCurrencyForReport(year.normalizedEbitda)} (${formatPeriodMargin(year.margin)} margin)`,
    ),
    `- TTM Normalized EBITDA: ${formatCurrencyForReport(correction.correctedNormalizedTtm)} (${formatPeriodMargin(correction.correctedTtmMargin)} margin)`,
  ];

  const valuationLines = [
    "## PRELIMINARY VALUATION RANGE",
    "",
    "**Valuation Range:**",
    `- Low: ${formatCurrencyForReport(correction.correctedNormalizedTtm)} × ${Number(args.assumptions.multipleLow ?? 0).toFixed(1)}x = ${formatCurrencyForReport(correction.valuationLow)}`,
    `- Mid: ${formatCurrencyForReport(correction.correctedNormalizedTtm)} × ${Number(args.assumptions.multipleMid ?? 0).toFixed(1)}x = ${formatCurrencyForReport(correction.valuationMid)}`,
    `- High: ${formatCurrencyForReport(correction.correctedNormalizedTtm)} × ${Number(args.assumptions.multipleHigh ?? 0).toFixed(1)}x = ${formatCurrencyForReport(correction.valuationHigh)}`,
    "",
    "**Revenue Multiple Cross-Check:**",
    `- Low: ${formatCurrencyForReport(correction.valuationLow)} ÷ ${formatCurrencyForReport(args.analysis.ttmSummary?.totalRevenue)} = ${formatMultipleForReport(args.analysis.ttmSummary?.totalRevenue ? (correction.valuationLow ?? 0) / args.analysis.ttmSummary.totalRevenue : null)} revenue multiple`,
    `- Mid: ${formatCurrencyForReport(correction.valuationMid)} ÷ ${formatCurrencyForReport(args.analysis.ttmSummary?.totalRevenue)} = ${formatMultipleForReport(args.analysis.ttmSummary?.totalRevenue ? (correction.valuationMid ?? 0) / args.analysis.ttmSummary.totalRevenue : null)} revenue multiple`,
    `- High: ${formatCurrencyForReport(correction.valuationHigh)} ÷ ${formatCurrencyForReport(args.analysis.ttmSummary?.totalRevenue)} = ${formatMultipleForReport(args.analysis.ttmSummary?.totalRevenue ? (correction.valuationHigh ?? 0) / args.analysis.ttmSummary.totalRevenue : null)} revenue multiple`,
    "",
    "**Revenue Trend Adjustment Flag:**",
    "FLAT REVENUE — TTM revenue equals FY3 annual revenue on this comparison basis.",
    "",
    "**This is a PRELIMINARY valuation range for Admin's internal planning. It has not been reviewed or approved. It must not be shared with the seller until Admin approves it.**",
  ];

  let reportMarkdown = args.reportMarkdown.replace(
    /## EBITDA RECAST SCHEDULE[\s\S]*?(?=\n## FLAG LIST FOR ADMIN REVIEW|\n## PRELIMINARY VALUATION RANGE|$)/i,
    `## EBITDA RECAST SCHEDULE\n\n${scheduleLines.join("\n")}\n`,
  );

  reportMarkdown = reportMarkdown.replace(
    /## PRELIMINARY VALUATION RANGE[\s\S]*?(?=\n## SUMMARY FOR ADMIN|$)/i,
    `${valuationLines.join("\n")}\n`,
  );

  reportMarkdown = reportMarkdown.replace(
    /## SUMMARY FOR ADMIN[\s\S]*$/i,
    [
      "## SUMMARY FOR ADMIN",
      "",
      `Normalized TTM EBITDA of ${formatCurrencyForReport(correction.correctedNormalizedTtm)} (${formatPeriodMargin(correction.correctedTtmMargin)} margin) represents ${formatCurrencyForReport(correction.ttmAddbacks)} in total add-backs, primarily driven by owner compensation normalization and verified personal expenses within the TTM period.`,
      `Preliminary valuation range of ${formatCurrencyForReport(correction.valuationLow)}-${formatCurrencyForReport(correction.valuationHigh)} is based on your multiple guidance.`,
      correction.hasOutOfPeriodItems
        ? "Out-of-period one-off and TI items were excluded from the TTM recast schedule and kept in their actual fiscal years per the WS2-2 architecture."
        : "No out-of-period one-off or TI items were detected in the TTM recast schedule.",
      "",
    ].join("\n"),
  );

  const extraFlags = correction.hasOutOfPeriodItems
    ? [
        {
          title: "Out-of-period add-backs were reassigned from TTM to their source fiscal years",
          description:
            "One-off and TI items dated outside the TTM window were excluded from the TTM recast schedule and retained only in their actual fiscal years, per WS2-2 architecture requirements.",
          severity: "HIGH" as const,
          payload: {
            source: "WS2_2_PERIOD_ASSIGNMENT_CORRECTION",
            correctedNormalizedEbitda: correction.correctedNormalizedTtm,
            correctedTotalAddbacks: correction.ttmAddbacks,
          },
        },
      ]
    : [];

  return {
    reportMarkdown,
    metrics: {
      startingEbitda: args.analysis.ttmSummary?.ebitdaPreRecast ?? null,
      normalizedEbitda: correction.correctedNormalizedTtm,
      valuationLow: correction.valuationLow,
      valuationMid: correction.valuationMid,
      valuationHigh: correction.valuationHigh,
    },
    extraFlags,
  };
}

export function extractWs2RecastMetrics(reportMarkdown: string) {
  const startingEbitdaMatch =
    reportMarkdown.match(/Starting TTM 4-Wall EBITDA \(Pre-Recast\):\s*\$([0-9,().-]+)/i) ??
    reportMarkdown.match(/TTM 4-Wall EBITDA \(Pre-Recast\)[^\n$]*\$([0-9,().-]+)/i);
  const normalizedEbitdaMatch =
    reportMarkdown.match(/NORMALIZED\s*\/\s*RECAST EBITDA \(TTM\)[^\n$]*\$([0-9,().-]+)/i) ??
    reportMarkdown.match(/Normalized EBITDA[^$\n]*\$([0-9,().-]+)/i);
  const lowMatch = reportMarkdown.match(/Low:\s*\$[0-9,().-]+\s*[×x].*?=\s*\*?\*?\$([0-9,().-]+)/i);
  const midMatch = reportMarkdown.match(/Mid:\s*\$[0-9,().-]+\s*[×x].*?=\s*\*?\*?\$([0-9,().-]+)/i);
  const highMatch = reportMarkdown.match(/High:\s*\$[0-9,().-]+\s*[×x].*?=\s*\*?\*?\$([0-9,().-]+)/i);

  return {
    startingEbitda: parseCurrencyValue(startingEbitdaMatch?.[1]),
    normalizedEbitda: parseCurrencyValue(normalizedEbitdaMatch?.[1]),
    valuationLow: parseCurrencyValue(lowMatch?.[1]),
    valuationMid: parseCurrencyValue(midMatch?.[1]),
    valuationHigh: parseCurrencyValue(highMatch?.[1]),
  };
}

function severityFromText(value: string): Ws2RecastFlagView["severity"] {
  const normalized = value.toLowerCase();
  if (/(flagged-major|missing-data|remove|critical|red flag)/.test(normalized)) return "HIGH";
  if (/(flagged-suspicious|flagged-recurring|flagged-untraced|default)/.test(normalized)) return "MEDIUM";
  if (/(minor|yellow flag|note)/.test(normalized)) return "LOW";
  return "INFO";
}

export function extractWs2RecastFlagPayloads(reportMarkdown: string) {
  const sectionMatch = reportMarkdown.match(
    /### FLAG LIST FOR ADMIN REVIEW\s*([\s\S]*?)(?:\n### |\n## |$)/i,
  );

  if (!sectionMatch) return [];

  const lines = sectionMatch[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines
    .filter((line) => /^[-*] /.test(line) || /^\d+\./.test(line))
    .map((line, index) => {
      const cleaned = line.replace(/^[-*]\s*/, "").replace(/^\d+\.\s*/, "");
      const dollarImpact = extractFlagDollarImpact(cleaned);
      return {
        title: cleaned.slice(0, 140),
        description: cleaned,
        severity: severityFromText(cleaned),
        payload: {
          source: "FLAG_LIST_FOR_ADMIN_REVIEW",
          sequence: index + 1,
          dollarImpact,
        } as Record<string, unknown>,
      };
    });
}

export function extractWs2RecastControlFlags(
  reportMarkdown: string,
  analysis?: Pick<TtmAnalysisView, "ttmSummary">,
) {
  const lines = reportMarkdown
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const suspiciousLines = lines.filter((line) => /(SUSPICIOUS-RECURRING|FLAGGED-SUSPICIOUS|FLAGGED-UNTRACED)/i.test(line));
  const flags = suspiciousLines.map((line, index) => ({
    title: line.replace(/\|/g, " ").replace(/\s+/g, " ").trim().slice(0, 140),
    description: line,
    severity: /FLAGGED-UNTRACED/i.test(line) ? ("HIGH" as const) : ("MEDIUM" as const),
    payload: {
      source: "CONTROL_SCAN",
      sequence: index + 1,
      line,
    } as Record<string, unknown>,
  }));

  if (flags.length > 0 && /No items require Admin'?s review/i.test(reportMarkdown)) {
    flags.push({
      title: "WS2-2 report says no Admin review is required despite suspicious items",
      description:
        "The report contains suspicious or flagged add-back language elsewhere, but the FLAG LIST FOR ADMIN REVIEW says no items require review. Admin should verify those items before approval.",
      severity: "HIGH" as const,
      payload: {
        source: "CONTROL_CONTRADICTION",
        suspiciousItemCount: flags.length,
      } as Record<string, unknown>,
    });
  }

  const reportMetrics = extractWs2RecastMetrics(reportMarkdown);
  const ws21StartingEbitda = toFiniteNumber(analysis?.ttmSummary?.ebitdaPreRecast);
  if (
    ws21StartingEbitda !== null &&
    reportMetrics.startingEbitda !== null &&
    Math.abs(ws21StartingEbitda - reportMetrics.startingEbitda) > 1
  ) {
    flags.push({
      title: "WS2-2 starting EBITDA does not match WS2-1",
      description: `WS2-2 starts from ${fmtCurrencyStr(reportMetrics.startingEbitda) ?? "n/a"}, but WS2-1 structured output shows ${fmtCurrencyStr(ws21StartingEbitda) ?? "n/a"}. Admin should verify the handoff before approval.`,
      severity: "HIGH" as const,
      payload: {
        source: "CONTROL_MISMATCH",
        ws21StartingEbitda,
        ws22StartingEbitda: reportMetrics.startingEbitda,
        dollarImpact: reportMetrics.startingEbitda - ws21StartingEbitda,
      } as Record<string, unknown>,
    });
  }

  const ttmStartMonth = analysis?.ttmSummary?.startMonth;
  if (ttmStartMonth) {
    const sections = [
      {
        category: "One-Off Expenses",
        body: reportMarkdown.match(/## CATEGORY 3: ONE-OFF NON-RECURRING EXPENSES([\s\S]*?)(?=\n## CATEGORY 4:|\n## FLAG LIST FOR ADMIN REVIEW|$)/i)?.[1] ?? "",
      },
      {
        category: "TI Add-Backs",
        body: reportMarkdown.match(/## CATEGORY 4: TENANT IMPROVEMENT ADD-BACKS([\s\S]*?)(?=\n## CATEGORY 5:|\n## FLAG LIST FOR ADMIN REVIEW|$)/i)?.[1] ?? "",
      },
    ];

    const outOfPeriodMatches = sections.flatMap(({ category, body }) =>
      Array.from(body.matchAll(/\|\s*\d+\s*\|\s*([^|]+)\|\s*\$?[-0-9,().]+\s*\|\s*([^|]+)\|\s*[^|]+\|\s*[^|]+\|/gi)).map((match) => ({
        category,
        description: match[1]?.trim(),
        period: match[2]?.trim(),
      })),
    );

    for (const match of outOfPeriodMatches) {
      const category = match.category;
      const description = match.description;
      const dateHint = parsePeriodReference(match.period);
      if (!dateHint || compareMonthKey(dateHint, ttmStartMonth) >= 0) continue;

      flags.push({
        title: `${category} item appears outside the TTM period`,
        description: `${description} is tagged to ${match.period}, which pre-dates the TTM window starting ${ttmStartMonth}. Admin should verify it is not being added back to TTM EBITDA unless it is actually present in the TTM period.`,
        severity: "HIGH" as const,
        payload: {
          source: "CONTROL_OUT_OF_PERIOD",
          category,
          description,
          detectedPeriod: dateHint,
          ttmStartMonth,
          sourcePeriodLabel: match.period,
        } as Record<string, unknown>,
      });
    }
  }

  return flags;
}

export function sanitizeWs2RecastReportNarrative(
  reportMarkdown: string,
  analysis: Pick<TtmAnalysisView, "ttmSummary" | "annualModel">,
) {
  let sanitized = reportMarkdown;
  const ttmRevenue = toFiniteNumber(analysis.ttmSummary?.totalRevenue);
  const latestAnnualRevenue = analysis.annualModel?.years?.at(-1)?.totalRevenue;

  if (ttmRevenue !== null && Number.isFinite(latestAnnualRevenue) && Math.abs(ttmRevenue - latestAnnualRevenue) < 0.5) {
    sanitized = sanitized.replace(
      /\*\*Revenue Trend Adjustment Flag:\*\*[\s\S]*?(?=\n\*\*This is a PRELIMINARY valuation range|\n## |$)/i,
      `**Revenue Trend Adjustment Flag:**\n**FLAT REVENUE** — TTM revenue ($${ttmRevenue.toLocaleString()}) is equal to FY3 annual revenue ($${latestAnnualRevenue.toLocaleString()}). TTM and FY3 revenue are flat on this comparison basis.`,
    );
  }

  const controlFlags = extractWs2RecastControlFlags(sanitized, analysis as Pick<TtmAnalysisView, "ttmSummary">);
  if (controlFlags.length > 0) {
    sanitized = sanitized.replace(
      /## FLAG LIST FOR ADMIN REVIEW[\s\S]*?(?=\n## PRELIMINARY VALUATION RANGE|\n### PRELIMINARY VALUATION RANGE|$)/i,
      [
        "## FLAG LIST FOR ADMIN REVIEW",
        "",
        ...controlFlags.map((flag) => `- ${flag.description.replace(/^[-*]\s*/, "")}`),
        "",
      ].join("\n"),
    );

    sanitized = sanitized.replace(
      /recast is ready for client presentation/gi,
      "recast requires Admin review before any client presentation",
    );
    sanitized = sanitized.replace(
      /no items require your review before proceeding/gi,
      "items still require your review before proceeding",
    );
    sanitized = sanitized.replace(
      /no items requiring your review/gi,
      "items still requiring your review",
    );
  }

  return sanitized;
}

export function resolveWs2RecastMetrics(
  recast: Pick<Ws2RecastView, "assumptions" | "parsedReport" | "normalizedEbitda" | "valuationLow" | "valuationMid" | "valuationHigh" | "flags">,
) {
  const parsed = recast.parsedReport && typeof recast.parsedReport === "object"
    ? (recast.parsedReport as Record<string, unknown>)
    : {};

  const baseNormalizedEbitda =
    toFiniteNumber(parsed.baseNormalizedEbitda) ??
    toFiniteNumber(parsed.normalizedEbitda) ??
    toFiniteNumber(recast.normalizedEbitda);

  if (baseNormalizedEbitda === null) {
    return {
      normalizedEbitda: recast.normalizedEbitda ?? null,
      valuationLow: recast.valuationLow ?? null,
      valuationMid: recast.valuationMid ?? null,
      valuationHigh: recast.valuationHigh ?? null,
    };
  }

  let normalizedEbitda = baseNormalizedEbitda;

  for (const flag of recast.flags) {
    if (flag.resolutionStatus !== "ACTIONED") continue;

    const dollarImpact = toFiniteNumber(flag.payload?.dollarImpact);
    if (dollarImpact === null) continue;

    if (flag.resolutionAction === "OVERRIDE") {
      const overrideAmount = toFiniteNumber(flag.overrideAmount);
      if (overrideAmount === null) continue;
      normalizedEbitda += overrideAmount - dollarImpact;
      continue;
    }

    if (flag.resolutionAction === "ESCALATE_CLIENT") {
      normalizedEbitda -= dollarImpact;
    }
  }

  const valuationLow =
    toFiniteNumber(recast.assumptions.multipleLow) !== null
      ? normalizedEbitda * Number(recast.assumptions.multipleLow)
      : toFiniteNumber(parsed.baseValuationLow) ?? toFiniteNumber(parsed.valuationLow) ?? toFiniteNumber(recast.valuationLow);

  const valuationMid =
    toFiniteNumber(recast.assumptions.multipleMid) !== null
      ? normalizedEbitda * Number(recast.assumptions.multipleMid)
      : toFiniteNumber(parsed.baseValuationMid) ?? toFiniteNumber(parsed.valuationMid) ?? toFiniteNumber(recast.valuationMid);

  const valuationHigh =
    toFiniteNumber(recast.assumptions.multipleHigh) !== null
      ? normalizedEbitda * Number(recast.assumptions.multipleHigh)
      : toFiniteNumber(parsed.baseValuationHigh) ?? toFiniteNumber(parsed.valuationHigh) ?? toFiniteNumber(recast.valuationHigh);

  return {
    normalizedEbitda,
    valuationLow,
    valuationMid,
    valuationHigh,
  };
}

// V3 Section 13.5 — Number formatting standard
const CURRENCY_FORMAT = '$#,##0;($#,##0);"-"';   // whole-dollar, negative in parens
const PERCENT_FORMAT = '0.0%';                     // one decimal
const MULTIPLE_FORMAT = '0.0"x"';                  // e.g., 4.5x

function addSheet(
  workbook: XLSX.WorkBook,
  name: string,
  rows: Array<Array<string | number | null | undefined>>,
  options?: {
    colWidths?: number[];
    protectSheet?: boolean;
    numberFormats?: Record<string, string>; // cell ref → format
  },
) {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  if (options?.colWidths) {
    worksheet["!cols"] = options.colWidths.map((w) => ({ wch: w }));
  }

  // V3 Section 13.5: Auto-detect and apply number formats to cells
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = worksheet[cellRef];
      if (!cell) continue;

      // Apply currency format to numeric cells (not in first column)
      if (C > 0 && typeof cell.v === "number") {
        const value = cell.v;
        // Detect percentage values (typically shown as a fraction or already multiplied)
        // If the column header or label has "%" in it, use percentage format
        const rowLabel = String(rows[R]?.[0] ?? "").toLowerCase();
        const headerLabel = String(rows[0]?.[C] ?? "").toLowerCase();

        if (rowLabel.includes("%") || rowLabel.includes("margin") || rowLabel.includes("growth")) {
          // Store as decimal for Excel percentage formatting
          cell.v = value / 100;
          cell.z = PERCENT_FORMAT;
        } else if (rowLabel.includes("multiple")) {
          cell.z = MULTIPLE_FORMAT;
        } else {
          cell.z = CURRENCY_FORMAT;
        }
      }

      // V3 Section 13.5: Year labels must be text strings (prevent Excel date interpretation)
      if (typeof cell.v === "number" && cell.v >= 2000 && cell.v <= 2100) {
        const rowIndex = R;
        const isHeaderRow = rowIndex <= 5;
        if (isHeaderRow) {
          cell.t = "s"; // force text type
          cell.v = String(cell.v);
        }
      }
    }
  }

  // Manual number formatting overrides
  if (options?.numberFormats) {
    for (const [ref, fmt] of Object.entries(options.numberFormats)) {
      const cell = worksheet[ref];
      if (cell) {
        cell.z = fmt;
      }
    }
  }

  // V3 Section 13.5: Write protection for Tabs 3, 4, 12
  if (options?.protectSheet) {
    worksheet["!protect"] = {
      sheet: true,
      objects: true,
      scenarios: true,
    } as any;
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, name);
  return worksheet;
}

function fmtCurrencyStr(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const abs = Math.abs(value);
  const formatted = `$${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return value < 0 ? `(${formatted.replace("$", "")})` : formatted;
}

function fmtPctStr(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return `${value.toFixed(1)}%`;
}

function fmtMultipleStr(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return `${value.toFixed(1)}x`;
}

function fmtCurrency(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value;
}

function fmtPct(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value;
}

function fmtMultiple(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value;
}

function yearLabel(year: AnnualModelYear) {
  return year.fiscalYear;
}

function safeDiv(numerator: number | null | undefined, denominator: number | null | undefined): number | null {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return (numerator / denominator) * 100;
}

function isMarkdownTableLine(line: string) {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|");
}

function isMarkdownDividerRow(line: string) {
  return /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function parseMarkdownTable(lines: string[]) {
  return lines
    .filter((line) => !isMarkdownDividerRow(line))
    .map((line) =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim()),
    );
}

function appendStructuredMarkdown(rows: Array<Array<string | number | null>>, reportMarkdown: string | null | undefined) {
  if (!reportMarkdown) return rows;

  const lines = reportMarkdown.replace(/\r\n/g, "\n").split("\n");
  let tableBuffer: string[] = [];

  const flushTable = () => {
    if (!tableBuffer.length) return;
    const parsed = parseMarkdownTable(tableBuffer);
    if (parsed.length) {
      rows.push(...parsed.map((row) => row.map((cell) => cell || null)));
      rows.push([]);
    }
    tableBuffer = [];
  };

  for (const line of lines) {
    if (isMarkdownTableLine(line)) {
      tableBuffer.push(line);
      continue;
    }

    flushTable();

    const trimmed = line.trim();
    if (!trimmed) {
      rows.push([]);
      continue;
    }

    if (/^#{2,}\s+/.test(trimmed)) {
      rows.push([trimmed.replace(/^#{2,}\s+/, "")]);
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      rows.push([trimmed.replace(/^[-*]\s+/, "• ")]);
      continue;
    }

    rows.push([trimmed]);
  }

  flushTable();
  return rows;
}

/* ────────────────────────────────────────────────────────────────────────────
   TAB 1: Summary (V3 Section 13.3)
   ──────────────────────────────────────────────────────────────────────────── */

function buildSummaryTab(args: {
  clientName: string;
  ttm: TtmAnalysisView;
  recast: Ws2RecastView;
  ws23: Ws2DerivedReportView | null;
}) {
  const { ttm, recast } = args;
  const years = ttm.annualModel?.years ?? [];
  const ttmSummary = ttm.ttmSummary;

  const rows: Array<Array<string | number | null>> = [
    [`${args.clientName} — WS2 Financial Analysis Summary`],
    [`Prepared by Cantara Pet Advisors | ${new Date().toISOString().slice(0, 10)}`],
    [`Admin HITL Approval: ${recast.approvedAt ?? "Pending"}`],
    [],
    ["SECTION A — FINANCIAL SNAPSHOT"],
    ["", ...years.map(yearLabel), "TTM"],
    ["Total Revenue", ...years.map((y) => y.totalRevenue), ttmSummary?.totalRevenue ?? null],
    [
      "YoY Growth",
      null,
      ...(ttm.annualModel?.trends ?? []).map((t) => (t.revenueYoYPct != null ? `${t.revenueYoYPct.toFixed(1)}%` : "—")),
      null,
    ],
    ["Gross Profit", ...years.map((y) => y.grossProfit), ttmSummary?.grossProfit ?? null],
    ["Gross Margin %", ...years.map((y) => fmtPct(y.grossMarginPct)), fmtPct(ttmSummary?.grossMarginPct)],
    ["4-Wall EBITDA (Pre-Recast)", ...years.map((y) => y.ebitdaPreRecast), ttmSummary?.ebitdaPreRecast ?? null],
    [],
    ["SECTION B — RECAST SUMMARY"],
    ["4-Wall EBITDA (Pre-Recast) — TTM", ttmSummary?.ebitdaPreRecast ?? null],
    ["Normalized EBITDA (TTM)", recast.normalizedEbitda ?? null],
    [],
    ["SECTION C — PRELIMINARY VALUATION RANGE"],
    ["", "Low", "Mid", "High"],
    ["Multiple Applied", fmtMultiple(recast.assumptions.multipleLow), fmtMultiple(recast.assumptions.multipleMid), fmtMultiple(recast.assumptions.multipleHigh)],
    ["Valuation Range", recast.valuationLow ?? null, recast.valuationMid ?? null, recast.valuationHigh ?? null],
    [],
    ["SECTION D — KEY FLAGS RESOLVED"],
    ["Total WS2-1 Flags", ttm.flags.length],
    ["Total WS2-2 Flags", recast.flags.length],
    ["All Resolved", ttm.flags.every((f) => f.resolutionStatus === "ACTIONED") && recast.flags.every((f) => f.resolutionStatus === "ACTIONED") ? "YES" : "NO"],
  ];

  return rows;
}

/* ────────────────────────────────────────────────────────────────────────────
   TAB 2: Assumptions (V3 Section 13.3)
   ──────────────────────────────────────────────────────────────────────────── */

function buildAssumptionsTab(recast: Ws2RecastView) {
  const rows: Array<Array<string | number | null>> = [
    ["ADMIN'S INPUTS — WS2-2 EBITDA RECAST"],
    [`Date entered: ${recast.createdAt}`],
    [],
    ["VALUATION MULTIPLES"],
    ["Multiple — Low End", recast.assumptions.multipleLow],
    ["Multiple — Mid Point", recast.assumptions.multipleMid],
    ["Multiple — High End", recast.assumptions.multipleHigh],
    [],
    ["OWNER REPLACEMENT SALARY"],
    ["Annual Replacement Salary", recast.assumptions.replacementSalary ?? 65000],
    recast.assumptions.replacementSalary ? ["Basis", "Admin-provided"] : ["Basis", "DEFAULT $65,000"],
    [],
    ["FAIR MARKET RENT"],
    ["Related-Party Ownership", recast.assumptions.relatedPartyOwnership ? "Yes" : "No"],
    ["FMR Estimate (annual)", recast.assumptions.fmrEstimate],
    [],
    ["ADMIN OVERRIDE LOG"],
    ["Flag Description", "Admin's Override Amount", "Admin's Stated Reason", "Timestamp"],
    ...recast.flags
      .filter((f) => f.resolutionAction === "OVERRIDE")
      .map((f) => [f.title, f.overrideAmount, f.resolutionNotes ?? "", f.resolvedAt ?? ""]),
    [],
    ["Notes", recast.assumptions.notes ?? ""],
  ];
  return rows;
}

/* ────────────────────────────────────────────────────────────────────────────
   TAB 3: P&L - Non Adj (V3 Section 13.3)
   Read-only audit record of raw input data.
   ──────────────────────────────────────────────────────────────────────────── */

function buildPnlNonAdjTab(ttm: TtmAnalysisView) {
  const rows: Array<Array<string | number | null>> = [
    ["Raw input data — unadjusted. Do not edit."],
    [`Source files uploaded: ${ttm.inputSnapshot.map((s) => s.fileName).join(", ")}`],
    [],
    ["TTM Non-Adjusted P&L"],
    [],
    ["Metric", "Amount"],
    ["Revenue", ttm.ttmSummary?.totalRevenue ?? null],
    ["COGS", ttm.ttmSummary?.totalCogs ?? null],
    ["Gross Profit", ttm.ttmSummary?.grossProfit ?? null],
    ["Operating Expenses", ttm.ttmSummary?.totalOpEx ?? null],
    ["EBITDA (Pre-Recast)", ttm.ttmSummary?.ebitdaPreRecast ?? null],
  ];

  // Include revenue breakdown if available
  if (ttm.ttmSummary?.revenueByCategory?.length) {
    rows.push([], ["Revenue Breakdown"]);
    for (const cat of ttm.ttmSummary.revenueByCategory) {
      rows.push([`  ${cat.category}`, cat.value]);
    }
  }

  // Include OpEx breakdown if available
  if (ttm.ttmSummary?.opExByCategory?.length) {
    rows.push([], ["Operating Expense Breakdown"]);
    for (const cat of ttm.ttmSummary.opExByCategory) {
      rows.push([`  ${cat.category}`, cat.value]);
    }
  }

  return rows;
}

/* ────────────────────────────────────────────────────────────────────────────
   TAB 4: GL Mapping (V3 Section 13.3)
   Read-only audit trail of every GL classification.
   ──────────────────────────────────────────────────────────────────────────── */

function buildGlMappingTab(ttm: TtmAnalysisView) {
  const sectionAFlags = ttm.flags.filter((f) => f.section === "A");
  const autoMapped = ttm.flags.filter((f) => f.section === "A" && (f.payload as any)?.mappingMethod === "exact");
  const adminClassified = sectionAFlags.filter((f) => f.resolutionAction != null);

  const rows: Array<Array<string | number | null>> = [
    ["GL MAPPING TABLE"],
    [`WS2-1 Auto-mapping completed: ${ttm.createdAt}`],
    [`Admin classification of unmapped codes: ${ttm.approvedAt ?? "Pending"}`],
    [],
    ["#", "Original Account Name", "Original GL Code", "Cantara Code", "Category Name", "Status", "Admin Override"],
    ...sectionAFlags.map((flag, idx) => [
      idx + 1,
      flag.title,
      String((flag.payload as any)?.accountCode ?? "—"),
      String((flag.payload as any)?.assignedCantaraCode ?? (flag.payload as any)?.cantaraCode ?? "—"),
      String((flag.payload as any)?.category ?? "—"),
      flag.resolutionAction ? "ADMIN-CLASSIFIED" : "AUTO-MAPPED ✓",
      flag.resolutionAction ? `Admin: ${flag.resolvedAt?.slice(0, 10) ?? ""}` : "—",
    ]),
    [],
    ["SUMMARY"],
    ["Total accounts", sectionAFlags.length],
    ["Auto-mapped", autoMapped.length],
    ["Admin-classified", adminClassified.length],
    ["Ambiguous (flagged)", sectionAFlags.filter((f) => f.resolutionStatus !== "ACTIONED").length],
  ];
  return rows;
}

/* ────────────────────────────────────────────────────────────────────────────
   TAB 5: TTM & 3-Year P&L (V3 Section 13.3)
   The clean structured financial model from WS2-1.
   ──────────────────────────────────────────────────────────────────────────── */

function buildTtm3YearPnlTab(ttm: TtmAnalysisView, recast: Ws2RecastView) {
  const years = ttm.annualModel?.years ?? [];
  const ttmSummary = ttm.ttmSummary;

  const rows: Array<Array<string | number | null>> = [
    [`TTM & 3-Year P&L Model`],
    [`TTM period: ${ttmSummary?.startMonth ?? "?"} — ${ttmSummary?.endMonth ?? "?"}`],
    [`Prepared by WS2-1 TTM Financial Analysis Agent`],
    [],
    ["", ...years.map(yearLabel), "TTM"],
    [],
    ["REVENUE"],
  ];

  // Revenue categories
  if (ttmSummary?.revenueByCategory?.length) {
    for (const ttmCat of ttmSummary.revenueByCategory) {
      const yearValues = years.map((y) => y.revenueByCategory.find((c) => c.code === ttmCat.code)?.value ?? null);
      rows.push([`  ${ttmCat.category}`, ...yearValues, ttmCat.value]);
    }
  }
  rows.push(["TOTAL REVENUE", ...years.map((y) => y.totalRevenue), ttmSummary?.totalRevenue ?? null]);

  // YoY Growth
  const trends = ttm.annualModel?.trends ?? [];
  rows.push([
    "YoY Growth",
    "—",
    ...trends.map((t) => (t.revenueYoYPct != null ? `${t.revenueYoYPct.toFixed(1)}%` : "—")),
    "—",
  ]);

  rows.push([]);

  // COGS
  rows.push(["COGS"]);
  if (ttmSummary?.cogsByCategory?.length) {
    for (const ttmCat of ttmSummary.cogsByCategory) {
      const yearValues = years.map((y) => y.cogsByCategory.find((c) => c.code === ttmCat.code)?.value ?? null);
      rows.push([`  ${ttmCat.category}`, ...yearValues, ttmCat.value]);
    }
  }
  rows.push(
    ["TOTAL COGS", ...years.map((y) => y.totalCogs), ttmSummary?.totalCogs ?? null],
    ["GROSS PROFIT", ...years.map((y) => y.grossProfit), ttmSummary?.grossProfit ?? null],
    ["GROSS MARGIN %", ...years.map((y) => fmtPct(y.grossMarginPct)), fmtPct(ttmSummary?.grossMarginPct)],
    [],
  );

  // Operating Expenses
  rows.push(["OPERATING EXPENSES"]);
  if (ttmSummary?.opExByCategory?.length) {
    for (const ttmCat of ttmSummary.opExByCategory) {
      const yearValues = years.map((y) => y.opExByCategory.find((c) => c.code === ttmCat.code)?.value ?? null);
      rows.push([`  ${ttmCat.category}`, ...yearValues, ttmCat.value]);
    }
  }
  rows.push(
    ["TOTAL OPERATING EXP.", ...years.map((y) => y.totalOpEx), ttmSummary?.totalOpEx ?? null],
    [],
    ["4-WALL EBITDA (PRE-RECAST)", ...years.map((y) => y.ebitdaPreRecast), ttmSummary?.ebitdaPreRecast ?? null],
    ["EBITDA MARGIN %", ...years.map((y) => fmtPct(safeDiv(y.ebitdaPreRecast, y.totalRevenue))), fmtPct(ttmSummary?.ebitdaMarginPct)],
    [],
    ["* Depreciation and Interest are shown for reference only."],
    ["  They are EXCLUDED from the 4-Wall EBITDA calculation above."],
    ["  PRE-RECAST: Add-backs have NOT been applied. See Normalization Items tab."],
  );

  return rows;
}

/* ────────────────────────────────────────────────────────────────────────────
   TAB 6: Normalization Items (V3 Section 13.3)
   The core WS2-2 output — EBITDA recast schedule.
   ──────────────────────────────────────────────────────────────────────────── */

function buildNormalizationItemsTab(recast: Ws2RecastView) {
  const rows: Array<Array<string | number | null>> = [
    ["EBITDA Normalization / Add-Back Schedule"],
    [`Admin approved: ${recast.approvedAt ?? "Pending"}`],
    [],
  ];

  if (!recast.reportMarkdown) {
    rows.push(["No recast report available yet."]);
    return rows;
  }

  return appendStructuredMarkdown(rows, recast.reportMarkdown);
}

/* ────────────────────────────────────────────────────────────────────────────
   TAB 7: Valuation (V3 Section 13.3)
   ──────────────────────────────────────────────────────────────────────────── */

function buildValuationTab(ttm: TtmAnalysisView, recast: Ws2RecastView) {
  const ttmRevenue = ttm.ttmSummary?.totalRevenue;
  const normalizedEbitda = recast.normalizedEbitda;

  // Revenue trend flag
  const years = ttm.annualModel?.years ?? [];
  const fy3Revenue = years[years.length - 1]?.totalRevenue;
  let revenueTrend = "→ Stable";
  if (ttmRevenue && fy3Revenue) {
    if (ttmRevenue < fy3Revenue) revenueTrend = "▼ Declining";
    else if (ttmRevenue > fy3Revenue) revenueTrend = "▲ Growing";
  }

  // Revenue multiple cross-check
  const revMultLow = ttmRevenue && recast.valuationLow ? (recast.valuationLow / ttmRevenue) : null;
  const revMultMid = ttmRevenue && recast.valuationMid ? (recast.valuationMid / ttmRevenue) : null;
  const revMultHigh = ttmRevenue && recast.valuationHigh ? (recast.valuationHigh / ttmRevenue) : null;

  const rows: Array<Array<string | number | null>> = [
    ["Valuation Summary"],
    [`Admin approved: ${recast.approvedAt ?? "Pending"}`],
    ["PRELIMINARY — FOR INTERNAL USE ONLY"],
    [],
    ["VALUATION INPUTS"],
    ["Normalized EBITDA (TTM)", normalizedEbitda ?? null],
    ["Revenue trend", revenueTrend],
    ["Multiple range", `${fmtMultipleStr(recast.assumptions.multipleLow)} — ${fmtMultipleStr(recast.assumptions.multipleMid)} — ${fmtMultipleStr(recast.assumptions.multipleHigh)}`],
    [],
    ["VALUATION RANGE (based on TTM Normalized EBITDA)"],
    ["", "Low", "Mid", "High"],
    ["Multiple", fmtMultiple(recast.assumptions.multipleLow), fmtMultiple(recast.assumptions.multipleMid), fmtMultiple(recast.assumptions.multipleHigh)],
    ["Valuation", recast.valuationLow ?? null, recast.valuationMid ?? null, recast.valuationHigh ?? null],
    ["Rev Multiple", fmtMultiple(revMultLow), fmtMultiple(revMultMid), fmtMultiple(revMultHigh)],
    [],
    ["REVENUE TREND FLAG"],
  ];

  if (revenueTrend.includes("Declining")) {
    rows.push(["⚠ Revenue declining YoY. Buyer likely to apply low-to-mid multiple."]);
  } else if (revenueTrend.includes("Growing")) {
    rows.push(["✓ Revenue growing YoY. Full multiple range applicable."]);
  } else {
    rows.push(["→ Revenue stable. Mid-range multiple application expected."]);
  }

  rows.push(
    [],
    ["NOTE: This is a PRELIMINARY valuation range for Admin's internal planning."],
    ["It has not been reviewed by legal or tax counsel and must not be shared"],
    ["with the seller until Admin approves it for client release."],
  );

  return rows;
}

/* ────────────────────────────────────────────────────────────────────────────
   TAB 8: Revenue by Vertical (V3 Section 13.3) — WS2-3 output
   ──────────────────────────────────────────────────────────────────────────── */

function buildRevenueByVerticalTab(ws23: Ws2DerivedReportView | null) {
  const rows: Array<Array<string | number | null>> = [
    ["Revenue by Vertical Analysis"],
    [],
  ];

  const report = ws23?.reportMarkdown;
  if (!report) {
    rows.push(["WS2-3 report not available. Run the Revenue by Vertical agent first."]);
    return rows;
  }

  return appendStructuredMarkdown(rows, report);
}

/* ────────────────────────────────────────────────────────────────────────────
   TAB 9: Expense Benchmarks (V3 Section 13.3) — WS2-4 output
   ──────────────────────────────────────────────────────────────────────────── */

function buildExpenseBenchmarksTab(ws24: Ws2DerivedReportView | null) {
  const rows: Array<Array<string | number | null>> = [
    ["P&L Expense Benchmark Analysis"],
    [],
  ];

  const report = ws24?.reportMarkdown;
  if (!report) {
    rows.push(["WS2-4 report not available. Run the Expense Benchmark agent first."]);
    return rows;
  }

  return appendStructuredMarkdown(rows, report);
}

/* ────────────────────────────────────────────────────────────────────────────
   TAB 10: Labor Analysis (V3 Section 13.3) — WS2-5 output
   ──────────────────────────────────────────────────────────────────────────── */

function buildLaborAnalysisTab(ws25: Ws2DerivedReportView | null) {
  const rows: Array<Array<string | number | null>> = [
    ["Labor Expense Analysis"],
    [],
  ];

  const report = ws25?.reportMarkdown;
  if (!report) {
    rows.push(["WS2-5 report not available. Run the Labor Analysis agent first."]);
    return rows;
  }

  return appendStructuredMarkdown(rows, report);
}

/* ────────────────────────────────────────────────────────────────────────────
   TAB 11: Working Capital (V3 Section 13.3)
   ──────────────────────────────────────────────────────────────────────────── */

function buildWorkingCapitalTab(ttm: TtmAnalysisView) {
  const wc = ttm.workingCapital;
  const ar = wc?.arAging;

  const rows: Array<Array<string | number | null>> = [
    ["Working Capital Analysis"],
    [`MOST RECENT MONTH-END BALANCE SHEET: ${wc?.month ?? "N/A"}`],
    [],
    ["CURRENT ASSETS"],
  ];

  if (wc?.currentAssets?.length) {
    for (const asset of wc.currentAssets) {
      rows.push([`  ${asset.category}`, asset.value]);
    }
  }
  rows.push(["TOTAL CURRENT ASSETS", wc?.totalCurrentAssets ?? null]);

  rows.push([], ["CURRENT LIABILITIES"]);
  if (wc?.currentLiabilities?.length) {
    for (const liability of wc.currentLiabilities) {
      rows.push([`  ${liability.category}`, liability.value]);
    }
  }
  rows.push(["TOTAL CURRENT LIABILITIES", wc?.totalCurrentLiabilities ?? null]);

  rows.push(
    [],
    ["NET WORKING CAPITAL (Point-in-time)", wc?.netWorkingCapital ?? null],
    [],
    ["3-MONTH AVERAGE NWC", wc?.trailingThreeMonthAverageNwc ?? null],
    ["(Used in Seller Net Proceeds Calculator)"],
  );

  // AR Aging
  rows.push(
    [],
    ["AR AGING SUMMARY"],
    ["Current", ar?.current ?? null, fmtPct(ar?.pctCurrent)],
    ["1-30 days", ar?.days1To30 ?? null, fmtPct(ar?.pct1To30)],
    ["31-60 days", ar?.days31To60 ?? null, fmtPct(ar?.pct31To60)],
    ["61-90 days", ar?.days61To90 ?? null, fmtPct(ar?.pct61To90)],
    ["90+ days", ar?.days90Plus ?? null, fmtPct(ar?.pct90Plus)],
    ["TOTAL AR", ar?.totalAr ?? null],
    ["BS Reconciliation", ar?.reconcilesToBalanceSheet ? "RECONCILED ✓" : `GAP: ${fmtCurrencyStr(ar?.varianceToBalanceSheetAr)} ⚠`],
    [],
    [`→ 3-Month Average NWC of ${fmtCurrencyStr(wc?.trailingThreeMonthAverageNwc)} passed to Seller Net Proceeds Calculator.`],
  );

  return rows;
}

/* ────────────────────────────────────────────────────────────────────────────
   TAB 12: Data Quality Report (V3 Section 13.3)
   Read-only audit trail of every DQR item and Admin's resolutions.
   ──────────────────────────────────────────────────────────────────────────── */

function buildDataQualityReportTab(ttm: TtmAnalysisView) {
  const resolved = ttm.flags.filter((f) => f.resolutionStatus === "ACTIONED");
  const overrides = ttm.flags.filter((f) => f.resolutionAction === "OVERRIDE");
  const escalated = ttm.flags.filter((f) => f.resolutionAction === "ESCALATE_CLIENT");

  const rows: Array<Array<string | number | null>> = [
    ["Data Quality Report"],
    [`WS2-1 generated: ${ttm.createdAt}`],
    [`Admin review completed: ${ttm.approvedAt ?? "Pending"}`],
    [`All items resolved: ${ttm.flags.every((f) => f.resolutionStatus === "ACTIONED") ? "YES" : "NO"}`],
    [],
  ];

  // Group flags by section
  const sections: Array<{ code: string; title: string }> = [
    { code: "A", title: "SECTION A — GL CLASSIFICATION REQUESTS" },
    { code: "B", title: "SECTION B — QB vs. EXCEL DISCREPANCIES" },
    { code: "C", title: "SECTION C — ACCOUNTANT STATEMENT DISCREPANCIES" },
    { code: "D", title: "SECTION D — PERIOD & COVERAGE ISSUES" },
    { code: "E", title: "SECTION E — AR AGING FLAGS" },
  ];

  for (const section of sections) {
    const sectionFlags = ttm.flags.filter((f) => f.section === section.code);
    rows.push([section.title]);
    if (sectionFlags.length === 0) {
      rows.push(["  No items in this section."]);
    } else {
      rows.push(["Title", "Description", "Severity", "Resolution Action", "Notes"]);
      for (const flag of sectionFlags) {
        rows.push([
          flag.title,
          flag.description ?? "",
          flag.severity,
          flag.resolutionAction ?? "—",
          flag.resolutionNotes ?? "",
        ]);
      }
    }
    rows.push([]);
  }

  // Resolution summary
  rows.push(
    ["RESOLUTION SUMMARY"],
    ["Total flags raised", ttm.flags.length],
    ["Resolved — no change", resolved.filter((f) => f.resolutionAction === "RESOLVE").length],
    ["Resolved — Admin override", overrides.length],
    ["Resolved — sent back to seller for clarification", escalated.length],
    ["Outstanding (should be 0 at workbook assembly)", ttm.flags.filter((f) => f.resolutionStatus !== "ACTIONED").length],
  );

  return rows;
}

/* ────────────────────────────────────────────────────────────────────────────
   Main Workbook Builder — V3 Section 13
   Assembles all 12 tabs in the exact order specified.
   ──────────────────────────────────────────────────────────────────────────── */

export function buildWs2WorkbookBuffer(args: {
  clientName: string;
  ttmAnalysis: TtmAnalysisView;
  recastAnalysis: Ws2RecastView;
  derivedReports: Ws2DerivedReportView[];
}) {
  const workbook = XLSX.utils.book_new();
  const ws23 = args.derivedReports.find((r) => r.agentId === "ws2_3_rev_vertical_v1") ?? null;
  const ws24 = args.derivedReports.find((r) => r.agentId === "ws2_4_benchmark_v1") ?? null;
  const ws25 = args.derivedReports.find((r) => r.agentId === "ws2_5_labor_v1") ?? null;

  // Tab 1: Summary (populated last — summarizes everything)
  addSheet(workbook, "Summary", buildSummaryTab({
    clientName: args.clientName,
    ttm: args.ttmAnalysis,
    recast: args.recastAnalysis,
    ws23,
  }), { colWidths: [40, 18, 18, 18, 18] });

  // Tab 2: Assumptions
  addSheet(workbook, "Assumptions", buildAssumptionsTab(args.recastAnalysis), {
    colWidths: [35, 20, 40, 25],
  });

  // Tab 3: P&L - Non Adj (write-protected audit record)
  addSheet(workbook, "P&L - Non Adj", buildPnlNonAdjTab(args.ttmAnalysis), {
    colWidths: [35, 18],
    protectSheet: true,
  });

  // Tab 4: GL Mapping (write-protected audit trail)
  addSheet(workbook, "GL Mapping", buildGlMappingTab(args.ttmAnalysis), {
    colWidths: [6, 30, 15, 15, 20, 18, 20],
    protectSheet: true,
  });

  // Tab 5: TTM & 3-Year P&L
  addSheet(workbook, "TTM & 3-Year P&L", buildTtm3YearPnlTab(args.ttmAnalysis, args.recastAnalysis), {
    colWidths: [30, 15, 15, 15, 15],
  });

  // Tab 6: Normalization Items
  addSheet(workbook, "Normalization Items", buildNormalizationItemsTab(args.recastAnalysis), {
    colWidths: [100],
  });

  // Tab 7: Valuation
  addSheet(workbook, "Valuation", buildValuationTab(args.ttmAnalysis, args.recastAnalysis), {
    colWidths: [35, 18, 18, 18],
  });

  // Tab 8: Revenue by Vertical (WS2-3)
  addSheet(workbook, "Revenue by Vertical", buildRevenueByVerticalTab(ws23), {
    colWidths: [100],
  });

  // Tab 9: Expense Benchmarks (WS2-4)
  addSheet(workbook, "Expense Benchmarks", buildExpenseBenchmarksTab(ws24), {
    colWidths: [100],
  });

  // Tab 10: Labor Analysis (WS2-5)
  addSheet(workbook, "Labor Analysis", buildLaborAnalysisTab(ws25), {
    colWidths: [100],
  });

  // Tab 11: Working Capital
  addSheet(workbook, "Working Capital", buildWorkingCapitalTab(args.ttmAnalysis), {
    colWidths: [35, 18, 12],
  });

  // Tab 12: Data Quality Report (write-protected audit trail)
  addSheet(workbook, "Data Quality Report", buildDataQualityReportTab(args.ttmAnalysis), {
    colWidths: [35, 50, 12, 18, 40],
    protectSheet: true,
  });

  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
}
