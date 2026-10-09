'use client';

import { useEffect, useState } from 'react';
import {
  Globe,
  MapPin,
  Facebook,
  Instagram,
  Music2,
  CalendarCheck,
  Star,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  ExternalLink,
  Download,
  BarChart3,
  Package,
  Pencil,
  Check,
  X,
  RefreshCw,
  Save,
  Gauge,
  Search,
  DollarSign,
  Users,
  Activity,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { DigitalPresenceReport, ChannelAssessment, ChannelType, TrafficLight, KeyMetric } from '@/lib/digital-presence/types';
import { Badge, Card, cn } from '@/components/ui';
import { ExportReportButton } from '@/components/report-export/ExportReportButton';
import { buildDigitalPresenceReportHtml } from '@/lib/report-export/build-digital-presence-report';
import { MARKETING_INTAKE_FIELDS } from '@/lib/marketing-intake';

interface Props {
  report: DigitalPresenceReport;
  onReset?: () => void;
  onRerun?: () => void;
  /** Re-score / rewrite narrative from current edited metrics (no web re-research). */
  onReanalyzeFromEdits?: (report: DigitalPresenceReport) => Promise<void>;
  onEdit?: (channelType: string, metricIndex: number, value: string) => void;
  /** Persist the full edited report to DB (sectionSubmissions + agent run history). */
  onSaveEdits?: (report: DigitalPresenceReport) => Promise<void>;
  readOnly?: boolean;
  embedded?: boolean;
}

const CHANNEL_ICONS: Record<ChannelType, React.ReactNode> = {
  website: <Globe className="w-4 h-4" />,
  google_business: <MapPin className="w-4 h-4" />,
  facebook: <Facebook className="w-4 h-4" />,
  instagram: <Instagram className="w-4 h-4" />,
  tiktok: <Music2 className="w-4 h-4" />,
  youtube: <Star className="w-4 h-4" />,
  booking_platform: <CalendarCheck className="w-4 h-4" />,
  online_reputation: <Star className="w-4 h-4" />,
};

const CHANNEL_COLORS: Record<ChannelType, string> = {
  website: 'text-blue-600 bg-blue-50',
  google_business: 'text-rose-500 bg-rose-50',
  facebook: 'text-blue-700 bg-blue-50',
  instagram: 'text-pink-500 bg-pink-50',
  tiktok: 'text-slate-800 bg-slate-100',
  youtube: 'text-rose-600 bg-rose-50',
  booking_platform: 'text-emerald-600 bg-emerald-50',
  online_reputation: 'text-amber-500 bg-amber-50',
};

function TrafficLightBadge({ light }: { light: TrafficLight }) {
  const cfg = {
    green: { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', label: 'Good' },
    amber: { dot: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', label: 'Fair' },
    red: { dot: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50 border-rose-200', label: 'Poor' },
  }[light];

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold', cfg.bg, cfg.text)}>
      <span className={cn('w-2 h-2 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  );
}

function EditableTrafficLight({
  light,
  editing,
  onChange,
}: {
  light: TrafficLight;
  editing: boolean;
  onChange: (next: TrafficLight) => void;
}) {
  if (!editing) return <TrafficLightBadge light={light} />;

  return (
    <select
      value={light}
      onChange={(e) => onChange(e.target.value as TrafficLight)}
      className="text-xs font-semibold rounded-full border border-amber-300 bg-white px-2.5 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
      aria-label="Channel rating"
    >
      <option value="green">Good</option>
      <option value="amber">Fair</option>
      <option value="red">Poor</option>
    </select>
  );
}

/** V12: hide engagement (FB/IG/TikTok) and Facebook page likes from the scorecard UI. */
function isHiddenDigitalPresenceMetric(channelType: ChannelType, label: string): boolean {
  const l = label.toLowerCase().trim();
  if (
    (channelType === 'facebook' || channelType === 'instagram' || channelType === 'tiktok') &&
    /\bengagement\b/.test(l)
  ) {
    return true;
  }
  // Hide Facebook page likes (label may be "Likes" or "Page likes") — keep Recommend %.
  if (channelType === 'facebook' && /\blikes?\b/.test(l) && !/\brecommend/.test(l)) {
    return true;
  }
  return false;
}

/** Display-only label aliases so advisors can rename without re-running analysis. */
function displayMetricLabel(channelType: ChannelType, label: string): string {
  const l = label.toLowerCase().trim();
  if (channelType === 'facebook' && (l === 'recommend %' || l === 'recommend%' || l === 'recommend')) {
    return 'People Recommend %';
  }
  return label;
}

function parseMarketingInputRows(value?: string): Array<Record<string, string>> {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(row => row && typeof row === 'object' && !Array.isArray(row)) as Array<Record<string, string>>;
  } catch {
    return [];
  }
}

const MARKETING_COLUMNS: Record<string, string> = Object.fromEntries(
  Object.values(MARKETING_INTAKE_FIELDS).flat().map(column => [column.key, column.label]),
);

const money = (value?: string) => {
  const amount = Number(value);
  return value && Number.isFinite(amount) ? `$${amount.toLocaleString()}` : value?.trim() || 'Not provided';
};

function MarketingInputsPanel({ intake }: { intake: Record<string, string> }) {
  const spendRows = parseMarketingInputRows(intake.marketingChannelsAndSpend);
  const resultRows = parseMarketingInputRows(intake.marketingChannelResults);
  const vendorRows = parseMarketingInputRows(intake.marketingPeopleAndVendors);
  const referralRows = parseMarketingInputRows(intake.marketingReferralPartners);
  const ownershipRows = parseMarketingInputRows(intake.marketingAccountOwnership);
  const emailRows = parseMarketingInputRows(intake.marketingEmailProgram);
  const includesAssumptions = Object.values(intake).some(value => /\b(?:assum(?:e|ed|ption)|sample|test entry)\b/i.test(value));
  const monthlySpend = spendRows.reduce((sum, row) => {
    const amount = Number(row.amount);
    if (!Number.isFinite(amount)) return sum;
    return sum + amount / (/annual/i.test(row.frequency ?? '') ? 12 : 1);
  }, 0);
  const hasSpend = spendRows.some(row => Number.isFinite(Number(row.amount)));
  const allEstimates = spendRows.filter(row => row.amount?.trim()).every(row => /estimate/i.test(row.spendType ?? ''));
  const knownTracking = resultRows.map(row => row.tracking).filter(Boolean);
  const trackedLabel = knownTracking.some(value => /not tracked/i.test(value ?? ''))
    ? 'Attribution gaps reported'
    : knownTracking.every(value => /system reported/i.test(value ?? '')) && knownTracking.length
      ? 'System-reported data'
      : 'Reported figures; verification varies';
  const text = (key: string) => intake[key]?.trim() || '';
  const itemCard = 'min-w-0 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs';
  const fact = (label: string, value: string, emphasis = false) => (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={cn('mt-0.5 break-words text-xs', emphasis ? 'font-bold text-slate-800' : 'text-slate-600')}>{value || 'Not provided'}</p>
    </div>
  );
  const simpleRows = (rows: Array<Record<string, string>>, keys: string[], titleKey: string) => rows.length ? rows.map((row, index) => (
    <article key={`${titleKey}-${index}`} className={itemCard}>
      <h5 className="break-words text-xs font-semibold text-slate-800">{row[titleKey] || 'Unspecified'}</h5>
      <div className="mt-2.5 grid gap-x-4 gap-y-2 sm:grid-cols-2">{keys.filter(key => key !== titleKey && row[key]?.trim()).map(key => fact(MARKETING_COLUMNS[key] ?? key, key.toLowerCase().includes('amount') || key.toLowerCase().includes('revenue') || key.toLowerCase().includes('cost') ? money(row[key]) : row[key]))}</div>
    </article>
  )) : null;

  if (!Object.values(intake).some(value => typeof value === 'string' && value.trim())) return null;

  return (
    <div className="space-y-4">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Approx. Monthly Spend</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{hasSpend ? money(String(Math.round(monthlySpend))) : 'Not provided'}</p>
          <p className="mt-1 text-[11px] text-slate-500">{allEstimates ? 'Owner estimate' : 'Reported amounts; confirm basis'}</p>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Annualized Spend</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{hasSpend ? money(String(Math.round(monthlySpend * 12))) : 'Not provided'}</p>
          <p className="mt-1 text-[11px] text-slate-500">Run rate from entered channel amounts</p>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Revenue Attribution</p>
          <p className="mt-1 text-base font-bold text-slate-800 leading-snug">{trackedLabel}</p>
          <p className="mt-1 text-[11px] text-slate-500">{text('marketingReportingPeriod') || 'Reporting period not provided'}</p>
        </div>
      </div>

      {/* Spend Breakdown */}
      {spendRows.length > 0 && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <DollarSign className="w-3.5 h-3.5" />
            </span>
            <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">Channel Spend Breakdown</h4>
          </div>
          <div className="space-y-2">
            {spendRows.map((row, index) => {
              const amount = Number(row.amount);
              const rowMonthly = Number.isFinite(amount) ? amount / (/annual/i.test(row.frequency ?? '') ? 12 : 1) : 0;
              const share = monthlySpend > 0 ? Math.max(0, Math.min(100, (rowMonthly / monthlySpend) * 100)) : 0;
              return (
                <div key={index} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-semibold text-slate-700 truncate">{row.channel || 'Other channel'}</p>
                      <span className="text-xs font-bold text-slate-800">{money(row.amount)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70">
                      <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${share}%` }} />
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-[10px] font-medium text-slate-600">
                    {row.frequency || 'Monthly'} · {row.spendType || 'Basis not stated'}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Reported Outcomes */}
      {resultRows.length > 0 && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
            <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">Reported Channel Results</h4>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {resultRows.map((row, index) => (
              <article key={index} className={itemCard}>
                <div className="flex items-start justify-between gap-2">
                  <h5 className="min-w-0 break-words text-xs font-semibold text-slate-800">{row.source || 'Other source'}</h5>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-medium text-slate-500">{row.tracking || 'Tracking not stated'}</span>
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  {fact('Clicks or calls', row.clicks || 'Not tracked')}
                  {fact('Inquiries', row.inquiries || 'Not tracked')}
                  {fact('Bookings', row.bookings || 'Not tracked', true)}
                  {fact('Revenue', money(row.revenue), true)}
                </div>
              </article>
            ))}
          </div>
        </Card>
      )}

      {/* How Marketing Operates */}
      {(emailRows.length > 0 || text('marketingBookingFunnel') || text('marketingPlanAndBudget')) && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Activity className="w-3.5 h-3.5" />
            </span>
            <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">How Marketing Operates</h4>
          </div>
          <div className="space-y-2.5">
            {emailRows.length ? (
              <article className={itemCard}>
                <h5 className="text-xs font-semibold text-slate-800">Email &amp; Text Outreach</h5>
                <div className="mt-2.5 grid gap-2 sm:grid-cols-3 pt-2 border-t border-slate-100">
                  {fact('Active subscribers', emailRows.map(row => row.activeSubscribers).filter(Boolean).join(', ') || 'Not provided', true)}
                  {fact('Sending cadence', emailRows.map(row => row.frequency).filter(Boolean).join(', ') || 'Not provided')}
                  {fact('Reported measurement', emailRows.map(row => row.results).filter(Boolean).join('; ') || 'Not provided')}
                </div>
              </article>
            ) : null}
            {(text('marketingBookingFunnel') || text('marketingPlanAndBudget')) && (
              <div className="grid gap-2 sm:grid-cols-2">
                {text('marketingBookingFunnel') && (
                  <article className={itemCard}>
                    <h5 className="text-xs font-semibold text-slate-800">Booking &amp; Conversion Path</h5>
                    <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-600">{text('marketingBookingFunnel')}</p>
                  </article>
                )}
                {text('marketingPlanAndBudget') && (
                  <article className={itemCard}>
                    <h5 className="text-xs font-semibold text-slate-800">Budget, Plan, &amp; Goals</h5>
                    <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-600">{text('marketingPlanAndBudget')}</p>
                  </article>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* People & Transferability */}
      {(vendorRows.length > 0 || ownershipRows.length > 0) && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <Users className="w-3.5 h-3.5" />
            </span>
            <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">People &amp; Account Transferability</h4>
          </div>
          <div className="space-y-2">
            {simpleRows(vendorRows, ['name', 'role', 'monthlyCost', 'transferable'], 'name')}
            {ownershipRows.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {ownershipRows.map((row, index) => (
                  <article key={index} className={itemCard}>
                    <h5 className="text-xs font-semibold text-slate-800">{row.asset || 'Marketing account'}</h5>
                    <div className="mt-2.5 grid gap-2 sm:grid-cols-3 pt-2 border-t border-slate-100">
                      {fact('Ownership', row.owner || 'Not verified')}
                      {fact('Administrator access', row.adminAccess || 'Not verified')}
                      {fact('Transfer after sale', row.transferable || 'Not confirmed')}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Referral & Reputation */}
      {(referralRows.length > 0 || text('marketingReviewManagement')) && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Star className="w-3.5 h-3.5" />
            </span>
            <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">Referral Relationships &amp; Reputation</h4>
          </div>
          <div className="space-y-2">
            {simpleRows(referralRows, ['partner', 'type', 'annualCustomers', 'annualRevenue'], 'partner')}
            {text('marketingReviewManagement') && (
              <article className={itemCard}>
                <h5 className="text-xs font-semibold text-slate-800">Review Response Practice</h5>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-600">{text('marketingReviewManagement')}</p>
              </article>
            )}
          </div>
        </Card>
      )}

      {includesAssumptions && (
        <p className="border-l-2 border-amber-300 pl-3 text-[11px] leading-relaxed text-amber-800">
          Some saved figures or descriptions are explicitly marked as assumed or sample information. Verify them with the business before relying on them.
        </p>
      )}
    </div>
  );
}

function getScoreColorConfig(score: number) {
  if (score >= 90) {
    return {
      cardBg: 'bg-emerald-50/70 border-emerald-200/80',
      scoreText: 'text-emerald-600',
      badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      label: 'Good (90-100)',
    };
  }
  if (score >= 50) {
    return {
      cardBg: 'bg-amber-50/70 border-amber-200/80',
      scoreText: 'text-amber-600',
      badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
      label: 'Needs Work (50-89)',
    };
  }
  return {
    cardBg: 'bg-rose-50/70 border-rose-200/80',
    scoreText: 'text-rose-600',
    badgeBg: 'bg-rose-100 text-rose-800 border-rose-200',
    label: 'Poor (<50)',
  };
}

function MarketingEvidencePanel({ evidence }: { evidence: NonNullable<DigitalPresenceReport['marketingEvidence']> }) {
  if (!evidence.length) return null;

  const cleanEvidenceContent = (content: string) => content
    .split('\n')
    .filter(line => !/^Reported DataForSEO request cost:/i.test(line))
    .join('\n');

  const advisorFriendlyText = (value: string) => value
    .replace(/Chrome UX Report\s*\(CrUX\)|\bCrUX\b/gi, 'real visitor website data')
    .replace(/Google PageSpeed Insights/gi, 'website speed test')
    .replace(/DataForSEO/gi, 'local search results');

  // Categorize evidence items to place Speed & Quality KPI cards at the top
  const speedItem = evidence.find(
    item => item.source === 'Google PageSpeed Insights' || item.source === 'Website speed and quality'
  );
  const cruxItem = evidence.find(
    item => item.source === 'Chrome UX Report (CrUX)' || item.source === 'Real visitor website experience'
  );
  const searchItem = evidence.find(
    item => item.source === 'Google organic search visibility' || item.source === 'Website visibility in Google search'
  );
  const mapsItem = evidence.find(
    item => item.source === 'DataForSEO Google Maps local results' || item.source === 'Nearby businesses in local search'
  );
  const otherItems = evidence.filter(
    item => item !== speedItem && item !== cruxItem && item !== searchItem && item !== mapsItem
  );

  return (
    <div className="space-y-4">
      {/* 1. TOP: Website Speed and Quality (KPI Cards on top!) */}
      {speedItem && (() => {
        const content = cleanEvidenceContent(speedItem.content);
        const scoreLine = content.split('\n').find(line => line.startsWith('Mobile Lighthouse scores:')) ?? '';
        const scores = Array.from(scoreLine.matchAll(/([^:;]+):\s*(\d+)\/100/g)).map(match => ({
          label: match[1].replace('Mobile Lighthouse scores:', '').trim(),
          score: parseInt(match[2], 10),
        }));
        const testedUrl = content.match(/Tested URL:\s*(.+)/)?.[1];
        const testTime = content.match(/Test time:\s*(.+)/)?.[1];
        const opportunityLines = content
          .split('\n')
          .slice(content.split('\n').findIndex(line => line.startsWith('Largest opportunities:')) + 1)
          .filter(line => line.startsWith('- '))
          .map(line => line.slice(2));

        // CrUX metrics if available
        let cruxMetrics: Array<{ key: string; label: string; value: string; unit: string }> = [];
        let cruxPeriod = '';
        if (cruxItem && cruxItem.status === 'connected') {
          const cruxContent = cleanEvidenceContent(cruxItem.content);
          const metricLabels: Record<string, string> = {
            LCP: 'Loading speed',
            CLS: 'Layout stability',
            INP: 'Responsiveness',
            FCP: 'First content shown',
            TTFB: 'Server response',
          };
          cruxMetrics = Array.from(cruxContent.matchAll(/([A-Z]+) p75:\s*([\d.]+)(?:\s*(ms))?/g)).map(match => ({
            key: match[1],
            label: metricLabels[match[1]] ?? match[1],
            value: match[2],
            unit: match[3] ?? '',
          }));
          cruxPeriod = cruxContent.match(/Collection period:\s*(.+)/)?.[1] ?? '';
        }

        return (
          <Card className="p-4 space-y-4 border-slate-200/90 shadow-2xs">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <Gauge className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">Website Speed &amp; Quality</h4>
                  <p className="text-xs text-slate-400">Mobile Lighthouse performance and site health audit</p>
                </div>
              </div>
              <span className={cn(
                'shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold border',
                speedItem.status === 'connected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
              )}>
                {speedItem.status === 'connected' ? 'Data retrieved' : 'Could not retrieve'}
              </span>
            </div>

            {/* Top KPI Cards Grid */}
            {scores.length > 0 ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {scores.map(metric => {
                  const cfg = getScoreColorConfig(metric.score);
                  return (
                    <div
                      key={metric.label}
                      className={cn('rounded-xl border p-4 text-center transition-all shadow-2xs', cfg.cardBg)}
                    >
                      <p className="text-3xl font-extrabold tracking-tight">
                        <span className={cfg.scoreText}>{metric.score}</span>
                        <span className="text-xs font-semibold text-slate-400 ml-0.5">/100</span>
                      </p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-700">
                        {metric.label}
                      </p>
                      <span className={cn('mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold border', cfg.badgeBg)}>
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-600">{advisorFriendlyText(content)}</p>
            )}

            {/* CrUX Real Visitor Data */}
            {cruxMetrics.length > 0 && (
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Real Visitor Website Experience (CrUX Field Data)
                  </span>
                  {cruxPeriod && <span className="text-[11px] text-slate-400">· {cruxPeriod}</span>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {cruxMetrics.map(m => (
                    <div key={m.key} className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{m.label}</p>
                      <p className="text-base font-bold text-slate-800 mt-0.5">
                        {m.value}
                        <span className="text-xs font-normal text-slate-400 ml-1">{m.unit || 'score'}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Opportunities */}
            {opportunityLines.length > 0 && (
              <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <p className="text-xs font-semibold text-slate-700">Largest Speed Opportunities</p>
                </div>
                <ul className="space-y-1 text-xs text-slate-600">
                  {opportunityLines.map((line, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-amber-500 font-bold shrink-0">•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Footer */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
              {testedUrl && (
                <a
                  href={testedUrl.startsWith('http') ? testedUrl : `https://${testedUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1 truncate max-w-md"
                >
                  <Globe className="w-3 h-3" />
                  {testedUrl}
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
              {testTime && <span>Mobile lab test · {testTime} · point-in-time estimate</span>}
            </div>
          </Card>
        );
      })()}

      {/* 2. Website Visibility in Google Search */}
      {searchItem && (() => {
        const content = cleanEvidenceContent(searchItem.content);
        const keyword = content.match(/Search phrase:\s*(.+)/)?.[1];
        const location = content.match(/Search location:\s*(.+)/)?.[1];
        const results = content.split('\n').flatMap(line => {
          const match = /^- (Organic result|Paid placement) (\d+):\s*([^;]+)(?: \[CLIENT WEBSITE\])?;\s*([^;]*);\s*(.*)$/.exec(line);
          return match ? [{ kind: match[1], rank: match[2], domain: match[3], isClient: line.includes('[CLIENT WEBSITE]'), title: match[4], url: match[5] }] : [];
        });

        return (
          <Card className="p-4 space-y-3 border-slate-200/90 shadow-2xs">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  <Search className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">Website Visibility in Google Search</h4>
                  <p className="text-xs text-slate-400">
                    Search query: <span className="font-semibold text-slate-600">{keyword || '—'}</span>{location ? ` · ${location}` : ''}
                  </p>
                </div>
              </div>
              <span className={cn(
                'shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold border',
                searchItem.status === 'connected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
              )}>
                {searchItem.status === 'connected' ? 'Data retrieved' : 'Could not retrieve'}
              </span>
            </div>

            {results.length > 0 ? (
              <div className="space-y-2">
                {results.map((result, index) => (
                  <div
                    key={`${result.kind}-${result.rank}-${index}`}
                    className={cn(
                      'flex min-w-0 items-center justify-between gap-3 rounded-xl border p-3 transition-colors',
                      result.isClient
                        ? 'border-emerald-300 bg-emerald-50/60 ring-1 ring-emerald-200/70 shadow-2xs'
                        : result.kind === 'Paid placement'
                        ? 'border-amber-200 bg-amber-50/40'
                        : 'border-slate-100 bg-white hover:bg-slate-50/60'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className={cn(
                        'shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold',
                        result.isClient ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                      )}>
                        #{result.rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-800 truncate">{result.title || result.domain}</p>
                        <p className="text-[11px] text-slate-400 truncate">{result.domain}{result.url ? ` · ${result.url}` : ''}</p>
                      </div>
                    </div>
                    <span className={cn(
                      'shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold border',
                      result.isClient
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : result.kind === 'Paid placement'
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    )}>
                      {result.isClient ? 'Client website' : result.kind}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-600">No matching organic or paid listings were returned.</p>
            )}

            <p className="text-[10px] text-slate-400">Search results show visibility for this phrase at this time; paid placements do not establish client ad spend.</p>
          </Card>
        );
      })()}

      {/* 3. Nearby Businesses in Local Search (NO GAPS: 2-column balanced grid) */}
      {mapsItem && (() => {
        const content = cleanEvidenceContent(mapsItem.content);
        const lines = content.split('\n').filter(line => line.startsWith('- Rank '));
        const heading = content.split('\n').find(line => line.startsWith('Google Maps results for')) ?? '';
        const rows = lines.map(line => {
          const match = /^- Rank (\d+):\s*(.*)$/.exec(line);
          if (!match) return null;
          const parts = match[2].split(';').map(part => part.trim());
          const name = parts.shift() ?? 'Unlabeled result';
          const address = parts.find(part => /\d.*\b(?:OK|BC|WA|CA|TX|NY|AZ|CO|FL|ON|AB)\b/i.test(part)) ?? '';
          const rating = parts.find(part => /^rating\s/i.test(part))?.replace(/^rating\s*/i, '') ?? '';
          const reviews = parts.find(part => /^review count\s/i.test(part))?.replace(/^review count\s*/i, '') ?? '';
          const website = parts.find(part => !/^rating\s|^review count\s|^\[POSSIBLE CLIENT LISTING\]$/i.test(part) && part !== address) ?? '';
          return { rank: match[1], name: name.replace(' [POSSIBLE CLIENT LISTING]', ''), isSubject: name.includes('[POSSIBLE CLIENT LISTING]'), address, rating, reviews, website };
        }).filter((row): row is NonNullable<typeof row> => Boolean(row));

        return (
          <Card className="p-4 space-y-3 border-slate-200/90 shadow-2xs">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-lg bg-rose-50 text-rose-500">
                  <MapPin className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">Nearby Businesses in Local Search</h4>
                  {heading && <p className="text-xs text-slate-400">{heading}</p>}
                </div>
              </div>
              <span className={cn(
                'shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold border',
                mapsItem.status === 'connected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
              )}>
                {mapsItem.status === 'connected' ? 'Data retrieved' : 'Could not retrieve'}
              </span>
            </div>

            {rows.length > 0 ? (
              <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                {rows.map(row => (
                  <article
                    key={row.rank}
                    className={cn(
                      'min-w-0 rounded-xl border p-3.5 transition-all flex flex-col justify-between shadow-2xs',
                      row.isSubject
                        ? 'border-emerald-300 bg-emerald-50/50 ring-1 ring-emerald-200/70'
                        : 'border-slate-200/80 bg-white hover:border-slate-300'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-bold text-slate-800 break-words">{row.name}</p>
                          {row.isSubject && (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-semibold text-emerald-800 border border-emerald-200">
                              Your business
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500 flex items-center gap-1 break-words">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="line-clamp-1">{row.address || 'Address unavailable'}</span>
                        </p>
                      </div>
                      <span className={cn(
                        'shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold',
                        row.isSubject ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                      )}>
                        #{row.rank}
                      </span>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap text-xs">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200/60">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          {row.rating || '—'}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {row.reviews ? `${row.reviews} reviews` : 'No reviews'}
                        </span>
                      </div>
                      {row.website && (
                        <a
                          href={row.website.startsWith('http') ? row.website : `https://${row.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 max-w-[160px] truncate"
                        >
                          {row.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-600">No local search results returned.</p>
            )}

            <p className="text-[10px] text-slate-400">Local search results near the business address. Rankings can vary by location and time.</p>
          </Card>
        );
      })()}

      {/* 4. Other Evidence (if any) */}
      {otherItems.map((item, index) => (
        <Card key={`${item.source}-${index}`} className="p-4 space-y-3 border-slate-200/90 shadow-2xs">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-800">{item.source}</h4>
            <span className={cn(
              'shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold border',
              item.status === 'connected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
            )}>
              {item.status === 'connected' ? 'Data retrieved' : 'Could not retrieve'}
            </span>
          </div>
          {item.url && (
            <a href={item.url} target="_blank" rel="noreferrer" className="block truncate text-xs text-blue-700 hover:underline">
              {item.url}
            </a>
          )}
          <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-600">
            {advisorFriendlyText(cleanEvidenceContent(item.content))}
          </p>
        </Card>
      ))}
    </div>
  );
}

function scoreForTrafficLight(light: TrafficLight, previous: ChannelAssessment['score']): ChannelAssessment['score'] {
  if (light === 'green') return previous >= 4 ? previous : 4;
  if (light === 'amber') return 3;
  return previous <= 2 ? previous : 2;
}

function FlagIcon({ severity }: { severity: 'critical' | 'warning' | 'positive' }) {
  if (severity === 'positive') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />;
  if (severity === 'critical') return <XCircle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0 mt-0.5" />;
  return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />;
}

function EditableMetric({ metric, editing, onSave }: { metric: KeyMetric; editing: boolean; onSave: (value: string) => void }) {
  const [val, setVal] = useState(metric.value);

  if (!editing) {
    return (
      <div className="bg-slate-50 rounded-lg px-2.5 py-1.5">
        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{metric.label}</p>
        <p className="text-xs font-semibold text-slate-700 mt-0.5">{metric.value}</p>
      </div>
    );
  }

  return (
    <div className="bg-amber-50/50 rounded-lg px-2.5 py-1.5 border border-amber-200">
      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{metric.label}</p>
      <input
        type="text"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => onSave(val)}
        onKeyDown={e => { if (e.key === 'Enter') { onSave(val); (e.target as HTMLInputElement).blur(); } }}
        className="w-full text-xs font-semibold text-slate-700 mt-0.5 bg-white border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
      />
    </div>
  );
}

function EditableSummaryText({ value, editing, onSave }: { value: string; editing: boolean; onSave: (value: string) => void }) {
  const [val, setVal] = useState(value);

  if (!editing) {
    return <p className="text-xs text-slate-600 leading-relaxed">{value}</p>;
  }

  return (
    <textarea
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => onSave(val)}
      onKeyDown={e => {
        // Save with Ctrl/Cmd+Enter so Enter can still be used for newlines.
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          onSave(val);
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
      className="w-full text-xs text-amber-900 bg-white border border-amber-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none leading-relaxed min-h-[44px]"
    />
  );
}

function ChannelCard({
  channel,
  editMode,
  onMetricUpdate,
  onTrafficLightUpdate,
}: {
  channel: ChannelAssessment;
  editMode: boolean;
  onMetricUpdate: (channelType: ChannelType, metricIndex: number, value: string) => void;
  onTrafficLightUpdate: (channelType: ChannelType, light: TrafficLight) => void;
}) {
  const iconStyle = CHANNEL_COLORS[channel.channelType] ?? 'text-slate-500 bg-slate-100';
  const criticalFlags = channel.flags.filter(f => f.severity === 'critical');
  const warningFlags = channel.flags.filter(f => f.severity === 'warning');
  const positiveFlags = channel.flags.filter(f => f.severity === 'positive');
  // V12: hide engagement (FB/IG/TikTok) + Facebook page likes from UI only (data remains in JSON).
  const visibleMetrics = channel.keyMetrics
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => !isHiddenDigitalPresenceMetric(channel.channelType, m.label));
  // Previously rendered all keyMetrics:
  // {channel.keyMetrics.map((m, i) => (<EditableMetric key={i} metric={m} ... />))}

  return (
    <Card className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={cn('p-2 rounded-lg', iconStyle)}>
            {CHANNEL_ICONS[channel.channelType]}
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800">{channel.channelLabel}</p>
            {channel.url && (
              <a
                href={channel.url.startsWith('http') ? channel.url : `https://${channel.url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-400 hover:text-amber-600 flex items-center gap-1 transition-colors"
              >
                {channel.url.replace(/^https?:\/\//, '').slice(0, 40)}
                {channel.url.length > 40 ? '\u2026' : ''}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
        </div>
        <EditableTrafficLight
          light={channel.trafficLight}
          editing={editMode}
          onChange={(next) => onTrafficLightUpdate(channel.channelType, next)}
        />
      </div>

      {/* Confidence notice */}
      {channel.dataConfidence === 'low' && (
        <div className="flex items-start gap-1.5 text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>Limited public data found -- score is a best estimate based on available information.</span>
        </div>
      )}

      {channel.notFound && (
        <div className="flex items-start gap-1.5 text-xs text-rose-500 bg-rose-50 rounded-lg px-3 py-2">
          <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>Channel not found or no public data available.</span>
        </div>
      )}

      {/* Summary */}
      {(channel.summary || editMode) && (
        <EditableSummaryText
          value={channel.summary || ''}
          editing={editMode}
          onSave={(v) => onMetricUpdate(channel.channelType, -1, v)}
        />
      )}

      {/* Key Metrics */}
      {visibleMetrics.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {visibleMetrics.map(({ m, i }) => (
            <EditableMetric
              key={`${m.label}-${i}`}
              metric={{ ...m, label: displayMetricLabel(channel.channelType, m.label) }}
              editing={editMode}
              onSave={(value) => onMetricUpdate(channel.channelType, i, value)}
            />
          ))}
        </div>
      )}

      {/* Flags */}
      {channel.flags.length > 0 && (
        <div className="space-y-1.5">
          {criticalFlags.map((f, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-rose-600">
              <FlagIcon severity="critical" />
              <span>{f.message}</span>
            </div>
          ))}
          {warningFlags.map((f, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-amber-600">
              <FlagIcon severity="warning" />
              <span>{f.message}</span>
            </div>
          ))}
          {positiveFlags.map((f, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-emerald-600">
              <FlagIcon severity="positive" />
              <span>{f.message}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function handleExportJSON(report: DigitalPresenceReport) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `digital-presence-${report.businessName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DigitalPresenceScorecard({ report, onReset, onRerun, onReanalyzeFromEdits, onEdit, onSaveEdits, readOnly = false, embedded = false }: Props) {
  const [editMode, setEditMode] = useState(false);
  const [editedReport, setEditedReport] = useState<DigitalPresenceReport>(report);
  const [assetEditMode, setAssetEditMode] = useState(false);
  const [excludedAssets, setExcludedAssets] = useState<Set<number>>(new Set());
  const [savedBadge, setSavedBadge] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Kept for optional AI reanalyze path (commented out in UI — V12 Save-only).
  const [reanalyzing, setReanalyzing] = useState(false);

  useEffect(() => {
    setEditedReport(report);
  }, [report]);

  const currentReport = editedReport;
  const criticalCount = currentReport.channels.reduce((acc, ch) => acc + ch.flags.filter(f => f.severity === 'critical').length, 0);
  const greenCount = currentReport.channels.filter(ch => ch.trafficLight === 'green').length;
  const redCount = currentReport.channels.filter(ch => ch.trafficLight === 'red').length;
  const busy = saving || reanalyzing;

  function handleMetricUpdate(channelType: ChannelType, metricIndex: number, value: string) {
    if (readOnly) return;
    setEditedReport(prev => ({
      ...prev,
      channels: prev.channels.map(ch => {
        if (ch.channelType !== channelType) return ch;
        if (metricIndex === -1) {
          return { ...ch, summary: value };
        }

        const updatedMetrics = [...ch.keyMetrics];
        if (metricIndex >= 0 && metricIndex < updatedMetrics.length) {
          updatedMetrics[metricIndex] = { ...updatedMetrics[metricIndex], value };
        }
        return { ...ch, keyMetrics: updatedMetrics };
      }),
    }));
    // Keep in-memory overrides so a later re-run can re-apply manual values.
    onEdit?.(channelType, metricIndex, value);
  }

  function handleTrafficLightUpdate(channelType: ChannelType, light: TrafficLight) {
    if (readOnly) return;
    setEditedReport((prev) => ({
      ...prev,
      channels: prev.channels.map((ch) => {
        if (ch.channelType !== channelType) return ch;
        return {
          ...ch,
          trafficLight: light,
          score: scoreForTrafficLight(light, ch.score),
        };
      }),
    }));
  }

  function handleExecutiveSummaryUpdate(value: string) {
    if (readOnly) return;
    setEditedReport((prev) => ({ ...prev, executiveSummary: value }));
  }

  async function handleSaveOnly() {
    if (readOnly || !onSaveEdits) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSaveEdits(editedReport);
      setEditMode(false);
      setSavedBadge(true);
      setTimeout(() => setSavedBadge(false), 2000);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save edits');
    } finally {
      setSaving(false);
    }
  }

  async function handleReanalyzeFromEdits() {
    // V12: AI reanalyze kept for future use; UI currently Save-only.
    if (readOnly || !onReanalyzeFromEdits) return;
    setReanalyzing(true);
    setSaveError(null);
    try {
      if (onSaveEdits) await onSaveEdits(editedReport);
      await onReanalyzeFromEdits(editedReport);
      setEditMode(false);
      setSavedBadge(true);
      setTimeout(() => setSavedBadge(false), 2000);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to update analysis from edits');
    } finally {
      setReanalyzing(false);
    }
  }

  function handleCancelEdit() {
    if (readOnly || busy) return;
    setEditedReport(report);
    setEditMode(false);
    setSaveError(null);
  }

  function handleStartEdit() {
    if (readOnly) return;
    setEditMode(true);
    setSaveError(null);
  }

  function toggleAssetExclusion(index: number) {
    setExcludedAssets(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  const editControls = !readOnly ? (
    <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
      {!editMode ? (
        <button
          type="button"
          onClick={handleStartEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit Results
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={handleCancelEdit}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-60"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
          {onSaveEdits && (
            <button
              type="button"
              onClick={() => void handleSaveOnly()}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : savedBadge && !reanalyzing ? 'Saved' : 'Save'}
            </button>
          )}
          {onReanalyzeFromEdits && (
            <button
              type="button"
              onClick={() => void handleReanalyzeFromEdits()}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-900 bg-slate-900 text-xs font-medium text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', reanalyzing && 'animate-spin')} />
              {reanalyzing ? 'Updating analysis...' : 'Update analysis from edits'}
            </button>
          )}
        </>
      )}
      <button
        type="button"
        onClick={onRerun}
        disabled={busy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer disabled:opacity-60"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Re-run Analysis
      </button>
    </div>
  ) : null;

  return (
    <div className="space-y-6">
      {/* Header bar */}
      {embedded ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              Generated {new Date(currentReport.generatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            {/* <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
              Overall Score: {currentReport.overallScore}/5
            </span> */}
            {saveError && (
              <span className="text-xs font-medium text-rose-600">{saveError}</span>
            )}
          </div>
          {editControls}
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{currentReport.businessName}</h2>
            <p className="text-xs text-slate-400">
              Marketing Spend &amp; Performance Report &middot; Generated {new Date(currentReport.generatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            {saveError && (
              <p className="text-xs font-medium text-rose-600 mt-1">{saveError}</p>
            )}
          </div>
          {!readOnly && (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {editControls}
              <ExportReportButton
                html={buildDigitalPresenceReportHtml(currentReport)}
                fileName={`digital-presence-${currentReport.businessName.replace(/\s+/g, '-').toLowerCase()}`}
              />
              <button
                onClick={() => handleExportJSON(currentReport)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export JSON
              </button>
              <button
                onClick={onReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                New Analysis
              </button>
            </div>
          )}
        </div>
      )}

      {/* Edit mode banner */}
      {editMode && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3">
          <Pencil className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            Edit mode is active. Change Good/Fair/Poor tags, metrics, or summaries, then click <strong>Save</strong> to
            persist without AI, or <strong>Update analysis from edits</strong> to refresh scores/narrative from your edits.
            Use <strong>Re-run Analysis</strong> only for a fresh web research pass.
          </p>
        </div>
      )}

      {/* Summary stats + executive summary (no overall score circle) */}
      <div className="space-y-3">
        {/* Stat pills */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-emerald-600">{greenCount}</p>
            <p className="text-[10px] text-emerald-500 mt-0.5 font-medium uppercase tracking-wide">Good Channels</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-amber-500">{currentReport.channels.filter(c => c.trafficLight === 'amber').length}</p>
            <p className="text-[10px] text-amber-500 mt-0.5 font-medium uppercase tracking-wide">Fair Channels</p>
          </div>
          <div className="bg-rose-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-rose-500">{redCount}</p>
            <p className="text-[10px] text-rose-400 mt-0.5 font-medium uppercase tracking-wide">Poor Channels</p>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="bg-slate-50 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-400" />
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest">Executive Summary</p>
          </div>
          {editMode ? (
            <EditableSummaryText
              value={currentReport.executiveSummary}
              editing
              onSave={handleExecutiveSummaryUpdate}
            />
          ) : (
            <p className="text-sm text-slate-700 leading-relaxed">{currentReport.executiveSummary}</p>
          )}
        </div>

        {/* M&A Notes */}
        {currentReport.maReadinessNotes && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-0.5">M&A Readiness Note</p>
              <p className="text-xs text-amber-700 leading-relaxed">{currentReport.maReadinessNotes}</p>
            </div>
          </div>
        )}

        {criticalCount > 0 && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <p className="text-xs text-rose-600 font-medium">
              {criticalCount} critical issue{criticalCount > 1 ? 's' : ''} found across all channels
            </p>
          </div>
        )}
      </div>

      {/* Channel Cards */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-slate-400" />
          Channel Scorecard
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {currentReport.channels.map((channel, i) => (
            <ChannelCard
              key={i}
              channel={channel}
              editMode={editMode}
              onMetricUpdate={handleMetricUpdate}
              onTrafficLightUpdate={handleTrafficLightUpdate}
            />
          ))}
        </div>
      </div>

      {/* Digital Asset Inventory */}
      {currentReport.digitalAssetInventory.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Package className="w-4 h-4 text-slate-400" />
              Digital Asset Inventory
              <Badge color="slate" className="text-[10px]">M&A Sale Package</Badge>
            </h3>
            <button
              onClick={() => setAssetEditMode(m => !m)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors',
                assetEditMode
                  ? 'border-amber-300 bg-amber-50 text-amber-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              {assetEditMode ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
              {assetEditMode ? 'Done' : 'Edit'}
            </button>
          </div>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {assetEditMode && (
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-12">Include</th>
                  )}
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Asset</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">URL</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Notes</th>
                </tr>
              </thead>
              <tbody>
                {currentReport.digitalAssetInventory.map((item, i) => {
                  const isExcluded = excludedAssets.has(i);
                  return (
                    <tr
                      key={i}
                      className={cn(
                        'border-b border-slate-50 transition-colors',
                        isExcluded ? 'opacity-40 bg-slate-50' : 'hover:bg-slate-50/50'
                      )}
                    >
                      {assetEditMode && (
                        <td className="text-center px-3 py-3">
                          <input
                            type="checkbox"
                            checked={!isExcluded}
                            onChange={() => toggleAssetExclusion(i)}
                            className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                          />
                        </td>
                      )}
                      <td className={cn('px-4 py-3 text-xs font-medium', isExcluded ? 'text-slate-400 line-through' : 'text-slate-700')}>
                        {item.assetType}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {item.url && item.url !== 'N/A' ? (
                          <a
                            href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-amber-600 hover:underline flex items-center gap-1"
                          >
                            {item.url.replace(/^https?:\/\//, '').slice(0, 32)}{item.url.length > 40 && '\u2026'}
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : (
                          <span className="text-xs text-slate-300">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={item.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell max-w-xs truncate">{item.notes}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          {excludedAssets.size > 0 && (
            <p className="text-xs text-slate-400 mt-2">
              {excludedAssets.size} asset{excludedAssets.size > 1 ? 's' : ''} excluded from report.
            </p>
          )}
        </div>
      )}

      {(currentReport.marketingAssessment || currentReport.marketingIntake || currentReport.marketingEvidence?.length) && (
        <section className="space-y-4 border-t border-slate-200 pt-6">
          <div className="flex items-center justify-between pb-1">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-slate-400" />
                Marketing Spend &amp; Performance
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">Local search, website performance, marketing investment, channel outcomes, and transferability.</p>
            </div>
          </div>
          {currentReport.marketingEvidence && <MarketingEvidencePanel evidence={currentReport.marketingEvidence} />}
          {currentReport.marketingAssessment && (
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 border border-slate-100">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-slate-400" />
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest">Advisor Assessment</p>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">
                {currentReport.marketingAssessment
                  .replace(/Chrome UX Report\s*\(CrUX\)|\bCrUX\b/gi, 'real visitor website data')
                  .replace(/Google PageSpeed Insights/gi, 'website speed test')
                  .replace(/Google Places API/gi, 'Google Business Profile records')
                  .replace(/DataForSEO/gi, 'local search results')}
              </p>
            </div>
          )}
          {currentReport.marketingIntake && <MarketingInputsPanel intake={currentReport.marketingIntake} />}
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-800 mb-0.5">Buyer Follow-Up Guidance</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                Reconcile channel spend and bookings to platform exports and financials; obtain campaign-level ad and website analytics, email open/click/booking results, documented goals, and peak/off-season trends. A spend-to-revenue ratio needs verified marketing expense and revenue. Public search placement and website performance do not verify ad spend, traffic, bookings, or sales.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Disclaimer */}
      <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-400 leading-relaxed">
          This report is based on publicly available web data gathered via AI-powered research. Data accuracy may vary -- some channels may have limited public visibility. Scores are estimates to guide further due diligence, not guarantees. Always verify key metrics directly with the seller.
        </p>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cfg: Record<string, { label: string; className: string }> = {
    active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    inactive: { label: 'Inactive', className: 'bg-rose-50 text-rose-600 border-rose-200' },
    not_found: { label: 'Not Found', className: 'bg-slate-100 text-slate-500 border-slate-200' },
    unverified: { label: 'Unverified', className: 'bg-amber-50 text-amber-600 border-amber-200' },
  };
  const c = cfg[status] ?? cfg.unverified;
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded border', c.className)}>
      {c.label}
    </span>
  );
}
