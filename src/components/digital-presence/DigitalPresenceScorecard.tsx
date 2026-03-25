'use client';

import {
  Globe,
  MapPin,
  Facebook,
  Instagram,
  Youtube,
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
} from 'lucide-react';
import { DigitalPresenceReport, ChannelAssessment, ChannelType, TrafficLight } from '@/lib/digital-presence/types';
import { Badge, Card, cn } from '@/components/ui';

interface Props {
  report: DigitalPresenceReport;
  onReset: () => void;
}

const CHANNEL_ICONS: Record<ChannelType, React.ReactNode> = {
  website: <Globe className="w-4 h-4" />,
  google_business: <MapPin className="w-4 h-4" />,
  facebook: <Facebook className="w-4 h-4" />,
  instagram: <Instagram className="w-4 h-4" />,
  tiktok: <Music2 className="w-4 h-4" />,
  youtube: <Youtube className="w-4 h-4" />,
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

function TrafficLightBadge({ light, score }: { light: TrafficLight; score: number }) {
  const cfg = {
    green: { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', label: 'Good' },
    amber: { dot: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', label: 'Fair' },
    red: { dot: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50 border-rose-200', label: 'Poor' },
  }[light];

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold', cfg.bg, cfg.text)}>
      <span className={cn('w-2 h-2 rounded-full', cfg.dot)} />
      {score}/5 · {cfg.label}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = ((score - 1) / 4) * 100;
  const color = score >= 4 ? '#10b981' : score >= 3 ? '#f59e0b' : '#f43f5e';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function FlagIcon({ severity }: { severity: 'critical' | 'warning' | 'positive' }) {
  if (severity === 'positive') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />;
  if (severity === 'critical') return <XCircle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0 mt-0.5" />;
  return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />;
}

function ChannelCard({ channel }: { channel: ChannelAssessment }) {
  const iconStyle = CHANNEL_COLORS[channel.channelType] ?? 'text-slate-500 bg-slate-100';
  const criticalFlags = channel.flags.filter(f => f.severity === 'critical');
  const warningFlags = channel.flags.filter(f => f.severity === 'warning');
  const positiveFlags = channel.flags.filter(f => f.severity === 'positive');

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
                {channel.url.length > 40 ? '…' : ''}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
        </div>
        <TrafficLightBadge light={channel.trafficLight} score={channel.score} />
      </div>

      <ScoreBar score={channel.score} />

      {/* Confidence notice */}
      {channel.dataConfidence === 'low' && (
        <div className="flex items-start gap-1.5 text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>Limited public data found — score is a best estimate based on available information.</span>
        </div>
      )}

      {channel.notFound && (
        <div className="flex items-start gap-1.5 text-xs text-rose-500 bg-rose-50 rounded-lg px-3 py-2">
          <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>Channel not found or no public data available.</span>
        </div>
      )}

      {/* Summary */}
      {channel.summary && (
        <p className="text-xs text-slate-600 leading-relaxed">{channel.summary}</p>
      )}

      {/* Key Metrics */}
      {channel.keyMetrics.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {channel.keyMetrics.map((m, i) => (
            <div key={i} className="bg-slate-50 rounded-lg px-2.5 py-1.5">
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{m.label}</p>
              <p className="text-xs font-semibold text-slate-700 mt-0.5">{m.value}</p>
            </div>
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

function OverallScoreCircle({ score, light }: { score: number; light: TrafficLight }) {
  const color = light === 'green' ? '#10b981' : light === 'amber' ? '#f59e0b' : '#f43f5e';
  const bgColor = light === 'green' ? 'bg-emerald-50' : light === 'amber' ? 'bg-amber-50' : 'bg-rose-50';
  const label = light === 'green' ? 'Strong Presence' : light === 'amber' ? 'Moderate Presence' : 'Weak Presence';
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-2xl p-6 text-center', bgColor)}>
      <svg width="80" height="80" viewBox="0 0 80 80" className="mb-2">
        <circle cx="40" cy="40" r="34" fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle
          cx="40" cy="40" r="34"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={`${((score - 1) / 4) * 213.6} 213.6`}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
        <text x="40" y="40" textAnchor="middle" dominantBaseline="middle" className="text-2xl font-bold" fill={color} style={{ fontSize: 20, fontWeight: 700 }}>
          {score.toFixed(1)}
        </text>
      </svg>
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <p className="text-xs text-slate-400 mt-0.5">Overall Score / 5</p>
    </div>
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

export default function DigitalPresenceScorecard({ report, onReset }: Props) {
  const criticalCount = report.channels.reduce((acc, ch) => acc + ch.flags.filter(f => f.severity === 'critical').length, 0);
  const greenCount = report.channels.filter(ch => ch.trafficLight === 'green').length;
  const redCount = report.channels.filter(ch => ch.trafficLight === 'red').length;

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{report.businessName}</h2>
          <p className="text-xs text-slate-400">
            Digital Presence Report · Generated {new Date(report.generatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExportJSON(report)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </button>
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
          >
            New Analysis
          </button>
        </div>
      </div>

      {/* Overall score + summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <OverallScoreCircle score={report.overallScore} light={report.overallTrafficLight} />

        <div className="sm:col-span-2 space-y-3">
          {/* Stat pills */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-emerald-600">{greenCount}</p>
              <p className="text-[10px] text-emerald-500 mt-0.5 font-medium uppercase tracking-wide">Green Channels</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-amber-500">{report.channels.filter(c => c.trafficLight === 'amber').length}</p>
              <p className="text-[10px] text-amber-500 mt-0.5 font-medium uppercase tracking-wide">Amber Channels</p>
            </div>
            <div className="bg-rose-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-rose-500">{redCount}</p>
              <p className="text-[10px] text-rose-400 mt-0.5 font-medium uppercase tracking-wide">Red Channels</p>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-400" />
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest">Executive Summary</p>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{report.executiveSummary}</p>
          </div>

          {/* M&A Notes */}
          {report.maReadinessNotes && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-700 mb-0.5">M&A Readiness Note</p>
                <p className="text-xs text-amber-700 leading-relaxed">{report.maReadinessNotes}</p>
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
      </div>

      {/* Channel Cards */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-slate-400" />
          Channel Scorecard
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {report.channels.map((channel, i) => (
            <ChannelCard key={i} channel={channel} />
          ))}
        </div>
      </div>

      {/* Digital Asset Inventory */}
      {report.digitalAssetInventory.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Package className="w-4 h-4 text-slate-400" />
            Digital Asset Inventory
            <Badge color="slate" className="text-[10px]">M&A Sale Package</Badge>
          </h3>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Asset</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">URL</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Score</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Notes</th>
                </tr>
              </thead>
              <tbody>
                {report.digitalAssetInventory.map((item, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-xs font-medium text-slate-700">{item.assetType}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {item.url && item.url !== 'N/A' ? (
                        <a
                          href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-amber-600 hover:underline flex items-center gap-1"
                        >
                          {item.url.replace(/^https?:\/\//, '').slice(0, 32)}{item.url.length > 40 && '…'}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={item.status} />
                    </td>
                    <td className="px-4 py-3">
                      {item.score ? (
                        <span className={cn(
                          'text-xs font-bold',
                          item.score >= 4 ? 'text-emerald-600' : item.score >= 3 ? 'text-amber-500' : 'text-rose-500'
                        )}>
                          {item.score}/5
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell max-w-xs truncate">{item.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* Disclaimer */}
      <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-400 leading-relaxed">
          This report is based on publicly available web data gathered via AI-powered research. Data accuracy may vary — some channels may have limited public visibility. Scores are estimates to guide further due diligence, not guarantees. Always verify key metrics directly with the seller.
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
