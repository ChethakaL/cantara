"use client";

// ─────────────────────────────────────────────────────────────────────────────
// WS2Report.tsx
// Cantara Pet Advisors Portal — Babalilm AI FZ-LLC
//
// Professional report UI for WS2 Financial Analysis output.
// Replaces raw markdown rendering with structured, styled components.
//
// Usage in your page:
//   import { WS2Report } from "@/components/ws2/WS2Report";
//   <WS2Report report={ws2Data} />
//
// Install dependencies:
//   npm install xlsx lucide-react
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from "react";
import { Download, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react";
import { exportWS2Workbook } from "@/lib/ws2/ws2-export";
import type {
  WS2Report as WS2ReportType,
  DQFlag,
  AddBackItem,
  BenchmarkRow,
  VerticalRow,
  LaborRow,
  TrafficLight,
  FlagSeverity,
} from "@/lib/ws2/ws2-types";

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  navy:      "#0F2340",
  gold:      "#C9A84C",
  goldLight: "#FFF0D0",
  cream:     "#FAFAF7",
  border:    "#E4E1D8",
  muted:     "#8A8780",
  green:     "#2D6A4F",
  greenBg:   "#EAF4EE",
  yellow:    "#B45309",
  yellowBg:  "#FEF9E7",
  red:       "#991B1B",
  redBg:     "#FEF2F2",
  greyBg:    "#F5F3EF",
  white:     "#FFFFFF",
};

// ── Utility: format currency ──────────────────────────────────────────────────
const fmt = {
  dollar: (v: number) =>
    v < 0
      ? `($${Math.abs(v).toLocaleString("en-US")})`
      : `$${v.toLocaleString("en-US")}`,
  pct: (v: number) => `${(v * 100).toFixed(1)}%`,
  mult: (v: number) => `${v.toFixed(1)}x`,
  yoy: (v: number) =>
    v >= 0 ? `+${(v * 100).toFixed(1)}%` : `${(v * 100).toFixed(1)}%`,
};

// ── Sub-components ────────────────────────────────────────────────────────────

const SectionCard = ({
  title,
  tag,
  tagType = "neutral",
  children,
  defaultOpen = true,
}: {
  title: string;
  tag?: string;
  tagType?: "approved" | "flag" | "alert" | "neutral";
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const tagColors: Record<string, { bg: string; color: string }> = {
    approved: { bg: T.greenBg, color: T.green },
    flag:     { bg: T.yellowBg, color: T.yellow },
    alert:    { bg: T.redBg, color: T.red },
    neutral:  { bg: T.greyBg, color: T.muted },
  };
  const tc = tagColors[tagType];

  return (
    <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 2, overflow: "hidden", marginBottom: 0 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", padding: "12px 20px", display: "flex", alignItems: "center",
          justifyContent: "space-between", background: T.greyBg,
          borderBottom: `1px solid ${T.border}`, cursor: "pointer", border: "none",
        }}
      >
        <span style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.navy }}>{title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {tag && (
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 2, background: tc.bg, color: tc.color }}>
              {tag}
            </span>
          )}
          {open ? <ChevronUp size={14} color={T.muted} /> : <ChevronDown size={14} color={T.muted} />}
        </div>
      </button>
      {open && children}
    </div>
  );
};

const TrafficDot = ({ status, size = 10 }: { status: TrafficLight; size?: number }) => {
  const colors = { GREEN: T.green, YELLOW: T.yellow, RED: T.red };
  return <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: colors[status] ?? T.muted }} />;
};

const FlagCard = ({ flag }: { flag: DQFlag }) => {
  const conf: Record<FlagSeverity, { bg: string; border: string; color: string; icon: React.ReactNode }> = {
    HIGH:   { bg: T.redBg,    border: "#FECACA", color: T.red,    icon: <XCircle size={14} color={T.red} /> },
    MEDIUM: { bg: T.yellowBg, border: "#FDE68A", color: T.yellow, icon: <AlertTriangle size={14} color={T.yellow} /> },
    LOW:    { bg: T.greenBg,  border: "#BBF7D0", color: T.green,  icon: <CheckCircle size={14} color={T.green} /> },
  };
  const c = conf[flag.severity];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "20px 1fr auto", gap: 10, padding: "10px 14px", background: c.bg, border: `1px solid ${c.border}`, borderRadius: 2, alignItems: "start" }}>
      <div style={{ marginTop: 1 }}>{c.icon}</div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 12, color: c.color, marginBottom: 2 }}>{flag.title}</div>
        <div style={{ fontSize: 11, color: "#555", lineHeight: 1.5 }}>{flag.description}</div>
        {flag.resolution && <div style={{ fontSize: 10, color: T.muted, marginTop: 4, fontStyle: "italic" }}>↳ Craig: {flag.resolution}</div>}
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 6px", borderRadius: 2, background: c.color, color: T.white, whiteSpace: "nowrap" }}>
        {flag.severity} · §{flag.section}
      </div>
    </div>
  );
};

