import {
  BusinessPlaceProfile,
  CompetitorAnalysisFormData,
  DiscoveredCompetitorItem,
  PlaceLocation,
} from './types';

const GOOGLE_MAPS_BASE = 'https://maps.googleapis.com/maps/api';
const FIVE_MILES_IN_METERS = 8047;
const REQUEST_TIMEOUT_MS = 20000;

type GeocodeResponse = {
  status: string;
  error_message?: string;
  results?: Array<{
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
  }>;
};

type FindPlaceResponse = {
  status: string;
  error_message?: string;
  candidates?: Array<{
    place_id?: string;
    name?: string;
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
    types?: string[];
  }>;
};

type NearbySearchResponse = {
  status: string;
  error_message?: string;
  results?: Array<{
    place_id?: string;
    name?: string;
    vicinity?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
    types?: string[];
    rating?: number;
    user_ratings_total?: number;
    price_level?: number;
    business_status?: string;
    opening_hours?: { open_now?: boolean };
  }>;
};

type PlaceDetailsResponse = {
  status: string;
  error_message?: string;
  result?: {
    place_id?: string;
    name?: string;
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
    types?: string[];
    rating?: number;
    user_ratings_total?: number;
    price_level?: number;
    website?: string;
    url?: string;
    formatted_phone_number?: string;
    business_status?: string;
    opening_hours?: {
      open_now?: boolean;
      weekday_text?: string[];
    };
  };
};

interface DiscoveredPlace {
  placeId: string;
  name: string;
  address: string;
  location: PlaceLocation;
  primaryTypes: string[];
  rating: number | null;
  reviewCount: number | null;
  priceLevel: number | null;
  businessStatus: string | null;
  openNow: boolean | null;
  distanceMiles: number;
}

export interface SubjectLookupResult {
  center: PlaceLocation;
  formattedAddress: string;
  subject: BusinessPlaceProfile;
}

