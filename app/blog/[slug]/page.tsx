import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BlogShell, dateLabel } from '@/components/blog/shell'
import { Prose } from '@/components/blog/prose'
import { Crumbs, JsonLd } from '@/components/jobs/shell'
import { loadPost } from '@/lib/blog/server'
import { parseMarkdown } from '@/lib/blog/markdown'
import { breadcrumbLd, faqLd } from '@/lib/jobs/seo'
import { siteOrigin } from '@/lib/site'

export const revalidate = 3600
export const dynamicParams = true

export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await loadPost(slug)
  if (!post) return { title: 'Post not found | DevRel Studio', robots: { index: false } }
  const url = `${siteOrigin()}/blog/${post.slug}`
  return {
    title: `${post.title} | DevRel Studio`,
    description: post.description,
    alternates: { canonical: url },
    openGraph: { title: post.title, description: post.description, type: 'article', url, publishedTime: new Date(post.publishedAt).toISOString() },
    twitter: { card: 'summary_large_image', title: post.title, description: post.description },
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await loadPost(slug)
  if (!post) notFound()

  const origin = siteOrigin()
  const url = `${origin}/blog/${post.slug}`
  const blocks = parseMarkdown(post.body)
  const sections = blocks.filter((block): block is Extract<typeof block, { t: 'h' }> => block.t === 'h' && block.level === 2)

  return (
    <BlogShell>
      <JsonLd data={breadcrumbLd(origin, [{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blog' }, { name: post.title, path: `/blog/${post.slug}` }])} />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.description,
          mainEntityOfPage: url,
          url,
          datePublished: new Date(post.publishedAt).toISOString(),
          dateModified: new Date(post.updatedAt).toISOString(),
          keywords: post.keyword,
          inLanguage: 'en',
          author: { '@type': 'Organization', name: 'DevRel Studio', url: origin },
          publisher: { '@type': 'Organization', name: 'DevRel Studio', url: origin },
        }}
      />
      {post.faq.length > 0 && <JsonLd data={faqLd(post.faq)} />}

      <Crumbs trail={[{ name: 'Home', href: '/' }, { name: 'Blog', href: '/blog' }, { name: post.title }]} />

      <article>
        <header className="mb-8">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">{post.title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            <time dateTime={new Date(post.publishedAt).toISOString()}>{dateLabel(post.publishedAt)}</time> · {post.readingMinutes} min read
          </p>
        </header>

        {sections.length >= 4 && (
          <nav aria-label="In this post" className="mb-8 rounded-xl border border-border bg-card p-4 text-sm">
            <p className="mb-2 font-medium text-foreground">In this post</p>
            <ol className="ml-4 list-decimal space-y-1 text-muted-foreground">
              {sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="hover:text-foreground hover:underline">
                    {section.c.map((node) => (node.t === 'text' || node.t === 'code' ? node.v : '')).join('') || section.id.replace(/-/g, ' ')}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <Prose blocks={blocks} />

        {post.faq.length > 0 && (
          <section aria-labelledby="faq" className="mt-12">
            <h2 id="faq" className="text-2xl font-semibold text-foreground">Frequently asked questions</h2>
            <dl className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
              {post.faq.map((item) => (
                <div key={item.q} className="p-5">
                  <dt className="font-medium text-foreground">{item.q}</dt>
                  <dd className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {post.sources.length > 0 && (
          <section aria-labelledby="sources" className="mt-12">
            <h2 id="sources" className="text-lg font-semibold text-foreground">Sources</h2>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              {post.sources.map((source) => (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-foreground">{source.title}</a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>

      <aside className="mt-14 rounded-2xl border border-border bg-card p-6">
        <p className="font-semibold text-foreground">Look for DevRel roles, or log the work you ship</p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          The job board is free and updates three times a day. A free account adds CV matching and an application tracker.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/jobs" className="rounded-md bg-accent px-4 py-2 font-medium text-accent-foreground hover:bg-accent/90">See open roles</Link>
          <Link href="/sign-up" className="rounded-md border border-border px-4 py-2 font-medium text-foreground hover:border-foreground/30">Create a free account</Link>
        </div>
      </aside>

      {post.more.length > 0 && (
        <section className="mt-14">
          <h2 className="text-lg font-semibold text-foreground">More from the blog</h2>
          <ul className="mt-3 space-y-3">
            {post.more.map((item) => (
              <li key={item.slug}>
                <Link href={`/blog/${item.slug}`} className="font-medium text-foreground hover:underline">{item.title}</Link>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </BlogShell>
  )
}
