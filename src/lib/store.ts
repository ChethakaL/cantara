// Central database-backed store
// Replaces localStorage with asynchronous API calls

import type { LeaseReport as ParsedLeaseReport } from '@/lib/lease-analysis/types'

export type Workstream = 'ws1' | 'ws2' | 'both' | 'ma' | null
export type BusinessType = 'single' | 'multi' | 'parent'
export type ClientStage = 'onboarding' | 'collection' | 'review' | 'final' | 'closed'

export interface WorkstreamAgent {
  id: string
  agentId: string
  agentName: string
  documentIds: string[]
}

export interface WorkstreamTemplate {
  id: string
  name: string
  description?: string | null
  isSystem: boolean
  agents: WorkstreamAgent[]
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: string
}

export interface AdvisorProfile {
  id: string
  name: string
  imageUrl: string
}

export interface SectionSubmission {
  submittedAt: string
  [key: string]: unknown
}

export interface Branch {
  id: string
  name: string
}

export interface DocumentStatus {
  id: string
  hasDoc: boolean | null
  assignedTo: string | null
  uploadedAt: string | null
  fileName: string | null
  fileUrl?: string | null
  notApplicable: boolean
  targetDeadline?: string | null
}

export interface UploadedDocumentFile {
  id: string
  fileName: string
  uploadedAt: string
}

export interface UploadedDocument {
  documentId: string
  fileName: string
  fileUrl?: string | null
  uploadedAt: string
  fileCount?: number
  files?: UploadedDocumentFile[]
  aiReviewSummary?: string | null
  aiReviewStatus?: string | null
  aiDetectedType?: string | null
  aiReviewFlags?: string[]
}

export interface ChatMessage {
  id: string
  clientId: string
  senderRole: 'client' | 'admin' | 'ADMIN' | 'CLIENT'
  senderName: string
  message: string
  timestamp: string
  readByAdmin: boolean
  readByClient: boolean
}

export interface AdditionalRequirement {
  id: string
  clientId: string
  title: string
  description: string
  question?: string | null
  requestUpload?: boolean
  assignedTo?: string | null
  sourceDocumentId?: string | null
  sourceDocumentName?: string | null
  sourceUploadedFileName?: string | null
  clientResponse?: string | null
  responseFileName?: string | null
  responseFileUrl?: string | null
  respondedAt?: string | null
  priority: 'high' | 'medium' | 'low'
  status: 'open' | 'resolved'
  createdAt: string
}

export interface LeaseAnalysis {
  id: string
  clientId: string
  fileName: string
  createdAt: string
  report: string
  parsed: ParsedLeaseReport | null
}

export interface ContractAnalysis {
  id: string
  clientId: string
  fileName: string
  createdAt: string
  report: string
  parsed: any | null
}

export interface CompetitorAnalysis {
  id: string
  clientId: string
  fileName: string
  createdAt: string
  report: string
  parsed: any | null
}

export interface Client {
  id: string
  name: string
  email: string
  company: string
  dba?: string
  phone: string
  businessAddress: string
  state?: string
  totalEmployeesSelfReported?: number | string | null
  employmentTypeBreakdown?: string | null
  businessCategory: string
  websiteUrl: string
  propertyOwnership?: 'lease' | 'owns' | ''
  workstream: Workstream
  customWorkstreamId?: string | null
  customWorkstream?: WorkstreamTemplate | null
  workstreamAgents?: WorkstreamAgent[]
  stage: ClientStage
  businessType: BusinessType
  branches: Branch[]
  teamMembers: TeamMember[]
  advisors: AdvisorProfile[]
  sectionSubmissions: Record<string, SectionSubmission>
  sectionDeadlines: Record<string, string>
  documentStatuses: Record<string, DocumentStatus>
  uploadedDocuments: Record<string, UploadedDocument>
  driveFolder: string | null
  createdAt: string
  provisionedAt: string | null
  lastLogin: string | null
  notes: string
  valuationDocUploaded: boolean
  unreadCount?: number
}

const isBrowser = typeof window !== 'undefined'

// ── Client CRUD ─────────────────────────────────────────────────────────────

