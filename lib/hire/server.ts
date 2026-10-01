import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'

function client(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  return url ? new ConvexHttpClient(url) : null
}

export async function loadTalent() {
  const convex = client()
  if (!convex) return []
  try {
    return await convex.query(api.talent.listTalent, {})
  } catch (error) {
    console.error('[hire] list failed:', error)
    return []
  }
}

export async function loadPerson(handle: string) {
  const convex = client()
  if (!convex) return null
  try {
    return await convex.query(api.talent.getTalent, { handle })
  } catch (error) {
    console.error('[hire] profile failed:', error)
    return null
  }
}
