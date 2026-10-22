import {
  ArrowUpRight,
  Check,
  Download,
  FileText,
  Github,
  KeyRound,
  MapPin,
  Mic,
  Package,
  Rocket,
  Video,
} from 'lucide-react'

// ── Feature bento ─────────────────────────────────────────────────────────────
//
// Every cell renders a miniature of the real interface rather than a screenshot.
// Three reasons: a PNG goes stale the moment the product moves, it cannot follow
// the reader's theme, and it ships a megabyte to say something a div can say in
// a few hundred bytes.
//
// The cells are inert by construction — no state, no queries, no interactivity.
// They are illustrations that happen to be built from the same tokens as the
// thing they illustrate, so they cannot drift in palette or spacing.

function Cell({
  className = '',
  title,
  body,
  tone = 'sand',
  children,
}: {
  className?: string
  eyebrow?: string
  title: string
  body: string
  tone?: 'sand' | 'ochre' | 'blue' | 'ink'
  children?: React.ReactNode
}) {
  const tones = {
    sand: 'bg-sand text-foreground',
    ochre: 'bg-ochre text-ink',
    blue: 'bg-blue text-ink',
    ink: 'bg-ink text-paper',
  }
  return (
    <div className={`relative flex flex-col overflow-hidden rounded-[2rem] p-7 sm:p-9 ${tones[tone]} ${className}`}>
      <h3 className="text-2xl font-medium leading-[1.1] tracking-[-0.03em] sm:text-[1.7rem]">{title}</h3>
      <p className={`mt-3 max-w-md text-[15px] leading-relaxed ${tone === 'ink' ? 'text-paper/70' : tone === 'sand' ? 'text-muted-foreground' : 'text-ink/75'}`}>
        {body}
      </p>
      {children && <div className="mt-8 flex-1">{children}</div>}
    </div>
  )
}

