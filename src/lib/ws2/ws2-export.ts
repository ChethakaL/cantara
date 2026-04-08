// ─────────────────────────────────────────────────────────────────────────────
// WS2 Excel Export Engine
// Cantara Pet Advisors Portal — Babalilm AI FZ-LLC
//
// Produces a formatted .xlsx workbook matching the Foothills valuation workbook
// structure. Uses SheetJS (xlsx) — install: npm install xlsx
//
// Usage:
//   import { exportWS2Workbook } from "@/lib/ws2/ws2-export";
//   exportWS2Workbook(report); // triggers browser download
// ─────────────────────────────────────────────────────────────────────────────

import * as XLSX from "xlsx-js-style";
import type { WS2Report, AddBackItem } from "./ws2-types";
import { getCategoryLabel } from "@/lib/ttm-agent/taxonomy";

// ── Color constants (ARGB format for xlsx) ────────────────────────────────────
const C = {
  NAVY:       "FF0F2340",
  GOLD:       "FFC9A84C",
  GOLD_LIGHT: "FFFFF0D0",
  CREAM:      "FFFAFAF7",
  GREEN_BG:   "FFEAF4EE",
  GREEN_FG:   "FF2D6A4F",
  YELLOW_BG:  "FFFEF9E7",
  YELLOW_FG:  "FFB45309",
  RED_BG:     "FFFEF2F2",
  RED_FG:     "FF991B1B",
  GREY_BG:    "FFF5F3EF",
  WHITE:      "FFFFFFFF",
  BLACK:      "FF000000",
  MUTED:      "FF8A8780",
  BLUE_INPUT: "FF0000FF",
};

// ── Style helpers ─────────────────────────────────────────────────────────────
const font = (opts: {
  bold?: boolean; color?: string; size?: number; name?: string; italic?: boolean;
}) => ({
  name: opts.name ?? "Calibri",
  sz: opts.size ?? 10,
  bold: opts.bold ?? false,
  italic: opts.italic ?? false,
  color: { rgb: (opts.color ?? C.BLACK).replace("FF", "") },
});

const fill = (fgColor: string) => ({
  patternType: "solid" as const,
  fgColor: { rgb: fgColor.replace("FF", "") },
});

const border = (style: "thin" | "medium" = "thin") => ({
  top:    { style, color: { rgb: "CCCCCC" } },
  bottom: { style, color: { rgb: "CCCCCC" } },
  left:   { style, color: { rgb: "CCCCCC" } },
  right:  { style, color: { rgb: "CCCCCC" } },
});

const NUM_FMT  = '$#,##0;($#,##0);"-"';
const PCT_FMT  = '0.0%';
const MULT_FMT = '0.0"x"';

