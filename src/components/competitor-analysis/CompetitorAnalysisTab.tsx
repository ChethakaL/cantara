'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Download,
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  Search,
  Star,
  Store,
  Tag,
  TrendingUp,
} from 'lucide-react';
import { Badge, Button, Card, Input, Textarea, cn } from '@/components/ui';
import {
  AnalysisStatus,
  CompetitorAnalysisFormData,
  CompetitorAnalysisReport,
  CompetitorReportItem,
  PlaceLocation,
} from '@/lib/competitor-analysis/types';
import type { CompetitorAnalysis as SavedCompetitorAnalysis } from '@/lib/store';
import { deleteCompetitorAnalysis, getCompetitorAnalyses, saveCompetitorAnalysis } from '@/lib/store';

interface ProgressEvent {
  type: 'progress';
  phase: 'research' | 'analyze';
  message: string;
}

interface LogEntry {
  id: number;
  phase: 'research' | 'analyze';
  message: string;
}

interface Props {
  clientId: string;
  businessName: string;
  businessAddress: string;
  businessCategory: string;
  websiteUrl: string;
}

let nextLogId = 0;

function priceLevelLabel(level: number | null | undefined): string {
  if (!level || level < 1) return 'Not published';
  return '$'.repeat(Math.min(4, level));
}

function formatNumber(value: number | null | undefined): string {
  if (typeof value !== 'number') return 'Not found';
  return new Intl.NumberFormat('en-US').format(value);
}

function formatDistance(value: number): string {
  return `${value.toFixed(2)} mi`;
}

function buildStaticMapUrl(report: CompetitorAnalysisReport): string {
  const points = report.competitors
    .slice(0, 8)
    .map((competitor, index) => `${competitor.location.lat},${competitor.location.lng},${index + 1}`)
    .join(';');

  const params = new URLSearchParams({
    center: `${report.searchCenter.lat},${report.searchCenter.lng}`,
    subject: `${report.clientProfile.location.lat},${report.clientProfile.location.lng}`,
    radius: String(report.radiusMiles),
    points,
  });

  return `/api/competitor-analysis/static-map?${params.toString()}`;
}

function projectPoint(point: PlaceLocation, center: PlaceLocation, radiusMiles: number) {
  const milesPerLat = 69;
  const milesPerLng = 69 * Math.cos((center.lat * Math.PI) / 180);
  const dxMiles = (point.lng - center.lng) * milesPerLng;
  const dyMiles = (point.lat - center.lat) * milesPerLat;
  const scale = 68 / (radiusMiles * 2);
  return {
    x: 50 + dxMiles * scale,
    y: 50 - dyMiles * scale,
  };
}

