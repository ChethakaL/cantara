import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeImportRow, validateImportRows, importKey } from '@/lib/sales-leads/import-validation'
import { SalesLeadStage } from '@prisma/client'
import { salesLeadMondayConfiguration } from '@/lib/sales-leads/monday-sync'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { rows } = body
    const previewOnly = body.preview === true

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No data rows provided' }, { status: 400 })
    }

    const existingLeads = await prisma.salesLead.findMany({
      select: { businessName: true, city: true, state: true, websiteUrl: true },
    })

    const existingKeys = new Set(
      existingLeads.map(l => importKey({
        businessName: l.businessName,
        city: l.city || undefined,
        state: l.state || undefined,
        websiteUrl: l.websiteUrl || undefined,
      })),
    )

    const normalizedRows = rows.map((r: any, idx: number) => normalizeImportRow(r, idx + 1))
    const validatedResults = validateImportRows(normalizedRows, existingKeys)

    const toInsert = validatedResults.filter(r => r.qualified)

    let createdCount = 0
    if (toInsert.length > 0 && !previewOnly) {
      const created = await prisma.$transaction(
        toInsert.map(r =>
          prisma.salesLead.create({
            data: {
              businessName: r.businessName,
              state: r.state || null,
              city: r.city || null,
              ownerPhone: r.ownerPhone || null,
              ownerEmail: r.ownerEmail || null,
              websiteUrl: r.websiteUrl || null,
              googleRating: r.googleRating || null,
              reviewCount: r.reviewCount || null,
              sqftIndoor: r.sqftIndoor || null,
              sqftOutdoor: r.sqftOutdoor || null,
              sqftCombined: r.sqftCombined || null,
              locationType: r.locationType || null,
              ownerFirstName: r.ownerFirstName || null,
              ownerLastName: r.ownerLastName || null,
              phoneType: r.phoneType,
              emailType: r.emailType,
              sourceLinkPhone: r.sourceLinkPhone || null,
              sourceLinkEmail: r.sourceLinkEmail || null,
              preCallBriefUrl: r.preCallBriefUrl || null,
              notes: r.notes || null,
              currentStage: SalesLeadStage.NEW,
            },
          }),
        ),
      )
      createdCount = toInsert.length
      const mondayConfig = await salesLeadMondayConfiguration()
      if (mondayConfig.boardId && Object.keys(mondayConfig.mapping).length > 0) {
        await prisma.salesLeadSyncEvent.createMany({
          data: created.map(lead => ({
            leadId: lead.id,
            direction: 'OUTBOUND_MONDAY' as const,
            status: 'PENDING' as const,
            payload: { reason: 'excel_import' },
          })),
        })
        const { processSalesLeadSyncOutbox } = await import('@/lib/sales-leads/monday-sync')
        processSalesLeadSyncOutbox().catch(err => console.warn('[import] Immediate Monday sync warning:', err))
      }
    }

    const formattedResults = validatedResults.map((r, idx) => ({
      index: idx,
      row: {
        ...rows[idx],
        businessName: r.businessName,
        city: r.city,
        state: r.state,
      },
      validation: {
        valid: r.qualified,
        reasons: [...r.errors, ...r.warnings],
      },
      isDuplicate: r.errors.some(e => e.includes('already exists') || e.includes('Duplicate row')),
    }))

    return NextResponse.json({
      totalProcessed: rows.length,
      importedCount: previewOnly ? toInsert.length : createdCount,
      validCount: toInsert.length,
      skippedDuplicates: formattedResults.filter(r => r.isDuplicate).length,
      invalidCount: formattedResults.filter(r => !r.validation.valid && !r.isDuplicate).length,
      results: formattedResults,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Import failed' }, { status: 500 })
  }
}