const DataTable = ({
  headers,
  rows,
  colWidths,
}: {
  headers: string[];
  rows: { cells: (string | React.ReactNode)[]; isTotal?: boolean; isSection?: boolean; isEbitda?: boolean }[];
  colWidths?: string[];
}) => (
  <div style={{ overflowX: "auto" }}>
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={i} style={{
              padding: "8px 14px", fontSize: 10, fontWeight: 600, letterSpacing: "0.06em",
              textTransform: "uppercase", color: T.muted, background: T.greyBg,
              borderBottom: `1px solid ${T.border}`, textAlign: i === 0 ? "left" : "right",
              whiteSpace: "nowrap", width: colWidths?.[i],
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} style={{ background: row.isTotal ? T.navy : row.isSection ? T.greyBg : row.isEbitda ? "#F0EDE8" : "transparent" }}>
            {row.cells.map((cell, ci) => (
              <td key={ci} style={{
                padding: row.isSection ? "5px 14px" : "7px 14px",
                fontSize: row.isSection ? 10 : 12,
                fontWeight: row.isTotal || row.isEbitda || row.isSection ? 700 : 400,
                color: row.isTotal ? T.white : row.isSection ? T.muted : "inherit",
                textAlign: ci === 0 ? "left" : "right",
                fontFamily: ci > 0 && !row.isSection ? "'DM Mono', 'Courier New', monospace" : "inherit",
                letterSpacing: row.isSection ? "0.06em" : 0,
                textTransform: row.isSection ? "uppercase" : "none",
                borderBottom: `1px solid ${row.isTotal ? "transparent" : "#F0EDE8"}`,
                borderTop: row.isEbitda && ci === 0 ? `2px solid ${T.gold}` : "none",
              }}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ── KPI Strip ─────────────────────────────────────────────────────────────────
const KPIStrip = ({ report }: { report: WS2ReportType }) => {
  const pl = report.ws21.annualPL;
  const norm = report.ws22?.recastSchedule.normalizedEbitdaTTM;
  const val = report.ws22?.valuation;

  return (
    <div style={{ background: T.white, borderBottom: `1px solid ${T.border}`, display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
      {[
        { label: "TTM Revenue", value: fmt.dollar(pl.totalRevenue.ttm), delta: `↑ ${fmt.yoy(pl.yoyRevenueGrowth.fy2toFy3)} YoY`, deltaOk: true },
        { label: "Gross Margin", value: fmt.pct(pl.grossMargin.ttm), delta: "Stable 3-year", deltaOk: true },
        { label: "Normalized EBITDA", value: norm ? fmt.dollar(norm) : "—", delta: `Pre-recast: ${fmt.dollar(pl.ebitdaPreRecast.ttm)}`, deltaOk: false },
        { label: "Valuation Range", value: val ? fmt.dollar(val.valuationMid) : "—", delta: val ? `${fmt.dollar(val.valuationLow)} — ${fmt.dollar(val.valuationHigh)}` : "Pending WS2-2", deltaOk: true },
      ].map((kpi, i) => (
        <div key={i} style={{ padding: "18px 24px", borderRight: i < 3 ? `1px solid ${T.border}` : "none" }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted, marginBottom: 4 }}>{kpi.label}</div>
          <div style={{ fontFamily: "'DM Mono', 'Courier New', monospace", fontSize: 22, fontWeight: 600, color: T.navy, lineHeight: 1 }}>{kpi.value}</div>
          <div style={{ fontSize: 11, marginTop: 4, color: kpi.deltaOk ? T.green : T.yellow, fontWeight: 500 }}>{kpi.delta}</div>
        </div>
      ))}
    </div>
  );
};

// ── Valuation Section ─────────────────────────────────────────────────────────
const ValuationSection = ({ report }: { report: WS2ReportType }) => {
  const val = report.ws22?.valuation;
  if (!val) return (
    <SectionCard title="Preliminary Valuation Range" tag="WS2-2 Pending" tagType="flag">
      <div style={{ padding: 24, color: T.muted, fontSize: 12 }}>WS2-2 EBITDA Recast not yet run. Complete WS2-1 review and enter valuation inputs.</div>
    </SectionCard>
  );

  return (
    <SectionCard title="Preliminary Valuation Range" tag="Internal Only" tagType="neutral">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
        {[
          { label: `Low · ${fmt.mult(val.multipleAssumptions.low)}`, amount: fmt.dollar(val.valuationLow), sub: "Conservative", mid: false },
          { label: `Mid · ${fmt.mult(val.multipleAssumptions.mid)}`, amount: fmt.dollar(val.valuationMid), sub: "Most Likely", mid: true },
          { label: `High · ${fmt.mult(val.multipleAssumptions.high)}`, amount: fmt.dollar(val.valuationHigh), sub: "Optimistic", mid: false },
        ].map((box, i) => (
          <div key={i} style={{
            padding: "20px 24px", textAlign: "center",
            borderRight: i < 2 ? `1px solid ${T.border}` : "none",
            background: box.mid ? T.navy : T.white,
          }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: box.mid ? "rgba(255,255,255,0.5)" : T.muted, marginBottom: 4 }}>{box.label}</div>
            <div style={{ fontFamily: "'DM Mono', 'Courier New', monospace", fontSize: 26, fontWeight: 600, color: box.mid ? T.gold : T.navy }}>{box.amount}</div>
            <div style={{ fontSize: 10, color: box.mid ? "rgba(255,255,255,0.4)" : T.muted, marginTop: 4 }}>{box.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: "10px 20px", background: T.greyBg, borderTop: `1px solid ${T.border}`, fontSize: 11, color: "#666" }}>
        Based on TTM Normalized EBITDA of {fmt.dollar(val.normalizedEbitda)}.
        {val.revenueTrendFlag ? ` ${val.revenueTrendFlag}` : " Revenue growing — full multiple range applicable."}
      </div>
    </SectionCard>
  );
};

// ── 3-Year P&L Section ────────────────────────────────────────────────────────
const PLSection = ({ report }: { report: WS2ReportType }) => {
  const pl = report.ws21.annualPL;
  const pc = pl.periodCoverage;

  const ebitdaColor = (v: number) => v < 0 ? T.red : v < 30000 ? T.yellow : T.green;

  const tableRows = [
    { cells: ["Revenue"], isSection: true },
    ...pl.revenueLines.map((l) => ({
      cells: [`  ${l.label}`, fmt.dollar(l.fy1), fmt.yoy(pl.yoyRevenueGrowth.fy1toFy2), fmt.dollar(l.fy2), fmt.yoy(pl.yoyRevenueGrowth.fy2toFy3), fmt.dollar(l.ttm)],
    })),
    { cells: ["Total Revenue", fmt.dollar(pl.totalRevenue.fy1), "", fmt.dollar(pl.totalRevenue.fy2), `+${fmt.yoy(pl.yoyRevenueGrowth.fy2toFy3)}`, fmt.dollar(pl.totalRevenue.ttm)], isTotal: true },
    { cells: ["Gross Profit", fmt.dollar(pl.grossProfit.fy1), "", fmt.dollar(pl.grossProfit.fy2), "", fmt.dollar(pl.grossProfit.ttm)], isEbitda: true },
    { cells: ["Gross Margin %", fmt.pct(pl.grossMargin.fy1), "", fmt.pct(pl.grossMargin.fy2), "", fmt.pct(pl.grossMargin.ttm)] },
    { cells: ["Operating Expenses"], isSection: true },
    { cells: ["Total OpEx", fmt.dollar(pl.totalOpex.fy1), "", fmt.dollar(pl.totalOpex.fy2), "", fmt.dollar(pl.totalOpex.ttm)], isTotal: true },
    {
      cells: [
        "4-Wall EBITDA (Pre-Recast)",
        <span style={{ color: ebitdaColor(pl.ebitdaPreRecast.fy1), fontWeight: 700 }}>{fmt.dollar(pl.ebitdaPreRecast.fy1)}</span>,
        "",
        <span style={{ color: ebitdaColor(pl.ebitdaPreRecast.fy2), fontWeight: 700 }}>{fmt.dollar(pl.ebitdaPreRecast.fy2)}</span>,
        <span style={{ color: T.green, fontWeight: 600 }}>↑</span>,
        <span style={{ color: ebitdaColor(pl.ebitdaPreRecast.ttm), fontWeight: 700 }}>{fmt.dollar(pl.ebitdaPreRecast.ttm)}</span>,
      ],
      isEbitda: true,
    },
    { cells: ["EBITDA Margin %", fmt.pct(pl.ebitdaMargin.fy1), "", fmt.pct(pl.ebitdaMargin.fy2), "", fmt.pct(pl.ebitdaMargin.ttm)] },
  ];

  return (
    <SectionCard title="3-Year Annual P&L Summary (Pre-Recast)" tag="WS2-1 Approved" tagType="approved">
      <DataTable
        headers={["Line Item", pc.fy1Label, "YoY", pc.fy2Label, "YoY", `${pc.fy3Label} / TTM`]}
        rows={tableRows}
        colWidths={["220px", "130px", "80px", "130px", "80px", "130px"]}
      />
    </SectionCard>
  );
};

// ── Recast Schedule ───────────────────────────────────────────────────────────
const RecastSection = ({ report }: { report: WS2ReportType }) => {
  const recast = report.ws22?.recastSchedule;
  if (!recast) return (
    <SectionCard title="EBITDA Recast Schedule" tag="WS2-2 Pending" tagType="flag">
      <div style={{ padding: 24, color: T.muted, fontSize: 12 }}>Awaiting Craig's HITL approval of WS2-1 and valuation inputs.</div>
    </SectionCard>
  );

  const catLabels: Record<number, string> = {
    1: "Category 1 — Owner / Officer Compensation",
    2: "Category 2 — Personal Expenses",
    3: "Category 3 — One-Off Non-Recurring",
    4: "Category 4 — Tenant Improvements",
    5: "Category 5 — Fair Market Rent",
  };
  const statusColor = (s: string) => s.includes("FLAGGED") ? T.red : s === "DEFAULT" ? T.yellow : T.green;
  const statusBg = (s: string) => s.includes("FLAGGED") ? T.redBg : s === "DEFAULT" ? T.yellowBg : T.greenBg;

  const grouped = new Map<number, AddBackItem[]>();
  for (let i = 1; i <= 5; i++) grouped.set(i, []);
  recast.addBackItems.forEach((item) => grouped.get(item.category)?.push(item));

  const pl = report.ws21.annualPL;

  return (
    <SectionCard title="EBITDA Recast Schedule — TTM" tag="WS2-2 Craig Approved" tagType="approved">
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Cat.", "Description", "GL Code", "TTM Amount", "Status"].map((h, i) => (
              <th key={i} style={{ padding: "8px 14px", fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.muted, background: T.greyBg, borderBottom: `1px solid ${T.border}`, textAlign: i < 2 ? "left" : "right" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Starting point */}
          <tr>
            <td colSpan={3} style={{ padding: "10px 14px", fontWeight: 700, fontSize: 13 }}>4-Wall EBITDA (Pre-Recast)</td>
            <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, padding: "10px 14px", color: pl.ebitdaPreRecast.ttm < 0 ? T.red : T.navy }}>{fmt.dollar(pl.ebitdaPreRecast.ttm)}</td>
            <td />
          </tr>

          {/* Per category */}
          {[1, 2, 3, 4, 5].map((cat) => {
            const items = grouped.get(cat) ?? [];
            if (items.length === 0) return null;
            const catTotal = items.reduce((s, i) => s + i.ttmAmount, 0);
            return (
              <React.Fragment key={cat}>
                <tr style={{ background: T.greyBg }}>
                  <td colSpan={5} style={{ padding: "6px 14px", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: T.muted }}>{catLabels[cat]}</td>
                </tr>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderBottom: `1px solid #F0EDE8` }}>
                    <td style={{ padding: "7px 14px", fontSize: 11, color: T.muted, fontWeight: 500 }}>{item.id}</td>
                    <td style={{ padding: "7px 14px", fontSize: 12 }}><span style={{ paddingLeft: 8 }}>{item.description}</span></td>
                    <td style={{ padding: "7px 14px", fontSize: 11, fontFamily: "monospace", color: T.muted, textAlign: "right" }}>{item.glCode ?? "—"}</td>
                    <td style={{ padding: "7px 14px", fontFamily: "monospace", fontSize: 12, textAlign: "right", color: item.ttmAmount >= 0 ? T.green : T.red, fontWeight: 600 }}>
                      {fmt.dollar(item.ttmAmount)}
                    </td>
                    <td style={{ padding: "7px 14px", textAlign: "right" }}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 2, background: statusBg(item.status), color: statusColor(item.status) }}>{item.status}</span>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} style={{ padding: "6px 14px", fontWeight: 600, fontSize: 11 }}>Net {catLabels[cat].split("—")[1].trim()} Add-Back</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, padding: "6px 14px", color: catTotal >= 0 ? T.green : T.red }}>{fmt.dollar(catTotal)}</td>
                  <td />
                </tr>
              </React.Fragment>
            );
          })}

          {/* Totals */}
          <tr style={{ background: T.greyBg, borderTop: `2px solid ${T.gold}` }}>
            <td colSpan={3} style={{ padding: "10px 14px", fontWeight: 700 }}>Total Add-Backs</td>
            <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, padding: "10px 14px", color: T.green, fontSize: 14 }}>{fmt.dollar(recast.totalAddBacks)}</td>
            <td />
          </tr>
          <tr style={{ background: T.navy }}>
            <td colSpan={3} style={{ padding: "12px 14px", color: T.white, fontWeight: 700, fontSize: 13 }}>Normalized EBITDA (TTM)</td>
            <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, padding: "12px 14px", color: T.gold, fontSize: 16 }}>{fmt.dollar(recast.normalizedEbitdaTTM)}</td>
            <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{fmt.pct(recast.normalizedMarginTTM)} margin</td>
          </tr>
        </tbody>
      </table>
    </SectionCard>
  );
};

