import Link from 'next/link'
import Image from 'next/image'
import { FileText, Video, MapPin, Mic, Package, Rocket, ArrowRight, Check, X, ShieldCheck } from 'lucide-react'
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
import { BlueLink, Display, Label, Lede, OutlineLink, PrimaryLink, Wrap } from '@/components/marketing/primitives'

// ─── Page rhythm ──────────────────────────────────────────────────────────────
//
// Every section follows the same beat: a short two-line headline on bare paper,
// then flat rounded blocks in sand or a single accent colour. No gradients, no
// shadows, no glow. Depth comes from tone and from radius. Sections that
// concern the agent carry a mono bracket label, so the page reads as a system
// with a few named parts rather than a list of features.

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
          <Label className="mb-6 inline-block">[ DevRel · AgentRel ]</Label>
          <Display as="h1" size="xl">
            DevRel and AgentRel,
            <br />
            measured.
          </Display>
          <Lede className="mt-7 max-w-2xl">
            Log every article, talk, video and package once. An agent drafts the monthly report from your numbers, and
            every client and executive sees a live dashboard. Built for the developers you reach, and the agents they ask.
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
            alt="The DevRel Studio performance dashboard: published content, views, downloads, attendees and stars by month"
            width={3456}
            height={2166}
            className="block h-auto w-full rounded-[1.25rem] sm:rounded-[1.75rem]"
            priority
          />
        </div>
      </Wrap>
    </section>
  )
}

// ─── Social proof ─────────────────────────────────────────────────────────────

// Teams whose DevRel work has been tracked here. The heading is worded as a
// fact about the work, not as a claim that these are paying customers.
// A logo without an image renders as a name, so a brand is never drawn from
// memory: drop the real file into public/assets/logos and add its `src`.
const SOCIAL_PROOF_LOGOS: { alt: string; src?: string; width: number; height: number }[] = [
  { src: '/assets/logos/devto.png',        alt: 'DEV Community', width: 72,  height: 28 },
  { src: '/assets/logos/freecodecamp.svg', alt: 'freeCodeCamp',  width: 130, height: 28 },
  { src: '/assets/logos/kinde.svg',        alt: 'Kinde',         width: 80,  height: 28 },
  { src: '/assets/logos/convex.png',       alt: 'Convex',        width: 90,  height: 28 },
  { src: '/assets/logos/brightdata.png',   alt: 'Bright Data',   width: 110, height: 28 },
  { src: '/assets/logos/vercel.svg',       alt: 'Vercel',        width: 80,  height: 28 },
  { alt: 'Mastra', width: 90, height: 28 },
]

