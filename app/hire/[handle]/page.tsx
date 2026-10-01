import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { BlogShell } from '@/components/blog/shell'
import { JsonLd } from '@/components/jobs/shell'
import { Avatar } from '@/components/hire/talent-directory'
import { ContactForm } from '@/components/hire/contact-form'
import { loadPerson } from '@/lib/hire/server'
import { breadcrumbLd } from '@/lib/jobs/seo'
import { COUNTRY_OPTIONS } from '@/lib/jobs/locations'
import { FAMILY_BY_ID, SENIORITIES, type FamilyId } from '@/lib/jobs/taxonomy'
import { AVAILABILITY } from '@/lib/hire/talent'
import { siteOrigin } from '@/lib/site'

export const revalidate = 300

type Params = { params: Promise<{ handle: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params
  const person = await loadPerson(handle)
  if (!person) return { title: 'Profile not found', robots: { index: false } }
  const title = `${person.name}${person.headline ? `: ${person.headline}` : ''}`.slice(0, 70)
  const description = (person.summary ?? `${person.name} is a DevRel listed on DevRel Studio.`).slice(0, 160)
  return {
    title,
    description,
    alternates: { canonical: `${siteOrigin()}/hire/${person.handle}` },
    openGraph: { title, description, type: 'profile' },
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-6">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

export default async function PersonPage({ params }: Params) {
  const { handle } = await params
  const person = await loadPerson(handle)
  if (!person) notFound()

  const origin = siteOrigin()
  const country = COUNTRY_OPTIONS.find((item) => item.code === person.country)?.name
  const place = [person.city, country].filter(Boolean).join(', ')
  const level = SENIORITIES.find((item) => item.id === person.seniority)?.label
  const start = AVAILABILITY.find((item) => item.id === person.availability)?.label
  const firstName = person.name.split(' ')[0]
  const links = [
    { href: `/@${person.handle}`, label: 'Portfolio' },
    person.githubUsername && { href: `https://github.com/${person.githubUsername}`, label: 'GitHub' },
    person.twitterUsername && { href: `https://x.com/${person.twitterUsername}`, label: 'X' },
    person.websiteUrl && { href: person.websiteUrl, label: 'Website' },
  ].filter(Boolean) as { href: string; label: string }[]

  return (
    <BlogShell>
      <JsonLd data={breadcrumbLd(origin, [{ name: 'Home', path: '/' }, { name: 'Hire', path: '/hire' }, { name: person.name, path: `/hire/${person.handle}` }])} />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: person.name,
          url: `${origin}/hire/${person.handle}`,
          jobTitle: person.headline,
          description: person.summary,
          knowsAbout: person.skills,
          ...(country ? { homeLocation: { '@type': 'Place', name: place } } : {}),
          sameAs: links.filter((link) => link.href.startsWith('http')).map((link) => link.href),
        }}
      />
      <Link href="/hire" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All DevRels
      </Link>

      <header className="mb-8 flex items-start gap-5">
        <Avatar name={person.name} imageUrl={person.imageUrl} size={72} />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{person.name}</h1>
          {person.headline && <p className="mt-1 text-lg text-foreground/90">{person.headline}</p>}
          <p className="mt-2 text-sm text-muted-foreground">
            {[level, person.yearsExperience ? `${person.yearsExperience} years in the field` : null, place].filter(Boolean).join(' · ')}
          </p>
          {person.openToWork && (
            <p className="mt-3 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-sm text-emerald-600 dark:text-emerald-400">
              {start ?? 'Open to work'}
            </p>
          )}
        </div>
      </header>

      <div className="space-y-8">
        {person.summary && <p className="text-base leading-relaxed text-foreground/90">{person.summary}</p>}

        {person.proof.published > 0 && (
          <Section title="Work tracked on DevRel Studio">
            <p className="text-sm text-foreground">{person.proof.highlights.join(' · ')}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {Object.entries(person.proof.byCategory).map(([name, count]) => `${count} ${name.toLowerCase()}`).join(', ')}.{' '}
              <Link href={`/@${person.handle}`} className="underline underline-offset-2 hover:text-foreground">See every piece in the portfolio</Link>
            </p>
          </Section>
        )}

        {person.skills.length > 0 && (
          <Section title="Skills">
            <ul className="flex flex-wrap gap-2">
              {person.skills.map((skill) => <li key={skill} className="rounded-md bg-muted px-2.5 py-1 text-sm text-foreground/90">{skill}</li>)}
            </ul>
          </Section>
        )}

        {person.experience.length > 0 && (
          <Section title="Experience">
            <ol className="space-y-5">
              {person.experience.map((row, index) => (
                <li key={index}>
                  <p className="font-medium text-foreground">{row.title}, {row.company}</p>
                  {(row.start || row.end) && <p className="text-xs text-muted-foreground">{[row.start, row.end].filter(Boolean).join(' to ')}</p>}
                  {row.summary && <p className="mt-1 text-sm text-muted-foreground">{row.summary}</p>}
                </li>
              ))}
            </ol>
          </Section>
        )}

        {person.projects.length > 0 && (
          <Section title="Projects">
            <ul className="space-y-3">
              {person.projects.map((row, index) => (
                <li key={index}>
                  <p className="font-medium text-foreground">
                    {row.url ? <a href={row.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 hover:underline">{row.name}<ExternalLink className="h-3 w-3" /></a> : row.name}
                  </p>
                  {row.summary && <p className="text-sm text-muted-foreground">{row.summary}</p>}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {person.communities.length > 0 && (
          <Section title="Communities">
            <ul className="space-y-2 text-sm">
              {person.communities.map((row, index) => (
                <li key={index} className="text-foreground">
                  {row.url ? <a href={row.url} target="_blank" rel="noopener noreferrer nofollow" className="hover:underline">{row.name}</a> : row.name}
                  {row.role && <span className="text-muted-foreground"> · {row.role}</span>}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {person.education.length > 0 && (
          <Section title="Education">
            <ul className="space-y-2 text-sm">
              {person.education.map((row, index) => (
                <li key={index} className="text-foreground">
                  {row.school}
                  {(row.degree || row.year) && <span className="text-muted-foreground"> · {[row.degree, row.year].filter(Boolean).join(', ')}</span>}
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Good to know">
          <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            {person.workModes.length > 0 && <div><dt className="text-muted-foreground">Works</dt><dd className="text-foreground">{person.workModes.map(cap).join(', ')}</dd></div>}
            {person.engagements.length > 0 && <div><dt className="text-muted-foreground">Open to</dt><dd className="text-foreground">{person.engagements.map(cap).join(', ')}</dd></div>}
            {person.families.length > 0 && <div><dt className="text-muted-foreground">Focus</dt><dd className="text-foreground">{person.families.map((id) => FAMILY_BY_ID[id as FamilyId]?.label ?? id).join(', ')}</dd></div>}
            {person.timezone && <div><dt className="text-muted-foreground">Time zone</dt><dd className="text-foreground">{person.timezone}</dd></div>}
            {person.languages.length > 0 && <div><dt className="text-muted-foreground">Languages</dt><dd className="text-foreground">{person.languages.join(', ')}</dd></div>}
          </dl>
          <p className="mt-4 flex flex-wrap gap-4 text-sm">
            {links.map((link) => (
              <a key={link.label} href={link.href} {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})} className="text-muted-foreground underline underline-offset-2 hover:text-foreground">
                {link.label}
              </a>
            ))}
          </p>
        </Section>

        <ContactForm handle={person.handle} firstName={firstName} />
      </div>
    </BlogShell>
  )
}
