export type AnalysisStatus = 'idle' | 'researching' | 'analyzing' | 'complete' | 'error';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type SimilarityLevel = 'high' | 'medium' | 'low';

export interface CompetitorAnalysisFormData {
  businessName: string;
  businessAddress: string;
  businessCategory: string;
  websiteUrl?: string;
  radiusMiles?: number;
}

export interface PlaceLocation {
  lat: number;
  lng: number;
}

export interface BusinessPlaceProfile {
  placeId: string | null;
  name: string;
  address: string;
  location: PlaceLocation;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: number | null;
  websiteUrl: string | null;
  mapsUrl: string | null;
  phoneNumber: string | null;
  businessStatus: string | null;
  openNow: boolean | null;
  weekdayText: string[];
  primaryTypes: string[];
}

export interface WebsiteSnippet {
  url: string;
  title: string;
  snippet: string;
  source: 'site_fetch' | 'search';
}

export interface PriceEvidenceItem {
  label: string;
  url?: string;
  pageTitle?: string;
}

export interface WebsiteResearchData {
  websiteUrl: string;
  domain: string;
  confidence: ConfidenceLevel;
  snippets: WebsiteSnippet[];
  pricePoints: string[];
  priceEvidence: PriceEvidenceItem[];
  error?: string;
}

export interface SubjectBusinessProfile extends BusinessPlaceProfile {
  serviceSummary: string;
  services: string[];
  pricingSummary: string;
  pricePoints: string[];
  priceEvidence: PriceEvidenceItem[];
  hoursSummary: string;
  reputationSummary: string;
  websiteConfidence: ConfidenceLevel;
}

export interface CompetitorReportItem extends BusinessPlaceProfile {
  distanceMiles: number;
  similarityLevel: SimilarityLevel;
  similarityScore: number;
  similaritySummary: string;
  serviceComparison: string;
  pricingComparison: string;
  hoursComparison: string;
  reputationComparison: string;
  services: string[];
  pricePoints: string[];
  priceEvidence: PriceEvidenceItem[];
  strengths: string[];
  gaps: string[];
  websiteConfidence: ConfidenceLevel;
}

export interface DiscoveredCompetitorItem extends BusinessPlaceProfile {
  distanceMiles: number;
  isResearched: boolean;
}

export interface MarketStats {
  discoveredCompetitors: number;
  analyzedCompetitors: number;
  averageCompetitorRating: number | null;
  averageCompetitorReviewCount: number | null;
  closestCompetitorName: string | null;
  closestCompetitorDistanceMiles: number | null;
  highSimilarityCount: number;
  competitorsWithWebsite: number;
  competitorsWithPriceSignals: number;
}

export interface CompetitorAnalysisReport {
  businessName: string;
  businessAddress: string;
  businessCategory: string;
  radiusMiles: number;
  generatedAt: string;
  searchCenter: PlaceLocation;
  executiveSummary: string;
  marketSummary: string;
  positioningSummary: string;
  keyTakeaways: string[];
  recommendations: string[];
  marketStats: MarketStats;
  clientProfile: SubjectBusinessProfile;
  discoveredCompetitors: DiscoveredCompetitorItem[];
  competitors: CompetitorReportItem[];
}
