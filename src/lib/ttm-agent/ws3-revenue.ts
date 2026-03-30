/**
 * WS2-3: Revenue by Vertical — Deterministic Computation
 *
 * Takes WS2-1 revenue data and produces:
 * 1. Revenue mix by vertical ($ and % per period)
 * 2. YoY growth rates
 * 3. Concentration flags
 * 4. Traffic light health ratings
 */

import type { TtmAnalysisView } from "@/lib/ttm-agent/types";

export interface VerticalRevenue {
  name: string;
  cantaraCode: string;
  ltm: number;
  ltmPct: number;
  fy3: number;
  fy3Pct: number;
  fy2: number;
  fy2Pct: number;
  fy1: number;
  fy1Pct: number;
  yoyFy1toFy2: number | null; // % change
  yoyFy2toFy3: number | null;
  health: "GREEN" | "YELLOW" | "RED";
  healthNote: string;
}

export interface ConcentrationFlag {
  type: "BOARDING_DAYCARE_LOW" | "SINGLE_VERTICAL_HIGH" | "GROOMING_HIGH";
  message: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
}

export interface RevenueByVerticalResult {
  verticals: VerticalRevenue[];
  totalRevenue: { ltm: number; fy3: number; fy2: number; fy1: number };
  boardingDaycareConcentration: { ltm: number; fy3: number; fy2: number; fy1: number };
  concentrationFlags: ConcentrationFlag[];
  unmappedRevenue: Array<{ name: string; code: string; ltm: number }>;
}

// Cantara standard verticals
const VERTICAL_MAP: Array<{ name: string; codes: string[] }> = [
  { name: "Boarding", codes: ["REV-BOARD"] },
  { name: "Daycare", codes: ["REV-DAY"] },
  { name: "Grooming", codes: ["REV-GROOM"] },
  { name: "Training", codes: ["REV-TRAIN"] },
  { name: "Retail", codes: ["REV-RETAIL"] },
  { name: "Membership", codes: ["REV-MEM"] },
  { name: "Tips", codes: ["REV-TIPS"] },
  { name: "Discounts & Refunds", codes: ["REV-DISC"] },
  { name: "Other Revenue", codes: ["REV-OTHER"] },
];

function pct(part: number, total: number): number {
  return total !== 0 ? part / total : 0;
}

function yoy(prev: number, next: number): number | null {
  if (prev === 0) return next === 0 ? 0 : null;
  return (next - prev) / Math.abs(prev);
}

