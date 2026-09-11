'use client';

import { useState, useEffect } from 'react';
import {
  Globe,
  Building2,
  MapPin,
  Facebook,
  Instagram,
  Music2,
  CalendarCheck,
  Star,
  Briefcase,
  ShieldCheck,
  ExternalLink,
  Save,
  RotateCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button, cn } from '@/components/ui';
import { DigitalAssetFormData } from '@/lib/digital-presence/types';

interface Props {
  onSubmit: (data: DigitalAssetFormData) => void;
  loading: boolean;
  initialData?: Partial<DigitalAssetFormData>;
  clientName?: string;
  clientWebsite?: string;
  onSave?: (data: DigitalAssetFormData) => Promise<void> | void;
  saving?: boolean;
  onRefresh?: () => Promise<void> | void;
  refreshing?: boolean;
}

const EMPTY_FORM: DigitalAssetFormData = {
  businessName: '',
  websiteUrl: '',
  googleBusinessProfileUrl: '',
  googleBusinessLocations: '',
  facebookHandle: '',
  instagramHandle: '',
  tiktokHandle: '',
  bookingPlatformUrl: '',
  yelpUrl: '',
  nextdoorUrl: '',
  linkedinUrl: '',
  glassdoorUrl: '',
  bbbUrl: '',
};

function formatExternalUrl(url?: string): string | null {
  if (!url || !url.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.includes('.') && !trimmed.startsWith('@')) return `https://${trimmed}`;
  return null;
}

function formatSocialUrl(value?: string, platform?: 'facebook' | 'instagram' | 'tiktok'): string | null {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  const clean = trimmed.replace(/^@/, '');
  if (!clean) return null;
  if (platform === 'facebook') return `https://www.facebook.com/${clean}`;
  if (platform === 'instagram') return `https://www.instagram.com/${clean}`;
  if (platform === 'tiktok') return `https://www.tiktok.com/@${clean}`;
  return `https://${trimmed}`;
}

