'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Info,
  Plus,
  RotateCw,
  Search,
  Trash2,
  Wifi,
  X,
} from 'lucide-react';
import DigitalPresenceForm from './DigitalPresenceForm';
import DigitalPresenceScorecard from './DigitalPresenceScorecard';
import { DigitalAssetFormData, DigitalPresenceReport, AnalysisStatus } from '@/lib/digital-presence/types';
import { Button, cn } from '@/components/ui';
import { agentTabReadOnlyGate } from '@/hooks/useAgentTabReadOnly';
import type { AgentTabReadOnlyProps } from '@/types/agent-tab';
import { useGenericAgentRuns } from '@/hooks/useGenericAgentRuns';
import { AgentRunToolbar } from '@/components/admin/AgentRunToolbar';
import { resolveAgentModelId } from '@/lib/agent-model-provider';
import { AGENT_RUN_KEYS } from '@/lib/agent-run-keys';
import { saveAgentAnalysisRunClient } from '@/lib/agent-analysis-runs.client';
import type { AgentRunHistoryItem } from '@/components/admin/AgentRunHistoryPanel';
import { ExportReportButton } from '@/components/report-export/ExportReportButton';
import { buildDigitalPresenceReportHtml } from '@/lib/report-export/build-digital-presence-report';

/** Digital Presence always runs on OpenAI (web search). No Claude/Bedrock option. */
const DIGITAL_PRESENCE_PROVIDER = 'openai' as const;

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

interface Props extends AgentTabReadOnlyProps {
  clientId: string;
  clientName: string;
  clientWebsite?: string;
}

interface ManualOverride {
  channelType: string;
  metricIndex: number;
  value: string;
}

