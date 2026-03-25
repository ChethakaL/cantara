'use client';

import { useState } from 'react';
import {
  Globe,
  MapPin,
  Facebook,
  Instagram,
  Youtube,
  Music2,
  CalendarCheck,
  Star,
  ChevronDown,
  ChevronUp,
  Loader2,
  Search,
} from 'lucide-react';
import { Button, Input, cn } from '@/components/ui';
import { DigitalAssetFormData } from '@/lib/digital-presence/types';

interface Props {
  onSubmit: (data: DigitalAssetFormData) => void;
  loading: boolean;
}

interface FieldGroupProps {
  icon: React.ReactNode;
  label: string;
  color: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function FieldGroup({ icon, label, color, children, defaultOpen = true }: FieldGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors',
          'hover:bg-slate-50'
        )}
      >
        <span className="flex items-center gap-2.5">
          <span className={cn('p-1.5 rounded-lg', color)}>{icon}</span>
          <span className="text-slate-700">{label}</span>
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>
      {open && <div className="px-4 pb-4 pt-2 space-y-3 border-t border-slate-100 bg-slate-50/40">{children}</div>}
    </div>
  );
}

export default function DigitalPresenceForm({ onSubmit, loading }: Props) {
  const [form, setForm] = useState<DigitalAssetFormData>({
    businessName: '',
    industry: '',
    websiteUrl: '',
    googleBusinessProfileUrl: '',
    facebookHandle: '',
    instagramHandle: '',
    tiktokHandle: '',
    youtubeHandle: '',
    bookingPlatformUrl: '',
    yelpUrl: '',
    otherReviewUrls: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof DigitalAssetFormData, string>>>({});

  function set(key: keyof DigitalAssetFormData, value: string) {
    setForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  }

  function validate(): boolean {
    const newErrors: typeof errors = {};
    if (!form.businessName.trim()) {
      newErrors.businessName = 'Business name is required';
    }
    const hasChannel =
      form.websiteUrl ||
      form.googleBusinessProfileUrl ||
      form.facebookHandle ||
      form.instagramHandle ||
      form.tiktokHandle ||
      form.youtubeHandle ||
      form.bookingPlatformUrl ||
      form.yelpUrl ||
      form.otherReviewUrls;
    if (!hasChannel) {
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Business Info */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
        <p className="text-xs font-semibold text-amber-700 uppercase tracking-widest">Business Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Business Name *"
            placeholder="e.g. Bliss Day Spa"
            value={form.businessName}
            onChange={e => set('businessName', e.target.value)}
            error={errors.businessName}
          />
          <Input
            label="Industry / Category"
            placeholder="e.g. Beauty & Wellness"
            value={form.industry}
            onChange={e => set('industry', e.target.value)}
          />
        </div>
      </div>

      {errors.websiteUrl && !form.websiteUrl && (
        <p className="text-xs text-rose-500 px-1">Please provide at least one channel URL or handle below.</p>
      )}

      {/* Website */}
      <FieldGroup
        icon={<Globe className="w-3.5 h-3.5 text-blue-600" />}
        label="Website"
        color="bg-blue-50"
      >
        <Input
          label="Website URL"
          placeholder="https://www.example.com"
          value={form.websiteUrl}
          onChange={e => set('websiteUrl', e.target.value)}
        />
      </FieldGroup>

      {/* Google Business Profile */}
      <FieldGroup
        icon={<MapPin className="w-3.5 h-3.5 text-rose-500" />}
        label="Google Business Profile"
        color="bg-rose-50"
      >
        <Input
          label="Google Business Profile URL"
          placeholder="https://maps.google.com/... or search name"
          value={form.googleBusinessProfileUrl}
          onChange={e => set('googleBusinessProfileUrl', e.target.value)}
        />
        <p className="text-xs text-slate-400">Paste the Google Maps / Business Profile link for your listing.</p>
      </FieldGroup>

      {/* Social Media */}
      <FieldGroup
        icon={<Instagram className="w-3.5 h-3.5 text-pink-500" />}
        label="Social Media"
        color="bg-pink-50"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-end gap-2">
            <Facebook className="w-4 h-4 text-blue-700 mb-2.5 flex-shrink-0" />
            <Input
              label="Facebook Page"
              placeholder="@pagename or URL"
              value={form.facebookHandle}
              onChange={e => set('facebookHandle', e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <Instagram className="w-4 h-4 text-pink-500 mb-2.5 flex-shrink-0" />
            <Input
              label="Instagram Handle"
              placeholder="@handle or URL"
              value={form.instagramHandle}
              onChange={e => set('instagramHandle', e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <Music2 className="w-4 h-4 text-slate-800 mb-2.5 flex-shrink-0" />
            <Input
              label="TikTok Handle"
              placeholder="@handle or URL"
              value={form.tiktokHandle}
              onChange={e => set('tiktokHandle', e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <Youtube className="w-4 h-4 text-rose-600 mb-2.5 flex-shrink-0" />
            <Input
              label="YouTube Channel"
              placeholder="@handle or channel URL"
              value={form.youtubeHandle}
              onChange={e => set('youtubeHandle', e.target.value)}
            />
          </div>
        </div>
      </FieldGroup>

      {/* Booking */}
      <FieldGroup
        icon={<CalendarCheck className="w-3.5 h-3.5 text-emerald-600" />}
        label="Booking Platform"
        color="bg-emerald-50"
      >
        <Input
          label="Booking Platform URL"
          placeholder="e.g. Mindbody, Fresha, Vagaro, Square, Booksy, Acuity"
          value={form.bookingPlatformUrl}
          onChange={e => set('bookingPlatformUrl', e.target.value)}
        />
      </FieldGroup>

      {/* Reviews */}
      <FieldGroup
        icon={<Star className="w-3.5 h-3.5 text-amber-500" />}
        label="Review & Reputation Sites"
        color="bg-amber-50"
      >
        <Input
          label="Yelp Profile URL"
          placeholder="https://www.yelp.com/biz/..."
          value={form.yelpUrl}
          onChange={e => set('yelpUrl', e.target.value)}
        />
        <Input
          label="Other Review Sites (optional)"
          placeholder="Trustpilot, Houzz, Tripadvisor, etc. — separate with commas"
          value={form.otherReviewUrls}
          onChange={e => set('otherReviewUrls', e.target.value)}
        />
      </FieldGroup>

      <div className="pt-2">
        <Button
          type="submit"
          size="lg"
          disabled={loading}
          className="w-full justify-center gap-3"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Researching & Analysing...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Run Digital Presence Analysis
            </>
          )}
        </Button>
        <p className="text-center text-xs text-slate-400 mt-2.5">
          Performs live web research + AI scoring across all channels. Takes 60–120 seconds.
        </p>
      </div>
    </form>
  );
}
