import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { assertS3Configured, s3BucketName, s3Client } from '@/lib/s3'
import { createAgentMessage, type AgentMessageBlock } from '@/lib/llm-completion'
import { parseAnalyzeProvider, assertOpenAiConfiguredForAnalyze } from '@/lib/agent-analyze-provider'
import { resolveAgentModelId } from '@/lib/agent-model-provider.server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300
const MAX_BYTES = 25 * 1024 * 1024
const ACCEPTED = new Set(['.pdf', '.xlsx', '.xls', '.csv', '.docx'])
const MIME: Record<string, string> = {
  '.pdf': 'application/pdf', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel', '.csv': 'text/csv',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}
function ext(name: string) { return name.toLowerCase().match(/\.[^.]+$/)?.[0] || '' }
function parseJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = cleaned.indexOf('{'), end = cleaned.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('The selected model did not return a JSON valuation report.')
  return JSON.parse(cleaned.slice(start, end + 1))
}

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return new Response('clientId is required', { status: 400 })
  try {
    const client = await prisma.clientProfile.findUnique({ where: { id: clientId }, select: { clientRelease: true } })
    const releases = (client?.clientRelease && typeof client.clientRelease === 'object' ? client.clientRelease : {}) as Record<string, any>
    const release = releases.ttmAnalysis ?? releases.ttm
    const report = await prisma.externalValuationReport.findFirst({
      where: { clientId, ...(release?.releaseSource === 'external' && typeof release.externalReportId === 'string' ? { id: release.externalReportId } : {}) },
      orderBy: { createdAt: 'desc' },
      select: { id: true, clientId: true, fileName: true, mimeType: true, fileSize: true, reportJson: true, createdAt: true },
    })
    return NextResponse.json({ report, releaseSource: release?.releaseSource === 'external' ? 'external' : release?.releaseSource === 'agent' ? 'agent' : null })
  } catch (error) {
    console.error('[ttm-agent/external-report GET]', error)
    return NextResponse.json({ error: 'Unable to load external valuation report.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let storageKey: string | undefined
  try {
    assertS3Configured()
    const form = await req.formData()
    const clientId = String(form.get('clientId') || '').trim()
    const file = form.get('file')
    if (!clientId || !(file instanceof File) || !file.size) return new Response('clientId and a report file are required', { status: 400 })
    const extension = ext(file.name)
    if (!ACCEPTED.has(extension)) return new Response('Upload a PDF, Excel, CSV, or Word document (.docx).', { status: 400 })
    if (file.size > MAX_BYTES) return new Response('File exceeds the 25 MB limit.', { status: 413 })
    const clientProfile = await prisma.clientProfile.findUnique({ where: { id: clientId }, select: { businessName: true } })
    if (!clientProfile) return new Response('Client not found', { status: 404 })
    const provider = parseAnalyzeProvider(form.get('provider'))
    const modelId = resolveAgentModelId(provider)
    if (provider === 'openai') {
      const configError = await assertOpenAiConfiguredForAnalyze()
      if (configError) return configError
    }
    const bytes = Buffer.from(await file.arrayBuffer())
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    storageKey = `clients/${clientId}/external-valuation/${Date.now()}-${safeName}`

    const prompt = `Analyze the externally prepared business valuation report for ${clientProfile.businessName}. Extract facts only; do not invent or calculate missing figures. Return JSON only with this shape: {"businessName":string|null,"executiveSummary":string|null,"valuationRange":{"low":number|null,"mid":number|null,"high":number|null,"currency":string|null,"basis":string|null,"multipleLow":number|null,"multipleMid":number|null,"multipleHigh":number|null},"periods":[{"key":"LTM"|"FY1"|"FY2"|"FY3","label":string,"start":string|null,"end":string|null,"revenue":number|null,"cogs":number|null,"grossProfit":number|null,"grossMarginPct":number|null,"operatingExpenses":number|null,"netIncome":number|null,"preRecastEbitda":number|null,"normalizedEbitda":number|null,"fourWallEbitda":number|null,"revenueByCategory":[{"code":string|null,"category":string,"value":number}],"cogsByCategory":[{"code":string|null,"category":string,"value":number}],"opExByCategory":[{"code":string|null,"category":string,"value":number}],"enterpriseValue":{"low":number|null,"mid":number|null,"high":number|null}|null}],"normalizationItems":[{"description":string,"source":string|null,"byPeriod":{"LTM":number|null,"FY1":number|null,"FY2":number|null,"FY3":number|null}}],"valuationResult":{"preRecast":{"LTM":number|null,"FY1":number|null,"FY2":number|null,"FY3":number|null},"normalizedEbitda":{"LTM":number|null,"FY1":number|null,"FY2":number|null,"FY3":number|null},"fourWallEbitda":{"LTM":number|null,"FY1":number|null,"FY2":number|null,"FY3":number|null},"valuation":{"LTM":{"low":number|null,"mid":number|null,"high":number|null},"FY1":{"low":number|null,"mid":number|null,"high":number|null},"FY2":{"low":number|null,"mid":number|null,"high":number|null},"FY3":{"low":number|null,"mid":number|null,"high":number|null}}},"methodology":[string],"keyFindings":[string],"risks":[string],"assumptions":[string],"sourceNotes":[string]}. Use numeric values without currency symbols. Percentages as decimal fractions. Include period/category breakdowns only when the report supplies them; use [] for unavailable breakdowns and null for unknown values. Do not infer Cantara classifications; preserve source labels and codes.`
    let content: AgentMessageBlock[] = [{ type: 'text', text: `${prompt}\n\nExtract supported facts from the supplied report and return valid JSON only.` }]
    if (extension === '.xlsx' || extension === '.xls' || extension === '.csv') {
      if (extension === '.csv') {
        const csv = bytes.toString('utf8')
        if (csv.length > 1_500_000) return new Response('Spreadsheet contains too much data to analyze in one report.', { status: 413 })
        content.push({ type: 'text', text: `Spreadsheet contents (${file.name}):\n${csv}` })
      } else {
        const workbook = XLSX.read(bytes, { type: 'buffer', cellFormula: true })
        const sheets = workbook.SheetNames.map((name) => `\n--- Worksheet: ${name} ---\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`).join('\n')
        if (sheets.length > 1_500_000) return new Response('Spreadsheet contains too much data to analyze in one report.', { status: 413 })
        content.push({ type: 'text', text: `Workbook contents (${file.name}; all worksheets, cell values and formulas):\n${sheets}` })
      }
    } else {
      if (extension === '.pdf') content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: bytes.toString('base64') } })
      else {
        const mammoth = await import('mammoth')
        const extracted = await mammoth.extractRawText({ buffer: bytes })
        if (!extracted.value.trim()) return new Response('No readable text found in the Word document.', { status: 422 })
        content.push({ type: 'text', text: `Word document contents:\n${extracted.value}` })
      }
    }
    const raw = await createAgentMessage({ provider, model: modelId, system: 'You extract business valuation report facts and return strict JSON. Do not invent facts.', content, maxTokens: 8000, temperature: 0 })
    const reportJson = parseJson(raw)
    await s3Client.send(new PutObjectCommand({ Bucket: s3BucketName, Key: storageKey, Body: bytes, ContentType: MIME[extension] }))
    const report = await prisma.externalValuationReport.create({ data: { clientId, fileName: file.name, mimeType: MIME[extension], fileSize: file.size, storageKey, reportJson, aiProvider: provider, aiModel: modelId } })
    return NextResponse.json({ report: { id: report.id, clientId, fileName: report.fileName, mimeType: report.mimeType, fileSize: report.fileSize, reportJson: report.reportJson, aiProvider: report.aiProvider, aiModel: report.aiModel, createdAt: report.createdAt } })
  } catch (error) {
    if (storageKey) {
      try { await s3Client.send(new DeleteObjectCommand({ Bucket: s3BucketName, Key: storageKey })) } catch (cleanupError) { console.error('[ttm-agent/external-report] failed to clean up upload', cleanupError) }
    }
    console.error('[ttm-agent/external-report POST]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to process external valuation.' }, { status: 500 })
  }
}
