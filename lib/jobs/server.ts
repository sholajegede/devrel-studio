import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'

type ListArgs = (typeof api.jobs.list)['_args']

function client(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  return url ? new ConvexHttpClient(url) : null
}

export async function loadList(args: ListArgs) {
  const convex = client()
  if (!convex) return null
  try {
    return await convex.query(api.jobs.list, args)
  } catch (error) {
    console.error('[jobs] list failed:', error)
    return null
  }
}

export async function loadStats() {
  const convex = client()
  if (!convex) return null
  try {
    return await convex.query(api.jobs.stats, {})
  } catch (error) {
    console.error('[jobs] stats failed:', error)
    return null
  }
}

export async function loadJob(slug: string) {
  const convex = client()
  if (!convex) return null
  try {
    return await convex.query(api.jobs.bySlug, { slug })
  } catch (error) {
    console.error('[jobs] job failed:', error)
    return null
  }
}