function SocialProof() {
  return (
    <section className="mt-20 overflow-hidden sm:mt-28">
      <p className="mb-8 px-6 text-center text-sm text-muted-foreground">
        DevRel done for these teams has been tracked here
      </p>
      <div className="animate-marquee flex items-stretch gap-3">
        {[...SOCIAL_PROOF_LOGOS, ...SOCIAL_PROOF_LOGOS].map((logo, i) => (
          <div
            key={`${logo.alt}-${i}`}
            className={`flex h-20 w-56 shrink-0 items-center justify-center bg-sand ${
              i % 2 === 0 ? 'rounded-[2.5rem_0.75rem_0.75rem_2.5rem]' : 'rounded-xl'
            }`}
          >
            {logo.src ? (
              <Image
                src={logo.src}
                alt={logo.alt}
                width={logo.width}
                height={logo.height}
                className="object-contain opacity-70 grayscale"
              />
            ) : (
              <span className="text-2xl font-semibold tracking-[-0.04em] text-foreground/70">{logo.alt}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── The report agent ─────────────────────────────────────────────────────────
//
// Everything on this band is something the product does. The agent reads a
// client's entries for the month, drafts the summary, the reason the numbers
// moved and the answer to last month's feedback, and checks that every figure
// it wrote exists in the data. It saves nothing: the person reads and presses
// Save.

const AGENT_STEPS = [
  {
    n: '01',
    title: 'Reads the month',
    body: 'Every entry, the totals, last month for comparison, your targets and the feedback your client left.',
  },
  {
    n: '02',
    title: 'Drafts the brief',
    body: 'A summary, what drove the numbers, and a reply to last month’s feedback, written in plain words.',
  },
  {
    n: '03',
    title: 'Checks its own work',
    body: 'Every figure must exist in your data, and stock phrases are caught before you see a word of it.',
  },
]

function AgentDraftCard() {
  return (
    <div className="rounded-[1.75rem] bg-paper p-6 text-ink sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-ink/60">Draft · August 2026 · Northwind</Label>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green px-3 py-1 text-xs font-medium text-paper">
          <ShieldCheck className="h-3.5 w-3.5" />
          Numbers checked
        </span>
      </div>
      <p className="mt-5 text-[15px] leading-relaxed text-ink/85">
        Reach was 43,680 in August 2026, up from 10,000 in July. Two pieces carried the month: the realtime dashboard
        video on YouTube with 31,200 views, and the webhooks post on Dev.to with 12,480.
      </p>
      <p className="mt-4 border-t border-ink/10 pt-4 text-sm leading-relaxed text-ink/60">
        You asked for more video last month. The video was the largest piece published.
      </p>
      <div className="mt-6 flex items-center gap-2 text-xs text-ink/60">
        <span className="h-1.5 w-1.5 rounded-full bg-orange" />
        Not saved. You edit it first.
      </div>
    </div>
  )
}

function AgentBand() {
  return (
    <section className="py-24 sm:py-32">
      <Wrap>
        <div className="rounded-[2.5rem] bg-ink p-8 text-paper sm:p-14">
          <div className="grid items-start gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <Label className="text-paper/60">[ Agent ]</Label>
              <Display size="lg" className="mt-4 text-paper">
                An agent writes the report.
                <br />
                You approve it.
              </Display>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-paper/70">
                The report is the part of DevRel everyone dreads and nobody can skip. The report agent reads your
                entries and drafts it in seconds. You decide what goes to the client.
              </p>
              <ol className="mt-10 space-y-6">
                {AGENT_STEPS.map((step) => (
                  <li key={step.n} className="flex gap-5">
                    <span className="font-mono text-sm text-orange">{step.n}</span>
                    <div>
                      <h3 className="text-xl font-medium tracking-[-0.02em]">{step.title}</h3>
                      <p className="mt-1.5 max-w-md text-[15px] leading-relaxed text-paper/65">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <AgentDraftCard />
          </div>
        </div>
      </Wrap>
    </section>
  )
}

// ─── Who it is for ────────────────────────────────────────────────────────────

const AUDIENCES: { title: string; body: string; shapes: [ShapeName, ShapeColor][] }[] = [
  {
    title: 'For DevRel and AgentRel teams',
    body: 'Log a post, a talk, a package or a demo in thirty seconds. Reach fills in on its own, and the agent drafts the report.',
    shapes: [['square', 'pink'], ['tab', 'blue']],
  },
  {
    title: 'For executives and clients',
    body: 'One live link with the current picture. No login, and no waiting for the quarterly report.',
    shapes: [['dome', 'orange'], ['square', 'olive']],
  },
  {
    title: 'For agencies and enterprises',
    body: 'Run every client and program from one workspace, with seats and roles for the whole organization.',
    shapes: [['circle', 'ochre'], ['quarter', 'orange']],
  },
]

function Audiences() {
  return (
    <section className="pb-24 sm:pb-32">
      <Wrap>
        <Display className="text-center">
          One record.
          <br />
          Every audience.
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
              <p className="mx-auto mt-3 max-w-[17rem] text-[15px] leading-relaxed text-muted-foreground">{a.body}</p>
            </div>
          ))}
        </div>
      </Wrap>
    </section>
  )
}

// ─── Before / after ───────────────────────────────────────────────────────────
//
// One grid, two tones. Each row pairs the old way with the new, so the reader
// does not compare two lists in their head: the answer to every line on the
// left sits directly across from it. Muted and struck on the sand side, plain
// and bright on the ink side, so the difference reads before a word is read.

const COMPARE: { step: string; before: string; after: string }[] = [
  {
    step: 'Collect',
    before: 'Numbers copied by hand from YouTube, Dev.to, npm and Luma',
    after: 'Entries take thirty seconds, and the numbers refresh themselves',
  },
  {
    step: 'Write',
    before: 'A blank page, a deadline and a month of work to summarise',
    after: 'The report agent drafts it from your entries. You edit.',
  },
  {
    step: 'Deliver',
    before: 'A PDF assembled from screenshots and emailed around',
    after: 'One live link for every stakeholder, plus PDF export',
  },
  {
    step: 'Prove',
    before: 'Stakeholders asking when the report is coming',
    after: 'Stakeholders open it whenever they like, and see who else did',
  },
  {
    step: 'Compare',
    before: 'Nothing between reports and no history to compare',
    after: 'Every month measured against the last, with targets',
  },
]

function BeforeAfter() {
  return (
    <section className="pb-24 sm:pb-32">
      <Wrap>
        <Display className="text-center">
          From month-end scramble
          <br />
          to always current
        </Display>

        <div className="mx-auto mt-14 max-w-6xl overflow-hidden rounded-[2rem] sm:rounded-[2.5rem]">
          {/* Column heads */}
          <div className="hidden md:grid md:grid-cols-2">
            <div className="flex items-center justify-between bg-sand-deep px-12 py-8">
              <div>
                <Label>Before</Label>
                <p className="mt-2 text-2xl font-medium tracking-[-0.03em] text-muted-foreground">Report day</p>
              </div>
              <Shape name="square" color="sand" className="h-12 w-12 opacity-60" />
            </div>
            <div className="flex items-center justify-between bg-ink px-12 py-8 text-paper">
              <div>
                <Label className="text-paper/55">With DevRel Studio</Label>
                <p className="mt-2 text-2xl font-medium tracking-[-0.03em]">Every day</p>
              </div>
              <Shape name="dome" color="orange" className="h-12 w-12" />
            </div>
          </div>

          {COMPARE.map((row) => (
            <div key={row.step} className="grid md:grid-cols-2">
              <div className="flex gap-4 bg-sand px-7 py-6 sm:px-12 sm:py-8">
                <X aria-hidden className="mt-1 h-5 w-5 shrink-0 text-rust/70" />
                <div>
                  <Label className="md:hidden">Before · {row.step}</Label>
                  <Label className="hidden md:inline">{row.step}</Label>
                  <p className="mt-1.5 text-[17px] leading-snug text-muted-foreground line-through decoration-ink/25 decoration-1">
                    {row.before}
                  </p>
                </div>
              </div>
              <div className="flex gap-4 bg-ink px-7 py-6 text-paper sm:px-12 sm:py-8">
                <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green">
                  <Check className="h-3.5 w-3.5 text-paper" strokeWidth={3} />
                </span>
                <div>
                  <Label className="text-paper/55 md:hidden">With DevRel Studio · {row.step}</Label>
                  <p className="text-[19px] font-medium leading-snug tracking-[-0.015em] md:mt-[1.65rem]">{row.after}</p>
                </div>
              </div>
            </div>
          ))}
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
  { icon: Package, name: 'Package', metric: 'Weekly downloads', examples: 'npm packages, SDKs, CLI tools, MCP servers, Convex components', shape: 'square' as ShapeName, color: 'pink' as ShapeColor },
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
          Developer relations does not fit one spreadsheet column. Each category brings its own fields and its own
          metric, from video views to package downloads.
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

// ─── AgentRel ─────────────────────────────────────────────────────────────────
//
// Only things the product does today. Packages, demos and docs are tracked as
// content. Portfolios, public client dashboards and the job board each serve
// an llms.txt beside the page, and the job board has a JSON API.

const AGENTREL_POINTS = [
  {
    label: 'llms.txt',
    title: 'Readable by agents',
    body: 'Every portfolio and public client dashboard serves an llms.txt next to the page, with the same numbers the page shows.',
    tone: 'bg-ochre text-ink',
  },
  {
    label: 'API',
    title: 'Open job data',
    body: 'The DevRel job board has a JSON API and its own llms.txt, so an agent can find roles without scraping.',
    tone: 'bg-blue text-ink',
  },
  {
    label: 'Packages',
    title: 'Tracked like any launch',
    body: 'SDKs, MCP servers, starter kits and demos sit in the same record as your posts and talks, each with its own metric.',
    tone: 'bg-green text-ink',
  },
]

function AgentRel() {
  return (
    <section className="pb-24 sm:pb-32">
      <Wrap>
        <div className="mx-auto max-w-3xl text-center">
          <Label>[ AgentRel ]</Label>
          <Display className="mt-4">
            Developers ask an agent first.
            <br />
            Be the answer it finds.
          </Display>
          <Lede className="mt-6 max-w-2xl">
            AgentRel is developer relations for an audience that includes AI agents: the docs, packages and demos they
            read, and the pages they cite. DevRel Studio tracks that work beside everything else you ship, and publishes
            your results in a form agents can read.
          </Lede>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {AGENTREL_POINTS.map(({ label, title, body, tone }) => (
            <div key={title} className={`flex min-h-[20rem] flex-col rounded-[2rem] p-8 sm:p-9 ${tone}`}>
              <span className="font-mono text-sm">{label}</span>
              <div className="mt-auto">
                <h3 className="text-3xl font-medium leading-[1.05] tracking-[-0.035em]">{title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink/75">{body}</p>
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
    title: 'Log your work',
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
    title: 'Let the agent draft the report',
    description:
      'At month end the agent reads your entries and writes the brief. You edit it, save it, and send it.',
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
    { q: 'What does the report agent do?', a: 'It reads a client’s entries for the month, with the totals, last month for comparison, your targets and the feedback they left. It drafts the summary, what drove the numbers and a reply to the feedback. Every figure it writes must exist in your data, or it is sent back to fix it. It saves nothing. You read it, edit it and save it.' },
    { q: 'Does the agent send reports on its own?', a: 'No. It drafts, and you decide. Sending a report to a client stays a button you press.' },
    { q: 'What is AgentRel?', a: 'Developer relations for an audience that includes AI agents: the docs, packages, demos and llms.txt files that agents read and recommend from. DevRel Studio tracks that work with the rest of your DevRel output, and serves your results in a form agents can read.' },
    { q: 'How much is it?', a: <LocalPriceAnswer /> },
    { q: 'How does payment work?', a: 'You tell us the plan and the number of months. We send an invoice with wire details, in US dollars. Access opens as soon as the payment clears.' },
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
          Prove the work
          <br />
          to people and agents
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
      <AgentBand />
      <Audiences />
      <BeforeAfter />
      <FeatureBento />
      <ContentCategories />
      <AgentRel />
      <HowItWorks />
      <JobsBand />
      <Testimonial />
      <FAQ />
      <CTA />
      <MarketingFooter />
    </div>
  )
}
