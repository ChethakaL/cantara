'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Globe,
  MapPin,
  Facebook,
  Instagram,
  Music2,
  CalendarCheck,
  Star,
  ChevronDown,
  ChevronUp,
  Loader2,
  Search,
  Building2,
  Briefcase,
  Info,
} from 'lucide-react';
import { Button, Input, cn } from '@/components/ui';
import { DigitalAssetFormData } from '@/lib/digital-presence/types';

interface Props {
  onSubmit: (data: DigitalAssetFormData) => void;
  loading: boolean;
  initialData?: Partial<DigitalAssetFormData>;
  clientName?: string;
  clientWebsite?: string;
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

export default function DigitalPresenceForm({ onSubmit, loading, initialData, clientName, clientWebsite }: Props) {
  const appliedInitialData = useRef(false)
  const [form, setForm] = useState<DigitalAssetFormData>({
    ...EMPTY_FORM,
    businessName: initialData?.businessName || clientName || '',
    websiteUrl: initialData?.websiteUrl || clientWebsite || '',
    ...initialData,
  });

  // Apply async prefill once client/required-info data arrives after mount.
  useEffect(() => {
    if (!initialData || appliedInitialData.current) return
    appliedInitialData.current = true
    setForm({
      ...EMPTY_FORM,
      ...initialData,
      businessName: initialData.businessName || clientName || '',
      websiteUrl: initialData.websiteUrl || clientWebsite || '',
    })
  }, [initialData, clientName, clientWebsite])

  useEffect(() => {
    setForm(f => ({
      ...f,
      businessName: f.businessName || clientName || '',
      websiteUrl: f.websiteUrl || clientWebsite || '',
    }))
  }, [clientName, clientWebsite])

  const [errors, setErrors] = useState<Partial<Record<keyof DigitalAssetFormData, string>>>({});

  function set(key: keyof DigitalAssetFormData, value: string) {
    setForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  }

  function validate(): boolean {
    const newErrors: typeof errors = {};
    if (!form.businessName.trim()) {
      newErrors.businessName = 'Client name is required';
    }
    const hasChannel =
      form.websiteUrl ||
      form.googleBusinessProfileUrl ||
      form.facebookHandle ||
      form.instagramHandle ||
      form.tiktokHandle ||
      form.bookingPlatformUrl ||
      form.yelpUrl ||
      form.nextdoorUrl ||
      form.linkedinUrl ||
      form.glassdoorUrl ||
      form.bbbUrl;
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
      {/* Pre-populated notice */}
      <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50/50 px-4 py-3">
        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          Fields are pre-populated from client data. Review and confirm before running.
        </p>
      </div>

      {/* Business Info */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
        <p className="text-xs font-semibold text-amber-700 uppercase tracking-widest">Business Details</p>
        <div className="grid grid-cols-1 gap-3">
          <Input
            label="Client Name *"
            placeholder="e.g. Desert Haven Pet Resort"
            value={form.businessName}
            onChange={e => set('businessName', e.target.value)}
            error={errors.businessName}
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
        {/* Google Business locations commented out for now:
        <Input
          label="Additional Location Names (for multi-location businesses)"
          placeholder="e.g. Rex Dog Hotel - Downtown, Rex Dog Hotel - Burnaby"
          value={form.googleBusinessLocations}
          onChange={e => set('googleBusinessLocations', e.target.value)}
        />
        */}
        <p className="text-xs text-slate-400">Paste the Google Maps / Business Profile link. For multi-location businesses, list additional location names separated by commas.</p>
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
          placeholder="e.g. Gingr, PawPartner, PetExec, Pawfinity, MoeGo"
          value={form.bookingPlatformUrl}
          onChange={e => set('bookingPlatformUrl', e.target.value)}
        />
        <p className="text-xs text-slate-400">Examples: Gingr, PawPartner, PetExec, Pawfinity, MoeGo</p>
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
          label="NextDoor URL"
          placeholder="https://nextdoor.com/pages/..."
          value={form.nextdoorUrl}
          onChange={e => set('nextdoorUrl', e.target.value)}
        />
      </FieldGroup>

      {/* Business Reputation */}
      <FieldGroup
        icon={<Briefcase className="w-3.5 h-3.5 text-indigo-600" />}
        label="Business Reputation"
        color="bg-indigo-50"
      >
        <div className="flex items-end gap-2">
          <Building2 className="w-4 h-4 text-blue-700 mb-2.5 flex-shrink-0" />
          <Input
            label="LinkedIn URL"
            placeholder="https://www.linkedin.com/company/..."
            value={form.linkedinUrl}
            onChange={e => set('linkedinUrl', e.target.value)}
          />
        </div>
        <Input
          label="Glassdoor URL"
          placeholder="https://www.glassdoor.com/..."
          value={form.glassdoorUrl}
          onChange={e => set('glassdoorUrl', e.target.value)}
        />
        <Input
          label="BBB (Better Business Bureau) URL"
          placeholder="https://www.bbb.org/..."
          value={form.bbbUrl}
          onChange={e => set('bbbUrl', e.target.value)}
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
