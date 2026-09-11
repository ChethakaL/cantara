'use client';
import type { AgentTabReadOnlyProps } from '@/types/agent-tab';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Download,
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  Plus,
  Search,
  Star,
  Store,
  Tag,
  Trash2,
  TrendingUp,
  Building2,
  RotateCw,
  Play,
  CheckCircle2,
  Save,
  Pencil,
  FileText,
} from 'lucide-react';
import { Badge, Button, Card, Input, Modal, Textarea, cn } from '@/components/ui';
import {
  AnalysisStatus,
  CompetitorAnalysisFormData,
  CompetitorAnalysisReport,
  CompetitorReportItem,
  DiscoveredCompetitorItem,
  ManualCompetitorEntry,
  PlaceLocation,
} from '@/lib/competitor-analysis/types';
import type { CompetitorAnalysis as SavedCompetitorAnalysis } from '@/lib/store';
import { deleteCompetitorAnalysis, getCompetitorAnalyses, saveCompetitorAnalysis, updateCompetitorAnalysis } from '@/lib/store';
import TopCompetitorsForm from '@/components/competitor-analysis/TopCompetitorsForm';
import { ExportReportButton } from '@/components/report-export/ExportReportButton';
import { buildCompetitorReportHtml } from '@/lib/report-export/build-competitor-report';
import { formatPetBusinessCategories } from '@/lib/pet-business-categories';
import { agentTabReadOnlyGate } from '@/hooks/useAgentTabReadOnly';
import { AdvisorActions } from '@/components/client-portal/AgentClientPortalFrame';
import { useAgentAiProvider } from '@/hooks/useAgentAiProvider';
import { AgentRunToolbar } from '@/components/admin/AgentRunToolbar';
import { AgentProviderBar } from '@/components/admin/AgentProviderBar';
import { AgentReportHistoryBar } from '@/components/admin/AgentReportHistoryBar';
import { resolveAgentModelId } from '@/lib/agent-model-provider';

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

interface Props extends AgentTabReadOnlyProps {
  clientId: string;
  businessName: string;
  businessAddress: string;
  businessCategory: string;
  websiteUrl: string;
}

function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 text-center space-y-3">
          <div className="mx-auto w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center font-bold text-lg">
            !
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-900">Delete Competitor Analysis Report?</h3>
            <p className="text-xs text-slate-500">
              This will permanently remove the competitor analysis report for this client. You will need to re-run the analysis to regenerate it.
            </p>
          </div>
        </div>
        <div className="flex border-t border-slate-100 p-3 gap-2 bg-slate-50/50 justify-end">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isDeleting} className="h-8 text-xs cursor-pointer">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={isDeleting}
            className="h-8 text-xs bg-rose-600 text-white hover:bg-rose-700 border-none cursor-pointer"
          >
            {isDeleting ? 'Deleting...' : 'Confirm Delete'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatusToast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-200',
        type === 'success'
          ? 'bg-emerald-950 text-emerald-100 border-emerald-800/60'
          : 'bg-rose-950 text-rose-100 border-rose-800/60',
      )}
    >
      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      <span>{message}</span>
    </div>
  );
}

let nextLogId = 0;
let googleMapsScriptPromise: Promise<void> | null = null;
const DEFAULT_PET_CATEGORY = 'pet resort';

function priceLevelLabel(level: number | null | undefined): string {
  return 'Not published';
}

function hasConcretePricePoints(pricePoints: string[]): boolean {
  return pricePoints.some((point) => /[$€£]\s*\d|\b\d+(?:\.\d{1,2})?\s*(?:usd|dollars?|aed|eur|gbp)\b|\bfrom\s*[$€£]?\s*\d/i.test(point));
}

function pricingStatusFromPoints(pricePoints: string[]): string {
  return hasConcretePricePoints(pricePoints) ? 'Published' : 'Not published';
}

function cleanSourceLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    if (/search/i.test(path) || parsed.search.includes('cgid=')) return 'Pricing search page';
    if (/dog|cat|food|treat|product|shop|collection|category/i.test(path)) return 'Pricing category page';
    return `${parsed.hostname.replace(/^www\./, '')}${path}`;
  } catch {
    return 'Pricing page';
  }
}

function formatNumber(value: number | null | undefined): string {
  if (typeof value !== 'number') return 'Not found';
  return new Intl.NumberFormat('en-US').format(value);
}

function formatDistance(value: number): string {
  return `${value.toFixed(2)} mi`;
}

function averageNumber(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === 'number');
  if (!valid.length) return null;
  return Number((valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(1));
}

function normalizeReport(report: CompetitorAnalysisReport): CompetitorAnalysisReport {
  const discoveredCompetitors = report.discoveredCompetitors?.length
    ? report.discoveredCompetitors
    : report.competitors.map((competitor) => ({
        placeId: competitor.placeId,
        name: competitor.name,
        address: competitor.address,
        location: competitor.location,
        rating: competitor.rating,
        reviewCount: competitor.reviewCount,
        priceLevel: competitor.priceLevel,
        websiteUrl: competitor.websiteUrl,
        mapsUrl: competitor.mapsUrl,
        phoneNumber: competitor.phoneNumber,
        businessStatus: competitor.businessStatus,
        openNow: competitor.openNow,
        weekdayText: competitor.weekdayText,
        primaryTypes: competitor.primaryTypes,
        distanceMiles: competitor.distanceMiles,
        isResearched: true,
      }));

  const researchedIds = new Set(report.competitors.map((competitor) => competitor.placeId).filter(Boolean));
  return {
    ...report,
    discoveredCompetitors: discoveredCompetitors.map((competitor) => ({
      ...competitor,
      isResearched: competitor.isResearched || researchedIds.has(competitor.placeId),
    })),
  };
}

function mergeResearchedCompetitor(report: CompetitorAnalysisReport, competitor: CompetitorReportItem): CompetitorAnalysisReport {
  const existingIndex = report.competitors.findIndex((item) => item.placeId === competitor.placeId);
  const competitors = existingIndex >= 0
    ? report.competitors.map((item, index) => index === existingIndex ? competitor : item)
    : [...report.competitors, competitor].sort((a, b) => a.distanceMiles - b.distanceMiles);

  const discoveredCompetitors = report.discoveredCompetitors.map((item) => (
    item.placeId === competitor.placeId
      ? {
          placeId: competitor.placeId,
          name: competitor.name,
          address: competitor.address,
          location: competitor.location,
          rating: competitor.rating,
          reviewCount: competitor.reviewCount,
          priceLevel: competitor.priceLevel,
          websiteUrl: competitor.websiteUrl,
          mapsUrl: competitor.mapsUrl,
          phoneNumber: competitor.phoneNumber,
          businessStatus: competitor.businessStatus,
          openNow: competitor.openNow,
          weekdayText: competitor.weekdayText,
          primaryTypes: competitor.primaryTypes,
          distanceMiles: competitor.distanceMiles,
          isResearched: true,
        }
      : item
  ));

  const closest = competitors[0] ?? null;
  return {
    ...report,
    discoveredCompetitors,
    competitors,
    marketStats: {
      ...report.marketStats,
      analyzedCompetitors: competitors.length,
      averageCompetitorRating: averageNumber(competitors.map((item) => item.rating)),
      averageCompetitorReviewCount: averageNumber(competitors.map((item) => item.reviewCount)),
      closestCompetitorName: closest?.name ?? null,
      closestCompetitorDistanceMiles: closest ? Number(closest.distanceMiles.toFixed(2)) : null,
      highSimilarityCount: competitors.filter((item) => item.similarityLevel === 'high').length,
      competitorsWithWebsite: competitors.filter((item) => Boolean(item.websiteUrl)).length,
      competitorsWithPriceSignals: competitors.filter((item) => item.pricePoints.length > 0).length,
    },
  };
}

