'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { Card } from '@/components/ui/card'
import { AlertTriangle, ArrowLeft, Globe, KeyRound, Unlock } from 'lucide-react'

// ── One workspace ─────────────────────────────────────────────────────────────
//
// What it is using against what its owner's plan allows, who is in it, and which
// dashboards it publishes.
//
// The client list is here because a support email quotes an address, not a
// company: turning `acme.devrel.studio` into "whose workspace is this, and is
// their access still open" is most of answering it.

export default function AdminWorkspacePage() {
  const params = useParams<{ workspaceId: string }>()
  const workspaceId = params.workspaceId as Id<'workspaces'>

  const detail = useQuery(api.adminWorkspaces.workspaceDetail, { workspaceId })

  if (detail === undefined) {
    return (
      <div className="space-y-3">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  if (detail === null) {
    return (
      <Card className="gap-0 p-10 text-center">
        <p className="text-sm text-muted-foreground">That workspace no longer exists.</p>
        <Link
          href="/admin/workspaces"
          className="mt-4 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Back to workspaces
        </Link>
      </Card>
    )
  }

  const { workspace, owner, usage, limits, over, members, clients } = detail
  const flagged = over.clients || over.entries || over.seats

  return (
    <>
      <Link
        href="/admin/workspaces"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Workspaces
      </Link>

      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-foreground">{workspace.name}</h1>
          {workspace.isPersonal && (
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
              personal
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {owner ? (
            <>
              Owned by{' '}
              <Link
                href={`/admin/users/${owner.id}`}
                className="underline underline-offset-4 hover:text-foreground"
              >
                {owner.email}
              </Link>
              {' · '}
              {owner.planName}
              {owner.state !== 'active' && owner.state !== 'comped' && (
                <> · access {owner.state}</>
              )}
            </>
          ) : (
            'The owning account was deleted — nothing here has a plan behind it.'
          )}
        </p>
      </div>

      {flagged && (
        <Card className="mb-4 gap-0 border-amber-600/30 p-4">
          <p className="flex items-start gap-2 text-sm text-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
            <span>
              Over what {owner ? 'this plan' : 'the free plan'} allows. Writes are already
              blocked at the limit — this usually means an invoice is due, not that
              anybody did anything wrong. Nothing has been deleted.
            </span>
          </p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-0 p-5">
          <h2 className="text-sm font-semibold text-foreground">Usage</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Counted by workspace against the owner&apos;s plan — the way the product
            enforces it.
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            <Row
              label="Clients"
              count={usage.clients}
              limit={limits.maxClients}
              over={over.clients}
            />
            <Row
              label="Content entries"
              count={usage.entries}
              limit={limits.maxEntries}
              over={over.entries}
            />
            <Row label="Members" count={usage.members} limit={limits.seats} over={over.seats} />
          </dl>
        </Card>

        <Card className="gap-0 p-5">
          <h2 className="text-sm font-semibold text-foreground">Members</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {members.map((member) => (
              <li key={member.id} className="flex items-baseline justify-between gap-3">
                <Link
                  href={`/admin/users/${member.userId}`}
                  className="truncate text-foreground underline-offset-4 hover:underline"
                >
                  {member.email}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {member.role}
                  {member.isOwner && ' · billing'}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-4 gap-0 p-5">
        <h2 className="text-sm font-semibold text-foreground">Client dashboards</h2>
        {clients.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No clients in this workspace.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {clients.map((client) => (
              <li
                key={client.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 text-sm last:border-0 last:pb-0"
              >
                <span className="text-foreground">
                  {client.company}
                  {client.slug && (
                    <span className="text-muted-foreground"> · {client.slug}.devrel.studio</span>
                  )}
                </span>
                <Gate gate={client.gate} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

function Row({
  label,
  count,
  limit,
  over,
}: {
  label: string
  count: number
  limit: number | null
  over: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={`text-right tabular-nums ${
          over ? 'font-medium text-amber-600 dark:text-amber-500' : 'text-foreground'
        }`}
      >
        {count}
        {limit === null ? ' of unlimited' : ` of ${limit}`}
      </dd>
    </div>
  )
}

/**
 * How a dashboard is protected.
 *
 * 'open' is not a bug — a client with no code and no public flag is a DevRel who
 * has not finished setting it up, and the product deliberately lets them in
 * rather than locking them out of their own workspace. It is worth seeing here
 * because an address that needs no code is the one nobody can be locked out of.
 */
function Gate({ gate }: { gate: string }) {
  if (gate === 'public') {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Globe className="h-3 w-3" />
        anyone with the link
      </span>
    )
  }
  if (gate === 'code') {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <KeyRound className="h-3 w-3" />
        access code
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Unlock className="h-3 w-3" />
      no code set
    </span>
  )
}