export function computeRevenueByVertical(analysis: TtmAnalysisView): RevenueByVerticalResult {
  const years = analysis.annualModel?.years ?? [];
  const ttm = analysis.ttmSummary;

  // Revenue by cantara code per period
  const getRevByCode = (code: string): { ltm: number; fy3: number; fy2: number; fy1: number } => {
    const ttmRow = ttm?.revenueByCategory?.find(r => r.code === code);
    const fy3Row = years[2]?.revenueByCategory?.find(r => r.code === code);
    const fy2Row = years[1]?.revenueByCategory?.find(r => r.code === code);
    const fy1Row = years[0]?.revenueByCategory?.find(r => r.code === code);
    return {
      ltm: ttmRow?.value ?? fy3Row?.value ?? 0,
      fy3: fy3Row?.value ?? 0,
      fy2: fy2Row?.value ?? 0,
      fy1: fy1Row?.value ?? 0,
    };
  };

  const totalRev = {
    ltm: ttm?.totalRevenue ?? years[2]?.totalRevenue ?? 0,
    fy3: years[2]?.totalRevenue ?? 0,
    fy2: years[1]?.totalRevenue ?? 0,
    fy1: years[0]?.totalRevenue ?? 0,
  };

  // Build verticals
  const allMappedCodes = new Set(VERTICAL_MAP.flatMap(v => v.codes));
  const verticals: VerticalRevenue[] = [];

  for (const vDef of VERTICAL_MAP) {
    let ltm = 0, fy3 = 0, fy2 = 0, fy1 = 0;
    for (const code of vDef.codes) {
      const rev = getRevByCode(code);
      ltm += rev.ltm;
      fy3 += rev.fy3;
      fy2 += rev.fy2;
      fy1 += rev.fy1;
    }

    // Skip verticals with zero across all periods
    if (ltm === 0 && fy3 === 0 && fy2 === 0 && fy1 === 0) continue;

    const yoy12 = yoy(fy1, fy2);
    const yoy23 = yoy(fy2, fy3);

    // Health rating
    let health: "GREEN" | "YELLOW" | "RED" = "GREEN";
    let healthNote = "Stable";

    if (yoy23 !== null && yoy23 < -0.15) {
      health = "RED";
      healthNote = `Declining ${(yoy23 * 100).toFixed(0)}% YoY`;
    } else if (yoy23 !== null && yoy23 < -0.05) {
      health = "YELLOW";
      healthNote = `Slight decline ${(yoy23 * 100).toFixed(0)}% YoY`;
    } else if (yoy23 !== null && yoy23 > 0.1) {
      healthNote = `Growing ${(yoy23 * 100).toFixed(0)}% YoY`;
    } else if (yoy23 !== null) {
      healthNote = `Stable (${(yoy23 * 100).toFixed(0)}% YoY)`;
    }

    verticals.push({
      name: vDef.name,
      cantaraCode: vDef.codes[0],
      ltm, ltmPct: pct(ltm, totalRev.ltm),
      fy3, fy3Pct: pct(fy3, totalRev.fy3),
      fy2, fy2Pct: pct(fy2, totalRev.fy2),
      fy1, fy1Pct: pct(fy1, totalRev.fy1),
      yoyFy1toFy2: yoy12,
      yoyFy2toFy3: yoy23,
      health,
      healthNote,
    });
  }

  // Sort by LTM $ descending (largest first), but keep Discounts at end
  verticals.sort((a, b) => {
    if (a.cantaraCode === "REV-DISC") return 1;
    if (b.cantaraCode === "REV-DISC") return -1;
    return Math.abs(b.ltm) - Math.abs(a.ltm);
  });

  // Boarding + Daycare concentration
  const boardingCodes = ["REV-BOARD"];
  const daycareCodes = ["REV-DAY"];
  const bdLtm = verticals.filter(v => boardingCodes.includes(v.cantaraCode) || daycareCodes.includes(v.cantaraCode)).reduce((s, v) => s + v.ltm, 0);
  const bdFy3 = verticals.filter(v => boardingCodes.includes(v.cantaraCode) || daycareCodes.includes(v.cantaraCode)).reduce((s, v) => s + v.fy3, 0);
  const bdFy2 = verticals.filter(v => boardingCodes.includes(v.cantaraCode) || daycareCodes.includes(v.cantaraCode)).reduce((s, v) => s + v.fy2, 0);
  const bdFy1 = verticals.filter(v => boardingCodes.includes(v.cantaraCode) || daycareCodes.includes(v.cantaraCode)).reduce((s, v) => s + v.fy1, 0);

  const boardingDaycareConcentration = {
    ltm: pct(bdLtm, totalRev.ltm),
    fy3: pct(bdFy3, totalRev.fy3),
    fy2: pct(bdFy2, totalRev.fy2),
    fy1: pct(bdFy1, totalRev.fy1),
  };

  // Concentration flags
  const concentrationFlags: ConcentrationFlag[] = [];

  if (boardingDaycareConcentration.ltm < 0.70) {
    concentrationFlags.push({
      type: "BOARDING_DAYCARE_LOW",
      message: `Boarding and Daycare combined is ${(boardingDaycareConcentration.ltm * 100).toFixed(0)}% of revenue, which is below the 70% Cantara benchmark for a standard boarding-first pet resort. This business has a different revenue profile than a typical boarding facility.`,
      severity: "WARNING",
    });
  }

  for (const v of verticals) {
    if (v.ltmPct > 0.60 && v.cantaraCode !== "REV-DISC") {
      concentrationFlags.push({
        type: "SINGLE_VERTICAL_HIGH",
        message: `${v.name} represents ${(v.ltmPct * 100).toFixed(0)}% of revenue — concentration risk.`,
        severity: "CRITICAL",
      });
    }
  }

  const groomingV = verticals.find(v => v.cantaraCode === "REV-GROOM");
  if (groomingV && groomingV.ltmPct > 0.40) {
    concentrationFlags.push({
      type: "GROOMING_HIGH",
      message: `Grooming at ${(groomingV.ltmPct * 100).toFixed(0)}% of revenue. Grooming revenue is dependent on individual groomer relationships and harder to transfer to a buyer.`,
      severity: "WARNING",
    });
  }

  // Unmapped revenue
  const allRevenueCategories = [
    ...(ttm?.revenueByCategory ?? []),
    ...(years.flatMap(y => y.revenueByCategory ?? [])),
  ];
  const unmapped = allRevenueCategories
    .filter(r => !allMappedCodes.has(r.code) && r.value !== 0)
    .map(r => ({ name: r.category ?? r.code, code: r.code, ltm: r.value }));

  console.log(`[WS2-3] Revenue by Vertical: ${verticals.length} verticals, B+D=${(boardingDaycareConcentration.ltm * 100).toFixed(0)}%, ${concentrationFlags.length} flags`);

  return {
    verticals,
    totalRevenue: totalRev,
    boardingDaycareConcentration,
    concentrationFlags,
    unmappedRevenue: unmapped,
  };
}