function buildStaticMapUrl(report: CompetitorAnalysisReport): string {
  const points = report.discoveredCompetitors
    .slice(0, 80)
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

async function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return;
  if ((window as any).google?.maps) return;
  if (googleMapsScriptPromise) return googleMapsScriptPromise;

  googleMapsScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-google-maps-sdk="true"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps SDK.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsSdk = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps SDK.'));
    document.head.appendChild(script);
  });

  return googleMapsScriptPromise;
}

async function fetchBrowserGoogleMapsKey(): Promise<string> {
  const res = await fetch('/api/competitor-analysis/map-config');
  if (!res.ok) {
    throw new Error('Map configuration is unavailable.');
  }
  const data = await res.json();
  if (!data?.apiKey) {
    throw new Error('Google Maps key is unavailable for the browser map.');
  }
  return data.apiKey as string;
}

// Service vertical detection and color coding for heat map
const SERVICE_VERTICALS = [
  { key: 'boarding', label: 'Boarding', color: '#2563eb', patterns: /board|kennel|overnight|lodge|suite|stay/i },
  { key: 'daycare', label: 'Daycare', color: '#16a34a', patterns: /daycare|day\s*care|day\s*camp|play\s*group/i },
  { key: 'grooming', label: 'Grooming', color: '#d97706', patterns: /groom|bath|spa|salon|wash/i },
  { key: 'training', label: 'Training', color: '#9333ea', patterns: /train|obedien|class|behavior/i },
  { key: 'veterinary', label: 'Veterinary', color: '#dc2626', patterns: /vet|veterinar|animal\s*hospital|clinic/i },
  { key: 'other', label: 'Other', color: '#64748b', patterns: /./i },
] as const;

type ServiceVerticalKey = typeof SERVICE_VERTICALS[number]['key'];

function detectServiceVertical(competitor: DiscoveredCompetitorItem, researched?: CompetitorReportItem): ServiceVerticalKey {
  const searchText = [
    competitor.name,
    ...(competitor.primaryTypes ?? []),
    ...(researched?.services ?? []),
    researched?.serviceComparison ?? '',
  ].join(' ').toLowerCase();

  for (const vertical of SERVICE_VERTICALS) {
    if (vertical.key === 'other') continue;
    if (vertical.patterns.test(searchText)) return vertical.key;
  }
  return 'other';
}

function getVerticalColor(key: ServiceVerticalKey): string {
  return SERVICE_VERTICALS.find(v => v.key === key)?.color ?? '#64748b';
}

function getVerticalMarkerUrl(key: ServiceVerticalKey): string {
  const colorMap: Record<string, string> = {
    boarding: 'blue', daycare: 'green', grooming: 'orange',
    training: 'purple', veterinary: 'red', other: 'yellow',
  };
  return `https://maps.google.com/mapfiles/ms/icons/${colorMap[key] ?? 'yellow'}-dot.png`;
}