// ── Revenue by Vertical ───────────────────────────────────────────────────────
const VerticalSection = ({ report }: { report: WS2ReportType }) => {
  const ws23 = report.ws23;
  if (!ws23) return null;

  const healthColor = (h: TrafficLight) => h === "GREEN" ? T.green : h === "YELLOW" ? T.yellow : T.red;
  const healthBg = (h: TrafficLight) => h === "GREEN" ? T.greenBg : h === "YELLOW" ? T.yellowBg : T.redBg;
  const bdConc = ws23.boardingPlusDaycareConcentration;
  const bdOk = bdConc.ttm >= 0.70;

  return (
    <SectionCard
      title="Revenue by Vertical · TTM"
      tag={`B+D: ${fmt.pct(bdConc.ttm)} ${bdOk ? "✓" : "⚠"}`}
      tagType={bdOk ? "approved" : "flag"}
    >
      {/* Mini bar chart grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderBottom: `1px solid ${T.border}` }}>
        {ws23.verticals.slice(0, 4).map((v) => (
          <div key={v.name} style={{ padding: "16px 18px", borderRight: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.muted, marginBottom: 6 }}>{v.name}</div>
            <div style={{ height: 4, background: "#E8E5DF", borderRadius: 2, marginBottom: 6 }}>
              <div style={{ height: 4, borderRadius: 2, width: `${v.ttmPct * 100}%`, background: T.navy }} />
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 600, color: T.navy }}>{fmt.pct(v.ttmPct)}</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{fmt.dollar(v.ttmDollar)}</div>
            <div style={{ fontSize: 10, marginTop: 4, fontWeight: 500, color: healthColor(v.health) }}>
              {v.yoyFy2toFy3 >= 0 ? "↑" : "↓"} {fmt.yoy(v.yoyFy2toFy3)} YoY
            </div>
          </div>
        ))}
      </div>
      {/* Full table */}
      <DataTable
        headers={["Vertical", "FY1 $", "FY1 %", "FY2 $", "FY2 %", "TTM $", "TTM %", "YoY FY2→3", "Health"]}
        rows={ws23.verticals.map((v) => ({
          cells: [
            v.name,
            fmt.dollar(v.fy1Dollar),
            fmt.pct(v.fy1Pct),
            fmt.dollar(v.fy2Dollar),
            fmt.pct(v.fy2Pct),
            fmt.dollar(v.ttmDollar),
            fmt.pct(v.ttmPct),
            <span style={{ color: v.yoyFy2toFy3 >= 0 ? T.green : T.red }}>{fmt.yoy(v.yoyFy2toFy3)}</span>,
            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 2, background: healthBg(v.health), color: healthColor(v.health) }}>{v.health}</span>,
          ],
        }))}
        colWidths={["120px", "110px", "70px", "110px", "70px", "110px", "70px", "80px", "70px"]}
      />
      {ws23.businessModelFlag && (
        <div style={{ padding: "10px 18px", background: T.yellowBg, borderTop: `1px solid ${T.border}`, fontSize: 11, color: T.yellow, fontWeight: 500 }}>
          ⚠ {ws23.businessModelFlag}
        </div>
      )}
    </SectionCard>
  );
};