export async function getClients(): Promise<Client[]> {
  try {
    const res = await fetch('/api/clients');
    if (!res.ok) throw new Error('Failed to fetch clients');
    return await res.json();
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function getClient(id: string): Promise<Client | null> {
  try {
    const res = await fetch(`/api/clients/${id}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function saveClient(client: Partial<Client>) {
  try {
    const res = await fetch(`/api/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(client),
    });
    return await res.json();
  } catch (error) {
    console.error(error);
  }
}

export async function createClient(data: Partial<Client> & { advisorName?: string }): Promise<Client> {
  const res = await fetch('/api/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const message = (await res.text()).trim() || 'Failed to create client'
    throw new Error(message)
  }
  return await res.json();
}

export async function getWorkstreamTemplates(): Promise<WorkstreamTemplate[]> {
  try {
    const res = await fetch('/api/workstream-templates', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch workstream templates');
    return await res.json();
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function saveWorkstreamTemplate(data: {
  id?: string
  name: string
  description?: string
  agents: Array<{ agentId: string; agentName: string; documentIds: string[] }>
}): Promise<WorkstreamTemplate | null> {
  try {
    const res = await fetch('/api/workstream-templates', {
      method: data.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function deleteWorkstreamTemplate(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/workstream-templates?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (error) {
    console.error(error);
    return false;
  }
}

// ── Chat CRUD ───────────────────────────────────────────────────────────────

export async function getMessages(clientId: string): Promise<ChatMessage[]> {
  try {
    const res = await fetch(`/api/chat?clientId=${clientId}`);
    const data = await res.json();
    return data.messages || [];
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function saveMessage(msg: Omit<ChatMessage, 'id'>) {
    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(msg),
        });
        return await res.json();
    } catch (error) {
        console.error(error);
    }
}

// ── Additional Requirements CRUD ───────────────────────────────────────────

export async function getRequirements(clientId: string): Promise<AdditionalRequirement[]> {
  try {
    const res = await fetch(`/api/requirements?clientId=${clientId}`);
    return await res.json();
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function saveRequirement(req: Omit<AdditionalRequirement, 'id'>) {
  try {
    const res = await fetch('/api/requirements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    return await res.json();
  } catch (error) {
    console.error(error);
  }
}

export async function updateRequirement(id: string, update: Partial<AdditionalRequirement>) {
  try {
    const res = await fetch(`/api/requirements/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
    return await res.json();
  } catch (error) {
    console.error(error);
  }
}

// ── Lease Analyses ──────────────────────────────────────────────────────────

export async function getLeaseAnalyses(clientId: string): Promise<LeaseAnalysis[]> {
  try {
    const res = await fetch(`/api/lease-analysis/reports?clientId=${clientId}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function saveLeaseAnalysis(data: {
    clientId: string;
    fileName: string;
    report: string;
    parsed: ParsedLeaseReport;
}) {
    try {
        const res = await fetch('/api/lease-analysis/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return await res.json();
    } catch (error) {
        console.error(error);
    }
}

export async function updateLeaseAnalysis(id: string, update: {
    report?: string;
    parsed?: ParsedLeaseReport;
}) {
    try {
        const res = await fetch(`/api/lease-analysis/reports?id=${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(update),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(text || 'Failed to update lease analysis');
        }
        return await res.json();
    } catch (error) {
        console.error(error);
        throw error
    }
}

export async function deleteLeaseAnalysis(id: string) {
    try {
        const res = await fetch(`/api/lease-analysis/reports?id=${id}`, {
            method: 'DELETE',
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(text || 'Failed to delete lease analysis');
        }
        return await res.json();
    } catch (error) {
        console.error(error);
        throw error
    }
}

// ── Contract Analyses ───────────────────────────────────────────────────────

export async function getContractAnalyses(clientId: string): Promise<ContractAnalysis[]> {
  try {
    const res = await fetch(`/api/contract-analysis/reports?clientId=${clientId}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function saveContractAnalysis(data: {
  clientId: string;
  fileName: string;
  report: string;
  parsed: any;
}) {
  try {
    const res = await fetch('/api/contract-analysis/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch (error) {
    console.error(error);
  }
}

export async function updateContractAnalysis(id: string, update: {
    report?: string;
    parsed?: any;
}) {
    try {
        const res = await fetch(`/api/contract-analysis/reports?id=${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(update),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(text || 'Failed to update contract analysis');
        }
        return await res.json();
    } catch (error) {
        console.error(error);
        throw error
    }
}

export async function deleteContractAnalysis(id: string) {
  try {
    const res = await fetch(`/api/contract-analysis/reports?id=${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || 'Failed to delete contract analysis');
    }
    return await res.json();
  } catch (error) {
    console.error(error);
    throw error
  }
}

// ── Competitor Analyses ─────────────────────────────────────────────────────

export async function getCompetitorAnalyses(clientId: string): Promise<CompetitorAnalysis[]> {
  try {
    const res = await fetch(`/api/competitor-analysis/reports?clientId=${clientId}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function saveCompetitorAnalysis(data: {
  clientId: string;
  fileName: string;
  report: string;
  parsed: any;
}) {
  try {
    const res = await fetch('/api/competitor-analysis/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || 'Failed to save competitor analysis');
    }
    return await res.json();
  } catch (error) {
    console.error(error);
    throw error
  }
}

export async function deleteCompetitorAnalysis(id: string) {
  try {
    const res = await fetch(`/api/competitor-analysis/reports?id=${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || 'Failed to delete competitor analysis');
    }
    return await res.json();
  } catch (error) {
    console.error(error);
    throw error
  }
}

export async function updateCompetitorAnalysis(id: string, update: {
  fileName?: string;
  report?: string;
  parsed?: any;
}) {
  try {
    const res = await fetch(`/api/competitor-analysis/reports?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || 'Failed to update competitor analysis');
    }
    return await res.json();
  } catch (error) {
    console.error(error);
    throw error
  }
}

// ── Auth Helpers (Still using LocalStorage/Cookies for session) ───────────────

export function getCurrentRole(): 'admin' | 'client' | null {
  if (!isBrowser) return null
  try {
    const raw = localStorage.getItem('cantara_role')
    if (raw) return JSON.parse(raw)
    
    const cookies = document.cookie.split('; ')
    const cookie = cookies.find(c => c.startsWith('cantara_role='))
    if (cookie) return decodeURIComponent(cookie.split('=')[1]) as any
  } catch {
    return localStorage.getItem('cantara_role') as any
  }
  return null
}

export function getAdminName(): string {
  if (!isBrowser) return 'Cantara Admin'
  try {
    const raw = localStorage.getItem('cantara_admin_name')
    if (raw) return JSON.parse(raw)
  } catch {}
  return 'Cantara Admin'
}

export function getAdminEmail(): string {
  if (!isBrowser) return ''
  try {
    const cookies = document.cookie.split('; ')
    const cookie = cookies.find(c => c.startsWith('cantara_admin_email='))
    if (cookie) return decodeURIComponent(cookie.split('=')[1] || '')
  } catch {}
  return ''
}

export function logout() {
  if (!isBrowser) return
  localStorage.removeItem('cantara_role')
  localStorage.removeItem('cantara_admin_name')
  localStorage.removeItem('cantara_client_email')
  document.cookie = "cantara_role=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
}
