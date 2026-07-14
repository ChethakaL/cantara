'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ExternalLink, FolderOpen, Plus, Trash2, Building2, Users, Briefcase, Upload,
  Image as ImageIcon, Loader2, CheckCircle2, UserPlus, X, Bot, Search,
  Calculator, FileSpreadsheet, Landmark, ShieldCheck, Scale, Network,
  AlertCircle, BadgeDollarSign, Globe2, Camera, Tags, ChartNoAxesColumn,
  MessageSquareText, Sparkles, FileText, Handshake, ClipboardList, ChevronRight,
} from 'lucide-react'
import { Button, Input, Modal, Select, Textarea, Badge, WorkstreamBadge, cn } from '@/components/ui'
import PetBusinessCategoryField from '@/components/ui/PetBusinessCategoryField'
import { PROPERTY_OWNERSHIP_OPTIONS } from '@/lib/pet-business-categories'
import { deleteWorkstreamTemplate, deleteClient, getWorkstreamTemplates, saveClient, saveWorkstreamTemplate } from '@/lib/store'
import { type AgentDocumentSelection } from '@/lib/documentData'
import type { Client, Workstream, BusinessType, WorkstreamTemplate } from '@/lib/store'
import { getClientWorkstreamAgents } from '@/lib/workstream-agents'

interface Owner2Data {
  name: string
  email: string
  phone: string
}

interface DrivePickerFolder {
  id: string
  name: string
  url: string
}

type DrivePickerMode = 'existing' | 'parent'

const WS_OPTIONS = [
  { value: '', label: '— Not provisioned —' },
  { value: 'ws1', label: 'Workstream 1 — Risk Mitigation' },
  { value: 'ws2', label: 'Workstream 2 — Profitability & Growth' },
  { value: 'both', label: 'Workstream 1 + 2 (Both)' },
  { value: 'ma', label: 'M&A Process' },
]

const STAGE_OPTIONS = [
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'collection', label: 'Collection' },
  { value: 'review', label: 'Review' },
  { value: 'final', label: 'Final Report' },
  { value: 'closed', label: 'Closed' },
]

const AGENT_ICONS = {
  ttm: FileSpreadsheet,
  lease_analysis: Landmark,
  contract_analysis: Briefcase,
  insurance_review: ShieldCheck,
  employee_obligations: Users,
  professional_advisors: Handshake,
  vendor_directory: Network,
  org_chart_review: Network,
  litigation_search: AlertCircle,
  employee_comp: BadgeDollarSign,
  ownership_verification: Scale,
  permits_zoning: ClipboardList,
  owner_gm_assessment: Users,
  digital_presence: Globe2,
  competitor_analysis: Bot,
  facility_review: Camera,
  pricing_analysis: Tags,
  pricing_vertical: ChartNoAxesColumn,
  sales_process_review: MessageSquareText,
  meeting_notes: MessageSquareText,
  net_proceeds: Calculator,
  teaser: Sparkles,
  cim: FileText,
} as const

function getAgentIcon(agentId: string) {
  return AGENT_ICONS[agentId as keyof typeof AGENT_ICONS] ?? Bot
}

const AGENT_CATALOG = [
  { id: 'ttm', name: 'Valuation Agent', defaultDocumentIds: [] },
  { id: 'lease_analysis', name: 'Lease Analysis Agent', defaultDocumentIds: ['leases'] },
  { id: 'real_estate_appraisal', name: 'Real Estate Appraisal Agent', defaultDocumentIds: ['real_estate_appraisal'] },
  { id: 'contract_analysis', name: 'Material Contracts Agent', defaultDocumentIds: [] },
  { id: 'insurance_review', name: 'Insurance Review Agent', defaultDocumentIds: ['insurance_policies', 'insurance_claims_12m'] },
  { id: 'employee_obligations', name: 'Employee Obligations Agent', defaultDocumentIds: ['employee_list', 'key_employee_contracts', 'employee_comp_payroll'] },
  { id: 'professional_advisors', name: 'Professional Advisors Agent', defaultDocumentIds: [] },
  { id: 'vendor_directory', name: 'Software & Vendors Agent', defaultDocumentIds: ['vendor_contracts', 'material_contracts', 'software_subscriptions'] },
  { id: 'org_chart_review', name: 'Org Chart Review Agent', defaultDocumentIds: [] },
  { id: 'litigation_search', name: 'Litigation & Liens Agent', defaultDocumentIds: ['litigation_search_docs', 'pending_litigation'] },
  { id: 'employee_comp', name: 'Employee Staffing & Compensation Agent', defaultDocumentIds: [] },
  { id: 'ownership_verification', name: 'Ownership Verification Agent', defaultDocumentIds: ['articles_org', 'shareholder_agreement', 'ownership_structure'] },
  { id: 'permits_zoning', name: 'Permits & Zoning Agent', defaultDocumentIds: ['business_licenses', 'zoning_approval', 'certificate_occupancy', 'building_permits'] },
  { id: 'owner_gm_assessment', name: 'Owner & GM Assessment Agent', defaultDocumentIds: ['employee_list', 'org_chart', 'sop_manual'] },
  { id: 'digital_presence', name: 'Digital Presence Agent', defaultDocumentIds: [] },
  { id: 'competitor_analysis', name: 'Competitor Analysis Agent', defaultDocumentIds: [] },
  { id: 'facility_review', name: 'Facility Review Agent', defaultDocumentIds: ['health_safety', 'violations'] },
  { id: 'pricing_analysis', name: 'Competitive Pricing Analysis Agent', defaultDocumentIds: ['pricing_schedule', 'revenue_breakdown'] },
  { id: 'pricing_vertical', name: 'Pricing by Vertical Agent', defaultDocumentIds: ['revenue_breakdown', 'pricing_schedule'] },
  { id: 'sales_process_review', name: 'Sales Process Review Agent', defaultDocumentIds: ['sales_process_transcript', 'pricing_schedule'] },
  { id: 'client_location_map', name: 'Client Location Map Agent', defaultDocumentIds: [] },
  { id: 'meeting_notes', name: 'Meeting Notes Agent', defaultDocumentIds: ['meeting_notes'] },
  { id: 'net_proceeds', name: 'Net Proceeds Calculator Agent', defaultDocumentIds: [] },
  { id: 'teaser', name: 'Deal Teaser Generator Agent', defaultDocumentIds: [] },
  { id: 'cim', name: 'CIM Generator Agent', defaultDocumentIds: [] },
]

