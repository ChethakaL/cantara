import { NextRequest, NextResponse } from 'next/server'
import { TAX_READINESS_DOCUMENT_GROUPS } from '@/lib/tax-readiness'
import {
  buildTaxDocumentGroups,
  listTaxClientDocumentRows,
  loadTaxClientDocumentsWithContent,
} from '@/lib/tax-liability-review/client-documents'
import { assertS3Configured } from '@/lib/s3'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    assertS3Configured()

    const clientId = req.nextUrl.searchParams.get('clientId')
    const includeContent = req.nextUrl.searchParams.get('includeContent') === 'true'
    if (!clientId) return new Response('clientId is required', { status: 400 })

    const rows = await listTaxClientDocumentRows(clientId)
    const groups = buildTaxDocumentGroups(rows)
    const documents = includeContent ? await loadTaxClientDocumentsWithContent(clientId) : []

    return NextResponse.json({
      groups,
      documents,
      requiredCount: TAX_READINESS_DOCUMENT_GROUPS.filter((group) => group.required).length,
      uploadedRequiredCount: groups.filter((group) => group.required && group.uploaded).length,
      missingRequired: groups.filter((group) => group.required && !group.uploaded).map((group) => group.id),
    })
  } catch (error) {
    console.error('[tax-liability-review/client-documents] Error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
