'use client';

import { useRef, useState } from 'react';
import { AlertCircle, Search, Wifi } from 'lucide-react';
import DigitalPresenceForm from './DigitalPresenceForm';
import DigitalPresenceScorecard from './DigitalPresenceScorecard';
import { DigitalAssetFormData, DigitalPresenceReport, AnalysisStatus } from '@/lib/digital-presence/types';
import { cn } from '@/components/ui';

interface ProgressEvent {
  type: 'progress';
  phase: 'research' | 'analyze';
  message: string;
  completed?: number;
  total?: number;
}

interface LogEntry {
  id: number;
  phase: 'research' | 'analyze';
  message: string;
}

let _logId = 0;

interface Props {
  clientId: string;
  clientName: string;
  clientWebsite?: string;
}

// Type for tracking manual metric overrides across re-runs
interface ManualOverride {
  channelType: string;
  metricIndex: number;
  value: string;
}

export default function DigitalPresenceTab({ clientId, clientName, clientWebsite }: Props) {
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [report, setReport] = useState<DigitalPresenceReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [currentPhase, setCurrentPhase] = useState<'research' | 'analyze' | null>(null);
  const [researchProgress, setResearchProgress] = useState<{ completed: number; total: number } | null>(null);
  const [lastFormData, setLastFormData] = useState<DigitalAssetFormData | null>(null);
  const [manualOverrides, setManualOverrides] = useState<ManualOverride[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  function appendLog(entry: Omit<LogEntry, 'id'>) {
    setLog(prev => [...prev, { ...entry, id: ++_logId }]);
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  function applyOverridesToReport(baseReport: DigitalPresenceReport, overrides: ManualOverride[]): DigitalPresenceReport {
    if (overrides.length === 0) return baseReport;
    return {
      ...baseReport,
      channels: baseReport.channels.map(ch => {
        const channelOverrides = overrides.filter(o => o.channelType === ch.channelType);
        if (channelOverrides.length === 0) return ch;
        const updatedMetrics = [...ch.keyMetrics];
        for (const override of channelOverrides) {
          if (override.metricIndex < updatedMetrics.length) {
            updatedMetrics[override.metricIndex] = { ...updatedMetrics[override.metricIndex], value: override.value };
          }
        }
        return { ...ch, keyMetrics: updatedMetrics };
      }),
    };
  }

  function handleEdit(channelType: string, metricIndex: number, value: string) {
    setManualOverrides(prev => {
      const filtered = prev.filter(o => !(o.channelType === channelType && o.metricIndex === metricIndex));
      return [...filtered, { channelType, metricIndex, value }];
    });
  }

  async function handleSubmit(formData: DigitalAssetFormData) {
    setLastFormData(formData);
    setStatus('researching');
    setError(null);
    setReport(null);
    setLog([]);
    setCurrentPhase('research');
    setResearchProgress(null);

    try {
      const res = await fetch('/api/digital-presence/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData }),
      });

      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          let event: any;
          try { event = JSON.parse(raw); } catch { continue; }

          if (event.type === 'progress') {
            const ev = event as ProgressEvent;
            setCurrentPhase(ev.phase);
            if (ev.phase === 'research' && ev.completed !== undefined && ev.total !== undefined) {
              setResearchProgress({ completed: ev.completed, total: ev.total });
            }
            if (ev.phase === 'analyze') {
              setStatus('analyzing');
              setResearchProgress(null);
            }
            appendLog({ phase: ev.phase, message: ev.message });
          } else if (event.type === 'complete') {
            setReport(applyOverridesToReport(event.report, manualOverrides));
            setStatus('complete');
          } else if (event.type === 'error') {
            throw new Error(event.error ?? 'Analysis failed.');
          }
        }
      }
    } catch (err: any) {
      setError(err?.message ?? 'An unexpected error occurred.');
      setStatus('error');
    }
  }

  function handleReset() {
    setStatus('idle');
    setReport(null);
    setError(null);
    setLog([]);
    setCurrentPhase(null);
    setResearchProgress(null);
    // Note: lastFormData is preserved so the form re-populates
  }

  function handleRerun() {
    // Go back to form view with data preserved
    setStatus('idle');
    setReport(null);
    setError(null);
    setLog([]);
    setCurrentPhase(null);
    setResearchProgress(null);
  }

  const isLoading = status === 'researching' || status === 'analyzing';

  return (
    <div className="space-y-5">
      {/* Status strip */}
      {(isLoading || status === 'complete') && (
        <div className={cn(
          'flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-medium border',
          isLoading
            ? 'bg-amber-50 border-amber-200 text-amber-700'
            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        )}>
          <div className="flex items-center gap-2">
            <div className={cn('w-1.5 h-1.5 rounded-full', isLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500')} />
            {status === 'researching' && 'Gathering web data\u2026'}
            {status === 'analyzing' && 'Scoring & analysing\u2026'}
            {status === 'complete' && 'Analysis complete'}
          </div>
          {isLoading && researchProgress && (
            <span className="tabular-nums">{researchProgress.completed} / {researchProgress.total} channels</span>
          )}
        </div>
      )}

      {/* Idle -> form */}
      {status === 'idle' && (
        <DigitalPresenceForm
          onSubmit={handleSubmit}
          loading={false}
          initialData={lastFormData ?? undefined}
          clientName={clientName}
          clientWebsite={clientWebsite}
        />
      )}

      {/* Loading -> live log */}
      {isLoading && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-full border-2 border-amber-100 flex items-center justify-center">
                {currentPhase === 'research'
                  ? <Wifi className="w-4 h-4 text-amber-500" />
                  : <Search className="w-4 h-4 text-amber-500" />
                }
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-amber-400 animate-spin" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">
                {currentPhase === 'research' ? 'Gathering public data' : 'Running AI scoring'}
              </p>
              <p className="text-xs text-slate-400">
                {currentPhase === 'research'
                  ? 'Searching across all provided channels\u2026'
                  : 'Scoring each channel and generating scorecard\u2026'}
              </p>
            </div>
          </div>

          {currentPhase === 'research' && researchProgress && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Channels researched</span>
                <span className="tabular-nums font-medium text-amber-600">
                  {researchProgress.completed} of {researchProgress.total}
                </span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${(researchProgress.completed / researchProgress.total) * 100}%`,
                    background: 'linear-gradient(90deg, #b8922a, #d4a843)',
                  }}
                />
              </div>
            </div>
          )}

          {log.length > 0 && (
            <div className="rounded-xl border border-slate-100 bg-slate-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Live Activity</span>
              </div>
              <div className="max-h-48 overflow-y-auto px-3 py-2 space-y-1.5 font-mono">
                {log.map(entry => (
                  <div key={entry.id} className="flex items-start gap-2 text-xs">
                    <span className={cn('flex-shrink-0 mt-0.5', {
                      'text-amber-500': entry.phase === 'research',
                      'text-blue-500': entry.phase === 'analyze',
                    })}>
                      {entry.phase === 'research' ? '\u25C9' : '\u25B6'}
                    </span>
                    <span className="text-slate-600 leading-snug">{entry.message}</span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          )}

          <p className="text-center text-xs text-slate-400">
            This may take 60\u2013120 seconds depending on channels submitted.
          </p>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
            <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-rose-700">Analysis Failed</p>
              <p className="text-sm text-rose-600 mt-1">{error}</p>
            </div>
          </div>
          <button onClick={handleReset} className="text-sm text-amber-600 hover:underline">
            &larr; Try again
          </button>
        </div>
      )}

      {/* Complete -> scorecard */}
      {status === 'complete' && report && (
        <DigitalPresenceScorecard report={report} onReset={handleReset} onRerun={handleRerun} onEdit={handleEdit} />
      )}
    </div>
  );
}
