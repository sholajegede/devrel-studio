import Link from 'next/link'
import Image from 'next/image'
import { FileText, Video, MapPin, Mic, Package, Rocket, ArrowRight } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { MarketingNav } from '@/components/marketing/nav'
import { MarketingFooter } from '@/components/marketing/footer'
import { SignedInSwitch, LocalPriceAnswer } from '@/components/marketing/auth-aware'
import { FeatureBento } from '@/components/marketing/bento'
import { Shape, type ShapeColor, type ShapeName } from '@/components/marketing/shapes'
import { BlueLink, Display, Lede, OutlineLink, PrimaryLink, Wrap } from '@/components/marketing/primitives'

// ─── Page rhythm ──────────────────────────────────────────────────────────────
//
// Every section follows the same beat: a short two-line headline on bare paper,
// then flat rounded blocks in sand or a single accent colour. No gradients, no
// shadows, no glow. Depth comes from tone and from radius.

function StartOrOpen() {
  return (
    <SignedInSwitch
      signedIn={<PrimaryLink href="/dashboard">Open your dashboard</PrimaryLink>}
      signedOut={<PrimaryLink href="/sign-up">Start free</PrimaryLink>}
    />
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="pt-10 sm:pt-16">
      <Wrap>
        <div className="mx-auto max-w-4xl text-center">
          <Display as="h1" size="xl">
            Content shipped.
            <br />
            Impact shown.
          </Display>
          <Lede className="mt-7">
            DevRel Studio is where advocates log every article, talk, video and package, and where each client opens a
            live dashboard of what it earned.
          </Lede>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <StartOrOpen />
            <OutlineLink href="/demo">Explore the demo</OutlineLink>
          </div>
          {/* A reason to sign up. Someone already signed up needs no reassurance about a card. */}
          <SignedInSwitch
            signedOut={<p className="mt-5 text-sm text-muted-foreground">14 days free. No card.</p>}
          />
        </div>

        <div className="mt-14 overflow-hidden rounded-[2rem] bg-sand p-3 sm:mt-20 sm:rounded-[2.5rem] sm:p-5">
          <Image
            src="/images/dashboard-screenshot.png"
            alt="A client dashboard listing published content with views, downloads and attendees"
            width={1728}
            height={1084}
            className="block h-auto w-full rounded-[1.25rem] sm:rounded-[1.75rem]"
            priority
          />
        </div>
      </Wrap>
    </section>
  )
}

// ─── Social proof ─────────────────────────────────────────────────────────────