export default function DigitalPresenceForm({
  onSubmit,
  loading,
  initialData,
  clientName,
  clientWebsite,
  onSave,
  saving = false,
  onRefresh,
  refreshing = false,
}: Props) {
  const [form, setForm] = useState<DigitalAssetFormData>(() => ({
    ...EMPTY_FORM,
    businessName: initialData?.businessName || clientName || '',
    websiteUrl: initialData?.websiteUrl || clientWebsite || '',
    ...initialData,
  }));

  const [errors, setErrors] = useState<Partial<Record<keyof DigitalAssetFormData, string>>>({});

  // Sync external prefill updates (e.g. when loaded asynchronously or after refresh)
  useEffect(() => {
    if (!initialData) return;
    setForm((prev) => ({
      ...EMPTY_FORM,
      ...initialData,
      businessName: initialData.businessName || prev.businessName || clientName || '',
      websiteUrl: initialData.websiteUrl || prev.websiteUrl || clientWebsite || '',
    }));
  }, [initialData, clientName, clientWebsite]);

  function set(key: keyof DigitalAssetFormData, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  // Count active channels
  const channelValues = [
    form.websiteUrl,
    form.googleBusinessProfileUrl,
    form.facebookHandle,
    form.instagramHandle,
    form.tiktokHandle,
    form.bookingPlatformUrl,
    form.yelpUrl,
    form.nextdoorUrl,
    form.linkedinUrl,
    form.glassdoorUrl,
    form.bbbUrl,
  ];
  const configuredChannels = channelValues.filter((val) => Boolean(val && val.trim())).length;
  const hasWebsite = Boolean(form.websiteUrl && form.websiteUrl.trim());
  const hasGoogleProfile = Boolean(form.googleBusinessProfileUrl && form.googleBusinessProfileUrl.trim());
  const canRun = Boolean(form.businessName.trim() && configuredChannels > 0);

  function validate(): boolean {
    const newErrors: typeof errors = {};
    if (!form.businessName.trim()) {
      newErrors.businessName = 'Business / client name is required';
    }
    if (configuredChannels === 0) {
      newErrors.websiteUrl = 'Please provide at least one channel URL or handle';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit(form);
  }

  const websiteVisitUrl = formatExternalUrl(form.websiteUrl);
  const googleMapsVisitUrl = formatExternalUrl(form.googleBusinessProfileUrl);
  const facebookVisitUrl = formatSocialUrl(form.facebookHandle, 'facebook');
  const instagramVisitUrl = formatSocialUrl(form.instagramHandle, 'instagram');
  const tiktokVisitUrl = formatSocialUrl(form.tiktokHandle, 'tiktok');
  const bookingVisitUrl = formatExternalUrl(form.bookingPlatformUrl);
  const yelpVisitUrl = formatExternalUrl(form.yelpUrl);
  const nextdoorVisitUrl = formatExternalUrl(form.nextdoorUrl);
  const linkedinVisitUrl = formatExternalUrl(form.linkedinUrl);
  const glassdoorVisitUrl = formatExternalUrl(form.glassdoorUrl);
  const bbbVisitUrl = formatExternalUrl(form.bbbUrl);

  return (
    <form onSubmit={handleSubmit}>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
        {/* Top Informational Copy */}
        <p className="text-xs text-slate-500">
          No document upload required. Online channels and profile handles are prefilled automatically from the
          Required Information form (Digital Presence section) submitted by the client in the Client Portal. You can
          verify, fine-tune, or add additional digital channels below before running analysis.
        </p>

        {/* Sector Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Online Channels &amp; Digital Footprint
            </span>
            <span
              className={cn(
                'text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                configuredChannels > 0
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200',
              )}
            >
              {configuredChannels} of 11 channels configured
            </span>
            <span
              className={cn(
                'text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                hasWebsite
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200',
              )}
            >
              {hasWebsite ? 'Website Configured' : 'Website Missing'}
            </span>
            <span
              className={cn(
                'text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                hasGoogleProfile
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200',
              )}
            >
              {hasGoogleProfile ? 'Google Profile Configured' : 'Google Profile Missing'}
            </span>
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="text-[11px] text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 cursor-pointer transition-colors shrink-0"
            >
              <RotateCw className={cn('w-3 h-3', refreshing && 'animate-spin')} />
              Refresh from Portal &amp; Profile
            </button>
          )}
        </div>

        {/* Information Banner */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
            <Globe className="w-4 h-4" />
          </div>
          <div className="text-xs space-y-1">
            <div className="font-semibold text-slate-800">
              Automated Multi-Channel Web Scraping &amp; AI Reputation Scoring
            </div>
            <p className="text-slate-600 leading-relaxed">
              The AI agent crawls Google Places, live business websites, social media profiles, and review platforms.
              It evaluates search discoverability, customer review volume, rating sentiments, and digital asset
              transferability.
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
                    <span className="text-xs font-bold text-slate-900 truncate">Subject Business Profile</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      Client Profile
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    Business name and primary digital domain synced from Client Record &amp; Portal
                  </p>
                </div>
              </div>
              {websiteVisitUrl && (
                <a
                  href={websiteVisitUrl}
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
                  Business / Client Name *
                </label>
                <input
                  type="text"
                  value={form.businessName}
                  onChange={(e) => set('businessName', e.target.value)}
                  placeholder="e.g. Desert Haven Pet Resort"
                  className={cn(
                    'w-full text-xs rounded-md border bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500',
                    errors.businessName ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-200',
                  )}
                />
                {errors.businessName && <p className="text-[10px] text-rose-500 mt-1">{errors.businessName}</p>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Primary Website URL
                  </label>
                  {websiteVisitUrl && (
                    <span className="text-[10px] text-emerald-600 font-medium inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Configured
                    </span>
                  )}
                </div>
                <input
                  type="url"
                  value={form.websiteUrl ?? ''}
                  onChange={(e) => set('websiteUrl', e.target.value)}
                  placeholder="https://www.example.com"
                  className={cn(
                    'w-full text-xs rounded-md border bg-white px-2.5 py-1.5 text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500',
                    errors.websiteUrl ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-200',
                  )}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Local Search & Google Business Profile */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 truncate">
                      Google Business Profile &amp; Local Search
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                      Google Maps
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    Google Maps listing, verified customer reviews, and local search visibility
                  </p>
                </div>
              </div>
              {googleMapsVisitUrl && (
                <a
                  href={googleMapsVisitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Visit
                </a>
              )}
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Google Business Profile / Maps URL
              </label>
              <input
                type="text"
                value={form.googleBusinessProfileUrl ?? ''}
                onChange={(e) => set('googleBusinessProfileUrl', e.target.value)}
                placeholder="https://maps.app.goo.gl/... or Google Maps place link"
                className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Paste the Google Maps or Google Business Profile share link. For multi-location businesses, provide the primary location URL.
              </p>
            </div>
          </div>

          {/* Card 3: Social Media Channels */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-pink-50 border border-pink-100 flex items-center justify-center text-pink-600 shrink-0">
                  <Instagram className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 truncate">Social Media Channels</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-pink-50 text-pink-700 border border-pink-200">
                      Social Footprint
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    Official social media handles, follower count signals, and community engagement
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Facebook className="w-3 h-3 text-blue-700" />
                    Facebook Page
                  </label>
                  {facebookVisitUrl && (
                    <a
                      href={facebookVisitUrl}
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
                  type="text"
                  value={form.facebookHandle ?? ''}
                  onChange={(e) => set('facebookHandle', e.target.value)}
                  placeholder="https://facebook.com/... or @page"
                  className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Instagram className="w-3 h-3 text-pink-600" />
                    Instagram Handle
                  </label>
                  {instagramVisitUrl && (
                    <a
                      href={instagramVisitUrl}
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
                  type="text"
                  value={form.instagramHandle ?? ''}
                  onChange={(e) => set('instagramHandle', e.target.value)}
                  placeholder="https://instagram.com/... or @handle"
                  className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Music2 className="w-3 h-3 text-slate-800" />
                    TikTok Handle
                  </label>
                  {tiktokVisitUrl && (
                    <a
                      href={tiktokVisitUrl}
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
                  type="text"
                  value={form.tiktokHandle ?? ''}
                  onChange={(e) => set('tiktokHandle', e.target.value)}
                  placeholder="https://tiktok.com/@... or @handle"
                  className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Card 4: Booking Platform & Customer Reviews */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                  <Star className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 truncate">
                      Booking Platform &amp; Local Reviews
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      Customer Experience
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    Customer booking engine and third-party local review platforms
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <CalendarCheck className="w-3 h-3 text-emerald-600" />
                    Booking Platform URL
                  </label>
                  {bookingVisitUrl && (
                    <a
                      href={bookingVisitUrl}
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
                  type="text"
                  value={form.bookingPlatformUrl ?? ''}
                  onChange={(e) => set('bookingPlatformUrl', e.target.value)}
                  placeholder="e.g. Gingr, PawPartner, PetExec, Pawfinity, MoeGo, Boulevard"
                  className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Examples: Gingr, PawPartner, PetExec, Pawfinity, MoeGo, Boulevard, Mindbody.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-500" />
                      Yelp Profile URL
                    </label>
                    {yelpVisitUrl && (
                      <a
                        href={yelpVisitUrl}
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
                    value={form.yelpUrl ?? ''}
                    onChange={(e) => set('yelpUrl', e.target.value)}
                    placeholder="https://www.yelp.com/biz/..."
                    className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-emerald-600" />
                      Nextdoor Business URL
                    </label>
                    {nextdoorVisitUrl && (
                      <a
                        href={nextdoorVisitUrl}
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
                    value={form.nextdoorUrl ?? ''}
                    onChange={(e) => set('nextdoorUrl', e.target.value)}
                    placeholder="https://nextdoor.com/pages/..."
                    className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 5: Corporate Reputation & Employer Brand */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 truncate">
                      Corporate Reputation &amp; Employer Brand
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Corporate Standing
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    Professional network presence, employer ratings, and business bureau accreditation
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-blue-700" />
                    LinkedIn Company URL
                  </label>
                  {linkedinVisitUrl && (
                    <a
                      href={linkedinVisitUrl}
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
                  value={form.linkedinUrl ?? ''}
                  onChange={(e) => set('linkedinUrl', e.target.value)}
                  placeholder="https://www.linkedin.com/company/..."
                  className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Briefcase className="w-3 h-3 text-emerald-700" />
                    Glassdoor URL
                  </label>
                  {glassdoorVisitUrl && (
                    <a
                      href={glassdoorVisitUrl}
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
                  value={form.glassdoorUrl ?? ''}
                  onChange={(e) => set('glassdoorUrl', e.target.value)}
                  placeholder="https://www.glassdoor.com/..."
                  className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-blue-600" />
                    BBB Profile URL
                  </label>
                  {bbbVisitUrl && (
                    <a
                      href={bbbVisitUrl}
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
                  value={form.bbbUrl ?? ''}
                  onChange={(e) => set('bbbUrl', e.target.value)}
                  placeholder="https://www.bbb.org/..."
                  className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            {canRun ? (
              <span className="text-xs text-emerald-700 font-medium inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Client name and {configuredChannels} digital channel(s) configured. Ready for web analysis.
              </span>
            ) : (
              <span className="text-xs text-amber-700 font-medium inline-flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                {!form.businessName.trim()
                  ? 'Business / client name is required.'
                  : 'Please provide at least one channel URL or handle.'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {onSave && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onSave(form)}
                disabled={saving || loading}
                className="h-9 px-4 text-xs font-medium cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                    Save Inputs
                  </>
                )}
              </Button>
            )}

            <Button
              type="submit"
              disabled={loading || !canRun}
              className="h-9 px-5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white cursor-pointer shadow-xs disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Analyzing Digital Presence...
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5 mr-2" />
                  Run Digital Presence Analysis
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