/** The stat row from a client dashboard, deltas and all. */
function StatStrip() {
  const stats = [
    { label: 'Published', value: '13', delta: '+3' },
    { label: 'Views', value: '66.1k', delta: '+38%' },
    { label: 'Downloads', value: '247k', delta: '+12%' },
    { label: 'Attendees', value: '725', delta: 'new' },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-2xl bg-paper p-3">
          <p className="text-[11px] text-muted-foreground">{stat.label}</p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-semibold tabular-nums text-foreground">
              {stat.value}
            </span>
            <span className="inline-flex items-center gap-0.5 text-[11px] text-orange">
              <ArrowUpRight className="h-2.5 w-2.5" />
              {stat.delta}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

/** The category-to-metric mapping, which is the actual product idea. */
function CategoryList() {
  const rows = [
    { icon: FileText, name: 'Written', metric: 'Views' },
    { icon: Video, name: 'Video', metric: 'Views' },
    { icon: MapPin, name: 'Event', metric: 'Attendees' },
    { icon: Mic, name: 'Podcast', metric: 'Downloads' },
    { icon: Package, name: 'Package', metric: 'Weekly downloads' },
    { icon: Rocket, name: 'Demo', metric: 'GitHub stars' },
  ]

  return (
    <div className="overflow-hidden rounded-2xl bg-paper">
      {rows.map(({ icon: Icon, name, metric }, i) => (
        <div
          key={name}
          className={`flex items-center justify-between px-3 py-2 ${
            i > 0 ? 'border-t border-ink/10' : ''
          }`}
        >
          <span className="flex items-center gap-2 text-xs text-foreground">
            <Icon className="h-3 w-3 text-muted-foreground" />
            {name}
          </span>
          <span className="font-mono text-[10px] text-orange">{metric}</span>
        </div>
      ))}
    </div>
  )
}

/** Four lanes, one card in flight. */
function PipelineLanes() {
  const lanes = [
    { label: 'Draft', count: 2, cards: 1 },
    { label: 'In Review', count: 1, cards: 1 },
    { label: 'Scheduled', count: 2, cards: 2 },
    { label: 'Published', count: 13, cards: 2 },
  ]

  return (
    <div className="grid grid-cols-4 gap-2">
      {lanes.map((lane) => (
        <div key={lane.label} className="min-w-0">
          <div className="flex items-baseline justify-between border-t-2 border-ink/20 pt-2">
            <span className="truncate text-[10px] text-muted-foreground">{lane.label}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{lane.count}</span>
          </div>
          <div className="mt-2 space-y-1.5">
            {Array.from({ length: lane.cards }).map((_, i) => (
              <div key={i} className="rounded-xl bg-paper p-2.5">
                <div className="h-1.5 w-4/5 rounded-full bg-muted-foreground/20" />
                <div className="mt-1.5 h-1.5 w-2/5 rounded-full bg-muted-foreground/10" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** The access-code gate, in its protected state. */
function AccessState() {
  return (
    <div className="rounded-2xl bg-paper p-4">
      <div className="flex items-center gap-2">
        <KeyRound className="h-3.5 w-3.5 text-orange" />
        <span className="text-xs font-medium text-foreground">Protected by an access code</span>
      </div>
      <div className="mt-3 rounded-xl bg-sand px-3 py-2 text-center font-mono text-sm tracking-[0.25em] text-foreground">
        7K4M–PQX2
      </div>
      <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
        Set it per client. Change it any time.
      </p>
    </div>
  )
}

/** npm and GitHub numbers arriving on their own. */
function SyncState() {
  return (
    <div className="space-y-2">
      {[
        { icon: Package, name: '@acme/webhook-verify', value: '9,420 / wk' },
        { icon: Github, name: 'acme/saas-starter', value: '2,840 stars' },
      ].map(({ icon: Icon, name, value }) => (
        <div
          key={name}
          className="flex items-center gap-2.5 rounded-2xl bg-paper px-3 py-2.5"
        >
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground">
            {name}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-orange">{value}</span>
        </div>
      ))}
      <p className="pt-1 text-[11px] text-paper/60">Refreshed daily. Nothing to set up.</p>
    </div>
  )
}

export function FeatureBento() {
  return (
    <section id="features" className="mx-auto max-w-[1600px] px-4 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-[clamp(2.25rem,5.4vw,4rem)] font-medium leading-[1.03] tracking-[-0.03em] text-foreground">
          The record
          <br />
          behind every report
        </h2>
      </div>

      <div className="mt-14 grid gap-4 lg:grid-cols-6">
        <Cell
          className="lg:col-span-4"
          title="A live address, not a monthly PDF"
          body="Every client and executive gets a URL that shows what you shipped and how it performed. Each number carries its change against last month."
        >
          <StatStrip />
        </Cell>

        <Cell
          className="lg:col-span-2"
          tone="ochre"
          title="Open, or locked with a code"
          body="Share it with anyone, or ask for an access code. You choose per client."
        >
          <AccessState />
        </Cell>

        <Cell
          className="lg:col-span-2"
          tone="blue"
          title="Six kinds of work, six numbers"
          body="From video views to package downloads, each category tracks the number that suits it."
        >
          <CategoryList />
        </Cell>

        <Cell
          className="lg:col-span-4"
          title="See what is still in flight"
          body="Four lanes, by status. Late work turns amber. Move a card and it saves at once."
        >
          <PipelineLanes />
        </Cell>

        <Cell
          className="lg:col-span-3"
          tone="ink"
          title="npm and GitHub update themselves"
          body="A daily job refreshes downloads and stars. Your client never sees a number you typed weeks ago."
        >
          <SyncState />
        </Cell>

        <Cell
          className="lg:col-span-3"
          title="A public record, readable by agents"
          body="Publish everything you shipped at your handle, with an llms.txt beside it. Export any view as CSV or PDF when a conversation needs paper."
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 rounded-2xl bg-paper px-4 py-3">
              <span className="font-mono text-[11px] text-foreground">devrel.studio/@you</span>
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-green">
                <Check className="h-3 w-3" />
                Live
              </span>
            </div>
            <div className="flex items-center gap-2.5 rounded-2xl bg-paper px-4 py-3">
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">Export current view: CSV, PDF</span>
            </div>
          </div>
        </Cell>
      </div>
    </section>
  )
}