// ── Expense Benchmarks ────────────────────────────────────────────────────────
const BenchmarkSection = ({ report }: { report: WS2ReportType }) => {
  const ws24 = report.ws24;
  if (!ws24) return null;
  const flagColor = (f: TrafficLight) => f === "GREEN" ? T.green : f === "YELLOW" ? T.yellow : T.red;
  const flagBg = (f: TrafficLight) => f === "GREEN" ? T.greenBg : f === "YELLOW" ? T.yellowBg : T.redBg;

  return (
    <SectionCard title="Expense Benchmarks · TTM" tag={`${ws24.benchmarks.filter((b) => b.flag !== "GREEN").length} Flags`} tagType={ws24.overallHealth === "GREEN" ? "approved" : "flag"}>
      {ws24.benchmarks.map((b) => (
        <div key={b.category} style={{ display: "grid", gridTemplateColumns: "160px 1fr 60px 60px", gap: 12, alignItems: "center", padding: "9px 20px", borderBottom: `1px solid #F0EDE8` }}>
          <div style={{ fontSize: 12, fontWeight: 500 }}>{b.category}</div>
          <div style={{ position: "relative", height: 6, background: "#EEE", borderRadius: 3 }}>
            <div style={{ position: "absolute", left: `${b.benchmarkLow * 100}%`, width: `${(b.benchmarkHigh - b.benchmarkLow) * 100}%`, height: "100%", background: "rgba(201,168,76,0.3)", borderRadius: 3 }} />
            <div style={{ position: "absolute", left: 0, width: `${b.ttmPct * 100}%`, height: "100%", background: flagColor(b.flag), borderRadius: 3 }} />
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 11, textAlign: "right" }}>{fmt.pct(b.ttmPct)}</div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 6px", borderRadius: 2, background: flagBg(b.flag), color: flagColor(b.flag), textAlign: "center" }}>{b.flag}</div>
        </div>
      ))}
    </SectionCard>
  );
};

