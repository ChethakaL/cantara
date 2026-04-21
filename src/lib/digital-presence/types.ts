export type ChannelScore = 1 | 2 | 3 | 4 | 5;
export type TrafficLight = 'green' | 'amber' | 'red';
export type AnalysisStatus = 'idle' | 'researching' | 'analyzing' | 'complete' | 'error';

export type ChannelType =
  | 'website'
  | 'google_business'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'booking_platform'
  | 'online_reputation';

export interface DigitalAssetFormData {
  businessName: string;

  websiteUrl?: string;
  googleBusinessProfileUrl?: string;
  googleBusinessLocations?: string;
  facebookHandle?: string;
  instagramHandle?: string;
  tiktokHandle?: string;
  bookingPlatformUrl?: string;
  yelpUrl?: string;
  nextdoorUrl?: string;

  // Business Reputation
  linkedinUrl?: string;
  glassdoorUrl?: string;
  bbbUrl?: string;
}

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface ChannelResearchData {
  channelType: ChannelType;
  inputUrl?: string;
  searchQueries: string[];
  results: TavilySearchResult[];
  error?: string;
}

export interface ChannelFlag {
  severity: 'critical' | 'warning' | 'positive';
  message: string;
}

export interface KeyMetric {
  label: string;
  value: string;
}

export interface ChannelAssessment {
  channelType: ChannelType;
  channelLabel: string;
  url?: string;
  score: ChannelScore;
  trafficLight: TrafficLight;
  summary: string;
  flags: ChannelFlag[];
  keyMetrics: KeyMetric[];
  notFound: boolean;
  dataConfidence: 'high' | 'medium' | 'low';
}

export interface AssetInventoryItem {
  assetType: string;
  channelType: ChannelType;
  url: string;
  status: 'active' | 'inactive' | 'not_found' | 'unverified';
  score: ChannelScore | null;
  notes: string;
}

export interface DigitalPresenceReport {
  businessName: string;
  generatedAt: string;
  overallScore: number;
  overallTrafficLight: TrafficLight;
  executiveSummary: string;
  channels: ChannelAssessment[];
  digitalAssetInventory: AssetInventoryItem[];
  maReadinessNotes: string;
}

export interface AnalyzeRequestBody {
  formData: DigitalAssetFormData;
}

export interface AnalyzeResponseBody {
  report: DigitalPresenceReport;
}
