import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isPlaceholderAdvisorImage(imageUrl?: string | null) {
  if (!imageUrl?.trim()) return true
  return /pravatar\.cc/i.test(imageUrl)
}

function normalizeAdvisorName(name: string) {
  return name.trim().toLowerCase()
}

/** Latest real (non-placeholder) advisor photo per name, across all clients. */
export async function GET(req: NextRequest) {
  try {
    const nameFilter = req.nextUrl.searchParams.get('name')?.trim()

    const profiles = await (prisma as any).advisorProfile.findMany({
      where: nameFilter
        ? { name: { equals: nameFilter, mode: 'insensitive' } }
        : undefined,
      orderBy: { updatedAt: 'desc' },
      select: { name: true, imageUrl: true },
    }) as Array<{ name: string; imageUrl: string }>

    const images: Record<string, string> = {}
    for (const profile of profiles) {
      if (isPlaceholderAdvisorImage(profile.imageUrl)) continue
      const key = normalizeAdvisorName(profile.name)
      if (!images[key]) {
        images[key] = profile.imageUrl.trim()
      }
    }

    if (nameFilter) {
      return NextResponse.json({
        name: nameFilter,
        imageUrl: images[normalizeAdvisorName(nameFilter)] ?? null,
      })
    }

    return NextResponse.json({ images })
  } catch (error) {
    console.error('[advisor-profiles/images]', error)
    return NextResponse.json({ images: {} })
  }
}
