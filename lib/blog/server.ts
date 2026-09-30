import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'

function client(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  return url ? new ConvexHttpClient(url) : null
}

export async function loadPosts() {
  const convex = client()
  if (!convex) return []
  try {
    return await convex.query(api.blog.list, {})
  } catch (error) {
    console.error('[blog] list failed:', error)
    return []
  }
}

export async function loadPost(slug: string) {
  const convex = client()
  if (!convex) return null
  try {
    return await convex.query(api.blog.bySlug, { slug })
  } catch (error) {
    console.error('[blog] post failed:', error)
    return null
  }
}