function formatDisplayDateTime(value: string | null | undefined) {
  if (!value) return "Pending";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.replace(/T/, " ").replace(/Z$/, "");
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

// ── Cell builders ─────────────────────────────────────────────────────────────
function cell(
  value: string | number | null,
  opts: {
    bold?: boolean;
    italic?: boolean;
    color?: string;
    bg?: string;
    fmt?: string;
    align?: "left" | "center" | "right";
    inputBlue?: boolean;
    size?: number;
  } = {}
): XLSX.CellObject {
  const c: XLSX.CellObject = {
    v: value ?? "",
    t: typeof value === "number" ? "n" : "s",
  };
  if (opts.fmt) c.z = opts.fmt;
  c.s = {
    font: font({
      bold: opts.bold,
      italic: opts.italic,
      color: opts.inputBlue ? C.BLUE_INPUT : opts.color,
      size: opts.size,
    }),
    fill: opts.bg ? fill(opts.bg) : undefined,
    alignment: {
      horizontal: opts.align ?? (typeof value === "number" ? "right" : "left"),
      vertical: "center",
    },
    border: border("thin"),
  };
  return c;
}

function hdrCell(value: string, wide = false): XLSX.CellObject {
  return cell(value, {
    bold: true,
    color: C.WHITE,
    bg: C.NAVY,
    align: wide ? "left" : "center",
    size: 10,
  });
}

function titleCell(value: string): XLSX.CellObject {
  return cell(value, {
    bold: true,
    color: C.WHITE,
    bg: C.NAVY,
    size: 13,
  });
}

function sectionCell(value: string): XLSX.CellObject {
  return cell(value, { bold: true, bg: C.GREY_BG, color: C.NAVY, size: 9 });
}

function totalCell(value: number | string, isGrand = false): XLSX.CellObject {
  return cell(value, {
    bold: true,
    color: C.WHITE,
    bg: isGrand ? C.NAVY : "FF1F3864",
    fmt: typeof value === "number" ? NUM_FMT : undefined,
    align: typeof value === "string" ? "left" : "right",
  });
}

function ebitdaCell(value: number): XLSX.CellObject {
  return cell(value, {
    bold: true,
    bg: C.GOLD_LIGHT,
    fmt: NUM_FMT,
    color: value < 0 ? C.RED_FG : C.GREEN_FG,
  });
}

function inputCell(value: number, pct = false): XLSX.CellObject {
  return cell(value, {
    color: C.BLUE_INPUT,
    fmt: pct ? PCT_FMT : NUM_FMT,
    inputBlue: true,
  });
}

function flagCell(label: string, severity: "HIGH" | "MEDIUM" | "LOW"): XLSX.CellObject {
  const bg = severity === "HIGH" ? C.RED_BG : severity === "MEDIUM" ? C.YELLOW_BG : C.GREEN_BG;
  const color = severity === "HIGH" ? C.RED_FG : severity === "MEDIUM" ? C.YELLOW_FG : C.GREEN_FG;
  return cell(label, { bold: true, bg, color, size: 9 });
}

// ── Worksheet builder ─────────────────────────────────────────────────────────
function buildSheet(
  rows: (XLSX.CellObject | string | number | null)[][],
  colWidths: number[]
): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  let maxCol = 0;

  rows.forEach((row, r) => {
    row.forEach((cellVal, c) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (cellVal === null || cellVal === undefined) {
        ws[addr] = { v: "", t: "s" };
      } else if (typeof cellVal === "object") {
        ws[addr] = cellVal as XLSX.CellObject;
      } else {
        ws[addr] = { v: cellVal, t: typeof cellVal === "number" ? "n" : "s" };
      }
      if (c > maxCol) maxCol = c;
    });
  });

  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: maxCol } });
  ws["!cols"] = colWidths.map((w) => ({ wch: w }));
  ws["!rows"] = rows.map(() => ({ hpt: 16 }));
  return ws;
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1: Summary
// ─────────────────────────────────────────────────────────────────────────────
function buildSummarySheet(report: WS2Report): XLSX.WorkSheet {
  const { ws21, ws22, ws23 } = report;
  const pl = ws21.annualPL;
  const wc = ws21.workingCapital;
  const val = ws22?.valuation;

  const rows: (XLSX.CellObject | string | number | null)[][] = [
    // Title block
    [titleCell(`${report.clientName} — WS2 Financial Analysis Summary`), null, null, null, null],
    [cell("Prepared by Cantara Pet Advisors", { italic: true, color: C.MUTED, size: 9 }), null, null, null, null],
    [cell(`Approval: ${formatDisplayDateTime(ws21.approvedAt)} | Generated: ${formatDisplayDateTime(report.reportGeneratedAt)}`, { italic: true, color: C.MUTED, size: 9 }), null, null, null, null],
    [null],
    // Section A header
    [hdrCell("SECTION A — FINANCIAL SNAPSHOT", true), hdrCell("FY 2022"), hdrCell("FY 2023"), hdrCell("FY 2024 / TTM"), hdrCell("YoY (FY2→FY3)")],
    [cell("Total Revenue", { bold: true }), inputCell(pl.totalRevenue.fy1), inputCell(pl.totalRevenue.fy2), inputCell(pl.totalRevenue.ttm), cell(pl.yoyRevenueGrowth.fy2toFy3, { fmt: PCT_FMT, color: pl.yoyRevenueGrowth.fy2toFy3 >= 0 ? C.GREEN_FG : C.RED_FG })],
    [cell("Gross Profit"), inputCell(pl.grossProfit.fy1), inputCell(pl.grossProfit.fy2), inputCell(pl.grossProfit.ttm), null],
    [cell("Gross Margin %"), cell(pl.grossMargin.fy1, { fmt: PCT_FMT }), cell(pl.grossMargin.fy2, { fmt: PCT_FMT }), cell(pl.grossMargin.ttm, { fmt: PCT_FMT }), null],
    [cell("Total Operating Expenses"), inputCell(pl.totalOpex.fy1), inputCell(pl.totalOpex.fy2), inputCell(pl.totalOpex.ttm), null],
    [cell("4-Wall EBITDA (Pre-Recast)", { bold: true }), ebitdaCell(pl.ebitdaPreRecast.fy1), ebitdaCell(pl.ebitdaPreRecast.fy2), ebitdaCell(pl.ebitdaPreRecast.ttm), null],
    [cell("EBITDA Margin %"), cell(pl.ebitdaMargin.fy1, { fmt: PCT_FMT }), cell(pl.ebitdaMargin.fy2, { fmt: PCT_FMT }), cell(pl.ebitdaMargin.ttm, { fmt: PCT_FMT }), null],
    [null],
    // Section B
    [hdrCell("SECTION B — RECAST SUMMARY (TTM)", true), hdrCell("Amount"), hdrCell("% of Revenue"), null, null],
    [cell("4-Wall EBITDA (Pre-Recast)"), inputCell(ws21.annualPL.ebitdaPreRecast.ttm), cell(ws21.annualPL.ebitdaMargin.ttm, { fmt: PCT_FMT }), null, null],
    [cell("Total Add-Backs"), ws22 ? inputCell(ws22.recastSchedule.totalAddBacks) : cell("—"), null, null, null],
    [cell("Normalized EBITDA (TTM)", { bold: true }), ws22 ? ebitdaCell(ws22.recastSchedule.normalizedEbitdaTTM) : cell("—"), ws22 ? cell(ws22.recastSchedule.normalizedMarginTTM, { fmt: PCT_FMT }) : cell("—"), null, null],
    [null],
    // Section C
    [hdrCell("SECTION C — PRELIMINARY VALUATION RANGE", true), hdrCell("Low"), hdrCell("Mid"), hdrCell("High"), null],
    [cell("Multiple Applied"), val ? cell(val.multipleAssumptions.low, { fmt: MULT_FMT }) : cell("—"), val ? cell(val.multipleAssumptions.mid, { fmt: MULT_FMT }) : cell("—"), val ? cell(val.multipleAssumptions.high, { fmt: MULT_FMT }) : cell("—"), null],
    [cell("Valuation Range", { bold: true }), val ? totalCell(val.valuationLow) : cell("—"), val ? totalCell(val.valuationMid, true) : cell("—"), val ? totalCell(val.valuationHigh) : cell("—"), null],
    [cell("Revenue Multiple"), val ? cell(val.revenueMultipleLow, { fmt: MULT_FMT }) : cell("—"), val ? cell(val.revenueMultipleMid, { fmt: MULT_FMT }) : cell("—"), val ? cell(val.revenueMultipleHigh, { fmt: MULT_FMT }) : cell("—"), null],
    [null],
    // Section D
    [hdrCell("SECTION D — REVENUE MIX (TTM)", true), hdrCell("$ Amount"), hdrCell("% of Revenue"), hdrCell("YoY Trend"), null],
    ...(ws23?.verticals ?? []).map((v) => [
      cell(v.name),
      inputCell(v.ttmDollar),
      cell(v.ttmPct, { fmt: PCT_FMT }),
      cell(v.yoyFy2toFy3 >= 0 ? `↑ ${(v.yoyFy2toFy3 * 100).toFixed(1)}%` : `↓ ${(v.yoyFy2toFy3 * 100).toFixed(1)}%`, { color: v.yoyFy2toFy3 >= 0 ? C.GREEN_FG : C.RED_FG }),
      null,
    ] as (XLSX.CellObject | null)[]),
    [null],
    // Data quality summary
    [hdrCell("SECTION E — DATA QUALITY & HITL STATUS", true), hdrCell("Count"), null, null, null],
    [cell("Total Flags Raised"), cell(ws21.dataQuality.totalFlags), null, null, null],
    [cell("Flags Resolved"), cell(ws21.dataQuality.resolvedFlags), null, null, null],
    [cell("Outstanding Flags"), cell(ws21.dataQuality.totalFlags - ws21.dataQuality.resolvedFlags), null, null, null],
    [cell("WS2-1 Approval"), cell(ws21.status === "APPROVED" ? `✓ ${formatDisplayDateTime(ws21.approvedAt)}` : "PENDING"), null, null, null],
    [cell("WS2-2 Approval"), cell(ws22?.status === "APPROVED" ? `✓ ${formatDisplayDateTime(ws22.approvedAt)}` : "PENDING"), null, null, null],
    [null],
    [cell("DISCLAIMER: PRELIMINARY — FOR INTERNAL CANTARA USE ONLY. Must not be shared with seller until approved for client release.", { italic: true, color: C.RED_FG, size: 9 }), null, null, null, null],
  ];

  return buildSheet(rows, [38, 18, 18, 18, 16]);
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: Assumptions
// ─────────────────────────────────────────────────────────────────────────────
function buildAssumptionsSheet(report: WS2Report): XLSX.WorkSheet {
  const ci = report.ws22?.craigInputs;
  const val = report.ws22?.valuation;
  const actualRentPaid = (() => {
    const analysis = report.rawAnalysis as any
    const mappedPlRows = Array.isArray(analysis?.normalizedData?.mappedPlRows) ? analysis.normalizedData.mappedPlRows as Array<{ cantaraCode?: string | null; valuesByMonth?: Record<string, number> }> : []
    const monthKeys = mappedPlRows[0] ? Object.keys(mappedPlRows[0].valuesByMonth ?? {}).sort() : []
    const ttmMonths = monthKeys.slice(-12)
    return mappedPlRows
      .filter((row) => ['OPX-RENT', 'OPX-RENT-NNN'].includes(row.cantaraCode ?? ''))
      .reduce((sum, row) => sum + ttmMonths.reduce((rowSum, month) => rowSum + Number(row.valuesByMonth?.[month] ?? 0), 0), 0)
  })()

  const rows: (XLSX.CellObject | string | number | null)[][] = [
    [titleCell("CRAIG'S INPUTS — WS2-2 EBITDA RECAST"), null, null],
    [cell(`Entered | ${ci?.enteredAt ? formatDisplayDateTime(ci.enteredAt) : "—"}`, { italic: true, color: C.MUTED, size: 9 }), null, null],
    [null],
    [hdrCell("VALUATION MULTIPLES", true), hdrCell("Value"), hdrCell("Notes")],
    [cell("Multiple — Low End"), ci ? inputCell(ci.multipleRangeLow, false) : cell("—"), cell("Low end of pet resort multiple range", { italic: true, color: C.MUTED })],
    [cell("Multiple — Mid Point"), ci ? inputCell(ci.multipleRangeMid, false) : cell("—"), cell("Most likely multiple for this business", { italic: true, color: C.MUTED })],
    [cell("Multiple — High End"), ci ? inputCell(ci.multipleRangeHigh, false) : cell("—"), cell("High end — used for optimistic scenario", { italic: true, color: C.MUTED })],
    [null],
    [hdrCell("OVERRIDE LOG", true), hdrCell("Override Amount"), hdrCell("Reason / Timestamp")],
    ...(report.ws22?.recastSchedule.addBackItems
      .filter((i) => i.status === "CRAIG-OVERRIDE")
      .map((i) => [
        cell(i.description),
        inputCell(i.craigOverrideAmount ?? i.ttmAmount),
        cell(i.craigOverrideReason ?? "—", { italic: true, color: C.MUTED }),
      ] as (XLSX.CellObject | null)[]) ?? [[cell("No overrides recorded"), null, null]]),
  ];

  return buildSheet(rows, [36, 18, 40]);
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3: Normalization Items (mirrors Foothills exactly)
// ─────────────────────────────────────────────────────────────────────────────
function buildNormalizationSheet(report: WS2Report): XLSX.WorkSheet {
  const recast = report.ws22?.recastSchedule;
  const pl = report.ws21.annualPL;

  const catLabel: Record<number, string> = {
    1: "CATEGORY 1 — Owner / Officer Compensation",
    2: "CATEGORY 2 — Personal Expenses",
    3: "CATEGORY 3 — One-Off Non-Recurring",
    4: "CATEGORY 4 — Tenant Improvements",
    5: "CATEGORY 5 — Fair Market Rent",
  };

  const statusColor = (s: string): string => {
    if (s.includes("FLAGGED") || s.includes("MISSING")) return C.RED_FG;
    if (s === "DEFAULT") return C.YELLOW_FG;
    return C.GREEN_FG;
  };
  const statusBg = (s: string): string => {
    if (s.includes("FLAGGED") || s.includes("MISSING")) return C.RED_BG;
    if (s === "DEFAULT") return C.YELLOW_BG;
    return C.GREEN_BG;
  };

  const rows: (XLSX.CellObject | string | number | null)[][] = [
    [titleCell(`${report.clientName} — EBITDA Normalization / Add-Back Schedule`), null, null, null, null, null],
    [cell(`Approved: ${formatDisplayDateTime(report.ws22?.approvedAt)}`, { italic: true, color: C.MUTED, size: 9 }), null, null, null, null, null],
    [null],
    [hdrCell(""), hdrCell(""), hdrCell(""), hdrCell("TTM"), hdrCell("FY3"), hdrCell("FY2"), hdrCell("GL Code"), hdrCell("Status")],
    // Starting point
    [cell("4-Wall EBITDA (Pre-Recast)", { bold: true }), null, null,
      ebitdaCell(pl.ebitdaPreRecast.ttm),
      ebitdaCell(pl.ebitdaPreRecast.fy3),
      ebitdaCell(pl.ebitdaPreRecast.fy2),
      null, null,
    ],
    [null],
  ];

  // Group by category
  const grouped = new Map<number, AddBackItem[]>();
  for (let i = 1; i <= 5; i++) grouped.set(i, []);
  recast?.addBackItems.forEach((item) => grouped.get(item.category)?.push(item));

  for (let cat = 1; cat <= 5; cat++) {
    const items = grouped.get(cat) ?? [];
    if (items.length === 0) continue;

    rows.push([sectionCell(catLabel[cat]), null, null, sectionCell(""), sectionCell(""), sectionCell(""), sectionCell(""), sectionCell("")]);

    items.forEach((item) => {
      rows.push([
        cell(`  ${item.id}`, { color: C.MUTED }),
        cell(item.description, { bold: false }),
        null,
        cell(item.ttmAmount, { fmt: NUM_FMT, color: item.ttmAmount >= 0 ? C.GREEN_FG : C.RED_FG }),
        item.fy3Amount != null ? cell(item.fy3Amount, { fmt: NUM_FMT, color: item.fy3Amount >= 0 ? C.GREEN_FG : C.RED_FG }) : cell("—"),
        item.fy2Amount != null ? cell(item.fy2Amount, { fmt: NUM_FMT, color: item.fy2Amount >= 0 ? C.GREEN_FG : C.RED_FG }) : cell("—"),
        cell(item.glCode ?? "—", { color: C.MUTED }),
        cell(item.status, { bg: statusBg(item.status), color: statusColor(item.status), bold: true, size: 9 }),
      ]);
      if (item.statusNote) {
        rows.push([null, cell(`  ↳ ${item.statusNote}`, { italic: true, color: C.MUTED, size: 9 }), null, null, null, null, null, null]);
      }
    });

    // Category subtotal
    const catTotal = items.reduce((sum, i) => sum + i.ttmAmount, 0);
    rows.push([
      null,
      cell(`Net ${catLabel[cat].split("—")[1].trim()} Add-Back`, { bold: true }),
      null,
      cell(catTotal, { bold: true, fmt: NUM_FMT, color: catTotal >= 0 ? C.GREEN_FG : C.RED_FG }),
      null, null, null, null,
    ]);
    rows.push([null]);
  }

  // Grand totals
  rows.push([
    cell("TOTAL ADD-BACKS", { bold: true, bg: C.GREY_BG, color: C.NAVY }), null, null,
    cell(recast?.totalAddBacks ?? 0, { bold: true, fmt: NUM_FMT, bg: C.GREY_BG, color: C.GREEN_FG }),
    null, null, null, null,
  ]);
  rows.push([
    cell("NORMALIZED EBITDA (TTM)", { bold: true, bg: C.NAVY, color: C.WHITE }), null, null,
    totalCell(recast?.normalizedEbitdaTTM ?? 0, true),
    null, null, null,
    cell(`${((recast?.normalizedMarginTTM ?? 0) * 100).toFixed(1)}% Margin`, { italic: true, color: C.MUTED }),
  ]);

  return buildSheet(rows, [6, 38, 4, 16, 16, 16, 12, 20]);
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 4: Valuation
// ─────────────────────────────────────────────────────────────────────────────
function buildValuationSheet(report: WS2Report): XLSX.WorkSheet {
  const val = report.ws22?.valuation;
  const pl = report.ws21.annualPL;

  const rows: (XLSX.CellObject | string | number | null)[][] = [
    [titleCell(`${report.clientName} — Valuation Summary`), null, null, null],
    [cell("PRELIMINARY — FOR INTERNAL CANTARA USE ONLY. Must not be shared with seller without approval.", { italic: true, color: C.RED_FG, size: 9 }), null, null, null],
    [null],
    [hdrCell("VALUATION INPUTS", true), hdrCell("Value"), hdrCell("Notes"), null],
    [cell("Normalized EBITDA (TTM)"), val ? inputCell(val.normalizedEbitda) : cell("—"), cell("Source: WS2-2 Recast Schedule", { italic: true, color: C.MUTED }), null],
    [cell("TTM Revenue"), inputCell(pl.totalRevenue.ttm), cell("Source: WS2-1 TTM P&L", { italic: true, color: C.MUTED }), null],
    [cell("Revenue Trend (FY2→FY3)"), cell(pl.yoyRevenueGrowth.fy2toFy3, { fmt: PCT_FMT, color: pl.yoyRevenueGrowth.fy2toFy3 >= 0 ? C.GREEN_FG : C.RED_FG }), null, null],
    [cell("Multiple Range (Low / Mid / High)"), val ? cell(`${val.multipleAssumptions.low}x / ${val.multipleAssumptions.mid}x / ${val.multipleAssumptions.high}x`) : cell("—"), cell("Approved inputs", { italic: true, color: C.MUTED }), null],
    [null],
    [hdrCell("VALUATION RANGE — BASED ON TTM NORMALIZED EBITDA", true), hdrCell("Low"), hdrCell("Mid"), hdrCell("High")],
    [cell("Multiple Applied"), val ? cell(val.multipleAssumptions.low, { fmt: MULT_FMT }) : cell("—"), val ? cell(val.multipleAssumptions.mid, { fmt: MULT_FMT, bold: true }) : cell("—"), val ? cell(val.multipleAssumptions.high, { fmt: MULT_FMT }) : cell("—")],
    [cell("Valuation", { bold: true }), val ? totalCell(val.valuationLow) : cell("—"), val ? totalCell(val.valuationMid, true) : cell("—"), val ? totalCell(val.valuationHigh) : cell("—")],
    [cell("Revenue Multiple (informational)"), val ? cell(val.revenueMultipleLow, { fmt: MULT_FMT, color: C.MUTED }) : cell("—"), val ? cell(val.revenueMultipleMid, { fmt: MULT_FMT, color: C.MUTED }) : cell("—"), val ? cell(val.revenueMultipleHigh, { fmt: MULT_FMT, color: C.MUTED }) : cell("—")],
    [null],
    [cell(val?.revenueTrendFlag ?? "No revenue trend flag.", { italic: true, color: C.MUTED, size: 9 }), null, null, null],
  ];

  return buildSheet(rows, [38, 18, 18, 18]);
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 5: TTM & 3-Year P&L
// ─────────────────────────────────────────────────────────────────────────────
function buildPLSheet(report: WS2Report): XLSX.WorkSheet {
  const pl = report.ws21.annualPL;
  const pc = pl.periodCoverage;

  const yoy = (v1: number, v2: number) => v1 !== 0 ? (v2 - v1) / Math.abs(v1) : 0;

  const rows: (XLSX.CellObject | string | number | null)[][] = [
    [titleCell(`${report.clientName} — TTM & 3-Year P&L Model`), null, null, null, null, null, null],
    [cell(`Data: ${pc.fy1Range} — ${pc.fy3Range} | TTM: ${pc.ttmLabel}`, { italic: true, color: C.MUTED, size: 9 }), null, null, null, null, null, null],
    [cell("Note: PRE-RECAST. Add-backs have NOT been applied. See Normalization Items tab.", { italic: true, color: C.RED_FG, size: 9 }), null, null, null, null, null, null],
    [null],
    [hdrCell("Line Item", true), hdrCell(pc.fy1Label), hdrCell("YoY"), hdrCell(pc.fy2Label), hdrCell("YoY"), hdrCell(pc.fy3Label), hdrCell("TTM"), null],

    // Revenue
    [sectionCell("REVENUE"), null, null, null, null, null, null],
    ...pl.revenueLines.map((l) => [
      cell(`  ${l.label}`),
      inputCell(l.fy1),
      cell(yoy(l.fy1, l.fy2), { fmt: PCT_FMT, color: yoy(l.fy1, l.fy2) >= 0 ? C.GREEN_FG : C.RED_FG }),
      inputCell(l.fy2),
      cell(yoy(l.fy2, l.fy3), { fmt: PCT_FMT, color: yoy(l.fy2, l.fy3) >= 0 ? C.GREEN_FG : C.RED_FG }),
      inputCell(l.fy3),
      inputCell(l.ttm),
      null,
    ] as (XLSX.CellObject | null)[]),
    [totalCell("Total Revenue"), totalCell(pl.totalRevenue.fy1), totalCell(`${pl.yoyRevenueGrowth.fy1toFy2 >= 0 ? '+' : ''}${(pl.yoyRevenueGrowth.fy1toFy2 * 100).toFixed(1)}%`), totalCell(pl.totalRevenue.fy2), totalCell(`${pl.yoyRevenueGrowth.fy2toFy3 >= 0 ? '+' : ''}${(pl.yoyRevenueGrowth.fy2toFy3 * 100).toFixed(1)}%`), totalCell(pl.totalRevenue.fy3), totalCell(pl.totalRevenue.ttm, true), null],
    [null],

    // COGS
    [sectionCell("COST OF GOODS SOLD"), null, null, null, null, null, null],
    ...pl.cogsLines.map((l) => [
      cell(`  ${l.label}`), inputCell(l.fy1), null, inputCell(l.fy2), null, inputCell(l.fy3), inputCell(l.ttm), null,
    ] as (XLSX.CellObject | null)[]),
    [totalCell("Total COGS"), totalCell(pl.totalCogs.fy1), null, totalCell(pl.totalCogs.fy2), null, totalCell(pl.totalCogs.fy3), totalCell(pl.totalCogs.ttm, true), null],
    [null],

    // Gross profit
    [cell("Gross Profit", { bold: true }), inputCell(pl.grossProfit.fy1), null, inputCell(pl.grossProfit.fy2), null, inputCell(pl.grossProfit.fy3), inputCell(pl.grossProfit.ttm), null],
    [cell("Gross Margin %"), cell(pl.grossMargin.fy1, { fmt: PCT_FMT }), null, cell(pl.grossMargin.fy2, { fmt: PCT_FMT }), null, cell(pl.grossMargin.fy3, { fmt: PCT_FMT }), cell(pl.grossMargin.ttm, { fmt: PCT_FMT }), null],
    [null],

    // OpEx
    [sectionCell("OPERATING EXPENSES"), null, null, null, null, null, null],
    ...pl.expenseLines.filter((l) => !l.excludedFromEbitda).map((l) => [
      cell(`  ${l.label}`), inputCell(l.fy1), null, inputCell(l.fy2), null, inputCell(l.fy3), inputCell(l.ttm), null,
    ] as (XLSX.CellObject | null)[]),
    [totalCell("Total Operating Expenses"), totalCell(pl.totalOpex.fy1), null, totalCell(pl.totalOpex.fy2), null, totalCell(pl.totalOpex.fy3), totalCell(pl.totalOpex.ttm, true), null],
    [null],

    // EBITDA
    [cell("4-Wall EBITDA (Pre-Recast)", { bold: true }), ebitdaCell(pl.ebitdaPreRecast.fy1), null, ebitdaCell(pl.ebitdaPreRecast.fy2), null, ebitdaCell(pl.ebitdaPreRecast.fy3), ebitdaCell(pl.ebitdaPreRecast.ttm), null],
    [cell("EBITDA Margin %"), cell(pl.ebitdaMargin.fy1, { fmt: PCT_FMT }), null, cell(pl.ebitdaMargin.fy2, { fmt: PCT_FMT }), null, cell(pl.ebitdaMargin.fy3, { fmt: PCT_FMT }), cell(pl.ebitdaMargin.ttm, { fmt: PCT_FMT }), null],
    [null],

    // D&A and Interest (excluded)
    [sectionCell("BELOW EBITDA (excluded from calculations above)"), null, null, null, null, null, null],
    ...pl.expenseLines.filter((l) => l.excludedFromEbitda).map((l) => [
      cell(`  ${l.label}`, { color: C.MUTED }), cell(l.fy1, { fmt: NUM_FMT, color: C.MUTED }), null, cell(l.fy2, { fmt: NUM_FMT, color: C.MUTED }), null, cell(l.fy3, { fmt: NUM_FMT, color: C.MUTED }), cell(l.ttm, { fmt: NUM_FMT, color: C.MUTED }), null,
    ] as (XLSX.CellObject | null)[]),
    [cell("Net Income"), inputCell(pl.netIncome.fy1), null, inputCell(pl.netIncome.fy2), null, inputCell(pl.netIncome.fy3), inputCell(pl.netIncome.ttm), null],
  ];

  return buildSheet(rows, [36, 16, 12, 16, 12, 16, 16, 4]);
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 6: Revenue by Vertical
// ─────────────────────────────────────────────────────────────────────────────
function buildVerticalSheet(report: WS2Report): XLSX.WorkSheet {
  const ws23 = report.ws23;
  if (!ws23) return buildSheet([[cell("WS2-3 not yet run.")]], [40]);

  const healthColor = (h: string) => h === "GREEN" ? C.GREEN_FG : h === "YELLOW" ? C.YELLOW_FG : C.RED_FG;
  const healthBg = (h: string) => h === "GREEN" ? C.GREEN_BG : h === "YELLOW" ? C.YELLOW_BG : C.RED_BG;

  const rows: (XLSX.CellObject | string | number | null)[][] = [
    [titleCell(`${report.clientName} — Revenue by Vertical`), null, null, null, null, null, null, null, null],
    [null],
    [hdrCell("Vertical", true), hdrCell("FY1 $"), hdrCell("FY1 %"), hdrCell("FY2 $"), hdrCell("FY2 %"), hdrCell("FY3 / TTM $"), hdrCell("TTM %"), hdrCell("YoY FY2→3"), hdrCell("Health")],
    ...ws23.verticals.map((v) => [
      cell(v.name, { bold: true }),
      inputCell(v.fy1Dollar),
      cell(v.fy1Pct, { fmt: PCT_FMT }),
      inputCell(v.fy2Dollar),
      cell(v.fy2Pct, { fmt: PCT_FMT }),
      inputCell(v.ttmDollar),
      cell(v.ttmPct, { fmt: PCT_FMT }),
      cell(v.yoyFy2toFy3, { fmt: PCT_FMT, color: v.yoyFy2toFy3 >= 0 ? C.GREEN_FG : C.RED_FG }),
      cell(v.health, { bg: healthBg(v.health), color: healthColor(v.health), bold: true }),
    ] as (XLSX.CellObject | null)[]),
    [null],
    [hdrCell("BOARDING + DAYCARE CONCENTRATION (Cantara threshold: ≥70%)", true), hdrCell("FY1"), hdrCell("FY2"), hdrCell("FY3 / TTM"), null, null, null, null, null],
    [
      cell("Boarding + Daycare Combined"),
      cell(ws23.boardingPlusDaycareConcentration.fy1, { fmt: PCT_FMT, color: ws23.boardingPlusDaycareConcentration.fy1 >= 0.70 ? C.GREEN_FG : C.YELLOW_FG }),
      cell(ws23.boardingPlusDaycareConcentration.fy2, { fmt: PCT_FMT, color: ws23.boardingPlusDaycareConcentration.fy2 >= 0.70 ? C.GREEN_FG : C.YELLOW_FG }),
      cell(ws23.boardingPlusDaycareConcentration.ttm, { fmt: PCT_FMT, color: ws23.boardingPlusDaycareConcentration.ttm >= 0.70 ? C.GREEN_FG : C.YELLOW_FG }),
      null, null, null, null, null,
    ],
    [null],
    ...(ws23.concentrationFlags.length > 0 ? [
      [sectionCell("CONCENTRATION FLAGS"), null, null, null, null, null, null, null, null],
      ...ws23.concentrationFlags.map((f) => [cell(`⚠ ${f}`, { color: C.YELLOW_FG, italic: true }), null, null, null, null, null, null, null, null] as (XLSX.CellObject | null)[]),
      [null],
    ] : []),
    ...(ws23.businessModelFlag ? [
      [cell(`⚠ BUSINESS MODEL FLAG: ${ws23.businessModelFlag}`, { color: C.RED_FG, italic: true, bold: true }), null, null, null, null, null, null, null, null],
    ] : []),
  ];

  return buildSheet(rows, [28, 14, 10, 14, 10, 14, 10, 12, 12]);
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 7: Expense Benchmarks
// ─────────────────────────────────────────────────────────────────────────────
function buildBenchmarkSheet(report: WS2Report): XLSX.WorkSheet {
  const ws24 = report.ws24;
  if (!ws24) return buildSheet([[cell("WS2-4 not yet run.")]], [40]);

  const flagColor = (f: string) => f === "GREEN" ? C.GREEN_FG : f === "YELLOW" ? C.YELLOW_FG : C.RED_FG;
  const flagBg = (f: string) => f === "GREEN" ? C.GREEN_BG : f === "YELLOW" ? C.YELLOW_BG : C.RED_BG;

  const rows: (XLSX.CellObject | string | number | null)[][] = [
    [titleCell(`${report.clientName} — P&L Expense Benchmark Analysis`), null, null, null, null, null, null, null, null, null, null],
    [null],
    [hdrCell("Category", true), hdrCell("Bench Low"), hdrCell("Bench High"), hdrCell("FY1 $"), hdrCell("FY1 %"), hdrCell("FY2 $"), hdrCell("FY2 %"), hdrCell("FY3 / TTM $"), hdrCell("TTM %"), hdrCell("Flag"), hdrCell("Note")],
    ...ws24.benchmarks.map((b) => [
      cell(b.category, { bold: true }),
      cell(b.benchmarkLow, { fmt: PCT_FMT, color: C.MUTED }),
      cell(b.benchmarkHigh, { fmt: PCT_FMT, color: C.MUTED }),
      inputCell(b.fy1Dollar),
      cell(b.fy1Pct, { fmt: PCT_FMT }),
      inputCell(b.fy2Dollar),
      cell(b.fy2Pct, { fmt: PCT_FMT }),
      inputCell(b.ttmDollar),
      cell(b.ttmPct, { fmt: PCT_FMT }),
      cell(b.flag, { bg: flagBg(b.flag), color: flagColor(b.flag), bold: true }),
      cell(b.flagNote ?? "—", { italic: true, color: C.MUTED, size: 9 }),
    ] as (XLSX.CellObject | null)[]),
    [null],
    [cell(`Overall Expense Health: ${ws24.overallHealth}`, { bold: true, bg: flagBg(ws24.overallHealth), color: flagColor(ws24.overallHealth) }), null, null, null, null, null, null, null, null, null, null],
    [cell(ws24.overallHealthNote, { italic: true, color: C.MUTED, size: 9 }), null, null, null, null, null, null, null, null, null, null],
    [null],
    [sectionCell("IMPROVEMENT OPPORTUNITIES"), null, null, null, null, null, null, null, null, null, null],
    ...ws24.improvementOpportunities.map((o) => [cell(`• ${o}`, { color: C.NAVY, size: 9 }), null, null, null, null, null, null, null, null, null, null] as (XLSX.CellObject | null)[]),
  ];

  return buildSheet(rows, [28, 12, 12, 14, 10, 14, 10, 14, 10, 10, 36]);
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 8: Labor Analysis
// ─────────────────────────────────────────────────────────────────────────────
function buildLaborSheet(report: WS2Report): XLSX.WorkSheet {
  const ws25 = report.ws25;
  if (!ws25) return buildSheet([[cell("WS2-5 not yet run.")]], [40]);

  const rows: (XLSX.CellObject | string | number | null)[][] = [
    [titleCell(`${report.clientName} — Labor Expense Analysis`), null, null, null, null, null],
    [null],
    [hdrCell("Category", true), hdrCell("TTM Amount"), hdrCell("TTM % Rev"), hdrCell("FY3 % Rev"), hdrCell("FY2 % Rev"), hdrCell("FY1 % Rev")],
    ...ws25.laborRows.map((l) => [
      cell(l.category, { bold: l.category.includes("TOTAL") }),
      l.category.includes("TOTAL") ? totalCell(l.ttmAmount) : inputCell(l.ttmAmount),
      cell(l.ttmPct, { fmt: PCT_FMT }),
      cell(l.fy3Pct, { fmt: PCT_FMT }),
      cell(l.fy2Pct, { fmt: PCT_FMT }),
      cell(l.fy1Pct, { fmt: PCT_FMT }),
    ] as (XLSX.CellObject | null)[]),
    [null],
    [sectionCell("BENCHMARK COMPARISON"), null, null, null, null, null],
    [cell("Direct Labor (ex-owner) — Cantara benchmark: 35%–45%"), cell(ws25.directLaborPct, { fmt: PCT_FMT, bold: true, color: ws25.benchmarkStatus === "GREEN" ? C.GREEN_FG : ws25.benchmarkStatus === "YELLOW" ? C.YELLOW_FG : C.RED_FG }), null, null, null, null],
    [cell(ws25.benchmarkNote, { italic: true, color: C.MUTED, size: 9 }), null, null, null, null, null],
    [null],
    [sectionCell("3-YEAR LABOR TREND"), null, null, null, null, null],
    [cell(ws25.trendNote, { italic: true, color: C.MUTED, size: 9 }), null, null, null, null, null],
    [null],
    [sectionCell("FLAGS"), null, null, null, null, null],
    ...(ws25.flags.length > 0
      ? ws25.flags.map((f) => [cell(`⚠ ${f}`, { color: C.RED_FG }), null, null, null, null, null] as (XLSX.CellObject | null)[])
      : [[cell("✓ No critical labor flags identified.", { color: C.GREEN_FG }), null, null, null, null, null]]
    ),
  ];

  return buildSheet(rows, [36, 16, 12, 12, 12, 12]);
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 9: Working Capital
// ─────────────────────────────────────────────────────────────────────────────
function buildWorkingCapitalSheet(report: WS2Report): XLSX.WorkSheet {
  const wc = report.ws21.workingCapital;

  const rows: (XLSX.CellObject | string | number | null)[][] = [
    [titleCell(`${report.clientName} — Working Capital Analysis`), null, null],
    [cell(`Most Recent Month-End: ${wc.asOfDate}`, { italic: true, color: C.MUTED, size: 9 }), null, null],
    [null],
    [hdrCell("CURRENT ASSETS", true), hdrCell("Amount"), null],
    [cell("  Cash & Equivalents"), inputCell(wc.cash), null],
    [cell("  Accounts Receivable"), inputCell(wc.accountsReceivable), null],
    [cell("  Inventory"), inputCell(wc.inventory), null],
    [cell("  Prepaid Expenses"), inputCell(wc.prepaidExpenses), null],
    [totalCell("Total Current Assets"), totalCell(wc.totalCurrentAssets), null],
    [null],
    [hdrCell("CURRENT LIABILITIES", true), hdrCell("Amount"), null],
    [cell("  Accounts Payable"), inputCell(wc.accountsPayable), null],
    [cell("  Accrued Liabilities"), inputCell(wc.accruedLiabilities), null],
    [cell("  Deferred Revenue"), inputCell(wc.deferredRevenue), null],
    [totalCell("Total Current Liabilities"), totalCell(wc.totalCurrentLiabilities), null],
    [null],
    [cell("Net Working Capital (Point-in-time)", { bold: true }), ebitdaCell(wc.netWorkingCapital), null],
    [cell("3-Month Trailing Average NWC", { bold: true }), ebitdaCell(wc.trailingThreeMonthAvgNWC), null],
    [cell("→ 3-Month Average NWC passed to Seller Net Proceeds Calculator", { italic: true, color: C.MUTED, size: 9 }), null, null],
  ];

  return buildSheet(rows, [36, 16, 14]);
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 10: Data Quality Report
// ─────────────────────────────────────────────────────────────────────────────
function buildDataQualitySheet(report: WS2Report): XLSX.WorkSheet {
  const dq = report.ws21.dataQuality;

  const rows: (XLSX.CellObject | string | number | null)[][] = [
    [titleCell(`${report.clientName} — Data Quality Report`), null, null, null, null],
    [cell(`WS2-1 Generated: ${formatDisplayDateTime(report.ws21.generatedAt)} | Review Completed: ${formatDisplayDateTime(report.ws21.approvedAt)}`, { italic: true, color: C.MUTED, size: 9 }), null, null, null, null],
    [null],
    [hdrCell("SUMMARY", true), hdrCell("Count"), null, null, null],
    [cell("Total Flags Raised"), cell(dq.totalFlags), null, null, null],
    [cell("Resolved"), cell(dq.resolvedFlags), null, null, null],
    [cell("Outstanding (should be 0 at approval)"), cell(dq.totalFlags - dq.resolvedFlags, { color: dq.totalFlags - dq.resolvedFlags > 0 ? C.RED_FG : C.GREEN_FG, bold: true }), null, null, null],
    [null],
  ];

  // Section A
  rows.push([sectionCell("SECTION A — GL CLASSIFICATION REQUESTS"), null, null, null, null]);
  if (dq.glClassificationRequests.length === 0) {
    rows.push([cell("✓ No GL classification requests. All accounts auto-mapped.", { color: C.GREEN_FG }), null, null, null, null]);
  } else {
    rows.push([hdrCell("Account Name"), hdrCell("GL Code"), hdrCell("Cantara Code"), hdrCell("Status"), hdrCell("Monthly $ Range")]);
    dq.glClassificationRequests.forEach((r) => {
      rows.push([cell(r.accountName), cell(r.glCode), cell(r.cantaraCode), flagCell(r.status, "MEDIUM"), null]);
    });
  }
  rows.push([null]);

  // Section C
  rows.push([sectionCell("SECTION C — ACCOUNTANT STATEMENT vs. MONTHLY P&L DISCREPANCIES"), null, null, null, null]);
  if (dq.accountantDiscrepancies.length === 0) {
    rows.push([cell("✓ No material discrepancies.", { color: C.GREEN_FG }), null, null, null, null]);
  } else {
    rows.push([hdrCell("Fiscal Year"), hdrCell("Line Item"), hdrCell("Monthly Rollup"), hdrCell("Accountant"), hdrCell("Variance $"), hdrCell("Variance %")]);
    dq.accountantDiscrepancies.forEach((d) => {
      const isHigh = Math.abs(d.variancePct) > 0.05;
      rows.push([
        cell(d.fiscalYear),
        cell(d.lineItem),
        inputCell(d.rollup),
        inputCell(d.accountant),
        cell(d.varianceDollar, { fmt: NUM_FMT, color: Math.abs(d.varianceDollar) > 5000 ? C.RED_FG : C.YELLOW_FG }),
        cell(d.variancePct, { fmt: PCT_FMT, color: isHigh ? C.RED_FG : C.YELLOW_FG }),
      ]);
    });
  }
  rows.push([null]);

  // All flags
  rows.push([sectionCell("ALL FLAGS — DETAIL"), null, null, null, null]);
  rows.push([hdrCell("Section"), hdrCell("Severity"), hdrCell("Title"), hdrCell("Description"), hdrCell("Resolved?")]);
  dq.flags.forEach((f) => {
    rows.push([
      cell(`Section ${f.section}`),
      flagCell(f.severity, f.severity),
      cell(f.title, { bold: true }),
      cell(f.description, { size: 9 }),
      cell(f.resolved ? "✓ Yes" : "⚠ No", { color: f.resolved ? C.GREEN_FG : C.RED_FG, bold: true }),
    ]);
    if (f.resolution) {
      rows.push([null, null, cell(`Resolution: ${f.resolution}`, { italic: true, color: C.MUTED, size: 9 }), null, null]);
    }
  });

  return buildSheet(rows, [20, 14, 32, 50, 14]);
}

function buildPnlNonAdjSheet(report: WS2Report): XLSX.WorkSheet {
  const analysis = report.rawAnalysis as any
  const mappedRows = Array.isArray(analysis?.normalizedData?.mappedPlRows) ? analysis.normalizedData.mappedPlRows as Array<{
    accountName?: string | null
    accountCode?: string | null
    cantaraCode?: string | null
    valuesByMonth?: Record<string, number>
  }> : []
  const monthKeys = mappedRows[0] ? Object.keys(mappedRows[0].valuesByMonth ?? {}).sort() : []
  const rows: (XLSX.CellObject | string | number | null)[][] = [
    [titleCell(`${report.clientName} — P&L - Non Adj`), null],
    [cell("Full raw mapped P&L rows. This is the audit trail for all monthly values received from the seller workbook.", { italic: true, color: C.MUTED, size: 9 }), null],
    [null],
    [
      hdrCell("Account Name", true),
      hdrCell("GL Code"),
      hdrCell("Cantara Code"),
      hdrCell("Category"),
      ...monthKeys.map((month) => hdrCell(month)),
      hdrCell("TTM"),
    ],
    ...mappedRows.map((row) => {
      const monthValues = monthKeys.map((month) => Number(row.valuesByMonth?.[month] ?? 0))
      const ttmAmount = monthValues.slice(-12).reduce((sum, value) => sum + value, 0)
      return [
        cell(row.accountName ?? "—"),
        cell(row.accountCode ?? "—"),
        cell(row.cantaraCode ?? "UNMAPPED"),
        cell(row.cantaraCode ? getCategoryLabel(row.cantaraCode) : "Unmapped", { color: C.MUTED }),
        ...monthValues.map((value) => cell(value, { fmt: NUM_FMT })),
        cell(ttmAmount, { fmt: NUM_FMT, bold: true }),
      ] as (XLSX.CellObject | null)[]
    }),
  ]
  return buildSheet(rows, [32, 12, 16, 24, ...monthKeys.map(() => 11), 14])
}

function buildGlMappingSheet(report: WS2Report): XLSX.WorkSheet {
  const analysis = report.rawAnalysis as any
  const mappedPlRows = Array.isArray(analysis?.normalizedData?.mappedPlRows) ? analysis.normalizedData.mappedPlRows : []
  const mappedBsRows = Array.isArray(analysis?.normalizedData?.mappedBsRows) ? analysis.normalizedData.mappedBsRows : []
  const rowsForSheet = [...mappedPlRows, ...mappedBsRows]
    .filter((row: any) => row?.accountCode)
    .map((row: any) => {
      const status =
        row.cantaraCode
          ? row.mappingMethod === 'claude' || row.mappingMethod === 'fuzzy'
            ? 'FLAGGED-AMBIGUOUS'
            : 'AUTO-MAPPED'
          : 'UNMAPPED'
      return {
        accountName: row.accountName ?? '—',
        glCode: row.accountCode ?? '—',
        cantaraCode: row.cantaraCode ?? 'UNMAPPED',
        category: row.cantaraCode ? getCategoryLabel(row.cantaraCode) : 'Unmapped',
        status,
      }
    })

  const rows: (XLSX.CellObject | string | number | null)[][] = [
    [titleCell(`${report.clientName} — GL Mapping`), null, null, null, null],
    [cell("Read-only GL mapping audit trail.", { italic: true, color: C.MUTED, size: 9 }), null, null, null],
    [null],
    [hdrCell("Account Name", true), hdrCell("GL Code"), hdrCell("Cantara Code"), hdrCell("Meaning"), hdrCell("Status")],
    ...(rowsForSheet.length
      ? rowsForSheet.map((row) => [
          cell(row.accountName),
          cell(row.glCode),
          cell(row.cantaraCode),
          cell(row.category, { color: C.MUTED }),
          cell(row.status, { color: row.status === 'UNMAPPED' ? C.RED_FG : row.status.includes('FLAGGED') ? C.YELLOW_FG : C.GREEN_FG }),
        ] as (XLSX.CellObject | null)[])
      : [[cell("No GL mapping rows available."), null, null, null, null]]),
  ]
  return buildSheet(rows, [34, 14, 18, 28, 18])
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT FUNCTION
// ─────────────────────────────────────────────────────────────────────────────
export function exportWS2Workbook(report: WS2Report): void {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, buildSummarySheet(report),        "Summary");
  XLSX.utils.book_append_sheet(wb, buildAssumptionsSheet(report),    "Assumptions");
  XLSX.utils.book_append_sheet(wb, buildPnlNonAdjSheet(report),      "P&L - Non Adj");
  XLSX.utils.book_append_sheet(wb, buildGlMappingSheet(report),      "GL Mapping");
  XLSX.utils.book_append_sheet(wb, buildPLSheet(report),             "TTM & 3-Year P&L");
  XLSX.utils.book_append_sheet(wb, buildNormalizationSheet(report),  "Normalization Items");
  XLSX.utils.book_append_sheet(wb, buildValuationSheet(report),      "Valuation");
  XLSX.utils.book_append_sheet(wb, buildVerticalSheet(report),       "Revenue by Vertical");
  XLSX.utils.book_append_sheet(wb, buildBenchmarkSheet(report),      "Expense Benchmarks");
  XLSX.utils.book_append_sheet(wb, buildLaborSheet(report),          "Labor Analysis");
  XLSX.utils.book_append_sheet(wb, buildWorkingCapitalSheet(report), "Working Capital");
  XLSX.utils.book_append_sheet(wb, buildDataQualitySheet(report),    "Data Quality Report");

  const slug = report.clientName.replace(/[^a-zA-Z0-9]/g, "_");
  const date = new Date().toISOString().split("T")[0];
  const filename = `${slug}_WS2_Financial_Analysis_${date}.xlsx`;

  XLSX.writeFile(wb, filename, { cellStyles: true });
}

// Server-side buffer export (for Next.js API routes)
export function exportWS2WorkbookBuffer(report: WS2Report): Buffer {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, buildSummarySheet(report),        "Summary");
  XLSX.utils.book_append_sheet(wb, buildAssumptionsSheet(report),    "Assumptions");
  XLSX.utils.book_append_sheet(wb, buildPnlNonAdjSheet(report),      "P&L - Non Adj");
  XLSX.utils.book_append_sheet(wb, buildGlMappingSheet(report),      "GL Mapping");
  XLSX.utils.book_append_sheet(wb, buildPLSheet(report),             "TTM & 3-Year P&L");
  XLSX.utils.book_append_sheet(wb, buildNormalizationSheet(report),  "Normalization Items");
  XLSX.utils.book_append_sheet(wb, buildValuationSheet(report),      "Valuation");
  XLSX.utils.book_append_sheet(wb, buildVerticalSheet(report),       "Revenue by Vertical");
  XLSX.utils.book_append_sheet(wb, buildBenchmarkSheet(report),      "Expense Benchmarks");
  XLSX.utils.book_append_sheet(wb, buildLaborSheet(report),          "Labor Analysis");
  XLSX.utils.book_append_sheet(wb, buildWorkingCapitalSheet(report), "Working Capital");
  XLSX.utils.book_append_sheet(wb, buildDataQualitySheet(report),    "Data Quality Report");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx", cellStyles: true }) as Buffer;
}
