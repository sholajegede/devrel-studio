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
  eyebrow,
  title,
  body,
  children,
}: {
  className?: string
  eyebrow?: string
  title: string
  body: string
  children?: React.ReactNode
}) {
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-xl border border-border bg-background p-6 transition-colors hover:border-foreground/20 ${className}`}
    >
      {eyebrow && (
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-accent">
          {eyebrow}
        </span>
      )}
      <h3 className="mt-2 text-[15px] font-medium text-foreground">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
      {children && <div className="mt-6 flex-1">{children}</div>}
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
        <div key={stat.label} className="rounded-lg border border-border bg-card p-3">
          <p className="text-[11px] text-muted-foreground">{stat.label}</p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-semibold tabular-nums text-foreground">
              {stat.value}
            </span>
            <span className="inline-flex items-center gap-0.5 text-[11px] text-accent">
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
    <div className="overflow-hidden rounded-lg border border-border">
      {rows.map(({ icon: Icon, name, metric }, i) => (
        <div
          key={name}
          className={`flex items-center justify-between px-3 py-2 ${
            i > 0 ? 'border-t border-border' : ''
          }`}
        >
          <span className="flex items-center gap-2 text-xs text-foreground">
            <Icon className="h-3 w-3 text-muted-foreground" />
            {name}
          </span>
          <span className="font-mono text-[10px] text-accent">{metric}</span>
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
          <div className="flex items-baseline justify-between border-t-2 border-border pt-2">
            <span className="truncate text-[10px] text-muted-foreground">{lane.label}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{lane.count}</span>
          </div>
          <div className="mt-2 space-y-1.5">
            {Array.from({ length: lane.cards }).map((_, i) => (
              <div key={i} className="rounded-md border border-border bg-card p-2">
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
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <KeyRound className="h-3.5 w-3.5 text-accent" />
        <span className="text-xs font-medium text-foreground">Protected by an access code</span>
      </div>
      <div className="mt-3 rounded-md border border-border bg-background px-3 py-2 text-center font-mono text-sm tracking-[0.25em] text-foreground">
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
          className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5"
        >
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground">
            {name}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-accent">{value}</span>
        </div>
      ))}
      <p className="pt-1 text-[11px] text-muted-foreground">Refreshed daily. Nothing to set up.</p>
    </div>
  )
}

export function FeatureBento() {
  return (
    <section id="features" className="border-t border-border bg-card/40 py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Product
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-[-0.02em] leading-[1.15] text-foreground">
            Built for how DevRel work happens
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            Not a project tracker. Not a CMS. Built for advocates who ship content for clients
            and have to prove it.
          </p>
        </div>

        <div className="mt-14 grid gap-4 lg:grid-cols-6">
          <Cell
            className="lg:col-span-4"
            eyebrow="Client dashboard"
            title="A live URL, not a monthly PDF"
            body="Every client gets an address showing what you shipped and how it performed. Each number carries the change against last month."
          >
            <StatStrip />
          </Cell>

          <Cell
            className="lg:col-span-2"
            eyebrow="Access"
            title="Locked by default"
            body="Share it openly, or ask for a code."
          >
            <AccessState />
          </Cell>

          <Cell
            className="lg:col-span-2"
            eyebrow="Coverage"
            title="Six categories, six numbers"
            body="Each kind of work carries the number that suits it."
          >
            <CategoryList />
          </Cell>

          <Cell
            className="lg:col-span-4"
            eyebrow="Pipeline"
            title="See what is still in flight"
            body="Four lanes by status. Late work turns amber. Move a card and it saves at once, with no form to fill in."
          >
            <PipelineLanes />
          </Cell>

          <Cell
            className="lg:col-span-3"
            eyebrow="Automatic"
            title="npm and GitHub update themselves"
            body="A daily job refreshes downloads and stars. Your client never sees a number you typed in weeks ago."
          >
            <SyncState />
          </Cell>

          <Cell
            className="lg:col-span-3"
            eyebrow="Portfolio & export"
            title="Your own work, not just theirs"
            body="Publish everything you shipped at your own handle. Pull any view out as CSV or PDF when a conversation needs paper."
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5">
                <span className="font-mono text-[11px] text-foreground">
                  devrel.studio/@you
                </span>
                <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-accent">
                  <Check className="h-3 w-3" />
                  Live
                </span>
              </div>
              <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5">
                <Download className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">
                  Export current view — CSV, PDF
                </span>
              </div>
            </div>
          </Cell>
        </div>
      </div>
    </section>
  )
}