function CompetitorCoverageMap({ report }: { report: CompetitorAnalysisReport }) {
  const radiusMiles = report.radiusMiles || 5;
  const [hoveredId, setHoveredId] = useState<string>('subject');
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<ServiceVerticalKey>>(new Set(SERVICE_VERTICALS.map(v => v.key)));
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const subjectMarkerRef = useRef<any>(null);
  const competitorMarkersRef = useRef<Array<{ id: string; marker: any; vertical: ServiceVerticalKey }>>([]);
  const radiusCircleRef = useRef<any>(null);

  // Build points with service vertical info
  const points = useMemo(() => {
    const subjectPoint = {
      id: 'subject',
      label: 'S',
      name: report.clientProfile.name,
      distance: 0,
      rating: report.clientProfile.rating,
      reviewCount: report.clientProfile.reviewCount,
      similarityLabel: 'Subject business',
      location: report.clientProfile.location,
      vertical: 'boarding' as ServiceVerticalKey,
    };

    const competitorPoints = report.discoveredCompetitors.map((competitor, index) => {
      const researched = report.competitors.find((item) => item.placeId === competitor.placeId);
      const pointId = competitor.placeId ? `${competitor.placeId}-${index}` : `${index}`;
      const vertical = detectServiceVertical(competitor, researched);
      return {
        id: pointId,
        label: String(index + 1),
        name: competitor.name,
        distance: competitor.distanceMiles,
        rating: competitor.rating,
        reviewCount: competitor.reviewCount,
        similarityLabel: researched ? `${researched.similarityLevel} similarity` : 'Discovered competitor',
        location: competitor.location,
        vertical,
      };
    });

    return [subjectPoint, ...competitorPoints];
  }, [report.clientProfile.location, report.clientProfile.name, report.clientProfile.rating, report.clientProfile.reviewCount, report.competitors, report.discoveredCompetitors]);

  // Count competitors per vertical for the legend
  const verticalCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const point of points) {
      if (point.id === 'subject') continue;
      counts[point.vertical] = (counts[point.vertical] ?? 0) + 1;
    }
    return counts;
  }, [points]);

  const hoveredPoint = points.find((point) => point.id === hoveredId) ?? points[0];

  // Toggle service filter and show/hide markers
  function toggleFilter(key: ServiceVerticalKey) {
    setActiveFilters(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      // Show/hide markers based on filter
      competitorMarkersRef.current.forEach(({ marker, vertical }) => {
        marker.setVisible(next.has(vertical));
      });
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function setupMap() {
      if (!mapNodeRef.current) return;

      try {
        const apiKey = await fetchBrowserGoogleMapsKey();
        await loadGoogleMapsScript(apiKey);
        if (cancelled || !mapNodeRef.current) return;

        const googleMaps = (window as any).google.maps;
        const map = new googleMaps.Map(mapNodeRef.current, {
          center: report.searchCenter,
          zoom: 13,
          streetViewControl: false,
          mapTypeControl: true,
          fullscreenControl: true,
          gestureHandling: 'greedy',
          clickableIcons: true,
          styles: [],
        });

        mapInstanceRef.current = map;

        const bounds = new googleMaps.LatLngBounds();
        bounds.extend(report.clientProfile.location);

        const subjectMarker = new googleMaps.Marker({
          map,
          position: report.clientProfile.location,
          title: report.clientProfile.name,
          label: {
            text: 'S',
            color: '#ffffff',
            fontWeight: '700',
          },
          icon: {
            path: googleMaps.SymbolPath.CIRCLE,
            fillColor: '#1f2937',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 11,
          },
          zIndex: 1000,
        });
        subjectMarker.addListener('click', () => setHoveredId('subject'));
        subjectMarker.addListener('mouseover', () => setHoveredId('subject'));
        subjectMarkerRef.current = subjectMarker;

        const radiusCircle = new googleMaps.Circle({
          map,
          center: report.searchCenter,
          radius: radiusMiles * 1609.34,
          strokeColor: '#b8922a',
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: '#b8922a',
          fillOpacity: 0.06,
        });
        radiusCircleRef.current = radiusCircle;

        competitorMarkersRef.current = report.discoveredCompetitors.map((competitor, index) => {
          bounds.extend(competitor.location);
          const researched = report.competitors.find((item) => item.placeId === competitor.placeId);
          const vertical = detectServiceVertical(competitor, researched);

          const marker = new googleMaps.Marker({
            map,
            position: competitor.location,
            title: competitor.name,
            label: {
              text: String(index + 1),
              color: '#ffffff',
              fontWeight: '700',
            },
            icon: {
              url: getVerticalMarkerUrl(vertical),
              scaledSize: new googleMaps.Size(32, 32),
              labelOrigin: new googleMaps.Point(16, 11),
            },
          });

          const markerId = competitor.placeId ? `${competitor.placeId}-${index}` : `${index}`;
          marker.addListener('click', () => setHoveredId(markerId));
          marker.addListener('mouseover', () => setHoveredId(markerId));

          return {
            id: markerId,
            marker,
            vertical,
          };
        });

        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, 90);
        }

        setMapReady(true);
      } catch (error) {
        console.error('[Competitor Map] Failed to initialize browser map:', error);
        if (!cancelled) {
          setMapError(error instanceof Error ? error.message : 'Failed to initialize the interactive Google Map.');
        }
      }
    }

    void setupMap();

    return () => {
      cancelled = true;
      competitorMarkersRef.current.forEach(({ marker }) => marker.setMap(null));
      competitorMarkersRef.current = [];
      if (subjectMarkerRef.current) subjectMarkerRef.current.setMap(null);
      if (radiusCircleRef.current) radiusCircleRef.current.setMap(null);
      mapInstanceRef.current = null;
    };
  }, [radiusMiles, report]);

  function handleResetView() {
    if (!mapInstanceRef.current) return;
    const googleMaps = (window as any).google.maps;
    const bounds = new googleMaps.LatLngBounds();
    bounds.extend(report.clientProfile.location);
    report.discoveredCompetitors.forEach((competitor) => bounds.extend(competitor.location));
    mapInstanceRef.current.fitBounds(bounds, 90);
    setHoveredId('subject');
  }

  function focusPoint(pointId: string) {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (pointId === 'subject') {
      map.panTo(report.clientProfile.location);
      map.setZoom(Math.max(map.getZoom() ?? 13, 15));
      setHoveredId('subject');
      return;
    }

    const target = report.discoveredCompetitors.find((competitor, index) => (competitor.placeId ? `${competitor.placeId}-${index}` : `${index}`) === pointId);
    if (!target) return;
    map.panTo(target.location);
    map.setZoom(Math.max(map.getZoom() ?? 13, 15));
    setHoveredId(pointId);
  }

  return (
    <Card className="overflow-hidden">
      <div className="relative min-h-[620px] bg-slate-100">
        <div ref={mapNodeRef} className="absolute inset-0" />
        {!mapReady && (
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#eef2f7,#dbe4f0)] flex items-center justify-center">
            <div className="rounded-xl bg-white/90 px-4 py-3 text-sm text-slate-600 shadow-sm border border-white">
              Loading interactive Google Map…
            </div>
          </div>
        )}

        <div className="absolute left-5 top-5 z-10 rounded-xl bg-white/94 backdrop-blur px-4 py-3 border border-white shadow-sm max-w-[260px]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Competitor Heat Map</p>
          <p className="text-sm font-semibold text-slate-800 mt-1">{report.radiusMiles}-mile coverage radius</p>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Color-coded by service vertical. Click legend to filter.
          </p>
          {mapError && <p className="text-xs text-rose-600 mt-2">{mapError}</p>}

          {/* Service vertical legend / filter */}
          <div className="mt-3 space-y-1.5">
            {SERVICE_VERTICALS.filter(v => (verticalCounts[v.key] ?? 0) > 0 || v.key === 'boarding').map(vertical => (
              <button
                key={vertical.key}
                onClick={() => toggleFilter(vertical.key)}
                className={cn(
                  'flex items-center gap-2 w-full text-left px-2 py-1 rounded-lg text-xs transition-all',
                  activeFilters.has(vertical.key) ? 'bg-slate-50 text-slate-800' : 'bg-slate-100/50 text-slate-400 line-through'
                )}
              >
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: activeFilters.has(vertical.key) ? vertical.color : '#cbd5e1' }} />
                <span className="flex-1 font-medium">{vertical.label}</span>
                <span className="text-[10px] text-slate-400">{verticalCounts[vertical.key] ?? 0}</span>
              </button>
            ))}
            <div className="flex items-center gap-2 px-2 py-1 text-xs text-slate-400">
              <span className="w-3 h-3 rounded-full bg-slate-800 flex-shrink-0" />
              <span>Subject business</span>
            </div>
          </div>
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
            <div className="flex items-center gap-2">
              {hoveredPoint.id !== 'subject' && (
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getVerticalColor(hoveredPoint.vertical) }} />
              )}
              <span>{hoveredPoint.label === 'S' ? 'Subject business' : `Competitor ${hoveredPoint.label}`}</span>
            </div>
            <div>{hoveredPoint.label === 'S' ? 'Center point' : `${formatDistance(hoveredPoint.distance)} from subject`}</div>
            <div>Rating: {hoveredPoint.rating ?? 'Not found'} · Reviews: {formatNumber(hoveredPoint.reviewCount)}</div>
            <div className="capitalize">{hoveredPoint.similarityLabel}</div>
            {hoveredPoint.id !== 'subject' && (
              <div className="capitalize font-medium" style={{ color: getVerticalColor(hoveredPoint.vertical) }}>
                {SERVICE_VERTICALS.find(v => v.key === hoveredPoint.vertical)?.label ?? 'Other'}
              </div>
            )}
          </div>
        </div>

        <div className="absolute left-5 bottom-5 right-5 z-10 rounded-xl bg-white/94 backdrop-blur border border-white shadow-sm px-4 py-3 min-h-[92px] max-h-[132px]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500">Use the pills to focus a specific location on the map.</div>
            <button
              onClick={() => focusPoint('subject')}
              className="text-xs text-amber-700 hover:text-amber-800"
            >
              Focus subject store
            </button>
          </div>
          <div className="overflow-x-auto overflow-y-hidden pb-1">
            <div className="flex w-max gap-2">
            {points.filter(p => p.id === 'subject' || activeFilters.has(p.vertical)).map((point) => (
              <button
                key={`legend-${point.id}`}
                onMouseEnter={() => setHoveredId(point.id)}
                onFocus={() => setHoveredId(point.id)}
                onClick={() => focusPoint(point.id)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs transition-colors',
                  hoveredPoint.id === point.id
                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                )}
              >
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold"
                  style={{ backgroundColor: point.id === 'subject' ? '#1f2937' : getVerticalColor(point.vertical), color: '#ffffff' }}
                >
                  {point.label}
                </span>
                <span className="truncate max-w-[180px]">{point.name}</span>
              </button>
            ))}
            </div>
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
  const publishedPriceCount = profile.priceEvidence?.length ?? 0;
  const [showSubjectPriceModal, setShowSubjectPriceModal] = useState(false);
  return (
    <>
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
            {publishedPriceCount > 0 && (
              <div className="mt-3 flex items-center gap-3">
                <p className="text-sm text-slate-600">
                  {publishedPriceCount} public price point{publishedPriceCount === 1 ? '' : 's'} captured from website evidence.
                </p>
                <Button variant="outline" size="sm" onClick={() => setShowSubjectPriceModal(true)}>
                  View prices
                </Button>
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

      <Modal
        open={showSubjectPriceModal}
        onClose={() => setShowSubjectPriceModal(false)}
        title={`${profile.name} pricing evidence`}
        sizeClassName="max-w-2xl"
      >
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Pricing status</p>
            <p className="mt-2 text-sm text-slate-700">{pricingStatusFromPoints(profile.pricePoints)}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Pricing read</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{profile.pricingSummary}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Public price evidence</p>
            {profile.priceEvidence?.length > 0 ? (
              <div className="mt-3 space-y-2">
                {profile.priceEvidence.map((item, index) => (
                  <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {item.label}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                No public product price evidence is currently saved for this business.
              </p>
            )}
          </div>
          {profile.priceEvidence?.some((item) => item.url) && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Pricing pages</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.priceEvidence
                  .filter((item) => item.url)
                  .slice(0, 6)
                  .map((item, index) => (
                    <a
                      key={`${item.url}-${index}`}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-slate-300"
                    >
                      {item.pageTitle || cleanSourceLabel(item.url!)}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

function ComparisonTable({
  discoveredCompetitors,
  researchedCompetitors,
  onResearch,
  researchingPlaceId,
}: {
  discoveredCompetitors: DiscoveredCompetitorItem[];
  researchedCompetitors: CompetitorReportItem[];
  onResearch: (competitor: DiscoveredCompetitorItem) => void;
  researchingPlaceId: string | null;
}) {
  if (!discoveredCompetitors.length) return null;
  const PAGE_SIZE = 8;
  const [page, setPage] = useState(1);
  const researchedById = new Map(researchedCompetitors.map((competitor) => [competitor.placeId ?? '', competitor]));
  const totalPages = Math.max(1, Math.ceil(discoveredCompetitors.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleCompetitors = discoveredCompetitors.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Competitor Table</p>
        <p className="text-sm text-slate-500 mt-1">All discovered nearby matches. The closest six are researched by default, and the rest can be researched on demand.</p>
      </div>
      <div className="max-h-[720px] overflow-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-5 py-3 text-left font-semibold uppercase tracking-[0.16em] text-[10px]">Business</th>
              <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.16em] text-[10px]">Distance</th>
              <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.16em] text-[10px]">Similarity</th>
              <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.16em] text-[10px]">Google Rating</th>
              <th className="px-5 py-3 text-left font-semibold uppercase tracking-[0.16em] text-[10px]">Key Read</th>
              <th className="px-5 py-3 text-left font-semibold uppercase tracking-[0.16em] text-[10px]">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleCompetitors.map((competitor, index) => {
              const researched = researchedById.get(competitor.placeId ?? '');
              const absoluteIndex = startIndex + index;
              const rowPlaceId = competitor.placeId ?? `${competitor.name}-${absoluteIndex}`;
              return (
              <tr key={competitor.placeId ?? `${competitor.name}-${absoluteIndex}`} className="align-top">
                <td className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 text-xs font-semibold text-amber-700">
                      {absoluteIndex + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-800">{competitor.name}</p>
                      <p className="text-xs text-slate-400 mt-1">{competitor.address}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-slate-700">{formatDistance(competitor.distanceMiles)}</td>
                <td className="px-4 py-4">
                  {researched ? (
                    <span className="text-sm text-slate-700">{researched.similarityScore}/5</span>
                  ) : (
                    <span className="text-xs text-slate-400">Pending research</span>
                  )}
                </td>
                <td className="px-4 py-4 text-slate-700">
                  {competitor.rating ?? 'Not found'}
                  <span className="block text-xs text-slate-400 mt-1">{formatNumber(competitor.reviewCount)} reviews</span>
                </td>
                <td className="px-5 py-4 text-slate-600 leading-relaxed">{researched?.similaritySummary ?? '-'}</td>
                <td className="px-5 py-4">
                  {researched ? (
                    <Badge color="blue">Researched</Badge>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => onResearch(competitor)}
                      disabled={researchingPlaceId === rowPlaceId}
                    >
                      {researchingPlaceId === rowPlaceId ? 'Researching…' : 'Research'}
                    </Button>
                  )}
                </td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 border-t border-slate-100 px-5 py-3">
          <p className="text-xs text-slate-500">
            Showing {startIndex + 1}-{Math.min(startIndex + PAGE_SIZE, discoveredCompetitors.length)} of {discoveredCompetitors.length} competitors
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-xs text-slate-500">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
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
          </div>
        </div>
        <Badge color={competitor.similarityLevel === 'high' ? 'red' : competitor.similarityLevel === 'medium' ? 'gold' : 'blue'}>
          {competitor.similarityLevel} similarity
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
  onResearch,
  researchingPlaceId,
  isEditingSummaries,
  setIsEditingSummaries,
  draftExecutiveSummary,
  setDraftExecutiveSummary,
  draftMarketSummary,
  setDraftMarketSummary,
  draftPositioningSummary,
  setDraftPositioningSummary,
  savingSummaries,
  handleSaveSummaries,
  handleStartEditingSummaries,
  readOnly = false,
}: {
  report: CompetitorAnalysisReport;
  onDelete: () => void;
  deleting: boolean;
  onResearch: (competitor: DiscoveredCompetitorItem) => void;
  researchingPlaceId: string | null;
  isEditingSummaries: boolean;
  setIsEditingSummaries: (v: boolean) => void;
  draftExecutiveSummary: string;
  setDraftExecutiveSummary: (v: string) => void;
  draftMarketSummary: string;
  setDraftMarketSummary: (v: string) => void;
  draftPositioningSummary: string;
  setDraftPositioningSummary: (v: string) => void;
  savingSummaries: boolean;
  handleSaveSummaries: () => void;
  handleStartEditingSummaries: () => void;
  readOnly?: boolean;
}) {
  const [serviceEditMode, setServiceEditMode] = useState(false);
  // Build initial service overrides from report data
  const buildInitialOverrides = () => {
    const overrides: Record<string, Record<string, boolean>> = {};
    const serviceOrder = ['dog boarding', 'dog daycare', 'dog grooming', 'dog training', 'cat boarding'];
    // subject
    overrides['__subject__'] = {};
    serviceOrder.forEach(service => {
      overrides['__subject__'][service] = report.clientProfile.services.some(s => s.toLowerCase() === service);
    });
    // competitors
    report.competitors.slice(0, 5).forEach((comp) => {
      const key = comp.placeId ?? comp.name;
      overrides[key] = {};
      serviceOrder.forEach(service => {
        overrides[key][service] = comp.services.some(s => s.toLowerCase() === service);
      });
    });
    return overrides;
  };
  const [serviceOverrides, setServiceOverrides] = useState<Record<string, Record<string, boolean>>>(buildInitialOverrides);

  function toggleServiceOverride(entityKey: string, service: string) {
    setServiceOverrides(prev => ({
      ...prev,
      [entityKey]: {
        ...prev[entityKey],
        [service]: !(prev[entityKey]?.[service] ?? false),
      },
    }));
  }

  function getServiceCheck(entityKey: string, service: string, fallback: boolean): boolean {
    if (serviceOverrides[entityKey] && service in serviceOverrides[entityKey]) {
      return serviceOverrides[entityKey][service];
    }
    return fallback;
  }

  return (
    <div className="space-y-6">

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
        {isEditingSummaries ? (
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 mb-2">Executive Summary</label>
              <Textarea
                className="w-full text-sm leading-6"
                rows={5}
                value={draftExecutiveSummary}
                onChange={(e) => setDraftExecutiveSummary(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 mb-2">Market Summary</label>
              <Textarea
                className="w-full text-sm leading-6"
                rows={5}
                value={draftMarketSummary}
                onChange={(e) => setDraftMarketSummary(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 mb-2">Positioning Summary</label>
              <Textarea
                className="w-full text-sm leading-6"
                rows={5}
                value={draftPositioningSummary}
                onChange={(e) => setDraftPositioningSummary(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}
      </Card>

      {/* Subject Business section removed — displayed in other sections */}

      {/* Google Review Comparison Chart */}
      {report.competitors.length > 0 && (
        <Card className="p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Google Review Comparison</p>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'linear-gradient(90deg, #b8922a, #d4a843)' }} />
                Gold = your business
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                Red = rating ≥ yours
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Green = rating below yours
              </span>
            </div>
          </div>
          <div className="space-y-3">
            {/* Subject business */}
            <div className="flex items-center gap-3">
              <div className="w-36 text-xs font-medium text-slate-700 truncate flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                {report.clientProfile.name}
              </div>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden relative">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${((report.clientProfile.rating ?? 0) / 5) * 100}%`,
                      background: 'linear-gradient(90deg, #b8922a, #d4a843)',
                    }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-700 w-12 text-right tabular-nums">
                  {report.clientProfile.rating?.toFixed(1) ?? 'N/A'}
                </span>
                <span className="text-xs text-slate-400 w-20 text-right tabular-nums">
                  {formatNumber(report.clientProfile.reviewCount)} reviews
                </span>
              </div>
            </div>
            {/* Competitors */}
            {report.competitors.map((comp, i) => (
              <div key={comp.placeId ?? i} className="flex items-center gap-3">
                <div className="w-36 text-xs text-slate-600 truncate flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500 flex-shrink-0">{i + 1}</span>
                  {comp.name}
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${((comp.rating ?? 0) / 5) * 100}%`,
                        background: comp.rating !== null && comp.rating >= (report.clientProfile.rating ?? 0) ? '#f43f5e' : '#10b981',
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 w-12 text-right tabular-nums">
                    {comp.rating?.toFixed(1) ?? 'N/A'}
                  </span>
                  <span className="text-xs text-slate-400 w-20 text-right tabular-nums">
                    {formatNumber(comp.reviewCount)} reviews
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Service Offerings Comparison */}
      {report.competitors.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Service Offerings Comparison</p>
            {!readOnly && (
            <button
              onClick={() => setServiceEditMode(m => !m)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors',
                serviceEditMode
                  ? 'border-amber-300 bg-amber-50 text-amber-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              {serviceEditMode ? '✓ Done' : '✎ Edit'}
            </button>
            )}
          </div>
          {serviceEditMode && !readOnly && (
            <div className="px-5 py-2 bg-amber-50/50 border-b border-amber-100 text-xs text-amber-700">
              Click any cell to toggle the checkmark on or off.
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sticky left-0 bg-slate-50 z-10">Service</th>
                  <th className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-600 min-w-[100px]">
                    {report.clientProfile.name.length > 15 ? report.clientProfile.name.slice(0, 15) + '…' : report.clientProfile.name}
                  </th>
                  {report.competitors.slice(0, 5).map((comp, i) => (
                    <th key={comp.placeId ?? i} className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 min-w-[100px]">
                      {comp.name.length > 15 ? comp.name.slice(0, 15) + '…' : comp.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const serviceOrder = ['dog boarding', 'dog daycare', 'dog grooming', 'dog training', 'cat boarding'];

                  return serviceOrder.map(service => (
                    <tr key={service} className="border-b border-slate-50">
                      <td className="px-4 py-2.5 text-xs font-medium text-slate-700 capitalize sticky left-0 bg-white z-10">{service}</td>
                      <td
                        className={cn("px-3 py-2.5 text-center", serviceEditMode && "cursor-pointer hover:bg-amber-50/50")}
                        onClick={serviceEditMode ? () => toggleServiceOverride('__subject__', service) : undefined}
                      >
                        {getServiceCheck('__subject__', service, report.clientProfile.services.some(s => s.toLowerCase() === service))
                          ? <span className="text-emerald-500 font-bold">&#10003;</span>
                          : <span className="text-slate-200">—</span>
                        }
                      </td>
                      {report.competitors.slice(0, 5).map((comp, i) => {
                        const compKey = comp.placeId ?? comp.name;
                        return (
                          <td
                            key={comp.placeId ?? i}
                            className={cn("px-3 py-2.5 text-center", serviceEditMode && "cursor-pointer hover:bg-amber-50/50")}
                            onClick={serviceEditMode ? () => toggleServiceOverride(compKey, service) : undefined}
                          >
                            {getServiceCheck(compKey, service, comp.services.some(s => s.toLowerCase() === service))
                              ? <span className="text-emerald-500 font-bold">&#10003;</span>
                              : <span className="text-slate-200">—</span>
                            }
                          </td>
                        );
                      })}
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ComparisonTable
        discoveredCompetitors={report.discoveredCompetitors}
        researchedCompetitors={report.competitors}
        onResearch={onResearch}
        researchingPlaceId={researchingPlaceId}
      />

      {report.competitors.length > 0 && (
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Competitor Profiles</p>
            <p className="text-sm text-slate-500 mt-1">Detailed readout for each nearby competitor that was analyzed.</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Similarity badges: red = high (direct substitute), gold = medium, blue = low.
            </p>
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
  readOnly = false,
}: Props) {
  const emptyCompetitor = (): ManualCompetitorEntry => ({ name: '', address: '', websiteUrl: '' });
  const [form, setForm] = useState<CompetitorAnalysisFormData>({
    businessName,
    businessAddress,
    businessCategory: businessCategory?.trim() || DEFAULT_PET_CATEGORY,
    websiteUrl,
    radiusMiles: 5,
    manualCompetitors: [emptyCompetitor()],
  });
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [report, setReport] = useState<CompetitorAnalysisReport | null>(null);
  const [savedAnalysis, setSavedAnalysis] = useState<SavedCompetitorAnalysis | null>(null);
  const [savedAnalyses, setSavedAnalyses] = useState<SavedCompetitorAnalysis[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [savingInputs, setSavingInputs] = useState(false);
  const [inputsSaved, setInputsSaved] = useState(false);
  const [refreshingInputs, setRefreshingInputs] = useState(false);
  const [researchingPlaceId, setResearchingPlaceId] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [currentPhase, setCurrentPhase] = useState<'research' | 'analyze' | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const { provider, setProvider } = useAgentAiProvider();

  const [isEditingSummaries, setIsEditingSummaries] = useState(false);
  const [draftExecutiveSummary, setDraftExecutiveSummary] = useState('');
  const [draftMarketSummary, setDraftMarketSummary] = useState('');
  const [draftPositioningSummary, setDraftPositioningSummary] = useState('');
  const [savingSummaries, setSavingSummaries] = useState(false);

  const updateCompetitor = (index: number, field: keyof ManualCompetitorEntry, value: string) => {
    const list = [...(form.manualCompetitors ?? [emptyCompetitor()])];
    list[index] = { ...list[index], [field]: value };
    setForm(current => ({ ...current, manualCompetitors: list }));
  };

  const addCompetitor = () => {
    const list = [...(form.manualCompetitors ?? [])];
    if (list.length >= 5) return;
    setForm(current => ({ ...current, manualCompetitors: [...list, emptyCompetitor()] }));
  };

  const removeCompetitor = (index: number) => {
    const list = [...(form.manualCompetitors ?? [])];
    if (list.length <= 1) {
      setForm(current => ({ ...current, manualCompetitors: [emptyCompetitor()] }));
      return;
    }
    setForm(current => ({ ...current, manualCompetitors: list.filter((_, i) => i !== index) }));
  };

  const handleRefreshInputs = async () => {
    setRefreshingInputs(true);
    try {
      const pricingInputsRes = await fetch(`/api/client-data/${clientId}?section=competitorPricingInputs`);
      let portalCompetitors: ManualCompetitorEntry[] = [];
      let portalSellerUrl = '';
      let portalAddress = '';

      if (pricingInputsRes.ok) {
        const pricingInputs = await pricingInputsRes.json();
        if (pricingInputs?.sellerWebsiteUrl) portalSellerUrl = pricingInputs.sellerWebsiteUrl;
        if (pricingInputs?.businessAddress) portalAddress = pricingInputs.businessAddress;
        if (Array.isArray(pricingInputs?.competitors)) {
          portalCompetitors = pricingInputs.competitors
            .filter((c: any) => c.name || c.websiteUrl || c.address)
            .map((c: any): ManualCompetitorEntry => ({
              name: c.name?.trim() || '',
              address: c.address?.trim() || '',
              websiteUrl: c.websiteUrl?.trim() || '',
            }));
        }
      }

      if (portalCompetitors.length === 0) {
        const formRes = await fetch(`/api/client-data/${clientId}?section=agentFormResponses`);
        if (formRes.ok) {
          const savedInputs = await formRes.json();
          if (savedInputs) {
            if (!portalSellerUrl && savedInputs.businessWebsite) portalSellerUrl = savedInputs.businessWebsite;
            if (!portalAddress && savedInputs.businessAddress) portalAddress = savedInputs.businessAddress;
            for (let i = 1; i <= 5; i++) {
              const name = savedInputs[`competitor${i}Name`]?.trim();
              const address = savedInputs[`competitor${i}Address`]?.trim();
              const websiteUrl = savedInputs[`competitor${i}Website`]?.trim();
              if (name || websiteUrl) {
                portalCompetitors.push({ name: name || '', address: address || '', websiteUrl: websiteUrl || '' });
              }
            }
          }
        }
      }

      setForm((current) => ({
        ...current,
        businessName: businessName || current.businessName,
        businessAddress: portalAddress || businessAddress || current.businessAddress,
        businessCategory: businessCategory || current.businessCategory,
        websiteUrl: portalSellerUrl || websiteUrl || current.websiteUrl,
        manualCompetitors: portalCompetitors.length > 0 ? portalCompetitors.slice(0, 5) : (current.manualCompetitors ?? [emptyCompetitor()]),
      }));

      setToast({ message: 'Refreshed inputs from Client Portal & Client Management', type: 'success' });
    } catch {
      setToast({ message: 'Failed to refresh inputs', type: 'error' });
    } finally {
      setRefreshingInputs(false);
    }
  };

  const handleSaveInputs = async () => {
    setSavingInputs(true);
    setInputsSaved(false);
    try {
      const res = await fetch(`/api/client-data/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'competitorAnalysisForm',
          data: {
            ...form,
            updatedAt: new Date().toISOString(),
          },
        }),
      });
      if (!res.ok) throw new Error('Save failed');

      const validCompetitors = (form.manualCompetitors ?? []).filter(c => c.name.trim() || c.websiteUrl?.trim());
      await fetch(`/api/client-data/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'competitorPricingInputs',
          data: {
            sellerWebsiteUrl: form.websiteUrl?.trim() || '',
            businessAddress: form.businessAddress?.trim() || '',
            competitors: validCompetitors.map(c => ({
              name: c.name.trim(),
              websiteUrl: c.websiteUrl?.trim() || '',
              address: c.address?.trim() || '',
            })),
            updatedAt: new Date().toISOString(),
          },
        }),
      });

      setInputsSaved(true);
      setToast({ message: 'Competitor inputs saved successfully', type: 'success' });
      setTimeout(() => setInputsSaved(false), 2000);
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to save inputs', type: 'error' });
    } finally {
      setSavingInputs(false);
    }
  };

  const handleSaveSummaries = async () => {
    if (!report || !savedAnalysis) return;
    setSavingSummaries(true);
    try {
      const nextReport: CompetitorAnalysisReport = {
        ...report,
        executiveSummary: draftExecutiveSummary,
        marketSummary: draftMarketSummary,
        positioningSummary: draftPositioningSummary,
      };

      const updated = await updateCompetitorAnalysis(savedAnalysis.id, {
        report: JSON.stringify(nextReport),
        parsed: nextReport,
      });

      if (updated) {
        setReport(nextReport);
        setSavedAnalysis(updated);
        setIsEditingSummaries(false);
      } else {
        throw new Error('Failed to update competitor analysis in database.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save edits.');
    } finally {
      setSavingSummaries(false);
    }
  };

  const handleStartEditingSummaries = () => {
    if (!report) return;
    setDraftExecutiveSummary(report.executiveSummary || '');
    setDraftMarketSummary(report.marketSummary || '');
    setDraftPositioningSummary(report.positioningSummary || '');
    setIsEditingSummaries(true);
  };

  useEffect(() => {
    setForm((current) => ({
      ...current,
      businessName,
      businessAddress,
      businessCategory: businessCategory?.trim() || DEFAULT_PET_CATEGORY,
      websiteUrl,
    }));
  }, [businessAddress, businessCategory, businessName, websiteUrl]);

  useEffect(() => {
    let cancelled = false;

    async function loadSavedReport() {
      setInitializing(true);
      try {
        // Load full saved form inputs first (includes addresses, radius, categories)
        const savedFormRes = await fetch(`/api/client-data/${clientId}?section=competitorAnalysisForm`);
        if (savedFormRes.ok) {
          const savedForm = await savedFormRes.json();
          if (!cancelled && savedForm && typeof savedForm === 'object') {
            setForm((current) => ({
              ...current,
              ...savedForm,
              businessName: savedForm.businessName || current.businessName,
              businessAddress: savedForm.businessAddress || current.businessAddress,
              businessCategory: savedForm.businessCategory || current.businessCategory,
            }));
          }
        } else {
          const formRes = await fetch(`/api/client-data/${clientId}?section=agentFormResponses`);
          if (formRes.ok) {
            const savedInputs = await formRes.json();
            if (!cancelled && savedInputs) {
              setForm((current) => ({
                ...current,
                websiteUrl: savedInputs.businessWebsite || current.websiteUrl,
                businessAddress: savedInputs.businessAddress || current.businessAddress,
                businessCategory: savedInputs.businessCategory || current.businessCategory,
                manualCompetitors: (Array.from({ length: 5 }, (_, index): ManualCompetitorEntry => ({
                  name: savedInputs[`competitor${index + 1}Name`] || '',
                  address: savedInputs[`competitor${index + 1}Address`] || '',
                  websiteUrl: savedInputs[`competitor${index + 1}Website`] || '',
                })).filter(item => item.name || item.websiteUrl) as ManualCompetitorEntry[])
                  .concat(current.manualCompetitors ?? [])
                  .slice(0, 5),
              }));
            }
          }
        }

        const pricingInputsRes = await fetch(`/api/client-data/${clientId}?section=competitorPricingInputs`);
        if (pricingInputsRes.ok) {
          const pricingInputs = await pricingInputsRes.json();
          if (!cancelled && pricingInputs?.competitors?.length) {
            setForm((current) => {
              const fromClientPortal = (pricingInputs.competitors as Array<{
                name?: string
                websiteUrl?: string
                address?: string
              }>)
                .map((competitor): ManualCompetitorEntry => ({
                  name: competitor.name?.trim() || '',
                  address: competitor.address?.trim() || '',
                  websiteUrl: competitor.websiteUrl?.trim() || '',
                }))
                .filter(item => item.name || item.websiteUrl || item.address)
                .slice(0, 5)
              if (!fromClientPortal.length) return current
              const existing = current.manualCompetitors ?? []
              const merged: ManualCompetitorEntry[] = fromClientPortal.map((entry) => {
                const match = existing.find(item =>
                  item.name.trim().toLowerCase() === entry.name.trim().toLowerCase()
                  || (item.websiteUrl && entry.websiteUrl && item.websiteUrl === entry.websiteUrl),
                )
                return {
                  name: entry.name || match?.name || '',
                  websiteUrl: entry.websiteUrl || match?.websiteUrl || '',
                  // Prefer Required Info / pricing-input address; keep any richer address already on the form.
                  address: entry.address || match?.address || '',
                }
              })
              for (const entry of existing) {
                if (merged.length >= 5) break
                if (!merged.some(item =>
                  item.name.toLowerCase() === entry.name.toLowerCase()
                  && item.websiteUrl === entry.websiteUrl
                )) {
                  merged.push(entry)
                }
              }
              return {
                ...current,
                websiteUrl: current.websiteUrl || pricingInputs.sellerWebsiteUrl || '',
                businessAddress: current.businessAddress || pricingInputs.businessAddress || '',
                manualCompetitors: merged.slice(0, 5),
              }
            })
          }
        }
        const analyses = await getCompetitorAnalyses(clientId);
        if (cancelled) return;
        setSavedAnalyses(analyses);
        const latest = analyses[0] ?? null;
        setSavedAnalysis(latest);
        if (latest?.parsed) {
          setReport(normalizeReport(latest.parsed as CompetitorAnalysisReport));
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

    if (!form.businessName?.trim() || !form.businessAddress?.trim()) {
      setError('Business name and address are required before the analysis can run.');
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
            radiusMiles: form.radiusMiles ?? 5,
          },
          provider,
          modelId: resolveAgentModelId(provider),
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
            const normalizedReport = normalizeReport(eventPayload.report);
            setReport(normalizedReport);
            setSaving(true);
            try {
              const saved = await saveCompetitorAnalysis({
                clientId,
                fileName: `${form.businessName} Competitor Analysis`,
                report: JSON.stringify(normalizedReport),
                parsed: normalizedReport,
                aiProvider: provider,
                aiModel: resolveAgentModelId(provider),
              });
              setSavedAnalysis(saved ?? null);
              setSavedAnalyses((current) => [saved, ...current.filter((item) => item?.id !== saved?.id)].filter(Boolean) as SavedCompetitorAnalysis[]);
              // Persist form inputs so they reload next session
              await fetch(`/api/client-data/${clientId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ section: 'competitorAnalysisForm', data: form }),
              }).catch(() => {});
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
      setSavedAnalyses(prev => prev.filter(a => a.id !== savedAnalysis.id));
      handleReset();
      setDeleteModalOpen(false);
      setToast({ message: 'Competitor analysis report deleted', type: 'success' });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete the saved competitor report.');
      setToast({ message: 'Failed to delete report', type: 'error' });
    } finally {
      setDeleting(false);
    }
  }

  async function handleResearchCompetitor(competitor: DiscoveredCompetitorItem) {
    if (!report || !savedAnalysis?.id) return;
    const rowPlaceId = competitor.placeId ?? competitor.name;
    setResearchingPlaceId(rowPlaceId);
    setError(null);

    try {
      const res = await fetch('/api/competitor-analysis/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData: {
            businessName: report.businessName,
            businessAddress: report.businessAddress,
            businessCategory: report.businessCategory,
            websiteUrl: report.clientProfile.websiteUrl ?? form.websiteUrl ?? undefined,
            radiusMiles: report.radiusMiles,
            manualCompetitors: form.manualCompetitors ?? [],
          },
          subject: report.clientProfile,
          competitor,
          provider,
          modelId: resolveAgentModelId(provider),
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || 'Failed to research competitor');
      }

      const data = await res.json();
      const nextReport = mergeResearchedCompetitor(report, data.competitor as CompetitorReportItem);
      setReport(nextReport);
      const updated = await updateCompetitorAnalysis(savedAnalysis.id, {
        report: JSON.stringify(nextReport),
        parsed: nextReport,
      });
      setSavedAnalysis(updated ?? savedAnalysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to research competitor.');
    } finally {
      setResearchingPlaceId(null);
    }
  }

  const isLoading = status === 'researching' || status === 'analyzing';

  if (initializing) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
          <p className="text-xs text-slate-400">Loading competitor analysis…</p>
        </div>
      </div>
    );
  }

  const readOnlyGate = agentTabReadOnlyGate(readOnly, initializing, Boolean(report), 'Competitor Analysis');
  if (readOnlyGate) return readOnlyGate;

  const validCompetitors = (form.manualCompetitors ?? []).filter(c => c.name.trim() || c.websiteUrl?.trim());
  const validCompetitorCount = validCompetitors.length;
  const hasAddress = Boolean(form.businessAddress.trim());
  const canRun = Boolean(form.businessName.trim() && hasAddress);

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
            Competitor Analysis
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {report
              ? `${report.businessName} — Local market comparison & positioning — Generated ${new Date(report.generatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
              : `Local market radius discovery, ratings, and competitive positioning for ${form.businessName || businessName}`}
          </p>
        </div>

        <AdvisorActions className="flex items-center gap-2 shrink-0 flex-wrap">
          {status === 'complete' && report && (
            <>
              {!readOnly && (
                isEditingSummaries ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setIsEditingSummaries(false)} disabled={savingSummaries} className="h-8 text-xs cursor-pointer">
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveSummaries} disabled={savingSummaries} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">
                      {savingSummaries ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={handleStartEditingSummaries} className="h-8 text-xs cursor-pointer">
                    <Pencil className="w-3.5 h-3.5 mr-1" />
                    Edit Report
                  </Button>
                )
              )}
              <ExportReportButton
                html={buildCompetitorReportHtml(report)}
                fileName={`competitor-analysis-${(report.businessName || businessName).replace(/\s+/g, '-').toLowerCase()}`}
                label="Export Competitor Report"
              />
              {!readOnly && (
                <>
                  <Button variant="outline" size="sm" onClick={handleReset} className="h-8 text-xs cursor-pointer">
                    + New Analysis
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteModalOpen(true)}
                    className="h-8 text-xs text-rose-600 hover:text-rose-700 border-rose-200 hover:bg-rose-50 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Delete
                  </Button>
                </>
              )}
            </>
          )}
        </AdvisorActions>
      </div>

      {/* Top AgentRunToolbar */}
      {!readOnly && (
        <AgentRunToolbar
          provider={provider}
          onProviderChange={setProvider}
          disabled={isLoading}
          historyItems={savedAnalyses.map((analysis, index) => ({
            id: analysis.id,
            version: savedAnalyses.length - index,
            createdAt: analysis.createdAt,
            aiProvider: (analysis as any).aiProvider,
            aiModel: (analysis as any).aiModel,
          }))}
          activeId={savedAnalysis?.id}
          onSelectRun={(run) => {
            const selected = savedAnalyses.find((analysis) => analysis.id === run.id);
            if (!selected) return;
            setSavedAnalysis(selected);
            if (selected.parsed) {
              setReport(normalizeReport(selected.parsed as CompetitorAnalysisReport));
              setStatus('complete');
            }
          }}
          activeProvider={(savedAnalysis as any)?.aiProvider}
          activeModel={(savedAnalysis as any)?.aiModel}
          activeVersion={
            savedAnalysis?.id
              ? savedAnalyses.length - savedAnalyses.findIndex((a) => a.id === savedAnalysis.id)
              : undefined
          }
        />
      )}

      {/* Error State */}
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

      {/* Running State */}
      {isLoading && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-12 shadow-2xs text-center space-y-6">
            <div className="w-12 h-12 border-3 border-amber-200 border-t-amber-600 rounded-full animate-spin mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-slate-900">
                {currentPhase === 'research' ? 'Gathering local market signals…' : 'Synthesizing competitor comparison report…'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {currentPhase === 'research'
                  ? `Checking nearby businesses, public listing details, and live website evidence within ${form.radiusMiles ?? 5} miles.`
                  : 'Comparing services, customer ratings, pricing signals, and market positioning.'}
              </p>
            </div>
          </div>

          {log.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Live Activity</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">{log.length} events logged</span>
              </div>
              <div className="max-h-56 overflow-y-auto p-3 space-y-1.5 font-mono bg-slate-950 text-slate-200 rounded-b-xl text-xs">
                {log.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-2">
                    <span className={cn('flex-shrink-0 mt-0.5', entry.phase === 'research' ? 'text-amber-400' : 'text-blue-400')}>
                      {entry.phase === 'research' ? '◉' : '▶'}
                    </span>
                    <span className="text-slate-300 leading-snug">{entry.message}</span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Setup / Workspace State */}
      {status === 'idle' && !readOnly && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
            {/* Card Title Block */}
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Local Market &amp; Competitor Targets
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                No document upload required. Subject business details are synced directly from <strong>Client Management</strong>, and known competitor benchmarks are prefilled from the <strong>Required Information</strong> form submitted by the client in the Client Portal. You can verify, fine-tune, or add specific competitors below before running analysis.
              </p>
            </div>

            {/* Sector Header / Readiness Bar */}
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  LOCAL MARKET &amp; COMPETITOR TARGETS
                </h4>
                <span
                  className={cn(
                    'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                    validCompetitorCount > 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {validCompetitorCount > 0 ? `${validCompetitorCount} of 5 competitors configured` : 'Auto-discovery enabled'}
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  {form.radiusMiles ?? 5}-mile radius
                </span>
                <span
                  className={cn(
                    'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                    hasAddress
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200',
                  )}
                >
                  {hasAddress ? 'Location Configured' : 'Address Missing'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleRefreshInputs}
                disabled={refreshingInputs}
                className="text-[11px] text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCw className={cn('w-3 h-3', refreshingInputs && 'animate-spin')} />
                Refresh from Portal &amp; Profile
              </button>
            </div>

            {/* Information Banner */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                <Globe className="w-4 h-4" />
              </div>
              <div className="text-xs space-y-1">
                <div className="font-semibold text-slate-800">
                  Automated Local Market Discovery &amp; Benchmarking
                </div>
                <p className="text-slate-600 leading-relaxed">
                  The AI agent crawls Google Places, live competitor websites, and local directory listings within the specified radius.
                  Entering known competitors focuses the analysis on exact rivals; if left blank, the agent auto-discovers top competitors in the local market.
                </p>
              </div>
            </div>

            {/* Source Cards */}
            <div className="space-y-4">
              {/* Card 1: Subject Business Profile */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          Subject Business Profile
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          Client Management
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        Synced from client record — search location and category definition
                      </p>
                    </div>
                  </div>
                  {form.websiteUrl && (
                    <a
                      href={form.websiteUrl.startsWith('http') ? form.websiteUrl : `https://${form.websiteUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Visit
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                      Business Name *
                    </label>
                    <input
                      type="text"
                      value={form.businessName}
                      onChange={(e) => setField('businessName', e.target.value)}
                      placeholder="Business Name"
                      className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                      Website URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={form.websiteUrl ?? ''}
                      onChange={(e) => setField('websiteUrl', e.target.value)}
                      placeholder="https://example.com"
                      className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                    Business Address * (Required for radius search)
                  </label>
                  <textarea
                    value={form.businessAddress}
                    onChange={(e) => setField('businessAddress', e.target.value)}
                    rows={2}
                    placeholder="123 Main Street, Phoenix, AZ 85001"
                    className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                      Search Radius
                    </label>
                    <select
                      value={form.radiusMiles ?? 5}
                      onChange={(e) => setField('radiusMiles', Number(e.target.value))}
                      className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value={1}>1 mile</option>
                      <option value={2}>2 miles</option>
                      <option value={3}>3 miles</option>
                      <option value={5}>5 miles</option>
                      <option value={10}>10 miles</option>
                      <option value={15}>15 miles</option>
                      <option value={20}>20 miles</option>
                      <option value={25}>25 miles</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                      Business Categories
                    </label>
                    <div className="rounded-md border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-xs text-slate-700 flex items-center justify-between">
                      <span className="truncate">{formatPetBusinessCategories(form.businessCategory) || 'Default Category'}</span>
                      <span className="text-[10px] text-slate-400 shrink-0 ml-2">Synced from Client Profile</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Competitor Targets */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                      <Store className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          Known Competitor Targets
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          Up to 5
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Prefilled from Client Portal Required Info form and pricing targets
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">
                      {validCompetitorCount} / 5 configured
                    </span>
                    {(form.manualCompetitors ?? []).length < 5 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addCompetitor}
                        className="h-7 text-xs cursor-pointer"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Competitor
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5">
                  {(form.manualCompetitors ?? [emptyCompetitor()]).map((competitor, idx) => {
                    const isReady = Boolean(competitor.name.trim() || competitor.websiteUrl?.trim());
                    const formattedUrl = competitor.websiteUrl?.trim().startsWith('http')
                      ? competitor.websiteUrl.trim()
                      : `https://${competitor.websiteUrl?.trim()}`;

                    return (
                      <div
                        key={idx}
                        className={cn(
                          'p-3 rounded-lg border transition-all flex flex-col md:flex-row md:items-center gap-3',
                          isReady
                            ? 'border-slate-200 bg-slate-50/50'
                            : 'border-slate-200/80 bg-white',
                        )}
                      >
                        <div className="flex items-center gap-2.5 md:w-8 shrink-0">
                          <span
                            className={cn(
                              'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                              isReady
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-600',
                            )}
                          >
                            {idx + 1}
                          </span>
                        </div>

                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div>
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                              Business Name *
                            </label>
                            <input
                              type="text"
                              value={competitor.name}
                              onChange={(e) => updateCompetitor(idx, 'name', e.target.value)}
                              placeholder="e.g. Apex Pet Center"
                              className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                                Website URL
                              </label>
                              {competitor.websiteUrl?.trim() && (
                                <a
                                  href={formattedUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-slate-400 hover:text-slate-700 inline-flex items-center gap-0.5"
                                >
                                  <ExternalLink className="w-2.5 h-2.5" />
                                  Visit
                                </a>
                              )}
                            </div>
                            <input
                              type="url"
                              value={competitor.websiteUrl ?? ''}
                              onChange={(e) => updateCompetitor(idx, 'websiteUrl', e.target.value)}
                              placeholder="https://..."
                              className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                              Address (Optional)
                            </label>
                            <input
                              type="text"
                              value={competitor.address ?? ''}
                              onChange={(e) => updateCompetitor(idx, 'address', e.target.value)}
                              placeholder="Street, City, State"
                              className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-end md:justify-center shrink-0 w-8 gap-1">
                          {(form.manualCompetitors ?? []).length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeCompetitor(idx)}
                              className="text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                              title="Remove competitor"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-4 py-3 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Action Footer */}
            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2">
                {canRun ? (
                  <span className="text-xs text-emerald-700 font-medium inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Subject profile and {validCompetitorCount > 0 ? `${validCompetitorCount} competitor targets` : 'auto-discovery radius'} ready.
                  </span>
                ) : (
                  <span className="text-xs text-amber-700 font-medium inline-flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    {!form.businessName.trim()
                      ? 'Business name is required.'
                      : 'Business address is required to search local competitors within radius.'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSaveInputs}
                  disabled={savingInputs}
                  className="h-9 px-4 text-xs font-medium cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {savingInputs ? 'Saving...' : inputsSaved ? 'Saved' : 'Save Inputs'}
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  disabled={isLoading || !canRun}
                  className={cn(
                    'h-9 px-5 text-xs font-semibold cursor-pointer border-none shadow-xs transition-all',
                    canRun && !isLoading
                      ? 'bg-slate-900 text-white hover:bg-slate-800'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed',
                  )}
                >
                  {isLoading ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Analyzing Competitors...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
                      Run Competitor Analysis
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Completed Report State */}
      {status === 'complete' && report && (
        <ReportView
          report={report}
          onDelete={() => setDeleteModalOpen(true)}
          deleting={deleting || saving}
          onResearch={handleResearchCompetitor}
          researchingPlaceId={researchingPlaceId}
          isEditingSummaries={isEditingSummaries}
          setIsEditingSummaries={setIsEditingSummaries}
          draftExecutiveSummary={draftExecutiveSummary}
          setDraftExecutiveSummary={setDraftExecutiveSummary}
          draftMarketSummary={draftMarketSummary}
          setDraftMarketSummary={setDraftMarketSummary}
          draftPositioningSummary={draftPositioningSummary}
          setDraftPositioningSummary={setDraftPositioningSummary}
          savingSummaries={savingSummaries}
          handleSaveSummaries={handleSaveSummaries}
          handleStartEditingSummaries={handleStartEditingSummaries}
          readOnly={readOnly}
        />
      )}

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteSavedReport}
        isDeleting={deleting}
      />
      {toast && (
        <StatusToast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
