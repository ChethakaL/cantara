'use client';

import { useRef, useState } from 'react';
import { Globe2, AlertCircle, CheckCircle2, Loader2, Search, Wifi } from 'lucide-react';
import AdminNav from '@/components/admin/AdminNav';
import DigitalPresenceForm from '@/components/digital-presence/DigitalPresenceForm';
import DigitalPresenceScorecard from '@/components/digital-presence/DigitalPresenceScorecard';
import { DigitalAssetFormData, DigitalPresenceReport, AnalysisStatus } from '@/lib/digital-presence/types';
import { cn } from '@/components/ui';

interface ProgressEvent {
  type: 'progress';
  phase: 'research' | 'analyze';
  message: string;
  channelLabel?: string;
  completed?: number;
  total?: number;
}

interface LogEntry {
  id: number;
  phase: 'research' | 'analyze';
  message: string;
  completed?: number;
  total?: number;
}

let logIdCounter = 0;

export default function DigitalPresencePage() {
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [report, setReport] = useState<DigitalPresenceReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [currentPhase, setCurrentPhase] = useState<'research' | 'analyze' | null>(null);
  const [researchProgress, setResearchProgress] = useState<{ completed: number; total: number } | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  function appendLog(entry: Omit<LogEntry, 'id'>) {
    setLog(prev => {
      const updated = [...prev, { ...entry, id: ++logIdCounter }];
      return updated;
    });
    // Scroll to bottom on next tick
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  async function handleSubmit(formData: DigitalAssetFormData) {
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

            appendLog({
              phase: ev.phase,
              message: ev.message,
              completed: ev.completed,
              total: ev.total,
            });
          } else if (event.type === 'complete') {
            setReport(event.report);
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
  }

  const isLoading = status === 'researching' || status === 'analyzing';

  return (
    <div className="min-h-screen" style={{ background: '#f8f9fb' }}>
      <AdminNav />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200">
              <Globe2 className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Digital Presence Analysis</h1>
              <p className="text-sm text-slate-400">M&A Due Diligence · Workstream 3</p>
            </div>
          </div>
          <p className="text-sm text-slate-500 max-w-xl ml-14">
            Submit digital asset URLs and handles to generate an AI-powered scorecard assessing the business's online presence across all channels.
          </p>
        </div>

        {/* Main card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Status bar */}
          <div className="border-b border-slate-100 px-6 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn('w-2 h-2 rounded-full transition-colors', {
                'bg-slate-300': status === 'idle',
                'bg-amber-400 animate-pulse': isLoading,
                'bg-emerald-500': status === 'complete',
                'bg-rose-500': status === 'error',
              })} />
              <span className="text-sm font-medium text-slate-600">
                {status === 'idle' && 'Enter Digital Assets'}
                {status === 'researching' && 'Gathering web data…'}
                {status === 'analyzing' && 'Scoring & analysing…'}
                {status === 'complete' && 'Analysis Complete'}
                {status === 'error' && 'Analysis Failed'}
              </span>
            </div>
            {isLoading && researchProgress && (
              <span className="text-xs text-amber-600 font-medium tabular-nums">
                {researchProgress.completed} / {researchProgress.total} channels
              </span>
            )}
            {status === 'complete' && report && (
              <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border', {
                'bg-emerald-50 text-emerald-700 border-emerald-200': report.overallTrafficLight === 'green',
                'bg-amber-50 text-amber-700 border-amber-200': report.overallTrafficLight === 'amber',
                'bg-rose-50 text-rose-700 border-rose-200': report.overallTrafficLight === 'red',
              })}>
                Overall: {report.overallScore.toFixed(1)}/5
              </span>
            )}
          </div>

          <div className="p-6">
            {/* Idle: show form */}
            {status === 'idle' && (
              <DigitalPresenceForm onSubmit={handleSubmit} loading={false} />
            )}

            {/* Loading: show live log */}
            {isLoading && (
              <div className="space-y-5">
                {/* Animated icon + phase label */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full border-2 border-amber-100 flex items-center justify-center">
                      {currentPhase === 'research'
                        ? <Wifi className="w-5 h-5 text-amber-500" />
                        : <Search className="w-5 h-5 text-amber-500" />
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
                        ? 'Searching across all provided channels…'
                        : 'Scoring each channel and generating scorecard…'
                      }
                    </p>
                  </div>
                </div>

                {/* Progress bar for research phase */}
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

                {/* Live log */}
                {log.length > 0 && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 overflow-hidden">
                    <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Live Activity</span>
                    </div>
                    <div className="max-h-52 overflow-y-auto px-3 py-2 space-y-1.5 font-mono">
                      {log.map(entry => (
                        <div key={entry.id} className="flex items-start gap-2 text-xs">
                          <span className={cn('flex-shrink-0 mt-0.5', {
                            'text-amber-500': entry.phase === 'research',
                            'text-blue-500': entry.phase === 'analyze',
                          })}>
                            {entry.phase === 'research' ? '◉' : '▶'}
                          </span>
                          <span className="text-slate-600 leading-snug">{entry.message}</span>
                        </div>
                      ))}
                      <div ref={logEndRef} />
                    </div>
                  </div>
                )}

                <p className="text-center text-xs text-slate-400">
                  This may take 60–120 seconds depending on how many channels were submitted.
                </p>
              </div>
            )}

            {/* Error state */}
            {status === 'error' && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-rose-700">Analysis Failed</p>
                    <p className="text-sm text-rose-600 mt-1">{error}</p>
                  </div>
                </div>
                {log.length > 0 && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 space-y-1 font-mono max-h-40 overflow-y-auto">
                    {log.map(entry => (
                      <div key={entry.id} className="text-xs text-slate-500">{entry.message}</div>
                    ))}
                  </div>
                )}
                <button onClick={handleReset} className="text-sm text-amber-600 hover:underline">
                  ← Try again
                </button>
              </div>
            )}

            {/* Complete: show scorecard */}
            {status === 'complete' && report && (
              <DigitalPresenceScorecard report={report} onReset={handleReset} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