function DeleteConfirmModal({
  open,
  title,
  description,
  onClose,
  onConfirm,
  confirmLabel = 'Delete',
  isDeleting = false,
}: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  isDeleting?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isDeleting} className="text-xs">
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            disabled={isDeleting}
            className="text-xs bg-rose-600 hover:bg-rose-700 text-white"
          >
            {isDeleting ? 'Deleting...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatusToast({
  toast,
  onClose,
}: {
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-lg border shadow-lg text-xs font-medium bg-white text-slate-800 border-slate-200 animate-in fade-in slide-in-from-bottom-2 duration-200">
      {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
      {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
      {toast.type === 'info' && <Info className="w-4 h-4 text-blue-600 shrink-0" />}
      <span>{toast.message}</span>
      <button onClick={onClose} className="ml-2 text-slate-400 hover:text-slate-600 cursor-pointer">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function DigitalPresenceTab({ clientId, clientName, clientWebsite, readOnly = false }: Props) {
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [report, setReport] = useState<DigitalPresenceReport | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [currentPhase, setCurrentPhase] = useState<'research' | 'analyze' | null>(null);
  const [researchProgress, setResearchProgress] = useState<{ completed: number; total: number } | null>(null);
  const [lastFormData, setLastFormData] = useState<DigitalAssetFormData | null>(null);
  const [manualOverrides, setManualOverrides] = useState<ManualOverride[]>([]);
  const [composingNew, setComposingNew] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [refreshingInputs, setRefreshingInputs] = useState(false);
  const [savingInputs, setSavingInputs] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const logEndRef = useRef<HTMLDivElement>(null);
  const {
    runs,
    historyItems,
    activeRun,
    activeId,
    setActiveId,
    reload: reloadRuns,
    loading: loadingRuns,
  } = useGenericAgentRuns(clientId, AGENT_RUN_KEYS.digitalPresence);

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
    setToast({ message, type });
  }

  useEffect(() => {
    if (loadingRuns) return;
    if (!activeRun?.report) {
      setInitialLoadDone(true);
      return;
    }
    const payload = activeRun.report as DigitalPresenceReport;
    if (payload?.businessName || payload?.channels?.length) {
      setReport(payload);
      setStatus('complete');
    }
    setInitialLoadDone(true);
  }, [activeRun, loadingRuns]);

  function selectRun(run: AgentRunHistoryItem) {
    setActiveId(run.id);
    const full = runs.find((item) => item.id === run.id);
    const payload = (full?.report ?? null) as DigitalPresenceReport | null;
    if (payload) {
      setReport(payload);
      setStatus('complete');
      setComposingNew(false);
    }
  }

  // Load saved digital presence form responses from client portal / client record
  useEffect(() => {
    let cancelled = false;
    async function loadSavedForm() {
      try {
        const res = await fetch(`/api/client-data/${clientId}?section=digitalPresenceForm`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data) setLastFormData(data);
      } catch {
        // Saved client portal form data is optional.
      }
    }
    void loadSavedForm();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  async function handleRefreshInputs() {
    setRefreshingInputs(true);
    try {
      const res = await fetch(`/api/client-data/${clientId}?section=digitalPresenceForm`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setLastFormData(data);
          showToast('Online channels refreshed from Client Portal & Profile', 'success');
        }
      }
    } catch {
      showToast('Failed to refresh inputs', 'error');
    } finally {
      setRefreshingInputs(false);
    }
  }

  async function handleSaveInputs(formData: DigitalAssetFormData) {
    setSavingInputs(true);
    try {
      await persistFormData(formData);
      setLastFormData(formData);
      showToast('Digital presence inputs saved to client record', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save inputs', 'error');
    } finally {
      setSavingInputs(false);
    }
  }

  async function persistReport(nextReport: DigitalPresenceReport | null, runMeta?: { aiProvider: string; aiModel: string }) {
    const res = await fetch(`/api/client-data/${clientId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: 'digitalPresence',
        data: nextReport
          ? {
              ...nextReport,
              ...(runMeta ? { aiProvider: runMeta.aiProvider, aiModel: runMeta.aiModel } : {}),
            }
          : null,
      }),
    });
    if (!res.ok) {
      const message = await res.text().catch(() => '');
      throw new Error(message || 'Digital Presence report save failed.');
    }
  }

  async function persistFormData(formData: DigitalAssetFormData) {
    const res = await fetch(`/api/client-data/${clientId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'digitalPresenceForm', data: formData }),
    });
    if (!res.ok) {
      const message = await res.text().catch(() => '');
      throw new Error(message || 'Digital Presence form save failed.');
    }
  }

  function appendLog(entry: Omit<LogEntry, 'id'>) {
    setLog((prev) => [...prev, { ...entry, id: ++_logId }]);
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  function applyOverridesToReport(baseReport: DigitalPresenceReport, overrides: ManualOverride[]): DigitalPresenceReport {
    if (overrides.length === 0) return baseReport;
    return {
      ...baseReport,
      channels: baseReport.channels.map((ch) => {
        const channelOverrides = overrides.filter((o) => o.channelType === ch.channelType);
        if (channelOverrides.length === 0) return ch;
        const updatedMetrics = [...ch.keyMetrics];
        let nextSummary = ch.summary;

        for (const override of channelOverrides) {
          // Sentinel: metricIndex === -1 means "channel.summary".
          if (override.metricIndex === -1) {
            nextSummary = override.value;
            continue;
          }

          if (override.metricIndex >= 0 && override.metricIndex < updatedMetrics.length) {
            updatedMetrics[override.metricIndex] = { ...updatedMetrics[override.metricIndex], value: override.value };
          }
        }

        return { ...ch, summary: nextSummary, keyMetrics: updatedMetrics };
      }),
    };
  }

  function handleEdit(channelType: string, metricIndex: number, value: string) {
    setManualOverrides((prev) => {
      const filtered = prev.filter((o) => !(o.channelType === channelType && o.metricIndex === metricIndex));
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
    setComposingNew(false);

    try {
      await persistFormData(formData);

      const res = await fetch('/api/digital-presence/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData,
          provider: DIGITAL_PRESENCE_PROVIDER,
          modelId: resolveAgentModelId(DIGITAL_PRESENCE_PROVIDER),
        }),
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
          try {
            event = JSON.parse(raw);
          } catch {
            continue;
          }

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
            const finalReport = applyOverridesToReport(event.report, manualOverrides);
            setReport(finalReport);
            setStatus('complete');
            try {
              const modelId = resolveAgentModelId(DIGITAL_PRESENCE_PROVIDER);
              await persistReport(finalReport, {
                aiProvider: DIGITAL_PRESENCE_PROVIDER,
                aiModel: modelId,
              });
              await saveAgentAnalysisRunClient({
                clientId,
                agentKey: AGENT_RUN_KEYS.digitalPresence,
                fileName: `${finalReport.businessName} — Digital Presence`,
                report: finalReport,
                aiProvider: DIGITAL_PRESENCE_PROVIDER,
                aiModel: modelId,
              });
              await reloadRuns({ selectNewest: true });
            } catch (saveError: any) {
              setError(
                saveError?.message ??
                  'Report saved but run history failed to record. Restart the dev server and re-run, or click Re-run Analysis.',
              );
            }
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

  function handleNewAnalysis() {
    setComposingNew(true);
    setStatus('idle');
    setError(null);
  }

  function handleCancelNewAnalysis() {
    setComposingNew(false);
    if (report) {
      setStatus('complete');
    }
  }

  function handleReset() {
    setStatus('idle');
    setReport(null);
    setError(null);
    setLog([]);
    setCurrentPhase(null);
    setResearchProgress(null);
    setComposingNew(false);
  }

  function handleRerun() {
    if (lastFormData) {
      void handleSubmit(lastFormData);
      return;
    }
    handleNewAnalysis();
  }

  async function handleDeleteReport() {
    setIsDeleting(true);
    try {
      await persistReport(null);
      setReport(null);
      setStatus('idle');
      setComposingNew(false);
      setDeleteModalOpen(false);
      showToast('Digital presence report deleted', 'success');
      await reloadRuns();
    } catch {
      showToast('Failed to delete report', 'error');
    } finally {
      setIsDeleting(false);
    }
  }

  function handleExportJSON(data: DigitalPresenceReport) {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `digital-presence-${data.businessName.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isLoading = status === 'researching' || status === 'analyzing';

  const readOnlyGate = agentTabReadOnlyGate(readOnly, !initialLoadDone, Boolean(report), 'Digital Presence');
  if (readOnlyGate) return readOnlyGate;

  const showStartingWorkspace = (status === 'idle' || composingNew) && !isLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
            Digital Presence &amp; Online Footprint
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Comprehensive audit of search visibility, online reputation, Google Business Profile, and social media footprint for{' '}
            <span className="font-medium text-slate-700">{clientName}</span>.
          </p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2 shrink-0">
            {report && !composingNew && (
              <>
                <ExportReportButton
                  html={buildDigitalPresenceReportHtml(report)}
                  fileName={`digital-presence-${(report.businessName || clientName).replace(/\s+/g, '-').toLowerCase()}`}
                  buttonClassName="border-slate-200 text-slate-600 hover:bg-slate-50 text-xs px-3 py-1.5 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => handleExportJSON(report)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export JSON
                </button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteModalOpen(true)}
                  className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-slate-200 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Delete
                </Button>
              </>
            )}
            {report && composingNew ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancelNewAnalysis}
                className="h-8 text-xs cursor-pointer border-slate-200 text-slate-600"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Cancel &amp; Return to Report
              </Button>
            ) : (
              <Button
                type="button"
                variant={report ? 'outline' : 'primary'}
                size="sm"
                onClick={handleNewAnalysis}
                className={cn('h-8 text-xs cursor-pointer', !report && 'bg-slate-900 text-white hover:bg-slate-800')}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                New Analysis
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Provider & Run History Toolbar */}
      {!readOnly && (
        <AgentRunToolbar
          showProvider={false}
          disabled={isLoading}
          historyItems={historyItems}
          activeId={activeId}
          onSelectRun={selectRun}
          activeProvider={activeRun?.aiProvider ?? DIGITAL_PRESENCE_PROVIDER}
          activeModel={activeRun?.aiModel}
          activeVersion={activeRun?.version}
        />
      )}

      {/* Status strip */}
      {(isLoading || (status === 'complete' && !composingNew)) && (
        <div
          className={cn(
            'flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-medium border',
            isLoading
              ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700',
          )}
        >
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                isLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500',
              )}
            />
            {status === 'researching' && 'Gathering multi-channel web data\u2026'}
            {status === 'analyzing' && 'Scoring & analysing online reputation\u2026'}
            {status === 'complete' && 'Digital presence analysis complete'}
          </div>
          {isLoading && researchProgress && (
            <span className="tabular-nums">
              {researchProgress.completed} / {researchProgress.total} channels
            </span>
          )}
        </div>
      )}

      {/* Starting Workspace Form */}
      {showStartingWorkspace && !readOnly && (
        <DigitalPresenceForm
          onSubmit={handleSubmit}
          loading={false}
          initialData={lastFormData ?? undefined}
          clientName={clientName}
          clientWebsite={clientWebsite}
          onSave={handleSaveInputs}
          saving={savingInputs}
          onRefresh={handleRefreshInputs}
          refreshing={refreshingInputs}
        />
      )}

      {/* Loading -> live log */}
      {isLoading && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-full border-2 border-amber-100 flex items-center justify-center">
                {currentPhase === 'research' ? (
                  <Wifi className="w-4 h-4 text-amber-500" />
                ) : (
                  <Search className="w-4 h-4 text-amber-500" />
                )}
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-amber-400 animate-spin" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                {currentPhase === 'research' ? 'Gathering Public Channel Data' : 'Running AI Scoring & Valuation Review'}
              </p>
              <p className="text-xs text-slate-400">
                {currentPhase === 'research'
                  ? 'Crawling across website, Google Maps, social media, and customer review platforms\u2026'
                  : 'Synthesizing channel scores, customer sentiment flags, and asset inventory\u2026'}
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
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                  Live Web Research Activity
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto px-3 py-2 space-y-1.5 font-mono">
                {log.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-2 text-xs">
                    <span
                      className={cn('flex-shrink-0 mt-0.5', {
                        'text-amber-500': entry.phase === 'research',
                        'text-blue-500': entry.phase === 'analyze',
                      })}
                    >
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
            This typically takes 60&ndash;120 seconds depending on total active channels.
          </p>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
            <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-rose-700">Digital Presence Analysis Failed</p>
              <p className="text-sm text-rose-600 mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="text-xs font-medium text-amber-600 hover:text-amber-700 hover:underline cursor-pointer"
          >
            &larr; Return to Form
          </button>
        </div>
      )}

      {/* Complete -> scorecard */}
      {status === 'complete' && report && !composingNew && (
        <DigitalPresenceScorecard
          report={report}
          onReset={handleReset}
          onRerun={handleRerun}
          onEdit={handleEdit}
          readOnly={readOnly}
          embedded={true}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        title="Delete Digital Presence Report?"
        description="This will permanently delete the current digital presence report from this client record. The underlying channels from the Client Portal will remain intact and you can re-run analysis at any time."
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteReport}
        confirmLabel="Delete Report"
        isDeleting={isDeleting}
      />

      {/* Toast Notification */}
      <StatusToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