const SYSTEM_WORKSTREAM_AGENTS: Record<Exclude<Workstream, null>, AgentDocumentSelection[]> = {
  ws1: [
    { agentId: 'ttm', agentName: 'Valuation Agent', documentIds: [] },
    { agentId: 'employee_obligations', agentName: 'Employee Obligations Agent', documentIds: ['employee_list', 'key_employee_contracts', 'employee_comp_payroll'] },
    { agentId: 'employee_comp', agentName: 'Employee Staffing & Compensation Agent', documentIds: [] },
    { agentId: 'insurance_review', agentName: 'Insurance Review Agent', documentIds: ['insurance_policies', 'insurance_claims_12m'] },
    { agentId: 'lease_analysis', agentName: 'Lease Analysis Agent', documentIds: ['leases'] },
    { agentId: 'litigation_search', agentName: 'Litigation & Liens Agent', documentIds: ['litigation_search_docs', 'pending_litigation'] },
    { agentId: 'contract_analysis', agentName: 'Material Contracts Agent', documentIds: [] },
    { agentId: 'org_chart_review', agentName: 'Org Chart Review Agent', documentIds: [] },
    { agentId: 'owner_gm_assessment', agentName: 'Owner & GM Assessment Agent', documentIds: ['employee_list', 'org_chart', 'sop_manual'] },
    { agentId: 'ownership_verification', agentName: 'Ownership Verification Agent', documentIds: ['articles_org', 'shareholder_agreement', 'ownership_structure'] },
    { agentId: 'permits_zoning', agentName: 'Permits & Zoning Agent', documentIds: ['business_licenses', 'zoning_approval', 'certificate_occupancy', 'building_permits'] },
    { agentId: 'professional_advisors', agentName: 'Professional Advisors Agent', documentIds: [] },
    { agentId: 'vendor_directory', agentName: 'Software & Vendors Agent', documentIds: ['vendor_contracts', 'material_contracts', 'software_subscriptions'] },
    { agentId: 'client_location_map', agentName: 'Client Location Map Agent', documentIds: [] },
  ],
  ws2: [
    { agentId: 'ttm', agentName: 'Valuation Agent', documentIds: [] },
    { agentId: 'competitor_analysis', agentName: 'Competitor Analysis Agent', documentIds: [] },
    { agentId: 'digital_presence', agentName: 'Digital Presence Agent', documentIds: [] },
    { agentId: 'facility_review', agentName: 'Facility Review Agent', documentIds: ['health_safety', 'violations'] },
    { agentId: 'pricing_analysis', agentName: 'Competitive Pricing Analysis Agent', documentIds: ['pricing_schedule', 'revenue_breakdown'] },
    { agentId: 'pricing_vertical', agentName: 'Pricing by Vertical Agent', documentIds: ['revenue_breakdown', 'pricing_schedule'] },
    { agentId: 'sales_process_review', agentName: 'Sales Process Review Agent', documentIds: ['sales_process_transcript', 'pricing_schedule'] },
    { agentId: 'client_location_map', agentName: 'Client Location Map Agent', documentIds: [] },
  ],
  both: [],
  ma: [
    { agentId: 'ttm', agentName: 'Valuation Agent', documentIds: [] },
    { agentId: 'cim', agentName: 'CIM Generator Agent', documentIds: [] },
    { agentId: 'teaser', agentName: 'Deal Teaser Generator Agent', documentIds: [] },
    { agentId: 'net_proceeds', agentName: 'Net Proceeds Calculator Agent', documentIds: [] },
    { agentId: 'ownership_verification', agentName: 'Ownership Verification Agent', documentIds: ['articles_org', 'shareholder_agreement', 'ownership_structure'] },
    { agentId: 'litigation_search', agentName: 'Litigation & Liens Agent', documentIds: ['litigation_search_docs', 'pending_litigation'] },
  ],
}
SYSTEM_WORKSTREAM_AGENTS.both = [...SYSTEM_WORKSTREAM_AGENTS.ws1, ...SYSTEM_WORKSTREAM_AGENTS.ws2].filter(
  (agent, index, agents) => agents.findIndex(item => item.agentId === agent.agentId) === index,
)

function mergeAgents(baseAgents: AgentDocumentSelection[], extraAgents: AgentDocumentSelection[]) {
  return [...baseAgents, ...extraAgents].filter(
    (agent, index, agents) => agents.findIndex(item => item.agentId === agent.agentId) === index,
  )
}

function agentKey(agents: AgentDocumentSelection[]) {
  return agents.map(agent => agent.agentId).sort().join('|')
}

function agentsEqual(left: AgentDocumentSelection[], right: AgentDocumentSelection[]) {
  return agentKey(left) === agentKey(right)
}

function getBaseAgentsForClient(client: Client, customDraftMode: boolean): AgentDocumentSelection[] {
  if (customDraftMode) return []
  const excludeLeaseAgent = client.propertyOwnership === 'owns'
  const excludeAppraisalAgent = client.propertyOwnership !== 'owns'
  const keepPropertyAgent = (agent: { agentId: string }) =>
    (!excludeLeaseAgent || agent.agentId !== 'lease_analysis') &&
    (!excludeAppraisalAgent || agent.agentId !== 'real_estate_appraisal')
  if (client.workstreamAgents?.length) {
    return client.workstreamAgents.map(agent => ({
      agentId: agent.agentId,
      agentName: agent.agentName,
      documentIds: agent.documentIds,
    })).filter(keepPropertyAgent)
  }
  if (client.customWorkstream) {
    return client.customWorkstream.agents.map(agent => ({
      agentId: agent.agentId,
      agentName: agent.agentName,
      documentIds: agent.documentIds,
    })).filter(keepPropertyAgent)
  }
  return client.workstream
    ? (SYSTEM_WORKSTREAM_AGENTS[client.workstream] ?? []).filter(keepPropertyAgent)
    : []
}

