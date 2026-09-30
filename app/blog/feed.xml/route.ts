import { loadPosts } from '@/lib/blog/server'
import { siteOrigin } from '@/lib/site'

export const revalidate = 3600

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

export async function GET() {
  const origin = siteOrigin()
  const posts = await loadPosts()
  const items = posts
    .slice(0, 30)
    .map(
      (post) => `<item>
<title>${escapeXml(post.title)}</title>
<link>${origin}/blog/${post.slug}</link>
<guid isPermaLink="true">${origin}/blog/${post.slug}</guid>
<pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
<description>${escapeXml(post.description)}</description>
</item>`,
    )
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>DevRel Studio blog</title>
<link>${origin}/blog</link>
<description>Practical writing for developer advocates and DevRel managers.</description>
<language>en</language>
${items}
</channel></rss>`
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, s-maxage=3600' } })
}