// Only companies where someone who has used DevRel Studio has written or worked.
// The heading matters as much as the list: "trusted by" would claim these are
// customers, which they are not. The accurate claim is that advocates working
// with them have tracked their output here.
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
    <section className="mt-20 overflow-hidden sm:mt-28">
      <p className="mb-8 px-6 text-center text-sm text-muted-foreground">
        Advocates who write for these teams track their work here
      </p>
      <div className="animate-marquee flex items-stretch gap-3">
        {[...SOCIAL_PROOF_LOGOS, ...SOCIAL_PROOF_LOGOS].map((logo, i) => (
          <div
            key={`${logo.alt}-${i}`}
            className={`flex h-20 w-56 shrink-0 items-center justify-center bg-sand ${
              i % 2 === 0 ? 'rounded-[2.5rem_0.75rem_0.75rem_2.5rem]' : 'rounded-xl'
            }`}
          >
            <Image
              src={logo.src}
              alt={logo.alt}
              width={logo.width}
              height={logo.height}
              className="object-contain opacity-70 grayscale"
            />
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Who it is for ────────────────────────────────────────────────────────────

const AUDIENCES: { title: string; body: string; shapes: [ShapeName, ShapeColor][] }[] = [
  {
    title: 'For advocates',
    body: 'Log a post, a talk or a release in thirty seconds. The numbers fill in on their own.',
    shapes: [['square', 'pink'], ['tab', 'blue']],
  },
  {
    title: 'For clients',
    body: 'One link that always shows the current picture. No login, no waiting for the report.',
    shapes: [['dome', 'orange'], ['square', 'olive']],
  },
  {
    title: 'For agencies',
    body: 'Run every client from one workspace, with seats and roles for the whole team.',
    shapes: [['circle', 'ochre'], ['quarter', 'orange']],
  },
]

function Audiences() {
  return (
    <section className="py-24 sm:py-32">
      <Wrap>
        <Display className="text-center">
          Log it once.
          <br />
          Show it always.
        </Display>
        <div className="mx-auto mt-16 grid max-w-5xl gap-12 sm:grid-cols-3">
          {AUDIENCES.map((a) => (
            <div key={a.title} className="text-center">
              <div className="mx-auto mb-5 flex h-14 w-24 items-end justify-center gap-1.5">
                {a.shapes.map(([name, color]) => (
                  <Shape key={name + color} name={name} color={color} className="h-11 w-11" />
                ))}
              </div>
              <h3 className="text-2xl font-medium tracking-[-0.03em] text-foreground">{a.title}</h3>
              <p className="mx-auto mt-3 max-w-[16rem] text-[15px] leading-relaxed text-muted-foreground">{a.body}</p>
            </div>
          ))}
        </div>
      </Wrap>
    </section>
  )
}

// ─── Before / after ───────────────────────────────────────────────────────────

const BEFORE = [
  'A sprawling Google Sheet, updated by hand every month',
  'Numbers copied from YouTube, Dev.to, npm and Luma',
  'A PDF assembled from screenshots',
  'Clients emailing to ask when the report is coming',
  'Nothing visible between reports, and no history to compare',
]

const AFTER = [
  'One workspace for all six kinds of content',
  'An entry takes thirty seconds, and the numbers refresh themselves',
  'Clients open one link whenever they like',
  'Trends sit on the page, with filters and export',
  'Each month measures itself against the last',
]

function BeforeAfter() {
  return (
    <section className="pb-24 sm:pb-32">
      <Wrap>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[2rem] bg-sand p-8 sm:p-12">
            <p className="text-sm text-muted-foreground">Report day</p>
            <h3 className="mt-3 text-3xl font-medium leading-[1.05] tracking-[-0.035em] sm:text-4xl">
              A day a month, proving work you already finished
            </h3>
            <ul className="mt-8 space-y-3.5">
              {BEFORE.map((item) => (
                <li key={item} className="flex gap-3 text-[15px] leading-snug text-muted-foreground">
                  <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink/30" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[2rem] bg-ink p-8 text-paper sm:p-12">
            <p className="text-sm text-paper/60">With DevRel Studio</p>
            <h3 className="mt-3 text-3xl font-medium leading-[1.05] tracking-[-0.035em] sm:text-4xl">
              Every day is report day, and nobody has to do it
            </h3>
            <ul className="mt-8 space-y-3.5">
              {AFTER.map((item) => (
                <li key={item} className="flex gap-3 text-[15px] leading-snug text-paper/85">
                  <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-orange" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Wrap>
    </section>
  )
}

// ─── Content categories ───────────────────────────────────────────────────────

const CONTENT_CATS = [
  { icon: FileText, name: 'Written', metric: 'Views', examples: 'Blog posts, tutorials, docs, case studies, newsletters', shape: 'tab' as ShapeName, color: 'orange' as ShapeColor },
  { icon: Video, name: 'Video', metric: 'Views', examples: 'YouTube, Loom walkthroughs, course modules, recordings', shape: 'circle' as ShapeName, color: 'blue' as ShapeColor },
  { icon: MapPin, name: 'Event', metric: 'Attendees', examples: 'Conference talks, meetups, webinars, workshops', shape: 'dome' as ShapeName, color: 'ochre' as ShapeColor },
  { icon: Mic, name: 'Podcast', metric: 'Downloads', examples: 'Guest appearances, interview shows, solo episodes', shape: 'arch' as ShapeName, color: 'green' as ShapeColor },
  { icon: Package, name: 'Package', metric: 'Weekly downloads', examples: 'npm packages, SDKs, CLI tools, Convex components', shape: 'square' as ShapeName, color: 'pink' as ShapeColor },
  { icon: Rocket, name: 'Demo', metric: 'GitHub stars', examples: 'Demo apps, starter kits, reference implementations', shape: 'cross' as ShapeName, color: 'rust' as ShapeColor },
]

function ContentCategories() {
  return (
    <section className="pb-24 sm:pb-32">
      <Wrap>
        <Display className="text-center">
          Six kinds of work.
          <br />
          Six honest numbers.
        </Display>
        <Lede className="mt-6 text-center">
          DevRel work does not fit one spreadsheet column, so each category brings its own fields and its own metric.
        </Lede>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CONTENT_CATS.map(({ icon: Icon, name, metric, examples, shape, color }) => (
            <div key={name} className="flex min-h-[18rem] flex-col rounded-[2rem] bg-sand p-7 sm:p-8">
              <div className="flex items-start justify-between">
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon className="h-4 w-4" />
                  {name}
                </span>
                <Shape name={shape} color={color} className="h-14 w-14" />
              </div>
              <div className="mt-auto pt-10">
                <p className="text-3xl font-medium tracking-[-0.035em] text-foreground">{metric}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{examples}</p>
              </div>
            </div>
          ))}
        </div>
      </Wrap>
    </section>
  )
}

// ─── How it works ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    title: 'Log your content',
    description:
      'Add a post, a video, a talk or a release. The form changes to match the category, and it takes about thirty seconds.',
    tone: 'bg-ochre text-ink',
  },
  {
    title: 'Share a live dashboard',
    description:
      'Every client gets their own URL. Send it once. They open it on any device, with no account to create.',
    tone: 'bg-blue text-ink',
  },
  {
    title: 'Watch the numbers move',
    description:
      'Views, downloads, attendees and stars refresh on their own, so your client sees the work land as it happens.',
    tone: 'bg-green text-ink',
  },
]

function HowItWorks() {
  return (
    <section id="how-it-works" className="pb-24 sm:pb-32">
      <Wrap>
        <Display className="text-center">
          Working in
          <br />
          five minutes
        </Display>
        <Lede className="mt-6 text-center">Nothing to configure and no API to connect. Sign in, add an entry, share the link.</Lede>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {STEPS.map(({ title, description, tone }, i) => (
            <div key={title} className={`flex min-h-[22rem] flex-col rounded-[2rem] p-8 sm:p-9 ${tone}`}>
              <span className="font-mono text-sm">{String(i + 1).padStart(2, '0')}</span>
              <div className="mt-auto">
                <h3 className="text-3xl font-medium leading-[1.05] tracking-[-0.035em]">{title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink/75">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </Wrap>
    </section>
  )
}

// ─── Testimonial ──────────────────────────────────────────────────────────────
//
// One quote, from a real client, at the size it deserves. A wall of three would
// imply a volume of feedback that does not exist yet.

function Testimonial() {
  return (
    <section className="pb-24 sm:pb-32">
      <Wrap>
        <figure className="mx-auto max-w-4xl text-center">
          <blockquote className="text-[clamp(1.75rem,3.8vw,2.9rem)] font-medium leading-[1.12] tracking-[-0.03em] text-foreground">
            &ldquo;This is the best approach I have ever seen from anyone we have worked with and a completely unique
            experience.&rdquo;
          </blockquote>
          <figcaption className="mt-8 text-[15px] text-muted-foreground">
            <span className="font-medium text-foreground">Andre Selton</span>, Kinde
          </figcaption>
        </figure>
      </Wrap>
    </section>
  )
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

function JobsBand() {
  return (
    <section className="pb-24 sm:pb-32">
      <Wrap>
        <div className="grid items-center gap-10 rounded-[2.5rem] bg-blue p-8 sm:p-14 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <Display size="lg" className="text-ink">
              Every DevRel role,
              <br />
              then the proof to land it
            </Display>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/75">
              Advocate, DevRel engineer, developer success, community and docs roles from company careers pages,
              refreshed three times a day. Track each application and turn the work you have published into a CV and
              cover note for the role. The board is free. Jobs Pro is one payment for a year.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <PrimaryLink href="/jobs">Browse DevRel jobs</PrimaryLink>
              <Link
                href="/pricing#jobs"
                className="inline-flex h-12 items-center justify-center rounded-full border border-ink/40 px-7 text-base font-medium text-ink transition-colors hover:bg-ink hover:text-paper"
              >
                Jobs Pro pricing
              </Link>
            </div>
          </div>
          <div aria-hidden className="mx-auto grid w-full max-w-xs grid-cols-2 gap-3">
            <Shape name="tab" color="orange" />
            <Shape name="circle" color="ochre" />
            <Shape name="cross" color="pink" />
            <Shape name="dome" color="ink" />
          </div>
        </div>
      </Wrap>
    </section>
  )
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

function faqItems(): { q: string; a: React.ReactNode }[] {
  return [
    { q: 'How much is it?', a: <LocalPriceAnswer /> },
    { q: 'How does payment work?', a: 'You email us the plan and the number of months. We send transfer details. Access opens when the payment lands. Card payments are not available yet, because Stripe needs a US company.' },
    { q: 'What happens when access runs out?', a: 'Nothing disappears. Your content stays. Your clients keep their dashboards. You just cannot add or edit until you extend.' },
    { q: 'What counts as a client workspace?', a: 'Each client gets their own content log and their own dashboard URL. Starter covers one client. Pro covers five. Agency has no limit.' },
    { q: 'Is there a free trial?', a: 'Yes. Fourteen days, no card, from the moment you sign up. You get one client workspace and up to 10 entries.' },
    { q: 'What is your refund policy?', a: 'Email us within 14 days of a payment and we refund it. We do not ask why.' },
    { q: 'Do clients need an account?', a: 'No. The client dashboard is a read-only URL. It works in any browser. You choose whether it needs an access code.' },
    { q: 'Can multiple people use one account?', a: 'The Agency plan includes 5 seats with admin, editor and viewer roles. Starter and Pro are single-user.' },
    { q: 'Is the job board free?', a: 'Yes. Browse, filter, save roles, track applications, upload your CV for role matching and set two email alerts at no cost. Jobs Pro is an optional one-off pass for a year that adds unlimited tailored CVs and cover notes, instant alerts, pay benchmarks and a hiring view.' },
    { q: 'What content does DevRel Studio track?', a: 'Six categories: Written, Video, Event, Podcast, Package and Demo. Each one records the number that suits it.' },
  ]
}

function FAQ() {
  return (
    <section id="faq" className="pb-24 sm:pb-32">
      <Wrap>
        <Display className="text-center">Questions, answered</Display>

        <Accordion type="single" collapsible className="mx-auto mt-14 max-w-3xl space-y-3">
          {faqItems().map(({ q, a }, i) => (
            <AccordionItem key={q} value={`item-${i}`} className="rounded-[1.5rem] border-b-0 bg-sand px-7">
              <AccordionTrigger className="py-6 text-left text-lg font-medium tracking-[-0.02em] text-foreground hover:no-underline">
                {q}
              </AccordionTrigger>
              <AccordionContent className="pb-6 text-[15px] leading-relaxed text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <p className="mt-10 text-center text-[15px] text-muted-foreground">
          Something missing?{' '}
          <Link href="mailto:support@devrel.studio" className="font-medium text-foreground underline underline-offset-4 decoration-ink/30 hover:text-accent hover:decoration-accent">
            Email us
          </Link>
        </p>
      </Wrap>
    </section>
  )
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function CTA() {
  return (
    <section>
      <Wrap className="text-center">
        <Display size="xxl">
          Real work,
          <br />
          real proof
        </Display>
        <p className="mt-6 text-lg text-muted-foreground">14 days free. Stop by doing nothing.</p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <StartOrOpen />
          <BlueLink href="/demo">Explore the demo</BlueLink>
        </div>
      </Wrap>
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <Hero />
      <SocialProof />
      <Audiences />
      <BeforeAfter />
      <FeatureBento />
      <ContentCategories />
      <HowItWorks />
      <JobsBand />
      <Testimonial />
      <FAQ />
      <CTA />
      <MarketingFooter />
    </div>
  )
}
