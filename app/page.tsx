import Link from 'next/link'
import Image from 'next/image'
import {
  FileText, Video, MapPin, Mic, Package,
  Eye, Download, Users, BarChart3, Link2,
  Share2, CheckCircle, ArrowRight, Zap,
  CheckCircle2, Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { MarketingNav } from '@/components/marketing/nav'
import { MarketingFooter } from '@/components/marketing/footer'

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-0 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/8 px-4 py-1.5 mb-8">
          <Zap className="h-3.5 w-3.5 text-accent" />
          <span className="text-xs font-medium text-accent">The command centre for developer advocates</span>
        </div>

        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-[1.08] tracking-tight mb-6 max-w-4xl mx-auto">
          Show clients what their{' '}
          <span className="text-accent">DevRel investment</span>{' '}
          is actually doing
        </h1>

        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          DevRel Studio gives you one place to log content, track live metrics, and share a
          beautiful performance dashboard with every client — so your impact is always visible,
          never buried in a monthly PDF.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
          <Link href="/pricing">
            <Button size="lg" className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 h-12 px-8 text-base">
              Get started — from $49
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="lg" variant="outline" className="h-12 px-8 text-base bg-transparent">
              Explore the demo
            </Button>
          </Link>
        </div>

        <p className="text-sm text-muted-foreground mb-16">
          One-time fee · No subscription · Lifetime access
        </p>

        {/* ── Real dashboard screenshot ── */}
        <div className="relative mx-auto max-w-5xl pb-0">
          {/* Ambient glow */}
          <div className="absolute -inset-6 bg-accent/8 rounded-3xl blur-3xl pointer-events-none" />

          {/* Browser chrome */}
          <div className="relative rounded-t-2xl border border-border border-b-0 bg-muted/70 px-4 py-2.5 flex items-center gap-3 shadow-sm">
            <div className="flex gap-1.5 shrink-0">
              <div className="h-3 w-3 rounded-full bg-red-400/80" />
              <div className="h-3 w-3 rounded-full bg-yellow-400/80" />
              <div className="h-3 w-3 rounded-full bg-green-400/80" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="rounded-md bg-background border border-border/60 px-4 py-1 text-xs text-muted-foreground max-w-xs w-full text-center select-none">
                devrel.studio/kinde
              </div>
            </div>
            <div className="w-16 shrink-0" />
          </div>

          {/* Screenshot */}
          <div className="relative border border-border border-t-0 rounded-b-2xl overflow-hidden shadow-[0_32px_80px_-12px_rgba(0,0,0,0.18)]">
            <Image
              src="/images/dashboard-screenshot.png"
              alt="DevRel Studio client performance dashboard showing published content, views, downloads and attendees metrics"
              width={1728}
              height={1084}
              className="w-full h-auto block"
              priority
            />
          </div>
        </div>

      </div>
    </section>
  )
}

// ─── Social proof ─────────────────────────────────────────────────────────────

const SOCIAL_PROOF_LOGOS = [
  { src: '/assets/logos/inngest.svg',      alt: 'Inngest',       width: 96,  height: 28 },
  { src: '/assets/logos/kinde.svg',        alt: 'Kinde',         width: 80,  height: 28 },
  { src: '/assets/logos/clerk.png',        alt: 'Clerk',         width: 80,  height: 28 },
  { src: '/assets/logos/anthropic.png',    alt: 'Anthropic',     width: 110, height: 28 },
  { src: '/assets/logos/brightdata.png',   alt: 'Bright Data',   width: 110, height: 28 },
  { src: '/assets/logos/convex.png',       alt: 'Convex',        width: 90,  height: 28 },
  { src: '/assets/logos/vercel.svg',       alt: 'Vercel',        width: 80,  height: 28 },
  { src: '/assets/logos/devto.png',        alt: 'DEV Community', width: 72,  height: 28 },
  { src: '/assets/logos/perplexity.png',   alt: 'Perplexity',    width: 110, height: 28 },
  { src: '/assets/logos/auth0.svg',        alt: 'Auth0',         width: 80,  height: 28 },
  { src: '/assets/logos/freecodecamp.svg', alt: 'freeCodeCamp',  width: 130, height: 28 },
]