function normalizeBusinessName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(llc|inc|co|corp|ltd|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateAddress(value: string | undefined): string {
  return (value ?? '').trim();
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Request failed (${res.status})`);
    }
    return await res.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

function requireLocation(location: { lat?: number; lng?: number } | undefined, context: string): PlaceLocation {
  if (typeof location?.lat !== 'number' || typeof location?.lng !== 'number') {
    throw new Error(`Missing coordinates for ${context}.`);
  }
  return { lat: location.lat, lng: location.lng };
}

export function haversineMiles(a: PlaceLocation, b: PlaceLocation): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(h));
}

export function inferGooglePlaceType(category: string): string | null {
  const normalized = category.toLowerCase();
  if (/restaurant|cafe|diner|food|pizza|burger|sushi|chinese|thai|mexican|italian/.test(normalized)) return 'restaurant';
  if (/salon|spa|barber|beauty|nails|hair/.test(normalized)) return 'beauty_salon';
  if (/veterinary|veterinarian|vet clinic|vet\b/.test(normalized)) return 'veterinary_care';
  if (/dentist|dental/.test(normalized)) return 'dentist';
  if (/doctor|clinic|medical|urgent care/.test(normalized)) return 'doctor';
  if (/hotel|motel|inn/.test(normalized)) return 'lodging';
  if (/gym|fitness/.test(normalized)) return 'gym';
  if (/pet store|pet shop/.test(normalized)) return 'pet_store';
  return null;
}

export function inferPetBusinessCategory(subject: Pick<BusinessPlaceProfile, 'name' | 'primaryTypes'>): string {
  const normalizedName = subject.name.toLowerCase();
  const types = subject.primaryTypes.map((type) => type.toLowerCase());

  if (types.includes('veterinary_care') || /vet|veterinary|animal hospital|pet hospital/.test(normalizedName)) {
    return 'veterinary clinic';
  }

  if (/groom|grooming|wash|spa/.test(normalizedName)) {
    return 'pet grooming';
  }

  if (/boarding|daycare|day care|kennel/.test(normalizedName)) {
    return 'pet boarding';
  }

  if (/training|trainer/.test(normalizedName)) {
    return 'dog training';
  }

  if (/food|treat|nutrition|supply|supplies|pet care|petcare|pet shop|pet store/.test(normalizedName) || types.includes('pet_store')) {
    return 'pet store';
  }

  return 'pet store';
}

export function priceLevelLabel(priceLevel: number | null | undefined): string {
  if (!priceLevel || priceLevel < 1) return 'Not published';
  return '$'.repeat(Math.min(4, priceLevel));
}

export async function geocodeAddress(address: string, apiKey: string) {
  const url = `${GOOGLE_MAPS_BASE}/geocode/json?address=${encodeURIComponent(address)}&key=${encodeURIComponent(apiKey)}`;
  const data = await fetchJson<GeocodeResponse>(url);
  if (data.status !== 'OK' || !data.results?.length) {
    throw new Error(data.error_message || 'Unable to locate the business address.');
  }

  const first = data.results[0];
  return {
    formattedAddress: first.formatted_address ?? address,
    location: requireLocation(first.geometry?.location, 'geocoded address'),
  };
}

export async function findPlaceByText(input: string, apiKey: string) {
  const fields = [
    'place_id',
    'name',
    'formatted_address',
    'geometry',
    'types',
  ].join(',');
  const url = `${GOOGLE_MAPS_BASE}/place/findplacefromtext/json?input=${encodeURIComponent(input)}&inputtype=textquery&fields=${encodeURIComponent(fields)}&key=${encodeURIComponent(apiKey)}`;
  const data = await fetchJson<FindPlaceResponse>(url);
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(data.error_message || 'Unable to search for the business.');
  }
  const candidate = data.candidates?.[0];
  if (!candidate?.place_id) return null;
  return {
    placeId: candidate.place_id,
    name: candidate.name ?? '',
    address: truncateAddress(candidate.formatted_address),
    location: requireLocation(candidate.geometry?.location, 'subject place'),
    primaryTypes: candidate.types ?? [],
  };
}

export async function getPlaceDetails(placeId: string, apiKey: string): Promise<BusinessPlaceProfile | null> {
  const fields = [
    'place_id',
    'name',
    'formatted_address',
    'geometry',
    'types',
    'rating',
    'user_ratings_total',
    'price_level',
    'website',
    'url',
    'formatted_phone_number',
    'business_status',
    'opening_hours',
  ].join(',');
  const url = `${GOOGLE_MAPS_BASE}/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${encodeURIComponent(fields)}&key=${encodeURIComponent(apiKey)}`;
  const data = await fetchJson<PlaceDetailsResponse>(url);
  if (data.status !== 'OK' || !data.result?.place_id) return null;

  const result = data.result;
  return {
    placeId: result.place_id ?? null,
    name: result.name ?? 'Unknown business',
    address: truncateAddress(result.formatted_address),
    location: requireLocation(result.geometry?.location, 'place details'),
    rating: typeof result.rating === 'number' ? result.rating : null,
    reviewCount: typeof result.user_ratings_total === 'number' ? result.user_ratings_total : null,
    priceLevel: typeof result.price_level === 'number' ? result.price_level : null,
    websiteUrl: result.website ?? null,
    mapsUrl: result.url ?? null,
    phoneNumber: result.formatted_phone_number ?? null,
    businessStatus: result.business_status ?? null,
    openNow: typeof result.opening_hours?.open_now === 'boolean' ? result.opening_hours.open_now : null,
    weekdayText: result.opening_hours?.weekday_text ?? [],
    primaryTypes: result.types ?? [],
  };
}

function mapNearbyResult(result: NearbySearchResponse['results'][number], center: PlaceLocation): DiscoveredPlace | null {
  if (!result?.place_id || !result?.name) return null;
  const location = requireLocation(result.geometry?.location, result.name);
  return {
    placeId: result.place_id,
    name: result.name,
    address: truncateAddress(result.vicinity),
    location,
    primaryTypes: result.types ?? [],
    rating: typeof result.rating === 'number' ? result.rating : null,
    reviewCount: typeof result.user_ratings_total === 'number' ? result.user_ratings_total : null,
    priceLevel: typeof result.price_level === 'number' ? result.price_level : null,
    businessStatus: result.business_status ?? null,
    openNow: typeof result.opening_hours?.open_now === 'boolean' ? result.opening_hours.open_now : null,
    distanceMiles: haversineMiles(center, location),
  };
}

function isSameBusiness(args: {
  candidate: DiscoveredPlace;
  subjectPlaceId: string | null;
  subjectName: string;
  subjectAddress: string;
}): boolean {
  if (args.subjectPlaceId && args.candidate.placeId === args.subjectPlaceId) return true;

  const candidateName = normalizeBusinessName(args.candidate.name);
  const subjectName = normalizeBusinessName(args.subjectName);
  const sameName = candidateName === subjectName || candidateName.includes(subjectName) || subjectName.includes(candidateName);
  const candidateAddress = truncateAddress(args.candidate.address).toLowerCase();
  const subjectAddress = truncateAddress(args.subjectAddress).toLowerCase();

  return sameName && (!candidateAddress || !subjectAddress || candidateAddress.includes(subjectAddress) || subjectAddress.includes(candidateAddress));
}

async function runNearbySearch(params: {
  center: PlaceLocation;
  apiKey: string;
  businessCategory: string;
  placeType: string | null;
}): Promise<DiscoveredPlace[]> {
  const searchParams = new URLSearchParams({
    key: params.apiKey,
    location: `${params.center.lat},${params.center.lng}`,
    radius: String(FIVE_MILES_IN_METERS),
    keyword: params.businessCategory,
  });

  if (params.placeType) {
    searchParams.set('type', params.placeType);
  }

  const url = `${GOOGLE_MAPS_BASE}/place/nearbysearch/json?${searchParams.toString()}`;
  const data = await fetchJson<NearbySearchResponse>(url);
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(data.error_message || 'Unable to search nearby businesses.');
  }

  return (data.results ?? [])
    .map((result) => mapNearbyResult(result, params.center))
    .filter((item): item is DiscoveredPlace => Boolean(item));
}

export async function lookupSubjectBusiness(
  formData: CompetitorAnalysisFormData,
  apiKey: string
): Promise<SubjectLookupResult> {
  const geocoded = await geocodeAddress(formData.businessAddress, apiKey);
  const subjectMatch = await findPlaceByText(
    `${formData.businessName} ${formData.businessAddress}`,
    apiKey
  );

  let subject: BusinessPlaceProfile;
  if (subjectMatch?.placeId) {
    const detailed = await getPlaceDetails(subjectMatch.placeId, apiKey);
    subject = detailed ?? {
      placeId: subjectMatch.placeId,
      name: formData.businessName,
      address: subjectMatch.address || geocoded.formattedAddress,
      location: subjectMatch.location,
      rating: null,
      reviewCount: null,
      priceLevel: null,
      websiteUrl: formData.websiteUrl?.trim() || null,
      mapsUrl: null,
      phoneNumber: null,
      businessStatus: null,
      openNow: null,
      weekdayText: [],
      primaryTypes: subjectMatch.primaryTypes,
    };
  } else {
    subject = {
      placeId: null,
      name: formData.businessName,
      address: geocoded.formattedAddress,
      location: geocoded.location,
      rating: null,
      reviewCount: null,
      priceLevel: null,
      websiteUrl: formData.websiteUrl?.trim() || null,
      mapsUrl: null,
      phoneNumber: null,
      businessStatus: null,
      openNow: null,
      weekdayText: [],
      primaryTypes: [],
    };
  }

  if (!subject.websiteUrl && formData.websiteUrl?.trim()) {
    subject.websiteUrl = formData.websiteUrl.trim();
  }

  return {
    center: subject.location ?? geocoded.location,
    formattedAddress: geocoded.formattedAddress,
    subject,
  };
}

export async function findNearbyCompetitors(args: {
  center: PlaceLocation;
  businessCategory: string;
  apiKey: string;
  subjectPlaceId: string | null;
  subjectName: string;
  subjectAddress: string;
  limit?: number;
}): Promise<{
  competitors: Array<BusinessPlaceProfile & { distanceMiles: number }>;
  discoveredCompetitors: number;
  discoveredItems: DiscoveredCompetitorItem[];
}> {
  const placeType = inferGooglePlaceType(args.businessCategory);

  const searches = await Promise.all([
    runNearbySearch({
      center: args.center,
      apiKey: args.apiKey,
      businessCategory: args.businessCategory,
      placeType: null,
    }),
    placeType
      ? runNearbySearch({
          center: args.center,
          apiKey: args.apiKey,
          businessCategory: args.businessCategory,
          placeType,
        })
      : Promise.resolve([]),
  ]);

  const deduped = new Map<string, DiscoveredPlace>();
  for (const result of searches.flat()) {
    if (result.distanceMiles > 5) continue;
    if (isSameBusiness({
      candidate: result,
      subjectPlaceId: args.subjectPlaceId,
      subjectName: args.subjectName,
      subjectAddress: args.subjectAddress,
    })) {
      continue;
    }

    const existing = deduped.get(result.placeId);
    if (!existing) {
      deduped.set(result.placeId, result);
      continue;
    }

    const existingScore = (existing.reviewCount ?? 0) + (existing.rating ?? 0) * 100;
    const nextScore = (result.reviewCount ?? 0) + (result.rating ?? 0) * 100;
    if (nextScore > existingScore) {
      deduped.set(result.placeId, result);
    }
  }

  const discovered = Array.from(deduped.values())
    .sort((a, b) => a.distanceMiles - b.distanceMiles || (b.reviewCount ?? 0) - (a.reviewCount ?? 0));

  const limit = Math.max(1, Math.min(args.limit ?? 8, 12));
  const selected = discovered.slice(0, limit);

  const detailed = await Promise.all(
    selected.map(async (item) => {
      const details = await getPlaceDetails(item.placeId, args.apiKey);
      return {
        ...(details ?? {
          placeId: item.placeId,
          name: item.name,
          address: item.address,
          location: item.location,
          rating: item.rating,
          reviewCount: item.reviewCount,
          priceLevel: item.priceLevel,
          websiteUrl: null,
          mapsUrl: null,
          phoneNumber: null,
          businessStatus: item.businessStatus,
          openNow: item.openNow,
          weekdayText: [],
          primaryTypes: item.primaryTypes,
        }),
        distanceMiles: item.distanceMiles,
      };
    })
  );

  const researchedIds = new Set(detailed.map((item) => item.placeId).filter(Boolean));
  const discoveredItems: DiscoveredCompetitorItem[] = discovered.map((item) => ({
    placeId: item.placeId,
    name: item.name,
    address: item.address,
    location: item.location,
    rating: item.rating,
    reviewCount: item.reviewCount,
    priceLevel: item.priceLevel,
    websiteUrl: null,
    mapsUrl: null,
    phoneNumber: null,
    businessStatus: item.businessStatus,
    openNow: item.openNow,
    weekdayText: [],
    primaryTypes: item.primaryTypes,
    distanceMiles: item.distanceMiles,
    isResearched: researchedIds.has(item.placeId),
  }));

  return {
    competitors: detailed,
    discoveredCompetitors: discovered.length,
    discoveredItems,
  };
}
