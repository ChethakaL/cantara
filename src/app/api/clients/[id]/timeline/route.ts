import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractMeetingNotesText } from '@/lib/meetings'
import { getDocsForWorkstream, getValuationDocsForWorkstream } from '@/lib/documentData'
import { CLIENT_PORTAL_INVITE_DOCUMENT_ID, CLIENT_PORTAL_INVITE_REMINDER_DAYS, CLIENT_PORTAL_INVITE_TARGET_DEADLINE } from '@/lib/client-portal-invite'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STAGES = [
  { key: 'setup-client', label: 'Setup Client', description: 'Client created manually or imported from Monday.', notes: false },
  { key: 'send-invitation', label: 'Send Invitation Email', description: 'Review and send the client portal invitation.', notes: false },
  { key: 'onboarding-call', label: 'Onboarding Call', description: 'Complete the onboarding call and capture notes.', notes: true },
  { key: 'client-documents', label: 'Client Uploads Documents', description: 'All required client documents are uploaded or marked unavailable.', notes: false },
  { key: 'facility-review-call', label: 'Facility Review Call', description: 'Complete the facility review call and capture notes.', notes: true },
  { key: 'owner-involvement-call', label: 'Owner Involvement Call', description: 'Complete the owner involvement call and capture notes.', notes: true },
  { key: 'run-agents', label: 'Run Agents', description: 'Run the assigned agents after the preparation steps are complete.', notes: false },
] as const

function stageDefinitions() { return STAGES.map(stage => ({ ...stage })) }

async function getAutomaticCompletion(clientId: string) {
  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { createdAt: true, workstream: true, businessType: true, sectionSubmissions: true, ClientDocumentStatuses: true, ClientDocument: true },
  })
  if (!client) return null
  const submissions = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object' ? client.sectionSubmissions : {}) as Record<string, any>
  const invitation = await (prisma as any).clientEmailNotification.findFirst({
    where: { clientId, type: 'CLIENT_PORTAL_INVITE', documentId: CLIENT_PORTAL_INVITE_DOCUMENT_ID, reminderDaysBefore: CLIENT_PORTAL_INVITE_REMINDER_DAYS, targetDeadline: CLIENT_PORTAL_INVITE_TARGET_DEADLINE, status: 'SENT' },
    select: { sentAt: true },
  })
  const workstream = (client.workstream?.toLowerCase() || '') as any
  const required = workstream ? [...getValuationDocsForWorkstream(workstream), ...getDocsForWorkstream(workstream, client.businessType as any).flatMap(category => category.documents)].filter(doc => doc.type === 'required') : []
  const statuses = new Map((client.ClientDocumentStatuses || []).map((row: any) => [row.documentId, row]))
  const uploaded = new Set((client.ClientDocument || []).map((row: any) => row.documentId))
  const missingDocuments = required.filter(doc => {
    const status = statuses.get(doc.id)
    return !(uploaded.has(doc.id) || Boolean(status?.hasDoc || status?.notApplicable || status?.unavailableDecision))
  })
  const documentsComplete = required.length > 0 && missingDocuments.length === 0
  const hasAnyAgentOutput = Object.keys(submissions).some(key => /Report|report|Analysis|analysis|Review|review|Assessment|assessment|roadmap/i.test(key))
  return {
    'setup-client': true,
    'send-invitation': Boolean(invitation),
    'client-documents': documentsComplete,
    'run-agents': hasAnyAgentOutput,
    missingDocuments: missingDocuments.map((doc: any) => ({ id: doc.id, name: doc.name || doc.label || doc.title || doc.id })),
  }
}

async function loadTimeline(clientId: string) {
  const automatic = await getAutomaticCompletion(clientId)
  if (!automatic) return null
  const existing = await (prisma as any).clientTimelineStage.findMany({ where: { clientId } })
  const byKey = new Map<string, any>(existing.map((stage: any) => [stage.stageKey, stage]))
  const stages = stageDefinitions().map(stage => {
    const saved = byKey.get(stage.key)
    const notesSaved = Boolean(saved?.notesText || saved?.notesFileName)
    const autoCompleted = Boolean((automatic as any)[stage.key]) || (stage.notes && notesSaved)
    const completed = Boolean(saved?.manualOverride ? saved.status === 'COMPLETED' : saved?.status === 'COMPLETED' || autoCompleted)
    return { ...stage, ...(saved || {}), autoCompleted, completed, status: completed ? 'COMPLETED' : 'PENDING', missingDocuments: stage.key === 'client-documents' ? (automatic as any).missingDocuments : undefined }
  })
  return { stages }
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const timeline = await loadTimeline(params.id)
  if (!timeline) return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
  return NextResponse.json(timeline)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const stageKey = String(body.stageKey || '')
    const definition = STAGES.find(stage => stage.key === stageKey)
    if (!definition) return NextResponse.json({ error: 'Invalid timeline stage.' }, { status: 400 })
    const completed = Boolean(body.completed)
    const item = await (prisma as any).clientTimelineStage.upsert({
      where: { clientId_stageKey: { clientId: params.id, stageKey } },
      update: { status: completed ? 'COMPLETED' : 'PENDING', manualOverride: true, completedAt: completed ? new Date() : null, completedBy: body.completedBy ? String(body.completedBy) : null },
      create: { clientId: params.id, stageKey, status: completed ? 'COMPLETED' : 'PENDING', manualOverride: true, completedAt: completed ? new Date() : null, completedBy: body.completedBy ? String(body.completedBy) : null },
    })
    return NextResponse.json({ item, timeline: await loadTimeline(params.id) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not update timeline.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const form = await req.formData()
    const stageKey = String(form.get('stageKey') || '')
    const definition = STAGES.find(stage => stage.key === stageKey && stage.notes)
    if (!definition) return NextResponse.json({ error: 'This stage does not accept notes.' }, { status: 400 })
    const file = form.get('file')
    const text = String(form.get('notesText') || '').trim()
    let notesText = text
    let notesFileName: string | null = null
    if (file instanceof File) {
      notesText = await extractMeetingNotesText(file)
      notesFileName = file.name
    }
    if (!notesText) return NextResponse.json({ error: 'Add notes or upload a PDF/text file.' }, { status: 400 })
    const item = await (prisma as any).clientTimelineStage.upsert({
      where: { clientId_stageKey: { clientId: params.id, stageKey } },
      update: { notesText, notesFileName, notesUploadedAt: new Date() },
      create: { clientId: params.id, stageKey, notesText, notesFileName, notesUploadedAt: new Date() },
    })
    return NextResponse.json({ item, timeline: await loadTimeline(params.id) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not save notes.' }, { status: 500 })
  }
}
