import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { assertS3Configured, s3BucketName, s3Client } from '@/lib/s3'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

async function bodyToBuffer(body: any): Promise<Buffer> {
  if (!body) return Buffer.alloc(0)
  if (typeof body.transformToByteArray === 'function') {
    const bytes = await body.transformToByteArray()
    return Buffer.from(bytes)
  }
  const response = new Response(body)
  return Buffer.from(await response.arrayBuffer())
}

// ── GET: Fetch existing map data & uploaded document info ────────────────────

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return new Response('clientId required', { status: 400 })

  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true },
  })
  if (!client) return new Response('Client not found', { status: 404 })

  const submissions = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object'
    ? client.sectionSubmissions
    : {}) as Record<string, any>
  const mapData = submissions.clientLocationMap ?? null

  const uploadedDoc = await (prisma as any).clientDocument.findFirst({
    where: { clientId, documentId: 'client_addresses' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, fileName: true, createdAt: true },
  })
  const docStatus = await (prisma as any).clientDocumentStatus.findUnique({
    where: { clientId_documentId: { clientId, documentId: 'client_addresses' } },
    select: { fileName: true, uploadedAt: true },
  })

  const uploaded = uploadedDoc
    ? { recordId: uploadedDoc.id, fileName: uploadedDoc.fileName, uploadedAt: uploadedDoc.createdAt }
    : docStatus?.fileName
      ? { recordId: null, fileName: docStatus.fileName, uploadedAt: docStatus.uploadedAt }
      : null

  return NextResponse.json({ mapData, uploadedDoc: uploaded })
}