// ── Labor Section ─────────────────────────────────────────────────────────────
const LaborSection = ({ report }: { report: WS2ReportType }) => {
  const ws25 = report.ws25;
  if (!ws25) return null;
  const benchColor = ws25.benchmarkStatus === "GREEN" ? T.green : ws25.benchmarkStatus === "YELLOW" ? T.yellow : T.red;

  return (
    <SectionCard title="Labor Analysis · TTM" tag={ws25.benchmarkStatus} tagType={ws25.benchmarkStatus === "GREEN" ? "approved" : "flag"}>
      <DataTable
        headers={["Category", "TTM Amount", "TTM % Rev", "FY3 %", "FY2 %", "FY1 %"]}
        rows={ws25.laborRows.map((l) => ({
          cells: [l.category, fmt.dollar(l.ttmAmount), fmt.pct(l.ttmPct), fmt.pct(l.fy3Pct), fmt.pct(l.fy2Pct), fmt.pct(l.fy1Pct)],
          isTotal: l.category.toLowerCase().includes("total"),
        }))}
      />
      <div style={{ padding: "10px 20px", background: T.greyBg, borderTop: `1px solid ${T.border}`, fontSize: 11, color: benchColor, fontWeight: 500 }}>
        Direct Labor (ex-owner): {fmt.pct(ws25.directLaborPct)} — {ws25.benchmarkNote}
      </div>
    </SectionCard>
  );
};

