import Link from 'next/link'
import Image from 'next/image'
import {
  FileText, Video, MapPin, Mic, Package, Rocket,
  Check, ArrowRight, Minus,
} from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { MarketingNav } from '@/components/marketing/nav'
import { MarketingFooter } from '@/components/marketing/footer'
import { isSignedIn } from '@/lib/session'
import { FeatureBento } from '@/components/marketing/bento'

// ─── Shared pieces ────────────────────────────────────────────────────────────
//
// The page is built from three primitives so the rhythm stays consistent all the
// way down: an eyebrow, a heading block, and two button styles. Every section
// uses them rather than inventing its own spacing and type sizes.
//
// Type is deliberately restrained — semibold rather than bold, negative tracking
// on headings, one accent colour used sparingly. Colour is carried by the
// product screenshot and the accent, not by the headings.

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </span>
  )
}

function SectionHeading({
  eyebrow,
  title,
  lede,
  align = 'center',
}: {
  eyebrow?: string
  title: React.ReactNode
  lede?: React.ReactNode
  align?: 'center' | 'left'
}) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-foreground leading-[1.15]">
        {title}
      </h2>
      {lede && (
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{lede}</p>
      )}
    </div>
  )
}

/** High-contrast primary. Inverts with the theme, the way Linear's does. */
function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90"
    >
      {children}
    </Link>
  )
}

function GhostLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
    >
      {children}
    </Link>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative overflow-hidden">
      {/* Hairline grid, fading out before it reaches the content. Pure texture —
          it should register as depth, not as a visible pattern. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]"
        style={{
          backgroundImage:
            'linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]"
      />

      <div className="relative mx-auto max-w-6xl px-6 pt-24 text-center">
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 py-1 pl-1 pr-3 text-xs text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
        >
          <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-background">
            New
          </span>
          Free for 14 days. No card needed
          <ArrowRight className="h-3 w-3" />
        </Link>

        <h1 className="mx-auto mt-8 max-w-3xl text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.035em] text-foreground sm:text-6xl lg:text-[4rem]">
          Show clients what your DevRel work delivers
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
          Log every piece of content in one place. Track what it earns. Give each
          client a live dashboard they can open any time.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
          <PrimaryLink href={signedIn ? '/dashboard' : '/sign-up'}>
            {signedIn ? 'Open dashboard' : 'Start free'}
            <ArrowRight className="h-3.5 w-3.5" />
          </PrimaryLink>
          <GhostLink href="/demo">Explore the demo</GhostLink>
        </div>

        {/* The trial line is a reason to sign up. Someone already signed up does
            not need reassuring about a card they never entered. */}
        {!signedIn && (
          <p className="mt-5 text-[13px] text-muted-foreground">
            14-day free trial · No card required
          </p>
        )}

        {/* Product shot. The one place on the page allowed to carry colour. */}
        <div className="relative mx-auto mt-20 max-w-5xl">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-20 -top-10 bottom-20 rounded-full bg-accent/10 blur-[100px]"
          />

          <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-foreground/[0.06]">
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2.5">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
              </div>
              <div className="mx-auto rounded-md border border-border bg-background px-3 py-0.5 text-[11px] text-muted-foreground">
                kinde.devrel.studio
              </div>
              <div className="w-12" />
            </div>

            <Image
              src="/images/dashboard-screenshot.png"
              alt="A client dashboard listing published content with views, downloads and attendees"
              width={1728}
              height={1084}
              className="block h-auto w-full"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Social proof ─────────────────────────────────────────────────────────────

// Only companies where someone who has used DevRel Studio has written or
// worked. Inngest, Anthropic, Perplexity and Auth0 were removed: their logos
// were here without that being true, which is the same class of claim as the
// fabricated testimonials that used to sit further down this page.
//
// The heading matters as much as the list. "Trusted by teams at" would claim
// these companies are customers, which they are not — the accurate claim is
// that advocates working with them have tracked their output here.
const SOCIAL_PROOF_LOGOS = [
  { src: '/assets/logos/kinde.svg',        alt: 'Kinde',         width: 80,  height: 28 },
  { src: '/assets/logos/convex.png',       alt: 'Convex',        width: 90,  height: 28 },
  { src: '/assets/logos/clerk.png',        alt: 'Clerk',         width: 80,  height: 28 },
  { src: '/assets/logos/brightdata.png',   alt: 'Bright Data',   width: 110, height: 28 },
  { src: '/assets/logos/vercel.svg',       alt: 'Vercel',        width: 80,  height: 28 },
  { src: '/assets/logos/devto.png',        alt: 'DEV Community', width: 72,  height: 28 },
  { src: '/assets/logos/freecodecamp.svg', alt: 'freeCodeCamp',  width: 130, height: 28 },
]