function CompetitorCoverageMap({ report }: { report: CompetitorAnalysisReport }) {
  const radiusMiles = report.radiusMiles || 5;
  const [hoveredId, setHoveredId] = useState<string>('subject');
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [mapReady, setMapReady] = useState(false);
  const dragState = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const mapUrl = useMemo(() => buildStaticMapUrl(report), [report]);

  const points = useMemo(() => {
    const subjectPoint = {
      id: 'subject',
      label: 'S',
      name: report.clientProfile.name,
      distance: 0,
      rating: report.clientProfile.rating,
      reviewCount: report.clientProfile.reviewCount,
      similarityLabel: 'Subject business',
      color: '#1f2937',
      textColor: '#ffffff',
      ...projectPoint(report.clientProfile.location, report.searchCenter, radiusMiles),
    };

    const competitorPoints = report.competitors.map((competitor, index) => ({
      id: competitor.placeId ?? `${index}`,
      label: String(index + 1),
      name: competitor.name,
      distance: competitor.distanceMiles,
      rating: competitor.rating,
      reviewCount: competitor.reviewCount,
      similarityLabel: `${competitor.similarityLevel} similarity`,
      color: competitor.similarityLevel === 'high' ? '#b45309' : competitor.similarityLevel === 'medium' ? '#b8922a' : '#2563eb',
      textColor: '#ffffff',
      ...projectPoint(competitor.location, report.searchCenter, radiusMiles),
    }));

    return [subjectPoint, ...competitorPoints];
  }, [radiusMiles, report.clientProfile.location, report.clientProfile.name, report.clientProfile.rating, report.clientProfile.reviewCount, report.competitors, report.searchCenter]);

  const hoveredPoint = points.find((point) => point.id === hoveredId) ?? points[0];

  function clampZoom(value: number) {
    return Math.max(1, Math.min(2.8, value));
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    setZoom((current) => clampZoom(current + (event.deltaY < 0 ? 0.14 : -0.14)));
  }

  function handleMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    dragState.current = {
      x: event.clientX - offset.x,
      y: event.clientY - offset.y,
      active: true,
    };
  }

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (!dragState.current?.active) return;
    setOffset({
      x: event.clientX - dragState.current.x,
      y: event.clientY - dragState.current.y,
    });
  }

  function handleMouseUp() {
    if (dragState.current) {
      dragState.current.active = false;
    }
  }

  function handleResetView() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  return (
    <Card className="overflow-hidden">
      <div className="relative min-h-[620px] bg-slate-100">
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: '50% 50%',
          }}
        >
          <img
            src={mapUrl}
            alt={`Market map for ${report.businessName}`}
            className={cn(
              'absolute inset-0 h-full w-full object-cover transition-opacity duration-300',
              mapReady ? 'opacity-100' : 'opacity-0'
            )}
            onLoad={() => setMapReady(true)}
          />
          {!mapReady && (
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#eef2f7,#dbe4f0)]" />
          )}
        </div>

        <div className="absolute left-5 top-5 z-10 rounded-xl bg-white/94 backdrop-blur px-4 py-3 border border-white shadow-sm max-w-[240px]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Interactive Market Map</p>
          <p className="text-sm font-semibold text-slate-800 mt-1">{report.radiusMiles}-mile coverage radius</p>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Drag to pan, scroll to zoom, and hover any marker to inspect the business.
          </p>
        </div>

        <div className="absolute right-5 top-5 z-10 rounded-xl bg-white/94 backdrop-blur px-4 py-3 border border-white shadow-sm min-w-[240px] max-w-[280px]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Hovered Marker</p>
            <button onClick={handleResetView} className="text-xs text-amber-700 hover:text-amber-800">
              Reset view
            </button>
          </div>
          <p className="text-sm font-semibold text-slate-800 mt-2">{hoveredPoint.name}</p>
          <div className="mt-2 space-y-1 text-xs text-slate-500">
            <div>{hoveredPoint.label === 'S' ? 'Subject business' : `Competitor ${hoveredPoint.label}`}</div>
            <div>{hoveredPoint.label === 'S' ? 'Center point' : `${formatDistance(hoveredPoint.distance)} from subject`}</div>
            <div>Rating: {hoveredPoint.rating ?? 'Not found'} · Reviews: {formatNumber(hoveredPoint.reviewCount)}</div>
            <div className="capitalize">{hoveredPoint.similarityLabel}</div>
          </div>
        </div>

        <div
          className="absolute inset-0 cursor-grab active:cursor-grabbing select-none"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full"
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: '50% 50%' }}
          >
            <defs>
              <filter id="markerShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="0.8" stdDeviation="1.2" floodColor="#0f172a" floodOpacity="0.28" />
              </filter>
            </defs>
            <circle cx="50" cy="50" r="40" fill="rgba(184,146,42,0.06)" stroke="#b8922a" strokeWidth="0.55" strokeDasharray="1.5 1.7" />

            {points.map((point) => {
              const isHovered = hoveredPoint.id === point.id;
              return (
                <g
                  key={point.id}
                  onMouseEnter={() => setHoveredId(point.id)}
                  className="cursor-pointer"
                  filter="url(#markerShadow)"
                >
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={isHovered ? 4.5 : point.label === 'S' ? 4.1 : 3.55}
                    fill={point.color}
                    stroke="#ffffff"
                    strokeWidth={isHovered ? 0.95 : 0.75}
                  />
                  <text
                    x={point.x}
                    y={point.y + 0.85}
                    textAnchor="middle"
                    fontSize={point.label === 'S' ? 3.4 : 3}
                    fill={point.textColor}
                    fontWeight="700"
                  >
                    {point.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="absolute left-5 bottom-5 right-5 z-10 rounded-xl bg-white/94 backdrop-blur border border-white shadow-sm px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {points.map((point) => (
              <button
                key={`legend-${point.id}`}
                onMouseEnter={() => setHoveredId(point.id)}
                onFocus={() => setHoveredId(point.id)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs transition-colors',
                  hoveredPoint.id === point.id
                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                )}
              >
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold"
                  style={{ backgroundColor: point.color, color: point.textColor }}
                >
                  {point.label}
                </span>
                <span className="truncate max-w-[180px]">{point.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card className="p-4">
      <p className="text-xl font-bold text-slate-800">{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 mt-2">{label}</p>
      <p className="text-xs text-slate-400 mt-1">{note}</p>
    </Card>
  );
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <div className="mt-3 space-y-2">
        {items.map((item, index) => (
          <div key={`${title}-${index}`} className="flex items-start gap-3 text-sm text-slate-700">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ProfileCard({ report }: { report: CompetitorAnalysisReport }) {
  const profile = report.clientProfile;
  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Subject Business</p>
          <h3 className="text-lg font-semibold text-slate-900 mt-1">{profile.name}</h3>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <MapPin className="w-4 h-4" />
            <span>{profile.address}</span>
          </div>
        </div>
        <Badge color="gold">{report.businessCategory}</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Rating</p>
          <p className="text-sm font-semibold text-slate-800 mt-1">{profile.rating ?? 'Not found'}</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Reviews</p>
          <p className="text-sm font-semibold text-slate-800 mt-1">{formatNumber(profile.reviewCount)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Price Level</p>
          <p className="text-sm font-semibold text-slate-800 mt-1">{priceLevelLabel(profile.priceLevel)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Hours</p>
          <p className="text-sm font-semibold text-slate-800 mt-1">
            {profile.openNow === null ? 'Not found' : profile.openNow ? 'Open now' : 'Closed now'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Service Profile</p>
          <p className="text-sm text-slate-700 leading-relaxed mt-2">{profile.serviceSummary}</p>
          {profile.services.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.services.map((service, index) => (
                <span key={index} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                  {service}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Pricing</p>
            <p className="text-sm text-slate-700 leading-relaxed mt-2">{profile.pricingSummary}</p>
            {profile.pricePoints.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {profile.pricePoints.map((point, index) => (
                  <div key={index} className="text-sm text-slate-600">{point}</div>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Hours & Reputation</p>
            <p className="text-sm text-slate-700 leading-relaxed mt-2">{profile.hoursSummary}</p>
            <p className="text-sm text-slate-600 leading-relaxed mt-2">{profile.reputationSummary}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ComparisonTable({ competitors }: { competitors: CompetitorReportItem[] }) {
  if (!competitors.length) return null;
  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Competitor Table</p>
        <p className="text-sm text-slate-500 mt-1">Closest and strongest nearby matches within the local radius.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-5 py-3 text-left font-semibold uppercase tracking-[0.16em] text-[10px]">Business</th>
              <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.16em] text-[10px]">Distance</th>
              <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.16em] text-[10px]">Similarity</th>
              <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.16em] text-[10px]">Rating</th>
              <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.16em] text-[10px]">Price</th>
              <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.16em] text-[10px]">Hours</th>
              <th className="px-5 py-3 text-left font-semibold uppercase tracking-[0.16em] text-[10px]">Key Read</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {competitors.map((competitor, index) => (
              <tr key={competitor.placeId ?? `${competitor.name}-${index}`} className="align-top">
                <td className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 text-xs font-semibold text-amber-700">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-800">{competitor.name}</p>
                      <p className="text-xs text-slate-400 mt-1">{competitor.address}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-slate-700">{formatDistance(competitor.distanceMiles)}</td>
                <td className="px-4 py-4">
                  <Badge color={competitor.similarityLevel === 'high' ? 'red' : competitor.similarityLevel === 'medium' ? 'gold' : 'blue'}>
                    {competitor.similarityLevel} · {competitor.similarityScore}/5
                  </Badge>
                </td>
                <td className="px-4 py-4 text-slate-700">
                  {competitor.rating ?? 'Not found'}
                  <span className="block text-xs text-slate-400 mt-1">{formatNumber(competitor.reviewCount)} reviews</span>
                </td>
                <td className="px-4 py-4 text-slate-700">{priceLevelLabel(competitor.priceLevel)}</td>
                <td className="px-4 py-4 text-slate-700">
                  {competitor.openNow === null ? 'Not found' : competitor.openNow ? 'Open now' : 'Closed now'}
                </td>
                <td className="px-5 py-4 text-slate-600 leading-relaxed">{competitor.similaritySummary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function CompetitorCard({ competitor, index }: { competitor: CompetitorReportItem; index: number }) {
  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-sm font-semibold text-amber-700">
              {index + 1}
            </span>
            <h3 className="text-lg font-semibold text-slate-900">{competitor.name}</h3>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {competitor.address}</span>
            <span className="inline-flex items-center gap-1.5"><Store className="w-4 h-4" /> {formatDistance(competitor.distanceMiles)}</span>
            <span className="inline-flex items-center gap-1.5"><Star className="w-4 h-4" /> {competitor.rating ?? 'Not found'}</span>
            <span className="inline-flex items-center gap-1.5"><Tag className="w-4 h-4" /> {priceLevelLabel(competitor.priceLevel)}</span>
          </div>
        </div>
        <Badge color={competitor.similarityLevel === 'high' ? 'red' : competitor.similarityLevel === 'medium' ? 'gold' : 'blue'}>
          {competitor.similarityLevel} similarity
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Competitive Read</p>
            <p className="text-sm text-slate-700 leading-relaxed mt-2">{competitor.similaritySummary}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Services</p>
            <p className="text-sm text-slate-700 leading-relaxed mt-2">{competitor.serviceComparison}</p>
            {competitor.services.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {competitor.services.map((service, serviceIndex) => (
                  <span key={serviceIndex} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                    {service}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Pricing</p>
            <p className="text-sm text-slate-700 leading-relaxed mt-2">{competitor.pricingComparison}</p>
            {competitor.pricePoints.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {competitor.pricePoints.map((point, pointIndex) => (
                  <div key={pointIndex} className="text-sm text-slate-600">{point}</div>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Hours & Reputation</p>
            <p className="text-sm text-slate-700 leading-relaxed mt-2">{competitor.hoursComparison}</p>
            <p className="text-sm text-slate-600 leading-relaxed mt-2">{competitor.reputationComparison}</p>
          </div>
        </div>
      </div>

      {(competitor.strengths.length > 0 || competitor.gaps.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SummaryList title="Observed Strengths" items={competitor.strengths} />
          <SummaryList title="Observed Gaps" items={competitor.gaps} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        {competitor.websiteUrl && (
          <a
            href={competitor.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-800"
          >
            <Globe className="w-4 h-4" />
            Website
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        {competitor.mapsUrl && (
          <a
            href={competitor.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800"
          >
            <MapPin className="w-4 h-4" />
            Map listing
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        <span className="text-xs text-slate-400">Website evidence confidence: {competitor.websiteConfidence}</span>
      </div>
    </Card>
  );
}

function handleExportJson(report: CompetitorAnalysisReport) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `competitor-analysis-${report.businessName.replace(/\s+/g, '-').toLowerCase()}-${new Date(report.generatedAt).toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ReportView({
  report,
  onDelete,
  deleting,
}: {
  report: CompetitorAnalysisReport;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{report.businessName}</h2>
          <p className="text-sm text-slate-500 mt-1">
            Competitor Analysis Agent · Generated {new Date(report.generatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => handleExportJson(report)}>
            <Download className="w-4 h-4" />
            Export JSON
          </Button>
          <Button variant="danger" onClick={onDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete Report'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Nearby Competitors"
          value={String(report.marketStats.discoveredCompetitors)}
          note={`${report.marketStats.analyzedCompetitors} reviewed in depth`}
        />
        <StatCard
          label="Average Rating"
          value={report.marketStats.averageCompetitorRating?.toFixed(1) ?? 'N/A'}
          note="Average public rating across nearby competitors"
        />
        <StatCard
          label="Closest Match"
          value={report.marketStats.closestCompetitorDistanceMiles !== null ? `${report.marketStats.closestCompetitorDistanceMiles.toFixed(2)} mi` : 'N/A'}
          note={report.marketStats.closestCompetitorName ?? 'No nearby competitor found'}
        />
        <StatCard
          label="Direct Substitutes"
          value={String(report.marketStats.highSimilarityCount)}
          note="High-similarity competitors in the radius"
        />
      </div>

      <CompetitorCoverageMap report={report} />

      <Card className="p-5 space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Executive Summary</p>
            <p className="text-sm text-slate-700 leading-7 mt-3">{report.executiveSummary}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Market Summary</p>
            <p className="text-sm text-slate-700 leading-7 mt-3">{report.marketSummary}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Positioning Summary</p>
            <p className="text-sm text-slate-700 leading-7 mt-3">{report.positioningSummary}</p>
          </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SummaryList title="Key Takeaways" items={report.keyTakeaways} />
        <SummaryList title="Recommended Actions" items={report.recommendations} />
      </div>

      <ProfileCard report={report} />
      <ComparisonTable competitors={report.competitors} />

      {report.competitors.length > 0 && (
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Competitor Profiles</p>
            <p className="text-sm text-slate-500 mt-1">Detailed readout for each nearby competitor that was analyzed.</p>
          </div>
          {report.competitors.map((competitor, index) => (
            <CompetitorCard key={competitor.placeId ?? `${competitor.name}-${index}`} competitor={competitor} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CompetitorAnalysisTab({
  clientId,
  businessName,
  businessAddress,
  businessCategory,
  websiteUrl,
}: Props) {
  const [form, setForm] = useState<CompetitorAnalysisFormData>({
    businessName,
    businessAddress,
    businessCategory,
    websiteUrl,
    radiusMiles: 5,
  });
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [report, setReport] = useState<CompetitorAnalysisReport | null>(null);
  const [savedAnalysis, setSavedAnalysis] = useState<SavedCompetitorAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [currentPhase, setCurrentPhase] = useState<'research' | 'analyze' | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      businessName,
      businessAddress,
      businessCategory,
      websiteUrl,
    }));
  }, [businessAddress, businessCategory, businessName, websiteUrl]);

  useEffect(() => {
    let cancelled = false;

    async function loadSavedReport() {
      setInitializing(true);
      try {
        const analyses = await getCompetitorAnalyses(clientId);
        if (cancelled) return;
        const latest = analyses[0] ?? null;
        setSavedAnalysis(latest);
        if (latest?.parsed) {
          setReport(latest.parsed as CompetitorAnalysisReport);
          setStatus('complete');
        } else {
          setReport(null);
          setStatus('idle');
        }
      } catch (error) {
        if (!cancelled) {
          setError(error instanceof Error ? error.message : 'Failed to load the saved competitor report.');
          setStatus('error');
        }
      } finally {
        if (!cancelled) {
          setInitializing(false);
        }
      }
    }

    void loadSavedReport();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  function appendLog(entry: Omit<LogEntry, 'id'>) {
    setLog((current) => [...current, { ...entry, id: ++nextLogId }]);
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  function setField<K extends keyof CompetitorAnalysisFormData>(key: K, value: CompetitorAnalysisFormData[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!form.businessName?.trim() || !form.businessAddress?.trim() || !form.businessCategory?.trim()) {
      setError('Business name, address, and category are required before the analysis can run.');
      setStatus('error');
      return;
    }

    setStatus('researching');
    setReport(null);
    setError(null);
    setLog([]);
    setCurrentPhase('research');

    try {
      const res = await fetch('/api/competitor-analysis/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData: {
            ...form,
            radiusMiles: 5,
          },
        }),
      });

      if (!res.ok || !res.body) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.error ?? `Request failed (${res.status})`);
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

          let eventPayload: ProgressEvent | { type: 'complete'; report: CompetitorAnalysisReport } | { type: 'error'; error: string };
          try {
            eventPayload = JSON.parse(raw);
          } catch {
            continue;
          }

          if (eventPayload.type === 'progress') {
            setCurrentPhase(eventPayload.phase);
            setStatus(eventPayload.phase === 'research' ? 'researching' : 'analyzing');
            appendLog({ phase: eventPayload.phase, message: eventPayload.message });
          } else if (eventPayload.type === 'complete') {
            setReport(eventPayload.report);
            setSaving(true);
            try {
              const saved = await saveCompetitorAnalysis({
                clientId,
                fileName: `${form.businessName} Competitor Analysis`,
                report: JSON.stringify(eventPayload.report),
                parsed: eventPayload.report,
              });
              setSavedAnalysis(saved ?? null);
              setStatus('complete');
            } finally {
              setSaving(false);
            }
          } else if (eventPayload.type === 'error') {
            throw new Error(eventPayload.error ?? 'The competitor analysis failed.');
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The competitor analysis failed.');
      setStatus('error');
    }
  }

  function handleReset() {
    setStatus('idle');
    setReport(null);
    setError(null);
    setLog([]);
    setCurrentPhase(null);
  }

  async function handleDeleteSavedReport() {
    if (!savedAnalysis?.id) return;
    setDeleting(true);
    try {
      await deleteCompetitorAnalysis(savedAnalysis.id);
      setSavedAnalysis(null);
      handleReset();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete the saved competitor report.');
      setStatus('error');
    } finally {
      setDeleting(false);
    }
  }

  const isLoading = status === 'researching' || status === 'analyzing';

  if (initializing) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
          Loading saved competitor analysis…
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {(isLoading || status === 'complete') && (
        <div className={cn(
          'flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-medium border',
          isLoading
            ? 'bg-amber-50 border-amber-200 text-amber-700'
            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        )}>
          <div className="flex items-center gap-2">
            <div className={cn('w-1.5 h-1.5 rounded-full', isLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500')} />
            {status === 'researching' && 'Collecting local market and website evidence…'}
            {status === 'analyzing' && 'Building the competitor report…'}
            {status === 'complete' && `${report?.marketStats.discoveredCompetitors ?? 0} nearby competitors found`}
          </div>
          {status === 'complete' && (
            <span className="tabular-nums">{report?.businessCategory}</span>
          )}
        </div>
      )}

      {status === 'idle' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Competitor Analysis Agent</p>
                <h2 className="text-lg font-semibold text-slate-900 mt-1">Local Market Comparison</h2>
                <p className="text-sm text-slate-500 mt-2 max-w-3xl">
                  Searches for comparable businesses within a 5-mile radius, reviews public business listings and websites, and generates a professional report covering services, pricing visibility, ratings, and hours overlap.
                </p>
              </div>
              <Badge color="gold">5-mile radius</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Business name"
                value={form.businessName}
                onChange={(event) => setField('businessName', event.target.value)}
                placeholder="Happy Paws Veterinary Clinic"
              />
              <Input
                label="Business category"
                value={form.businessCategory}
                onChange={(event) => setField('businessCategory', event.target.value)}
                placeholder="Veterinary clinic"
              />
            </div>

            <Textarea
              label="Business address"
              value={form.businessAddress}
              onChange={(event) => setField('businessAddress', event.target.value)}
              rows={3}
              placeholder="123 Main St, Seattle, WA 98101"
            />

            <Input
              label="Website URL"
              value={form.websiteUrl ?? ''}
              onChange={(event) => setField('websiteUrl', event.target.value)}
              placeholder="https://www.example.com"
            />

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-amber-500 mt-0.5" />
                <div className="text-sm text-slate-600 leading-relaxed">
                  Save the same address, category, and website in <span className="font-semibold text-slate-700">Client Management</span> so this agent opens prefilled for the client every time.
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" size="lg" className="w-full justify-center gap-3" disabled={saving}>
                <Search className="w-4 h-4" />
                Run Competitor Analysis
              </Button>
            </div>
          </Card>
        </form>
      )}

      {isLoading && (
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-full border-2 border-amber-100 flex items-center justify-center">
                  {currentPhase === 'research'
                    ? <MapPin className="w-4 h-4 text-amber-500" />
                    : <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                  }
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-amber-400 animate-spin" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  {currentPhase === 'research' ? 'Gathering local market signals' : 'Synthesizing the comparison report'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {currentPhase === 'research'
                    ? 'Checking nearby businesses, public listing details, and website evidence.'
                    : 'Comparing services, pricing visibility, ratings, and operating-hour overlap.'}
                </p>
              </div>
            </div>
          </Card>

          {log.length > 0 && (
            <div className="rounded-xl border border-slate-100 bg-slate-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Live Activity</span>
              </div>
              <div className="max-h-56 overflow-y-auto px-3 py-2 space-y-1.5 font-mono">
                {log.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-2 text-xs">
                    <span className={cn('flex-shrink-0 mt-0.5', entry.phase === 'research' ? 'text-amber-500' : 'text-blue-500')}>
                      {entry.phase === 'research' ? '◉' : '▶'}
                    </span>
                    <span className="text-slate-600 leading-snug">{entry.message}</span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          )}
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
            <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-rose-700">Analysis Failed</p>
              <p className="text-sm text-rose-600 mt-1">{error}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleReset}>
            Try Again
          </Button>
        </div>
      )}

      {status === 'complete' && report && (
        <ReportView report={report} onDelete={handleDeleteSavedReport} deleting={deleting || saving} />
      )}
    </div>
  );
}