// ── Data Quality Section ──────────────────────────────────────────────────────
const DataQualitySection = ({ report }: { report: WS2ReportType }) => {
  const dq = report.ws21.dataQuality;
  const resolved = dq.resolvedFlags;
  const total = dq.totalFlags;
  const allClear = resolved === total;

  return (
    <SectionCard
      title={`Data Quality Report — ${total} Items · ${allClear ? "All Resolved" : `${total - resolved} Outstanding`}`}
      tag={allClear ? "✓ Craig Cleared" : `${total - resolved} Unresolved`}
      tagType={allClear ? "approved" : "alert"}
    >
      <div style={{ padding: "16px 20px", display: "grid", gap: 10 }}>
        {dq.flags.map((flag, i) => <FlagCard key={i} flag={flag} />)}
        {dq.flags.length === 0 && (
          <div style={{ fontSize: 12, color: T.green, fontWeight: 500 }}>✓ No data quality flags raised.</div>
        )}
      </div>
    </SectionCard>
  );
};

// ── Main Export Button ────────────────────────────────────────────────────────
const ExportButton = ({ report }: { report: WS2ReportType }) => {
  const [loading, setLoading] = useState(false);
  const handleExport = async () => {
    setLoading(true);
    try {
      exportWS2Workbook(report);
    } finally {
      setTimeout(() => setLoading(false), 1000);
    }
  };
  return (
    <button
      onClick={handleExport}
      disabled={loading}
      style={{
        display: "flex", alignItems: "center", gap: 8, padding: "9px 18px",
        background: loading ? "#555" : T.gold, color: T.navy, fontWeight: 700,
        fontSize: 12, border: "none", borderRadius: 2, cursor: loading ? "wait" : "pointer",
        letterSpacing: "0.04em", transition: "background 0.2s",
      }}
    >
      <Download size={14} />
      {loading ? "Generating..." : "Export Excel Workbook"}
    </button>
  );
};