function SocialProof() {
  return (
    <section className="mt-28 overflow-hidden border-y border-border py-14">
      <p className="mb-9 px-6 text-center text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Advocates who write for these teams track their work here
      </p>
      {/* Edges fade so logos enter and leave rather than being clipped. */}
      <div className="relative [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        <div className="animate-marquee flex items-center gap-16 opacity-60 grayscale">
          {[...SOCIAL_PROOF_LOGOS, ...SOCIAL_PROOF_LOGOS].map((logo, i) => (
            <Image
              key={`${logo.alt}-${i}`}
              src={logo.src}
              alt={logo.alt}
              width={logo.width}
              height={logo.height}
              className="shrink-0 object-contain"
            />
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Before / after ───────────────────────────────────────────────────────────

const BEFORE = [
  'You update a sprawling Google Sheet every month',
  'You copy numbers from YouTube, Dev.to, npm and Luma',
  'You build a PDF by hand, with screenshots',
  'Clients email to ask when the report arrives',
  'Nobody sees anything between reports',
  'Old numbers are gone, so trends are guesswork',
]

const AFTER = [
  'One system holds all six content types',
  'An entry takes 30 seconds. Numbers update on their own',
  'Clients open one link whenever they want',
  'Nobody asks where the report is',
  'Trends sit on the page, with filters and export',
  'Each month compares itself to the last',
]

function BeforeAfter() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-28">
      <SectionHeading
        eyebrow="The problem"
        title="Reporting takes hours it should not take"
        lede="Developer advocates lose a day each month proving work they already finished."
      />

      <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2">
        <div className="bg-background p-8">
          <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
            Today
          </p>
          <ul className="mt-6 space-y-3.5">
            {BEFORE.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                <Minus className="mt-0.5 h-4 w-4 shrink-0 opacity-40" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-background p-8">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            With DevRel Studio
          </p>
          <ul className="mt-6 space-y-3.5">
            {AFTER.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

// ─── Content categories ───────────────────────────────────────────────────────

const CONTENT_CATS = [
  { icon: FileText, name: 'Written', metric: 'Views',           examples: 'Blog posts, tutorials, docs, case studies, newsletters' },
  { icon: Video,    name: 'Video',   metric: 'Views',           examples: 'YouTube, Loom walkthroughs, course modules, recordings' },
  { icon: MapPin,   name: 'Event',   metric: 'Attendees',       examples: 'Conference talks, meetups, webinars, workshops' },
  { icon: Mic,      name: 'Podcast', metric: 'Downloads',       examples: 'Guest appearances, interview shows, solo episodes' },
  { icon: Package,  name: 'Package', metric: 'Weekly downloads', examples: 'npm packages, SDKs, CLI tools, Convex components' },
  { icon: Rocket,   name: 'Demo',    metric: 'GitHub stars',    examples: 'Demo apps, starter kits, reference implementations' },
]

function ContentCategories() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-28">
      <SectionHeading
        eyebrow="Coverage"
        title="One dashboard, six content types"
        lede="DevRel work does not fit one spreadsheet column. Each category brings its own fields and its own number."
      />

      {/* A table rather than six coloured cards: the point is that each category
          maps to one specific metric, and a table shows that mapping directly. */}
      <div className="mt-14 overflow-hidden rounded-xl border border-border">
        {CONTENT_CATS.map(({ icon: Icon, name, metric, examples }, i) => (
          <div
            key={name}
            className={`grid grid-cols-1 gap-1 px-6 py-5 transition-colors hover:bg-muted/40 sm:grid-cols-[160px_180px_1fr] sm:items-center sm:gap-6 ${
              i > 0 ? 'border-t border-border' : ''
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{name}</span>
            </div>
            <div className="font-mono text-xs text-accent">{metric}</div>
            <div className="text-sm text-muted-foreground">{examples}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── How it works ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    title: 'Log your content',
    description:
      'Add a blog post, a video, a talk or an npm release. The form changes to match the category. It takes about 30 seconds.',
    detail: 'Written · Video · Event · Podcast · Package · Demo',
  },
  {
    title: 'Share a live dashboard',
    description:
      'Every client gets their own URL. Share it once. They open it any time, on any device, with no login.',
    detail: 'client.devrel.studio',
  },
  {
    title: 'Prove your impact',
    description:
      'Views, downloads, attendees and stars refresh on their own. Your client watches the numbers move.',
    detail: 'Live metrics · Historic trends · CSV export',
  },
]

function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-border bg-card/40 py-28">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Getting started"
          title="Working in under five minutes"
          lede="Nothing to configure and no API to connect. Sign in, add an entry, share the link."
        />

        <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
          {STEPS.map(({ title, description, detail }, i) => (
            <div key={title} className="bg-background p-7">
              <span className="font-mono text-xs text-muted-foreground">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-4 text-[15px] font-medium text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
              <p className="mt-4 border-t border-border pt-4 font-mono text-[11px] text-muted-foreground/80">
                {detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Testimonial ──────────────────────────────────────────────────────────────
//
// One quote, from a real client, presented at the size it deserves. A wall of
// three would imply a volume of feedback that does not exist yet — and the
// fabricated set that used to sit here was worse than nothing.

function Testimonial() {
  return (
    <section className="border-t border-border py-28">
      <figure className="mx-auto max-w-3xl px-6 text-center">
        <blockquote className="text-2xl font-medium leading-[1.35] tracking-[-0.02em] text-foreground sm:text-[2rem]">
          &ldquo;This is the best approach I have ever seen from anyone we have worked with
          and a completely unique experience.&rdquo;
        </blockquote>
        <figcaption className="mt-8 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Andre Selton</span> · Kinde
        </figcaption>
      </figure>
    </section>
  )
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  { q: 'How much is it?',                              a: 'Starter is $29 a month, Pro is $59 and Agency is $119. You buy 1, 3, 6 or 12 months at a time. Longer terms cost less. The first 14 days are free and need no card.' },
  { q: 'How does payment work?',                       a: 'You email us the plan and the number of months. We send transfer details. Access opens when the payment lands. Card payments are not available yet, because Stripe needs a US company.' },
  { q: 'What happens when access runs out?',           a: 'Nothing disappears. Your content stays. Your clients keep their dashboards. You just cannot add or edit until you extend.' },
  { q: 'What counts as a client workspace?',           a: 'Each client gets their own content log and their own dashboard URL. Starter covers one client. Pro covers five. Agency has no limit.' },
  { q: 'Is there a free trial?',                       a: 'Yes. Fourteen days, no card, from the moment you sign up. You get one client workspace and up to 10 entries.' },
  { q: 'What is your refund policy?',                  a: 'Email us within 14 days of a payment and we refund it. We do not ask why.' },
  { q: 'Do clients need an account?',                  a: 'No. The client dashboard is a read-only URL. It works in any browser. You choose whether it needs an access code.' },
  { q: 'Can multiple people use one account?',         a: 'The Agency plan includes 5 seats with admin, editor and viewer roles. Starter and Pro are single-user.' },
  { q: 'What content does DevRel Studio track?',       a: 'Six categories: Written, Video, Event, Podcast, Package and Demo. Each one records the number that suits it.' },
]

function FAQ() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-28">
      <SectionHeading eyebrow="FAQ" title="Common questions" />

      <Accordion type="single" collapsible className="mt-12 overflow-hidden rounded-xl border border-border">
        {FAQ_ITEMS.map(({ q, a }, i) => (
          <AccordionItem
            key={q}
            value={`item-${i}`}
            className={`px-6 ${i > 0 ? 'border-t border-border' : ''} border-b-0`}
          >
            <AccordionTrigger className="py-5 text-left text-sm font-medium text-foreground hover:no-underline">
              {q}
            </AccordionTrigger>
            <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
              {a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Something missing?{' '}
        <Link href="mailto:support@devrel.studio" className="text-foreground underline underline-offset-4 hover:text-accent">
          Email us
        </Link>
      </p>
    </section>
  )
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function CTA({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="border-t border-border">
      <div className="relative mx-auto max-w-6xl overflow-hidden px-6 py-28 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-[110px]"
        />

        <div className="relative">
          <h2 className="mx-auto max-w-2xl text-3xl sm:text-[2.75rem] font-semibold leading-[1.1] tracking-[-0.03em] text-foreground">
            Your clients should see the work you do
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
            Give every client a live dashboard instead of a monthly PDF.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <PrimaryLink href={signedIn ? '/dashboard' : '/sign-up'}>
              {signedIn ? 'Open dashboard' : 'Start free'}
              <ArrowRight className="h-3.5 w-3.5" />
            </PrimaryLink>
            <GhostLink href="/demo">Explore the demo</GhostLink>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {['14 days free', 'No card required', 'Stop by doing nothing'].map(
              (item) => (
                <span key={item} className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  <Check className="h-3.5 w-3.5 text-accent" />
                  {item}
                </span>
              ),
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LandingPage() {
  const signedIn = await isSignedIn()

  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <Hero signedIn={signedIn} />
      <SocialProof />
      <BeforeAfter />
      <FeatureBento />
      <ContentCategories />
      <HowItWorks />
      <Testimonial />
      <FAQ />
      <CTA signedIn={signedIn} />
      <MarketingFooter />
    </div>
  )
}