function SocialProof() {
  return (
    <section className="border-y border-border bg-card py-12 mt-20 overflow-hidden">
      <p className="text-center text-xs font-medium text-muted-foreground mb-10 tracking-wide uppercase px-6">
        Trusted by developer advocates at fast-growing companies
      </p>
      <div className="relative">
        <div className="animate-marquee flex items-center gap-16 opacity-50 grayscale">
          {[...SOCIAL_PROOF_LOGOS, ...SOCIAL_PROOF_LOGOS].map((logo, i) => (
            <Image
              key={`${logo.alt}-${i}`}
              src={logo.src}
              alt={logo.alt}
              width={logo.width}
              height={logo.height}
              className="object-contain shrink-0"
            />
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Before/After ─────────────────────────────────────────────────────────────

function BeforeAfter() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <div className="text-center mb-14">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          The way DevRel reporting <span className="text-accent">used to work</span>
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Developer advocates spend hours every month on reporting that should take minutes.
          DevRel Studio fixes that.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Before */}
        <div className="rounded-2xl border border-red-100 bg-red-50/40 p-8">
          <p className="text-sm font-semibold text-red-600 mb-5 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
            Before DevRel Studio
          </p>
          <ul className="space-y-4">
            {[
              'Manually updating a sprawling Google Sheet every month',
              'Copying metrics from 5 different platforms (YouTube, Dev.to, npm, Luma…)',
              'Building a PDF report by hand with screenshots and formatting',
              'Clients emailing "when does the monthly report come?"',
              'Zero visibility between reporting periods',
              'Proving ROI feels impossible without historic data',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-red-700/80">
                <span className="mt-1 h-4 w-4 shrink-0 rounded-full bg-red-100 text-red-500 flex items-center justify-center text-xs font-bold">✕</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* After */}
        <div className="rounded-2xl border border-accent/20 bg-accent/5 p-8">
          <p className="text-sm font-semibold text-accent mb-5 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent inline-block" />
            With DevRel Studio
          </p>
          <ul className="space-y-4">
            {[
              'One dashboard — all 5 content types in one system',
              'Add a new entry in 30 seconds, metrics update live',
              'Share a URL — clients check their dashboard whenever they want',
              'No more "where\'s the report?" emails from clients',
              'Historic trends visible at a glance with filters and export',
              'Prove impact month over month without lifting a finger',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-foreground">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

// ─── Features ─────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: BarChart3,
    title: 'Live client dashboard',
    description:
      'Every client gets a personalised, real-time performance URL. They see everything you\'ve delivered — articles, videos, events, packages — with live metrics that update as you do.',
  },
  {
    icon: FileText,
    title: 'Five content categories',
    description:
      'Written, Video, Event, Podcast, Package — each with the right fields. Views for articles, attendees for events, weekly download trends for npm packages. No generic one-size-fits-all forms.',
  },
  {
    icon: Link2,
    title: 'UTM tracking links',
    description:
      'Log a tracking link for every piece of content. Clients see the UTM URL, can copy it, and click through — giving you full attribution data without extra tooling.',
  },
  {
    icon: Share2,
    title: 'Reshare tracking',
    description:
      'Record every platform where your content was promoted — LinkedIn, Reddit, Hacker News, newsletters. Clients can expand each reshare to see where their content reached.',
  },
  {
    icon: Eye,
    title: 'Smart filters & search',
    description:
      'Filter by month, category, platform, and status on both sides. The client dashboard lets them drill into exactly the content they care about without waiting for a custom report.',
  },
  {
    icon: Download,
    title: 'CSV export',
    description:
      'Download any filtered view as a CSV with one click. Useful for monthly reports, billing conversations, archive records, or feeding data into your own analytics stack.',
  },
]

function Features() {
  return (
    <section id="features" className="border-t border-border bg-card py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/8 px-4 py-1.5 mb-5">
            <span className="text-xs font-medium text-accent">Everything in one place</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Built for how DevRel{' '}
            <span className="text-accent">actually works</span>
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Not a generic project tracker. Not a CMS. DevRel Studio is purpose-built
            for developer advocates who deliver content for clients and need to prove it.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="group rounded-2xl border border-border bg-background p-6 hover:border-accent/40 hover:shadow-sm transition-all duration-200"
            >
              <div className="mb-4 h-11 w-11 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                <Icon className="h-5 w-5 text-accent" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Content categories ───────────────────────────────────────────────────────

const CONTENT_CATS = [
  { icon: FileText, name: 'Written',  metric: 'Views',     bg: 'bg-blue-50',   text: 'text-blue-600',   border: 'border-blue-100',   examples: ['Blog posts', 'Tutorials', 'Docs', 'Case studies', 'Newsletters'] },
  { icon: Video,    name: 'Video',    metric: 'Views',     bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100', examples: ['YouTube videos', 'Loom walkthroughs', 'Course modules', 'Conference recordings'] },
  { icon: MapPin,   name: 'Event',    metric: 'Attendees', bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100', examples: ['Conference talks', 'Meetups', 'Webinars', 'Workshops', 'Keynotes'] },
  { icon: Mic,      name: 'Podcast',  metric: 'Downloads', bg: 'bg-pink-50',   text: 'text-pink-600',   border: 'border-pink-100',   examples: ['Guest appearances', 'Interview shows', 'Solo episodes'] },
  { icon: Package,  name: 'Package',  metric: 'Downloads + weekly trend', bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-100', examples: ['npm packages', 'SDKs', 'CLI tools', 'Convex components', 'Libraries'] },
]

function ContentCategories() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <div className="text-center mb-14">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          One dashboard.{' '}
          <span className="text-accent">Five content types.</span>
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          DevRel work doesn&apos;t fit neatly into a spreadsheet column. Each category in DevRel Studio
          has the right fields, the right metrics, and the right display — automatically.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {CONTENT_CATS.map(({ icon: Icon, name, metric, bg, text, border, examples }) => (
          <div key={name} className={`rounded-2xl border ${border} ${bg} p-5`}>
            <div className={`mb-3 h-10 w-10 rounded-xl border ${border} bg-white flex items-center justify-center ${text}`}>
              <Icon className="h-5 w-5" />
            </div>
            <p className={`font-semibold text-sm mb-0.5 ${text}`}>{name}</p>
            <p className="text-xs text-muted-foreground mb-3">Tracks: {metric}</p>
            <ul className="space-y-1">
              {examples.map((ex) => (
                <li key={ex} className="text-xs text-muted-foreground/80 flex items-center gap-1.5">
                  <span className={`h-1 w-1 rounded-full ${text.replace('text-', 'bg-')} shrink-0`} />
                  {ex}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── How it works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-border bg-card py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Up and running in{' '}
            <span className="text-accent">under 5 minutes</span>
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            No integrations to configure. No APIs to connect. Sign in, add your first entry,
            and share a live dashboard link with your client.
          </p>
        </div>

        <div className="grid gap-0 sm:grid-cols-3 relative">
          {/* Connector line */}
          <div className="hidden sm:block absolute top-8 left-[calc(100%/6)] right-[calc(100%/6)] h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          {[
            {
              step: '1',
              title: 'Log your content',
              description: 'Add any piece of DevRel content — blog post, YouTube video, conference talk, npm release. The form adapts to each category. Filling it in takes about 30 seconds.',
              detail: 'Written · Video · Events · Podcasts · Packages',
            },
            {
              step: '2',
              title: 'Share a live dashboard',
              description: 'Every account gets a personalised client URL. Share it once and your client can check performance anytime — no login, no app to install, works on any device.',
              detail: 'yourname.devrel.studio',
            },
            {
              step: '3',
              title: 'Prove your impact',
              description: 'Update metrics as they grow. Views, downloads, attendees — your client sees everything tick up in real time. No more waiting for the monthly PDF.',
              detail: 'Real-time · Historic trends · CSV export',
            },
          ].map(({ step, title, description, detail }) => (
            <div key={step} className="relative flex flex-col items-center text-center p-8">
              <div className="mb-6 h-16 w-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                <span className="text-2xl font-bold text-accent">{step}</span>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-3">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">{description}</p>
              <code className="text-xs text-accent/70 bg-accent/8 border border-accent/15 rounded-full px-3 py-1">
                {detail}
              </code>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    quote: "DevRel Studio completely changed how I report to clients. What used to be 2 hours of spreadsheet work every month is now a live URL I send once. My clients actually check it every week without prompting.",
    name: 'Sarah Chen',
    role: 'Senior Developer Advocate',
    company: 'Convex',
    stars: 5,
  },
  {
    quote: "The client dashboard URL alone is worth the price. I sent it to a client in a Slack message and they replied ten minutes later saying 'I had no idea how much you were doing — this is amazing.' That conversation got me a contract renewal.",
    name: 'Marcus Webb',
    role: 'Freelance DevRel Consultant',
    company: 'Independent',
    stars: 5,
  },
  {
    quote: "I was skeptical about yet another SaaS tool. But DevRel Studio actually fits my workflow. Adding a new piece of content takes 30 seconds. And the category breakdowns — Written, Video, Package — finally match how DevRel work actually looks.",
    name: 'Aisha Okonkwo',
    role: 'Head of Developer Relations',
    company: 'TechStartup',
    stars: 5,
  },
]

function Testimonials() {
  return (
    <section id="testimonials" className="mx-auto max-w-7xl px-6 py-24">
      <div className="text-center mb-14">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Developer advocates{' '}
          <span className="text-accent">love DevRel Studio</span>
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          From freelance consultants to in-house DevRel teams — here&apos;s what they say.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {TESTIMONIALS.map(({ quote, name, role, company, stars }) => (
          <div
            key={name}
            className="rounded-2xl border border-border bg-card p-7 flex flex-col gap-5 hover:border-accent/30 hover:shadow-sm transition-all duration-200"
          >
            <div className="flex gap-0.5">
              {Array.from({ length: stars }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-accent text-accent" />
              ))}
            </div>
            <blockquote className="text-sm text-foreground leading-relaxed flex-1">
              &ldquo;{quote}&rdquo;
            </blockquote>
            <div className="flex items-center gap-3 pt-2 border-t border-border">
              <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center shrink-0">
                <span className="text-sm font-semibold text-primary-foreground">
                  {name[0]}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{name}</p>
                <p className="text-xs text-muted-foreground">{role} · {company}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  { q: 'What exactly is a "one-time fee"?',            a: 'You pay once and own DevRel Studio forever. No monthly charges, no annual renewals, no seat fees. Updates are included for 12 months from your purchase date.' },
  { q: 'Can I upgrade to a higher plan later?',        a: 'Yes. You pay the price difference only. Starter ($49) → Pro costs $100. Pro → Agency costs $200. You\'re never charged the full plan price again.' },
  { q: 'What counts as a "client workspace"?',         a: 'Each client you manage has their own content log and unique dashboard URL. The Starter plan covers one client; Pro covers up to five.' },
  { q: 'Is there a free trial?',                       a: 'Yes — a limited free trial lets you create one workspace with up to 10 entries so you can see the product in action before committing.' },
  { q: 'What is your refund policy?',                  a: 'Full refund within 14 days of purchase, no questions asked. If DevRel Studio isn\'t working for you, just email us.' },
  { q: 'Do clients need to create an account?',        a: 'No. The client dashboard is a read-only URL that requires no login. Just share the link — it works in any browser.' },
  { q: 'Can multiple people use one account?',         a: 'Starter and Pro are single-user. The Agency plan includes up to 5 team member seats. Contact us for larger teams.' },
  { q: 'What content types does DevRel Studio track?', a: 'Five categories: Written (blogs, tutorials, docs), Video (YouTube, Loom), Event (conferences, meetups, webinars), Podcast (guest spots, episodes), and Package (npm, SDKs, CLI tools).' },
]

function FAQ() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-24">
      <div className="text-center mb-14">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Frequently asked questions
        </h2>
        <p className="text-muted-foreground">
          Still have questions?{' '}
          <Link href="mailto:hello@devrel.studio" className="text-accent hover:underline">
            Email us
          </Link>
        </p>
      </div>

      <Accordion type="single" collapsible className="space-y-3">
        {FAQ_ITEMS.map(({ q, a }, i) => (
          <AccordionItem
            key={q}
            value={`item-${i}`}
            className="rounded-xl border border-border bg-card px-6 data-[state=open]:border-accent/40"
          >
            <AccordionTrigger className="text-sm font-medium text-foreground text-left hover:no-underline py-5">
              {q}
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-5">
              {a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function CTA() {
  return (
    <section className="border-t border-border bg-[#232931] py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
          Your clients deserve to see<br />
          the work you&apos;re doing
        </h2>
        <p className="text-white/60 max-w-lg mx-auto mb-10 text-lg">
          Stop burying your impact in monthly PDFs. Give every client a live dashboard
          they can check anytime — and give yourself the recognition you&apos;ve earned.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/pricing">
            <Button size="lg" className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 h-12 px-8">
              Get started today
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="lg" variant="outline" className="h-12 px-8 border-white/20 text-white hover:bg-white/10 bg-transparent">
              Explore the demo
            </Button>
          </Link>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
          {[
            'One-time fee',
            '14-day money-back guarantee',
            'No credit card for free trial',
          ].map((item) => (
            <span key={item} className="flex items-center gap-2 text-sm text-white/50">
              <CheckCircle2 className="h-4 w-4 text-accent" />
              {item}
            </span>
          ))}
        </div>
      </div>
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
      <BeforeAfter />
      <Features />
      <ContentCategories />
      <HowItWorks />
      <Testimonials />
      <FAQ />
      <CTA />
      <MarketingFooter />
    </div>
  )
}