// ── ROOT COMPONENT ────────────────────────────────────────────────────────────
export function WS2Report({ report }: { report: WS2ReportType }) {
  const ws21 = report.ws21;

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: T.cream, minHeight: "100vh", color: "#1A1A1A" }}>

      {/* HEADER */}
      <div style={{ background: T.navy, color: T.white, padding: "28px 36px 24px", display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "start" }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: T.gold, marginBottom: 6 }}>
            Cantara Pet Advisors · WS2 Financial Analysis
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: T.white, marginBottom: 4 }}>{report.clientName}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Business Sale Readiness — Financial Performance & Valuation Report</div>
          <div style={{ marginTop: 10 }}>
            <span style={{ background: T.green, color: T.white, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 2 }}>
              ✓ Craig Approved · {ws21.approvedAt ?? "—"}
            </span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 2 }}>
            <div><strong style={{ color: "rgba(255,255,255,0.8)" }}>Period</strong> {ws21.annualPL.periodCoverage.fy1Label} — {ws21.annualPL.periodCoverage.fy3Label}</div>
            <div><strong style={{ color: "rgba(255,255,255,0.8)" }}>TTM</strong> {ws21.annualPL.periodCoverage.ttmLabel}</div>
            <div><strong style={{ color: "rgba(255,255,255,0.8)" }}>Run</strong> #{ws21.runId} · {report.reportGeneratedAt}</div>
          </div>
          <div style={{ marginTop: 12 }}>
            <ExportButton report={report} />
          </div>
        </div>
      </div>

      {/* GOLD ACCENT LINE */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${T.gold}, transparent)` }} />

      {/* KPI STRIP */}
      <KPIStrip report={report} />

      {/* REPORT BODY */}
      <div style={{ padding: "28px 36px", display: "grid", gap: 20 }}>

        {/* Row 1: Valuation */}
        <ValuationSection report={report} />

        {/* Row 2: 3-Year P&L */}
        <PLSection report={report} />

        {/* Row 3: Recast Schedule */}
        <RecastSection report={report} />

        {/* Row 4: Verticals + Benchmarks (2-col) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <VerticalSection report={report} />
          <BenchmarkSection report={report} />
        </div>

        {/* Row 5: Labor */}
        <LaborSection report={report} />

        {/* Row 6: Data Quality */}
        <DataQualitySection report={report} />

      </div>

      {/* FOOTER */}
      <div style={{ background: T.navy, padding: "16px 36px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Cantara Pet Advisors · Portal by Babalilm AI FZ-LLC</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 3, maxWidth: 500 }}>
            PRELIMINARY — FOR INTERNAL CANTARA USE ONLY. This report has not been reviewed by legal or tax counsel and must not be shared with the seller until Craig approves client release.
          </div>
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textAlign: "right" }}>
          Generated {report.reportGeneratedAt}<br />
        </div>
      </div>
    </div>
  );
}

export default WS2Report;
