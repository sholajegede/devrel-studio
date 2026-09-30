import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { timingSafeEqual } from 'node:crypto'

export const runtime = 'nodejs'

function matches(given: string | null, expected: string): boolean {
  if (!given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  const secret = process.env.JOBS_REVALIDATE_SECRET
  if (!secret || !matches(req.headers.get('x-revalidate-secret'), secret)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  revalidatePath('/jobs', 'layout')
  revalidatePath('/blog', 'layout')
  revalidatePath('/sitemap.xml')
  return NextResponse.json({ ok: true })
}