// ── POST: Parse uploaded CSV/XLSX and return structured data ─────────────────

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const clientId = formData.get('clientId') as string
    const facilityAddress = formData.get('facilityAddress') as string
    const file = formData.get('file') as File | null
    const useUploadedDoc = formData.get('useUploadedDoc') === 'true'

    if (!clientId) return new Response('Missing clientId', { status: 400 })

    const client = await prisma.clientProfile.findUnique({
      where: { id: clientId },
      select: { id: true },
    })
    if (!client) return new Response('Client not found', { status: 404 })

    let buffer: Buffer
    let fileName = ''

    if (file) {
      buffer = Buffer.from(await file.arrayBuffer())
      fileName = file.name
    } else if (useUploadedDoc || !file) {
      const doc = await (prisma as any).clientDocument.findFirst({
        where: { clientId, documentId: 'client_addresses' },
        orderBy: { createdAt: 'desc' },
        select: { fileName: true, localPath: true, storageBucket: true },
      })
      if (!doc?.localPath) {
        return new Response('No uploaded client address document found.', { status: 404 })
      }
      assertS3Configured()
      const s3Res = await s3Client.send(
        new GetObjectCommand({
          Bucket: doc.storageBucket || s3BucketName,
          Key: doc.localPath,
        })
      )
      buffer = await bodyToBuffer(s3Res.Body)
      fileName = doc.fileName || 'client_addresses.csv'
    } else {
      return new Response('Missing file or uploaded document', { status: 400 })
    }

    const ext = (fileName.split('.').pop() || '').toLowerCase()

    let clients: Array<{ name: string; address: string; serviceType: string }>
    if (ext === 'xlsx' || ext === 'xls') {
      clients = parseXlsxBuffer(buffer)
    } else {
      // CSV: decode as UTF-8 text
      const text = buffer.toString('utf-8')
      clients = parseCsvText(text)
    }

    return NextResponse.json({
      clients,
      fileName,
      facilityAddress: facilityAddress || '',
      rowCount: clients.length,
    })
  } catch (error) {
    console.error('[client-location-map] POST error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

// ── PATCH: Save geocoded map data ────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const clientId = String(body.clientId || '')
    const mapData = body.mapData

    if (!clientId || !mapData) {
      return new Response('clientId and mapData required', { status: 400 })
    }

    const client = await prisma.clientProfile.findUnique({
      where: { id: clientId },
      select: { sectionSubmissions: true },
    })
    if (!client) return new Response('Client not found', { status: 404 })

    const current = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object'
      ? client.sectionSubmissions
      : {}) as Record<string, any>

    await prisma.clientProfile.update({
      where: { id: clientId },
      data: {
        sectionSubmissions: {
          ...current,
          clientLocationMap: {
            ...mapData,
            updatedAt: new Date().toISOString(),
          },
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[client-location-map] PATCH error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

// ── XLSX Parsing ─────────────────────────────────────────────────────────────

function parseXlsxBuffer(buffer: Buffer): Array<{ name: string; address: string; serviceType: string }> {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []

  const ws = workbook.Sheets[sheetName]
  // header: 1 → returns array-of-arrays; first row is headers
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' })
  if (rows.length < 2) return []

  const headerRow = (rows[0] as any[]).map(h => String(h ?? '').toLowerCase().trim())

  // Flexible header matching
  const nameIdx      = headerRow.findIndex(h => /customer.?name|client.?name|^name$|^client$|^customer$|^business$|^company$/i.test(h))
  const addressIdx   = headerRow.findIndex(h => /^address$|^street$|full.?address|^location$/i.test(h))
  const cityIdx      = headerRow.findIndex(h => /^city$/i.test(h))
  const stateIdx     = headerRow.findIndex(h => /^state$|^province$/i.test(h))
  const zipIdx       = headerRow.findIndex(h => /^zip$|^postal|^zip.?code$/i.test(h))
  const serviceIdx   = headerRow.findIndex(h => /^type$|^service$|service.?type|^category$/i.test(h))

  const finalNameIdx    = nameIdx    >= 0 ? nameIdx    : 0
  const finalAddressIdx = addressIdx >= 0 ? addressIdx : 1

  const results: Array<{ name: string; address: string; serviceType: string }> = []

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i] as any[]
    const name    = String(cols[finalNameIdx] ?? '').trim()
    let   address = String(cols[finalAddressIdx] ?? '').trim()

    // If city/state/zip are separate columns, append them to form a full address
    if (cityIdx >= 0 || stateIdx >= 0 || zipIdx >= 0) {
      const city  = cityIdx  >= 0 ? String(cols[cityIdx]  ?? '').trim() : ''
      const state = stateIdx >= 0 ? String(cols[stateIdx] ?? '').trim() : ''
      const zip   = zipIdx   >= 0 ? String(cols[zipIdx]   ?? '').trim() : ''

      // Only append city/state/zip if they are not already in the address string
      const suffix = [city, state, zip].filter(Boolean).join(', ')
      if (suffix && !address.toLowerCase().includes(city.toLowerCase()) && city) {
        address = `${address}, ${suffix}`
      } else if (suffix && !address.toLowerCase().includes(state.toLowerCase()) && state) {
        address = `${address}, ${state} ${zip}`.trim()
      }
    }

    const rawService = serviceIdx >= 0 ? String(cols[serviceIdx] ?? '') : ''

    if (name && address) {
      results.push({
        name,
        address,
        serviceType: detectServiceType(rawService),
      })
    }
  }

  return results
}

// ── CSV Parsing ──────────────────────────────────────────────────────────────

function parseCsvText(text: string): Array<{ name: string; address: string; serviceType: string }> {
  // Handle BOM
  const clean = text.replace(/^\uFEFF/, '').trim()
  if (!clean) return []

  const lines = clean.split(/\r?\n/)
  if (lines.length < 2) return []

  // Parse header
  const headerLine = lines[0]
  const headers = parseCsvLine(headerLine).map(h => h.toLowerCase().trim())

  // Detect columns — expanded to match "Customer Name" style headers
  const nameIdx    = headers.findIndex(h => /customer.?name|client.?name|^name$|^client$|^customer$|^business$|^company$/i.test(h))
  const addressIdx = headers.findIndex(h => /^(address|location|street|full.?address)$/i.test(h))
  const serviceIdx = headers.findIndex(h => /^(service|type|service.?type|category)$/i.test(h))
  const cityIdx    = headers.findIndex(h => /^city$/i.test(h))
  const stateIdx   = headers.findIndex(h => /^state$|^province$/i.test(h))
  const zipIdx     = headers.findIndex(h => /^zip$|^postal|^zip.?code$/i.test(h))

  // If we can't find name or address, try positional (first col = name, second = address)
  const finalNameIdx    = nameIdx    >= 0 ? nameIdx    : 0
  const finalAddressIdx = addressIdx >= 0 ? addressIdx : (nameIdx >= 0 ? -1 : 1)

  if (finalAddressIdx < 0 || finalAddressIdx >= headers.length) {
    // Can't determine address column — try using columns 0 and 1
    return lines.slice(1)
      .filter(line => line.trim())
      .map(line => {
        const cols = parseCsvLine(line)
        return {
          name: (cols[0] || '').trim(),
          address: (cols[1] || '').trim(),
          serviceType: detectServiceType(cols[2] || ''),
        }
      })
      .filter(row => row.name && row.address)
  }

  return lines.slice(1)
    .filter(line => line.trim())
    .map(line => {
      const cols = parseCsvLine(line)
      const rawService = serviceIdx >= 0 ? (cols[serviceIdx] || '') : ''
      let address = (cols[finalAddressIdx] || '').trim()

      // Combine separate city/state/zip columns if present
      if (cityIdx >= 0 || stateIdx >= 0 || zipIdx >= 0) {
        const city  = cityIdx  >= 0 ? (cols[cityIdx]  || '').trim() : ''
        const state = stateIdx >= 0 ? (cols[stateIdx] || '').trim() : ''
        const zip   = zipIdx   >= 0 ? (cols[zipIdx]   || '').trim() : ''
        const suffix = [city, state, zip].filter(Boolean).join(', ')
        if (suffix && city && !address.toLowerCase().includes(city.toLowerCase())) {
          address = `${address}, ${suffix}`
        }
      }

      return {
        name: (cols[finalNameIdx] || '').trim(),
        address,
        serviceType: detectServiceType(rawService),
      }
    })
    .filter(row => row.name && row.address)
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function detectServiceType(raw: string): string {
  const lower = raw.toLowerCase().trim()
  if (!lower) return 'both'
  const isBoth = /both|all|full|boarding.*daycare|daycare.*boarding|boarding\s*(and|\+|&|\/)\s*daycare|board\s*(and|\+|&|\/)\s*daycare/i.test(lower)
  if (isBoth) return 'both'
  const hasBoarding = /boarding|board|kennel|overnight|lodge|suite|stay/i.test(lower)
  const hasDaycare = /daycare|day\s*care|day\s*camp|daycamp/i.test(lower)
  if (hasBoarding && hasDaycare) return 'both'
  const hasGrooming = /groom|bath|spa|salon|wash/i.test(lower)
  if (hasBoarding) return 'boarding'
  if (hasDaycare) return 'daycare'
  if (hasGrooming) return 'grooming'
  return 'other'
}
