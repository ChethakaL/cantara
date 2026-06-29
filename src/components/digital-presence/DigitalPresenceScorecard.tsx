'use client';

import { useState } from 'react';
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
  RefreshCw,
} from 'lucide-react';
import { DigitalPresenceReport, ChannelAssessment, ChannelType, TrafficLight, KeyMetric } from '@/lib/digital-presence/types';
import { Badge, Card, cn } from '@/components/ui';
import { ExportReportButton } from '@/components/report-export/ExportReportButton';
import { buildDigitalPresenceReportHtml } from '@/lib/report-export/build-digital-presence-report';

interface Props {
  report: DigitalPresenceReport;
  onReset?: () => void;
  onRerun?: () => void;
  onEdit?: (channelType: string, metricIndex: number, value: string) => void;
  readOnly?: boolean;
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

function ChannelCard({ channel, editMode, onMetricUpdate }: { channel: ChannelAssessment; editMode: boolean; onMetricUpdate: (channelType: ChannelType, metricIndex: number, value: string) => void }) {
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
                {channel.url.length > 40 ? '\u2026' : ''}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
        </div>
        <TrafficLightBadge light={channel.trafficLight} />
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
      {channel.summary && (
        <EditableSummaryText
          value={channel.summary}
          editing={editMode}
          onSave={(v) => onMetricUpdate(channel.channelType, -1, v)}
        />
      )}

      {/* Key Metrics */}
      {channel.keyMetrics.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {channel.keyMetrics.map((m, i) => (
            <EditableMetric
              key={i}
              metric={m}
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

export default function DigitalPresenceScorecard({ report, onReset, onRerun, onEdit, readOnly = false }: Props) {
  const [editMode, setEditMode] = useState(false);
  const [editedReport, setEditedReport] = useState<DigitalPresenceReport>(report);
  const [assetEditMode, setAssetEditMode] = useState(false);
  const [excludedAssets, setExcludedAssets] = useState<Set<number>>(new Set());

  const currentReport = editedReport;
  const criticalCount = currentReport.channels.reduce((acc, ch) => acc + ch.flags.filter(f => f.severity === 'critical').length, 0);
  const greenCount = currentReport.channels.filter(ch => ch.trafficLight === 'green').length;
  const redCount = currentReport.channels.filter(ch => ch.trafficLight === 'red').length;

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
    // Persist the override so re-run preserves it
    onEdit?.(channelType, metricIndex, value);
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

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{currentReport.businessName}</h2>
          <p className="text-xs text-slate-400">
            Digital Presence Report &middot; Generated {new Date(currentReport.generatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        {!readOnly && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditMode(m => !m)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors',
              editMode
                ? 'border-amber-300 bg-amber-50 text-amber-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            {editMode ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
            {editMode ? 'Done Editing' : 'Edit Results'}
          </button>
          <ExportReportButton
            html={buildDigitalPresenceReportHtml(currentReport)}
            fileName={`digital-presence-${currentReport.businessName.replace(/\s+/g, '-').toLowerCase()}`}
          />
          <button
            onClick={() => handleExportJSON(currentReport)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </button>
          <button
            onClick={onRerun}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-700 hover:bg-amber-100 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Re-run Analysis
          </button>
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
          >
            New Analysis
          </button>
        </div>
        )}
      </div>

      {/* Edit mode banner */}
      {editMode && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3">
          <Pencil className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            Edit mode is active. Click on any metric value or summary text to update it manually. Changes are saved in real-time.
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
          <p className="text-sm text-slate-700 leading-relaxed">{currentReport.executiveSummary}</p>
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