function ProvisioningBadge({ client, customDraftMode }: { client: Client; customDraftMode: boolean }) {
  if (customDraftMode) {
    return <Badge color="gold">Custom workstream (draft)</Badge>
  }
  if (client.customWorkstream?.name?.trim()) {
    return <Badge color="gold">{client.customWorkstream.name.trim()}</Badge>
  }
  return <WorkstreamBadge ws={client.workstream} />
}

export default function ClientManager({ client: initial, onSaved, onDeleted, onDeleteError }: {
  client: Client
  onSaved: (c: Client) => void
  onDeleted?: () => void
  onDeleteError?: (message: string) => void
}) {
  const [client, setClient] = useState(initial)
  const [saved, setSaved] = useState(false)
  const [newBranch, setNewBranch] = useState('')
  const [newMember, setNewMember] = useState({ name: '', email: '', role: '' })
  const [newAdvisor, setNewAdvisor] = useState({ name: '', imageUrl: '', previewUrl: '' })
  const [addingMember, setAddingMember] = useState(false)
  const [addingAdvisor, setAddingAdvisor] = useState(false)
  const [uploadingAdvisorImage, setUploadingAdvisorImage] = useState(false)
  const [workstreamTemplates, setWorkstreamTemplates] = useState<WorkstreamTemplate[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [agentSearchOpen, setAgentSearchOpen] = useState(false)
  const [agentSearch, setAgentSearch] = useState('')
  const [draftWorkstreamName, setDraftWorkstreamName] = useState('')
  const [draftAgents, setDraftAgents] = useState<AgentDocumentSelection[]>([])
  const [customDraftMode, setCustomDraftMode] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [deletingTemplate, setDeletingTemplate] = useState(false)
  const [deletingClient, setDeletingClient] = useState(false)
  const [driveParentFolder, setDriveParentFolder] = useState('')
  const [driveFolderName, setDriveFolderName] = useState(initial.company || initial.name || '')
  const [driveExistingFolder, setDriveExistingFolder] = useState(initial.driveFolder || '')
  const [driveBusy, setDriveBusy] = useState(false)
  const [driveError, setDriveError] = useState('')
  const [drivePickerMode, setDrivePickerMode] = useState<DrivePickerMode | null>(null)
  const [drivePickerFolders, setDrivePickerFolders] = useState<DrivePickerFolder[]>([])
  const [drivePickerPath, setDrivePickerPath] = useState<DrivePickerFolder[]>([])
  const [drivePickerLoading, setDrivePickerLoading] = useState(false)
  const [drivePickerError, setDrivePickerError] = useState('')
  const advisorImageInputRef = useRef<HTMLInputElement | null>(null)

  // Second owner support — stored in sectionSubmissions.owner2
  const existingOwner2 = (initial.sectionSubmissions as any)?.owner2 as Owner2Data | undefined
  const [showOwner2, setShowOwner2] = useState(!!existingOwner2?.name || !!existingOwner2?.email || !!existingOwner2?.phone)
  const [owner2, setOwner2] = useState<Owner2Data>({
    name: existingOwner2?.name || '',
    email: existingOwner2?.email || '',
    phone: existingOwner2?.phone || '',
  })
  const [propertyOwnership, setPropertyOwnership] = useState<'lease' | 'owns' | ''>(
    initial.propertyOwnership === 'lease' || initial.propertyOwnership === 'owns'
      ? initial.propertyOwnership
      : '',
  )

  const update = <K extends keyof Client>(key: K, val: Client[K]) =>
    setClient(p => ({ ...p, [key]: val }))

  useEffect(() => {
    void getWorkstreamTemplates().then(setWorkstreamTemplates)
  }, [])

  useEffect(() => {
    if (customDraftMode) return
    if (client.workstreamAgents?.length) {
      setDraftWorkstreamName(client.customWorkstream?.name ?? '')
      const selected = getClientWorkstreamAgents(client).map(agent => ({
        agentId: agent.agentId,
        agentName: agent.agentName,
        documentIds: agent.documentIds ?? [],
      }))
      if (propertyOwnership === 'owns' && !selected.some(agent => agent.agentId === 'real_estate_appraisal')) {
        selected.push({ agentId: 'real_estate_appraisal', agentName: 'Real Estate Appraisal Agent', documentIds: ['real_estate_appraisal'] })
      }
      setDraftAgents(selected)
      return
    }
    const clientSpecificAgents = client.workstreamAgents?.map(agent => ({
      agentId: agent.agentId,
      agentName: agent.agentName,
      documentIds: agent.documentIds,
    })) ?? []
    if (client.customWorkstreamId && client.customWorkstream) {
      setDraftWorkstreamName(client.customWorkstream.name)
      const templateAgents = client.customWorkstream.agents.map(agent => ({
        agentId: agent.agentId,
        agentName: agent.agentName,
        documentIds: agent.documentIds,
      }))
      setDraftAgents(mergeAgents(templateAgents, clientSpecificAgents))
      return
    }
    setDraftWorkstreamName('')
    const systemAgents = client.workstream ? (SYSTEM_WORKSTREAM_AGENTS[client.workstream] ?? []) : []
    const filteredSystemAgents = systemAgents.filter(agent =>
      propertyOwnership === 'owns'
        ? agent.agentId !== 'lease_analysis'
        : agent.agentId !== 'real_estate_appraisal'
    )
    setDraftAgents(mergeAgents(filteredSystemAgents, clientSpecificAgents))
  }, [client.customWorkstreamId, client.customWorkstream, client.workstream, client.workstreamAgents, customDraftMode, propertyOwnership])

  const workstreamOptions = useMemo(() => [
    ...WS_OPTIONS,
    { value: 'custom', label: 'Custom workstream — blank' },
    ...workstreamTemplates.map(template => ({ value: `template:${template.id}`, label: template.name })),
  ], [workstreamTemplates])
  const availableAgents = useMemo(
    () => AGENT_CATALOG
      .filter(agent => !draftAgents.some(item => item.agentId === agent.id))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [draftAgents],
  )
  const filteredAgents = useMemo(() => {
    const q = agentSearch.trim().toLowerCase()
    if (!q) return availableAgents
    return availableAgents.filter(agent => agent.name.toLowerCase().includes(q))
  }, [agentSearch, availableAgents])

  const applyWorkstreamSelection = (value: string) => {
    if (value === 'custom') {
      setCustomDraftMode(true)
      setClient(p => ({ ...p, workstream: 'both', customWorkstreamId: null, customWorkstream: null, workstreamAgents: [] }))
      setDraftWorkstreamName('')
      setDraftAgents([])
      return
    }
    setCustomDraftMode(false)
    if (value.startsWith('template:')) {
      const template = workstreamTemplates.find(t => t.id === value.slice('template:'.length))
      setClient(p => ({ ...p, workstream: 'both', customWorkstreamId: template?.id ?? null, customWorkstream: template ?? null, workstreamAgents: [] }))
      return
    }
    setClient(p => ({ ...p, workstream: (value || null) as Workstream, customWorkstreamId: null, customWorkstream: null, workstreamAgents: [] }))
  }

  const addAgentToDraft = () => {
    const agent = AGENT_CATALOG.find(item => item.id === selectedAgentId)
    if (!agent || draftAgents.some(item => item.agentId === agent.id)) return
    setDraftAgents(prev => [...prev, { agentId: agent.id, agentName: agent.name, documentIds: [] }])
    setSelectedAgentId('')
    setAgentSearch('')
    setAgentSearchOpen(false)
  }

  const removeDraftAgent = (agentId: string) => {
    setDraftAgents(prev => prev.filter(agent => agent.agentId !== agentId))
  }

  const saveDraftWorkstream = async () => {
    if (!draftWorkstreamName.trim()) return
    setSavingTemplate(true)
    try {
      const savedTemplate = await saveWorkstreamTemplate({
        id: client.customWorkstreamId || undefined,
        name: draftWorkstreamName.trim(),
        agents: draftAgents,
      })
      if (!savedTemplate) return
      setWorkstreamTemplates(prev => [savedTemplate, ...prev.filter(template => template.id !== savedTemplate.id)])
      setCustomDraftMode(false)
      setClient(p => ({ ...p, workstream: 'both', customWorkstreamId: savedTemplate.id, customWorkstream: savedTemplate, workstreamAgents: [] }))
      setDraftAgents(savedTemplate.agents.map(agent => ({
        agentId: agent.agentId,
        agentName: agent.agentName,
        documentIds: agent.documentIds,
      })))
    } finally {
      setSavingTemplate(false)
    }
  }

  const deleteSelectedWorkstream = async () => {
    if (!client.customWorkstreamId || deletingTemplate) return
    const confirmed = window.confirm(`Delete "${client.customWorkstream?.name || 'this workstream'}" from the saved workstream dropdown? This will not delete the client.`)
    if (!confirmed) return
    setDeletingTemplate(true)
    try {
      const deleted = await deleteWorkstreamTemplate(client.customWorkstreamId)
      if (!deleted) return
      setWorkstreamTemplates(prev => prev.filter(template => template.id !== client.customWorkstreamId))
      setClient(p => ({ ...p, customWorkstreamId: null, customWorkstream: null }))
      setDraftWorkstreamName('')
    } finally {
      setDeletingTemplate(false)
    }
  }

  const handleSave = async () => {
    const now = new Date().toISOString()
    const isFirstProvision = client.workstream && !initial.provisionedAt

    // Merge owner2 into sectionSubmissions
    const existingSections = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object')
      ? client.sectionSubmissions
      : {}
    const mergedSectionSubmissions: Record<string, unknown> = { ...existingSections }
    if (showOwner2) {
      mergedSectionSubmissions.owner2 = {
        submittedAt: (existingSections.owner2 as any)?.submittedAt || now,
        name: owner2.name,
        email: owner2.email,
        phone: owner2.phone,
      }
    } else {
      delete mergedSectionSubmissions.owner2
    }
    if (propertyOwnership) {
      mergedSectionSubmissions.propertyOwnership = propertyOwnership
    } else {
      delete mergedSectionSubmissions.propertyOwnership
    }

    const nextPropertyOwnership: Client['propertyOwnership'] = propertyOwnership || ''
    const nextClient = {
      ...client,
      propertyOwnership: nextPropertyOwnership,
      sectionSubmissions: mergedSectionSubmissions as Client['sectionSubmissions'],
    }
    const baseAgents = getBaseAgentsForClient(nextClient, customDraftMode)
    const normalizedDraftAgents = nextPropertyOwnership === 'owns'
      ? [
          ...draftAgents.filter(agent => agent.agentId !== 'lease_analysis'),
          ...(draftAgents.some(agent => agent.agentId === 'real_estate_appraisal')
            ? []
            : [{ agentId: 'real_estate_appraisal', agentName: 'Real Estate Appraisal Agent', documentIds: ['real_estate_appraisal'] }]),
        ]
      : draftAgents.filter(agent => agent.agentId !== 'real_estate_appraisal')
    const updated = {
      ...nextClient,
      provisionedAt: isFirstProvision ? now : client.provisionedAt,
      workstreamAgents: (agentsEqual(baseAgents, normalizedDraftAgents) ? [] : normalizedDraftAgents).map(agent => ({ id: agent.agentId, ...agent })),
    }
    saveClient(updated)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onSaved(updated)
  }

  const handleDeleteClient = async () => {
    const label = client.company || client.name
    const confirmed = window.confirm(
      `Permanently delete "${label}"?\n\nThis removes the client workspace, uploaded documents, agent reports, messages, and the portal login for ${client.email}. This cannot be undone.`,
    )
    if (!confirmed) return

    setDeletingClient(true)
    try {
      await deleteClient(client.id)
      onDeleted?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete client'
      onDeleteError?.(message)
    } finally {
      setDeletingClient(false)
    }
  }

  const saveDriveFolder = async (folderUrl: string) => {
    const trimmed = folderUrl.trim()
    if (!trimmed) return
    const updated = { ...client, driveFolder: trimmed }
    setClient(updated)
    setDriveExistingFolder(trimmed)
    const savedClient = await saveClient(updated)
    if (savedClient) {
      setClient(savedClient)
      onSaved(savedClient)
    } else {
      onSaved(updated)
    }
  }

  const createDriveFolder = async () => {
    const folderName = driveFolderName.trim()
    const parentFolder = driveParentFolder.trim()
    if (!folderName || !parentFolder || driveBusy) return
    setDriveBusy(true)
    setDriveError('')
    try {
      const res = await fetch('/api/drive/create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName: folderName, clientId: client.id, parentFolder }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to create Google Drive folder')
      await saveDriveFolder(data.folderUrl)
      setDriveParentFolder('')
    } catch (error) {
      setDriveError(error instanceof Error ? error.message : 'Failed to create Google Drive folder')
    } finally {
      setDriveBusy(false)
    }
  }

  const setExistingDriveFolder = async () => {
    if (!driveExistingFolder.trim() || driveBusy) return
    setDriveBusy(true)
    setDriveError('')
    try {
      await saveDriveFolder(driveExistingFolder)
    } catch (error) {
      setDriveError(error instanceof Error ? error.message : 'Failed to save Google Drive folder')
    } finally {
      setDriveBusy(false)
    }
  }

  const clearDriveFolder = async () => {
    if (!client.driveFolder || driveBusy) return
    setDriveBusy(true)
    setDriveError('')
    try {
      const updated = { ...client, driveFolder: null }
      setClient(updated)
      setDriveExistingFolder('')
      const savedClient = await saveClient(updated)
      onSaved(savedClient || updated)
    } catch (error) {
      setDriveError(error instanceof Error ? error.message : 'Failed to clear Google Drive folder')
    } finally {
      setDriveBusy(false)
    }
  }

  const loadDriveFolders = async (parent?: DrivePickerFolder | null, nextPath?: DrivePickerFolder[]) => {
    const parentId = parent?.id || 'root'
    setDrivePickerLoading(true)
    setDrivePickerError('')
    try {
      const res = await fetch(`/api/drive/folders?parentId=${encodeURIComponent(parentId)}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not load Google Drive folders')
      setDrivePickerFolders(Array.isArray(data.folders) ? data.folders : [])
      if (nextPath) setDrivePickerPath(nextPath)
    } catch (error) {
      setDrivePickerError(error instanceof Error ? error.message : 'Could not load Google Drive folders')
      setDrivePickerFolders([])
    } finally {
      setDrivePickerLoading(false)
    }
  }

  const openDrivePicker = (mode: DrivePickerMode) => {
    setDrivePickerMode(mode)
    setDrivePickerPath([])
    void loadDriveFolders(null, [])
  }

  const closeDrivePicker = () => {
    setDrivePickerMode(null)
    setDrivePickerError('')
  }

  const currentDrivePickerFolder = drivePickerPath[drivePickerPath.length - 1] || null

  const selectDrivePickerFolder = async () => {
    if (!currentDrivePickerFolder || !drivePickerMode) return
    if (drivePickerMode === 'parent') {
      setDriveParentFolder(currentDrivePickerFolder.url)
      closeDrivePicker()
      return
    }
    closeDrivePicker()
    setDriveExistingFolder(currentDrivePickerFolder.url)
    await saveDriveFolder(currentDrivePickerFolder.url)
  }

  const addBranch = () => {
    if (!newBranch.trim()) return
    update('branches', [...client.branches, { id: 'b' + Date.now(), name: newBranch.trim() }])
    setNewBranch('')
  }

  const removeBranch = (id: string) => update('branches', client.branches.filter(b => b.id !== id))

  const addMember = () => {
    if (!newMember.name || !newMember.email) return
    update('teamMembers', [...client.teamMembers, { id: 'tm' + Date.now(), ...newMember }])
    setNewMember({ name: '', email: '', role: '' })
    setAddingMember(false)
  }

  const removeMember = (id: string) => update('teamMembers', client.teamMembers.filter(m => m.id !== id))

  const addAdvisor = () => {
    if (!newAdvisor.name || !newAdvisor.imageUrl) return
    const nextAdvisors = [...client.advisors, { id: 'adv' + Date.now(), name: newAdvisor.name, imageUrl: newAdvisor.imageUrl }]
    const nextClient = { ...client, advisors: nextAdvisors }
    setClient(nextClient)
    void saveClient(nextClient).then((savedClient) => {
      if (savedClient) {
        setClient(savedClient)
        onSaved(savedClient)
      }
    })
    setNewAdvisor({ name: '', imageUrl: '', previewUrl: '' })
    setAddingAdvisor(false)
  }

  const removeAdvisor = (id: string) => {
    const nextClient = { ...client, advisors: client.advisors.filter(a => a.id !== id) }
    setClient(nextClient)
    void saveClient(nextClient).then((savedClient) => {
      if (savedClient) {
        setClient(savedClient)
        onSaved(savedClient)
      }
    })
  }

  const handleAdvisorImageUpload = async (file?: File | null) => {
    if (!file) return
    setUploadingAdvisorImage(true)
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Failed to read image'))
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read image'))
      reader.readAsDataURL(file)
    }).catch(() => '')

    if (dataUrl) {
      setNewAdvisor(p => ({ ...p, imageUrl: dataUrl, previewUrl: dataUrl }))
    }

    try {
      const form = new FormData()
      form.append('file', file)
      form.append('clientId', client.id)
      const res = await fetch('/api/advisor-images/upload', {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        throw new Error(await res.text())
      }
      await res.json()
    } catch (error) {
      console.error(error)
    } finally {
      setUploadingAdvisorImage(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Identity */}
      <section>
        <h4 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-100">Client Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Primary contact name" value={client.name} onChange={e => update('name', e.target.value)} />
          <Input label="Email address" type="email" value={client.email} onChange={e => update('email', e.target.value)} />
          <Input label="Business name" value={client.company} onChange={e => update('company', e.target.value)} />
          <Input label="Phone" value={client.phone} onChange={e => update('phone', e.target.value)} />
        </div>

        {/* Second Owner */}
        {!showOwner2 ? (
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={() => setShowOwner2(true)}>
              <UserPlus className="w-3.5 h-3.5" /> Add Second Contact Person
            </Button>
          </div>
        ) : (
          <div className="mt-4 p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-medium text-slate-700">Second Contact Person</h5>
              <button
                onClick={() => {
                  setShowOwner2(false)
                  setOwner2({ name: '', email: '', phone: '' })
                }}
                className="text-slate-400 hover:text-rose-400 transition-colors"
                title="Remove second contact person"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Full name" value={owner2.name} onChange={e => setOwner2(p => ({ ...p, name: e.target.value }))} />
              <Input label="Email address" type="email" value={owner2.email} onChange={e => setOwner2(p => ({ ...p, email: e.target.value }))} />
              <Input label="Phone" value={owner2.phone} onChange={e => setOwner2(p => ({ ...p, phone: e.target.value }))} />
            </div>
          </div>
        )}
      </section>

      <section>
        <h4 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-100">Business Market Profile</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <PetBusinessCategoryField
              value={client.businessCategory}
              onChange={value => update('businessCategory', value)}
            />
          </div>
          <Select
            label="Real estate"
            value={propertyOwnership}
            onChange={e => setPropertyOwnership(e.target.value as 'lease' | 'owns' | '')}
            options={PROPERTY_OWNERSHIP_OPTIONS}
          />
          <Input
            label="Website URL"
            placeholder="https://www.example.com"
            value={client.websiteUrl}
            onChange={e => update('websiteUrl', e.target.value)}
          />
        </div>
        <div className="mt-4">
          <Textarea
            label="Primary business address"
            placeholder="123 Main St, Suite 200, Seattle, WA 98101"
            value={client.businessAddress}
            onChange={e => update('businessAddress', e.target.value)}
            rows={3}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          These fields are used by the Competitor Analysis Agent to search nearby competing businesses and compare services, pricing, reputation, and hours.
        </p>
      </section>

      {/* Workstream provisioning (was Monday dropdown) */}
      <section>
        <h4 className="text-sm font-semibold text-slate-700 mb-1 pb-2 border-b border-slate-100 flex items-center gap-2">
          Workstream Provisioning
          <span className="text-xs font-normal text-slate-400">— controls what documents the client sees</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Select
            label="Workstream"
            value={customDraftMode ? 'custom' : client.customWorkstreamId ? `template:${client.customWorkstreamId}` : client.workstream ?? ''}
            onChange={e => applyWorkstreamSelection(e.target.value)}
            options={workstreamOptions}
          />
          <Select
            label="Stage"
            value={client.stage}
            onChange={e => update('stage', e.target.value as Client['stage'])}
            options={STAGE_OPTIONS}
          />
        </div>
        {client.workstream && (
          <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-700">
            ✓ Client is provisioned on <ProvisioningBadge client={client} customDraftMode={customDraftMode} /> — their portal will show documents based on the selected agents.
          </div>
        )}
        {!client.workstream && (
          <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500">
            Workstream not yet assigned. The client portal will not show document requirements until a workstream is selected.
          </div>
        )}
      </section>

      {client.workstream && (
        <section>
          <h4 className="text-sm font-semibold text-slate-700 mb-1 pb-2 border-b border-slate-100 flex items-center gap-2">
            <Bot className="w-4 h-4" /> Workstream Agents
            <span className="text-xs font-normal text-slate-400">— agent docs are requested in client portal</span>
          </h4>
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-4 items-start">
            <div className="max-h-[420px] overflow-y-auto pr-2 space-y-3 rounded-xl">
              {draftAgents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-400">
                  Blank workstream. Add agents here. Client portal will request documents based on backend agent-document mapping. Valuation documents still show in portal.
                </div>
              ) : draftAgents.map(agent => (
                <div key={agent.agentId} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
                  {(() => {
                    const Icon = getAgentIcon(agent.agentId)
                    return (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                    <Icon className="w-4 h-4" />
                  </div>
                    )
                  })()}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">{agent.agentName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Document requests are resolved from agent-document mapping.</p>
                  </div>
                  <button onClick={() => removeDraftAgent(agent.agentId)} className="text-slate-300 hover:text-rose-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 h-fit space-y-3">
              <div className="relative space-y-1.5">
                <label className="block text-xs font-medium text-slate-600">Add agent</label>
                <button
                  type="button"
                  onClick={() => setAgentSearchOpen(open => !open)}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition-all hover:border-amber-300 focus:border-cantara-gold focus:outline-none focus:ring-2 focus:ring-cantara-gold/20"
                >
                  <span className={selectedAgentId ? 'text-slate-800' : 'text-slate-400'}>
                    {AGENT_CATALOG.find(agent => agent.id === selectedAgentId)?.name || 'Search agents...'}
                  </span>
                  <Search className="h-4 w-4 text-slate-300" />
                </button>

                {agentSearchOpen && (
                  <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                    <div className="border-b border-slate-100 p-2">
                      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                        <Search className="h-3.5 w-3.5 text-slate-400" />
                        <input
                          autoFocus
                          value={agentSearch}
                          onChange={e => setAgentSearch(e.target.value)}
                          placeholder="Type agent name..."
                          className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-1">
                      {filteredAgents.length === 0 ? (
                        <div className="px-3 py-3 text-xs text-slate-400">No agents found.</div>
                      ) : filteredAgents.map(agent => (
                        (() => {
                          const Icon = getAgentIcon(agent.id)
                          return (
                        <button
                          key={agent.id}
                          type="button"
                          onClick={() => {
                            setSelectedAgentId(agent.id)
                            setAgentSearchOpen(false)
                            setAgentSearch('')
                          }}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                            selectedAgentId === agent.id ? 'bg-amber-50 text-amber-700' : 'text-slate-700 hover:bg-slate-50',
                          )}
                        >
                          <Icon className={cn('h-3.5 w-3.5 shrink-0', selectedAgentId === agent.id ? 'text-amber-500' : 'text-slate-300')} />
                          <span className="min-w-0 flex-1 truncate">{agent.name}</span>
                        </button>
                          )
                        })()
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={addAgentToDraft} disabled={!selectedAgentId}>
                <Plus className="w-3.5 h-3.5" /> Add Agent
              </Button>
              <div className="pt-3 border-t border-amber-100 space-y-3">
                <Input
                  label="Save as workstream"
                  placeholder="e.g. Growth diligence"
                  value={draftWorkstreamName}
                  onChange={e => setDraftWorkstreamName(e.target.value)}
                />
                <Button size="sm" onClick={() => void saveDraftWorkstream()} disabled={!draftWorkstreamName.trim() || savingTemplate}>
                  {savingTemplate ? 'Saving...' : 'Save Workstream'}
                </Button>
                {client.customWorkstreamId && (
                  <Button size="sm" variant="outline" onClick={() => void deleteSelectedWorkstream()} disabled={deletingTemplate}>
                    <Trash2 className="w-3.5 h-3.5" />
                    {deletingTemplate ? 'Deleting...' : 'Delete Workstream'}
                  </Button>
                )}
              </div>
              <p className="text-xs text-amber-700">
                Business valuation documents are always requested separately. Some agents can have no mapped documents.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Business structure */}
      <section>
        <h4 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-100">Business Structure</h4>
        <div className="flex gap-3 mb-4">
          {(['single', 'multi', 'parent'] as BusinessType[]).map(type => (
            <button
              key={type}
              onClick={() => update('businessType', type)}
              className={`flex-1 py-3 px-4 rounded-xl border text-xs font-medium transition-all ${
                client.businessType === type
                  ? 'border-amber-400 bg-amber-50 text-amber-700'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              <Building2 className="w-4 h-4 mx-auto mb-1" />
              {type === 'single' ? 'Single Location' : type === 'multi' ? 'Multiple Locations' : 'Parent Company'}
            </button>
          ))}
        </div>

        {(client.businessType === 'multi' || client.businessType === 'parent') && (
          <div>
            <p className="text-xs text-slate-500 mb-3">
              {client.businessType === 'parent'
                ? 'Shareholders agreement sits at parent entity level. Financials, leases, and licenses are required per branch.'
                : 'All document requirements are duplicated per branch.'}
            </p>
            <div className="space-y-2 mb-3">
              {client.branches.map(b => (
                <div key={b.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="flex-1 text-sm text-slate-700">{b.name}</span>
                  <button onClick={() => removeBranch(b.id)} className="text-slate-300 hover:text-rose-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Branch name (e.g. Seattle – Capitol Hill)"
                value={newBranch}
                onChange={e => setNewBranch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addBranch() }}
              />
              <Button variant="outline" onClick={addBranch} disabled={!newBranch.trim()}>Add</Button>
            </div>
          </div>
        )}
      </section>

      {/* Advisors */}
      <section>
        <h4 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
          <Briefcase className="w-4 h-4" /> Advisor Team
        </h4>
        <div className="space-y-2 mb-3">
          {client.advisors.map(a => (
            <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <img src={a.imageUrl} alt={a.name} className="w-10 h-10 rounded-full object-cover bg-slate-200" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{a.name}</p>
                <p className="text-xs text-slate-400">Client-facing advisor</p>
              </div>
              <button onClick={() => removeAdvisor(a.id)} className="text-slate-300 hover:text-rose-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        {addingAdvisor ? (
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 space-y-3">
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-[minmax(0,1fr)_220px] gap-3 items-start">
                <Input
                  placeholder="Advisor name"
                  value={newAdvisor.name}
                  onChange={e => setNewAdvisor(p => ({ ...p, name: e.target.value }))}
                />
                <div className="flex items-center justify-end gap-2 pt-0.5">
                  <Button variant="ghost" size="sm" onClick={() => setAddingAdvisor(false)}>Cancel</Button>
                  <Button size="sm" onClick={addAdvisor} disabled={!newAdvisor.name || !newAdvisor.imageUrl || uploadingAdvisorImage}>Add Advisor</Button>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-white px-4 py-3">
                <input
                  ref={advisorImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={e => void handleAdvisorImageUpload(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden bg-amber-50 border border-amber-100 shrink-0 flex items-center justify-center">
                    {newAdvisor.previewUrl || newAdvisor.imageUrl ? (
                      <img src={newAdvisor.previewUrl || newAdvisor.imageUrl} alt="Advisor preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-amber-600" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700">
                      {uploadingAdvisorImage ? 'Uploading advisor image...' : newAdvisor.previewUrl || newAdvisor.imageUrl ? 'Advisor image selected' : 'Upload advisor image'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      JPG, PNG, or WebP. Maximum file size: 5MB. This image will appear in the client portal.
                    </p>
                    {uploadingAdvisorImage && (
                      <div className="mt-2 inline-flex items-center gap-2 text-xs text-amber-700">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Uploading...
                      </div>
                    )}
                    {!uploadingAdvisorImage && (newAdvisor.previewUrl || newAdvisor.imageUrl) && (
                      <div className="mt-2 inline-flex items-center gap-2 text-xs text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Image ready
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={uploadingAdvisorImage}
                    onClick={() => advisorImageInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 transition-all hover:bg-amber-100 shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {uploadingAdvisorImage ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    {uploadingAdvisorImage ? 'Uploading' : newAdvisor.previewUrl || newAdvisor.imageUrl ? 'Replace Image' : 'Choose File'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setAddingAdvisor(true)}>
            <Plus className="w-3.5 h-3.5" /> Add Advisor
          </Button>
        )}
      </section>

      {/* Team members */}
      <section>
        <h4 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
          <Users className="w-4 h-4" /> Client Team Members
        </h4>
        <div className="space-y-2 mb-3">
          {client.teamMembers.map(m => (
            <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600">
                {m.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{m.name}</p>
                <p className="text-xs text-slate-400">{m.email} · {m.role}</p>
              </div>
              <button onClick={() => removeMember(m.id)} className="text-slate-300 hover:text-rose-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        {addingMember ? (
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input placeholder="Name" value={newMember.name} onChange={e => setNewMember(p => ({ ...p, name: e.target.value }))} />
              <Input placeholder="Email" value={newMember.email} onChange={e => setNewMember(p => ({ ...p, email: e.target.value }))} />
              <Input placeholder="Role (e.g. Accountant)" value={newMember.role} onChange={e => setNewMember(p => ({ ...p, role: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setAddingMember(false)}>Cancel</Button>
              <Button size="sm" onClick={addMember} disabled={!newMember.name || !newMember.email}>Add Member</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setAddingMember(true)}>
            <Plus className="w-3.5 h-3.5" /> Add Team Member
          </Button>
        )}
      </section>

      {/* Google Drive */}
      <section>
        <h4 className="text-sm font-semibold text-slate-700 mb-3 pb-2 border-b border-slate-100">Google Drive Location</h4>
        {client.driveFolder ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-sm text-slate-600 flex-1 truncate">{client.driveFolder}</span>
              <a href={client.driveFolder} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:text-amber-700 shrink-0" title="Open folder">
                <ExternalLink className="w-4 h-4" />
              </a>
              <button onClick={() => void clearDriveFolder()} disabled={driveBusy} className="text-slate-300 hover:text-rose-400 transition-colors disabled:opacity-50" title="Clear folder">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
              <Input
                label="Replace with existing Drive folder URL or ID"
                placeholder="https://drive.google.com/drive/folders/..."
                value={driveExistingFolder}
                onChange={e => setDriveExistingFolder(e.target.value)}
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => openDrivePicker('existing')} disabled={driveBusy}>
                  <FolderOpen className="w-3.5 h-3.5" />
                  Choose
                </Button>
                <Button variant="outline" onClick={() => void setExistingDriveFolder()} disabled={driveBusy || !driveExistingFolder.trim()}>
                  {driveBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                  Set Folder
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 space-y-4">
            <p className="text-sm text-slate-500">
              Choose an existing Google Drive folder for this client.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
              <Input
                label="Existing client folder URL or ID"
                placeholder="https://drive.google.com/drive/folders/..."
                value={driveExistingFolder}
                onChange={e => setDriveExistingFolder(e.target.value)}
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => openDrivePicker('existing')} disabled={driveBusy}>
                  <FolderOpen className="w-3.5 h-3.5" />
                  Choose
                </Button>
                <Button variant="outline" onClick={() => void setExistingDriveFolder()} disabled={driveBusy || !driveExistingFolder.trim()}>
                  {driveBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                  Set Folder
                </Button>
              </div>
            </div>
          </div>
        )}
        {driveError && (
          <p className="mt-2 text-xs text-red-600">{driveError}</p>
        )}
      </section>

      <Modal
        open={drivePickerMode !== null}
        onClose={closeDrivePicker}
        title={drivePickerMode === 'parent' ? 'Choose Parent Folder' : 'Choose Client Folder'}
        sizeClassName="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <button
              type="button"
              onClick={() => void loadDriveFolders(null, [])}
              className={cn('font-medium hover:text-amber-700', drivePickerPath.length === 0 ? 'text-slate-800' : 'text-slate-500')}
            >
              My Drive
            </button>
            {drivePickerPath.map((folder, index) => (
              <span key={folder.id} className="inline-flex items-center gap-2">
                <ChevronRight className="h-3 w-3 text-slate-300" />
                <button
                  type="button"
                  onClick={() => void loadDriveFolders(folder, drivePickerPath.slice(0, index + 1))}
                  className={cn('font-medium hover:text-amber-700', index === drivePickerPath.length - 1 ? 'text-slate-800' : 'text-slate-500')}
                >
                  {folder.name}
                </button>
              </span>
            ))}
          </div>

          <div className="min-h-[260px] max-h-[360px] overflow-y-auto rounded-xl border border-slate-200 bg-white">
            {drivePickerLoading ? (
              <div className="flex h-40 items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading folders...
              </div>
            ) : drivePickerError ? (
              <div className="p-4 text-sm text-red-600">{drivePickerError}</div>
            ) : drivePickerFolders.length === 0 ? (
              <div className="p-4 text-sm text-slate-400">No folders found here.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {drivePickerFolders.map(folder => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => void loadDriveFolders(folder, [...drivePickerPath, folder])}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-amber-50"
                  >
                    <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
                    <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              {currentDrivePickerFolder
                ? `Selected: ${currentDrivePickerFolder.name}`
                : 'Open a folder, then select the current folder.'}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={closeDrivePicker}>Cancel</Button>
              <Button onClick={() => void selectDrivePickerFolder()} disabled={!currentDrivePickerFolder || driveBusy}>
                {drivePickerMode === 'parent' ? 'Use as Parent' : 'Set as Client Folder'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Notes */}
      <section>
        <Textarea
          label="Internal advisor notes"
          placeholder="Notes visible to the advisor team only..."
          rows={4}
          value={client.notes}
          onChange={e => update('notes', e.target.value)}
        />
      </section>

      {/* Save */}
      <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
        <Button onClick={handleSave}>{saved ? '✓ Saved' : 'Save Changes'}</Button>
        <span className="text-xs text-slate-400">Changes update the client portal immediately.</span>
      </div>

      {/* Danger zone */}
      <section className="pt-6 mt-6 border-t border-red-100">
        <h4 className="text-sm font-semibold text-red-700 mb-1">Danger zone</h4>
        <p className="text-xs text-slate-500 mb-4">
          Permanently delete this client workspace, all associated data, and the portal login. This action cannot be undone.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDeleteClient}
          disabled={deletingClient}
          className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
        >
          {deletingClient ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          {deletingClient ? 'Deleting...' : 'Delete Client'}
        </Button>
      </section>
    </div>
  )
}
